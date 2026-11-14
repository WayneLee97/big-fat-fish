let activeAudio = null;
const audioOutput = document.querySelector("#audio-output");
const AUDIO_OUTPUT_KEY = "big-fat-fish-audio-output";

function outputDeviceName() {
  return audioOutput.selectedOptions[0]?.textContent || "系统默认设备";
}

async function playAudioBase64(audioBase64) {
  const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
  activeAudio = audio;
  audio.muted = false;
  audio.volume = 1;
  const sinkId = audioOutput.value;
  if (sinkId) {
    if (typeof audio.setSinkId !== "function") throw new Error("当前系统不支持选择声音输出设备");
    await audio.setSinkId(sinkId);
  }
  return new Promise((resolve, reject) => {
    let completed = false;
    const finish = (error) => {
      if (completed) return;
      completed = true;
      activeAudio = null;
      if (error) reject(error); else resolve({ outputDevice: outputDeviceName(), duration: audio.duration });
    };
    audio.addEventListener("ended", () => finish(), { once: true });
    audio.addEventListener("error", () => finish(new Error(`Chromium 音频错误 ${audio.error?.code ?? "未知"}`)), { once: true });
    void audio.play().catch((error) => finish(new Error(`客户端播放器启动失败：${error.message}`)));
  });
}

function createTestTone() {
  const sampleRate = 44_100;
  const sampleCount = Math.floor(sampleRate * 1.2);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF"); view.setUint32(4, 36 + sampleCount * 2, true); write(8, "WAVE"); write(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, sampleCount * 2, true);
  for (let index = 0; index < sampleCount; index += 1) {
    const edge = Math.min(1, index / 800, (sampleCount - index) / 800);
    const sample = Math.sin(2 * Math.PI * 660 * index / sampleRate) * 0.45 * edge;
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16_384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  return btoa(binary);
}

async function refreshAudioOutputs() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const selected = localStorage.getItem(AUDIO_OUTPUT_KEY) || "";
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audiooutput");
  audioOutput.replaceChildren(new Option("系统默认设备", ""));
  devices.filter((device) => device.deviceId !== "default").forEach((device, index) => {
    audioOutput.append(new Option(device.label || `声音输出设备 ${index + 1}`, device.deviceId));
  });
  if ([...audioOutput.options].some((option) => option.value === selected)) audioOutput.value = selected;
}

audioOutput.addEventListener("change", () => localStorage.setItem(AUDIO_OUTPUT_KEY, audioOutput.value));
void refreshAudioOutputs().catch(() => {});
navigator.mediaDevices?.addEventListener?.("devicechange", () => void refreshAudioOutputs().catch(() => {}));

window.classroom.onPlayAudio(({ requestId, audioBase64 }) => {
  void playAudioBase64(audioBase64)
    .then((result) => window.classroom.reportAudioResult({ requestId, ok: true, ...result }))
    .catch((error) => window.classroom.reportAudioResult({ requestId, ok: false, error: error.message || "客户端播放器初始化失败" }));
});

function render(state) {
  document.querySelector("#device-name").textContent = state.deviceName;
  document.querySelector("#class-name").textContent = state.className;
  document.querySelector("#addresses").textContent = state.addresses.length ? state.addresses.map((address) => `http://${address}:${state.port}`).join("\n") : "未找到局域网地址";
  document.querySelector("#pairing-code").textContent = state.pairingCode;
  document.querySelector("#pairing-qr").src = state.pairingQrCode;
}

window.classroom.getState().then(render);
window.classroom.onState(render);
let notificationTimer;
function closeNotification() {
  clearTimeout(notificationTimer);
  document.querySelector("#notification").classList.add("hidden");
}
document.querySelector("#notification-close").addEventListener("click", closeNotification);
window.classroom.onNotification((message) => {
  const panel = document.querySelector("#notification");
  document.querySelector("#notification-content").textContent = message.content;
  panel.classList.remove("hidden");
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(closeNotification, 15_000);
});
document.querySelector("#speech-test").addEventListener("click", async () => {
  const result = document.querySelector("#test-result"); result.textContent = "正在播放测试语音…";
  try { const details = await window.classroom.testSpeech(); if (!details.ok) throw new Error(details.error); result.textContent = `离线语音测试完成：${details.voice} · 合成 ${details.synthesisMs}ms · 音频 ${details.durationMs}ms · 峰值 ${details.peak} · RMS ${details.rms} · ${details.outputDevice}`; }
  catch (error) { result.textContent = `语音测试失败：${error.message}`; }
});

document.querySelector("#speaker-test").addEventListener("click", async () => {
  const button = document.querySelector("#speaker-test");
  const result = document.querySelector("#test-result");
  button.disabled = true; result.textContent = `正在通过“${outputDeviceName()}”播放测试音效…`;
  try { const details = await playAudioBase64(createTestTone()); result.textContent = `测试音效已播放：${details.outputDevice}`; }
  catch (error) { result.textContent = `扬声器测试失败：${error.message}`; }
  finally { button.disabled = false; }
});

document.querySelector("#diagnostics-test").addEventListener("click", async () => {
  const button = document.querySelector("#diagnostics-test");
  const container = document.querySelector("#diagnostics");
  button.disabled = true;
  button.textContent = "正在检查…";
  try {
    const result = await window.classroom.runDiagnostics();
    container.replaceChildren();
    result.checks.forEach((check) => {
      const row = document.createElement("div"); row.className = `diagnostic ${check.status}`;
      const title = document.createElement("strong"); title.textContent = `${check.status === "passed" ? "✓" : check.status === "warning" ? "!" : "×"} ${check.title}`;
      const detail = document.createElement("span"); detail.textContent = check.detail;
      row.append(title, detail); container.append(row);
    });
    container.classList.remove("hidden");
  } catch (error) {
    container.textContent = `自检失败：${error.message}`;
    container.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = "运行系统自检";
  }
});
