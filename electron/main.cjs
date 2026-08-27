const { app, BrowserWindow } = require("electron");
const path = require("node:path");

const WEB_APP_URL = "https://ghmeundong.github.io/sketchybook/";

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#f5ebcf",
    icon: path.join(__dirname, "..", "dist", "sketchybook.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const notifyFullscreenChange = (isFullscreen) => {
    if (!window.webContents.isLoading()) {
      void window.webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent("electron-fullscreen-change", { detail: { isFullscreen: ${isFullscreen} } }));`
      );
    }
  };

  window.on("enter-full-screen", () => notifyFullscreenChange(true));
  window.on("leave-full-screen", () => notifyFullscreenChange(false));

  if (app.isPackaged) {
    window.loadURL(WEB_APP_URL);
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
