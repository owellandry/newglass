import React from 'react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  className?: string
}

const EmptyState = ({ className }: EmptyStateProps) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center h-full p-8 text-center",
      className
    )}>
      <div className="max-w-md space-y-6">
        {/* Glass Logo/Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>

        {/* Welcome Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            Welcome to Glass V2
          </h2>
          <p className="text-muted-foreground">
            Your AI-powered chat assistant is ready to help.
          </p>
        </div>

        {/* Getting Started */}
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Get started by:</p>
            <ul className="space-y-1 text-left">
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span>Creating a new chat session</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span>Configuring your AI settings</span>
              </li>
              <li className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <span>Asking any question you have</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
            Start New Chat
          </button>
          <button className="px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors text-sm font-medium">
            View Settings
          </button>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-primary/3 rounded-full blur-3xl" />
      </div>
    </div>
  )
}

export default EmptyState