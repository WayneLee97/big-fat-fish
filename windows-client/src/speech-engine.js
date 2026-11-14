const { EventEmitter } = require("node:events");

class SpeechEngine extends EventEmitter {
  constructor({ simulate = false, synthesizer = null, audioPlayer = null } = {}) {
    super();
    this.simulate = simulate;
    this.synthesizer = synthesizer;
    this.audioPlayer = audioPlayer;
    this.queue = [];
    this.processing = false;
  }

  enqueue(message) {
    this.queue.push(message);
    void this.processNext();
  }

  async processNext() {
    if (this.processing) return;
    const message = this.queue.shift();
    if (!message) return;
    this.processing = true;
    if (message.expiresAt <= Date.now()) {
      this.emit("expired", message);
      this.processing = false;
      void this.processNext();
      return;
    }
    this.emit("speaking", message);
    try {
      const result = await this.speak(message.content);
      this.emit("played", message, result);
    } catch (error) {
      this.emit("failed", message, error);
    } finally {
      this.processing = false;
      void this.processNext();
    }
  }

  async speak(content) {
    if (this.simulate) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { engine: "模拟语音", voice: "模拟语音", outputDevice: "模拟设备", durationMs: 1000, peak: 1000, rms: 100 };
    }
    if (!this.synthesizer || !this.audioPlayer) throw new Error("离线文字转语音组件尚未就绪");
    const synthesized = await this.synthesizer.synthesize(content);
    const playback = await this.audioPlayer(synthesized.audioBase64);
    const { audioBase64, ...details } = synthesized;
    return { ...details, outputDevice: playback?.outputDevice ?? "系统默认设备" };
  }

  async diagnose() {
    if (this.simulate) return { available: true, voices: ["模拟语音"], engine: "模拟语音", durationMs: 1000, peak: 1000, rms: 100 };
    try {
      const result = await this.synthesizer.synthesize("大肥鱼文字转语音自检成功");
      return { available: true, voices: [result.voice], engine: result.engine, durationMs: result.durationMs, peak: result.peak, rms: result.rms };
    } catch (error) {
      return { available: false, voices: [], error: error.message || "离线文字转语音验证失败" };
    }
  }

  dispose() {
    return this.synthesizer?.dispose?.();
  }
}

module.exports = { SpeechEngine };
