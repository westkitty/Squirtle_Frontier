import { launchBrowser } from "./browser-launch.mjs";
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on("pageerror", (e) => console.log("PAGEERROR", String(e.message).slice(0, 200)));
await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
await page.waitForFunction(() => window.__SF?.streaming.stats().active === 9 && window.__SF.loop.frames.length > 10);
console.log("spawn", await page.evaluate(() => ({ ...window.__SF.body, level: window.__SF.state.waterLevel, place: window.__SF.state.place })));
await page.evaluate(() => document.querySelector("canvas").focus());
await page.keyboard.down("KeyD");
for (let i = 0; i < 8; i++) {
  await new Promise((r) => setTimeout(r, 700));
  console.log(await page.evaluate(() => ({ x: +window.__SF.body.x.toFixed(2), z: +window.__SF.body.z.toFixed(2), y: +window.__SF.body.y.toFixed(2), mode: window.__SF.body.mode, water: window.__SF.water(), level: +window.__SF.state.waterLevel.toFixed(2) })));
}
await page.keyboard.up("KeyD");
await browser.close();
