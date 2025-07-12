import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { cn } from '../lib/utils'
import { useSettingsStore } from '../stores/settingsStore'

// Components
import WindowControls from './ui/WindowControls'
import Button from './ui/Button'

// Settings panels
import GeneralSettings from './settings/GeneralSettings'
import AISettings from './settings/AISettings'
import AudioSettings from './settings/AudioSettings'
import ShortcutsSettings from './settings/ShortcutsSettings'
import PrivacySettings from './settings/PrivacySettings'
import AdvancedSettings from './settings/AdvancedSettings'
import AboutSettings from './settings/AboutSettings'

interface SettingsTab {
  id: string
  label: string
  icon: string
  component: React.ComponentType
}

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    component: GeneralSettings,
  },
  {
    id: 'ai',
    label: 'AI & Models',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    component: AISettings,
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 7h4l5-5v20l-5-5H5a2 2 0 01-2-2V9a2 2 0 012-2z',
    component: AudioSettings,
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    component: ShortcutsSettings,
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    component: PrivacySettings,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    component: AdvancedSettings,
  },
  {
    id: 'about',
    label: 'About',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    component: AboutSettings,
  },
]

const SettingsWindow = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDirty, saveSettings, loadSettings } = useSettingsStore()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Get current tab from URL
  const currentTab = location.pathname.split('/').pop() || 'general'

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(isDirty)
  }, [isDirty])

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    navigate(`/settings/${tabId}`)
  }

  // Handle save
  const handleSave = async () => {
    await saveSettings()
    setHasUnsavedChanges(false)
  }

  // Handle close
  const handleClose = () => {
    if (hasUnsavedChanges) {
      const shouldSave = window.confirm('You have unsaved changes. Do you want to save them before closing?')
      if (shouldSave) {
        saveSettings().then(() => {
          window.electronAPI.window.closeSettings()
        })
      } else {
        window.electronAPI.window.closeSettings()
      }
    } else {
      window.electronAPI.window.closeSettings()
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save with Ctrl+S
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      
      // Close with Escape
      if (e.key === 'Escape') {
        e.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasUnsavedChanges])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between p-4",
        "border-b border-border drag-region"
      )}>
        <div className="flex items-center space-x-3">
          <h1 className="text-lg font-semibold">Settings</h1>
          {hasUnsavedChanges && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {hasUnsavedChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              className="no-drag"
            >
              Save
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="no-drag"
          >
            Close
          </Button>
          
          <WindowControls />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-muted/30">
          <div className="p-4 space-y-1">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                  currentTab === tab.id && "bg-accent text-accent-foreground"
                )}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <Routes>
              <Route path="/" element={<GeneralSettings />} />
              {SETTINGS_TABS.map((tab) => (
                <Route
                  key={tab.id}
                  path={`/${tab.id}`}
                  element={<tab.component />}
                />
              ))}
            </Routes>
          </div>
        </div>
      </div>

      {/* Footer */}
      {hasUnsavedChanges && (
        <div className={cn(
          "flex items-center justify-between p-4",
          "border-t border-border bg-muted/30"
        )}>
          <p className="text-sm text-muted-foreground">
            You have unsaved changes. Press Ctrl+S to save or Escape to close.
          </p>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Reset to saved settings
                loadSettings()
                setHasUnsavedChanges(false)
              }}
            >
              Discard
            </Button>
            
            <Button
              size="sm"
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsWindow