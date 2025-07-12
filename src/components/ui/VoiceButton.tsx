import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'
import Button from './Button'
import toast from 'react-hot-toast'

const VoiceButton = () => {
  const { isListening, setListening, currentSession, addMessage } = useAppStore()
  const { settings } = useSettingsStore()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [isElectron, setIsElectron] = useState(false)

  // Check if running in Electron
  useEffect(() => {
    const electronAvailable = typeof window !== 'undefined' && 
                             window.electronAPI && 
                             window.electronAPI.audio;
    
    setIsElectron(electronAvailable);
  }, [])

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      setRecordingTime(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
    }
  }, [mediaRecorder])

  const startRecording = async () => {
    try {
      if (!settings.audio.enabled) {
        toast.error('Audio is disabled in settings')
        return
      }

      if (!currentSession) {
        toast.error('No active session')
        return
      }

      if (isElectron) {
        // Use Electron's native audio capture
        try {
          await window.electronAPI.audio.startCapture()
          setIsRecording(true)
          setListening(true)
          toast.success('Recording started (Electron)')
        } catch (error) {
          console.error('Failed to start Electron recording:', error)
          toast.error('Failed to start recording')
        }
      } else {
        // Web implementation using MediaRecorder
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        })

        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })

        const audioChunks: Blob[] = []

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data)
          }
        }

        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' })
          
          try {
            // Here you would typically send the audio to a speech-to-text service
            // For now, we'll simulate transcription
            const transcription = await simulateTranscription(audioBlob)
            
            if (transcription && currentSession) {
              addMessage(currentSession.id, {
                role: 'user',
                content: transcription,
              })
              toast.success('Voice message transcribed')
            }
          } catch (error) {
            console.error('Transcription failed:', error)
            toast.error('Failed to transcribe audio')
          }

          // Clean up
          stream.getTracks().forEach(track => track.stop())
          setIsRecording(false)
          setListening(false)
        }

        recorder.onerror = (event) => {
          console.error('Recording error:', event)
          toast.error('Recording failed')
          setIsRecording(false)
          setListening(false)
        }

        setMediaRecorder(recorder)
        recorder.start()
        setIsRecording(true)
        setListening(true)
        
        toast.success('Recording started (Web)')
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
      toast.error('Failed to access microphone')
    }
  }

  const stopRecording = () => {
    if (isElectron) {
      // Stop Electron's native audio capture
      try {
        window.electronAPI.audio.stopCapture()
          .then((result: any) => {
            if (result && result.transcription && currentSession) {
              addMessage(currentSession.id, {
                role: 'user',
                content: result.transcription,
              })
              toast.success('Voice message transcribed')
            }
          })
          .catch((error: any) => {
            console.error('Failed to stop Electron recording:', error)
            toast.error('Failed to transcribe audio')
          })
          .finally(() => {
            setIsRecording(false)
            setListening(false)
          })
      } catch (error) {
        console.error('Error stopping Electron recording:', error)
        setIsRecording(false)
        setListening(false)
      }
    } else if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      // Stop web MediaRecorder
      mediaRecorder.stop()
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for the configured shortcut (default: Ctrl+Space)
      const shortcut = settings.shortcuts.toggleListening
      const isCtrlSpace = e.ctrlKey && e.code === 'Space'
      
      if (isCtrlSpace) {
        e.preventDefault()
        toggleRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording, settings.shortcuts.toggleListening])

  return (
    <div className="flex items-center space-x-2">
      {/* Recording time indicator */}
      {isRecording && (
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="font-mono">{formatTime(recordingTime)}</span>
        </div>
      )}

      {/* Voice button */}
      <Button
        variant={isRecording ? "destructive" : "ghost"}
        size="icon"
        onClick={toggleRecording}
        disabled={!settings.audio.enabled}
        className={cn(
          "h-8 w-8 transition-all duration-200",
          isRecording && "animate-pulse",
          isListening && !isRecording && "bg-blue-500/20 text-blue-500"
        )}
        title={isRecording ? 'Stop recording (Ctrl+Space)' : 'Start recording (Ctrl+Space)'}
      >
        {isRecording ? (
          // Stop icon
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          // Microphone icon
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </Button>
    </div>
  )
}

// Simulate transcription (replace with actual speech-to-text service)
const simulateTranscription = async (audioBlob: Blob): Promise<string> => {
  // In a real implementation, you would send the audio to a speech-to-text service
  // For now, we'll return a placeholder
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('This is a simulated transcription of your voice message.')
    }, 1000)
  })
}

export default VoiceButton