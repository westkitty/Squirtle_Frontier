// Automated accessibility evidence: names, contrast, focus, keyboard flow,
// reduced motion, touch targets and panel semantics. Not a substitute for
// a human assistive-technology session.
import { launchBrowser } from "./browser-launch.mjs";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await launchBrowser(),
  evidence = { errors: [], violations: [] };
const audit = () => {
  const violations = [];
  const visible = (e) => {
    const s = getComputedStyle(e);
    return (
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      e.offsetParent !== null
    );
  };
  const parse = (c) => (c.match(/[\d.]+/g) || [0, 0, 0, 1]).map(Number);
  const composite = (fg, bg, a = 1) =>
    [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
  // Composite every translucent layer down to the first opaque one; stopping
  // early made dark text on a light panel read as invisible.
  const backgroundOf = (e) => {
    const layers = [];
    for (let n = e; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor),
        a = c[3] ?? 1;
      if (a > 0) layers.push({ c: c.slice(0, 3), a });
      if (a >= 1) break;
    }
    let base =
      layers.length && layers[layers.length - 1].a >= 1
        ? layers.pop().c
        : [30, 57, 51]; // :root fallback
    for (let i = layers.length - 1; i >= 0; i--)
      base = composite(layers[i].c, base, layers[i].a);
    return base;
  };
  const luminance = (c) => {
    const [r, g, b] = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const l1 = luminance(a),
      l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  // 1. Accessible names, text contrast and touch hit area for every visible control.
  const interactive = "button,input,select,textarea,a[href]";
  for (const e of document.querySelectorAll(`${interactive},meter`)) {
    if (!visible(e)) continue;
    const name = (
      e.getAttribute("aria-label") ||
      (e.labels?.length
        ? [...e.labels].map((l) => l.textContent).join(" ")
        : "") ||
      e.textContent ||
      ""
    ).trim();
    if (!name && !e.getAttribute("aria-labelledby"))
      violations.push(`unnamed control ${e.id || e.tagName}`);
    if (e.getAttribute("aria-hidden") === "true")
      violations.push(`aria-hidden interactive ${e.id}`);
    const ratio = contrast(parse(getComputedStyle(e).color), backgroundOf(e));
    if (ratio < 4.5)
      violations.push(`contrast ${e.id || name} ${ratio.toFixed(2)}`);
    // Size is a pointer-target rule; read-outs such as the jet meter are exempt.
    if (!e.matches(interactive)) continue;
    const r = e.getBoundingClientRect();
    if (
      document.body.classList.contains("touch") &&
      (r.height < 44 || r.width < 44)
    )
      violations.push(
        `small touch target ${e.id || name || e.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`,
      );
  }
  // 2. Panel semantics and disclosure state.
  for (const name of ["help", "settings", "memory"]) {
    const toggle = document.querySelector(`#${name}-toggle`),
      panel = document.querySelector(`#${name}`);
    if (toggle.getAttribute("aria-controls") !== name)
      violations.push(`aria-controls ${name}`);
    if (!["true", "false"].includes(toggle.getAttribute("aria-expanded")))
      violations.push(`aria-expanded ${name}`);
    const label = panel.getAttribute("aria-labelledby");
    if (!label || !document.getElementById(label)?.textContent.trim())
      violations.push(`panel label ${name}`);
  }
  // 3. Status announcements, one h1, described survey graphic, focusable canvas.
  const status = document.querySelector("#status");
  if (
    status.getAttribute("role") !== "status" &&
    !status.hasAttribute("aria-live")
  )
    violations.push("status is not announced");
  if (document.querySelectorAll("h1").length !== 1) violations.push("h1 count");
  const survey = document.querySelector("#survey");
  if (
    survey.getAttribute("role") !== "img" ||
    !survey.getAttribute("aria-label")
  )
    violations.push("survey graphic needs a text alternative");
  const canvas = document.querySelector("canvas");
  if (!canvas.getAttribute("aria-label") || canvas.tabIndex < 0)
    violations.push("canvas focusability/label");
  return {
    violations,
    lowestContrast: Math.min(
      ...[...document.querySelectorAll("button")]
        .filter(visible)
        .map(
          (b) =>
            +contrast(
              parse(getComputedStyle(b).color),
              backgroundOf(b),
            ).toFixed(2),
        ),
    ),
  };
};
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  page.on(
    "console",
    (m) => m.type() === "error" && evidence.errors.push(m.text()),
  );
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__SF?.loop.frames.length > 5, null, {
    timeout: 60000,
  });
  evidence.desktop = await page.evaluate(audit);
  // 5. Genuine keyboard traversal: every in-page stop must show a visible
  // indicator. Tab may pass through the browser chrome between documents.
  await page.evaluate(() => document.querySelector("canvas").focus());
  evidence.focusWalk = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement,
        s = getComputedStyle(el);
      return {
        id: el.id || el.tagName,
        inPage:
          el !== document.body &&
          el !== document.documentElement &&
          (el.tagName === "CANVAS" || !!el.offsetParent),
        visible: el.matches(":focus-visible"),
        width: s.outlineWidth,
        style: s.outlineStyle,
        color: s.outlineColor,
      };
    });
    if (!stop.inPage) continue;
    evidence.focusWalk.push(stop);
    assert.equal(
      stop.visible,
      true,
      `Tab stop ${stop.id} is not focus-visible`,
    );
    assert.ok(
      parseFloat(stop.width) >= 2 && stop.style !== "none",
      JSON.stringify(stop),
    );
  }
  const stops = evidence.focusWalk.map((f) => f.id);
  assert.ok(stops.length >= 3, `only ${stops.length} focusable stops`);
  for (const id of [
    "memory-toggle",
    "help-toggle",
    "settings-toggle",
    "CANVAS",
  ])
    assert.ok(stops.includes(id), `keyboard cannot reach ${id}`);

  // 6. Keyboard-only panel flow for every disclosure.
  for (const name of ["memory", "help", "settings"]) {
    await page.evaluate(
      (n) => document.querySelector(`#${n}-toggle`).focus(),
      name,
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      (n) => !document.querySelector(`#${n}`).hidden,
      name,
    );
    evidence[`open-${name}`] = await page.evaluate(() => ({
      focusTag: document.activeElement.tagName,
      focusId: document.activeElement.id || null,
      inPanel: !!document.activeElement.closest("aside"),
      announced: document.querySelector("#status").textContent,
    }));
    assert.match(evidence[`open-${name}`].announced, /open\. Press Escape/);
    assert.equal(
      evidence[`open-${name}`].inPanel,
      true,
      `${name} did not move focus into the panel`,
    );
    // Escape closes every panel and returns control of the world to the canvas.
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.activeElement.tagName === "CANVAS",
    );
    assert.equal(
      await page.evaluate(
        () => document.querySelectorAll("aside:not([hidden])").length,
      ),
      0,
    );
    assert.equal(
      await page.evaluate(() =>
        [...document.querySelectorAll("[aria-expanded]")].every(
          (b) => b.getAttribute("aria-expanded") === "false",
        ),
      ),
      true,
    );
    assert.match(
      await page.evaluate(() => document.querySelector("#status").textContent),
      /closed\./,
    );
  }
  // 6. Reduced motion honoured from the OS preference, then overridable in-game.
  const reduced = await browser.newPage({
    viewport: { width: 960, height: 640 },
    reducedMotion: "reduce",
  });
  await reduced.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await reduced.waitForFunction(
    () => window.__SF?.loop.frames.length > 5,
    null,
    { timeout: 60000 },
  );
  evidence.reducedMotion = await reduced.evaluate(() => ({
    bodyClass: document.body.classList.contains("reduced-motion"),
    stored:
      JSON.parse(localStorage.getItem("squirtle_frontier_settings_v1") || "{}")
        .reducedMotion ?? null,
  }));
  assert.equal(evidence.reducedMotion.bodyClass, true);
  await reduced.click("#settings-toggle");
  await reduced.selectOption("#motion", "full");
  await reduced.waitForTimeout(150);
  evidence.reducedMotionOff = await reduced.evaluate(() => ({
    bodyClass: document.body.classList.contains("reduced-motion"),
    stored: JSON.parse(localStorage.getItem("squirtle_frontier_settings_v1"))
      .reducedMotion,
    announced: document.querySelector("#status").textContent,
  }));
  assert.deepEqual(evidence.reducedMotionOff, {
    bodyClass: false,
    stored: false,
    announced: "Full camera motion.",
  });
  // Returning to "follow the system" re-adopts the OS request.
  await reduced.selectOption("#motion", "auto");
  await reduced.waitForTimeout(150);
  evidence.reducedMotionAuto = await reduced.evaluate(() => ({
    bodyClass: document.body.classList.contains("reduced-motion"),
    stored: JSON.parse(localStorage.getItem("squirtle_frontier_settings_v1"))
      .reducedMotion,
  }));
  assert.deepEqual(evidence.reducedMotionAuto, {
    bodyClass: true,
    stored: null,
  });
  // An explicit in-game choice wins over an OS that asks for nothing.
  const free = await browser.newPage({
    viewport: { width: 960, height: 640 },
    reducedMotion: "no-preference",
  });
  await free.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await free.waitForFunction(() => window.__SF?.loop.frames.length > 5, null, {
    timeout: 60000,
  });
  evidence.systemDefaultMotion = await free.evaluate(() =>
    document.body.classList.contains("reduced-motion"),
  );
  assert.equal(evidence.systemDefaultMotion, false);
  await free.click("#settings-toggle");
  await free.selectOption("#motion", "reduce");
  await free.waitForTimeout(150);
  evidence.forcedReduceOverSystem = await free.evaluate(() => ({
    bodyClass: document.body.classList.contains("reduced-motion"),
    stored: JSON.parse(localStorage.getItem("squirtle_frontier_settings_v1"))
      .reducedMotion,
  }));
  assert.deepEqual(evidence.forcedReduceOverSystem, {
    bodyClass: true,
    stored: true,
  });
  await free.close();
  // 7. Adaptive resolution toggle persists and pins scale at full detail when off.
  evidence.adaptiveOn = await reduced.evaluate(() => ({
    checked: document.querySelector("#adaptive").checked,
    enabled: window.__SF.adaptive.enabled,
    pixelRatio: window.__SF.renderer.getPixelRatio(),
    width: window.__SF.renderer.domElement.width,
  }));
  await reduced.evaluate(() => document.querySelector("#adaptive").click());
  await reduced.waitForTimeout(150);
  evidence.adaptiveOff = await reduced.evaluate(() => ({
    stored: JSON.parse(localStorage.getItem("squirtle_frontier_settings_v1"))
      .adaptive,
    enabled: window.__SF.adaptive.enabled,
    value: window.__SF.adaptive.value,
    pixelRatio: window.__SF.renderer.getPixelRatio(),
    cssWidth: document.querySelector("canvas").clientWidth,
    width: window.__SF.renderer.domElement.width,
  }));
  assert.equal(evidence.adaptiveOn.enabled, true);
  assert.deepEqual(
    {
      enabled: evidence.adaptiveOff.enabled,
      value: evidence.adaptiveOff.value,
      stored: evidence.adaptiveOff.stored,
    },
    { enabled: false, value: 1, stored: false },
  );
  assert.equal(
    evidence.adaptiveOff.cssWidth,
    evidence.adaptiveOff.width / evidence.adaptiveOff.pixelRatio,
  );
  await reduced.close();
  // 8. Coarse pointer: touch targets, layout clearance and keyboard-only movement parity.
  const touch = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await touch.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await touch.waitForFunction(() => window.__SF?.loop.frames.length > 5, null, {
    timeout: 60000,
  });
  evidence.touch = await touch.evaluate(audit);
  evidence.layout = await touch.evaluate(() => {
    const nav = document.querySelector("nav").getBoundingClientRect(),
      title = document.querySelector("h1").getBoundingClientRect(),
      stick = document.querySelector("#stick").getBoundingClientRect(),
      footer = document.querySelector("footer").getBoundingClientRect();
    return {
      navBelowTitle: nav.top >= title.bottom,
      stickClearsFooter:
        stick.top >= footer.bottom || footer.top >= stick.bottom,
      stickSize: [Math.round(stick.width), Math.round(stick.height)],
    };
  });
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(evidence.layout).map(([k, v]) => [
        k,
        typeof v === "boolean" ? v : v,
      ]),
    ),
    { ...evidence.layout, navBelowTitle: true, stickClearsFooter: true },
  );
  await touch.screenshot({ path: "artifacts/a11y-touch.png" });
  const moved = await touch.evaluate(async () => {
    const before = { ...window.__SF.body };
    const send = (type, code) =>
      window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
    send("keydown", "KeyW");
    await new Promise((r) => setTimeout(r, 600));
    send("keyup", "KeyW");
    return +Math.hypot(
      window.__SF.body.x - before.x,
      window.__SF.body.z - before.z,
    ).toFixed(3);
  });
  evidence.touchKeyboardMoveMeters = moved;
  assert.ok(moved > 0.2, `keyboard-only movement ${moved}`);
  // 9. A real finger drag drives the stick; release must stop cleanly.
  const cdp = await touch.context().newCDPSession(touch);
  const before = await touch.evaluate(() => ({ ...window.__SF.body }));
  const center = await touch.evaluate(() => {
    const r = document.querySelector("#stick").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [center],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: center.x, y: center.y - 30 }],
  });
  await touch.waitForTimeout(500);
  const dragging = await touch.evaluate(() => ({
    stick: { ...window.__SF.input.stick },
    pointers: window.__SF.input.pointers.size,
  }));
  evidence.stickDrag = dragging;
  assert.ok(
    Math.hypot(dragging.stick.x, dragging.stick.z) > 0.4,
    JSON.stringify(dragging),
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.waitForTimeout(200);
  evidence.stickRelease = await touch.evaluate(async () => {
    const before = { ...window.__SF.body };
    await new Promise((r) => setTimeout(r, 300));
    return {
      stick: { ...window.__SF.input.stick },
      drifted: +Math.hypot(
        window.__SF.body.x - before.x,
        window.__SF.body.z - before.z,
      ).toFixed(3),
    };
  });
  assert.deepEqual(evidence.stickRelease.stick, { x: 0, z: 0 });
  assert.ok(
    evidence.stickRelease.drifted < 0.35,
    JSON.stringify(evidence.stickRelease),
  );
  evidence.stickMovedMeters = await touch.evaluate(
    (b) =>
      +Math.hypot(window.__SF.body.x - b.x, window.__SF.body.z - b.z).toFixed(
        3,
      ),
    before,
  );
  assert.ok(
    evidence.stickMovedMeters > 0.2,
    `stick movement ${evidence.stickMovedMeters}`,
  );
  for (const key of ["desktop", "touch"])
    for (const v of evidence[key].violations)
      evidence.violations.push(`${key}: ${v}`);
  assert.deepEqual(evidence.violations, []);
  assert.deepEqual(evidence.errors, []);
  console.log(
    "Names, contrast, focus, keyboard panel flow, reduced motion, adaptive toggle, touch targets and stick drag validated. Human screen-reader session remains unverified.",
  );
} finally {
  await writeFile(
    "docs/qa/accessibility-browser.json",
    JSON.stringify(evidence, null, 2),
  );
  await browser.close();
}
