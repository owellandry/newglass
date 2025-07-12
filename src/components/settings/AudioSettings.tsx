import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

const AudioSettings = () => {
  const { settings, updateAudioSettings } = useSettingsStore()
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false)
  const [microphoneLevel, setMicrophoneLevel] = useState(0)
  const [testStream, setTestStream] = useState<MediaStream | null>(null)

  // Load available audio devices
  useEffect(() => {
    const loadAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(device => device.kind === 'audioinput')
        setAudioDevices(audioInputs)
      } catch (error) {
        console.error('Failed to load audio devices:', error)
        toast.error('Failed to load audio devices')
      }
    }

    loadAudioDevices()
  }, [])

  // Test microphone
  const handleTestMicrophone = async () => {
    if (isTestingMicrophone) {
      // Stop testing
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop())
        setTestStream(null)
      }
      setIsTestingMicrophone(false)
      setMicrophoneLevel(0)
      return
    }

    try {
      setIsTestingMicrophone(true)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.audio.inputDevice || undefined,
          echoCancellation: settings.audio.echoCancellation,
          noiseSuppression: settings.audio.noiseSuppression,
          autoGainControl: settings.audio.autoGainControl
        }
      })
      
      setTestStream(stream)
      
      // Create audio context for level monitoring
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const microphone = audioContext.createMediaStreamSource(stream)
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      microphone.connect(analyser)
      analyser.fftSize = 256
      
      const updateLevel = () => {
        if (!isTestingMicrophone) return
        
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setMicrophoneLevel(average / 255 * 100)
        
        requestAnimationFrame(updateLevel)
      }
      
      updateLevel()
      
    } catch (error) {
      console.error('Failed to access microphone:', error)
      toast.error('Failed to access microphone')
      setIsTestingMicrophone(false)
    }
  }

  const handleInputDeviceChange = (deviceId: string) => {
    updateAudioSettings({ inputDevice: deviceId })
  }

  const handleOutputDeviceChange = (deviceId: string) => {
    updateAudioSettings({ outputDevice: deviceId })
  }

  const handleVoiceActivationChange = (enabled: boolean) => {
    updateAudioSettings({ voiceActivation: enabled })
  }

  const handleVoiceThresholdChange = (value: string) => {
    const threshold = parseFloat(value)
    if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
      updateAudioSettings({ voiceThreshold: threshold })
    }
  }

  const handleEchoCancellationChange = (enabled: boolean) => {
    updateAudioSettings({ echoCancellation: enabled })
  }

  const handleNoiseSuppressionChange = (enabled: boolean) => {
    updateAudioSettings({ noiseSuppression: enabled })
  }

  const handleAutoGainControlChange = (enabled: boolean) => {
    updateAudioSettings({ autoGainControl: enabled })
  }

  const handleSampleRateChange = (value: string) => {
    const sampleRate = parseInt(value)
    if (!isNaN(sampleRate)) {
      updateAudioSettings({ sampleRate })
    }
  }

  const handleChannelsChange = (value: string) => {
    const channels = parseInt(value)
    if (!isNaN(channels) && channels >= 1 && channels <= 2) {
      updateAudioSettings({ channels })
    }
  }

  const deviceOptions = audioDevices.map(device => ({
    value: device.deviceId,
    label: device.label || `Device ${device.deviceId.slice(0, 8)}...`
  }))

  const sampleRateOptions = [
    { value: '16000', label: '16 kHz' },
    { value: '22050', label: '22.05 kHz' },
    { value: '44100', label: '44.1 kHz' },
    { value: '48000', label: '48 kHz' }
  ]

  const channelOptions = [
    { value: '1', label: 'Mono' },
    { value: '2', label: 'Stereo' }
  ]

  return (
    <div className="space-y-6">
      {/* Audio Devices */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Audio Devices</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Input Device (Microphone)</label>
            <Select
              value={settings.audio.inputDevice || ''}
              onChange={handleInputDeviceChange}
              options={[{ value: '', label: 'Default' }, ...deviceOptions]}
              placeholder="Select input device"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Output Device (Speakers)</label>
            <Select
              value={settings.audio.outputDevice || ''}
              onChange={handleOutputDeviceChange}
              options={[{ value: '', label: 'Default' }, ...deviceOptions]}
              placeholder="Select output device"
            />
          </div>
        </div>

        {/* Microphone Test */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Microphone Test</label>
            <Button
              onClick={handleTestMicrophone}
              variant={isTestingMicrophone ? "destructive" : "outline"}
              size="sm"
            >
              {isTestingMicrophone ? 'Stop Test' : 'Test Microphone'}
            </Button>
          </div>
          
          {isTestingMicrophone && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground w-16">Level:</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
                    style={{ width: `${microphoneLevel}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12">
                  {Math.round(microphoneLevel)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Speak into your microphone to test the input level
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Voice Activation */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Voice Activation</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Enable Voice Activation</label>
              <p className="text-xs text-muted-foreground">
                Automatically start recording when voice is detected
              </p>
            </div>
            <Button
              variant={settings.audio.voiceActivation ? "default" : "outline"}
              size="sm"
              onClick={() => handleVoiceActivationChange(!settings.audio.voiceActivation)}
            >
              {settings.audio.voiceActivation ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {settings.audio.voiceActivation && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Voice Threshold (%)</label>
              <Input
                type="number"
                value={settings.audio.voiceThreshold.toString()}
                onChange={(e) => handleVoiceThresholdChange(e.target.value)}
                placeholder="30"
                min="0"
                max="100"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Minimum voice level to trigger recording (0-100%)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Audio Processing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Audio Processing</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Echo Cancellation</label>
              <p className="text-xs text-muted-foreground">
                Reduce echo and feedback from speakers
              </p>
            </div>
            <Button
              variant={settings.audio.echoCancellation ? "default" : "outline"}
              size="sm"
              onClick={() => handleEchoCancellationChange(!settings.audio.echoCancellation)}
            >
              {settings.audio.echoCancellation ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Noise Suppression</label>
              <p className="text-xs text-muted-foreground">
                Reduce background noise and improve clarity
              </p>
            </div>
            <Button
              variant={settings.audio.noiseSuppression ? "default" : "outline"}
              size="sm"
              onClick={() => handleNoiseSuppressionChange(!settings.audio.noiseSuppression)}
            >
              {settings.audio.noiseSuppression ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Auto Gain Control</label>
              <p className="text-xs text-muted-foreground">
                Automatically adjust microphone sensitivity
              </p>
            </div>
            <Button
              variant={settings.audio.autoGainControl ? "default" : "outline"}
              size="sm"
              onClick={() => handleAutoGainControlChange(!settings.audio.autoGainControl)}
            >
              {settings.audio.autoGainControl ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>
      </div>

      {/* Audio Quality */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Audio Quality</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sample Rate</label>
            <Select
              value={settings.audio.sampleRate.toString()}
              onChange={handleSampleRateChange}
              options={sampleRateOptions}
              placeholder="Select sample rate"
            />
            <p className="text-xs text-muted-foreground">
              Higher rates provide better quality but larger files
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Channels</label>
            <Select
              value={settings.audio.channels.toString()}
              onChange={handleChannelsChange}
              options={channelOptions}
              placeholder="Select channels"
            />
            <p className="text-xs text-muted-foreground">
              Mono is recommended for voice recording
            </p>
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Permissions</h3>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Microphone Access</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Glass needs microphone access to record voice messages. 
            If you're having issues, check your browser's microphone permissions.
          </p>
          <Button
            onClick={() => navigator.mediaDevices.getUserMedia({ audio: true })}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Request Microphone Permission
          </Button>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Troubleshooting</h3>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-medium">Common Issues</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• If microphone doesn't work, check browser permissions</li>
            <li>• Try different input devices if audio quality is poor</li>
            <li>• Enable noise suppression in noisy environments</li>
            <li>• Use lower sample rates if experiencing performance issues</li>
            <li>• Restart the application if audio settings don't apply</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AudioSettings