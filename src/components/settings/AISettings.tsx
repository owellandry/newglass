import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAIStore } from '../../stores/aiStore'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

// Components
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

const AISettings = () => {
  const { settings, updateAISettings, updateAPIKeys } = useSettingsStore()
  const { 
    providers, 
    currentProvider, 
    currentModel, 
    availableModels,
    setProvider,
    setModel,
    validateApiKey,
    refreshModels
  } = useAIStore()
  
  const [apiKeys, setApiKeys] = useState(settings.apiKeys)
  const [isValidating, setIsValidating] = useState<string | null>(null)
  const [validationResults, setValidationResults] = useState<Record<string, boolean>>({})

  // Update local state when settings change
  useEffect(() => {
    setApiKeys(settings.apiKeys)
  }, [settings.apiKeys])

  const handleProviderChange = async (providerId: string) => {
    setProvider(providerId)
    
    // Auto-select first available model for the provider
    const provider = providers.find(p => p.id === providerId)
    if (provider && provider.models.length > 0) {
      setModel(provider.models[0].id)
    }
    
    // Refresh models if needed
    if (providerId === 'openrouter') {
      await refreshModels()
    }
  }

  const handleModelChange = (modelId: string) => {
    setModel(modelId)
  }

  const handleApiKeyChange = (provider: string, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: value
    }))
  }

  const handleSaveApiKeys = () => {
    updateAPIKeys(apiKeys)
    toast.success('API keys saved')
  }

  const handleValidateApiKey = async (provider: string) => {
    const apiKey = apiKeys[provider]
    if (!apiKey) {
      toast.error('Please enter an API key first')
      return
    }

    setIsValidating(provider)
    try {
      const isValid = await validateApiKey(provider, apiKey)
      setValidationResults(prev => ({
        ...prev,
        [provider]: isValid
      }))
      
      if (isValid) {
        toast.success('API key is valid')
      } else {
        toast.error('API key is invalid')
      }
    } catch (error) {
      console.error('API key validation failed:', error)
      toast.error('Failed to validate API key')
      setValidationResults(prev => ({
        ...prev,
        [provider]: false
      }))
    } finally {
      setIsValidating(null)
    }
  }

  const handleTemperatureChange = (value: string) => {
    const temperature = parseFloat(value)
    if (!isNaN(temperature) && temperature >= 0 && temperature <= 2) {
      updateAISettings({ temperature })
    }
  }

  const handleMaxTokensChange = (value: string) => {
    const maxTokens = parseInt(value)
    if (!isNaN(maxTokens) && maxTokens > 0) {
      updateAISettings({ maxTokens })
    }
  }

  const handleSystemPromptChange = (value: string) => {
    updateAISettings({ systemPrompt: value })
  }

  const handleStreamingChange = (enabled: boolean) => {
    updateAISettings({ streamingEnabled: enabled })
  }

  const providerOptions = providers.map(provider => ({
    value: provider.id,
    label: provider.name
  }))

  const modelOptions = availableModels.map(model => ({
    value: model.id,
    label: model.name
  }))

  const currentProviderData = providers.find(p => p.id === currentProvider)
  const currentModelData = availableModels.find(m => m.id === currentModel)

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">AI Provider</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Select
              value={currentProvider || ''}
              onChange={handleProviderChange}
              options={providerOptions}
              placeholder="Select AI provider"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Model</label>
            <Select
              value={currentModel || ''}
              onChange={handleModelChange}
              options={modelOptions}
              placeholder="Select model"
              disabled={!currentProvider}
            />
          </div>
        </div>

        {currentModelData && (
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium">Model Information</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Name:</strong> {currentModelData.name}</p>
              {currentModelData.description && (
                <p><strong>Description:</strong> {currentModelData.description}</p>
              )}
              {currentModelData.contextLength && (
                <p><strong>Context Length:</strong> {currentModelData.contextLength.toLocaleString()} tokens</p>
              )}
              {currentModelData.pricing && (
                <div>
                  <p><strong>Pricing:</strong></p>
                  <ul className="ml-4 space-y-1">
                    <li>Input: ${currentModelData.pricing.input}/1K tokens</li>
                    <li>Output: ${currentModelData.pricing.output}/1K tokens</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">API Keys</h3>
        
        <div className="space-y-4">
          {providers.map(provider => (
            <div key={provider.id} className="space-y-2">
              <label className="text-sm font-medium">{provider.name} API Key</label>
              <div className="flex items-center space-x-2">
                <Input
                  type="password"
                  value={apiKeys[provider.id] || ''}
                  onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                  placeholder={`Enter ${provider.name} API key`}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleValidateApiKey(provider.id)}
                  variant="outline"
                  size="sm"
                  disabled={!apiKeys[provider.id] || isValidating === provider.id}
                  loading={isValidating === provider.id}
                >
                  Validate
                </Button>
                {validationResults[provider.id] !== undefined && (
                  <div className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center",
                    validationResults[provider.id] ? "bg-green-500" : "bg-red-500"
                  )}>
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                      {validationResults[provider.id] ? (
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      ) : (
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      )}
                    </svg>
                  </div>
                )}
              </div>
              {provider.apiKeyUrl && (
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a 
                    href={provider.apiKeyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {provider.name}
                  </a>
                </p>
              )}
            </div>
          ))}
        </div>
        
        <Button onClick={handleSaveApiKeys} className="w-full">
          Save API Keys
        </Button>
      </div>

      {/* Model Parameters */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Model Parameters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Temperature</label>
            <Input
              type="number"
              value={settings.ai.temperature.toString()}
              onChange={(e) => handleTemperatureChange(e.target.value)}
              placeholder="0.7"
              min="0"
              max="2"
              step="0.1"
            />
            <p className="text-xs text-muted-foreground">
              Controls randomness (0.0 = deterministic, 2.0 = very random)
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Tokens</label>
            <Input
              type="number"
              value={settings.ai.maxTokens?.toString() || ''}
              onChange={(e) => handleMaxTokensChange(e.target.value)}
              placeholder="Auto"
              min="1"
              max="32000"
            />
            <p className="text-xs text-muted-foreground">
              Maximum tokens in response (leave empty for auto)
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">System Prompt</label>
          <textarea
            value={settings.ai.systemPrompt || ''}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder="You are a helpful assistant..."
            className={cn(
              "w-full h-24 resize-none rounded-lg border border-border/50 bg-background/50",
              "px-4 py-3 text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
              "transition-all duration-200"
            )}
          />
          <p className="text-xs text-muted-foreground">
            Instructions that will be sent with every conversation
          </p>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Advanced Options</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">Streaming</label>
              <p className="text-xs text-muted-foreground">
                Stream responses as they are generated
              </p>
            </div>
            <Button
              variant={settings.ai.streamingEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => handleStreamingChange(!settings.ai.streamingEnabled)}
            >
              {settings.ai.streamingEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Usage Tips</h3>
        
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-medium">Tips</span>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• Lower temperature (0.1-0.3) for factual, consistent responses</li>
            <li>• Higher temperature (0.7-1.0) for creative, varied responses</li>
            <li>• Set max tokens to control response length and costs</li>
            <li>• Use system prompts to define the AI's role and behavior</li>
            <li>• Enable streaming for real-time response generation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default AISettings