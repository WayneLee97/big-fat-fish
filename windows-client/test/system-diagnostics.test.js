const assert = require("node:assert/strict");
const test = require("node:test");

const { SpeechEngine } = require("../src/speech-engine");
const { runSystemDiagnostics } = require("../src/system-diagnostics");
const path = require("node:path");

const { OfflineTtsSynthesizer, analyzeWavePcm16, encodeWavePcm16 } = require("../src/offline-tts");

test("system diagnostics reports a healthy classroom client", async () => {
  const result = await runSystemDiagnostics({
    port: 32145,
    addresses: ["192.168.1.20"],
    speech: new SpeechEngine({ simulate: true }),
    userDataPath: "ignored-in-test",
    isPackaged: true,
    loginItemSettings: { openAtLogin: true },
    healthCheck: async () => ({ ok: true }),
    storageCheck: async () => {},
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.map((check) => check.status), ["passed", "passed", "passed", "passed", "passed"]);
});

test("system diagnostics exposes actionable failures", async () => {
  const result = await runSystemDiagnostics({
    port: 32145,
    addresses: [],
    speech: { diagnose: async () => ({ available: false, voices: [], error: "没有可用语音" }) },
    userDataPath: "ignored-in-test",
    isPackaged: false,
    loginItemSettings: null,
    healthCheck: async () => { throw new Error("端口被占用"); },
    storageCheck: async () => { throw new Error("目录不可写"); },
  });

  assert.equal(result.ok, false);
  assert.equal(result.checks.filter((check) => check.status === "failed").length, 4);
  assert.match(result.checks[0].detail, /端口被占用/);
  assert.equal(result.checks.at(-1).status, "warning");
});

test("speech engine plays only verified synthesized audio", async () => {
  const played = [];
  const engine = new SpeechEngine({
    synthesizer: { synthesize: async (content) => ({ audioBase64: "UklGRg==", engine: "sherpa-onnx 离线 TTS", voice: "MeloTTS 中文女声", content, durationMs: 1200, peak: 8000, rms: 1200 }) },
    audioPlayer: async (audioBase64) => { played.push(audioBase64); return { outputDevice: "教室扬声器" }; },
  });
  const result = await engine.speak("测试语音");
  assert.deepEqual(played, ["UklGRg=="]);
  assert.equal(result.voice, "MeloTTS 中文女声");
  assert.equal(result.outputDevice, "教室扬声器");
  const simulated = await new SpeechEngine({ simulate: true }).speak("测试语音");
  assert.equal(simulated.engine, "模拟语音");
});

function pcmWave(samples, sampleRate = 16_000) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + samples.length * 2, 4); buffer.write("WAVE", 8); buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(sample, 44 + index * 2));
  return buffer;
}

test("WAV analysis distinguishes audible PCM from silence", () => {
  const tone = Array.from({ length: 16_000 }, (_, index) => Math.round(Math.sin(2 * Math.PI * 440 * index / 16_000) * 10_000));
  const audible = analyzeWavePcm16(pcmWave(tone));
  const silent = analyzeWavePcm16(pcmWave(new Array(16_000).fill(0)));
  assert.equal(audible.durationMs, 1000);
  assert.equal(audible.peak >= 9_000, true);
  assert.equal(audible.rms >= 6_000, true);
  assert.equal(silent.peak, 0);
  assert.equal(silent.rms, 0);
});

test("Float samples are encoded as a valid PCM WAV", () => {
  const wave = encodeWavePcm16(new Float32Array([0, 0.5, -0.5, 1, -1]), 16_000);
  const result = analyzeWavePcm16(wave);
  assert.equal(result.sampleRate, 16_000);
  assert.equal(result.samples, 5);
  assert.equal(result.peak, 32768);
});

test("bundled offline model produces non-silent Chinese speech", { timeout: 60_000 }, async () => {
  const modelDir = path.join(__dirname, "..", "resources", "tts", "vits-melo-tts-zh_en");
  const synthesizer = new OfflineTtsSynthesizer({ modelDir, numThreads: 2 });
  try {
    const result = await synthesizer.synthesize("大肥鱼文字转语音测试成功");
    assert.equal(result.durationMs >= 200, true);
    assert.equal(result.peak >= 64, true);
    assert.equal(result.rms >= 8, true);
    assert.equal(result.engine, "sherpa-onnx 离线 TTS");
    const cached = await synthesizer.synthesize("大肥鱼文字转语音测试成功");
    assert.equal(cached.cached, true);
    assert.equal(cached.synthesisMs, 0);
  } finally {
    await synthesizer.dispose();
  }
});
