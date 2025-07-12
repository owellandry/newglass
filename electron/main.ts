import { app, BrowserWindow, ipcMain, shell, dialog, desktopCapturer, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import Store from 'electron-store'

// Initialize electron store
const store = new Store()

// Global variables
let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

// Development server URL
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createMainWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 400,
    height: 60,
    minWidth: 300,
    minHeight: 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  })

  // Set window position
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize
  mainWindow.setPosition(width - 420, 20)

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in development
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: 'Glass V2 Settings',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  })

  // Load settings page
  if (VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${VITE_DEV_SERVER_URL}#/settings`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: 'settings'
    })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

// App event handlers
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.glass.v2')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Setup native loopback audio capture for Windows
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' })
    }).catch((error) => {
      console.error('Failed to get desktop capturer sources:', error)
      callback({})
    })
  })

  createMainWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  // Auto updater
  if (!is.dev) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-store-value', (_, key: string) => {
  return store.get(key)
})

ipcMain.handle('set-store-value', (_, key: string, value: any) => {
  store.set(key, value)
})

ipcMain.handle('delete-store-value', (_, key: string) => {
  store.delete(key)
})

ipcMain.handle('show-settings', () => {
  createSettingsWindow()
})

ipcMain.handle('close-app', () => {
  app.quit()
})

ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop)
    return !isAlwaysOnTop
  }
  return false
})

ipcMain.handle('set-window-size', (_, width: number, height: number) => {
  if (mainWindow) {
    mainWindow.setSize(width, height)
  }
})

ipcMain.handle('set-window-position', (_, x: number, y: number) => {
  if (mainWindow) {
    mainWindow.setPosition(x, y)
  }
})

ipcMain.handle('get-window-bounds', () => {
  if (mainWindow) {
    return mainWindow.getBounds()
  }
  return null
})

ipcMain.handle('show-error-dialog', (_, title: string, content: string) => {
  dialog.showErrorBox(title, content)
})

ipcMain.handle('show-message-dialog', async (_, options: any) => {
  const result = await dialog.showMessageBox(options)
  return result
})

// OpenRouter API handler
ipcMain.handle('openrouter-request', async (_, options: {
  endpoint: string
  method: string
  headers: Record<string, string>
  body?: string
}) => {
  try {
    const response = await fetch(`https://openrouter.ai/api/v1${options.endpoint}`, {
      method: options.method,
      headers: options.headers,
      body: options.body
    })

    const data = await response.json()
    return {
      ok: response.ok,
      status: response.status,
      data
    }
  } catch (error) {
    console.error('OpenRouter API error:', error)
    throw error
  }
})

// Audio capture handlers
ipcMain.handle('start-audio-capture', async () => {
  // Implementation for audio capture
  console.log('Starting audio capture...')
  return true
})

ipcMain.handle('stop-audio-capture', async () => {
  // Implementation for stopping audio capture
  console.log('Stopping audio capture...')
  return true
})

// Screen capture handlers
ipcMain.handle('capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    })
    
    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL()
    }
    return null
  } catch (error) {
    console.error('Screen capture error:', error)
    throw error
  }
})

export { mainWindow, settingsWindow }