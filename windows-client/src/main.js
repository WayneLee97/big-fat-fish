const { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const QRCode = require("qrcode");
const { Bonjour } = require("bonjour-service");
const { ClassroomApiServer } = require("./api-server");
const { MessageStore } = require("./message-store");
const { MESSAGE_STATUSES, PROTOCOL_VERSION } = require("./protocol");
const { SpeechEngine } = require("./speech-engine");
const { runSystemDiagnostics } = require("./system-diagnostics");
const { RendererAudioPlayer } = require("./renderer-audio-player");
const { OfflineTtsSynthesizer } = require("./offline-tts");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let mainWindow;
let tray;
let apiServer;
let store;
let speech;
let configuration;
let pairingCode;
let bonjour;
let discoveryService;
let audioPlayer;

function networkAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((item) => item && item.family === "IPv4" && !item.internal).map((item) => item.address);
}

function ttsModelDirectory() {
  if (app.isPackaged) return path.join(process.resourcesPath, "tts", "vits-melo-tts-zh_en");
  return path.join(__dirname, "..", "resources", "tts", "vits-melo-tts-zh_en");
}

function ttsWorkerScript() {
  if (app.isPackaged) return path.join(process.resourcesPath, "app.asar.unpacked", "src", "offline-tts-worker.js");
  return path.join(__dirname, "offline-tts-worker.js");
}

function loadConfiguration() {
  const filePath = path.join(app.getPath("userData"), "config.json");
  try {
    const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (saved.accessToken && saved.deviceId) return saved;
  } catch (error) {
    if (error.code !== "ENOENT") console.error("读取配置失败", error);
  }
  const created = {
    deviceId: crypto.randomUUID(),
    accessToken: crypto.randomBytes(18).toString("base64url"),
    deviceName: os.hostname(),
    className: "尚未绑定班级",
    port: 32145,
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(created, null, 2), "utf8");
  return created;
}

function saveConfiguration() {
  const filePath = path.join(app.getPath("userData"), "config.json");
  fs.writeFileSync(filePath, JSON.stringify(configuration, null, 2), "utf8");
}

function publishDiscovery() {
  if (!bonjour) bonjour = new Bonjour();
  if (discoveryService) discoveryService.stop();
  discoveryService = bonjour.publish({
    name: `大肥鱼-${configuration.deviceName}-${configuration.deviceId.slice(0, 6)}`,
    type: "bigfatfish",
    protocol: "tcp",
    port: apiServer.port,
    txt: {
      protocolVersion: PROTOCOL_VERSION,
      deviceId: configuration.deviceId,
      deviceName: configuration.deviceName,
      classId: configuration.classId ?? "",
      className: configuration.className,
    },
  });
}

async function state() {
  const addresses = networkAddresses();
  const pairingPayload = {
    type: "big-fat-fish-classroom",
    protocolVersion: PROTOCOL_VERSION,
    deviceId: configuration.deviceId,
    deviceName: configuration.deviceName,
    addresses: addresses.map((address) => `http://${address}:${configuration.port}`),
    pairingCode,
  };
  return {
    protocolVersion: PROTOCOL_VERSION,
    deviceId: configuration.deviceId,
    deviceName: configuration.deviceName,
    className: configuration.className,
    pairingCode,
    pairingQrCode: await QRCode.toDataURL(JSON.stringify(pairingPayload), { errorCorrectionLevel: "M", margin: 1, width: 280 }),
    port: configuration.port,
    addresses,
    messages: store?.list().slice(0, 20) ?? [],
  };
}

async function publishState() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("classroom:state", await state());
}

function diagnostics() {
  return runSystemDiagnostics({
    port: apiServer.port,
    addresses: networkAddresses(),
    speech,
    userDataPath: app.getPath("userData"),
    isPackaged: app.isPackaged,
    loginItemSettings: process.platform === "win32" ? app.getLoginItemSettings() : null,
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#fffdf8",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAH0lEQVR42mNk+M+ABzAxMDAwMDAyMDAwGg0jGqYBAE7uAh+R9mOAAAAAAElFTkSuQmCC");
  tray = new Tray(icon);
  tray.setToolTip("大肥鱼教室呼叫");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开教室呼叫", click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: "separator" },
    { label: "退出", click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on("double-click", () => mainWindow.show());
}

function updateStatus(messageId, status, details = {}) {
  const message = store.update(messageId, { status, ...details });
  void publishState();
  return message;
}

async function startApplication() {
  configuration = loadConfiguration();
  pairingCode = String(crypto.randomInt(100000, 1000000));
  store = new MessageStore(path.join(app.getPath("userData"), "messages.json"));
  store.load();
  createWindow();
  mainWindow.webContents.setAudioMuted(false);
  audioPlayer = new RendererAudioPlayer(mainWindow.webContents);
  speech = new SpeechEngine({
    synthesizer: new OfflineTtsSynthesizer({ modelDir: ttsModelDirectory(), workerScript: ttsWorkerScript() }),
    audioPlayer: (audioBase64) => audioPlayer.play(audioBase64),
  });
  speech.on("expired", (message) => updateStatus(message.messageId, MESSAGE_STATUSES.EXPIRED));
  speech.on("speaking", (message) => updateStatus(message.messageId, MESSAGE_STATUSES.SPEAKING));
  speech.on("played", (message, result) => updateStatus(message.messageId, MESSAGE_STATUSES.PLAYED, { playedAt: Date.now(), speechEngine: result.engine, speechVoice: result.voice, outputDevice: result.outputDevice }));
  speech.on("failed", (message, error) => updateStatus(message.messageId, MESSAGE_STATUSES.FAILED, { errorCode: "TTS_FAILED", errorMessage: error.message }));

  createTray();
  if (process.platform === "win32" && app.isPackaged) app.setLoginItemSettings({ openAtLogin: true });
  apiServer = new ClassroomApiServer({
    store,
    accessToken: () => configuration.accessToken,
    pairingCode: () => pairingCode,
    port: configuration.port,
    deviceInfo: () => ({ deviceId: configuration.deviceId, deviceName: configuration.deviceName, classId: configuration.classId ?? null, className: configuration.className }),
    onPair: ({ classId, className }) => {
      configuration = { ...configuration, classId, className, accessToken: crypto.randomBytes(18).toString("base64url") };
      pairingCode = String(crypto.randomInt(100000, 1000000));
      saveConfiguration();
      publishDiscovery();
      void publishState();
      return { deviceId: configuration.deviceId, deviceName: configuration.deviceName, classId, className, accessToken: configuration.accessToken };
    },
    onAccepted: (message) => {
      updateStatus(message.messageId, MESSAGE_STATUSES.DISPLAYING);
      mainWindow.webContents.send("classroom:notification", message);
      mainWindow.showInactive();
      speech.enqueue(message);
    },
  });
  await apiServer.start();
  publishDiscovery();

  ipcMain.handle("classroom:get-state", () => state());
  ipcMain.handle("classroom:test-speech", async () => {
    try {
      const result = await speech.speak("大肥鱼教室呼叫，语音测试正常");
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, error: error.message || "文字转语音测试失败" };
    }
  });
  ipcMain.handle("classroom:run-diagnostics", () => diagnostics());
  ipcMain.on("classroom:audio-result", (event, result) => {
    if (event.sender === mainWindow.webContents) audioPlayer.complete(result);
  });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on("second-instance", () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(startApplication).catch((error) => {
    console.error(error);
    app.quit();
  });
  app.on("before-quit", () => { app.isQuitting = true; void speech?.dispose(); });
  app.on("window-all-closed", () => {});
  app.on("quit", () => { audioPlayer?.dispose(); if (apiServer) void apiServer.stop(); if (bonjour) bonjour.destroy(); });
}
