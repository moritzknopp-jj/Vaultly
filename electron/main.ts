import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, globalShortcut, safeStorage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import crypto from 'node:crypto'

// Windows: set the App User Model ID so the taskbar/notifications show the right icon and name
if (process.platform === 'win32') app.setAppUserModelId('com.vaultly.app')

// Single instance lock — if another instance starts, focus this one and quit the new one
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
})

let tray: Tray | null = null

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'logo.png')
    : path.join(__dirname, '../src/assets/logo.png')

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    // frameless window — custom TitleBar component (src/components/TitleBar.tsx) provides
    // minimize/maximize/close controls via IPC (window-minimize/maximize/close)
    frame: false,
    backgroundColor: '#0a0a0a',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Keep the renderer process fully alive when the window is hidden or minimized.
      // Without this, Electron throttles JS execution → Vite HMR WebSocket drops →
      // Vite forces a full page reload on restore (loses all state).
      backgroundThrottling: false,
    },
  })

  win.once('ready-to-show', () => {
    win?.show()

    // System tray — app keeps running in background when window is hidden
    try {
      const trayIconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'assets', 'logo.png')
        : path.join(__dirname, '../src/assets/logo.png')
      if (fs.existsSync(trayIconPath)) {
        tray = new Tray(trayIconPath)
        tray.setToolTip('Vaultly')
        const buildMenu = () => Menu.buildFromTemplate([
          { label: 'Show Vaultly', click: () => { win?.show(); win?.focus() } },
          { type: 'separator' },
          { label: 'Quit Vaultly', click: () => { tray?.destroy(); app.quit() } },
        ])
        tray.setContextMenu(buildMenu())
        tray.on('click', () => {
          if (win?.isVisible()) { win.focus() } else { win?.show(); win?.focus() }
        })
        tray.on('double-click', () => { win?.show(); win?.focus() })
      }
    } catch { /* tray unavailable */ }

    // Global hotkey: Ctrl+Shift+V to show/focus or hide
    globalShortcut.register('CommandOrControl+Shift+V', () => {
      if (win?.isVisible()) { win.hide() } else { win?.show(); win?.focus() }
    })
  })

  // Intercept OS-level close (Alt+F4, taskbar close, etc.) — hide to tray instead
  win.on('close', (e) => {
    if (tray) {
      e.preventDefault()
      win?.hide()
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Open external links in browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

// IPC Handlers
ipcMain.handle('pick-vault-folder', async () => {
  if (!win) return null
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select your Obsidian vault folder',
    defaultPath: app.getPath('documents'),
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('get-device-id', () => {
  const raw = `${os.hostname()}-${os.platform()}-${os.arch()}`
  return crypto.createHash('sha256').update(raw).digest('hex')
})

ipcMain.handle('read-vault-files', async (_event, vaultPath: string) => {
  const results: { path: string; content: string }[] = []

  function readRecursive(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          readRecursive(full)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(full, 'utf-8')
            if (content.trim()) {
              results.push({ path: full, content })
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  readRecursive(vaultPath)
  return results
})

ipcMain.handle('write-vault-file', async (_event, filePath: string, content: string) => {
  // Security: only allow writing .md files and prevent path traversal
  if (!filePath.endsWith('.md')) return { ok: false, error: 'Only .md files allowed' }
  const resolved = path.resolve(filePath)
  // Reject paths with traversal segments or null bytes
  if (resolved.includes('\0') || filePath.includes('..')) {
    return { ok: false, error: 'Invalid file path' }
  }
  try {
    fs.writeFileSync(resolved, content, 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

ipcMain.handle('get-file-mtime', (_event, filePath: string) => {
  try {
    return fs.statSync(filePath).mtimeMs
  } catch {
    return null
  }
})

// API key encryption via OS safeStorage (DPAPI on Windows)
ipcMain.handle('encrypt-data', (_event, plaintext: string) => {
  if (!safeStorage.isEncryptionAvailable()) return Buffer.from(plaintext).toString('base64')
  return safeStorage.encryptString(plaintext).toString('base64')
})

ipcMain.handle('decrypt-data', (_event, ciphertext: string) => {
  if (!safeStorage.isEncryptionAvailable()) return Buffer.from(ciphertext, 'base64').toString()
  try {
    return safeStorage.decryptString(Buffer.from(ciphertext, 'base64'))
  } catch {
    return ''
  }
})

// Manual update check — only works in packaged builds
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { hasUpdate: false, error: 'Updates only available in packaged builds.' }
  try {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    const result = await autoUpdater.checkForUpdates()
    return { hasUpdate: !!result?.updateInfo, version: result?.updateInfo?.version ?? null }
  } catch (err) {
    return { hasUpdate: false, error: String(err) }
  }
})

ipcMain.handle('download-and-install-update', async () => {
  if (!app.isPackaged) return
  const { autoUpdater } = await import('electron-updater')
  autoUpdater.downloadUpdate()
  autoUpdater.once('update-downloaded', () => autoUpdater.quitAndInstall())
})

// Window controls
ipcMain.on('window-minimize', () => win?.minimize())
ipcMain.on('window-maximize', () => {
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
// Close button hides to tray if tray is active; otherwise quits
ipcMain.on('window-close', () => {
  if (tray) { win?.hide() } else { win?.close() }
})

app.on('window-all-closed', () => {
  // Only quit if the tray is not keeping the app alive in the background
  if (!tray) {
    globalShortcut.unregisterAll()
    app.quit()
    win = null
  }
})

app.on('before-quit', () => {
  // Allow the window to actually close when quitting
  win?.removeAllListeners('close')
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
