import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/appStore'
import { useAIStore } from '../../stores/aiStore'
import { useSettingsStore } from '../../stores/settingsStore'

// Components
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'
import EmptyState from './EmptyState'

const ChatInterface = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const { currentSession, isProcessing } = useAppStore()
  const { isStreaming, sendMessage, sendStreamingMessage } = useAIStore()
  const { settings } = useSettingsStore()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAtBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [currentSession?.messages, isAtBottom])

  // Handle scroll to detect if user is at bottom
  const handleScroll = () => {
    if (!containerRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const threshold = 100 // pixels from bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold
    
    setIsAtBottom(atBottom)
  }

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsAtBottom(true)
  }

  // Handle sending message
  const handleSendMessage = async (content: string) => {
    if (!currentSession || !content.trim()) return

    try {
      if (settings.ai.streamResponses) {
        await sendStreamingMessage(currentSession.id, content.trim())
      } else {
        await sendMessage(currentSession.id, content.trim())
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  // Show empty state if no session or no messages
  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState 
          title="No Session Selected"
          description="Create a new session or select an existing one to start chatting."
          action={
            <button
              onClick={() => {
                const newSession = useAppStore.getState().createSession()
                useAppStore.getState().setCurrentSession(newSession)
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create New Session
            </button>
          }
        />
      </div>
    )
  }

  const hasMessages = currentSession.messages.length > 0

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Messages area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        onScroll={handleScroll}
      >
        {hasMessages ? (
          <div className="min-h-full flex flex-col">
            <div className="flex-1" />
            <ChatMessages 
              messages={currentSession.messages}
              sessionId={currentSession.id}
            />
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <EmptyState 
              title="Start a Conversation"
              description="Send a message to begin chatting with the AI assistant."
            />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && hasMessages && (
        <div className="absolute bottom-20 right-6 z-10">
          <button
            onClick={scrollToBottom}
            className={cn(
              "p-2 bg-background/80 backdrop-blur-sm border border-border rounded-full",
              "shadow-lg hover:bg-accent transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring"
            )}
            title="Scroll to bottom"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}

      {/* Input area */}
      <div className={cn(
        "border-t border-border/50 bg-background/80 backdrop-blur-md",
        "p-4 space-y-3"
      )}>
        {/* Status indicators */}
        {(isProcessing || isStreaming) && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="flex space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                  style={{
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '1s'
                  }}
                />
              ))}
            </div>
            <span>
              {isStreaming ? 'AI is responding...' : 'Processing your message...'}
            </span>
          </div>
        )}

        {/* Chat input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={isProcessing || isStreaming}
          placeholder="Type your message..."
        />

        {/* Model info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            <span>Model: {currentSession.settings.model}</span>
            <span>•</span>
            <span>Temp: {currentSession.settings.temperature}</span>
            <span>•</span>
            <span>Max tokens: {currentSession.settings.maxTokens}</span>
          </div>
          
          {settings.ui.showTokenCounts && currentSession.metadata && (
            <div className="flex items-center space-x-2">
              <span>Tokens: {currentSession.metadata.totalTokens}</span>
              {settings.ui.showCosts && (
                <>
                  <span>•</span>
                  <span>Cost: ${currentSession.metadata.totalCost.toFixed(4)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatInterface