import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import toast from 'react-hot-toast'

import type { AIState, AIProvider, AIModel, ChatMessage, OpenRouterResponse, OpenRouterStreamChunk } from '../types'
import { useSettingsStore } from './settingsStore'
import { useAppStore } from './appStore'

interface AIStore extends AIState {
  // Actions
  initializeAI: () => Promise<void>
  setCurrentProvider: (provider: AIProvider) => void
  setCurrentModel: (model: AIModel) => void
  setError: (error: string | null) => void
  
  // Chat operations
  sendMessage: (sessionId: string, content: string) => Promise<void>
  sendStreamingMessage: (sessionId: string, content: string) => Promise<void>
  stopStreaming: () => void
  
  // Provider management
  validateApiKey: (provider: string, apiKey: string) => Promise<boolean>
  getAvailableModels: (provider: string) => Promise<AIModel[]>
  
  // Utility
  reset: () => void
}

// OpenRouter models configuration
const OPENROUTER_MODELS: AIModel[] = [
  {
    id: 'openai/gpt-4-turbo-preview',
    name: 'GPT-4 Turbo',
    description: 'Most capable GPT-4 model, optimized for chat',
    contextLength: 128000,
    inputCost: 10,
    outputCost: 30,
    capabilities: ['text', 'function-calling', 'streaming'],
  },
  {
    id: 'openai/gpt-4',
    name: 'GPT-4',
    description: 'High-quality model for complex tasks',
    contextLength: 8192,
    inputCost: 30,
    outputCost: 60,
    capabilities: ['text', 'function-calling', 'streaming'],
  },
  {
    id: 'openai/gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and efficient model for most tasks',
    contextLength: 16385,
    inputCost: 0.5,
    outputCost: 1.5,
    capabilities: ['text', 'function-calling', 'streaming'],
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Most powerful Claude model',
    contextLength: 200000,
    inputCost: 15,
    outputCost: 75,
    capabilities: ['text', 'vision', 'streaming'],
  },
  {
    id: 'anthropic/claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    description: 'Balanced Claude model',
    contextLength: 200000,
    inputCost: 3,
    outputCost: 15,
    capabilities: ['text', 'vision', 'streaming'],
  },
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    description: 'Fast and efficient Claude model',
    contextLength: 200000,
    inputCost: 0.25,
    outputCost: 1.25,
    capabilities: ['text', 'vision', 'streaming'],
  },
  {
    id: 'google/gemini-pro',
    name: 'Gemini Pro',
    description: 'Google\'s most capable model',
    contextLength: 32768,
    inputCost: 0.5,
    outputCost: 1.5,
    capabilities: ['text', 'vision', 'streaming'],
  },
  {
    id: 'meta-llama/llama-2-70b-chat',
    name: 'Llama 2 70B',
    description: 'Open source model from Meta',
    contextLength: 4096,
    inputCost: 0.7,
    outputCost: 0.8,
    capabilities: ['text', 'streaming'],
  },
]

const PROVIDERS: AIProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access to multiple AI models through a single API',
    apiKeyRequired: true,
    models: OPENROUTER_MODELS,
    supportedFeatures: ['chat', 'completion', 'streaming'],
  },
]

const initialState: AIState = {
  providers: PROVIDERS,
  currentProvider: null,
  currentModel: null,
  isStreaming: false,
  streamingMessage: '',
  error: null,
}

export const useAIStore = create<AIStore>(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Initialize AI services
      initializeAI: async () => {
        try {
          const settings = useSettingsStore.getState().settings
          
          // Set default provider
          const defaultProvider = PROVIDERS.find(p => p.id === settings.ai.defaultProvider)
          if (defaultProvider) {
            set((state) => {
              state.currentProvider = defaultProvider
            })
            
            // Set default model
            const defaultModel = defaultProvider.models.find(m => m.id === settings.ai.defaultModel)
            if (defaultModel) {
              set((state) => {
                state.currentModel = defaultModel
              })
            }
          }
          
          set((state) => {
            state.error = null
          })
        } catch (error) {
          console.error('Failed to initialize AI:', error)
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to initialize AI'
          })
        }
      },

      setCurrentProvider: (provider) => {
        set((state) => {
          state.currentProvider = provider
          // Reset model when provider changes
          state.currentModel = provider.models[0] || null
        })
      },

      setCurrentModel: (model) => {
        set((state) => {
          state.currentModel = model
        })
      },

      setError: (error) => {
        set((state) => {
          state.error = error
        })
      },

      // Send a regular (non-streaming) message
      sendMessage: async (sessionId, content) => {
        try {
          const { currentModel, currentProvider } = get()
          const settings = useSettingsStore.getState().settings
          const appStore = useAppStore.getState()
          
          if (!currentModel || !currentProvider) {
            throw new Error('No AI model selected')
          }
          
          if (!settings.apiKeys.openrouter) {
            throw new Error('OpenRouter API key not configured')
          }
          
          // Add user message
          appStore.addMessage(sessionId, {
            role: 'user',
            content,
          })
          
          // Get session messages for context
          const session = appStore.sessions.find(s => s.id === sessionId)
          if (!session) {
            throw new Error('Session not found')
          }
          
          // Prepare messages for API
          const messages = session.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }))
          
          // Add system prompt if configured
          if (settings.ai.systemPrompt) {
            messages.unshift({
              role: 'system',
              content: settings.ai.systemPrompt,
            })
          }
          
          appStore.setProcessing(true)
          
          // Call OpenRouter API
          const response = await window.electronAPI.openrouter.chat(messages, {
            model: currentModel.id,
            temperature: settings.ai.temperature,
            max_tokens: settings.ai.maxTokens,
          })
          
          const result = response as OpenRouterResponse
          
          if (result.choices && result.choices[0]) {
            const assistantMessage = result.choices[0].message.content
            
            // Add assistant message
            appStore.addMessage(sessionId, {
              role: 'assistant',
              content: assistantMessage,
              metadata: {
                model: currentModel.id,
                provider: currentProvider.id,
                tokens: {
                  input: result.usage?.prompt_tokens || 0,
                  output: result.usage?.completion_tokens || 0,
                },
                cost: calculateCost(currentModel, result.usage?.prompt_tokens || 0, result.usage?.completion_tokens || 0),
              },
            })
            
            // Update session metadata
            if (result.usage) {
              const totalTokens = result.usage.total_tokens
              const cost = calculateCost(currentModel, result.usage.prompt_tokens, result.usage.completion_tokens)
              
              appStore.updateSession(sessionId, {
                metadata: {
                  ...session.metadata,
                  totalTokens: (session.metadata?.totalTokens || 0) + totalTokens,
                  totalCost: (session.metadata?.totalCost || 0) + cost,
                },
              })
            }
          }
          
          appStore.setProcessing(false)
        } catch (error) {
          console.error('Failed to send message:', error)
          useAppStore.getState().setProcessing(false)
          set((state) => {
            state.error = error instanceof Error ? error.message : 'Failed to send message'
          })
          toast.error('Failed to send message')
        }
      },

      // Send a streaming message
      sendStreamingMessage: async (sessionId, content) => {
        try {
          const { currentModel, currentProvider } = get()
          const settings = useSettingsStore.getState().settings
          const appStore = useAppStore.getState()
          
          if (!currentModel || !currentProvider) {
            throw new Error('No AI model selected')
          }
          
          if (!settings.apiKeys.openrouter) {
            throw new Error('OpenRouter API key not configured')
          }
          
          // Add user message
          appStore.addMessage(sessionId, {
            role: 'user',
            content,
          })
          
          // Get session messages for context
          const session = appStore.sessions.find(s => s.id === sessionId)
          if (!session) {
            throw new Error('Session not found')
          }
          
          // Prepare messages for API
          const messages = session.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          }))
          
          // Add system prompt if configured
          if (settings.ai.systemPrompt) {
            messages.unshift({
              role: 'system',
              content: settings.ai.systemPrompt,
            })
          }
          
          set((state) => {
            state.isStreaming = true
            state.streamingMessage = ''
          })
          
          appStore.setProcessing(true)
          
          // Create assistant message placeholder
          const assistantMessageId = Date.now().toString()
          appStore.addMessage(sessionId, {
            role: 'assistant',
            content: '',
            metadata: {
              model: currentModel.id,
              provider: currentProvider.id,
            },
          })
          
          // Call OpenRouter streaming API
          const stream = await window.electronAPI.openrouter.stream(messages, {
            model: currentModel.id,
            temperature: settings.ai.temperature,
            max_tokens: settings.ai.maxTokens,
            stream: true,
          })
          
          const reader = stream.getReader()
          let fullContent = ''
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              
              if (done) break
              
              const chunk = new TextDecoder().decode(value)
              const lines = chunk.split('\n').filter(line => line.trim())
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  
                  if (data === '[DONE]') {
                    break
                  }
                  
                  try {
                    const parsed = JSON.parse(data) as OpenRouterStreamChunk
                    const delta = parsed.choices[0]?.delta
                    
                    if (delta?.content) {
                      fullContent += delta.content
                      
                      set((state) => {
                        state.streamingMessage = fullContent
                      })
                      
                      // Update the assistant message
                      const currentSession = appStore.sessions.find(s => s.id === sessionId)
                      if (currentSession) {
                        const lastMessage = currentSession.messages[currentSession.messages.length - 1]
                        if (lastMessage && lastMessage.role === 'assistant') {
                          appStore.updateMessage(sessionId, lastMessage.id, {
                            content: fullContent,
                          })
                        }
                      }
                    }
                  } catch (parseError) {
                    console.warn('Failed to parse streaming chunk:', parseError)
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
          
          set((state) => {
            state.isStreaming = false
            state.streamingMessage = ''
          })
          
          appStore.setProcessing(false)
        } catch (error) {
          console.error('Failed to send streaming message:', error)
          set((state) => {
            state.isStreaming = false
            state.streamingMessage = ''
            state.error = error instanceof Error ? error.message : 'Failed to send streaming message'
          })
          useAppStore.getState().setProcessing(false)
          toast.error('Failed to send streaming message')
        }
      },

      stopStreaming: () => {
        set((state) => {
          state.isStreaming = false
          state.streamingMessage = ''
        })
        useAppStore.getState().setProcessing(false)
      },

      // Validate API key
      validateApiKey: async (provider, apiKey) => {
        try {
          if (provider === 'openrouter') {
            // Test with a simple request
            const response = await window.electronAPI.openrouter.chat(
              [{ role: 'user', content: 'Hello' }],
              {
                model: 'openai/gpt-3.5-turbo',
                max_tokens: 1,
                api_key: apiKey,
              }
            )
            return !!response
          }
          return false
        } catch (error) {
          console.error('API key validation failed:', error)
          return false
        }
      },

      // Get available models for a provider
      getAvailableModels: async (provider) => {
        const providerData = PROVIDERS.find(p => p.id === provider)
        return providerData?.models || []
      },

      reset: () => {
        set(() => ({ ...initialState }))
      },
    })),
    {
      name: 'ai-store',
    }
  )
)

// Helper function to calculate cost
function calculateCost(model: AIModel, inputTokens: number, outputTokens: number): number {
  const inputCost = (model.inputCost || 0) * (inputTokens / 1000000)
  const outputCost = (model.outputCost || 0) * (outputTokens / 1000000)
  return inputCost + outputCost
}

// Export models for use in other components
export { OPENROUTER_MODELS, PROVIDERS }