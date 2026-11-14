class RendererAudioPlayer {
  constructor(webContents, timeoutMs = 90_000) {
    this.webContents = webContents;
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
    this.sequence = 0;
  }

  play(audioBase64) {
    if (!audioBase64) return Promise.reject(new Error("没有可播放的语音数据"));
    if (!this.webContents || this.webContents.isDestroyed()) return Promise.reject(new Error("客户端播放窗口不可用"));
    const requestId = `audio_${Date.now().toString(36)}_${(++this.sequence).toString(36)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("客户端音频播放超时，请检查 Windows 输出设备"));
      }, this.timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      const send = () => this.webContents.send("classroom:play-audio", { requestId, audioBase64 });
      if (this.webContents.isLoadingMainFrame?.()) this.webContents.once("did-finish-load", send);
      else send();
    });
  }

  complete(result) {
    const item = this.pending.get(result?.requestId);
    if (!item) return false;
    clearTimeout(item.timer);
    this.pending.delete(result.requestId);
    if (result.ok) item.resolve(result);
    else item.reject(new Error(result.error || "客户端无法播放音频"));
    return true;
  }

  dispose() {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("客户端正在退出"));
    }
    this.pending.clear();
  }
}

module.exports = { RendererAudioPlayer };
