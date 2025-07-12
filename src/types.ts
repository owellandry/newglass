import { ReactNode } from 'react'

// Base types
export interface BaseProps {
  className?: string
  children?: ReactNode
}

// Button types
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  loading?: boolean
  children?: ReactNode
  className?: string
}

// Input types
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  onEnter?: () => void
}

// Select types
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  error?: string
  className?: string
  onChange?: (value: string) => void
}

// Message types
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  model?: string
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  cost?: number
  metadata?: Record<string, any>
}

// Session types
export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  model: string
  temperature: number
  maxTokens: number
  systemPrompt?: string
  metadata?: Record<string, any>
}

// AI Provider types
export interface AIProvider {
  id: string
  name: string
  models: AIModel[]
  requiresApiKey: boolean
  baseUrl?: string
  description?: string
}

export interface AIModel {
  id: string
  name: string
  description?: string
  contextLength: number
  inputCost: number // per 1K tokens
  outputCost: number // per 1K tokens
  supportsStreaming: boolean
  supportsVision?: boolean
  supportsFunctions?: boolean
}

// Settings types
export interface UISettings {
  theme: 'light' | 'dark' | 'system'
  language: string
  compactMode: boolean
  showTimestamps: boolean
  showTokenCounts: boolean
  showCosts: boolean
}

export interface AISettings {
  provider: string
  model: string
  apiKeys: Record<string, string>
  temperature: number
  maxTokens: number
  systemPrompt: string
  streaming: boolean
}

export interface AudioSettings {
  inputDevice: string
  outputDevice: string
  microphoneEnabled: boolean
  voiceActivation: boolean
  voiceThreshold: number
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  sampleRate: number
  channels: number
}

export interface ShortcutSettings {
  toggleSidebar: string
  newSession: string
  openSettings: string
  toggleVoice: string
  sendMessage: string
  focusInput: string
  scrollToBottom: string
  copyLastMessage: string
}

export interface PrivacySettings {
  dataCollection: boolean
  analytics: boolean
  crashReports: boolean
  localStorageOnly: boolean
  encryptData: boolean
  autoDeleteOldSessions: boolean
  autoDeleteDays: number
}

export interface AdvancedSettings {
  debugMode: boolean
  developerMode: boolean
  experimentalFeatures: boolean
  autoSave: boolean
  autoSaveInterval: number
  maxSessions: number
  maxMessagesPerSession: number
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  customCSS: string
}

export interface AppSettings {
  ui: UISettings
  ai: AISettings
  audio: AudioSettings
  shortcuts: ShortcutSettings
  privacy: PrivacySettings
  advanced: AdvancedSettings
}

// Store types
export interface AppState {
  isLoading: boolean
  currentSession: Session | null
  sessions: Session[]
  isListening: boolean
  isProcessing: boolean
  error: string | null
}

export interface AIState {
  currentProvider: string
  currentModel: string
  providers: AIProvider[]
  isStreaming: boolean
  error: string | null
}

export interface SettingsState {
  settings: AppSettings
  isDirty: boolean
  isLoading: boolean
  error: string | null
}

// API types
export interface ChatCompletionRequest {
  model: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  temperature?: number
  max_tokens?: number
  stream?: boolean
  top_p?: number
  frequency_penalty?: number
  presence_penalty?: number
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: 'assistant'
      content?: string
    }
    finish_reason?: string
  }>
}

// Electron API types
export interface ElectronAPI {
  window: {
    minimize: () => void
    maximize: () => void
    unmaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
    openSettings: () => void
    openDevTools: () => void
  }
  app: {
    getVersion: () => Promise<string>
    getVersions: () => Promise<Record<string, string>>
    checkForUpdates: () => Promise<{ available: boolean; version?: string }>
  }
  shell: {
    openExternal: (url: string) => void
  }
  openrouter: {
    chat: (request: ChatCompletionRequest) => Promise<ChatCompletionResponse>
    stream: (request: ChatCompletionRequest) => Promise<ReadableStream>
  }
  storage: {
    get: (key: string) => Promise<any>
    set: (key: string, value: any) => Promise<void>
    remove: (key: string) => Promise<void>
    clear: () => Promise<void>
  }
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

// Event types
export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

export interface VoiceRecognitionEvent {
  transcript: string
  confidence: number
  isFinal: boolean
}

export interface AudioLevelEvent {
  level: number
  timestamp: number
}

// Component prop types
export interface LoadingScreenProps {
  className?: string
}

export interface WindowControlsProps {
  className?: string
}

export interface VoiceButtonProps {
  className?: string
}

export interface SettingsButtonProps {
  className?: string
}

export interface ChatInterfaceProps {
  className?: string
}

export interface ChatMessagesProps {
  messages: Message[]
  className?: string
}

export interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export interface SessionSidebarProps {
  className?: string
}

// Global declarations
declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}