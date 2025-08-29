import React, { useState, useEffect } from 'react'
import { 
  Users, 
  DollarSign, 
  Target,
  Building2,
  X,
  Maximize2,
  Activity,
  UserCheck
} from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { useAuth } from '../contexts/AuthContext'

const CenterAdminDashboard: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()

  // Utility function to get data attributes for heatmap colors
  const getHeatmapDataAttrs = (intensity: number, isDark: boolean) => {
    if (intensity === 0) {
      return {
        'data-intensity': '0',
        'data-theme': isDark ? 'dark' : 'light'
      }
    }
    
    // Round to nearest supported intensity value
    const roundedIntensity = Math.round(Math.max(0.2, intensity) * 10) / 10
    const supportedIntensities = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1]
    const closestIntensity = supportedIntensities.reduce((prev, curr) => 
      Math.abs(curr - roundedIntensity) < Math.abs(prev - roundedIntensity) ? curr : prev
    )
    
    return {
      'data-intensity': closestIntensity.toString()
    }
  }
  const [centerData, setCenterData] = useState<any>(null)
  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalAgents: 0,
    activeAgents: 0,
    activeCampaigns: 0,
    todaysCalls: 0,
    todaysLeads: 0,
    conversionRate: 0,
    revenue: 0,
    avgCallDuration: '0:00',
    centerStatus: 'active'
  })
  const [loading, setLoading] = useState(true)



  // Daily Center Activity Chart states
  const [dailyActivityData, setDailyActivityData] = useState<any[]>([])
  const [loadingDailyActivity, setLoadingDailyActivity] = useState(true)
  const [activityTimePeriod, setActivityTimePeriod] = useState<'7' | '30' | '90'>('30')
  const [showActivityModal, setShowActivityModal] = useState(false)

  // Agent Attendance Heatmap states
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [loadingAttendance, setLoadingAttendance] = useState(true)
  const [attendancePeriod, setAttendancePeriod] = useState<'30' | '60' | '90'>('90')
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)

  // Fetch center-specific data
  useEffect(() => {
    const fetchCenterData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/center-admin/dashboard`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          console.log('Dashboard API Response:', data)
          console.log('Center Data:', data.center)
          setCenterData(data.center)
          setDashboardMetrics(data.metrics)
        } else {
          console.error('Failed to fetch dashboard data', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Error fetching center data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCenterData()
    fetchDailyActivityData()
    fetchAttendanceData()
  }, [])



  // Fetch daily activity data
  const fetchDailyActivityData = async () => {
    try {
      setLoadingDailyActivity(true)
      const response = await fetch(`/api/center-admin/daily-activity?days=${activityTimePeriod}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setDailyActivityData(data.activity || [])
      }
    } catch (error) {
      console.error('Error fetching daily activity:', error)
      setDailyActivityData([])
    } finally {
      setLoadingDailyActivity(false)
    }
  }

  // Fetch agent attendance heatmap data
  const fetchAttendanceData = async () => {
    try {
      setLoadingAttendance(true)
      const response = await fetch(`/api/center-admin/agent-attendance-heatmap?days=${attendancePeriod}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setAttendanceData(data)
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error)
      setAttendanceData(null)
    } finally {
      setLoadingAttendance(false)
    }
  }

  // Refetch activity data when time period changes
  useEffect(() => {
    if (user) {
      fetchDailyActivityData()
    }
  }, [activityTimePeriod, user])

  // Refetch attendance data when period changes
  useEffect(() => {
    if (user) {
      fetchAttendanceData()
    }
  }, [attendancePeriod, user])

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
        activeItem="dashboard"
        userRole="center_admin"
      />
      
      {/* Main Content */}
      <div className="flex-1 ml-16 sm:ml-20 lg:ml-24 transition-all duration-300 overflow-x-hidden">
        {/* Top Header */}
        <Header title="Center Dashboard" isDarkMode={isDarkMode} />
        
        <div className="p-4 sm:p-6 lg:p-8 max-w-full overflow-x-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Good morning, {user?.name}! Here's what's happening with your center today.
                </p>
              </div>
              
              {/* Center Info */}
              <div className={`flex items-center gap-4 px-6 py-3 rounded-xl backdrop-blur-md border ${
                isDarkMode
                  ? 'bg-white/10 border-white/20 shadow-lg'
                  : 'bg-white/70 border-white/30 shadow-lg'
              }`}>
                <Building2 className={`w-6 h-6 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                <div>
                  <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {centerData?.center_name || 'Loading...'}
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {centerData?.center_code || '...'} • {centerData?.country || '...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Active Agents */}
          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15'
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3 mr-4">
                <Users className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Active Agents
                </p>
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
                  </div>
                ) : (
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {dashboardMetrics.activeAgents}
                    </p>
                )}
              </div>
            </div>
          </div>

          {/* Active Campaigns */}
          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15'
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3 mr-4">
                <Target className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Active Campaigns
                </p>
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
                  </div>
                ) : (
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {dashboardMetrics.activeCampaigns}
                    </p>
                )}
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15'
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3 mr-4">
                <DollarSign className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Revenue
                </p>
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 rounded w-20 mb-2"></div>
                  </div>
                ) : (
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      ${dashboardMetrics.revenue.toLocaleString()}
                    </p>
                )}
              </div>
            </div>
          </div>

          {/* Today's Leads */}
          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15'
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3 mr-4">
                <Activity className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Today's Leads
                </p>
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
                  </div>
                ) : (
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {dashboardMetrics.todaysLeads}
                    </p>
                )}
              </div>
            </div>
          </div>

          {/* Conversion Rate */}
          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15'
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3 mr-4">
                <Target className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Conversion Rate
                </p>
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-300 rounded w-16 mb-2"></div>
                  </div>
                ) : (
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {dashboardMetrics.conversionRate}%
                    </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Charts Section */}
        <div className="space-y-8">

          {/* Daily Center Activity Chart */}
          <div 
            className={`rounded-xl backdrop-blur-md border transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
                : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
            }`}
            onClick={() => setShowActivityModal(true)}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-6 h-6 text-orange-500" />
                <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Daily Center Activity
                </h3>
                </div>
                <div className="flex items-center gap-4">
                  {/* Time Period Selector */}
                  <select 
                    value={activityTimePeriod}
                    onChange={(e) => {
                      e.stopPropagation()
                      setActivityTimePeriod(e.target.value as '7' | '30' | '90')
                    }}
                    className={`px-3 py-1 rounded-lg border text-sm ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                    title="Select time period for activity chart"
                    aria-label="Select time period for activity chart"
                  >
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="90">Last 90 Days</option>
                  </select>

                  <Maximize2 className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              {/* Chart */}
              <div className="h-64">
                {loadingDailyActivity ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : dailyActivityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyActivityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="date" 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: isDarkMode ? '#ffffff' : '#1f2937'
                        }}
                        formatter={(value: any, name: string) => [
                          value,
                          name === 'total_leads' ? 'Total Leads' :
                          name === 'successful_submissions' ? 'Successful Submissions' :
                          name === 'conversions' ? 'Conversions' : name
                        ]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="total_leads" 
                        stroke="#fb923c" 
                        strokeWidth={2}
                        dot={{ fill: '#fb923c', strokeWidth: 2, r: 4 }}
                        name="total_leads"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="successful_submissions" 
                        stroke="#f97316" 
                        strokeWidth={2}
                        dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                        name="successful_submissions"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="conversions" 
                        stroke="#ea580c" 
                        strokeWidth={2}
                        dot={{ fill: '#ea580c', strokeWidth: 2, r: 4 }}
                        name="conversions"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                <div className="text-center">
                      <Activity className={`w-12 h-12 mx-auto mb-4 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No activity data available
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Agent Attendance Heatmap */}
          <div 
            className={`rounded-xl backdrop-blur-md border transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
                : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
            }`}
            onClick={() => setShowAttendanceModal(true)}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-6 h-6 text-orange-500" />
                  <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Agent Attendance & Productivity
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  {/* Period Selector */}
                  <select 
                    value={attendancePeriod}
                    onChange={(e) => {
                      e.stopPropagation()
                      setAttendancePeriod(e.target.value as '30' | '60' | '90')
                    }}
                    className={`px-3 py-1 rounded-lg border text-sm ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                    title="Select time period for attendance heatmap"
                    aria-label="Select time period for attendance heatmap"
                  >
                    <option value="30">Last 30 Days</option>
                    <option value="60">Last 60 Days</option>
                    <option value="90">Last 90 Days</option>
                  </select>

                  <Maximize2 className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              {/* Heatmap */}
              <div className="space-y-4">
                {loadingAttendance ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : attendanceData?.agents?.length > 0 ? (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className={`p-3 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Total Agents
                        </p>
                        <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.total_agents}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Avg Attendance
                        </p>
                        <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.avg_attendance_rate}%
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Most Active
                        </p>
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.most_active_agent || 'N/A'}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Avg Productivity
                        </p>
                        <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.avg_productivity_score}
                        </p>
                      </div>
                    </div>

                    {/* Heatmap Grid - Show first 4 agents in overview */}
                    <div className="space-y-3">
                      {attendanceData.agents.slice(0, 4).map((agent: any) => (
                        <div key={agent.agent_id} className="flex items-center gap-4">
                          <div className={`w-24 text-sm font-medium truncate ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {agent.agent_name}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {agent.daily_data.slice(0, 42).map((day: any, dayIndex: number) => (
                              <div
                                key={`${agent.agent_id}-${dayIndex}`}
                                className={`w-3 h-3 rounded-sm cursor-pointer hover:scale-110 transition-transform duration-200 border heatmap-cell ${
                                  isDarkMode ? 'border-gray-600' : 'border-gray-200'
                                }`}
                                {...getHeatmapDataAttrs(day.intensity, isDarkMode)}
                                title={`${agent.agent_name}
📅 ${new Date(day.date).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}

🔐 Login Sessions: ${day.login_sessions}
⏰ Hours Worked: ${day.hours_worked}h
📊 Leads Submitted: ${day.leads_submitted}
📈 Activity Level: ${day.activity_level.replace('_', ' ').toUpperCase()}`}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/20">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Less
                        </span>
                        <div className="flex gap-1">
                          {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
                            <div
                              key={intensity}
                              className={`w-3 h-3 rounded-sm border heatmap-cell ${
                                isDarkMode ? 'border-gray-600' : 'border-gray-200'
                              }`}
                              {...getHeatmapDataAttrs(intensity, isDarkMode)}
                            />
                          ))}
                        </div>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          More
                        </span>
                      </div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Click to view all agents
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <UserCheck className={`w-12 h-12 mx-auto mb-4 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No attendance data available
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Daily Center Activity Modal */}
        {showActivityModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-6xl rounded-xl backdrop-blur-md border ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/90 border-white/30'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Activity className="w-6 h-6 text-orange-500" />
                    <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Daily Center Activity
                    </h3>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Time Period Selector */}
                    <select
                      value={activityTimePeriod}
                      onChange={(e) => setActivityTimePeriod(e.target.value as '7' | '30' | '90')}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      title="Select time period for activity chart"
                      aria-label="Select time period for activity chart"
                    >
                      <option value="7">Last 7 Days</option>
                      <option value="30">Last 30 Days</option>
                      <option value="90">Last 90 Days</option>
                    </select>

                    <button
                      onClick={() => setShowActivityModal(false)}
                      className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                          ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
                          : 'hover:bg-gray/10 text-gray-600 hover:text-gray-900'
                      }`}
                      title="Close modal"
                      aria-label="Close daily activity modal"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Full Chart */}
                <div className="h-96">
                  {loadingDailyActivity ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                    </div>
                  ) : dailyActivityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyActivityData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                        <XAxis 
                          dataKey="date" 
                          stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                          fontSize={14}
                        />
                        <YAxis 
                          stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                          fontSize={14}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                            border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                            borderRadius: '8px',
                            color: isDarkMode ? '#ffffff' : '#1f2937'
                          }}
                          formatter={(value: any, name: string) => [
                            value,
                            name === 'total_leads' ? 'Total Leads' :
                            name === 'successful_submissions' ? 'Successful Submissions' :
                            name === 'conversions' ? 'Conversions' : name
                          ]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="total_leads" 
                          stroke="#fb923c" 
                          strokeWidth={3}
                          dot={{ fill: '#fb923c', strokeWidth: 2, r: 5 }}
                          name="total_leads"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="successful_submissions" 
                          stroke="#f97316" 
                          strokeWidth={3}
                          dot={{ fill: '#f97316', strokeWidth: 2, r: 5 }}
                          name="successful_submissions"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="conversions" 
                          stroke="#ea580c" 
                          strokeWidth={3}
                          dot={{ fill: '#ea580c', strokeWidth: 2, r: 5 }}
                          name="conversions"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Activity className={`w-16 h-16 mx-auto mb-4 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                        <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          No activity data available
                        </p>
                        <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                          Activity data will appear here once leads are submitted
                        </p>
                      </div>
                    </div>
                  )}
                  </div>
              </div>
            </div>
          </div>
        )}

        {/* Agent Attendance Heatmap Modal */}
        {showAttendanceModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-7xl max-h-[90vh] overflow-y-auto rounded-xl backdrop-blur-md border ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/90 border-white/30'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-6 h-6 text-orange-500" />
                    <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Agent Attendance & Productivity Heatmap
                    </h3>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Period Selector */}
                    <select
                      value={attendancePeriod}
                      onChange={(e) => setAttendancePeriod(e.target.value as '30' | '60' | '90')}
                      className={`px-4 py-2 rounded-lg border text-sm ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      title="Select time period for attendance heatmap"
                      aria-label="Select time period for attendance heatmap"
                    >
                      <option value="30">Last 30 Days</option>
                      <option value="60">Last 60 Days</option>
                      <option value="90">Last 90 Days</option>
                    </select>

                    <button
                      onClick={() => setShowAttendanceModal(false)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode 
                          ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
                          : 'hover:bg-gray/10 text-gray-600 hover:text-gray-900'
                      }`}
                      title="Close modal"
                      aria-label="Close attendance heatmap modal"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {loadingAttendance ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  </div>
                ) : attendanceData?.agents?.length > 0 ? (
                  <div className="space-y-6">
                    {/* Enhanced Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Total Agents
                        </p>
                        <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.total_agents}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Avg Attendance
                        </p>
                        <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.avg_attendance_rate}%
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Most Active
                        </p>
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.most_active_agent || 'N/A'}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Avg Productivity
                        </p>
                        <p className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.stats.avg_productivity_score}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg ${
                        isDarkMode ? 'bg-white/5' : 'bg-white/50'
                      }`}>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          Time Period
                        </p>
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {attendanceData.date_range.total_days} Days
                        </p>
                      </div>
                    </div>

                    {/* Full Heatmap Grid */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            Daily Activity Heatmap
                          </h4>
                          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            📅 Real calendar view • Hover for detailed daily information • Each square = 1 day
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Less
                          </span>
                          <div className="flex gap-1">
                            {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
                              <div
                                key={intensity}
                                className={`w-3 h-3 rounded-sm border heatmap-cell ${
                                  isDarkMode ? 'border-gray-600' : 'border-gray-200'
                                }`}
                                {...getHeatmapDataAttrs(intensity, isDarkMode)}
                              />
                            ))}
                          </div>
                          <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            More
                          </span>
                        </div>
                      </div>

                      {/* Calendar Header */}
                      <div className="mb-4">
                        <div className="flex items-center gap-4 mb-2">
                          <div className="w-32"></div> {/* Spacer for agent names */}
                          <div className="flex gap-1 flex-wrap">
                            {attendanceData.agents[0]?.daily_data.slice(0, 14).map((day: any, index: number) => (
                              <div
                                key={`header-${index}`}
                                className={`w-3 h-4 text-xs flex items-center justify-center ${
                                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}
                                title={new Date(day.date).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              >
                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                              </div>
                            ))}
                            <div className={`w-3 h-4 text-xs flex items-center justify-center ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              ...
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* All Agents Heatmap */}
                      <div className="space-y-2">
                        {attendanceData.agents.map((agent: any) => (
                          <div key={agent.agent_id} className="flex items-center gap-4">
                            <div className={`w-32 text-sm font-medium truncate ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`} title={agent.agent_name}>
                              {agent.agent_name}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {agent.daily_data.map((day: any, dayIndex: number) => (
                                <div
                                  key={`${agent.agent_id}-${dayIndex}`}
                                                                    className={`w-3 h-3 rounded-sm cursor-pointer hover:scale-125 transition-transform duration-200 border heatmap-cell ${
                                    isDarkMode ? 'border-gray-600' : 'border-gray-200'
                                  }`}
                                  {...getHeatmapDataAttrs(day.intensity, isDarkMode)}
                                  title={`${agent.agent_name}
📅 ${new Date(day.date).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}

🔐 Login Sessions: ${day.login_sessions}
⏰ Hours Worked: ${day.hours_worked}h
🌅 First Login: ${day.first_login ? new Date(day.first_login).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
🌇 Last Activity: ${day.last_activity ? new Date(day.last_activity).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
📊 Leads Submitted: ${day.leads_submitted}
✅ Successful Submissions: ${day.successful_submissions}
🎯 Conversions: ${day.conversions}
📈 Activity Level: ${day.activity_level.replace('_', ' ').toUpperCase()}`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activity Level Legend */}
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? 'bg-white/5' : 'bg-white/50'
                    }`}>
                      <h5 className={`text-sm font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Activity Levels
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-sm border heatmap-cell ${
                              isDarkMode ? 'border-gray-600' : 'border-gray-200'
                            }`}
                            {...getHeatmapDataAttrs(0, isDarkMode)}
                          />
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            Absent
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-sm border heatmap-cell ${
                              isDarkMode ? 'border-gray-600' : 'border-gray-200'
                            }`}
                            {...getHeatmapDataAttrs(0.3, isDarkMode)}
                          />
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            Present Only
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-sm border heatmap-cell ${
                              isDarkMode ? 'border-gray-600' : 'border-gray-200'
                            }`}
                            {...getHeatmapDataAttrs(0.6, isDarkMode)}
                          />
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            Low Productivity
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-sm border heatmap-cell ${
                              isDarkMode ? 'border-gray-600' : 'border-gray-200'
                            }`}
                            {...getHeatmapDataAttrs(1, isDarkMode)}
                          />
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            High Productivity
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <UserCheck className={`w-16 h-16 mx-auto mb-4 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                      <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No attendance data available
                      </p>
                      <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                        Attendance data will appear here once agents start logging in
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

export default CenterAdminDashboard
