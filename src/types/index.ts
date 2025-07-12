// AI Provider Types
export interface AIProvider {
  id: string
  name: string
  description?: string
  apiKeyRequired: boolean
  models: AIModel[]
  supportedFeatures: AIFeature[]
}

export interface AIModel {
  id: string
  name: string
  description?: string
  contextLength: number
  inputCost?: number // per 1M tokens
  outputCost?: number // per 1M tokens
  capabilities: ModelCapability[]
}

export type ModelCapability = 'text' | 'vision' | 'function-calling' | 'streaming'
export type AIFeature = 'chat' | 'completion' | 'embedding' | 'speech-to-text' | 'text-to-speech'

// Chat Types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    provider?: string
    tokens?: {
      input: number
      output: number
    }
    cost?: number
    duration?: number
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  settings: {
    model: string
    provider: string
    temperature: number
    maxTokens: number
    systemPrompt?: string
  }
  metadata?: {
    totalTokens: number
    totalCost: number
    messageCount: number
  }
}

// Settings Types
export interface AppSettings {
  // AI Settings
  ai: {
    defaultProvider: string
    defaultModel: string
    temperature: number
    maxTokens: number
    systemPrompt: string
    streamResponses: boolean
  }
  
  // API Keys
  apiKeys: {
    openrouter: string
    [key: string]: string
  }
  
  // UI Settings
  ui: {
    theme: 'light' | 'dark' | 'system'
    fontSize: 'small' | 'medium' | 'large'
    compactMode: boolean
    showTimestamps: boolean
    showTokenCounts: boolean
    showCosts: boolean
  }
  
  // Audio Settings
  audio: {
    enabled: boolean
    inputDevice?: string
    outputDevice?: string
    volume: number
    autoPlay: boolean
  }
  
  // Shortcuts
  shortcuts: {
    toggleListening: string
    sendMessage: string
    newSession: string
    openSettings: string
  }
  
  // Privacy
  privacy: {
    saveConversations: boolean
    shareAnalytics: boolean
    clearDataOnExit: boolean
  }
  
  // Advanced
  advanced: {
    enableDebugMode: boolean
    maxHistorySize: number
    autoSaveInterval: number
  }
}

// Audio Types
export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

export interface AudioRecording {
  id: string
  blob: Blob
  duration: number
  timestamp: Date
  transcription?: string
}

// Screen Capture Types
export interface ScreenCapture {
  id: string
  type: 'screenshot' | 'screen-recording'
  data: string | Blob
  timestamp: Date
  metadata?: {
    width: number
    height: number
    format: string
    size: number
  }
}

// Window Types
export type WindowType = 'main' | 'settings'

export interface WindowState {
  isVisible: boolean
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
  isMaximized: boolean
  isMinimized: boolean
  isFullscreen: boolean
}

// Store Types
export interface AppState {
  isLoading: boolean
  isInitialized: boolean
  currentSession: ChatSession | null
  sessions: ChatSession[]
  isListening: boolean
  isProcessing: boolean
  error: string | null
}

export interface SettingsState {
  settings: AppSettings
  isLoading: boolean
  isDirty: boolean
  error: string | null
}

export interface AIState {
  providers: AIProvider[]
  currentProvider: AIProvider | null
  currentModel: AIModel | null
  isStreaming: boolean
  streamingMessage: string
  error: string | null
}

// API Types
export interface OpenRouterResponse {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenRouterStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    delta: {
      role?: string
      content?: string
    }
    finish_reason?: string
  }[]
}

// Error Types
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: Date
}

// Event Types
export type AppEvent = 
  | { type: 'session:created'; payload: ChatSession }
  | { type: 'session:updated'; payload: ChatSession }
  | { type: 'session:deleted'; payload: string }
  | { type: 'message:sent'; payload: ChatMessage }
  | { type: 'message:received'; payload: ChatMessage }
  | { type: 'settings:updated'; payload: Partial<AppSettings> }
  | { type: 'audio:started' }
  | { type: 'audio:stopped' }
  | { type: 'audio:transcribed'; payload: string }
  | { type: 'error'; payload: AppError }

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Component Props Types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}

export interface InputProps extends BaseComponentProps {
  type?: string
  placeholder?: string
  value?: string
  defaultValue?: string
  disabled?: boolean
  error?: string
  onChange?: (value: string) => void
  onEnter?: () => void
}

export interface SelectProps extends BaseComponentProps {
  options: { value: string; label: string; disabled?: boolean }[]
  value?: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  onChange?: (value: string) => void
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

// Electron API Types
export interface ElectronAPI {
  // App info
  getAppVersion: () => Promise<string>
  
  // Store operations
  store: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    delete: (key: string) => Promise<void>
    clear: () => Promise<void>
  }
  
  // Window controls
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    unmaximize: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    setAlwaysOnTop: (flag: boolean) => Promise<void>
    openSettings: () => Promise<void>
    closeSettings: () => Promise<void>
  }
  
  // Dialogs
  dialog: {
    showOpenDialog: (options: any) => Promise<any>
    showSaveDialog: (options: any) => Promise<any>
    showMessageBox: (options: any) => Promise<any>
  }
  
  // OpenRouter API
  openrouter: {
    chat: (messages: any[], options: any) => Promise<any>
    stream: (messages: any[], options: any) => Promise<ReadableStream>
  }
  
  // Audio
  audio: {
    startRecording: () => Promise<void>
    stopRecording: () => Promise<Blob>
    getDevices: () => Promise<AudioDevice[]>
  }
  
  // Screen capture
  screen: {
    capture: () => Promise<string>
    startRecording: () => Promise<void>
    stopRecording: () => Promise<Blob>
  }
  
  // IPC
  on: (channel: string, callback: (...args: any[]) => void) => void
  removeAllListeners: (channel: string) => void
  send: (channel: string, ...args: any[]) => void
}

// Declare global electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}