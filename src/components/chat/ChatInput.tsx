import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/appStore'
import { useAIStore } from '../../stores/aiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'

interface ChatInputProps {
  sessionId: string
  disabled?: boolean
  placeholder?: string
}

const ChatInput = ({ sessionId, disabled = false, placeholder = "Type your message..." }: ChatInputProps) => {
  const [message, setMessage] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { currentSession, addMessage } = useAppStore()
  const { sendMessage, sendStreamingMessage, isStreaming, stopStreaming } = useAIStore()
  const { settings } = useSettingsStore()

  const isProcessing = isStreaming
  const canSend = message.trim().length > 0 && !disabled && !isProcessing

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [message])

  // Focus textarea when session changes
  useEffect(() => {
    if (textareaRef.current && sessionId) {
      textareaRef.current.focus()
    }
  }, [sessionId])

  const handleSubmit = async () => {
    if (!canSend || !currentSession) return

    const messageText = message.trim()
    setMessage('')

    try {
      // Add user message to the session
      addMessage(sessionId, {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        content: messageText,
        timestamp: Date.now()
      })

      // Send message to AI
      if (settings.ai.streamingEnabled) {
        await sendStreamingMessage(sessionId, messageText)
      } else {
        await sendMessage(sessionId, messageText)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message. Please try again.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleStop = () => {
    stopStreaming()
    toast.success('Stopped generating response')
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Handle potential file uploads in the future
    const items = Array.from(e.clipboardData.items)
    const hasFiles = items.some(item => item.kind === 'file')
    
    if (hasFiles) {
      e.preventDefault()
      toast.error('File uploads are not supported yet')
    }
  }

  return (
    <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="p-4">
        <div className="relative flex items-end space-x-2">
          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onPaste={handlePaste}
              placeholder={disabled ? "Select a session to start chatting..." : placeholder}
              disabled={disabled}
              className={cn(
                "w-full resize-none rounded-lg border border-border/50 bg-background/50",
                "px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                "transition-all duration-200",
                "min-h-[44px] max-h-[200px]",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              rows={1}
            />
            
            {/* Character count */}
            {message.length > 0 && (
              <div className="absolute bottom-1 right-1 text-xs text-muted-foreground bg-background/80 px-1 rounded">
                {message.length}
              </div>
            )}
          </div>

          {/* Send/Stop button */}
          <div className="flex items-center space-x-2">
            {isProcessing ? (
              <Button
                onClick={handleStop}
                variant="outline"
                size="icon"
                className="h-11 w-11 border-destructive/50 hover:bg-destructive hover:text-destructive-foreground"
                title="Stop generating"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canSend}
                size="icon"
                className="h-11 w-11"
                title={canSend ? "Send message (Enter)" : "Type a message to send"}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            )}
          </div>
        </div>

        {/* Input hints */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>Press Enter to send, Shift+Enter for new line</span>
            {settings.ai.streamingEnabled && (
              <span className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Streaming enabled</span>
              </span>
            )}
          </div>
          
          {currentSession && (
            <div className="flex items-center space-x-2">
              <span>Model: {currentSession.settings.model.split('/').pop()}</span>
              <span>•</span>
              <span>Temp: {currentSession.settings.temperature}</span>
              {currentSession.settings.maxTokens && (
                <>
                  <span>•</span>
                  <span>Max: {currentSession.settings.maxTokens}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatInput