import { test } from "node:test";
import assert from "node:assert/strict";
import { Audio } from "../src/audio.js";
import { createBody } from "../src/player/body-state.js";

function setupMockAudioContext() {
  const nodes = [];
  class MockParam {
    constructor(initial = 0) {
      this.value = initial;
      this.targets = [];
    }
    setTargetAtTime(target, time, tau) {
      this.targets.push({ target, time, tau });
      this.value = target;
    }
  }
  class MockNode {
    constructor(type) {
      this.type = type;
      this.connections = [];
      nodes.push(this);
    }
    connect(target) {
      this.connections.push(target);
    }
    disconnect() {
      this.connections = [];
    }
  }
  class MockGainNode extends MockNode {
    constructor() {
      super("gain");
      this.gain = new MockParam(1);
    }
  }
  class MockFilterNode extends MockNode {
    constructor() {
      super("filter");
      this.frequency = new MockParam(350);
      this.Q = new MockParam(1);
    }
  }
  class MockSourceNode extends MockNode {
    constructor(type) {
      super(type);
      this.started = false;
      this.stopped = false;
      this.frequency = new MockParam(55);
    }
    start() {
      this.started = true;
    }
    stop() {
      this.stopped = true;
    }
  }
  class MockAudioContext {
    constructor() {
      this.sampleRate = 44100;
      this.currentTime = 1.0;
      this.destination = new MockNode("destination");
      this.closed = false;
      this.resumes = 0;
    }
    createGain() {
      return new MockGainNode();
    }
    createBiquadFilter() {
      return new MockFilterNode();
    }
    createBuffer(channels, length, sampleRate) {
      return {
        getChannelData: () => new Float32Array(length),
      };
    }
    createBufferSource() {
      return new MockSourceNode("bufferSource");
    }
    createOscillator() {
      return new MockSourceNode("oscillator");
    }
    async resume() {
      this.resumes++;
    }
    async close() {
      this.closed = true;
    }
  }
  globalThis.AudioContext = MockAudioContext;
  return { nodes, MockAudioContext };
}

test("audio initializes master bus and sub-voices with single AudioContext", () => {
  const { nodes } = setupMockAudioContext();
  const audio = new Audio();
  assert.equal(audio.context, null, "context must be lazy before unlock");

  audio.unlock();
  assert.ok(audio.context !== null, "unlock must create AudioContext");
  assert.ok(audio.masterGain !== null, "master gain must exist");
  assert.ok(audio.jetGain !== null, "jet voice must exist");
  assert.ok(audio.surfGain !== null, "surf voice must exist");
  assert.ok(audio.subGain !== null, "sub-drone voice must exist");
  assert.ok(audio.locoGain !== null, "locomotion voice must exist");
  assert.ok(audio.flutterGain !== null, "flutter voice must exist");
  assert.ok(audio.streamGain !== null, "stream voice must exist");

  // Re-unlocking must NOT recreate or proliferate AudioContext
  const ctx = audio.context;
  audio.unlock();
  assert.equal(audio.context, ctx, "re-unlock must retain existing AudioContext");

  audio.dispose();
  assert.equal(audio.context, null);
});

test("water jet triggers pressurized fluid surge on jet bus", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();

  const b = createBody(0, 0, 0);
  b.jetTime = 0.32; // Active water jet
  audio.update(b, { muted: false, volume: 1.0 });

  assert.ok(audio.jetGain.gain.value > 0.3, "jet surge gain must ramp up during water jet");
  assert.ok(audio.jetFilter.frequency.value > 450, "jet filter frequency must sweep upward");

  // Jet expiry restores silence on jet voice
  b.jetTime = 0;
  audio.update(b, { muted: false, volume: 1.0 });
  assert.equal(audio.jetGain.gain.value, 0, "jet gain must return to 0 when inactive");

  audio.dispose();
});

test("dive mode activates submerged low-frequency cavern resonance and muffles surf", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();

  const b = createBody(0, 0, 0);
  b.mode = "dive";
  b.vx = 2.0;
  audio.update(b, { muted: false, volume: 1.0 });

  assert.ok(audio.subGain.gain.value > 0.2, "submerged sub-drone must activate in dive mode");
  assert.equal(audio.surfFilter.frequency.value, 220, "surf filter must muffle down to 220 Hz in dive mode");

  // Return to surface swim
  b.mode = "swim";
  audio.update(b, { muted: false, volume: 1.0 });
  assert.equal(audio.subGain.gain.value, 0, "sub-drone must mute when back at surface");
  assert.ok(audio.surfFilter.frequency.value > 500, "surface swimming must restore open water frequency");

  audio.dispose();
});

test("wading in shallow water shifts locomotion filter to splash acoustics", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();

  const b = createBody(0, 0, 0);
  b.mode = "land";
  b.grounded = true;
  b.vx = 1.8;
  b.distance = 0.5;

  // Dry land movement
  audio.update(b, { muted: false, volume: 1.0 }, { water: null });
  const dryFreq = audio.locoFilter.frequency.value;
  assert.ok(dryFreq <= 1200, "dry land footstep filter should be around 1050 Hz");

  // Wading into water shallows
  const waterEnv = { level: 0.1 };
  b.y = 0.05; // touching shallows
  audio.update(b, { muted: false, volume: 1.0 }, { water: waterEnv });
  const splashFreq = audio.locoFilter.frequency.value;
  assert.ok(splashFreq >= 1600, "shallows splash filter should shift up to splash frequency (>=1600 Hz)");

  audio.dispose();
});

test("shell slide modulates friction gain with movement speed", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();

  const b = createBody(0, 0, 0);
  b.mode = "slide";
  b.vx = 4.0;
  audio.update(b, { muted: false, volume: 1.0 });

  assert.ok(audio.locoGain.gain.value > 0.05, "slide friction gain must scale with speed");
  assert.equal(audio.locoFilter.frequency.value, 820, "slide friction uses shell resonance frequency (820 Hz)");

  audio.dispose();
});

test("water exit shake triggers droplet flutter voice", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();

  const b = createBody(0, 0, 0);
  audio.update(b, { muted: false, volume: 1.0 }, { isShaking: true });
  assert.ok(audio.flutterGain.gain.value > 0.1, "shaking must activate droplet flutter gain");

  audio.update(b, { muted: false, volume: 1.0 }, { isShaking: false });
  assert.equal(audio.flutterGain.gain.value, 0, "quiescent state must mute flutter gain");

  audio.dispose();
});

test("nearness to active watercourse activates localized stream flow acoustics", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();

  const b = createBody(0, 0, 0);

  // 1. Stage 1 (dry / no active flow): stream sound is silent
  audio.update(
    b,
    { muted: false, volume: 1.0 },
    { channelStage: 1, channelDist: 2.0 },
  );
  assert.equal(audio.streamGain.gain.value, 0, "dry channel must remain silent");

  // 2. Stage 2 but far away (> 8.0m): stream sound is silent
  audio.update(
    b,
    { muted: false, volume: 1.0 },
    { channelStage: 2, channelDist: 12.0 },
  );
  assert.equal(audio.streamGain.gain.value, 0, "distant channel must remain silent");

  // 3. Stage 2 and close (< 8.0m): localized stream bubbling acoustics activate
  audio.update(
    b,
    { muted: false, volume: 1.0 },
    { channelStage: 2, channelDist: 2.5 },
  );
  assert.ok(
    audio.streamGain.gain.value > 0.05,
    "nearness to active channel must ramp up stream flow acoustics",
  );
  assert.ok(
    audio.streamFilter.frequency.value >= 500 &&
      audio.streamFilter.frequency.value <= 800,
    "stream filter frequency must remain in bubbling range",
  );

  audio.dispose();
});

test("living slumber crouch activates gentle 0.77 Hz respiration acoustics", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();

  const b = createBody(0, 0, 0);
  b.mode = "land";
  b.grounded = true;
  b.vx = 0;
  b.vz = 0;

  // 1. Quiescent awake stationary idle (not sleeping): loco gain is 0
  audio.update(b, { muted: false, volume: 1.0 }, { isSleeping: false });
  assert.equal(audio.locoGain.gain.value, 0, "awake motionless idle has zero loco gain");

  // 2. Sleeping crouch on land: loco voice shifts to gentle warm 420 Hz respiration murmur
  audio.context.currentTime = 0.32;
  audio.update(b, { muted: false, volume: 1.0 }, { isSleeping: true });
  assert.ok(audio.locoGain.gain.value > 0.01, "slumber respiration must activate breathing murmur gain");
  assert.equal(audio.locoFilter.frequency.value, 420, "slumber respiration uses warm low 420 Hz filter");

  // 3. Movement or waking up restores normal footstep filter
  b.vx = 1.5;
  audio.update(b, { muted: false, volume: 1.0 }, { isSleeping: false });
  assert.ok(audio.locoFilter.frequency.value > 1000, "waking up and walking restores footstep filter");

  audio.dispose();
});

test("audio cleanly disposes all nodes and closes context without leaks", () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();
  const ctx = audio.context;

  audio.dispose();
  assert.equal(audio.context, null, "context must be nullified");
  assert.equal(audio.masterGain, null, "master gain must be nullified");
  assert.equal(ctx.closed, true, "context must be explicitly closed");
});

test("an unlocked audio graph resumes after a tab returns without rebuilding nodes", async () => {
  setupMockAudioContext();
  const audio = new Audio();
  audio.unlock();
  const ctx = audio.context,
    source = audio.noiseSource,
    before = ctx.resumes;
  assert.equal(await audio.resume(), true);
  assert.equal(ctx.resumes, before + 1);
  assert.equal(audio.context, ctx);
  assert.equal(audio.noiseSource, source, "resume must reuse the existing graph");

  audio.dispose();
  assert.equal(await audio.resume(), false, "disposed audio has nothing to resume");
});
