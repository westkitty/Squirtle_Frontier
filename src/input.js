// One normalized input state for keyboard, mouse, touch and standard gamepads.
export const GAMEPAD_DEADZONE = 0.18;
export const TOUCH_DEADZONE = 0.1;

export function radialDeadzone(x, y, deadzone = GAMEPAD_DEADZONE) {
  const magnitude = Math.hypot(x, y);
  if (!Number.isFinite(magnitude) || magnitude <= deadzone)
    return { x: 0, y: 0 };
  const scaled = Math.min(
    1,
    (magnitude - deadzone) / Math.max(0.001, 1 - deadzone),
  );
  return {
    x: (x / magnitude) * scaled,
    y: (y / magnitude) * scaled,
  };
}

const pressed = (button, threshold = 0.35) =>
  !!button && (button.pressed || Number(button.value) > threshold);

export function standardGamepadState(gamepad) {
  if (!gamepad)
    return {
      connected: false,
      name: "",
      move: { x: 0, z: 0 },
      look: { x: 0, y: 0 },
      run: false,
      slide: false,
      jet: false,
      interact: false,
      sense: false,
      dive: false,
      ascend: false,
      recenter: false,
    };
  const axes = gamepad.axes || [],
    buttons = gamepad.buttons || [],
    move = radialDeadzone(Number(axes[0]) || 0, -(Number(axes[1]) || 0)),
    look = radialDeadzone(Number(axes[2]) || 0, Number(axes[3]) || 0);
  return {
    connected: gamepad.connected !== false,
    name: gamepad.id || "Gamepad",
    move: { x: move.x, z: move.y },
    look,
    // Standard mapping: A jet, B shell, X sense, Y interact, shoulders dive/rise,
    // right trigger (or left-stick press) runs.
    jet: pressed(buttons[0]),
    slide: pressed(buttons[1]),
    sense: pressed(buttons[2]),
    interact: pressed(buttons[3]),
    dive: pressed(buttons[4]),
    ascend: pressed(buttons[5]),
    run: pressed(buttons[7]) || pressed(buttons[10]),
    recenter: pressed(buttons[11]),
  };
}

export function touchStickState(rect, clientX, clientY) {
  const half = Math.max(1, Math.min(rect.width, rect.height) / 2),
    radius = Math.max(18, half - 18),
    rawX = (clientX - rect.left - rect.width / 2) / radius,
    rawZ = -(clientY - rect.top - rect.height / 2) / radius,
    stick = radialDeadzone(rawX, rawZ, TOUCH_DEADZONE),
    travel = Math.max(12, half - 24);
  return {
    x: stick.x,
    z: stick.y,
    dx: stick.x * travel,
    dy: -stick.y * travel,
  };
}

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.abort = new AbortController();
    this.lookX = 0;
    this.lookY = 0;
    this.stick = { x: 0, z: 0 };
    this.actions = {};
    this.pointers = new Map();
    this.canvas = canvas;
    this.suppressed = false;
    this.modality = "keyboard";
    this.controller = { connected: false, name: "" };
    canvas.tabIndex = 0;
    const options = { signal: this.abort.signal };
    addEventListener(
      "keydown",
      (e) => {
        if (e.repeat || this.suppressed) return;
        this.modality = "keyboard";
        // Synthetic or window-targeted events have no closest(); a real UI
        // control keeps keyboard input to itself.
        if (e.target?.closest?.("input,select,button,textarea")) return;
        if (
          ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            e.code,
          )
        )
          e.preventDefault();
        this.keys.add(e.code);
      },
      options,
    );
    addEventListener("keyup", (e) => this.keys.delete(e.code), options);
    addEventListener("blur", () => this.clear(), options);
    addEventListener(
      "gamepadconnected",
      (e) => {
        this.controller = { connected: true, name: e.gamepad?.id || "Gamepad" };
      },
      options,
    );
    addEventListener(
      "gamepaddisconnected",
      () => {
        this.controller = { connected: false, name: "" };
        if (this.modality === "gamepad") this.modality = "keyboard";
      },
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.clear();
      },
      options,
    );
    const stick = document.querySelector("#stick");
    const bind = (element, type) => {
      element.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          if (this.suppressed) return;
          this.modality = e.pointerType === "touch" ? "touch" : "pointer";
          if (type === "look") canvas.focus({ preventScroll: true });
          try {
            element.setPointerCapture(e.pointerId);
          } catch {
            /* capture is an optimisation, not a precondition */
          }
          this.pointers.set(e.pointerId, {
            type,
            x: e.clientX,
            y: e.clientY,
            element,
          });
          if (type === "stick") this.moveStick(e, element);
          else if (type !== "look") this.actions[type] = true;
        },
        options,
      );
      element.addEventListener(
        "pointermove",
        (e) => {
          const p = this.pointers.get(e.pointerId);
          if (!p || this.suppressed) return;
          if (type === "stick") this.moveStick(e, element);
          else if (type === "look") {
            this.lookX += e.clientX - p.x;
            this.lookY += e.clientY - p.y;
            p.x = e.clientX;
            p.y = e.clientY;
          }
        },
        options,
      );
      const release = (e) => {
        this.pointers.delete(e.pointerId);
        if (type === "stick") {
          this.stick = { x: 0, z: 0 };
          element.style.setProperty("--dx", "0px");
          element.style.setProperty("--dy", "0px");
        } else if (type !== "look") this.actions[type] = false;
      };
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
        element.addEventListener(name, release, options);
    };
    bind(canvas, "look");
    if (stick) bind(stick, "stick");
    for (const button of document.querySelectorAll("[data-action]"))
      bind(button, button.dataset.action);
  }

  readGamepad() {
    try {
      const pads = Array.from(globalThis.navigator?.getGamepads?.() || []),
        pad = pads.find(
          (candidate) => candidate && candidate.connected !== false,
        ),
        state = standardGamepadState(pad);
      this.controller = { connected: state.connected, name: state.name };
      if (
        state.connected &&
        (
          Math.hypot(state.move.x, state.move.z) > 0.05 ||
          Math.hypot(state.look.x, state.look.y) > 0.05 ||
          state.run ||
          state.slide ||
          state.jet ||
          state.interact ||
          state.sense ||
          state.dive ||
          state.ascend ||
          state.recenter
        )
      )
        this.modality = "gamepad";
      return state;
    } catch {
      this.controller = { connected: false, name: "" };
      return standardGamepadState(null);
    }
  }

  gamepadStatus() {
    this.readGamepad();
    return { ...this.controller, modality: this.modality };
  }

  inputMode() {
    return this.modality;
  }

  moveStick(e, element) {
    const state = touchStickState(
      element.getBoundingClientRect(),
      e.clientX,
      e.clientY,
    );
    this.stick = { x: state.x, z: state.z };
    element.style.setProperty("--dx", `${state.dx}px`);
    element.style.setProperty("--dy", `${state.dy}px`);
  }

  sample() {
    if (this.suppressed)
      return {
        x: 0,
        z: 0,
        run: false,
        slide: false,
        jet: false,
        interact: false,
        sense: false,
        dive: false,
        ascend: false,
        recenter: false,
      };
    const pad = this.readGamepad();
    let x =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) +
      this.stick.x +
      pad.move.x;
    let z =
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) +
      this.stick.z +
      pad.move.z;
    const length = Math.max(1, Math.hypot(x, z));
    return {
      x: x / length,
      z: z / length,
      run: this.keys.has("ShiftLeft") || this.actions.run || pad.run,
      slide: this.keys.has("KeyC") || this.actions.slide || pad.slide,
      jet: this.keys.has("Space") || this.actions.jet || pad.jet,
      interact: this.keys.has("KeyR") || this.actions.interact || pad.interact,
      sense: this.keys.has("KeyF") || this.actions.sense || pad.sense,
      dive: this.keys.has("KeyQ") || this.actions.dive || pad.dive,
      ascend: this.keys.has("KeyE") || this.actions.ascend || pad.ascend,
      recenter: this.keys.has("KeyV") || pad.recenter,
    };
  }

  consumeLook() {
    if (this.suppressed) {
      this.lookX = 0;
      this.lookY = 0;
      return { lookX: 0, lookY: 0, lookRateX: 0, lookRateY: 0 };
    }
    const pad = this.readGamepad(),
      look = {
        lookX: this.lookX,
        lookY: this.lookY,
        lookRateX: pad.look.x,
        lookRateY: pad.look.y,
      };
    this.lookX = 0;
    this.lookY = 0;
    return look;
  }

  setSuppressed(suppressed) {
    const next = !!suppressed;
    if (next && !this.suppressed) this.clear();
    this.suppressed = next;
  }

  clear() {
    this.keys.clear();
    this.actions = {};
    this.stick = { x: 0, z: 0 };
    this.lookX = 0;
    this.lookY = 0;
    for (const [id, p] of this.pointers) {
      if (p.element.hasPointerCapture(id)) p.element.releasePointerCapture(id);
    }
    this.pointers.clear();
    const stick = document.querySelector("#stick");
    stick?.style.setProperty("--dx", "0px");
    stick?.style.setProperty("--dy", "0px");
  }

  dispose() {
    this.clear();
    this.abort.abort();
  }
}
