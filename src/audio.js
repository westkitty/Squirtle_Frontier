// One user-gesture-unlocked graph. No per-effect oscillators/timers accumulate.
export class Audio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.noiseSource = null;
    this.jetGain = null;
    this.jetFilter = null;
    this.surfGain = null;
    this.surfFilter = null;
    this.subGain = null;
    this.subOsc = null;
    this.subFilter = null;
    this.locoGain = null;
    this.locoFilter = null;
    this.flutterGain = null;
    this.flutterFilter = null;
    this.streamGain = null;
    this.streamFilter = null;
  }
  get gain() {
    return this.masterGain;
  }
  get filter() {
    return this.surfFilter;
  }
  unlock() {
    if (!this.context) {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!C) return;
      this.context = new C();

      // Master output bus
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(this.context.destination);

      // Shared noise buffer (pink/white blend for organic fluid and friction texturing)
      const buffer = this.context.createBuffer(
        1,
        this.context.sampleRate * 2,
        this.context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        const pink = (b0 + b1 + b2 + white * 0.5362) * 0.18;
        data[i] = pink * 0.7 + white * 0.3 * 0.25;
      }

      this.noiseSource = this.context.createBufferSource();
      this.noiseSource.buffer = buffer;
      this.noiseSource.loop = true;

      // 1. Hydrodynamic Water Jet Burst voice (pressurized bandpass surge)
      this.jetFilter = this.context.createBiquadFilter();
      this.jetFilter.type = "bandpass";
      this.jetFilter.Q.value = 2.2;
      this.jetFilter.frequency.value = 650;
      this.jetGain = this.context.createGain();
      this.jetGain.gain.value = 0;
      this.jetFilter.connect(this.jetGain);
      this.jetGain.connect(this.masterGain);

      // 2. Aquatic surf & surface swimming displacement voice
      this.surfFilter = this.context.createBiquadFilter();
      this.surfFilter.type = "lowpass";
      this.surfFilter.frequency.value = 600;
      this.surfGain = this.context.createGain();
      this.surfGain.gain.value = 0;
      this.surfFilter.connect(this.surfGain);
      this.surfGain.connect(this.masterGain);

      // 3. Submerged Cavern / Deep Ocean sub-drone (low sine + lowpass)
      this.subOsc = this.context.createOscillator();
      this.subOsc.type = "sine";
      this.subOsc.frequency.value = 55;
      this.subFilter = this.context.createBiquadFilter();
      this.subFilter.type = "lowpass";
      this.subFilter.frequency.value = 130;
      this.subGain = this.context.createGain();
      this.subGain.gain.value = 0;
      this.subOsc.connect(this.subFilter);
      this.subFilter.connect(this.subGain);
      this.subGain.connect(this.masterGain);

      // 4. Locomotion voice (turf footsteps, shallows wading splash, shell slide friction)
      this.locoFilter = this.context.createBiquadFilter();
      this.locoFilter.type = "bandpass";
      this.locoFilter.Q.value = 1.4;
      this.locoFilter.frequency.value = 1100;
      this.locoGain = this.context.createGain();
      this.locoGain.gain.value = 0;
      this.locoFilter.connect(this.locoGain);
      this.locoGain.connect(this.masterGain);

      // 5. Water-exit droplet shake flutter voice (crisp highpass droplets)
      this.flutterFilter = this.context.createBiquadFilter();
      this.flutterFilter.type = "highpass";
      this.flutterFilter.frequency.value = 2400;
      this.flutterGain = this.context.createGain();
      this.flutterGain.gain.value = 0;
      this.flutterFilter.connect(this.flutterGain);
      this.flutterGain.connect(this.masterGain);

      // 6. Running stream / watercourse flow voice (pressurized bubbling stream)
      this.streamFilter = this.context.createBiquadFilter();
      this.streamFilter.type = "bandpass";
      this.streamFilter.Q.value = 1.8;
      this.streamFilter.frequency.value = 680;
      this.streamGain = this.context.createGain();
      this.streamGain.gain.value = 0;
      this.streamFilter.connect(this.streamGain);
      this.streamGain.connect(this.masterGain);

      // Connect shared noise source to noise-driven filter paths
      this.noiseSource.connect(this.jetFilter);
      this.noiseSource.connect(this.surfFilter);
      this.noiseSource.connect(this.locoFilter);
      this.noiseSource.connect(this.flutterFilter);
      this.noiseSource.connect(this.streamFilter);

      // Start continuous audio generators
      this.noiseSource.start();
      this.subOsc.start();
    }
    void this.resume();
  }

  async resume() {
    if (!this.context) return false;
    try {
      await this.context.resume();
      return true;
    } catch {
      return false;
    }
  }

  update(body, settings, contextInfo = {}) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const aquatic = body.mode === "swim" || body.mode === "dive";
    const speed = Math.hypot(body.vx, body.vz);
    const volume = settings.muted ? 0 : (settings.volume ?? 1);

    // Master volume target
    this.masterGain.gain.setTargetAtTime(volume, now, 0.05);

    // 1. Water Jet surge
    const jetLevel = body.jetTime > 0 ? 0.38 : 0;
    this.jetGain.gain.setTargetAtTime(jetLevel, now, 0.04);
    if (body.jetTime > 0) {
      this.jetFilter.frequency.setTargetAtTime(
        450 + (1 - body.jetTime / 0.36) * 350,
        now,
        0.05,
      );
    }

    // 2. Aquatic surf & surface swimming displacement
    let surfLevel = 0;
    if (aquatic) {
      if (body.mode === "dive") {
        surfLevel = 0.06;
        this.surfFilter.frequency.setTargetAtTime(220, now, 0.08);
      } else {
        const paddle = Math.abs(Math.sin(body.distance * 10));
        surfLevel = 0.05 + paddle * 0.05 * Math.min(speed, 1);
        this.surfFilter.frequency.setTargetAtTime(650, now, 0.08);
      }
    }
    this.surfGain.gain.setTargetAtTime(surfLevel, now, 0.06);

    // 3. Submerged Cavern / Deep Ocean sub-drone
    const subLevel = body.mode === "dive" ? 0.26 : 0;
    this.subGain.gain.setTargetAtTime(subLevel, now, 0.08);

    // 4. Locomotion: turf footsteps, shallows wading splash, shell slide friction
    let locoLevel = 0;
    if (body.mode === "slide") {
      locoLevel = Math.min(0.25, speed * 0.016);
      this.locoFilter.frequency.setTargetAtTime(820, now, 0.08);
    } else if (body.grounded && speed > 0.1) {
      const step = Math.max(0, Math.sin(body.distance * 24));
      const inShallows =
        !!contextInfo.water && body.y < contextInfo.water.level + 0.15;
      if (inShallows) {
        // Wading splash in shallows
        locoLevel = step * 0.048 * Math.min(speed, 1);
        this.locoFilter.frequency.setTargetAtTime(1700, now, 0.06);
      } else {
        // Dry land turf footsteps
        locoLevel = step * 0.028 * Math.min(speed, 1);
        this.locoFilter.frequency.setTargetAtTime(1050, now, 0.06);
      }
    } else if (body.grounded && speed <= 0.1 && contextInfo.isSleeping) {
      // Living slumber respiration murmur (slowed 0.77 Hz matching physical crouch kinematics)
      const breath = Math.max(0, Math.sin(now * 4.84));
      locoLevel = 0.018 * breath;
      this.locoFilter.frequency.setTargetAtTime(420, now, 0.08);
    }
    this.locoGain.gain.setTargetAtTime(locoLevel, now, 0.04);

    // 5. Water-exit droplet shake flutter
    const isShaking = !!contextInfo.isShaking;
    const flutterLevel = isShaking ? 0.16 : 0;
    this.flutterGain.gain.setTargetAtTime(flutterLevel, now, 0.03);

    // 6. Running stream / watercourse flow acoustics
    let streamLevel = 0;
    if (
      contextInfo.channelStage >= 2 &&
      typeof contextInfo.channelDist === "number" &&
      contextInfo.channelDist < 8.0
    ) {
      const prox = Math.max(0, 1 - contextInfo.channelDist / 8.0);
      const bubble = 0.85 + Math.sin(now * 4.2) * 0.15;
      streamLevel = 0.18 * prox * prox * bubble;
      const freq = 620 + Math.sin(now * 2.8) * 120;
      this.streamFilter.frequency.setTargetAtTime(freq, now, 0.06);
    }
    this.streamGain.gain.setTargetAtTime(streamLevel, now, 0.05);
  }
  dispose() {
    try {
      this.noiseSource?.stop();
      this.subOsc?.stop();
    } catch {}
    this.noiseSource?.disconnect();
    this.subOsc?.disconnect();
    this.jetFilter?.disconnect();
    this.jetGain?.disconnect();
    this.surfFilter?.disconnect();
    this.surfGain?.disconnect();
    this.subFilter?.disconnect();
    this.subGain?.disconnect();
    this.locoFilter?.disconnect();
    this.locoGain?.disconnect();
    this.flutterFilter?.disconnect();
    this.flutterGain?.disconnect();
    this.streamFilter?.disconnect();
    this.streamGain?.disconnect();
    this.masterGain?.disconnect();
    this.context?.close();
    this.context = null;
    this.masterGain = null;
  }
}
