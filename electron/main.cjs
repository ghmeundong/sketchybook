const { app, BrowserWindow, ipcMain } = require("electron");
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
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const notifyFullscreenChange = (isFullscreen) => {
    window.webContents.send("electron-fullscreen-change", isFullscreen);
  };

  window.on("enter-full-screen", () => notifyFullscreenChange(true));
  window.on("leave-full-screen", () => notifyFullscreenChange(false));
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;

    if (input.key === "F11") {
      event.preventDefault();
      window.setFullScreen(!window.isFullScreen());
    } else if (input.key === "Escape" && window.isFullScreen()) {
      event.preventDefault();
      window.setFullScreen(false);
    }
  });

  if (app.isPackaged) {
    window.loadURL(WEB_APP_URL);
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

ipcMain.handle("set-fullscreen", (event, isFullscreen) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return false;
  window.setFullScreen(Boolean(isFullscreen));
  return window.isFullScreen();
});

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
