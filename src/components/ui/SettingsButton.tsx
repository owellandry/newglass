import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import Button from './Button'

const SettingsButton = () => {
  const [isElectron, setIsElectron] = useState(false)
  const navigate = useNavigate()

  // Check if running in Electron
  useEffect(() => {
    const electronAvailable = typeof window !== 'undefined' && 
                             window.electronAPI && 
                             window.electronAPI.window;
    
    setIsElectron(electronAvailable);
  }, [])

  const handleOpenSettings = async () => {
    if (!isElectron) {
      // In web mode, navigate to settings page using React Router
      console.log('Opening settings in web mode');
      navigate('/settings');
      return;
    }

    try {
      await window.electronAPI.window.openSettings()
    } catch (error) {
      console.error('Failed to open settings:', error)
      // Fallback to React Router if Electron API fails
      navigate('/settings');
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleOpenSettings}
      className={cn(
        "h-8 w-8 hover:bg-accent/50 transition-colors",
        "focus:ring-1 focus:ring-ring focus:ring-offset-0"
      )}
      title="Open settings (Ctrl+,)"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
        />
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
        />
      </svg>
    </Button>
  )
}

export default SettingsButton