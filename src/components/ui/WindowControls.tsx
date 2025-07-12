import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import Button from './Button'

const WindowControls = () => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  // Check if running in Electron and if window is maximized on mount
  useEffect(() => {
    // Check if we're running in Electron
    const electronAvailable = typeof window !== 'undefined' && 
                             window.electronAPI && 
                             window.electronAPI.window;
    
    setIsElectron(electronAvailable);
    
    if (!electronAvailable) {
      console.log('Running in web mode - window controls are simulated');
      return;
    }
    
    const checkMaximized = async () => {
      try {
        const maximized = await window.electronAPI.window.isMaximized()
        setIsMaximized(maximized)
      } catch (error) {
        console.error('Failed to check window state:', error)
      }
    }

    checkMaximized()
  }, [])

  const handleMinimize = async () => {
    if (!isElectron) {
      console.log('Minimize clicked (web mode - no action)');
      return;
    }
    
    try {
      await window.electronAPI.window.minimize()
    } catch (error) {
      console.error('Failed to minimize window:', error)
    }
  }

  const handleMaximize = async () => {
    if (!isElectron) {
      console.log('Maximize/restore clicked (web mode - no action)');
      setIsMaximized(!isMaximized); // Just toggle state for UI in web mode
      return;
    }
    
    try {
      if (isMaximized) {
        await window.electronAPI.window.unmaximize()
        setIsMaximized(false)
      } else {
        await window.electronAPI.window.maximize()
        setIsMaximized(true)
      }
    } catch (error) {
      console.error('Failed to toggle maximize:', error)
    }
  }

  const handleClose = async () => {
    if (!isElectron) {
      console.log('Close clicked (web mode - no action)');
      // In web mode, we could potentially navigate away or show a dialog
      if (confirm('Do you want to close the application?')) {
        window.close(); // This may not work in all browsers due to security restrictions
      }
      return;
    }
    
    try {
      await window.electronAPI.window.close()
    } catch (error) {
      console.error('Failed to close window:', error)
    }
  }

  return (
    <div className="flex items-center space-x-1 no-drag">
      {/* Minimize */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMinimize}
        className={cn(
          "h-8 w-8 hover:bg-accent/50 transition-colors",
          "focus:ring-1 focus:ring-ring focus:ring-offset-0"
        )}
        title="Minimize"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </Button>

      {/* Maximize/Restore */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMaximize}
        className={cn(
          "h-8 w-8 hover:bg-accent/50 transition-colors",
          "focus:ring-1 focus:ring-ring focus:ring-offset-0"
        )}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          // Restore icon
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ) : (
          // Maximize icon
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        )}
      </Button>

      {/* Close */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className={cn(
          "h-8 w-8 hover:bg-destructive hover:text-destructive-foreground transition-colors",
          "focus:ring-1 focus:ring-ring focus:ring-offset-0"
        )}
        title="Close"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </div>
  )
}

export default WindowControls