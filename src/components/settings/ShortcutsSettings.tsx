import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'
import Input from '../ui/Input'

interface ShortcutItem {
  id: string
  name: string
  description: string
  defaultKeys: string
  currentKeys: string
  category: string
}

const ShortcutsSettings = () => {
  const { settings, updateShortcutsSettings } = useSettingsStore()
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null)
  const [recordingKeys, setRecordingKeys] = useState<string[]>([])
  const [isRecording, setIsRecording] = useState(false)

  const shortcuts: ShortcutItem[] = [
    {
      id: 'toggleSidebar',
      name: 'Toggle Sidebar',
      description: 'Show or hide the session sidebar',
      defaultKeys: 'Ctrl+B',
      currentKeys: settings.shortcuts.toggleSidebar,
      category: 'Navigation'
    },
    {
      id: 'newSession',
      name: 'New Session',
      description: 'Create a new chat session',
      defaultKeys: 'Ctrl+N',
      currentKeys: settings.shortcuts.newSession,
      category: 'Session'
    },
    {
      id: 'openSettings',
      name: 'Open Settings',
      description: 'Open the settings window',
      defaultKeys: 'Ctrl+,',
      currentKeys: settings.shortcuts.openSettings,
      category: 'Navigation'
    },
    {
      id: 'saveSession',
      name: 'Save Session',
      description: 'Save the current session',
      defaultKeys: 'Ctrl+S',
      currentKeys: settings.shortcuts.saveSession,
      category: 'Session'
    },
    {
      id: 'toggleVoice',
      name: 'Toggle Voice Recording',
      description: 'Start or stop voice recording',
      defaultKeys: 'Ctrl+Space',
      currentKeys: settings.shortcuts.toggleVoice,
      category: 'Voice'
    },
    {
      id: 'sendMessage',
      name: 'Send Message',
      description: 'Send the current message',
      defaultKeys: 'Enter',
      currentKeys: settings.shortcuts.sendMessage,
      category: 'Chat'
    },
    {
      id: 'newLine',
      name: 'New Line',
      description: 'Insert a new line in message input',
      defaultKeys: 'Shift+Enter',
      currentKeys: settings.shortcuts.newLine,
      category: 'Chat'
    },
    {
      id: 'clearChat',
      name: 'Clear Chat',
      description: 'Clear all messages in current session',
      defaultKeys: 'Ctrl+Shift+Delete',
      currentKeys: settings.shortcuts.clearChat,
      category: 'Session'
    },
    {
      id: 'focusInput',
      name: 'Focus Input',
      description: 'Focus the message input field',
      defaultKeys: 'Ctrl+L',
      currentKeys: settings.shortcuts.focusInput,
      category: 'Navigation'
    },
    {
      id: 'toggleFullscreen',
      name: 'Toggle Fullscreen',
      description: 'Enter or exit fullscreen mode',
      defaultKeys: 'F11',
      currentKeys: settings.shortcuts.toggleFullscreen,
      category: 'Window'
    }
  ]

  const categories = [...new Set(shortcuts.map(s => s.category))]

  // Handle keyboard recording
  useEffect(() => {
    if (!isRecording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const keys: string[] = []
      if (e.ctrlKey) keys.push('Ctrl')
      if (e.altKey) keys.push('Alt')
      if (e.shiftKey) keys.push('Shift')
      if (e.metaKey) keys.push('Meta')

      // Add the main key if it's not a modifier
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        keys.push(e.key === ' ' ? 'Space' : e.key)
      }

      setRecordingKeys(keys)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        // Finish recording when a non-modifier key is released
        setIsRecording(false)
        if (recordingKeys.length > 0) {
          handleSaveShortcut(recordingKeys.join('+'))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [isRecording, recordingKeys])

  const handleEditShortcut = (shortcutId: string) => {
    setEditingShortcut(shortcutId)
    setRecordingKeys([])
    setIsRecording(true)
  }

  const handleSaveShortcut = (keys: string) => {
    if (!editingShortcut) return

    // Check for conflicts
    const existingShortcut = shortcuts.find(s => 
      s.id !== editingShortcut && s.currentKeys === keys
    )

    if (existingShortcut) {
      toast.error(`Shortcut "${keys}" is already used by "${existingShortcut.name}"`)
      handleCancelEdit()
      return
    }

    updateShortcutsSettings({ [editingShortcut]: keys })
    toast.success('Shortcut updated')
    handleCancelEdit()
  }

  const handleCancelEdit = () => {
    setEditingShortcut(null)
    setRecordingKeys([])
    setIsRecording(false)
  }

  const handleResetShortcut = (shortcutId: string) => {
    const shortcut = shortcuts.find(s => s.id === shortcutId)
    if (shortcut) {
      updateShortcutsSettings({ [shortcutId]: shortcut.defaultKeys })
      toast.success('Shortcut reset to default')
    }
  }

  const handleResetAllShortcuts = () => {
    if (window.confirm('Are you sure you want to reset all shortcuts to their defaults?')) {
      const defaultShortcuts = shortcuts.reduce((acc, shortcut) => {
        acc[shortcut.id] = shortcut.defaultKeys
        return acc
      }, {} as Record<string, string>)
      
      updateShortcutsSettings(defaultShortcuts)
      toast.success('All shortcuts reset to defaults')
    }
  }

  const formatKeys = (keys: string) => {
    return keys.split('+').map(key => {
      // Normalize key names for display
      switch (key) {
        case 'Meta': return '⌘'
        case 'Ctrl': return 'Ctrl'
        case 'Alt': return 'Alt'
        case 'Shift': return 'Shift'
        case 'Space': return 'Space'
        case 'Enter': return 'Enter'
        case 'Escape': return 'Esc'
        case 'Delete': return 'Del'
        case 'Backspace': return 'Backspace'
        case 'Tab': return 'Tab'
        case 'ArrowUp': return '↑'
        case 'ArrowDown': return '↓'
        case 'ArrowLeft': return '←'
        case 'ArrowRight': return '→'
        default: return key.toUpperCase()
      }
    }).join(' + ')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <p className="text-sm text-muted-foreground">
            Customize keyboard shortcuts for faster navigation
          </p>
        </div>
        <Button
          onClick={handleResetAllShortcuts}
          variant="outline"
          size="sm"
        >
          Reset All
        </Button>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording shortcut...</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Press the key combination you want to use
            {recordingKeys.length > 0 && (
              <span className="ml-2 font-mono bg-muted px-2 py-1 rounded">
                {formatKeys(recordingKeys.join('+'))}
              </span>
            )}
          </p>
          <Button
            onClick={handleCancelEdit}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Shortcuts by category */}
      {categories.map(category => {
        const categoryShortcuts = shortcuts.filter(s => s.category === category)
        
        return (
          <div key={category} className="space-y-4">
            <h4 className="text-md font-medium text-muted-foreground">{category}</h4>
            
            <div className="space-y-2">
              {categoryShortcuts.map(shortcut => {
                const isEditing = editingShortcut === shortcut.id
                const isDefault = shortcut.currentKeys === shortcut.defaultKeys
                
                return (
                  <div
                    key={shortcut.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-all",
                      isEditing ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{shortcut.name}</span>
                        {!isDefault && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Modified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {shortcut.description}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="font-mono text-sm bg-muted px-3 py-1 rounded border">
                          {formatKeys(shortcut.currentKeys)}
                        </div>
                        {!isDefault && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Default: {formatKeys(shortcut.defaultKeys)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          onClick={() => handleEditShortcut(shortcut.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit shortcut"
                          disabled={isRecording}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        
                        {!isDefault && (
                          <Button
                            onClick={() => handleResetShortcut(shortcut.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Reset to default"
                            disabled={isRecording}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Tips */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-muted-foreground">Tips</h4>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Shortcut Tips</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• Click the edit button and press your desired key combination</li>
            <li>• Use Ctrl/Cmd + letter for global shortcuts</li>
            <li>• Function keys (F1-F12) work well for less common actions</li>
            <li>• Avoid conflicts with browser shortcuts (Ctrl+T, Ctrl+W, etc.)</li>
            <li>• Some shortcuts may not work in all contexts</li>
          </ul>
        </div>
      </div>

      {/* Conflicts warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm font-medium text-yellow-800">Important</span>
        </div>
        <p className="text-xs text-yellow-700 mt-1">
          Some shortcuts may conflict with your browser or operating system shortcuts. 
          If a shortcut doesn't work, try using a different key combination.
        </p>
      </div>
    </div>
  )
}

export default ShortcutsSettings