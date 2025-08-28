import React, { useState, useEffect } from 'react'
import { 
  Target,
  Search,
  Filter,
  Globe,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  Phone,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface Campaign {
  id: number
  campaign_name: string
  campaign_type: string
  country: string
  campaign_status: string
  commission: number
  payment_type: string
  client_rate: number
  payment_frequency: string
  created_at: string
  center_commission?: number
  assignment_status?: string
  photo_url?: string
}

interface CampaignStats {
  totalCalls: number
  conversions: number
  revenue: number
  conversionRate: number
}

const CenterAdminCampaigns: React.FC = () => {
  const { isDarkMode, setIsDarkMode, user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [campaignStats, setCampaignStats] = useState<{ [key: number]: CampaignStats }>({})

  useEffect(() => {
    if (user) {
      fetchCampaigns()
    }
  }, [user])

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true)
      
      const centerId = user?.center?.id || user?.center_id
      
      if (!centerId) {
        console.error('No center ID found for user')
        return
      }

      const response = await apiService.get(`/api/centers/${centerId}/campaigns`)
      
      if (response.success) {
        setCampaigns(response.data || [])
        // Fetch stats for each campaign
        fetchCampaignStats(response.data || [])
      } else {
        console.error('Failed to fetch campaigns:', response.error)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCampaignStats = async (campaignList: Campaign[]) => {
    const stats: { [key: number]: CampaignStats } = {}
    
    // For now, we'll use mock data since we don't have call tracking yet
    // In the future, this would fetch real stats from the API
    campaignList.forEach(campaign => {
      stats[campaign.id] = {
        totalCalls: Math.floor(Math.random() * 500) + 100,
        conversions: Math.floor(Math.random() * 50) + 10,
        revenue: Math.floor(Math.random() * 10000) + 1000,
        conversionRate: Math.floor(Math.random() * 20) + 5
      }
    })
    
    setCampaignStats(stats)
  }

  const getCurrencySymbol = (country: string) => {
    switch (country?.toUpperCase()) {
      case 'US': return '$'
      case 'UK': return '£'
      case 'IN': return '₹'
      case 'AU': return 'A$'
      case 'CA': return 'C$'
      default: return '$'
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || campaign.campaign_status === filterStatus
    return matchesSearch && matchesFilter
  })

  if (isLoading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Sidebar isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeItem="campaigns" />
        <div className="ml-20 p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-300 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeItem="campaigns" />
      
      <div className="ml-20 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                My Campaigns
              </h1>
              <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Manage and track your assigned campaigns
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Campaigns: 
                </span>
                <span className={`ml-2 font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {campaigns.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-orange-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500'
              } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            />
          </div>
          
          <div className="relative">
            <Filter className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`pl-10 pr-8 py-3 rounded-lg border transition-colors appearance-none ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
              } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Campaigns Table */}
        {filteredCampaigns.length === 0 ? (
          <div className={`text-center py-12 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <Target className={`mx-auto w-12 h-12 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'} mb-4`} />
            <h3 className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'} mb-2`}>
              {searchTerm || filterStatus !== 'all' ? 'No campaigns found' : 'No campaigns assigned'}
            </h3>
            <p className={`${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
              {searchTerm || filterStatus !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Contact your super admin to get campaigns assigned to your center.'
              }
            </p>
          </div>
        ) : (
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
            {/* Table Header */}
            <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} px-6 py-4 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <div className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Campaign
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Commission
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Performance
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Revenue
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Status
                  </span>
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCampaigns.map((campaign) => {
                const stats = campaignStats[campaign.id] || { totalCalls: 0, conversions: 0, revenue: 0, conversionRate: 0 }
                const currencySymbol = getCurrencySymbol(campaign.country)
                
                return (
                  <div
                    key={campaign.id}
                    className={`px-6 py-4 hover:${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} transition-colors`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Campaign Info */}
                      <div className="col-span-4 flex items-center space-x-4">
                        {/* Campaign Image */}
                        <div className="flex-shrink-0">
                          {campaign.photo_url ? (
                            <img
                              src={campaign.photo_url}
                              alt={campaign.campaign_name}
                              className="w-12 h-12 rounded-lg object-cover border-2 border-orange-500"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center">
                              <Target className="w-6 h-6 text-white" />
                            </div>
                          )}
                        </div>
                        
                        {/* Campaign Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} truncate`}>
                            {campaign.campaign_name}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <Globe className="w-4 h-4 text-gray-500" />
                            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              {campaign.country}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} capitalize`}>
                              {campaign.campaign_type.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Commission */}
                      <div className="col-span-2 text-center">
                        <div className="flex items-center justify-center mb-1">
                          <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                          <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {currencySymbol}{campaign.center_commission || 0}
                          </span>
                        </div>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} capitalize`}>
                          {campaign.payment_frequency?.replace('_', ' ')}
                        </p>
                      </div>

                      {/* Performance */}
                      <div className="col-span-2 text-center">
                        <div className="flex items-center justify-center space-x-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <Phone className="w-4 h-4 text-blue-500 mr-1" />
                              <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {stats.totalCalls}
                              </span>
                            </div>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Calls
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-1">
                              <TrendingUp className="w-4 h-4 text-purple-500 mr-1" />
                              <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {stats.conversionRate}%
                              </span>
                            </div>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              Rate
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Revenue */}
                      <div className="col-span-2 text-center">
                        <div className="flex items-center justify-center mb-1">
                          <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                          <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {currencySymbol}{stats.revenue.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {stats.conversions} conversions
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-2 text-center">
                        <div className="flex items-center justify-center">
                          {/* Status Dot */}
                          <div className={`w-2.5 h-2.5 rounded-full mr-2 ${
                            campaign.campaign_status?.toLowerCase() === 'active' ? 'bg-green-500' :
                            campaign.campaign_status?.toLowerCase() === 'paused' ? 'bg-orange-500' :
                            campaign.campaign_status?.toLowerCase() === 'deleted' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}></div>
                          {/* Status Text */}
                          <span className={`text-sm font-medium capitalize ${
                            campaign.campaign_status?.toLowerCase() === 'active' ? (isDarkMode ? 'text-green-400' : 'text-green-600') :
                            campaign.campaign_status?.toLowerCase() === 'paused' ? (isDarkMode ? 'text-orange-400' : 'text-orange-600') :
                            campaign.campaign_status?.toLowerCase() === 'deleted' ? (isDarkMode ? 'text-red-400' : 'text-red-600') :
                            (isDarkMode ? 'text-gray-400' : 'text-gray-600')
                          }`}>
                            {campaign.campaign_status} Campaign
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CenterAdminCampaigns
