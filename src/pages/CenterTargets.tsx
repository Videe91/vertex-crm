import React, { useState, useEffect } from 'react'
import { 
  Target, 
  TrendingUp, 
  Users, 
  Building2, 
  Brain,
  Zap,
  Calendar,
  BarChart3,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface Campaign {
  id: number
  campaign_name: string
  campaign_type: string
  payment_type: string
  client_name: string
}

interface CampaignTarget {
  id: number
  campaign_id: number
  target_type: string
  target_value: number
  created_at: string
  created_by: string
}

interface CenterTarget {
  id: number
  center_id: number
  center_name: string
  campaign_id: number
  campaign_name: string
  target_type: string
  target_value: number
  adjustment_factor: number
  ai_confidence: number
  ai_reasoning: string
  agent_count: number
  created_at: string
  is_active: boolean
}

interface AgentTarget {
  id: number
  agent_id: number
  agent_name: string
  agent_alias: string
  target_type: string
  target_value: number
  ai_confidence: number
  ai_reasoning: string
  created_at: string
}

interface PerformanceData {
  current_performance: any
  trend_analysis: any
  recommendations: string[]
}

const CenterTargets: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null)
  const [campaignTargets, setCampaignTargets] = useState<CampaignTarget[]>([])
  const [centerTargets, setCenterTargets] = useState<CenterTarget[]>([])
  const [agentTargets, setAgentTargets] = useState<AgentTarget[]>([])
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'agents'>('overview')

  useEffect(() => {
    if (user?.center_id) {
      fetchCampaigns()
    }
  }, [user?.center_id])

  useEffect(() => {
    if (selectedCampaign && user?.center_id) {
      fetchTargetData(selectedCampaign, user.center_id)
    }
  }, [selectedCampaign, user?.center_id])

  const fetchCampaigns = async () => {
    try {
      if (!user?.center_id) {
        console.error('Center ID not available for user:', user)
        return
      }

      // Use the center-specific campaigns endpoint
      const response = await apiService.get(`/api/centers/${user.center_id}/campaigns`)
      if (response.success) {
        // Map the response to match our Campaign interface
        const centerCampaigns = response.data?.map((campaign: any) => ({
          id: campaign.campaign_id || campaign.id,
          campaign_name: campaign.campaign_name,
          campaign_type: campaign.campaign_type,
          payment_type: campaign.payment_type,
          client_name: campaign.client_name
        })) || []
        setCampaigns(centerCampaigns)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  const fetchTargetData = async (campaignId: number, centerId: number) => {
    setLoading(true)
    try {
      // Fetch campaign seed targets
      const campaignResponse = await apiService.get(`/api/targets/campaign/${campaignId}`)
      if (campaignResponse.success) {
        setCampaignTargets(campaignResponse.data?.targets || [])
      }

      // Fetch center AI-generated targets
      const centerResponse = await apiService.get(`/api/targets/center/${centerId}?campaign_id=${campaignId}`)
      if (centerResponse.success) {
        setCenterTargets(centerResponse.data?.targets || [])
      }

      // Fetch agent targets
      const agentResponse = await apiService.get(`/api/targets/agents/center/${centerId}?campaign_id=${campaignId}`)
      if (agentResponse.success) {
        setAgentTargets(agentResponse.data?.targets || [])
      }

      // Fetch performance data
      const performanceResponse = await apiService.get(`/api/targets/center/${centerId}`)
      if (performanceResponse.success) {
        setPerformanceData(performanceResponse.data?.performance || null)
      }

    } catch (error) {
      console.error('Error fetching target data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTargetType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getTargetIcon = (type: string) => {
    if (type.includes('transfer')) return <ArrowRight className="w-4 h-4" />
    if (type.includes('install')) return <CheckCircle className="w-4 h-4" />
    if (type.includes('lead')) return <Users className="w-4 h-4" />
    return <Target className="w-4 h-4" />
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500'
    if (confidence >= 0.6) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High Confidence'
    if (confidence >= 0.6) return 'Medium Confidence'
    return 'Low Confidence'
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode}
        activeItem="targets"
        userRole="center_admin"
      />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Center Targets
              </h1>
              <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                View your performance targets and goals
              </p>
            </div>
            
            {selectedCampaign && (
              <button
                onClick={() => selectedCampaign && user?.center_id && fetchTargetData(selectedCampaign, user.center_id)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Data
              </button>
            )}
          </div>
        </div>

        {/* Campaign Selection */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-6 h-6 text-orange-500" />
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Campaign
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => setSelectedCampaign(campaign.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedCampaign === campaign.id
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : `border-gray-200 dark:border-gray-700 hover:border-orange-300 ${
                        isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                      }`
                }`}
              >
                <div className="text-left">
                  <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {campaign.campaign_name}
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {campaign.campaign_type} • {campaign.payment_type}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Data */}
        {selectedCampaign && (
          <>
            {/* Tabs */}
            <div className="flex space-x-1 mb-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-orange-600 text-white'
                    : `${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                }`}
              >
                Center Targets
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'agents'
                    ? 'bg-orange-600 text-white'
                    : `${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`
                }`}
              >
                Individual Targets
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="space-y-8">
                    {/* Combined Targets Display */}
                    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
                      <div className="flex items-center gap-3 mb-6">
                        <Target className="w-6 h-6 text-orange-500" />
                        <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Your Center Targets
                        </h3>
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                          Current Goals
                        </span>
                      </div>
                      
                      {/* Display all targets (prioritize center targets, fallback to campaign targets) */}
                      {centerTargets.length > 0 ? (
                        <div className="space-y-4">
                          {centerTargets.map((target) => (
                            <div key={target.id} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getTargetIcon(target.target_type)}
                                  <div>
                                    <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {formatTargetType(target.target_type)}
                                    </h4>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      For {target.agent_count} agents in your center
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {target.target_value}
                                  </div>
                                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    per day
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : campaignTargets.length > 0 ? (
                        <div className="space-y-4">
                          {campaignTargets.map((target) => (
                            <div key={target.id} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {getTargetIcon(target.target_type)}
                                  <div>
                                    <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                      {formatTargetType(target.target_type)}
                                    </h4>
                                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Campaign target
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {target.target_value}
                                  </div>
                                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    per day
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            No targets set yet
                          </p>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
                            Targets will appear once they are configured for this campaign
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'agents' && (
                  <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
                    <div className="flex items-center gap-3 mb-6">
                      <Users className="w-6 h-6 text-orange-500" />
                      <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Individual Agent Targets
                      </h3>
                    </div>
                    
                    {agentTargets.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {agentTargets.reduce((acc: any[], target) => {
                          const existingAgent = acc.find(agent => agent.agent_id === target.agent_id)
                          if (existingAgent) {
                            existingAgent.targets.push(target)
                          } else {
                            acc.push({
                              agent_id: target.agent_id,
                              agent_name: target.agent_name,
                              agent_alias: target.agent_alias,
                              targets: [target]
                            })
                          }
                          return acc
                        }, []).map((agent) => (
                          <div key={agent.agent_id} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <div className="mb-3">
                              <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {agent.agent_alias || agent.agent_name}
                              </h4>
                              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {agent.agent_name}
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              {agent.targets.map((target: AgentTarget) => (
                                <div key={target.id} className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {getTargetIcon(target.target_type)}
                                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                      {formatTargetType(target.target_type)}
                                    </span>
                                  </div>
                                  <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                    {target.target_value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          No agent targets available
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} mt-2`}>
                          Agent targets will appear once AI analysis is complete
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CenterTargets
