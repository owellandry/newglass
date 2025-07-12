import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'

const AboutSettings = () => {
  const [appInfo, setAppInfo] = useState({
    name: 'Glass V2',
    version: '2.0.0',
    buildDate: new Date().toISOString().split('T')[0],
    electronVersion: '',
    chromeVersion: '',
    nodeVersion: ''
  })

  const [updateInfo, setUpdateInfo] = useState({
    available: false,
    version: '',
    checking: false
  })

  useEffect(() => {
    // Get version information from Electron if available
    if (window.electronAPI) {
      window.electronAPI.app.getVersion().then((version: string) => {
        setAppInfo(prev => ({ ...prev, version }))
      }).catch(() => {})

      window.electronAPI.app.getVersions().then((versions: any) => {
        setAppInfo(prev => ({
          ...prev,
          electronVersion: versions.electron || '',
          chromeVersion: versions.chrome || '',
          nodeVersion: versions.node || ''
        }))
      }).catch(() => {})
    }
  }, [])

  const handleCheckForUpdates = async () => {
    setUpdateInfo(prev => ({ ...prev, checking: true }))
    
    try {
      if (window.electronAPI) {
        const updateAvailable = await window.electronAPI.app.checkForUpdates()
        setUpdateInfo({
          available: updateAvailable.available,
          version: updateAvailable.version || '',
          checking: false
        })
        
        if (updateAvailable.available) {
          toast.success(`Update available: v${updateAvailable.version}`)
        } else {
          toast.success('You are running the latest version')
        }
      } else {
        // For web version, check GitHub releases or similar
        toast.info('Update checking not available in web version')
        setUpdateInfo(prev => ({ ...prev, checking: false }))
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      toast.error('Failed to check for updates')
      setUpdateInfo(prev => ({ ...prev, checking: false }))
    }
  }

  const handleOpenGitHub = () => {
    if (window.electronAPI) {
      window.electronAPI.shell.openExternal('https://github.com/yourusername/glass-v2')
    } else {
      window.open('https://github.com/yourusername/glass-v2', '_blank')
    }
  }

  const handleOpenLicense = () => {
    if (window.electronAPI) {
      window.electronAPI.shell.openExternal('https://github.com/yourusername/glass-v2/blob/main/LICENSE')
    } else {
      window.open('https://github.com/yourusername/glass-v2/blob/main/LICENSE', '_blank')
    }
  }

  const handleOpenDocs = () => {
    if (window.electronAPI) {
      window.electronAPI.shell.openExternal('https://glass-v2.docs.com')
    } else {
      window.open('https://glass-v2.docs.com', '_blank')
    }
  }

  const handleCopySystemInfo = () => {
    const systemInfo = {
      app: appInfo,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timestamp: new Date().toISOString()
    }
    
    const infoText = JSON.stringify(systemInfo, null, 2)
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(infoText).then(() => {
        toast.success('System information copied to clipboard')
      }).catch(() => {
        toast.error('Failed to copy system information')
      })
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = infoText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast.success('System information copied to clipboard')
    }
  }

  const contributors = [
    {
      name: 'Your Name',
      role: 'Lead Developer',
      avatar: '👨‍💻',
      github: 'yourusername'
    },
    {
      name: 'AI Assistant',
      role: 'Code Assistant',
      avatar: '🤖',
      github: null
    }
  ]

  const technologies = [
    { name: 'React', version: '18.x', description: 'UI Framework' },
    { name: 'TypeScript', version: '5.x', description: 'Type Safety' },
    { name: 'Electron', version: appInfo.electronVersion, description: 'Desktop Framework' },
    { name: 'Tailwind CSS', version: '3.x', description: 'Styling' },
    { name: 'Zustand', version: '4.x', description: 'State Management' },
    { name: 'React Hot Toast', version: '2.x', description: 'Notifications' }
  ]

  return (
    <div className="space-y-6">
      {/* App Information */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{appInfo.name}</h1>
            <p className="text-muted-foreground">AI-Powered Chat Interface</p>
          </div>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Version</span>
            <span className="text-sm text-muted-foreground">{appInfo.version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Build Date</span>
            <span className="text-sm text-muted-foreground">{appInfo.buildDate}</span>
          </div>
          {appInfo.electronVersion && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Electron</span>
              <span className="text-sm text-muted-foreground">{appInfo.electronVersion}</span>
            </div>
          )}
          {appInfo.chromeVersion && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Chrome</span>
              <span className="text-sm text-muted-foreground">{appInfo.chromeVersion}</span>
            </div>
          )}
          {appInfo.nodeVersion && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Node.js</span>
              <span className="text-sm text-muted-foreground">{appInfo.nodeVersion}</span>
            </div>
          )}
        </div>
      </div>

      {/* Updates */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Updates</h3>
        
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div className="space-y-1">
            <p className="text-sm font-medium">Check for Updates</p>
            <p className="text-xs text-muted-foreground">
              {updateInfo.available 
                ? `Update available: v${updateInfo.version}`
                : 'You are running the latest version'
              }
            </p>
          </div>
          <Button
            onClick={handleCheckForUpdates}
            loading={updateInfo.checking}
            variant="outline"
            size="sm"
          >
            {updateInfo.checking ? 'Checking...' : 'Check for Updates'}
          </Button>
        </div>
      </div>

      {/* Links */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Links</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            onClick={handleOpenGitHub}
            variant="outline"
            className="h-auto p-4 flex-col items-start"
          >
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="font-medium">GitHub</span>
            </div>
            <p className="text-xs text-muted-foreground text-left">
              View source code and contribute
            </p>
          </Button>

          <Button
            onClick={handleOpenDocs}
            variant="outline"
            className="h-auto p-4 flex-col items-start"
          >
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="font-medium">Documentation</span>
            </div>
            <p className="text-xs text-muted-foreground text-left">
              Learn how to use Glass V2
            </p>
          </Button>

          <Button
            onClick={handleOpenLicense}
            variant="outline"
            className="h-auto p-4 flex-col items-start"
          >
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium">License</span>
            </div>
            <p className="text-xs text-muted-foreground text-left">
              View license information
            </p>
          </Button>
        </div>
      </div>

      {/* Technologies */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Built With</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {technologies.map((tech, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-medium">{tech.name}</p>
                <p className="text-xs text-muted-foreground">{tech.description}</p>
              </div>
              {tech.version && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {tech.version}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contributors */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Contributors</h3>
        
        <div className="space-y-3">
          {contributors.map((contributor, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
              <div className="text-2xl">{contributor.avatar}</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{contributor.name}</p>
                <p className="text-xs text-muted-foreground">{contributor.role}</p>
              </div>
              {contributor.github && (
                <Button
                  onClick={() => {
                    const url = `https://github.com/${contributor.github}`
                    if (window.electronAPI) {
                      window.electronAPI.shell.openExternal(url)
                    } else {
                      window.open(url, '_blank')
                    }
                  }}
                  variant="ghost"
                  size="sm"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* System Information */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">System Information</h3>
          <Button
            onClick={handleCopySystemInfo}
            variant="outline"
            size="sm"
          >
            Copy Info
          </Button>
        </div>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Platform:</span>
            <span className="text-muted-foreground">{navigator.platform}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Language:</span>
            <span className="text-muted-foreground">{navigator.language}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">User Agent:</span>
            <span className="text-muted-foreground text-right text-xs max-w-xs truncate">
              {navigator.userAgent}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-6 border-t border-border/50">
        <p className="text-sm text-muted-foreground">
          Made with ❤️ for the AI community
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          © 2024 Glass V2. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default AboutSettings