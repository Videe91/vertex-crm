import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface SalesLog {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  validation_status: 'clean' | 'rejected' | 'pending'
  forwarded_to_client: boolean
  forwarded_at: string
  created_at: string
  center_code: string
  center_name: string
  form_name: string
  campaign_name: string
  client_rate: number
  payment_type: string
  validation_passed: boolean
  blacklist_status: string
  blacklist_message: string
  blacklist2_status: string
  blacklist2_message: string
  tcpa_status: string
  denial_reason: string
  potential_revenue: number
  commission_amount: number
  profit: number
  agent_info: {
    id: number | null
    name: string
    username: string
    type: 'specific' | 'center'
    center_id?: number
  } | null
  status_updater_info: {
    name: string
  } | null
  blacklist_details: any
  blacklist2_details: any
  tcpa_details: any
  sales_status: string
  status_updated_at: string
  status_updated_by: number
  status_notes: string
}

interface SalesSummary {
  total_submissions: number
  clean_leads: number
  rejected_leads: number
  forwarded_leads: number
  transferred_leads: number
  installed_leads: number
  potential_revenue: number
  success_rate: number
}

interface Campaign {
  id: number
  campaign_name: string
}

interface Center {
  id: number
  name: string
  code: string
}

const getSalesStatusColor = (status: string) => {
  const colorMap: { [key: string]: string } = {
    'transferred': 'text-blue-600',
    'paid': 'text-green-600',
    'dropped': 'text-red-600',
    'installed': 'text-green-600',
    'cancelled': 'text-gray-600',
    'follow-up': 'text-orange-600'
  }
  return colorMap[status] || 'text-gray-500'
}

const SalesLogs: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()

  // State management
  const [logs, setLogs] = useState<SalesLog[]>([])
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)

  // Filters
  const [filters, setFilters] = useState({
    campaign_id: '',
    center_id: '',
    agent_id: '',
    start_date: '',
    end_date: '',
    status: 'all'
  })

  useEffect(() => {
    if (user && user.id) {

      fetchCampaigns()
      fetchSalesLogs()
      fetchSummary()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchSalesLogs()
      fetchSummary()
    }
  }, [filters])

  // Fetch centers when campaign is selected
  useEffect(() => {
    if (user && filters.campaign_id) {
      fetchCentersForCampaign(filters.campaign_id)
      // Reset center and agent filters when campaign changes
      setFilters(prev => ({ ...prev, center_id: '', agent_id: '' }))
    } else {
      setCenters([])
    }
  }, [filters.campaign_id, user])

  // Fetch agents when campaign is selected (for center admins)
  useEffect(() => {
    if (user && user.role === 'center_admin' && filters.campaign_id) {
      const centerId = user.center?.id || user.center_id
      if (centerId) {
        fetchAgentsForCampaign(filters.campaign_id)
        // Reset agent filter when campaign changes
        setFilters(prev => ({ ...prev, agent_id: '' }))
      }
    } else {
      setAgents([])
    }
  }, [filters.campaign_id, user])

  const fetchCampaigns = async () => {
    try {
      // Ensure user data is loaded before making API calls
      if (!user) {
        console.log('User not loaded yet, skipping campaign fetch')
        return
      }

      let response;
      
      if (user.role === 'center_admin' || user.role === 'agent') {
        // Get center_id from user.center.id or fallback to user.center_id
        const centerId = user.center?.id || user.center_id
        
        // Validate that center_id exists
        if (!centerId) {
          console.error('Center ID is missing for center admin/agent:', user)
          return
        }
        

        // For center admins and agents, get campaigns assigned to their center
        response = await apiService.get(`centers/${centerId}/campaigns`)
      } else if (user.role === 'super_admin') {
        console.log('Fetching all campaigns for super admin')
        // For super admins, get all campaigns
        response = await apiService.get('campaigns')
      } else {
        console.error('Unknown user role:', user.role)
        return
      }
      
      if (response.success) {
        const mappedCampaigns = response.data.map((campaign: any) => ({
          id: campaign.campaign_id || campaign.id,
          campaign_name: campaign.campaign_name
        }))

        setCampaigns(mappedCampaigns)
      } else {
        console.error('Failed to fetch campaigns:', response.error)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  const fetchCentersForCampaign = async (campaignId: string) => {
    try {
      const response = await apiService.get(`campaigns/${campaignId}/centers`)
      if (response.success) {
        setCenters(response.data.map((center: any) => ({
          id: center.id,
          name: center.name,
          code: center.code
        })))
      }
    } catch (error) {
      console.error('Error fetching centers for campaign:', error)
      setCenters([])
    }
  }

  const fetchAgentsForCampaign = async (campaignId: string) => {
    try {
      const response = await apiService.get(`campaigns/${campaignId}/agents`)
      if (response.success) {
        setAgents(response.data.map((agent: any) => ({
          id: agent.id,
          first_name: agent.first_name,
          last_name: agent.last_name,
          username: agent.username
        })))
      }
    } catch (error) {
      console.error('Error fetching agents for campaign:', error)
      setAgents([])
    }
  }

  const fetchSalesLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value)
        }
      })

      const response = await apiService.get(`sales-logs?${params.toString()}`)
      if (response.success) {
        setLogs(response.data)
      }
    } catch (error) {
      console.error('Error fetching sales logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      const params = new URLSearchParams()
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.append(key, value)
        }
      })

      const response = await apiService.get(`sales-logs/summary?${params.toString()}`)
      if (response.success) {
        setSummary(response.data)
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'clean':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
  }

  const getValidationIcon = (status: string) => {
    switch (status) {
      case 'clean':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Helper function to determine if financial data should be shown
  const shouldShowFinancialData = (log: SalesLog) => {
    console.log('Checking financial data for log:', {
      campaign: log.campaign_name,
      payment_type: log.payment_type,
      sales_status: log.sales_status,
      customer: log.first_name + ' ' + log.last_name
    })
    
    // For "per install" campaigns, only show financial data when status is "installed"
    if (log.payment_type === 'per install') {
      const shouldShow = log.sales_status === 'installed'
      console.log('Per install campaign - should show financial data:', shouldShow)
      return shouldShow
    }
    
    // For other payment types, show financial data for all statuses (existing behavior)
    console.log('Non per-install campaign - showing financial data for all statuses')
    return true
  }

  // Helper function to determine what financial data to show based on user role
  const getFinancialDataToShow = (log: SalesLog, userRole: string) => {
    if (!shouldShowFinancialData(log)) {
      return { showCommission: false, showProfit: false }
    }

    if (userRole === 'center_admin') {
      // Center admin only sees commission
      return { showCommission: true, showProfit: false }
    } else if (userRole === 'super_admin') {
      // Super admin sees both commission and profit
      return { showCommission: true, showProfit: true }
    }

    // Agents see nothing
    return { showCommission: false, showProfit: false }
  }

  const handleStatusChange = async (leadId: number, newStatus: string) => {
    try {
      setUpdatingStatus(leadId)
      
      const response = await apiService.post(`sales-logs/${leadId}/update-status`, {
        sales_status: newStatus,
        status_notes: '' // Empty notes for quick status changes
      })

      if (response.success) {
        // Update the local state to reflect the change immediately
        setLogs(prevLogs => 
          prevLogs.map(log => 
            log.id === leadId 
              ? { 
                  ...log, 
                  sales_status: newStatus,
                  status_updated_at: new Date().toISOString(),
                  status_updated_by: user?.id || 0
                }
              : log
          )
        )
        
        // Refresh summary to reflect changes
        fetchSummary()
      } else {
        console.error('Failed to update status:', response.error)
        alert('Failed to update status: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Error updating status. Please try again.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getValidationMessageColor = (message: string, status: string) => {
    if (!message && !status) return 'text-gray-500'
    
    const messageText = (message || status).toLowerCase()
    
    // Red for rejection/blocked messages
    if (messageText.includes('statednc') || 
        messageText.includes('blacklisted') || 
        messageText.includes('blocked') || 
        messageText.includes('rejected') || 
        messageText.includes('dnc') ||
        messageText.includes('federal') ||
        messageText.includes('state') ||
        messageText.includes('complainers') ||
        messageText.includes('litigator') ||
        status === 'rejected' ||
        status === 'blocked') {
      return 'text-red-500 font-medium'
    }
    
    // Green for clean/good messages
    if (messageText.includes('good') || 
        messageText.includes('clean') || 
        status === 'success' || 
        status === 'clean') {
      return 'text-green-500 font-medium'
    }
    
    // Yellow for pending/unknown
    return 'text-yellow-500'
  }

  if (loading && logs.length === 0) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'dark bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
        activeItem="sales-logs"
      />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`p-3 rounded-2xl ${
              isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
            }`}>
              <FileText className={`w-8 h-8 ${
                isDarkMode ? 'text-orange-400' : 'text-orange-600'
              }`} />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Sales & Validation Logs
              </h1>
              <p className={`mt-2 text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Monitor lead submissions, phone validations, and sales performance
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className={`rounded-xl p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              } border`}>
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Total Submissions
                    </p>
                    <p className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {(summary.total_submissions || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              } border`}>
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Clean Leads
                    </p>
                    <p className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {(summary.clean_leads || 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-green-500 font-medium">
                      {(summary.success_rate || 0).toFixed(1)}% success rate
                    </p>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              } border`}>
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
                    <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Transferred
                    </p>
                    <p className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {(summary.transferred_leads || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-6 ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              } border`}>
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-4">
                    <p className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Installed
                    </p>
                    <p className={`text-2xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {(summary.installed_leads || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Campaign
              </label>
              <select
                value={filters.campaign_id}
                onChange={(e) => handleFilterChange('campaign_id', e.target.value)}
                title="Select Campaign"
                className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
                } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              >
                <option value="">All Campaigns</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.campaign_name}
                  </option>
                ))}
              </select>
            </div>

            {user?.role === 'center_admin' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Agent
                </label>
                <select
                  value={filters.agent_id}
                  onChange={(e) => handleFilterChange('agent_id', e.target.value)}
                  disabled={!filters.campaign_id}
                  title="Select Agent"
                  className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    !filters.campaign_id ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">
                    {!filters.campaign_id 
                      ? 'Select campaign first' 
                      : agents.length === 0 
                        ? 'No agents for this campaign'
                        : 'All Agents'
                    }
                  </option>
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.first_name} {agent.last_name} ({agent.username})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {user?.role === 'super_admin' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Center
                </label>
                <select
                  value={filters.center_id}
                  onChange={(e) => handleFilterChange('center_id', e.target.value)}
                  disabled={!filters.campaign_id}
                  title="Select Center"
                  className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                      : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    !filters.campaign_id ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">
                    {!filters.campaign_id 
                      ? 'Select campaign first' 
                      : centers.length === 0 
                        ? 'No centers for this campaign'
                        : 'All Centers'
                    }
                  </option>
                  {centers.map(center => (
                    <option key={center.id} value={center.id}>
                      {center.name} ({center.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Start Date
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                title="Select Start Date"
                placeholder="Select start date"
                className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500 [color-scheme:dark]'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500 [color-scheme:light]'
                } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                End Date
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                title="Select End Date"
                placeholder="Select end date"
                className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500 [color-scheme:dark]'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500 [color-scheme:light]'
                } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                title="Select Status"
                className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                    : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
                } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              >
                <option value="all">All Status</option>
                <option value="clean">Clean</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sales Logs Table */}
        <div className={`rounded-xl border overflow-hidden ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${
                isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
              }`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Customer
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Agent
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Phone Validation
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Campaign
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Center
                  </th>
                  {user?.role !== 'agent' && (
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Commission / Profit
                    </th>
                  )}
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Sales Status
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Date
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${
                isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
              }`}>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className={`hover:bg-opacity-50 ${
                      isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-6 py-4">
                        <div>
                          <div className={`text-sm font-medium ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {log.first_name} {log.last_name}
                          </div>
                          <div className={`text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {log.email}
                          </div>
                          <div className={`text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {log.phone}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          {log.agent_info ? (
                            <>
                              <div className={`text-sm font-medium ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                {log.agent_info.name}
                              </div>
                              <div className={`text-sm ${
                                log.agent_info.type === 'specific' 
                                  ? (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                                  : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                              }`}>
                                {log.agent_info.type === 'specific' ? `@${log.agent_info.username}` : log.agent_info.username}
                              </div>

                              {log.agent_info.type === 'center' && (
                                <div className={`text-xs italic ${
                                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                                }`}>
                                  Center Submission
                                </div>
                              )}
                            </>
                          ) : (
                            <div className={`text-sm italic ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              Public Submission
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getValidationIcon(log.validation_status)}
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            getStatusBadge(log.validation_status)
                          }`}>
                            {log.validation_status}
                          </span>
                        </div>
                        <div className="mt-1 text-xs space-y-1">
                          <div className={`${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Blacklist: <span className={getValidationMessageColor(log.blacklist_message, log.blacklist_status)}>
                              {log.blacklist_message || log.blacklist_status}
                            </span>
                          </div>
                          <div className={`${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Blacklist2: <span className={getValidationMessageColor(log.blacklist2_message, log.blacklist2_status)}>
                              {log.blacklist2_message || log.blacklist2_status}
                            </span>
                          </div>
                          <div className={`${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            TCPA: <span className={getValidationMessageColor(log.tcpa_status, log.tcpa_status)}>
                              {log.tcpa_status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-medium ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {log.campaign_name}
                        </div>
                        <div className={`text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {log.form_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-medium ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {log.center_name}
                        </div>
                        <div className={`text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {log.center_code}
                        </div>
                      </td>
                      {user?.role !== 'agent' && (() => {
                        const financialData = getFinancialDataToShow(log, user?.role || '')
                        
                        if (!financialData.showCommission && !financialData.showProfit) {
                          return (
                            <td className="px-6 py-4">
                              <div className={`text-sm ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {log.payment_type === 'per install' && log.sales_status !== 'installed' 
                                  ? 'Commission on install only' 
                                  : 'No financial data'}
                              </div>
                            </td>
                          )
                        }

                        return (
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {financialData.showCommission && (
                                <div className={`text-sm font-medium ${
                                  log.forwarded_to_client ? 'text-blue-600' : 'text-gray-500'
                                }`}>
                                  Commission: {formatCurrency(log.commission_amount)}
                                </div>
                              )}
                              {financialData.showProfit && (
                                <div className={`text-sm font-medium ${
                                  log.forwarded_to_client && log.profit > 0 ? 'text-green-600' : 
                                  log.forwarded_to_client && log.profit < 0 ? 'text-red-600' : 'text-gray-500'
                                }`}>
                                  Profit: {formatCurrency(log.profit)}
                                </div>
                              )}
                              <div className={`text-xs ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {log.forwarded_to_client ? 'Forwarded' : 'Not forwarded'}
                              </div>
                            </div>
                          </td>
                        )
                      })()}
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="relative">
                            <select
                              value={log.sales_status}
                              onChange={(e) => handleStatusChange(log.id, e.target.value)}
                              disabled={updatingStatus === log.id}
                              className={`text-sm font-medium border rounded-md px-3 py-2 cursor-pointer transition-all duration-200 min-w-[120px] ${
                                getSalesStatusColor(log.sales_status)
                              } ${
                                updatingStatus === log.id
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:shadow-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                              } ${
                                isDarkMode 
                                  ? 'bg-gray-800 border-gray-600 text-white focus:bg-gray-700' 
                                  : 'bg-white border-gray-300 text-gray-900 focus:bg-gray-50'
                              }`}
                              title={updatingStatus === log.id ? "Updating status..." : "Change sales status"}
                            >
                              <option value="transferred">Transferred</option>
                              <option value="paid">Paid</option>
                              <option value="dropped">Dropped</option>
                              <option value="installed">Installed</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="follow-up">Follow-up</option>
                            </select>
                            {updatingStatus === log.id && (
                              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent"></div>
                              </div>
                            )}
                          </div>
                          {log.status_updated_at && (
                            <div className={`text-xs ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Updated: {formatDate(log.status_updated_at)}
                            </div>
                          )}
                          {log.status_updater_info && (
                            <div className={`text-xs ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              By: {log.status_updater_info.name}
                            </div>
                          )}
                          {log.status_notes && (
                            <div className={`text-xs italic ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              "{log.status_notes}"
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {formatDate(log.created_at)}
                        </div>
                        {log.forwarded_at && (
                          <div className={`text-xs ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Forwarded: {formatDate(log.forwarded_at)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          title={expandedLog === log.id ? "Hide Details" : "Show Details"}
                          className={`text-sm font-medium transition-colors duration-200 ${
                            isDarkMode
                              ? 'text-orange-400 hover:text-orange-300'
                              : 'text-orange-600 hover:text-orange-500'
                          }`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Details */}
                    {expandedLog === log.id && (
                      <tr>
                        <td colSpan={9} className={`px-6 py-4 ${
                          isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                        }`}>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Blacklist Alliance API Response */}
                            <div>
                              <h4 className={`text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                🛡️ Blacklist Alliance API
                              </h4>
                              <div className={`p-3 rounded-lg text-xs font-mono ${
                                isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {log.blacklist_details ? (
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(log.blacklist_details, null, 2)}
                                  </pre>
                                ) : (
                                  'No response data'
                                )}
                              </div>
                            </div>

                            {/* Second Blacklist API Response */}
                            <div>
                              <h4 className={`text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                🔒 Blacklist API 2 (NJycTUgrrpDdHua67TTX)
                              </h4>
                              <div className={`p-3 rounded-lg text-xs font-mono ${
                                isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {log.blacklist2_details ? (
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(log.blacklist2_details, null, 2)}
                                  </pre>
                                ) : (
                                  'No response data'
                                )}
                              </div>
                            </div>

                            {/* TCPA API Response */}
                            <div>
                              <h4 className={`text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                📞 TCPA Litigator List API
                              </h4>
                              <div className={`p-3 rounded-lg text-xs font-mono ${
                                isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {log.tcpa_details ? (
                                  <pre className="whitespace-pre-wrap">
                                    {JSON.stringify(log.tcpa_details, null, 2)}
                                  </pre>
                                ) : (
                                  'No response data'
                                )}
                              </div>
                            </div>
                          </div>

                          {log.denial_reason && (
                            <div className="mt-4">
                              <h4 className={`text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                ❌ Rejection Reason
                              </h4>
                              <p className={`text-sm ${
                                isDarkMode ? 'text-red-400' : 'text-red-600'
                              }`}>
                                {log.denial_reason}
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && !loading && (
            <div className="text-center py-12">
              <FileText className={`mx-auto h-12 w-12 ${
                isDarkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`mt-2 text-sm font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-900'
              }`}>
                No sales logs found
              </h3>
              <p className={`mt-1 text-sm ${
                isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Try adjusting your filters or date range.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SalesLogs
