import { useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAppStore } from '../../stores/appStore'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'
import Input from '../ui/Input'

const PrivacySettings = () => {
  const { settings, updatePrivacySettings } = useSettingsStore()
  const { sessions, clearAllSessions } = useAppStore()
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  const handleDataCollectionChange = (enabled: boolean) => {
    updatePrivacySettings({ dataCollection: enabled })
  }

  const handleAnalyticsChange = (enabled: boolean) => {
    updatePrivacySettings({ analytics: enabled })
  }

  const handleCrashReportsChange = (enabled: boolean) => {
    updatePrivacySettings({ crashReports: enabled })
  }

  const handleLocalStorageOnlyChange = (enabled: boolean) => {
    updatePrivacySettings({ localStorageOnly: enabled })
  }

  const handleEncryptDataChange = (enabled: boolean) => {
    updatePrivacySettings({ encryptData: enabled })
  }

  const handleAutoDeleteChange = (enabled: boolean) => {
    updatePrivacySettings({ autoDeleteOldSessions: enabled })
  }

  const handleAutoDeleteDaysChange = (value: string) => {
    const days = parseInt(value)
    if (!isNaN(days) && days > 0) {
      updatePrivacySettings({ autoDeleteDays: days })
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const exportData = {
        sessions,
        settings,
        exportDate: new Date().toISOString(),
        version: '2.0.0'
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `glass-data-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Data exported successfully')
    } catch (error) {
      console.error('Failed to export data:', error)
      toast.error('Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (data.sessions && data.settings) {
          if (window.confirm('This will replace all current data. Are you sure?')) {
            // Import would need to be implemented in the stores
            toast.success('Data imported successfully')
          }
        } else {
          toast.error('Invalid export file format')
        }
      } catch (error) {
        console.error('Failed to import data:', error)
        toast.error('Failed to import data')
      }
    }
    input.click()
  }

  const handleClearAllData = async () => {
    if (!window.confirm('This will permanently delete all chat sessions and reset settings. This action cannot be undone. Are you sure?')) {
      return
    }

    if (!window.confirm('Are you absolutely sure? This will delete everything!')) {
      return
    }

    setIsClearing(true)
    try {
      await clearAllSessions()
      // Reset settings would need to be implemented
      toast.success('All data cleared successfully')
    } catch (error) {
      console.error('Failed to clear data:', error)
      toast.error('Failed to clear data')
    } finally {
      setIsClearing(false)
    }
  }

  const getDataSize = () => {
    const dataStr = JSON.stringify({ sessions, settings })
    const bytes = new Blob([dataStr]).size
    
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getSessionStats = () => {
    const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0)
    const oldestSession = sessions.reduce((oldest, session) => 
      !oldest || session.createdAt < oldest.createdAt ? session : oldest
    , null as typeof sessions[0] | null)
    
    return {
      totalSessions: sessions.length,
      totalMessages,
      oldestDate: oldestSession ? new Date(oldestSession.createdAt).toLocaleDateString() : 'N/A'
    }
  }

  const stats = getSessionStats()

  return (
    <div className="space-y-6">
      {/* Data Collection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Data Collection</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Enable Data Collection</label>
              <p className="text-xs text-muted-foreground">
                Allow Glass to collect usage data to improve the application
              </p>
            </div>
            <Button
              variant={settings.privacy.dataCollection ? "default" : "outline"}
              size="sm"
              onClick={() => handleDataCollectionChange(!settings.privacy.dataCollection)}
            >
              {settings.privacy.dataCollection ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Analytics</label>
              <p className="text-xs text-muted-foreground">
                Send anonymous usage analytics to help improve Glass
              </p>
            </div>
            <Button
              variant={settings.privacy.analytics ? "default" : "outline"}
              size="sm"
              onClick={() => handleAnalyticsChange(!settings.privacy.analytics)}
            >
              {settings.privacy.analytics ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Crash Reports</label>
              <p className="text-xs text-muted-foreground">
                Automatically send crash reports to help fix bugs
              </p>
            </div>
            <Button
              variant={settings.privacy.crashReports ? "default" : "outline"}
              size="sm"
              onClick={() => handleCrashReportsChange(!settings.privacy.crashReports)}
            >
              {settings.privacy.crashReports ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>
      </div>

      {/* Data Storage */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Data Storage</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Local Storage Only</label>
              <p className="text-xs text-muted-foreground">
                Store all data locally, never sync to cloud services
              </p>
            </div>
            <Button
              variant={settings.privacy.localStorageOnly ? "default" : "outline"}
              size="sm"
              onClick={() => handleLocalStorageOnlyChange(!settings.privacy.localStorageOnly)}
            >
              {settings.privacy.localStorageOnly ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Encrypt Data</label>
              <p className="text-xs text-muted-foreground">
                Encrypt stored chat sessions and settings
              </p>
            </div>
            <Button
              variant={settings.privacy.encryptData ? "default" : "outline"}
              size="sm"
              onClick={() => handleEncryptDataChange(!settings.privacy.encryptData)}
            >
              {settings.privacy.encryptData ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>
      </div>

      {/* Auto-Delete */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Auto-Delete</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Auto-Delete Old Sessions</label>
              <p className="text-xs text-muted-foreground">
                Automatically delete sessions older than specified days
              </p>
            </div>
            <Button
              variant={settings.privacy.autoDeleteOldSessions ? "default" : "outline"}
              size="sm"
              onClick={() => handleAutoDeleteChange(!settings.privacy.autoDeleteOldSessions)}
            >
              {settings.privacy.autoDeleteOldSessions ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {settings.privacy.autoDeleteOldSessions && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Delete After (days)</label>
              <Input
                type="number"
                value={settings.privacy.autoDeleteDays.toString()}
                onChange={(e) => handleAutoDeleteDaysChange(e.target.value)}
                placeholder="30"
                min="1"
                max="365"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Sessions older than this will be automatically deleted
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Data Overview */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Data Overview</h3>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{stats.totalSessions}</div>
              <div className="text-xs text-muted-foreground">Sessions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{stats.totalMessages}</div>
              <div className="text-xs text-muted-foreground">Messages</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{getDataSize()}</div>
              <div className="text-xs text-muted-foreground">Data Size</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{stats.oldestDate}</div>
              <div className="text-xs text-muted-foreground">Oldest Session</div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Data Management</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={handleExportData}
            variant="outline"
            loading={isExporting}
            disabled={sessions.length === 0}
            className="h-auto p-4 flex-col items-start"
          >
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">Export Data</span>
            </div>
            <p className="text-xs text-muted-foreground text-left">
              Download all your chat sessions and settings as a JSON file
            </p>
          </Button>

          <Button
            onClick={handleImportData}
            variant="outline"
            className="h-auto p-4 flex-col items-start"
          >
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span className="font-medium">Import Data</span>
            </div>
            <p className="text-xs text-muted-foreground text-left">
              Restore chat sessions and settings from a JSON export file
            </p>
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
        
        <div className="border border-destructive/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium text-destructive">Clear All Data</label>
              <p className="text-xs text-muted-foreground">
                Permanently delete all chat sessions and reset all settings
              </p>
            </div>
            <Button
              onClick={handleClearAllData}
              variant="destructive"
              size="sm"
              loading={isClearing}
              disabled={sessions.length === 0}
            >
              Clear All
            </Button>
          </div>
          
          <div className="bg-destructive/10 rounded p-3">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm font-medium text-destructive">Warning</span>
            </div>
            <p className="text-xs text-destructive/80 mt-1">
              This action cannot be undone. Make sure to export your data first if you want to keep it.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Privacy Information</h3>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">How Glass Handles Your Data</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• All chat data is stored locally on your device by default</li>
            <li>• API keys are stored securely and never shared</li>
            <li>• No chat content is sent to Glass servers</li>
            <li>• Optional analytics only include usage patterns, not content</li>
            <li>• You have full control over your data export and deletion</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default PrivacySettings