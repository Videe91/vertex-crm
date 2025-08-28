import React, { useState, useEffect } from 'react'
import { 
  Brain,
  Settings,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Save,
  Eye,
  BarChart3
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface CampaignAIConfig {
  id: number
  campaign_id: number
  campaign_name: string
  campaign_type: string
  payment_type: string
  success_criteria: string[]
  primary_metric: string
  baseline_expectations: Record<string, any>
  industry_benchmarks: Record<string, any>
  custom_prompt_additions: string
  performance_weights: Record<string, any>
  ai_model_preference: string
}

interface Campaign {
  id: number
  campaign_name: string
  campaign_type: string
  payment_type: string
  client_name: string
}

const CampaignAIConfig: React.FC = () => {
  const { user, isDarkMode } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null)
  const [aiConfig, setAiConfig] = useState<CampaignAIConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Load campaigns on mount
  useEffect(() => {
    fetchCampaigns()
  }, [])

  // Set progress bar widths using DOM manipulation to avoid inline styles
  useEffect(() => {
    const progressBars = document.querySelectorAll('[data-progress-width]')
    progressBars.forEach((bar) => {
      const width = bar.getAttribute('data-progress-width')
      if (width && bar instanceof HTMLElement) {
        bar.style.width = width
      }
    })
  }, [aiConfig])

  const fetchCampaigns = async () => {
    try {
      const response = await apiService.get('/api/campaigns')
      if (response.success) {
        setCampaigns(response.data || [])
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  const fetchAIConfig = async (campaignId: number) => {
    setLoading(true)
    try {
      const response = await apiService.get(`/api/campaigns/${campaignId}/ai-config`)
      if (response.success) {
        setAiConfig(response.config)
      } else {
        setAiConfig(null)
        setMessage({ type: 'error', text: 'AI configuration not found for this campaign' })
      }
    } catch (error) {
      console.error('Error fetching AI config:', error)
      setAiConfig(null)
      setMessage({ type: 'error', text: 'Failed to load AI configuration' })
    } finally {
      setLoading(false)
    }
  }

  const regenerateConfig = async () => {
    if (!selectedCampaign) return
    
    setRegenerating(true)
    try {
      const response = await apiService.post(`/api/campaigns/${selectedCampaign}/ai-config/regenerate`)
      if (response.success) {
        setMessage({ type: 'success', text: 'AI configuration regenerated successfully!' })
        await fetchAIConfig(selectedCampaign)
      } else {
        setMessage({ type: 'error', text: 'Failed to regenerate AI configuration' })
      }
    } catch (error) {
      console.error('Error regenerating config:', error)
      setMessage({ type: 'error', text: 'Failed to regenerate AI configuration' })
    } finally {
      setRegenerating(false)
    }
  }

  const handleCampaignSelect = (campaignId: number) => {
    setSelectedCampaign(campaignId)
    setAiConfig(null)
    setMessage(null)
    fetchAIConfig(campaignId)
  }

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'sales': return <Target className="w-4 h-4 text-green-500" />
      case 'lead_generation': return <TrendingUp className="w-4 h-4 text-blue-500" />
      case 'lead_generation_hotkey': return <BarChart3 className="w-4 h-4 text-purple-500" />
      default: return <Settings className="w-4 h-4 text-gray-500" />
    }
  }

  const getIndustryFromCriteria = (criteria: string[]) => {
    if (criteria.includes('installed')) return 'Home Security / Solar'
    if (criteria.includes('clean') || criteria.includes('forwarded_to_client')) return 'Lead Generation'
    if (criteria.includes('sold') || criteria.includes('paid')) return 'General Sales'
    return 'Other'
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Brain className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Campaign AI Configuration
            </h1>
          </div>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Configure AI-powered targeting and analysis for each campaign
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Campaign Selection */}
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Campaign
            </h2>
            
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => handleCampaignSelect(campaign.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    selectedCampaign === campaign.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : isDarkMode
                        ? 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {getCampaignTypeIcon(campaign.campaign_type)}
                    <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {campaign.campaign_name}
                    </span>
                  </div>
                  <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {campaign.campaign_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • {campaign.payment_type}
                  </div>
                  {campaign.client_name && (
                    <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Client: {campaign.client_name}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* AI Configuration Display */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-8 text-center`}>
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Loading AI configuration...</p>
              </div>
            ) : aiConfig ? (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    AI Configuration: {aiConfig.campaign_name}
                  </h2>
                  <button
                    onClick={regenerateConfig}
                    disabled={regenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Success Criteria */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Success Criteria
                    </h3>
                    <div className="space-y-2">
                      {aiConfig.success_criteria.map((criteria, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {criteria}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className={`mt-3 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Industry: {getIndustryFromCriteria(aiConfig.success_criteria)}
                    </div>
                  </div>

                  {/* Primary Metric */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Primary Metric
                    </h3>
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-500" />
                      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {aiConfig.primary_metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                  </div>

                  {/* Baseline Expectations */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Baseline Expectations
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(aiConfig.baseline_expectations).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                          </span>
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {typeof value === 'number' && value < 1 ? `${(value * 100).toFixed(1)}%` : value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Industry Benchmarks */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Industry Benchmarks
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(aiConfig.industry_benchmarks).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                          </span>
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {typeof value === 'number' && value < 1 ? `${(value * 100).toFixed(1)}%` : value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Custom Prompt Additions */}
                {aiConfig.custom_prompt_additions && (
                  <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Industry Context
                    </h3>
                    <pre className={`text-sm whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {aiConfig.custom_prompt_additions}
                    </pre>
                  </div>
                )}

                {/* Performance Weights */}
                <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Performance Weights
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(aiConfig.performance_weights).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          {key.replace(/\b\w/g, l => l.toUpperCase())}:
                        </span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                            data-progress-width={`${(value as number) * 100}%`}
                          />
                        </div>
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {((value as number) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedCampaign ? (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-8 text-center`}>
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  No AI Configuration Found
                </h3>
                <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  This campaign doesn't have AI configuration yet.
                </p>
                <button
                  onClick={regenerateConfig}
                  disabled={regenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mx-auto"
                >
                  <Brain className="w-4 h-4" />
                  {regenerating ? 'Generating...' : 'Generate AI Config'}
                </button>
              </div>
            ) : (
              <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-8 text-center`}>
                <Eye className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Select a Campaign
                </h3>
                <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                  Choose a campaign from the left to view its AI configuration
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CampaignAIConfig
