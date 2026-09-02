const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setFullscreen: (isFullscreen) => ipcRenderer.invoke("set-fullscreen", isFullscreen),
});

ipcRenderer.on("electron-fullscreen-change", (_event, isFullscreen) => {
  window.dispatchEvent(
    new CustomEvent("electron-fullscreen-change", {
      detail: { isFullscreen: Boolean(isFullscreen) },
    })
  );
});
