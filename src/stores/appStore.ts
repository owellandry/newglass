import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import toast from 'react-hot-toast'

import type { AppState, ChatSession, ChatMessage } from '../types'
import { generateId } from '../lib/utils'

interface AppStore extends AppState {
  // Actions
  initialize: () => Promise<void>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Session management
  createSession: (title?: string) => ChatSession
  setCurrentSession: (session: ChatSession | null) => void
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void
  deleteSession: (sessionId: string) => void
  loadSessions: () => Promise<void>
  saveSessions: () => Promise<void>
  
  // Message management
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void
  deleteMessage: (sessionId: string, messageId: string) => void
  clearMessages: (sessionId: string) => void
  
  // Audio/Recording
  setListening: (listening: boolean) => void
  setProcessing: (processing: boolean) => void
  
  // Utility
  reset: () => void
}

const initialState: AppState = {
  isLoading: true,
  isInitialized: false,
  currentSession: null,
  sessions: [],
  isListening: false,
  isProcessing: false,
  error: null,
}

// Helper function to check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.electronAPI && 
         window.electronAPI.store;
}

export const useAppStore = create<AppStore>(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Initialize app
        initialize: async () => {
          try {
            set((state) => {
              state.isLoading = true
              state.error = null
            })

            // Load sessions from storage
            await get().loadSessions()

            // Create default session if none exist
            const { sessions } = get()
            if (sessions.length === 0) {
              const defaultSession = get().createSession('New Conversation')
              set((state) => {
                state.currentSession = defaultSession
              })
            } else {
              // Set the most recent session as current
              const mostRecent = sessions.sort((a, b) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              )[0]
              set((state) => {
                state.currentSession = mostRecent
              })
            }

            set((state) => {
              state.isInitialized = true
              state.isLoading = false
            })

            toast.success('App initialized successfully')
          } catch (error) {
            console.error('Failed to initialize app:', error)
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to initialize app'
              state.isLoading = false
            })
            toast.error('Failed to initialize app')
          }
        },

        setLoading: (loading) => {
          set((state) => {
            state.isLoading = loading
          })
        },

        setError: (error) => {
          set((state) => {
            state.error = error
          })
        },

        // Session management
        createSession: (title = 'New Conversation') => {
          const newSession: ChatSession = {
            id: generateId(12),
            title,
            messages: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            settings: {
              model: 'gpt-3.5-turbo',
              provider: 'openrouter',
              temperature: 0.7,
              maxTokens: 2048,
            },
            metadata: {
              totalTokens: 0,
              totalCost: 0,
              messageCount: 0,
            },
          }

          set((state) => {
            state.sessions.unshift(newSession)
          })

          // Save to storage
          get().saveSessions()

          return newSession
        },

        setCurrentSession: (session) => {
          set((state) => {
            state.currentSession = session
          })
        },

        updateSession: (sessionId, updates) => {
          set((state) => {
            const sessionIndex = state.sessions.findIndex(s => s.id === sessionId)
            if (sessionIndex !== -1) {
              state.sessions[sessionIndex] = {
                ...state.sessions[sessionIndex],
                ...updates,
                updatedAt: new Date(),
              }
              
              // Update current session if it's the one being updated
              if (state.currentSession?.id === sessionId) {
                state.currentSession = state.sessions[sessionIndex]
              }
            }
          })

          // Save to storage
          get().saveSessions()
        },

        deleteSession: (sessionId) => {
          set((state) => {
            state.sessions = state.sessions.filter(s => s.id !== sessionId)
            
            // Clear current session if it was deleted
            if (state.currentSession?.id === sessionId) {
              state.currentSession = state.sessions[0] || null
            }
          })

          // Save to storage
          get().saveSessions()
          toast.success('Session deleted')
        },

        loadSessions: async () => {
          try {
            let stored = null;
            
            if (isElectron()) {
              // Load from Electron store
              stored = await window.electronAPI.store.get('sessions')
            } else {
              // Load from localStorage in web mode
              const storedJson = localStorage.getItem('app-store')
              if (storedJson) {
                try {
                  const parsed = JSON.parse(storedJson)
                  stored = parsed.state?.sessions
                } catch (e) {
                  console.error('Failed to parse sessions from localStorage:', e)
                }
              }
            }
            
            if (stored && Array.isArray(stored)) {
              set((state) => {
                state.sessions = stored.map(session => ({
                  ...session,
                  createdAt: new Date(session.createdAt),
                  updatedAt: new Date(session.updatedAt),
                  messages: session.messages.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp),
                  })),
                }))
              })
            }
          } catch (error) {
            console.error('Failed to load sessions:', error)
          }
        },

        saveSessions: async () => {
          try {
            const { sessions } = get()
            
            if (isElectron()) {
              // Save to Electron store
              await window.electronAPI.store.set('sessions', sessions)
            } else {
              // In web mode, persist middleware will handle saving to localStorage
              // This is just for backup and consistency with Electron mode
              const sessionsJson = JSON.stringify({ sessions })
              localStorage.setItem('sessions-web-backup', sessionsJson)
            }
          } catch (error) {
            console.error('Failed to save sessions:', error)
          }
        },

        // Message management
        addMessage: (sessionId, messageData) => {
          const message: ChatMessage = {
            ...messageData,
            id: generateId(8),
            timestamp: new Date(),
          }

          set((state) => {
            const sessionIndex = state.sessions.findIndex(s => s.id === sessionId)
            if (sessionIndex !== -1) {
              state.sessions[sessionIndex].messages.push(message)
              state.sessions[sessionIndex].updatedAt = new Date()
              state.sessions[sessionIndex].metadata!.messageCount += 1
              
              // Update current session if it's the one being updated
              if (state.currentSession?.id === sessionId) {
                state.currentSession = state.sessions[sessionIndex]
              }
            }
          })

          // Save to storage
          get().saveSessions()
        },

        updateMessage: (sessionId, messageId, updates) => {
          set((state) => {
            const sessionIndex = state.sessions.findIndex(s => s.id === sessionId)
            if (sessionIndex !== -1) {
              const messageIndex = state.sessions[sessionIndex].messages.findIndex(m => m.id === messageId)
              if (messageIndex !== -1) {
                state.sessions[sessionIndex].messages[messageIndex] = {
                  ...state.sessions[sessionIndex].messages[messageIndex],
                  ...updates,
                }
                state.sessions[sessionIndex].updatedAt = new Date()
                
                // Update current session if it's the one being updated
                if (state.currentSession?.id === sessionId) {
                  state.currentSession = state.sessions[sessionIndex]
                }
              }
            }
          })

          // Save to storage
          get().saveSessions()
        },

        deleteMessage: (sessionId, messageId) => {
          set((state) => {
            const sessionIndex = state.sessions.findIndex(s => s.id === sessionId)
            if (sessionIndex !== -1) {
              state.sessions[sessionIndex].messages = state.sessions[sessionIndex].messages.filter(m => m.id !== messageId)
              state.sessions[sessionIndex].updatedAt = new Date()
              state.sessions[sessionIndex].metadata!.messageCount -= 1
              
              // Update current session if it's the one being updated
              if (state.currentSession?.id === sessionId) {
                state.currentSession = state.sessions[sessionIndex]
              }
            }
          })

          // Save to storage
          get().saveSessions()
        },

        clearMessages: (sessionId) => {
          set((state) => {
            const sessionIndex = state.sessions.findIndex(s => s.id === sessionId)
            if (sessionIndex !== -1) {
              state.sessions[sessionIndex].messages = []
              state.sessions[sessionIndex].updatedAt = new Date()
              state.sessions[sessionIndex].metadata = {
                totalTokens: 0,
                totalCost: 0,
                messageCount: 0,
              }
              
              // Update current session if it's the one being updated
              if (state.currentSession?.id === sessionId) {
                state.currentSession = state.sessions[sessionIndex]
              }
            }
          })

          // Save to storage
          get().saveSessions()
          toast.success('Messages cleared')
        },

        // Audio/Recording
        setListening: (listening) => {
          set((state) => {
            state.isListening = listening
          })
        },

        setProcessing: (processing) => {
          set((state) => {
            state.isProcessing = processing
          })
        },

        // Utility
        reset: () => {
          set(() => ({ ...initialState }))
        },
      })),
      {
        name: 'app-store',
        partialize: (state) => ({
          // Only persist sessions, not UI state
          sessions: state.sessions,
        }),
      }
    ),
    {
      name: 'app-store',
    }
  )
)