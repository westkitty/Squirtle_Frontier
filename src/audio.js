import {
  DEBRIS_SITE,
  LAB_ENTRY_SITE,
  WETLAND_SITE,
} from "./simulation/regional-sites.js";

export function regionalAmbienceAt(x, z, place = "frontier", out = null) {
  const result = out ?? { level: 0, frequency: 0, q: 0 };
  let level = 0.024;
  let frequency = 520;
  let q = 1.0;
  if (place === "frontier") {
    const distWetland = Math.hypot(x - WETLAND_SITE.x, z - WETLAND_SITE.z);
    const distGorge = Math.hypot(x - DEBRIS_SITE.x, z - DEBRIS_SITE.z);
    const distLab = Math.hypot(x - LAB_ENTRY_SITE.x, z - LAB_ENTRY_SITE.z);
    if (distWetland < 16) {
      const factor = 1 - distWetland / 16;
      frequency = 520 + factor * 900;
      q = 0.8;
      level += factor * 0.018;
    } else if (distGorge < 18) {
      const factor = 1 - distGorge / 18;
      frequency = 520 - factor * 240;
      q = 2.2;
      level += factor * 0.022;
    } else if (distLab < 12) {
      const factor = 1 - distLab / 12;
      frequency = 520 - factor * 280;
      q = 1.6;
      level += factor * 0.015;
    }
  }
  result.level = level;
  result.frequency = frequency;
  result.q = q;
  return result;
}

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
    this.rainGain = null;
    this.rainFilter = null;
    this.wildGain = null;
    this.wildFilter = null;
    this.wildOsc = null;
    this.ambientGain = null;
    this.ambientFilter = null;
    this.ambientState = { level: 0, frequency: 0, q: 0 };
    this.lastJetHitSerial = 0;
    this.jetHitAt = -10;
    this.jetHitKind = "";
    this.jetHitIntensity = 0;
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

      // 7. Weather bed. The shared noise becomes broad rain rather than
      // creating one short-lived source per drop.
      this.rainFilter = this.context.createBiquadFilter();
      this.rainFilter.type = "highpass";
      this.rainFilter.frequency.value = 2400;
      this.rainGain = this.context.createGain();
      this.rainGain.gain.value = 0;
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);

      // 8. Nearby fauna tone. One persistent oscillator is modulated by the frame loop;
      // no timers or per-call source allocation are allowed.
      this.wildOsc = this.context.createOscillator();
      this.wildOsc.type = "triangle";
      this.wildOsc.frequency.value = 320;
      this.wildFilter = this.context.createBiquadFilter();
      this.wildFilter.type = "bandpass";
      this.wildFilter.Q.value = 2.6;
      this.wildFilter.frequency.value = 760;
      this.wildGain = this.context.createGain();
      this.wildGain.gain.value = 0;
      this.wildOsc.connect(this.wildFilter);
      this.wildFilter.connect(this.wildGain);
      this.wildGain.connect(this.masterGain);

      // 9. Regional Biome Environmental Ambience voice (subtle airy/reed/canyon presence)
      this.ambientFilter = this.context.createBiquadFilter();
      this.ambientFilter.type = "bandpass";
      this.ambientFilter.Q.value = 1.0;
      this.ambientFilter.frequency.value = 520;
      this.ambientGain = this.context.createGain();
      this.ambientGain.gain.value = 0;
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      // Connect shared noise source to noise-driven filter paths
      this.noiseSource.connect(this.jetFilter);
      this.noiseSource.connect(this.surfFilter);
      this.noiseSource.connect(this.locoFilter);
      this.noiseSource.connect(this.flutterFilter);
      this.noiseSource.connect(this.streamFilter);
      this.noiseSource.connect(this.rainFilter);
      this.noiseSource.connect(this.ambientFilter);

      // Start continuous audio generators
      this.noiseSource.start();
      this.subOsc.start();
      this.wildOsc.start();
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
    const waterLevel = Number(contextInfo.water?.level),
      depth =
        body.mode === "dive"
          ? Number.isFinite(waterLevel)
            ? Math.max(0, Math.min(1, (waterLevel - body.y) / 2.5))
            : 1
          : 0,
      canopy = Math.max(
        0,
        Math.min(1, Number(contextInfo.canopyCover) || 0),
      );

    // Master volume target
    this.masterGain.gain.setTargetAtTime(volume, now, 0.05);

    // 1. Water Jet burst / Water Hose pressure voice. Contact reuses the same
    // persistent graph as a short hiss/thump accent; no per-hit AudioNodes are made.
    const hit = contextInfo.jetHit,
      hitSerial = Number(hit?.serial) || 0;
    if (hitSerial > 0 && hitSerial !== this.lastJetHitSerial) {
      this.lastJetHitSerial = hitSerial;
      this.jetHitAt = now;
      this.jetHitKind = String(hit?.kind || "");
      this.jetHitIntensity = Math.max(
        0,
        Math.min(1, Number(hit?.intensity) || 0),
      );
    }
    const jetHitAge = now - this.jetHitAt,
      hitAccent =
        jetHitAge >= 0 && jetHitAge < 0.18
          ? (0.07 + this.jetHitIntensity * 0.09) *
            (1 - jetHitAge / 0.18)
          : 0,
      jetLevel =
        (body.hoseActive ? 0.24 : body.jetTime > 0 ? 0.38 : 0) + hitAccent;
    this.jetGain.gain.setTargetAtTime(jetLevel, now, 0.04);
    if (hitAccent > 0) {
      this.jetFilter.frequency.setTargetAtTime(
        this.jetHitKind === "fire" ? 1420 : 980,
        now,
        0.025,
      );
    } else if (body.hoseActive) {
      this.jetFilter.frequency.setTargetAtTime(560, now, 0.05);
    } else if (body.jetTime > 0) {
      this.jetFilter.frequency.setTargetAtTime(
        450 + (1 - body.jetTime / 0.36) * 350,
        now,
        0.05,
      );
    }

    // 2. Aquatic surf & surface swimming displacement
    // Amphibious transitions: a soft surface slap on entry, a droplet shed on exit.
    if (this.wasAquatic === false && aquatic) this.entryAt = now;
    if (this.wasAquatic === true && !aquatic) this.exitAt = now;
    this.wasAquatic = aquatic;
    const entryAge = now - (this.entryAt ?? -10),
      exitAge = now - (this.exitAt ?? -10),
      entryAccent =
        entryAge >= 0 && entryAge < 0.4 ? 0.14 * (1 - entryAge / 0.4) : 0,
      exitAccent =
        exitAge >= 0 && exitAge < 0.35 ? 0.07 * (1 - exitAge / 0.35) : 0;
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
    this.surfGain.gain.setTargetAtTime(surfLevel + entryAccent, now, 0.06);

    // 3. Submerged Cavern / Deep Ocean sub-drone. Actual depth matters:
    // a shallow duck-under is quieter than settling metres below the surface.
    const subLevel = body.mode === "dive" ? 0.12 + depth * 0.18 : 0;
    this.subGain.gain.setTargetAtTime(subLevel, now, 0.08);
    this.subFilter.frequency.setTargetAtTime(
      body.mode === "dive" ? 145 - depth * 45 : 130,
      now,
      0.1,
    );

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
    const flutterLevel = (isShaking ? 0.16 : 0) + exitAccent;
    this.flutterGain.gain.setTargetAtTime(flutterLevel, now, 0.03);

    // 6. Running stream / watercourse flow acoustics
    let streamLevel = 0;
    if (
      contextInfo.channelStage >= 2 &&
      typeof contextInfo.channelDist === "number" &&
      contextInfo.channelDist < 8.0
    ) {
      const prox = Math.max(0, 1 - contextInfo.channelDist / 8.0);
      const bubble = 0.85 + Math.sin(now * 4.2) * 0.15,
        quality = Math.max(
          0,
          Math.min(1, Number(contextInfo.waterQuality ?? 1)),
        ),
        wetness = Math.max(
          0,
          Math.min(1, Number(contextInfo.waterWetness ?? 1)),
        );
      streamLevel = 0.18 * prox * prox * bubble * (0.7 + wetness * 0.3);
      const freq =
        500 + quality * 220 + Math.sin(now * 2.8) * 70 - (1 - wetness) * 35;
      this.streamFilter.frequency.setTargetAtTime(freq, now, 0.06);
    }
    const submerged = body.mode === "dive",
      underwaterTransmission = submerged ? 1 - depth * 0.86 : 1;
    streamLevel *= underwaterTransmission;
    this.streamGain.gain.setTargetAtTime(streamLevel, now, 0.05);

    const rain = Math.max(0, Math.min(1, Number(contextInfo.rain) || 0)),
      depthRain = submerged ? 1 - depth * 0.97 : 1,
      canopyRain = 1 - canopy * 0.55,
      rainLevel = rain * 0.12 * depthRain * canopyRain;
    this.rainGain.gain.setTargetAtTime(rainLevel, now, 0.12);
    this.rainFilter.frequency.setTargetAtTime(
      submerged
        ? 1150 - depth * 450
        : 2200 + rain * 1900 - canopy * 1400,
      now,
      0.18,
    );

    const wildlifeLevel = Math.max(
        0,
        Math.min(1, Number(contextInfo.wildlifeLevel) || 0),
      ),
      rawWildlifeDistance = Number(contextInfo.wildlifeDistance),
      wildlifeDistance = Number.isFinite(rawWildlifeDistance)
        ? Math.max(0, rawWildlifeDistance)
        : 999,
      wildlifeProximity = Math.max(0, 1 - wildlifeDistance / 18),
      wildlifePulse = Math.max(
        0,
        Math.sin(now * 2.1) + Math.sin(now * 3.7) * 0.35 - 0.45,
      ),
      wildLevel =
        wildlifeLevel *
        wildlifeProximity *
        wildlifePulse *
        0.055 *
        (submerged ? 1 - depth * 0.92 : 1);
    this.wildGain.gain.setTargetAtTime(wildLevel, now, 0.08);
    this.wildOsc.frequency.setTargetAtTime(
      280 + wildlifeLevel * 150 + Math.sin(now * 0.7) * 28,
      now,
      0.08,
    );
    this.wildFilter.frequency.setTargetAtTime(
      submerged ? 480 - depth * 220 : 620 + wildlifeLevel * 280,
      now,
      0.12,
    );

    // 9. Regional Biome Environmental Ambience
    const ambience = regionalAmbienceAt(
      Number(body.x) || 0,
      Number(body.z) || 0,
      contextInfo.place,
      this.ambientState,
    );
    let ambientLevel = ambience.level,
      targetFreq = ambience.frequency,
      targetQ = ambience.q;
    if (body.mode === "dive") {
      ambientLevel *= (1 - depth * 0.9);
      targetFreq = Math.max(160, targetFreq * 0.4);
    }
    this.ambientGain.gain.setTargetAtTime(ambientLevel, now, 0.1);
    this.ambientFilter.frequency.setTargetAtTime(targetFreq, now, 0.12);
    this.ambientFilter.Q.setTargetAtTime(targetQ, now, 0.1);
  }
  dispose() {
    try {
      this.noiseSource?.stop();
      this.subOsc?.stop();
      this.wildOsc?.stop();
    } catch {}
    this.noiseSource?.disconnect();
    this.subOsc?.disconnect();
    this.wildOsc?.disconnect();
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
    this.rainFilter?.disconnect();
    this.rainGain?.disconnect();
    this.wildFilter?.disconnect();
    this.wildGain?.disconnect();
    this.ambientFilter?.disconnect();
    this.ambientGain?.disconnect();
    this.masterGain?.disconnect();
    this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.ambientFilter = null;
    this.ambientGain = null;
  }
}
