import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Store operations
  store: {
    get: (key: string) => ipcRenderer.invoke('get-store-value', key),
    set: (key: string, value: any) => ipcRenderer.invoke('set-store-value', key, value),
    delete: (key: string) => ipcRenderer.invoke('delete-store-value', key),
  },

  // Window operations
  window: {
    showSettings: () => ipcRenderer.invoke('show-settings'),
    close: () => ipcRenderer.invoke('close-app'),
    minimize: () => ipcRenderer.invoke('minimize-window'),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
    setSize: (width: number, height: number) => ipcRenderer.invoke('set-window-size', width, height),
    setPosition: (x: number, y: number) => ipcRenderer.invoke('set-window-position', x, y),
    getBounds: () => ipcRenderer.invoke('get-window-bounds'),
  },

  // Dialog operations
  dialog: {
    showError: (title: string, content: string) => ipcRenderer.invoke('show-error-dialog', title, content),
    showMessage: (options: any) => ipcRenderer.invoke('show-message-dialog', options),
  },

  // OpenRouter API
  openrouter: {
    request: (options: {
      endpoint: string
      method: string
      headers: Record<string, string>
      body?: string
    }) => ipcRenderer.invoke('openrouter-request', options),
  },

  // Audio operations
  audio: {
    startCapture: () => ipcRenderer.invoke('start-audio-capture'),
    stopCapture: () => ipcRenderer.invoke('stop-audio-capture'),
  },

  // Screen operations
  screen: {
    capture: () => ipcRenderer.invoke('capture-screen'),
  },

  // Event listeners
  on: (channel: string, callback: Function) => {
    const validChannels = [
      'audio-data',
      'transcription-result',
      'ai-response',
      'settings-updated',
      'window-moved',
      'window-resized'
    ]
    
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args))
    }
  },

  // Remove event listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // Send events
  send: (channel: string, ...args: any[]) => {
    const validChannels = [
      'start-listening',
      'stop-listening',
      'send-message',
      'update-settings'
    ]
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', api)

// Type definitions for TypeScript
export type ElectronAPI = typeof api

// Declare global interface for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}