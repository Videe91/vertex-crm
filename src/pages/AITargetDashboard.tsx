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
  Play,
  ArrowRight,
  ArrowDown
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface Campaign {
  id: number
  campaign_name: string
  campaign_type: string
  country: string
}

interface Center {
  id: number
  name: string
  country: string
}

interface CampaignTarget {
  id: number
  campaign_id: number
  target_type: string
  target_value: number
  target_period: string
  created_at: string
  ai_reasoning: string
}

interface CenterTarget {
  id: number
  center_id: number
  center_name: string
  campaign_id: number
  target_type: string
  target_value: number
  adjustment_factor: number
  ai_confidence: number
  ai_reasoning: string
  agent_count: number
  created_at: string
}

interface AgentTarget {
  id: number
  agent_id: number
  agent_name: string
  agent_alias: string
  center_id: number
  campaign_id: number
  target_type: string
  target_value: number
  ai_confidence: number
  ai_reasoning: string
  created_at: string
}

const AITargetDashboard: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null)
  const [selectedCenter, setSelectedCenter] = useState<number | null>(null)
  const [showAgents, setShowAgents] = useState(false)
  const [campaignTargets, setCampaignTargets] = useState<CampaignTarget[]>([])
  const [centerTargets, setCenterTargets] = useState<CenterTarget[]>([])
  const [agentTargets, setAgentTargets] = useState<AgentTarget[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  useEffect(() => {
    if (selectedCampaign) {
      console.log('Selected campaign changed to:', selectedCampaign)
      fetchCampaignTargets(selectedCampaign)
      fetchCampaignCenters(selectedCampaign)
      setSelectedCenter(null)
      setShowAgents(false)
    }
  }, [selectedCampaign])

  useEffect(() => {
    if (selectedCenter && selectedCampaign) {
      fetchCenterTargets(selectedCenter, selectedCampaign)
      setShowAgents(false)
    }
  }, [selectedCenter, selectedCampaign])

  useEffect(() => {
    if (showAgents && selectedCenter && selectedCampaign) {
      fetchAgentTargets(selectedCenter, selectedCampaign)
    }
  }, [showAgents, selectedCenter, selectedCampaign])

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

  const fetchCampaignTargets = async (campaignId: number) => {
    setLoading(true)
    try {
      const response = await apiService.get(`/api/targets/campaign/${campaignId}`)
      if (response.success) {
        setCampaignTargets(response.targets || [])
      }
    } catch (error) {
      console.error('Error fetching campaign targets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCampaignCenters = async (campaignId: number) => {
    try {
      console.log('Fetching centers for campaign:', campaignId)
      // Temporarily use test endpoint
      const response = await fetch(`http://localhost:3000/api/test/centers/${campaignId}`)
      const data = await response.json()
      console.log('Centers response:', data)
      if (data.success) {
        setCenters(data.centers || [])
        console.log('Centers set:', data.centers)
      } else {
        console.error('Centers fetch failed:', data)
      }
    } catch (error) {
      console.error('Error fetching centers:', error)
    }
  }

  const fetchCenterTargets = async (centerId: number, campaignId: number) => {
    setLoading(true)
    try {
      const response = await apiService.get(`/api/targets/center/${centerId}?campaign_id=${campaignId}`)
      if (response.success) {
        setCenterTargets(response.targets || [])
      }
    } catch (error) {
      console.error('Error fetching center targets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgentTargets = async (centerId: number, campaignId: number) => {
    setLoading(true)
    try {
      const response = await apiService.get(`/api/targets/agents/center/${centerId}?campaign_id=${campaignId}`)
      if (response.success) {
        setAgentTargets(response.targets || [])
      }
    } catch (error) {
      console.error('Error fetching agent targets:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTargetType = (type: string) => {
    const typeNames: Record<string, string> = {
      'transfers_per_day': 'Transfers/Day',
      'installs_per_day': 'Installs/Day',
      'leads_per_day': 'Leads/Day',
      'quality_rate': 'Quality Rate',
      'conversion_rate': 'Conversion Rate'
    }
    return typeNames[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500'
    if (confidence >= 0.6) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High'
    if (confidence >= 0.6) return 'Medium'
    return 'Low'
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Floating Sidebar */}
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode}
        activeItem="ai-targets"
      />
      
      {/* Main Content */}
      <div className="flex-1 ml-24 transition-all duration-300">
        {/* Top Header */}
        <Header title="AI Target Dashboard" isDarkMode={isDarkMode} />
        
        <div className="p-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Brain className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                AI-Generated Targets
              </h2>
            </div>
            <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              View AI-generated targets across campaigns, centers, and agents
            </p>
          </div>

        {/* Selection Controls */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
          <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Target Navigation
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Campaign Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                1. Select Campaign
              </label>
              <select
                value={selectedCampaign || ''}
                onChange={(e) => setSelectedCampaign(Number(e.target.value) || null)}
                title="Select campaign to view AI targets"
                aria-label="Select campaign to view AI-generated targets"
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">Select a campaign...</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.campaign_name} ({campaign.country})
                  </option>
                ))}
              </select>
            </div>

            {/* Center Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                2. Select Center
              </label>
              <select
                value={selectedCenter || ''}
                onChange={(e) => setSelectedCenter(Number(e.target.value) || null)}
                disabled={!selectedCampaign || centers.length === 0}
                title="Select center to view center targets"
                aria-label="Select center to view AI-generated center targets"
                className={`w-full px-3 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white disabled:bg-gray-800 disabled:text-gray-500' 
                    : 'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400'
                }`}
              >
                <option value="">
                  {centers.length === 0 
                    ? (selectedCampaign ? 'Loading centers...' : 'Select a campaign first') 
                    : 'Select a center...'
                  }
                </option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name} ({center.country})
                  </option>
                ))}
              </select>
              {/* Debug info */}
              {selectedCampaign && (
                <div className="mt-2 text-xs text-gray-500">
                  Debug: {centers.length} centers found for campaign {selectedCampaign}
                </div>
              )}
            </div>

            {/* Agent View Toggle */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                3. View Agents
              </label>
              <button
                onClick={() => setShowAgents(!showAgents)}
                disabled={!selectedCenter}
                className={`w-full px-3 py-2 rounded-lg border text-left ${
                  showAgents
                    ? isDarkMode
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-blue-500 border-blue-400 text-white'
                    : isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500'
                      : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400'
                }`}
              >
                {showAgents ? 'Viewing All Agents' : 'Show All Agents'}
              </button>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Loading targets...</p>
          </div>
        )}

        {/* Campaign Targets (Always show when campaign selected) */}
        {selectedCampaign && !loading && (
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-6 h-6 text-blue-500" />
              <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Campaign Targets (Seed)
              </h2>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Super Admin Set
              </span>
            </div>
            
            {campaignTargets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaignTargets.map((target) => (
                  <div key={target.id} className={`p-4 rounded-lg border ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {formatTargetType(target.target_type)}
                      </h3>
                      <span className="text-2xl font-bold text-blue-500">
                        {target.target_value}
                      </span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {target.ai_reasoning || 'Base campaign target'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  No campaign targets set. Go to AI Target Management to seed targets.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Center Targets (Show when center selected) */}
        {selectedCenter && !loading && (
          <>
            {campaignTargets.length > 0 && (
              <div className="flex justify-center mb-8">
                <ArrowDown className="w-8 h-8 text-gray-400" />
              </div>
            )}
            
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
              <div className="flex items-center gap-3 mb-4">
                <Building2 className="w-6 h-6 text-green-500" />
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Center Targets (AI Generated)
                </h2>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  AI Optimized
                </span>
              </div>
              
              {centerTargets.length > 0 ? (
                <div className="space-y-4">
                  {centerTargets.map((target) => (
                    <div key={target.id} className={`p-4 rounded-lg border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {formatTargetType(target.target_type)}
                          </h3>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {target.agent_count} agents in this center
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-green-500">
                            {target.target_value}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs ${getConfidenceColor(target.ai_confidence)}`}>
                              {getConfidenceLabel(target.ai_confidence)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {(target.adjustment_factor * 100).toFixed(0)}% adj
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {target.ai_reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    No center targets generated yet. Seed campaign targets first.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Agent Targets (Show when "Show All Agents" is clicked) */}
        {showAgents && selectedCenter && !loading && (
          <>
            {centerTargets.length > 0 && (
              <div className="flex justify-center mb-8">
                <ArrowDown className="w-8 h-8 text-gray-400" />
              </div>
            )}
            
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-purple-500" />
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Agent Targets (AI Personalized)
                </h2>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                  Performance Based
                </span>
              </div>
              
              {agentTargets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agentTargets.map((target) => (
                    <div key={target.id} className={`p-4 rounded-lg border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {target.agent_name} {target.agent_alias && `(${target.agent_alias})`}
                          </h3>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {formatTargetType(target.target_type)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-purple-500">
                            {target.target_value}
                          </span>
                          <div className={`text-xs mt-1 ${getConfidenceColor(target.ai_confidence)}`}>
                            {getConfidenceLabel(target.ai_confidence)}
                          </div>
                        </div>
                      </div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {target.ai_reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    No agent targets generated yet. Center targets must be created first.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}

export default AITargetDashboard
