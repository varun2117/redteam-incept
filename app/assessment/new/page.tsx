'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Shield, Target, Settings, Play, Star, DollarSign, Clock, TestTube, CheckCircle, XCircle, Globe, X, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { AVAILABLE_MODELS, getModelById } from '@/lib/models'
import { ThemeToggle } from '@/components/theme-toggle'

export default function NewAssessment() {
  const { data: session } = useSession()
  const router = useRouter()
  const [targetName, setTargetName] = useState('')
  const [targetDescription, setTargetDescription] = useState('')
  const [chatAgentUrl, setChatAgentUrl] = useState('')
  const [openrouterApiKey, setOpenrouterApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-sonnet-4')
  const [loading, setLoading] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    responseTime?: number;
    error?: string;
  }>({ tested: false, success: false })

  const selectedModelInfo = getModelById(selectedModel)

  const handleCancel = () => {
    // Check if form has any content
    const hasContent = targetName.trim() || targetDescription.trim() || chatAgentUrl.trim() || openrouterApiKey.trim()
    
    if (hasContent) {
      const confirmExit = confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')
      if (!confirmExit) return
    }
    
    router.push('/assessments')
  }

  const testChatAgentConnection = async () => {
    if (!chatAgentUrl.trim()) {
      toast.error('Please enter a chat agent URL first')
      return
    }

    setTestingConnection(true)
    setConnectionStatus({ tested: false, success: false })

    try {
      const response = await fetch('/api/assessment/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatAgentUrl
        }),
      })

      const data = await response.json()
      
      setConnectionStatus({
        tested: true,
        success: data.success,
        responseTime: data.details?.responseTime,
        error: data.details?.error
      })

      if (data.success) {
        toast.success(`Connection successful! (${data.details?.responseTime}ms)`)
      } else {
        toast.error(`Connection failed: ${data.details?.error}`)
      }
    } catch (error) {
      setConnectionStatus({
        tested: true,
        success: false,
        error: 'Network error'
      })
      toast.error('Failed to test connection')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!targetName.trim()) {
      toast.error('Please enter a target name')
      return
    }

    if (!chatAgentUrl.trim()) {
      toast.error('Please enter a chat agent URL')
      return
    }

    if (!openrouterApiKey.trim()) {
      toast.error('Please enter your OpenRouter API key')
      return
    }

    setLoading(true)

    const requestData = {
      targetName,
      targetDescription,
      targetUrl: chatAgentUrl,
      openrouterApiKey,
      selectedModel
    }
    
    console.log('Sending assessment data:', requestData)

    try {
      const response = await fetch('/api/assessment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Assessment started successfully! You can view progress in your assessments list.')
        
        // Wait a moment to show the success message, then redirect to assessments list
        setTimeout(() => {
          router.push('/assessments')
        }, 2000)
      } else {
        const data = await response.json()
        console.error('Assessment start failed:', data)
        if (data.errors) {
          data.errors.forEach((error: any) => {
            toast.error(`${error.field}: ${error.message}`)
          })
        } else {
          toast.error(data.message || 'Failed to start assessment')
        }
      }
    } catch (error) {
      toast.error('An error occurred while starting the assessment')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3 hover:opacity-80">
                <Shield className="h-8 w-8 text-red-600" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">LLM Red Team Agent</h1>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {session.user?.name || session.user?.email}
              </span>
              <Link
                href="/api/auth/signout"
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-200 dark:border-gray-700 transition-colors">
          <div className="flex items-center mb-8">
            <Target className="h-8 w-8 text-red-600 mr-3" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">New Security Assessment</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Target Information */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Target Information
              </h3>
              
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="targetName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Name *
                  </label>
                  <input
                    type="text"
                    id="targetName"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 transition-colors"
                    placeholder="e.g., ChatGPT, Claude, Custom AI Assistant"
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="targetDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Description
                  </label>
                  <textarea
                    id="targetDescription"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 transition-colors"
                    placeholder="Describe the target system, its purpose, and any relevant context..."
                    value={targetDescription}
                    onChange={(e) => setTargetDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="chatAgentUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Chat Agent URL *
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      id="chatAgentUrl"
                      required
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 text-gray-900 bg-white"
                      placeholder="http://localhost:11434/api/generate"
                      value={chatAgentUrl}
                      onChange={(e) => setChatAgentUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={testChatAgentConnection}
                      disabled={testingConnection || !chatAgentUrl.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {testingConnection ? (
                        <div className="loader w-4 h-4"></div>
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      <span>Test</span>
                    </button>
                  </div>
                  
                  {/* Connection Status */}
                  {connectionStatus.tested && (
                    <div className={`mt-2 p-2 rounded-md flex items-center space-x-2 ${
                      connectionStatus.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}>
                      {connectionStatus.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm">
                        {connectionStatus.success 
                          ? `Connected successfully${connectionStatus.responseTime ? ` (${connectionStatus.responseTime}ms)` : ''}`
                          : `Connection failed: ${connectionStatus.error}`
                        }
                      </span>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    URL of the chat agent to test (e.g., Ollama, GPT API, custom chat service)
                  </p>
                </div>
              </div>
            </div>

            {/* OpenRouter Configuration */}
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600 transition-colors">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Red Team Agent Configuration
              </h3>
              
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="openrouterApiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    OpenRouter API Key *
                  </label>
                  <input
                    type="password"
                    id="openrouterApiKey"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 transition-colors"
                    placeholder="sk-or-..."
                    value={openrouterApiKey}
                    onChange={(e) => setOpenrouterApiKey(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Get your API key from{' '}
                    <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:text-red-700">
                      openrouter.ai
                    </a>
                  </p>
                </div>

                <div>
                  <label htmlFor="selectedModel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Red Team Model
                  </label>
                  <select
                    id="selectedModel"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-red-500 focus:border-red-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 transition-colors"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    {AVAILABLE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} - {model.provider} {model.recommended ? '⭐' : ''}
                      </option>
                    ))}
                  </select>
                  
                  {/* Model Information Card */}
                  {selectedModelInfo && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-blue-900 flex items-center">
                          {selectedModelInfo.name}
                          {selectedModelInfo.recommended && <Star className="h-4 w-4 ml-1 text-yellow-500" />}
                        </h4>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {selectedModelInfo.category}
                        </span>
                      </div>
                      <p className="text-sm text-blue-800 mb-2">{selectedModelInfo.description}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center text-blue-700">
                          <Clock className="h-3 w-3 mr-1" />
                          {selectedModelInfo.contextWindow.toLocaleString()} tokens
                        </div>
                        <div className="flex items-center text-blue-700">
                          <DollarSign className="h-3 w-3 mr-1" />
                          ${selectedModelInfo.pricing.input}/${selectedModelInfo.pricing.output} per 1M
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs font-medium text-blue-800">Strengths: </span>
                        <span className="text-xs text-blue-700">
                          {selectedModelInfo.strengths.join(', ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Shield className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Security Notice
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      This tool will connect to your specified chat agent and test it for security vulnerabilities using various attack vectors.
                      Only test chat agents you own or have explicit permission to test. 
                      API keys are used securely and not stored permanently.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Agent Examples */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Supported Chat Agents
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Ollama:</strong> http://localhost:11434/api/generate</li>
                      <li><strong>OpenAI API:</strong> https://api.openai.com/v1/chat/completions</li>
                      <li><strong>Text Generation WebUI:</strong> http://localhost:5000/api/v1/generate</li>
                      <li><strong>Custom APIs:</strong> Any HTTP-based chat endpoint</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="loader"></div>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Start Security Assessment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}