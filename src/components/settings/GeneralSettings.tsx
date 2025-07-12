import { useSettingsStore } from '../../stores/settingsStore'
import { cn } from '../../lib/utils'

// Components
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

const GeneralSettings = () => {
  const { settings, updateUISettings, updateAdvancedSettings } = useSettingsStore()

  const themeOptions = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'System' }
  ]

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' }
  ]

  const handleThemeChange = (theme: string) => {
    updateUISettings({ theme: theme as 'dark' | 'light' | 'system' })
  }

  const handleLanguageChange = (language: string) => {
    updateUISettings({ language })
  }

  const handleCompactModeChange = (enabled: boolean) => {
    updateUISettings({ compactMode: enabled })
  }

  const handleShowTimestampsChange = (enabled: boolean) => {
    updateUISettings({ showTimestamps: enabled })
  }

  const handleShowTokenCountsChange = (enabled: boolean) => {
    updateUISettings({ showTokenCounts: enabled })
  }

  const handleShowCostsChange = (enabled: boolean) => {
    updateUISettings({ showCosts: enabled })
  }

  const handleAutoSaveChange = (enabled: boolean) => {
    updateAdvancedSettings({ autoSave: enabled })
  }

  const handleAutoSaveIntervalChange = (interval: string) => {
    const value = parseInt(interval)
    if (!isNaN(value) && value > 0) {
      updateAdvancedSettings({ autoSaveInterval: value })
    }
  }

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Appearance</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <Select
              value={settings.ui.theme}
              onChange={handleThemeChange}
              options={themeOptions}
              placeholder="Select theme"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <Select
              value={settings.ui.language}
              onChange={handleLanguageChange}
              options={languageOptions}
              placeholder="Select language"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Compact Mode</label>
              <p className="text-xs text-muted-foreground">
                Use a more compact layout to fit more content
              </p>
            </div>
            <Button
              variant={settings.ui.compactMode ? "default" : "outline"}
              size="sm"
              onClick={() => handleCompactModeChange(!settings.ui.compactMode)}
            >
              {settings.ui.compactMode ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>
      </div>

      {/* Display Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Display Options</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Show Timestamps</label>
              <p className="text-xs text-muted-foreground">
                Display timestamps for each message
              </p>
            </div>
            <Button
              variant={settings.ui.showTimestamps ? "default" : "outline"}
              size="sm"
              onClick={() => handleShowTimestampsChange(!settings.ui.showTimestamps)}
            >
              {settings.ui.showTimestamps ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Show Token Counts</label>
              <p className="text-xs text-muted-foreground">
                Display token usage for each message
              </p>
            </div>
            <Button
              variant={settings.ui.showTokenCounts ? "default" : "outline"}
              size="sm"
              onClick={() => handleShowTokenCountsChange(!settings.ui.showTokenCounts)}
            >
              {settings.ui.showTokenCounts ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Show Costs</label>
              <p className="text-xs text-muted-foreground">
                Display estimated costs for each message
              </p>
            </div>
            <Button
              variant={settings.ui.showCosts ? "default" : "outline"}
              size="sm"
              onClick={() => handleShowCostsChange(!settings.ui.showCosts)}
            >
              {settings.ui.showCosts ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>
      </div>

      {/* Auto-save */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Auto-save</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Enable Auto-save</label>
              <p className="text-xs text-muted-foreground">
                Automatically save chat sessions
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Auto-save Interval (seconds)</label>
              <Input
                type="number"
                value={settings.advanced.autoSaveInterval.toString()}
                onChange={(e) => handleAutoSaveIntervalChange(e.target.value)}
                placeholder="30"
                min="5"
                max="300"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                How often to save sessions (5-300 seconds)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Performance</h3>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Performance Tips</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• Enable compact mode for better performance with many messages</li>
            <li>• Disable token counts and costs if not needed</li>
            <li>• Use shorter auto-save intervals only if necessary</li>
            <li>• Clear old sessions regularly to improve performance</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default GeneralSettings