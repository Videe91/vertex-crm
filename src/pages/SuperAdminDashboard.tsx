import React from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target,
  Activity,
  ArrowUpRight,
  MoreHorizontal,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from '../components/Sidebar'
import Logo from '../components/Logo'
import Header from '../components/Header'

const SuperAdminDashboard: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()

  // Mock data - will be replaced with real API calls
  const dashboardData = {
    keyMetrics: {
      totalLeads: 12847,
      leadsChange: +12.5,
      activeCampaigns: 8,
      campaignsChange: +2,
      monthlyRevenue: 287420,
      revenueChange: +18.3,
      conversionRate: 31.2,
      conversionChange: +5.2
    },
    salesData: {
      thisMonth: 287420,
      lastMonth: 243180,
      chartData: [
        { month: 'Jan', value: 185000 },
        { month: 'Feb', value: 210000 },
        { month: 'Mar', value: 178000 },
        { month: 'Apr', value: 245000 },
        { month: 'May', value: 287420 },
      ]
    },
    recentActivities: [
      {
        id: 1,
        user: 'Sarah Johnson',
        action: 'New lead generated',
        campaign: 'Solar Campaign Q2',
        time: '2 minutes ago',
        type: 'lead'
      },
      {
        id: 2,
        user: 'Mike Chen',
        action: 'Campaign launched',
        campaign: 'Insurance Renewal Drive',
        time: '15 minutes ago',
        type: 'campaign'
      },
      {
        id: 3,
        user: 'Emily Davis',
        action: 'Quality audit completed',
        campaign: 'Solar Campaign Q2',
        time: '1 hour ago',
        type: 'qa'
      }
    ],
    systemStatus: {
      apiHealth: 'excellent',
      dbPerformance: 'good',
      activeUsers: 247,
      serverLoad: 23
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Independent Logo */}
      <Logo isDarkMode={isDarkMode} />

      {/* Floating Sidebar */}
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode}
        activeItem="dashboard"
      />

      {/* Main Content */}
      <div className="flex-1 ml-24 transition-all duration-300">
        {/* Top Header */}
        <Header title="Dashboard" isDarkMode={isDarkMode} />

        {/* Dashboard Content */}
        <div className="p-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <h2 className={`text-2xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Good morning, {user?.firstName || user?.name || 'Super Admin'}!
            </h2>
            <p className={`text-base ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Here's what's happening with your CRM today.
            </p>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area - 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Leads */}
              <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10' 
                  : 'bg-white/70 border border-gray-200/50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    isDarkMode 
                      ? 'bg-blue-500/20' 
                      : 'bg-blue-500/10'
                  }`}>
                    <Target className="w-6 h-6 text-blue-500" />
                  </div>
                  <MoreHorizontal className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatNumber(dashboardData.keyMetrics.totalLeads)}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total leads generated
                  </p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-green-500 text-sm font-medium">
                      +{dashboardData.keyMetrics.leadsChange}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Campaigns */}
              <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10' 
                  : 'bg-white/70 border border-gray-200/50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    isDarkMode 
                      ? 'bg-purple-500/20' 
                      : 'bg-purple-500/10'
                  }`}>
                    <Activity className="w-6 h-6 text-purple-500" />
                  </div>
                  <MoreHorizontal className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {dashboardData.keyMetrics.activeCampaigns}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Active campaigns
                  </p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-green-500 text-sm font-medium">
                      +{dashboardData.keyMetrics.campaignsChange}
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Revenue */}
              <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10' 
                  : 'bg-white/70 border border-gray-200/50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    isDarkMode 
                      ? 'bg-green-500/20' 
                      : 'bg-green-500/10'
                  }`}>
                    <DollarSign className="w-6 h-6 text-green-500" />
                  </div>
                  <MoreHorizontal className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {formatCurrency(dashboardData.keyMetrics.monthlyRevenue)}
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    This month's revenue
                  </p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-green-500 text-sm font-medium">
                      +{dashboardData.keyMetrics.revenueChange}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Conversion Rate */}
              <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10' 
                  : 'bg-white/70 border border-gray-200/50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${
                    isDarkMode 
                      ? 'bg-orange-500/20' 
                      : 'bg-orange-500/10'
                  }`}>
                    <TrendingUp className="w-6 h-6 text-orange-500" />
                  </div>
                  <MoreHorizontal className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {dashboardData.keyMetrics.conversionRate}%
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Conversion rate
                  </p>
                  <div className="flex items-center mt-2">
                    <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                    <span className="text-green-500 text-sm font-medium">
                      +{dashboardData.keyMetrics.conversionChange}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sales Chart */}
            <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/5 border border-white/10' 
                : 'bg-white/70 border border-gray-200/50'
            }`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Revenue Overview
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Monthly performance from all channels
                  </p>
                </div>
                <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isDarkMode 
                    ? 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50' 
                    : 'bg-gray-100/50 text-gray-600 hover:bg-gray-200/50'
                }`}>
                  Current Month
                </button>
              </div>

              {/* Simple Chart Placeholder */}
              <div className="h-64 relative">
                <div className={`absolute inset-0 rounded-xl flex items-center justify-center ${
                  isDarkMode ? 'bg-gray-800/30' : 'bg-gray-100/30'
                }`}>
                  <div className="text-center">
                    <BarChart3 className={`w-12 h-12 mx-auto mb-4 ${
                      isDarkMode ? 'text-gray-600' : 'text-gray-400'
                    }`} />
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Chart will be implemented with a charting library
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-6">
            {/* System Status */}
            <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/5 border border-white/10' 
                : 'bg-white/70 border border-gray-200/50'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                System Status
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    API Health
                  </span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-green-500 capitalize">
                      {dashboardData.systemStatus.apiHealth}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Database
                  </span>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-sm text-yellow-500 capitalize">
                      {dashboardData.systemStatus.dbPerformance}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Active Users
                  </span>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {dashboardData.systemStatus.activeUsers}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Server Load
                  </span>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {dashboardData.systemStatus.serverLoad}%
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Activities */}
            <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/5 border border-white/10' 
                : 'bg-white/70 border border-gray-200/50'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Recent Activities
              </h3>
              
              <div className="space-y-4">
                {dashboardData.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}>
                      {activity.user.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {activity.user}
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {activity.action}
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className={`p-6 rounded-2xl backdrop-blur-xl transition-all duration-300 ${
              isDarkMode 
                ? 'bg-white/5 border border-white/10' 
                : 'bg-white/70 border border-gray-200/50'
            }`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Quick Stats
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className={`w-4 h-4 mr-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Total Users
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    1,247
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Target className={`w-4 h-4 mr-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Centers
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    15
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Activity className={`w-4 h-4 mr-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                    <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Active Today
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    847
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default SuperAdminDashboard
