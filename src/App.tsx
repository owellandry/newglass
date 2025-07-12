import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'

// Components
import MainWindow from './components/MainWindow'
import SettingsWindow from './components/SettingsWindow'
import LoadingScreen from './components/LoadingScreen'

// Hooks
import { useAppStore } from './stores/appStore'
import { useSettingsStore } from './stores/settingsStore'
import { useAIStore } from './stores/aiStore'

// Utils
import { cn } from './lib/utils'

function App() {
  const location = useLocation()
  const { isLoading, initialize } = useAppStore()
  const { loadSettings } = useSettingsStore()
  const { initializeAI } = useAIStore()

  // Initialize app on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load settings first
        await loadSettings()
        
        // Initialize AI services
        await initializeAI()
        
        // Mark app as initialized
        await initialize()
      } catch (error) {
        console.error('Failed to initialize app:', error)
        // Show error toast or handle error appropriately
      }
    }

    initApp()
  }, [])

  // Show loading screen while initializing
  if (isLoading) {
    return <LoadingScreen />
  }

  // Determine which window to show based on route
  const isSettingsRoute = location.pathname.includes('/settings')

  return (
    <div className={cn(
      "min-h-screen transition-all duration-300",
      isSettingsRoute ? "bg-background" : "bg-transparent"
    )}>
      <Routes>
        <Route path="/" element={<MainWindow />} />
        <Route path="/settings" element={<SettingsWindow />} />
        <Route path="/settings/*" element={<SettingsWindow />} />
      </Routes>
      
      {/* Global toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
          success: {
            iconTheme: {
              primary: 'hsl(var(--primary))',
              secondary: 'hsl(var(--primary-foreground))',
            },
          },
          error: {
            iconTheme: {
              primary: 'hsl(var(--destructive))',
              secondary: 'hsl(var(--destructive-foreground))',
            },
          },
        }}
      />
    </div>
  )
}

export default App