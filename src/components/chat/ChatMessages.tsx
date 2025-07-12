import { useState } from 'react'
import { cn } from '../../lib/utils'
import { formatRelativeTime, copyToClipboard } from '../../lib/utils'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import type { ChatMessage } from '../../types'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'

interface ChatMessagesProps {
  messages: ChatMessage[]
  sessionId: string
}

const ChatMessages = ({ messages, sessionId }: ChatMessagesProps) => {
  const { settings } = useSettingsStore()
  const { deleteMessage } = useAppStore()
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null)

  const handleCopyMessage = async (content: string) => {
    const success = await copyToClipboard(content)
    if (success) {
      toast.success('Message copied to clipboard')
    } else {
      toast.error('Failed to copy message')
    }
  }

  const handleDeleteMessage = (messageId: string) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      deleteMessage(sessionId, messageId)
      toast.success('Message deleted')
    }
  }

  const handleRegenerateResponse = async (messageIndex: number) => {
    // Find the user message that prompted this response
    const userMessage = messages[messageIndex - 1]
    if (userMessage && userMessage.role === 'user') {
      // Delete the current assistant message
      const assistantMessage = messages[messageIndex]
      deleteMessage(sessionId, assistantMessage.id)
      
      // Resend the user message to get a new response
      // This would trigger the AI to generate a new response
      toast.success('Regenerating response...')
    }
  }

  if (messages.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 p-4">
      {messages.map((message, index) => {
        const isUser = message.role === 'user'
        const isSystem = message.role === 'system'
        const isAssistant = message.role === 'assistant'
        const isHovered = hoveredMessage === message.id
        const canRegenerate = isAssistant && index > 0 && messages[index - 1]?.role === 'user'

        return (
          <div
            key={message.id}
            className={cn(
              "group relative flex gap-3 transition-all duration-200",
              isUser && "flex-row-reverse",
              isSystem && "justify-center"
            )}
            onMouseEnter={() => setHoveredMessage(message.id)}
            onMouseLeave={() => setHoveredMessage(null)}
          >
            {/* Avatar */}
            {!isSystem && (
              <div className={cn(
                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {isUser ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
              </div>
            )}

            {/* Message content */}
            <div className={cn(
              "flex-1 min-w-0",
              isUser && "flex justify-end",
              isSystem && "flex justify-center"
            )}>
              <div className={cn(
                "relative max-w-[80%] rounded-lg px-4 py-3 text-sm",
                "transition-all duration-200",
                isUser && "bg-primary text-primary-foreground",
                isAssistant && "bg-muted/50 text-foreground border border-border/50",
                isSystem && "bg-muted/30 text-muted-foreground text-xs max-w-md text-center",
                isHovered && !isSystem && "shadow-md"
              )}>
                {/* Message text */}
                <div className={cn(
                  "whitespace-pre-wrap break-words",
                  isSystem && "italic"
                )}>
                  {message.content}
                </div>

                {/* Metadata */}
                {!isSystem && (
                  <div className={cn(
                    "flex items-center justify-between mt-2 pt-2 border-t border-current/10 text-xs opacity-70",
                    settings.ui.showTimestamps || settings.ui.showTokenCounts || settings.ui.showCosts
                  )}>
                    <div className="flex items-center space-x-2">
                      {settings.ui.showTimestamps && (
                        <span>{formatRelativeTime(message.timestamp)}</span>
                      )}
                      
                      {message.metadata?.model && (
                        <>
                          {settings.ui.showTimestamps && <span>•</span>}
                          <span>{message.metadata.model.split('/').pop()}</span>
                        </>
                      )}
                    </div>
                    
                    {message.metadata && (settings.ui.showTokenCounts || settings.ui.showCosts) && (
                      <div className="flex items-center space-x-2">
                        {settings.ui.showTokenCounts && message.metadata.tokens && (
                          <span>
                            {message.metadata.tokens.input + message.metadata.tokens.output} tokens
                          </span>
                        )}
                        
                        {settings.ui.showCosts && message.metadata.cost && (
                          <>
                            {settings.ui.showTokenCounts && <span>•</span>}
                            <span>${message.metadata.cost.toFixed(4)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                {!isSystem && isHovered && (
                  <div className={cn(
                    "absolute -top-2 flex items-center space-x-1 bg-background border border-border rounded-lg shadow-lg p-1",
                    isUser ? "-left-2" : "-right-2"
                  )}>
                    {/* Copy button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyMessage(message.content)}
                      className="h-6 w-6 hover:bg-accent"
                      title="Copy message"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </Button>

                    {/* Regenerate button (only for assistant messages) */}
                    {canRegenerate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRegenerateResponse(index)}
                        className="h-6 w-6 hover:bg-accent"
                        title="Regenerate response"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </Button>
                    )}

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMessage(message.id)}
                      className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                      title="Delete message"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ChatMessages