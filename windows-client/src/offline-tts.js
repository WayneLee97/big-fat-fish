const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { analyzeWavePcm16, encodeWavePcm16 } = require("./wave-audio");

const REQUIRED_MODEL_FILES = [
  "model.int8.onnx",
  "tokens.txt",
  "lexicon.txt",
  "date.fst",
  "phone.fst",
  "number.fst",
  "new_heteronym.fst",
];

class OfflineTtsSynthesizer {
  constructor({
    modelDir,
    workerScript = path.join(__dirname, "offline-tts-worker.js"),
    numThreads = Math.max(1, Math.min(4, os.cpus().length - 1)),
    cacheSize = 20,
    timeoutMs = 90_000,
  } = {}) {
    this.modelDir = modelDir;
    this.workerScript = workerScript;
    this.numThreads = numThreads;
    this.cacheSize = cacheSize;
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
    this.worker = null;
    this.workerPromise = null;
    this.pending = new Map();
    this.nextRequestId = 1;
    this.loadMs = null;
  }

  validateModel() {
    if (!this.modelDir) throw new Error("没有配置离线语音模型目录");
    const missing = REQUIRED_MODEL_FILES.filter((name) => !fs.existsSync(path.join(this.modelDir, name)));
    if (missing.length) throw new Error(`离线语音模型不完整，缺少：${missing.join("、")}`);
    const modelSize = fs.statSync(path.join(this.modelDir, "model.int8.onnx")).size;
    if (modelSize < 1024 * 1024) throw new Error("离线语音模型文件无效，请重新安装客户端");
    if (!fs.existsSync(this.workerScript)) throw new Error("离线语音工作线程文件缺失，请重新安装客户端");
  }

  rejectPending(error) {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  startWorker() {
    if (this.workerPromise) return this.workerPromise;
    this.validateModel();
    this.workerPromise = new Promise((resolve, reject) => {
      const worker = new Worker(this.workerScript, {
        workerData: { modelDir: this.modelDir, numThreads: this.numThreads },
      });
      this.worker = worker;
      let initialized = false;
      const failInitialization = (error) => {
        if (initialized) return;
        initialized = true;
        this.workerPromise = null;
        this.worker = null;
        reject(error);
      };
      worker.on("message", (message) => {
        if (message.type === "ready") {
          if (initialized) return;
          initialized = true;
          this.loadMs = message.loadMs;
          resolve(worker);
          return;
        }
        if (message.type === "initialization-error") {
          failInitialization(new Error(`离线 TTS 初始化失败：${message.error}`));
          void worker.terminate();
          return;
        }
        if (message.type === "result") {
          const request = this.pending.get(message.id);
          if (!request) return;
          clearTimeout(request.timer);
          this.pending.delete(message.id);
          if (message.ok) request.resolve(message);
          else request.reject(new Error(`离线 TTS ${message.phase === "initialization" ? "初始化" : "合成"}失败：${message.error}`));
        }
      });
      worker.once("error", (error) => {
        const wrapped = new Error(`离线 TTS 工作线程错误：${error.message}`);
        failInitialization(wrapped);
        this.rejectPending(wrapped);
      });
      worker.once("exit", (code) => {
        const wasActive = this.worker === worker;
        if (wasActive) {
          this.worker = null;
          this.workerPromise = null;
        }
        if (!initialized) failInitialization(new Error(`离线 TTS 工作线程启动失败，退出代码 ${code}`));
        if (wasActive && code !== 0) this.rejectPending(new Error(`离线 TTS 工作线程异常退出，代码 ${code}`));
      });
    });
    return this.workerPromise;
  }

  cached(content) {
    const key = crypto.createHash("sha256").update(content).digest("hex");
    const value = this.cache.get(key);
    if (value) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return { key, value };
  }

  async generate(text) {
    const worker = await this.startWorker();
    const id = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`离线 TTS 合成超时（${this.timeoutMs}ms）`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, text });
    });
  }

  async synthesize(content) {
    const text = String(content || "").trim();
    if (!text) throw new Error("播报文字不能为空");
    const cached = this.cached(text);
    if (cached.value) return { ...cached.value, cached: true, synthesisMs: 0 };
    const generated = await this.generate(text);
    const stats = generated.stats;
    if (stats.durationMs < 200 || stats.peak < 64 || stats.rms < 8) throw new Error(`离线 TTS 生成的是静音音频（峰值 ${stats.peak}，RMS ${stats.rms}）`);
    const result = {
      audioBase64: generated.audioBase64,
      engine: "sherpa-onnx 离线 TTS",
      voice: "MeloTTS 中文女声",
      culture: "zh-CN/zh-EN",
      model: "vits-melo-tts-zh_en-int8",
      loadMs: this.loadMs,
      synthesisMs: generated.synthesisMs,
      cached: false,
      ...stats,
    };
    this.cache.set(cached.key, result);
    while (this.cache.size > this.cacheSize) this.cache.delete(this.cache.keys().next().value);
    return result;
  }

  async dispose() {
    const worker = this.worker;
    this.worker = null;
    this.workerPromise = null;
    this.rejectPending(new Error("离线 TTS 已停止"));
    if (worker) await worker.terminate();
  }
}

module.exports = { OfflineTtsSynthesizer, analyzeWavePcm16, encodeWavePcm16 };
