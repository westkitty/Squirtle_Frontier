// One normalized input state for keyboard, mouse and concurrent touch pointers.
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
    canvas.tabIndex = 0;
    const options = { signal: this.abort.signal };
    addEventListener(
      "keydown",
      (e) => {
        if (e.repeat) return;
        if (e.target.closest("input,select,button,textarea")) return;
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
          if (type === "look") canvas.focus({ preventScroll: true });
          element.setPointerCapture(e.pointerId);
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
          if (!p) return;
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
  moveStick(e, element) {
    const rect = element.getBoundingClientRect(),
      x = e.clientX - rect.left - rect.width / 2,
      y = e.clientY - rect.top - rect.height / 2;
    const scale = Math.max(42, Math.hypot(x, y));
    this.stick = { x: x / scale, z: -y / scale };
    element.style.setProperty("--dx", `${this.stick.x * 34}px`);
    element.style.setProperty("--dy", `${-this.stick.z * 34}px`);
  }
  sample() {
    let x =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft")) +
      this.stick.x;
    let z =
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) -
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) +
      this.stick.z;
    const length = Math.max(1, Math.hypot(x, z));
    return {
      x: x / length,
      z: z / length,
      run: this.keys.has("ShiftLeft") || this.actions.run,
      slide: this.keys.has("KeyC") || this.actions.slide,
      jet: this.keys.has("Space") || this.actions.jet,
      interact: this.keys.has("KeyR") || this.actions.interact,
      sense: this.keys.has("KeyF") || this.actions.sense,
      dive: this.keys.has("KeyQ") || this.actions.dive,
      ascend: this.keys.has("KeyE") || this.actions.ascend,
    };
  }
  consumeLook() {
    const look = { lookX: this.lookX, lookY: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return look;
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
