import React, { useState, useEffect } from 'react'
import { 
  Target, 
  Brain, 
  TrendingUp, 
  Users, 
  Building2,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Settings,
  Play
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface Campaign {
  id: number
  campaign_name: string
  campaign_type: string
  country: string
}

interface Target {
  type: string
  value: number
  period: string
  reasoning?: string
}

interface CampaignAIConfig {
  success_criteria: string[]
  primary_metric: string
  baseline_expectations: Record<string, any>
  target_structure: Record<string, any>
}

interface AIInsight {
  performance_summary: {
    current_performance: string
    trend_analysis: string
    key_strengths: string[]
    improvement_areas: string[]
  }
  target_recommendations: {
    leads_per_day: number
    quality_rate: number
    conversion_rate: number
    confidence_level: number
  }
  insights: {
    patterns_identified: string[]
    risk_factors: string[]
    opportunities: string[]
  }
  action_items: Array<{
    priority: string
    action: string
    timeline: string
  }>
}

const AITargets: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [campaignConfig, setCampaignConfig] = useState<CampaignAIConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<AIInsight | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  useEffect(() => {
    fetchCampaigns()
    // Set default targets on initial load
    setDefaultTargets()
  }, [])

  // Auto-fetch config when campaign is selected
  useEffect(() => {
    if (selectedCampaign) {
      fetchCampaignConfig(selectedCampaign)
    }
  }, [selectedCampaign])

  const fetchCampaigns = async () => {
    try {
      const response = await apiService.get('campaigns')
      if (response.success) {
        setCampaigns(response.data || [])
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  const fetchCampaignConfig = async (campaignId: number) => {
    try {
      const response = await apiService.get(`/api/campaigns/${campaignId}/ai-config`)
      if (response.success) {
        setCampaignConfig(response.data?.config)
        generateCampaignSpecificTargets(response.data?.config)
      } else {
        // No AI config found, use default targets
        setDefaultTargets()
      }
    } catch (error) {
      console.error('Error fetching campaign config:', error)
      setDefaultTargets()
    }
  }

  const generateCampaignSpecificTargets = (config: CampaignAIConfig) => {
    const newTargets: Target[] = []
    
    // Check if this is a Vivint-style campaign with transfer + install structure
    if (config.target_structure?.payout_metric === 'installed' && 
        config.target_structure?.pipeline_metric === 'transferred') {
      
      // Vivint-style targets: Transfer per Day + Install per Day
      newTargets.push({
        type: 'transfers_per_day',
        value: config.baseline_expectations?.min_transfers_per_agent || 1,
        period: 'daily',
        reasoning: 'Minimum transfers per agent (pipeline metric)'
      })
      
      newTargets.push({
        type: 'installs_per_day', 
        value: config.baseline_expectations?.min_installs_per_agent || 1,
        period: 'daily',
        reasoning: 'Minimum installs per agent (payout metric)'
      })
      
      newTargets.push({
        type: 'transfer_to_install_rate',
        value: (config.baseline_expectations?.transfer_to_install_ratio || 0.10) * 100,
        period: 'daily',
        reasoning: 'Expected conversion from transfers to installs'
      })
      
    } else if (config.success_criteria?.includes('clean') || 
               config.success_criteria?.includes('forwarded_to_client')) {
      
      // Lead generation targets
      newTargets.push({
        type: 'leads_per_day',
        value: config.baseline_expectations?.daily_target || 8,
        period: 'daily',
        reasoning: 'Daily lead generation target'
      })
      
      newTargets.push({
        type: 'quality_rate',
        value: (config.baseline_expectations?.quality_rate || 0.75) * 100,
        period: 'daily',
        reasoning: 'Lead quality validation rate'
      })
      
      newTargets.push({
        type: 'client_acceptance_rate',
        value: (config.baseline_expectations?.client_acceptance_rate || 0.80) * 100,
        period: 'daily',
        reasoning: 'Client acceptance of forwarded leads'
      })
      
    } else {
      
      // Generic sales targets
      newTargets.push({
        type: 'sales_per_day',
        value: config.baseline_expectations?.daily_target || 2,
        period: 'daily',
        reasoning: 'Daily sales target'
      })
      
      newTargets.push({
        type: 'conversion_rate',
        value: (config.baseline_expectations?.conversion_rate || 0.20) * 100,
        period: 'daily',
        reasoning: 'Lead to sales conversion rate'
      })
      
      newTargets.push({
        type: 'quality_threshold',
        value: (config.baseline_expectations?.quality_threshold || 0.80) * 100,
        period: 'daily',
        reasoning: 'Minimum quality threshold'
      })
    }
    
    setTargets(newTargets)
  }

  const setDefaultTargets = () => {
    setTargets([
      { type: 'leads_per_day', value: 10, period: 'daily', reasoning: 'Base lead generation target' },
      { type: 'quality_rate', value: 85, period: 'daily', reasoning: 'Minimum acceptable lead quality' },
      { type: 'conversion_rate', value: 15, period: 'daily', reasoning: 'Expected conversion from leads to sales' }
    ])
  }

  const formatTargetTypeName = (type: string) => {
    const typeNames: Record<string, string> = {
      'transfers_per_day': 'Transfers per Day',
      'installs_per_day': 'Installs per Day', 
      'transfer_to_install_rate': 'Transfer to Install Rate (%)',
      'leads_per_day': 'Leads per Day',
      'quality_rate': 'Quality Rate (%)',
      'conversion_rate': 'Conversion Rate (%)',
      'client_acceptance_rate': 'Client Acceptance Rate (%)',
      'sales_per_day': 'Sales per Day',
      'quality_threshold': 'Quality Threshold (%)'
    }
    return typeNames[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const handleTargetChange = (index: number, field: string, value: string | number) => {
    const updatedTargets = [...targets]
    updatedTargets[index] = { ...updatedTargets[index], [field]: value }
    setTargets(updatedTargets)
  }

  const addTarget = () => {
    setTargets([...targets, { type: 'leads_per_day', value: 10, period: 'daily', reasoning: '' }])
  }

  const removeTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index))
  }

  const runAIAnalysis = async () => {
    if (!selectedCampaign) return
    
    setAnalysisLoading(true)
    try {
      const response = await apiService.post('ai/analyze-performance', {
        entity_type: 'campaign',
        entity_id: selectedCampaign,
        days: 30
      })
      
      if (response.success) {
        setAiAnalysis(response.data?.analysis)
        
        // Update targets based on AI recommendations
        if (response.data?.analysis?.target_recommendations) {
          const aiTargets = [
            { 
              type: 'leads_per_day', 
              value: response.data?.analysis?.target_recommendations?.leads_per_day || 10, 
              period: 'daily',
              reasoning: 'AI-recommended based on campaign performance analysis'
            },
            { 
              type: 'quality_rate', 
              value: response.data?.analysis?.target_recommendations?.quality_rate || 85, 
              period: 'daily',
              reasoning: 'AI-optimized quality target for sustainable performance'
            },
            { 
              type: 'conversion_rate', 
              value: response.data?.analysis?.target_recommendations?.conversion_rate || 15, 
              period: 'daily',
              reasoning: 'AI-calculated conversion target based on market conditions'
            }
          ]
          setTargets(aiTargets)
        }
      }
    } catch (error) {
      console.error('Error running AI analysis:', error)
    } finally {
      setAnalysisLoading(false)
    }
  }

  const seedTargets = async () => {
    if (!selectedCampaign || targets.length === 0) return
    
    setLoading(true)
    try {
      const response = await apiService.post('super-admin/seed-targets', {
        campaign_id: selectedCampaign,
        targets: targets
      })
      
      if (response.success) {
        alert('Targets seeded successfully! AI will now generate center and agent targets.')
      }
    } catch (error) {
      console.error('Error seeding targets:', error)
      alert('Failed to seed targets. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getTargetTypeLabel = (type: string) => {
    switch (type) {
      case 'leads_per_day': return 'Leads per Day'
      case 'quality_rate': return 'Quality Rate (%)'
      case 'conversion_rate': return 'Conversion Rate (%)'
      default: return type
    }
  }

  const getTargetTypeIcon = (type: string) => {
    switch (type) {
      case 'leads_per_day': return <Users className="w-4 h-4" />
      case 'quality_rate': return <CheckCircle className="w-4 h-4" />
      case 'conversion_rate': return <TrendingUp className="w-4 h-4" />
      default: return <Target className="w-4 h-4" />
    }
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
        activeItem="ai-targets"
        userRole="super_admin"
      />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
              <Brain className={`w-8 h-8 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                AI Target Management
              </h1>
              <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Seed campaign targets and let AI optimize performance across all centers
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Target Configuration */}
          <div className="lg:col-span-2">
            <div className={`rounded-xl border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            } p-6`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Campaign Target Configuration
                </h2>
                <button
                  onClick={runAIAnalysis}
                  disabled={!selectedCampaign || analysisLoading}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    isDarkMode
                      ? 'bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-600'
                      : 'bg-purple-500 hover:bg-purple-600 text-white disabled:bg-gray-300'
                  } disabled:cursor-not-allowed transition-colors`}
                >
                  {analysisLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      AI Analysis
                    </>
                  )}
                </button>
              </div>

              {/* Campaign Selection */}
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Select Campaign
                </label>
                <select
                  value={selectedCampaign || ''}
                  onChange={(e) => {
                    const campaignId = Number(e.target.value) || null
                    setSelectedCampaign(campaignId)
                    if (campaignId) {
                      fetchCampaignConfig(campaignId)
                    } else {
                      setDefaultTargets()
                      setCampaignConfig(null)
                    }
                  }}
                  title="Select campaign for target seeding"
                  aria-label="Select campaign to seed AI targets"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select a campaign to seed targets</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.campaign_name} ({campaign.country})
                    </option>
                  ))}
                </select>
              </div>

              {/* Targets List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Target Configuration
                  </h3>
                  <button
                    onClick={addTarget}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    } transition-colors`}
                  >
                    + Add Target
                  </button>
                </div>

                {targets.map((target, index) => (
                  <div key={index} className={`p-4 rounded-lg border ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Target Type
                        </label>
                        <select
                          value={target.type}
                          onChange={(e) => handleTargetChange(index, 'type', e.target.value)}
                          title="Select target type"
                          aria-label="Select the type of target metric"
                          className={`w-full px-3 py-2 text-sm rounded-lg border ${
                            isDarkMode 
                              ? 'bg-gray-600 border-gray-500 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          {/* Show available target types based on current targets */}
                          {Array.from(new Set(targets.map(t => t.type))).map((type) => (
                            <option key={type} value={type}>
                              {formatTargetTypeName(type)}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Target Value
                        </label>
                        <input
                          type="number"
                          value={target.value}
                          onChange={(e) => handleTargetChange(index, 'value', Number(e.target.value))}
                          title="Enter target value"
                          placeholder="Enter target value"
                          aria-label="Enter the target value for this metric"
                          className={`w-full px-3 py-2 text-sm rounded-lg border ${
                            isDarkMode 
                              ? 'bg-gray-600 border-gray-500 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </div>
                      
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Period
                        </label>
                        <select
                          value={target.period}
                          onChange={(e) => handleTargetChange(index, 'period', e.target.value)}
                          title="Select target period"
                          aria-label="Select the time period for this target"
                          className={`w-full px-3 py-2 text-sm rounded-lg border ${
                            isDarkMode 
                              ? 'bg-gray-600 border-gray-500 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      
                      <div className="flex items-end">
                        <button
                          onClick={() => removeTarget(index)}
                          className={`px-3 py-2 text-sm rounded-lg ${
                            isDarkMode
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                          } transition-colors`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <label className={`block text-xs font-medium mb-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Reasoning
                      </label>
                      <input
                        type="text"
                        value={target.reasoning || ''}
                        onChange={(e) => handleTargetChange(index, 'reasoning', e.target.value)}
                        placeholder="Why this target value?"
                        className={`w-full px-3 py-2 text-sm rounded-lg border ${
                          isDarkMode 
                            ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Seed Button */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={seedTargets}
                  disabled={!selectedCampaign || targets.length === 0 || loading}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg ${
                    isDarkMode
                      ? 'bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-600'
                      : 'bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-300'
                  } disabled:cursor-not-allowed transition-colors font-medium`}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Seeding Targets...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Seed Campaign Targets
                    </>
                  )}
                </button>
                <p className={`text-xs mt-2 text-center ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  This will trigger AI analysis to generate optimized targets for all centers and agents
                </p>
              </div>
            </div>
          </div>

          {/* AI Insights Panel */}
          <div className="lg:col-span-1">
            <div className={`rounded-xl border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            } p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <Brain className={`w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  AI Insights
                </h3>
              </div>

              {aiAnalysis ? (
                <div className="space-y-4">
                  {/* Performance Summary */}
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Performance Summary
                    </h4>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {aiAnalysis.performance_summary.current_performance}
                    </p>
                  </div>

                  {/* Target Recommendations */}
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      AI Recommendations
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Leads/Day:
                        </span>
                        <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {aiAnalysis.target_recommendations.leads_per_day}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Quality Rate:
                        </span>
                        <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {aiAnalysis.target_recommendations.quality_rate}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Conversion Rate:
                        </span>
                        <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {aiAnalysis.target_recommendations.conversion_rate}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Insights */}
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Key Insights
                    </h4>
                    <ul className="space-y-1">
                      {aiAnalysis.insights.patterns_identified.slice(0, 3).map((pattern, index) => (
                        <li key={index} className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          • {pattern}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Items */}
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                  }`}>
                    <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Action Items
                    </h4>
                    <div className="space-y-2">
                      {aiAnalysis.action_items.slice(0, 2).map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1 ${
                            item.priority === 'high' ? 'bg-red-400' :
                            item.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                          }`} />
                          <div>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {item.action}
                            </p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                              {item.timeline}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className={`w-12 h-12 mx-auto mb-3 ${
                    isDarkMode ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Select a campaign and run AI analysis to see insights and recommendations
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AITargets
