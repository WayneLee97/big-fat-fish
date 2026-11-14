const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("classroom", {
  getState: () => ipcRenderer.invoke("classroom:get-state"),
  testSpeech: () => ipcRenderer.invoke("classroom:test-speech"),
  runDiagnostics: () => ipcRenderer.invoke("classroom:run-diagnostics"),
  reportAudioResult: (result) => ipcRenderer.send("classroom:audio-result", result),
  onState: (listener) => {
    const callback = (_event, value) => listener(value);
    ipcRenderer.on("classroom:state", callback);
    return () => ipcRenderer.removeListener("classroom:state", callback);
  },
  onNotification: (listener) => {
    const callback = (_event, value) => listener(value);
    ipcRenderer.on("classroom:notification", callback);
    return () => ipcRenderer.removeListener("classroom:notification", callback);
  },
  onPlayAudio: (listener) => {
    const callback = (_event, value) => listener(value);
    ipcRenderer.on("classroom:play-audio", callback);
    return () => ipcRenderer.removeListener("classroom:play-audio", callback);
  },
});
