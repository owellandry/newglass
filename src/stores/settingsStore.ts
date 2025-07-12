import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import toast from 'react-hot-toast'

import type { SettingsState, AppSettings, DeepPartial } from '../types'

interface SettingsStore extends SettingsState {
  // Actions
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
  updateSettings: (updates: DeepPartial<AppSettings>) => void
  resetSettings: () => void
  setLoading: (loading: boolean) => void
  setDirty: (dirty: boolean) => void
  setError: (error: string | null) => void
  
  // Specific setting updates
  updateAISettings: (updates: Partial<AppSettings['ai']>) => void
  updateAPIKey: (provider: string, key: string) => void
  updateUISettings: (updates: Partial<AppSettings['ui']>) => void
  updateAudioSettings: (updates: Partial<AppSettings['audio']>) => void
  updateShortcuts: (updates: Partial<AppSettings['shortcuts']>) => void
  updatePrivacySettings: (updates: Partial<AppSettings['privacy']>) => void
  updateAdvancedSettings: (updates: Partial<AppSettings['advanced']>) => void
}

const defaultSettings: AppSettings = {
  ai: {
    defaultProvider: 'openrouter',
    defaultModel: 'openai/gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful AI assistant.',
    streamResponses: true,
  },
  apiKeys: {
    openrouter: '',
  },
  ui: {
    theme: 'system',
    fontSize: 'medium',
    compactMode: false,
    showTimestamps: true,
    showTokenCounts: false,
    showCosts: false,
  },
  audio: {
    enabled: true,
    volume: 0.8,
    autoPlay: false,
  },
  shortcuts: {
    toggleListening: 'Ctrl+Space',
    sendMessage: 'Enter',
    newSession: 'Ctrl+N',
    openSettings: 'Ctrl+,',
  },
  privacy: {
    saveConversations: true,
    shareAnalytics: false,
    clearDataOnExit: false,
  },
  advanced: {
    enableDebugMode: false,
    maxHistorySize: 100,
    autoSaveInterval: 30000, // 30 seconds
  },
}

const initialState: SettingsState = {
  settings: defaultSettings,
  isLoading: false,
  isDirty: false,
  error: null,
}

// Helper function to check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.electronAPI && 
         window.electronAPI.store;
}

export const useSettingsStore = create<SettingsStore>(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Load settings from storage
        loadSettings: async () => {
          try {
            set((state) => {
              state.isLoading = true
              state.error = null
            })

            let stored = null;
            
            if (isElectron()) {
              // Load from Electron store
              stored = await window.electronAPI.store.get('settings')
            } else {
              // Load from localStorage in web mode
              const storedJson = localStorage.getItem('settings-store')
              if (storedJson) {
                try {
                  const parsed = JSON.parse(storedJson)
                  stored = parsed.state?.settings
                } catch (e) {
                  console.error('Failed to parse settings from localStorage:', e)
                }
              }
            }

            if (stored) {
              // Merge with defaults to ensure all properties exist
              const mergedSettings = mergeDeep(defaultSettings, stored)
              set((state) => {
                state.settings = mergedSettings
              })
            }

            set((state) => {
              state.isLoading = false
              state.isDirty = false
            })
          } catch (error) {
            console.error('Failed to load settings:', error)
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to load settings'
              state.isLoading = false
            })
          }
        },

        // Save settings to storage
        saveSettings: async () => {
          try {
            const { settings } = get()
            
            if (isElectron()) {
              // Save to Electron store
              await window.electronAPI.store.set('settings', settings)
            } else {
              // In web mode, persist middleware will handle saving to localStorage
              // This is just for showing success message and consistency with Electron mode
              const settingsJson = JSON.stringify({ settings })
              localStorage.setItem('settings-web-backup', settingsJson)
            }
            
            set((state) => {
              state.isDirty = false
              state.error = null
            })

            toast.success('Settings saved successfully')
          } catch (error) {
            console.error('Failed to save settings:', error)
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to save settings'
            })
            toast.error('Failed to save settings')
          }
        },

        // Update settings with deep merge
        updateSettings: (updates) => {
          set((state) => {
            state.settings = mergeDeep(state.settings, updates)
            state.isDirty = true
            state.error = null
          })
        },

        // Reset to default settings
        resetSettings: () => {
          set((state) => {
            state.settings = { ...defaultSettings }
            state.isDirty = true
            state.error = null
          })
          toast.success('Settings reset to defaults')
        },

        setLoading: (loading) => {
          set((state) => {
            state.isLoading = loading
          })
        },

        setDirty: (dirty) => {
          set((state) => {
            state.isDirty = dirty
          })
        },

        setError: (error) => {
          set((state) => {
            state.error = error
          })
        },

        // Specific setting updates
        updateAISettings: (updates) => {
          set((state) => {
            state.settings.ai = { ...state.settings.ai, ...updates }
            state.isDirty = true
          })
        },

        updateAPIKey: (provider, key) => {
          set((state) => {
            state.settings.apiKeys[provider] = key
            state.isDirty = true
          })
        },

        updateUISettings: (updates) => {
          set((state) => {
            state.settings.ui = { ...state.settings.ui, ...updates }
            state.isDirty = true
          })
        },

        updateAudioSettings: (updates) => {
          set((state) => {
            state.settings.audio = { ...state.settings.audio, ...updates }
            state.isDirty = true
          })
        },

        updateShortcuts: (updates) => {
          set((state) => {
            state.settings.shortcuts = { ...state.settings.shortcuts, ...updates }
            state.isDirty = true
          })
        },

        updatePrivacySettings: (updates) => {
          set((state) => {
            state.settings.privacy = { ...state.settings.privacy, ...updates }
            state.isDirty = true
          })
        },

        updateAdvancedSettings: (updates) => {
          set((state) => {
            state.settings.advanced = { ...state.settings.advanced, ...updates }
            state.isDirty = true
          })
        },
      })),
      {
        name: 'settings-store',
        partialize: (state) => ({
          settings: state.settings,
        }),
      }
    ),
    {
      name: 'settings-store',
    }
  )
)

// Helper function for deep merging objects
function mergeDeep<T extends Record<string, any>>(target: T, source: DeepPartial<T>): T {
  const result = { ...target }
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (isObject(target[key]) && isObject(source[key])) {
        result[key] = mergeDeep(target[key], source[key] as any)
      } else {
        result[key] = source[key] as any
      }
    }
  }
  
  return result
}

function isObject(item: any): item is Record<string, any> {
  return item && typeof item === 'object' && !Array.isArray(item)
}

// Export default settings for use in other components
export { defaultSettings }