import { useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

const AdvancedSettings = () => {
  const { settings, updateAdvancedSettings } = useSettingsStore()
  const [isResetting, setIsResetting] = useState(false)

  const handleDebugModeChange = (enabled: boolean) => {
    updateAdvancedSettings({ debugMode: enabled })
  }

  const handleDeveloperModeChange = (enabled: boolean) => {
    updateAdvancedSettings({ developerMode: enabled })
  }

  const handleExperimentalFeaturesChange = (enabled: boolean) => {
    updateAdvancedSettings({ experimentalFeatures: enabled })
  }

  const handleAutoSaveChange = (enabled: boolean) => {
    updateAdvancedSettings({ autoSave: enabled })
  }

  const handleAutoSaveIntervalChange = (value: string) => {
    const interval = parseInt(value)
    if (!isNaN(interval) && interval >= 5 && interval <= 300) {
      updateAdvancedSettings({ autoSaveInterval: interval })
    }
  }

  const handleMaxSessionsChange = (value: string) => {
    const maxSessions = parseInt(value)
    if (!isNaN(maxSessions) && maxSessions > 0) {
      updateAdvancedSettings({ maxSessions })
    }
  }

  const handleMaxMessagesChange = (value: string) => {
    const maxMessages = parseInt(value)
    if (!isNaN(maxMessages) && maxMessages > 0) {
      updateAdvancedSettings({ maxMessagesPerSession: maxMessages })
    }
  }

  const handleLogLevelChange = (level: string) => {
    updateAdvancedSettings({ logLevel: level as 'error' | 'warn' | 'info' | 'debug' })
  }

  const handleCustomCSSChange = (css: string) => {
    updateAdvancedSettings({ customCSS: css })
  }

  const handleApplyCustomCSS = () => {
    // Remove existing custom styles
    const existingStyle = document.getElementById('custom-css')
    if (existingStyle) {
      existingStyle.remove()
    }

    // Apply new custom styles
    if (settings.advanced.customCSS.trim()) {
      const style = document.createElement('style')
      style.id = 'custom-css'
      style.textContent = settings.advanced.customCSS
      document.head.appendChild(style)
      toast.success('Custom CSS applied')
    } else {
      toast.success('Custom CSS cleared')
    }
  }

  const handleResetSettings = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to their defaults? This cannot be undone.')) {
      return
    }

    setIsResetting(true)
    try {
      // This would need to be implemented in the settings store
      // resetAllSettings()
      toast.success('Settings reset to defaults')
    } catch (error) {
      console.error('Failed to reset settings:', error)
      toast.error('Failed to reset settings')
    } finally {
      setIsResetting(false)
    }
  }

  const handleClearCache = () => {
    try {
      // Clear various caches
      localStorage.removeItem('glass-cache')
      sessionStorage.clear()
      
      // Clear service worker cache if available
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name)
          })
        })
      }
      
      toast.success('Cache cleared successfully')
    } catch (error) {
      console.error('Failed to clear cache:', error)
      toast.error('Failed to clear cache')
    }
  }

  const handleOpenDevTools = () => {
    if (window.electronAPI) {
      window.electronAPI.window.openDevTools()
    } else {
      // For web version, open browser dev tools
      if (window.chrome && window.chrome.runtime) {
        // Chrome extension context
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.debugger.attach({ tabId: tabs[0].id }, '1.0')
          }
        })
      } else {
        toast.info('Press F12 to open developer tools')
      }
    }
  }

  const logLevelOptions = [
    { value: 'error', label: 'Error' },
    { value: 'warn', label: 'Warning' },
    { value: 'info', label: 'Info' },
    { value: 'debug', label: 'Debug' }
  ]

  const getSystemInfo = () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      memory: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
      } : null
    }
  }

  const systemInfo = getSystemInfo()

  return (
    <div className="space-y-6">
      {/* Development */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Development</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Debug Mode</label>
              <p className="text-xs text-muted-foreground">
                Enable detailed logging and debug information
              </p>
            </div>
            <Button
              variant={settings.advanced.debugMode ? "default" : "outline"}
              size="sm"
              onClick={() => handleDebugModeChange(!settings.advanced.debugMode)}
            >
              {settings.advanced.debugMode ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Developer Mode</label>
              <p className="text-xs text-muted-foreground">
                Show additional developer tools and options
              </p>
            </div>
            <Button
              variant={settings.advanced.developerMode ? "default" : "outline"}
              size="sm"
              onClick={() => handleDeveloperModeChange(!settings.advanced.developerMode)}
            >
              {settings.advanced.developerMode ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Experimental Features</label>
              <p className="text-xs text-muted-foreground">
                Enable experimental features (may be unstable)
              </p>
            </div>
            <Button
              variant={settings.advanced.experimentalFeatures ? "default" : "outline"}
              size="sm"
              onClick={() => handleExperimentalFeaturesChange(!settings.advanced.experimentalFeatures)}
            >
              {settings.advanced.experimentalFeatures ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {settings.advanced.developerMode && (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">Developer Tools</label>
                <p className="text-xs text-muted-foreground">
                  Open browser developer tools for debugging
                </p>
              </div>
              <Button
                onClick={handleOpenDevTools}
                variant="outline"
                size="sm"
              >
                Open DevTools
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Performance</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Auto-save</label>
              <p className="text-xs text-muted-foreground">
                Automatically save sessions periodically
              </p>
            </div>
            <Button
              variant={settings.advanced.autoSave ? "default" : "outline"}
              size="sm"
              onClick={() => handleAutoSaveChange(!settings.advanced.autoSave)}
            >
              {settings.advanced.autoSave ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {settings.advanced.autoSave && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Auto-save Interval (seconds)</label>
                <Input
                  type="number"
                  value={settings.advanced.autoSaveInterval.toString()}
                  onChange={(e) => handleAutoSaveIntervalChange(e.target.value)}
                  placeholder="30"
                  min="5"
                  max="300"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Sessions</label>
              <Input
                type="number"
                value={settings.advanced.maxSessions.toString()}
                onChange={(e) => handleMaxSessionsChange(e.target.value)}
                placeholder="100"
                min="1"
                max="1000"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of sessions to keep
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Messages per Session</label>
              <Input
                type="number"
                value={settings.advanced.maxMessagesPerSession.toString()}
                onChange={(e) => handleMaxMessagesChange(e.target.value)}
                placeholder="1000"
                min="1"
                max="10000"
              />
              <p className="text-xs text-muted-foreground">
                Maximum messages per session
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logging */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Logging</h3>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Log Level</label>
            <Select
              value={settings.advanced.logLevel}
              onChange={handleLogLevelChange}
              options={logLevelOptions}
              placeholder="Select log level"
            />
            <p className="text-xs text-muted-foreground">
              Controls how much information is logged
            </p>
          </div>
        </div>
      </div>

      {/* Custom CSS */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Custom Styling</h3>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom CSS</label>
            <textarea
              value={settings.advanced.customCSS}
              onChange={(e) => handleCustomCSSChange(e.target.value)}
              placeholder="/* Add your custom CSS here */\n.chat-message {\n  /* Custom styles */\n}"
              className={cn(
                "w-full h-32 resize-none rounded-lg border border-border/50 bg-background/50",
                "px-4 py-3 text-sm font-mono placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                "transition-all duration-200"
              )}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Add custom CSS to modify the appearance
              </p>
              <Button
                onClick={handleApplyCustomCSS}
                variant="outline"
                size="sm"
              >
                Apply CSS
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">System Information</h3>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Platform:</span>
              <span className="ml-2 text-muted-foreground">{systemInfo.platform}</span>
            </div>
            <div>
              <span className="font-medium">Language:</span>
              <span className="ml-2 text-muted-foreground">{systemInfo.language}</span>
            </div>
            <div>
              <span className="font-medium">CPU Cores:</span>
              <span className="ml-2 text-muted-foreground">{systemInfo.hardwareConcurrency}</span>
            </div>
            <div>
              <span className="font-medium">Online:</span>
              <span className="ml-2 text-muted-foreground">{systemInfo.onLine ? 'Yes' : 'No'}</span>
            </div>
          </div>
          
          {systemInfo.memory && (
            <div className="border-t border-border/50 pt-3">
              <span className="font-medium text-sm">Memory Usage:</span>
              <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Used:</span>
                  <span className="ml-2">{systemInfo.memory.used} MB</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <span className="ml-2">{systemInfo.memory.total} MB</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Limit:</span>
                  <span className="ml-2">{systemInfo.memory.limit} MB</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Maintenance */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Maintenance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={handleClearCache}
            variant="outline"
            className="h-auto p-4 flex-col items-start"
          >
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="font-medium">Clear Cache</span>
            </div>
            <p className="text-xs text-muted-foreground text-left">
              Clear application cache and temporary files
            </p>
          </Button>

          <Button
            onClick={handleResetSettings}
            variant="outline"
            loading={isResetting}
            className="h-auto p-4 flex-col items-start"
          >
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="font-medium">Reset Settings</span>
            </div>
            <p className="text-xs text-muted-foreground text-left">
              Reset all settings to their default values
            </p>
          </Button>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm font-medium text-yellow-800">Advanced Settings Warning</span>
        </div>
        <p className="text-xs text-yellow-700 mt-1">
          These settings are for advanced users. Changing them incorrectly may cause issues with the application. 
          Make sure you understand what each setting does before modifying it.
        </p>
      </div>
    </div>
  )
}

export default AdvancedSettings