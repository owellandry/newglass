import { useState, useEffect, useRef } from 'react'
import { cn } from '../lib/utils'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAIStore } from '../stores/aiStore'

// Components
import ChatInterface from './chat/ChatInterface'
import SessionSidebar from './chat/SessionSidebar'
import WindowControls from './ui/WindowControls'
import VoiceButton from './ui/VoiceButton'
import SettingsButton from './ui/SettingsButton'

const MainWindow = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCompact, setIsCompact] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)
  
  const { currentSession, isListening, isProcessing } = useAppStore()
  const { settings } = useSettingsStore()
  const { currentModel, isStreaming } = useAIStore()

  // Handle window resize for compact mode
  useEffect(() => {
    const handleResize = () => {
      if (mainRef.current) {
        const { width } = mainRef.current.getBoundingClientRect()
        setIsCompact(width < 800)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-hide sidebar in compact mode
  useEffect(() => {
    if (isCompact) {
      setSidebarOpen(false)
    }
  }, [isCompact])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar with Ctrl+B
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        setSidebarOpen(prev => !prev)
      }
      
      // New session with Ctrl+N
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        const newSession = useAppStore.getState().createSession()
        useAppStore.getState().setCurrentSession(newSession)
      }
      
      // Open settings with Ctrl+,
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        window.electronAPI.window.openSettings()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div 
      ref={mainRef}
      className={cn(
        "h-screen flex bg-transparent overflow-hidden",
        "transition-all duration-300"
      )}
    >
      {/* Sidebar */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        sidebarOpen ? "w-80" : "w-0",
        "flex-shrink-0 overflow-hidden"
      )}>
        <SessionSidebar 
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between p-4",
          "bg-background/80 backdrop-blur-md border-b border-border/50",
          "drag-region"
        )}>
          {/* Left side */}
          <div className="flex items-center space-x-3">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                "p-2 rounded-lg transition-colors no-drag",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring"
              )}
              title="Toggle sidebar (Ctrl+B)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Session info */}
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium truncate max-w-48">
                {currentSession?.title || 'No session'}
              </span>
            </div>
          </div>

          {/* Center - Model info */}
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            {currentModel && (
              <>
                <span>{currentModel.name}</span>
                {(isListening || isProcessing || isStreaming) && (
                  <>
                    <span>•</span>
                    <span className={cn(
                      "flex items-center space-x-1",
                      isListening && "text-blue-500",
                      isProcessing && "text-yellow-500",
                      isStreaming && "text-green-500"
                    )}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      <span>
                        {isListening && 'Listening'}
                        {isProcessing && 'Processing'}
                        {isStreaming && 'Streaming'}
                      </span>
                    </span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-2">
            {/* Voice button */}
            <VoiceButton />
            
            {/* Settings button */}
            <SettingsButton />
            
            {/* Window controls */}
            <WindowControls />
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 min-h-0">
          <ChatInterface />
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && isCompact && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}

export default MainWindow