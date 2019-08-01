import { app, BrowserWindow } from "electron"
import contextMenu from "electron-context-menu"
import * as path from "path"
import { format as formatUrl } from "url"

import MenuBuilder from "./menu"

process.env.NODE_ENV === "production" && require("fix-path")()

contextMenu({
  showLookUpSelection: true,
  showCopyImageAddress: true,
  showSaveImageAs: true,
  showInspectElement: true
})

let mainWindow

app.on("window-all-closed", () => app.quit())
app.on("ready", () => (mainWindow = createMainWindow()))

function createMainWindow() {
  const isDevelopment = process.env.NODE_ENV !== "production"

  const window = new BrowserWindow({
    width: 512,
    height: 512,
    titleBarStyle: "hiddenInset",
    webPreferences: { nodeIntegration: true }
  })

  if (isDevelopment || true) {
    window.webContents.openDevTools()
  }

  if (isDevelopment) {
    window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
  } else {
    window.loadURL(
      formatUrl({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file",
        slashes: true
      })
    )
  }

  window.on("closed", () => {
    mainWindow = null
  })

  window.webContents.on("devtools-opened", () => {
    window.focus()
    setImmediate(() => {
      window.focus()
    })
  })

  new MenuBuilder(window).buildMenu()

  return window
}
