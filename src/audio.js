// One user-gesture-unlocked graph. No per-effect oscillators/timers accumulate.
export class Audio {
  constructor() {
    this.context = null;
  }
  unlock() {
    if (!this.context) {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!C) return;
      this.context = new C();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
      const buffer = this.context.createBuffer(
          1,
          this.context.sampleRate * 2,
          this.context.sampleRate,
        ),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * 0.35;
      this.source = this.context.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;
      this.filter = this.context.createBiquadFilter();
      this.filter.type = "lowpass";
      this.source.connect(this.filter);
      this.filter.connect(this.gain);
      this.source.start();
    }
    this.context.resume().catch(() => {});
  }
  update(body, settings) {
    if (!this.context) return;
    const aquatic = body.mode === "swim" || body.mode === "dive";
    const speed = Math.hypot(body.vx, body.vz);
    const level =
      body.jetTime > 0
        ? 0.24
        : aquatic
          ? 0.08
          : body.mode === "slide"
            ? speed * 0.008
            : body.grounded
              ? Math.max(0, Math.sin(body.distance * 24)) *
                0.035 *
                Math.min(speed, 1)
              : 0;
    this.gain.gain.setTargetAtTime(
      settings.muted ? 0 : level * settings.volume,
      this.context.currentTime,
      0.06,
    );
    this.filter.frequency.setTargetAtTime(
      body.mode === "dive"
        ? 280
        : body.jetTime > 0
          ? 1900
          : body.mode === "slide"
            ? 800
            : 1200,
      this.context.currentTime,
      0.1,
    );
  }
  dispose() {
    this.source?.stop();
    this.source?.disconnect();
    this.filter?.disconnect();
    this.gain?.disconnect();
    this.context?.close();
  }
}
