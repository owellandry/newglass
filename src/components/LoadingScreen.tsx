import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'

interface LoadingScreenProps {
  className?: string
}

const LoadingScreen = ({ className }: LoadingScreenProps) => {
  const [dots, setDots] = useState('')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Animate dots
    const dotsInterval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return ''
        return prev + '.'
      })
    }, 500)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        return prev + Math.random() * 10
      })
    }, 200)

    return () => {
      clearInterval(dotsInterval)
      clearInterval(progressInterval)
    }
  }, [])

  return (
    <div className={cn(
      "fixed inset-0 bg-background/95 backdrop-blur-sm",
      "flex items-center justify-center z-50",
      className
    )}>
      <div className="text-center space-y-6">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-primary/60 animate-pulse" />
            <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Glass V2
          </h1>
          <p className="text-muted-foreground text-sm">
            AI Assistant
          </p>
        </div>

        {/* Loading Text */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-medium">
            Initializing{dots}
          </p>

          {/* Progress Bar */}
          <div className="w-64 mx-auto">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round(Math.min(progress, 100))}%
            </p>
          </div>
        </div>

        {/* Loading Steps */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className={cn(
            "flex items-center justify-center space-x-2",
            progress > 20 && "text-primary"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              progress > 20 ? "bg-primary" : "bg-muted-foreground/50"
            )} />
            <span>Loading settings</span>
          </div>
          
          <div className={cn(
            "flex items-center justify-center space-x-2",
            progress > 50 && "text-primary"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              progress > 50 ? "bg-primary" : "bg-muted-foreground/50"
            )} />
            <span>Initializing AI services</span>
          </div>
          
          <div className={cn(
            "flex items-center justify-center space-x-2",
            progress > 80 && "text-primary"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              progress > 80 ? "bg-primary" : "bg-muted-foreground/50"
            )} />
            <span>Preparing interface</span>
          </div>
        </div>

        {/* Subtle animation */}
        <div className="flex justify-center space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 bg-primary/60 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen