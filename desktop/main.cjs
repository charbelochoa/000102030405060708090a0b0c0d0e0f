const { app, BrowserWindow, shell, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

let engine
app.setName('AERIS')
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.whenReady().then(async () => {
    const root = path.join(app.getPath('documents'), 'AERIS Workspace')
    fs.mkdirSync(root, { recursive: true })
    process.env.AERIS_WORKSPACE = process.env.AERIS_WORKSPACE || root
    process.env.AERIS_DATA_DIR = path.join(app.getPath('userData'), 'engine')
    if (app.isPackaged)
      process.env.AERIS_ANALYSIS_WORKER = path.join(
        process.resourcesPath,
        'analysis',
        'aeris-analysis.exe'
      )
    process.env.AERIS_STATIC_DIR = path.join(__dirname, '..', 'dist')
    process.env.AERIS_EMBEDDED = 'true'
    process.env.AERIS_PUBLIC_URL = 'http://127.0.0.1:4319'
    process.env.AERIS_AUTH_REQUIRED = 'false'
    try {
      const { startServer } = await import(
        pathToFileURL(path.join(__dirname, '..', 'build', 'server', 'index.mjs')).href
      )
      engine = await startServer(4319, '127.0.0.1')
      const window = new BrowserWindow({
        width: 1480,
        height: 940,
        minWidth: 980,
        minHeight: 680,
        backgroundColor: '#080808',
        title: 'AERIS',
        icon: path.join(__dirname, 'icon.ico'),
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
      })
      window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) shell.openExternal(url)
        return { action: 'deny' }
      })
      window.webContents.on('will-navigate', (event, url) => {
        const origin = new URL(url).origin
        const allowed = [
          'http://127.0.0.1:4319',
          'https://accounts.google.com',
          'https://github.com'
        ]
        if (!allowed.includes(origin)) {
          event.preventDefault()
          if (url.startsWith('https://')) shell.openExternal(url)
        }
      })
      await window.loadURL('http://127.0.0.1:4319/app')
    } catch (error) {
      dialog.showErrorBox('AERIS no pudo iniciar', error.message)
      app.quit()
    }
  })
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })
  app.on('window-all-closed', () => {
    engine?.server.close()
    app.quit()
  })
}
