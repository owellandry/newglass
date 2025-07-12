import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { formatRelativeTime } from '../../lib/utils'
import { useAppStore } from '../../stores/appStore'
import { useAIStore } from '../../stores/aiStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { ChatSession } from '../../types'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'
import Input from '../ui/Input'

interface SessionSidebarProps {
  isVisible: boolean
  onToggle: () => void
  compact?: boolean
}

const SessionSidebar = ({ isVisible, onToggle, compact = false }: SessionSidebarProps) => {
  const { 
    sessions, 
    currentSessionId, 
    createSession, 
    deleteSession, 
    setCurrentSession,
    updateSession
  } = useAppStore()
  const { currentProvider, currentModel } = useAIStore()
  const { settings } = useSettingsStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)

  // Filter sessions based on search query
  const filteredSessions = sessions.filter(session => 
    session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.messages.some(msg => 
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  // Sort sessions by last updated (most recent first)
  const sortedSessions = [...filteredSessions].sort((a, b) => b.updatedAt - a.updatedAt)

  const handleCreateSession = () => {
    if (!currentProvider || !currentModel) {
      toast.error('Please select an AI provider and model first')
      return
    }

    const sessionId = createSession({
      provider: currentProvider,
      model: currentModel,
      temperature: settings.ai.temperature,
      maxTokens: settings.ai.maxTokens,
      systemPrompt: settings.ai.systemPrompt
    })
    
    setCurrentSession(sessionId)
    toast.success('New session created')
  }

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (sessions.length === 1) {
      toast.error('Cannot delete the last session')
      return
    }

    if (window.confirm('Are you sure you want to delete this session?')) {
      deleteSession(sessionId)
      toast.success('Session deleted')
    }
  }

  const handleEditTitle = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(session.id)
    setEditingTitle(session.title)
  }

  const handleSaveTitle = () => {
    if (editingSessionId && editingTitle.trim()) {
      updateSession(editingSessionId, { title: editingTitle.trim() })
      toast.success('Session title updated')
    }
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const handleCancelEdit = () => {
    setEditingSessionId(null)
    setEditingTitle('')
  }

  const getSessionPreview = (session: ChatSession): string => {
    const lastUserMessage = session.messages
      .filter(msg => msg.role === 'user')
      .pop()
    
    return lastUserMessage?.content.slice(0, 100) || 'No messages yet'
  }

  const getSessionStats = (session: ChatSession) => {
    const messageCount = session.messages.length
    const userMessages = session.messages.filter(msg => msg.role === 'user').length
    const assistantMessages = session.messages.filter(msg => msg.role === 'assistant').length
    
    return { messageCount, userMessages, assistantMessages }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        handleCreateSession()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentProvider, currentModel])

  if (!isVisible) {
    return (
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={onToggle}
          variant="outline"
          size="icon"
          className="bg-background/80 backdrop-blur-sm border-border/50 hover:bg-accent"
          title="Show sidebar (Ctrl+B)"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex flex-col bg-background/50 backdrop-blur-sm border-r border-border/50",
      "transition-all duration-300 ease-in-out",
      compact ? "w-64" : "w-80"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h2 className="font-semibold text-sm">Chat Sessions</h2>
        <div className="flex items-center space-x-1">
          <Button
            onClick={handleCreateSession}
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="New session (Ctrl+N)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
          <Button
            onClick={onToggle}
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Hide sidebar (Ctrl+B)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border/50">
        <Input
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto">
        {sortedSessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {searchQuery ? 'No sessions found' : 'No sessions yet'}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {sortedSessions.map((session) => {
              const isActive = session.id === currentSessionId
              const isEditing = editingSessionId === session.id
              const isHovered = hoveredSessionId === session.id
              const stats = getSessionStats(session)
              
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group relative rounded-lg p-3 cursor-pointer transition-all duration-200",
                    "hover:bg-accent/50 border border-transparent",
                    isActive && "bg-primary/10 border-primary/20 shadow-sm"
                  )}
                  onClick={() => !isEditing && setCurrentSession(session.id)}
                  onMouseEnter={() => setHoveredSessionId(session.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                >
                  {/* Session title */}
                  <div className="flex items-center justify-between mb-2">
                    {isEditing ? (
                      <div className="flex-1 flex items-center space-x-2">
                        <Input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onEnter={handleSaveTitle}
                          className="flex-1 h-6 text-sm"
                          autoFocus
                        />
                        <Button
                          onClick={handleSaveTitle}
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className={cn(
                          "font-medium text-sm truncate flex-1",
                          isActive && "text-primary"
                        )}>
                          {session.title}
                        </h3>
                        
                        {(isHovered || isActive) && (
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              onClick={(e) => handleEditTitle(session, e)}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Edit title"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Button>
                            <Button
                              onClick={(e) => handleDeleteSession(session.id, e)}
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                              title="Delete session"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Session preview */}
                  {!compact && (
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {getSessionPreview(session)}
                    </p>
                  )}

                  {/* Session metadata */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-2">
                      <span>{stats.messageCount} msgs</span>
                      <span>•</span>
                      <span>{session.settings.model.split('/').pop()}</span>
                    </div>
                    <span>{formatRelativeTime(session.updatedAt)}</span>
                  </div>

                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Total sessions:</span>
            <span>{sessions.length}</span>
          </div>
          {currentProvider && currentModel && (
            <div className="flex justify-between">
              <span>Current model:</span>
              <span className="truncate ml-2">{currentModel.split('/').pop()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionSidebar