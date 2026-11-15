const path = require("node:path");
const { parentPort, workerData } = require("node:worker_threads");
const sherpa = require("sherpa-onnx-node");
const { analyzeWavePcm16, encodeWavePcm16 } = require("./wave-audio");

function modelFile(name) {
  return path.join(workerData.modelDir, name);
}

function createEngine() {
  return new sherpa.OfflineTts({
    model: {
      vits: {
        model: modelFile("model.int8.onnx"),
        tokens: modelFile("tokens.txt"),
        lexicon: modelFile("lexicon.txt"),
      },
      debug: false,
      numThreads: workerData.numThreads,
      provider: "cpu",
    },
    maxNumSentences: 1,
    ruleFsts: ["date.fst", "phone.fst", "number.fst", "new_heteronym.fst"].map(modelFile).join(","),
  });
}

let engine;
try {
  const startedAt = Date.now();
  engine = createEngine();
  parentPort.postMessage({ type: "ready", loadMs: Date.now() - startedAt });
} catch (error) {
  parentPort.postMessage({ type: "initialization-error", error: error.message || String(error), stack: error.stack });
}

parentPort.on("message", ({ id, text }) => {
  if (!engine) {
    parentPort.postMessage({ type: "result", id, ok: false, phase: "initialization", error: "离线语音模型尚未成功初始化" });
    return;
  }
  try {
    const startedAt = Date.now();
    const generationConfig = new sherpa.GenerationConfig({ sid: 0, speed: 1, silenceScale: 0.2 });
    // Electron rejects external buffers returned by native addons.
    const generated = engine.generate({ text, generationConfig, enableExternalBuffer: false });
    const synthesisMs = Date.now() - startedAt;
    const wave = encodeWavePcm16(generated.samples, generated.sampleRate);
    const stats = analyzeWavePcm16(wave);
    parentPort.postMessage({ type: "result", id, ok: true, audioBase64: wave.toString("base64"), synthesisMs, stats });
  } catch (error) {
    parentPort.postMessage({ type: "result", id, ok: false, phase: "generation", error: error.message || String(error), stack: error.stack });
  }
});
