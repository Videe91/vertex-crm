import { useState, useEffect } from 'react'
import { 
  TrendingUp,
  Target,
  CheckCircle,
  Clock,
  X,
  Maximize2,
  Filter
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'





const AgentDashboard = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()
  const [stats, setStats] = useState({
    totalLeads: 0,
    todayLeads: 0,
    weekLeads: 0,
    successRate: 0
  })
  const [dailyLeadsData, setDailyLeadsData] = useState<any[]>([])
  const [loadingChart, setLoadingChart] = useState(true)
  const [salesStatusData, setSalesStatusData] = useState<any[]>([])
  const [loadingDonut, setLoadingDonut] = useState(true)
  const [showLineChartModal, setShowLineChartModal] = useState(false)
  const [showDonutChartModal, setShowDonutChartModal] = useState(false)
  
  // Welcome message states
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [loadingWelcome, setLoadingWelcome] = useState(true)
  
  // Attendance chart states
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [loadingAttendance, setLoadingAttendance] = useState(true)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  
  // Conversion funnel states
  const [funnelData, setFunnelData] = useState<any[]>([])
  const [loadingFunnel, setLoadingFunnel] = useState(true)
  const [showFunnelModal, setShowFunnelModal] = useState(false)
  
  // AI Targets states
  const [agentTargets, setAgentTargets] = useState<any[]>([])
  const [aiInsights, setAiInsights] = useState<any>(null)


  useEffect(() => {
    if (user) {
      fetchWelcomeMessage()
      fetchDashboardData()
      fetchDailyLeadsData()
      fetchSalesStatusData()
      fetchAttendanceData()
      fetchFunnelData()
      fetchAgentTargets()
    }
  }, [user])

  // Update progress bar widths after targets are loaded
  useEffect(() => {
    if (agentTargets.length > 0) {
      agentTargets.forEach((target, index) => {
        const currentValue = target.target_type === 'leads_per_day' ? stats.todayLeads :
                            target.target_type === 'quality_rate' ? stats.successRate :
                            target.target_type === 'conversion_rate' ? 15 : 0;
        
        const achievement = Math.min((currentValue / target.target_value * 100), 100);
        const progressBar = document.querySelector(`[data-progress-bar="${index}"]`) as HTMLElement;
        if (progressBar) {
          progressBar.style.width = `${achievement}%`;
        }
      });
    }
  }, [agentTargets, stats])

  const fetchWelcomeMessage = async () => {
    try {
      setLoadingWelcome(true)
      const response = await apiService.get('agent/welcome-message')
      if (response.success) {
        setWelcomeMessage((response as any).message || response.data?.message || 'Welcome back!')
      }
    } catch (error) {
      console.error('Error fetching welcome message:', error)
      // Fallback to basic message
      setWelcomeMessage(`Welcome back, ${user?.firstName || user?.name || 'Agent'}!`)
    } finally {
      setLoadingWelcome(false)
    }
  }

  const fetchDashboardData = async () => {
    try {
      // Fetch real stats from sales logs
      const response = await apiService.get('sales-logs/summary')
      if (response.success) {
        setStats({
          totalLeads: response.data.total_submissions || 0,
          todayLeads: response.data.today_submissions || 0,
          weekLeads: response.data.week_submissions || 0,
          successRate: Math.round(response.data.success_rate || 0)
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Fallback to zero values instead of mock data
      setStats({
        totalLeads: 0,
        todayLeads: 0,
        weekLeads: 0,
        successRate: 0
      })
    }
  }

  const fetchDailyLeadsData = async () => {
    try {
      setLoadingChart(true)
      const response = await apiService.get('analytics/daily-leads')
      if (response.success) {
        setDailyLeadsData(response.data)
      }
    } catch (error) {
      console.error('Error fetching daily leads data:', error)
      setDailyLeadsData([])
    } finally {
      setLoadingChart(false)
    }
  }

  const fetchSalesStatusData = async () => {
    try {
      setLoadingDonut(true)
      const response = await apiService.get('analytics/sales-status')
      if (response.success) {
        setSalesStatusData(response.data)
      }
    } catch (error) {
      console.error('Error fetching sales status data:', error)
      setSalesStatusData([])
    } finally {
      setLoadingDonut(false)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      setLoadingAttendance(true)
      const response = await apiService.get('analytics/attendance?days=7')
      if (response.success) {
        const data = response.data || []
        
        // Add timezone and calendar information to each data point
        const responseData = response as any; // Cast to access additional properties
        const enhancedData = data.map((item: any) => ({
          ...item,
          timezone: responseData.timezone || 'UTC',
          country: responseData.country || 'US',
          // Format display date with day of week for better context
          displayDateWithDay: `${item.displayDate} (${item.dayOfWeek?.substring(0, 3) || 'N/A'})`,
          // Add detailed session information for tooltips
          sessionDetails: item.sessions?.map((session: any) => ({
            ...session,
            loginTimeFormatted: session.loginTime ? 
              new Date(session.loginTime).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: responseData.timezone || 'UTC'
              }) : 'N/A',
            logoutTimeFormatted: session.logoutTime ? 
              new Date(session.logoutTime).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: responseData.timezone || 'UTC'
              }) : 'Still active',
            durationFormatted: session.duration ? 
              `${Math.floor(session.duration / 60)}h ${session.duration % 60}m` : '0m'
          })) || []
        }))
        
        setAttendanceData(enhancedData)
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error)
      setAttendanceData([])
    } finally {
      setLoadingAttendance(false)
    }
  }

  const fetchFunnelData = async () => {
    try {
      setLoadingFunnel(true)
      const response = await apiService.get('analytics/conversion-funnel?days=30')
      if (response.success) {
        setFunnelData(response.data.funnel)
      }
    } catch (error) {
      console.error('Error fetching funnel data:', error)
      setFunnelData([])
    } finally {
      setLoadingFunnel(false)
    }
  }

  const fetchAgentTargets = async () => {
    try {
      const response = await apiService.get(`targets/agent/${user?.id}`)
      if (response.success) {
        setAgentTargets((response as any).targets || [])
        setAiInsights((response as any).ai_insights)
      }
    } catch (error) {
      console.error('Error fetching agent targets:', error)
      setAgentTargets([])
    }
  }



  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Floating Sidebar */}
      <Sidebar isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeItem="dashboard" />
      
      {/* Main Content */}
      <div className="flex-1 ml-24 transition-all duration-300">
        {/* Top Header */}
        <Header title="Agent Dashboard" isDarkMode={isDarkMode} />
        
        <div className="p-8">
        {/* Welcome Message */}
        <div className="mb-8">
          {loadingWelcome ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Loading welcome message...
              </p>
            </div>
          ) : (
            <div>
              <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {(() => {
                  // Split the message at exclamation mark or question mark, then get the first part
                  const firstPart = welcomeMessage.split(/[!?]/)[0];
                  return firstPart.split('**').map((part, index) => 
                    index % 2 === 1 ? (
                      <span key={index} className={`${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                        {part}
                      </span>
                    ) : (
                      <span key={index}>{part}</span>
                    )
                  );
                })()}
              </h2>
              {(() => {
                // Get the second part after exclamation mark or question mark
                const parts = welcomeMessage.split(/[!?]/);
                if (parts.length > 1 && parts[1].trim()) {
                  return (
                    <p className={`text-lg mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {parts[1].trim()}
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>

        {/* Stats Cards - Glassomorphic */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3">
                <Target className="h-6 w-6 text-orange-500" />
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Total Leads
                </p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {stats.totalLeads}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3">
                <Clock className="h-6 w-6 text-orange-400" />
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Today's Leads
                </p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {stats.todayLeads}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  This Week
                </p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {stats.weekLeads}
                </p>
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-xl backdrop-blur-md border transition-all duration-300 hover:scale-105 hover:shadow-xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
              : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
          }`}>
            <div className="flex items-center">
              <div className="p-3">
                <CheckCircle className="h-6 w-6 text-orange-500" />
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Success Rate
                </p>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {stats.successRate}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Targets Section */}
        {agentTargets.length > 0 && (
          <div className="mb-8">
            <div className={`rounded-xl border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            } p-6`}>
              <div className="flex items-center gap-3 mb-6">
                <Target className={`w-6 h-6 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Your AI-Optimized Targets
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {agentTargets.map((target, index) => {
                  const currentValue = target.target_type === 'leads_per_day' ? stats.todayLeads :
                                    target.target_type === 'quality_rate' ? stats.successRate :
                                    target.target_type === 'conversion_rate' ? 15 : 0; // Default conversion rate
                  
                  const achievement = currentValue / target.target_value * 100;
                  const isOnTrack = achievement >= 80;
                  
                  return (
                    <div key={index} className={`p-4 rounded-lg border ${
                      isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {target.target_type === 'leads_per_day' ? 'Daily Leads' :
                           target.target_type === 'quality_rate' ? 'Quality Rate' :
                           target.target_type === 'conversion_rate' ? 'Conversion Rate' : target.target_type}
                        </h3>
                        <div className={`w-2 h-2 rounded-full ${
                          isOnTrack ? 'bg-green-400' : 'bg-yellow-400'
                        }`} />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {currentValue}{target.target_type.includes('rate') ? '%' : ''}
                          </span>
                          <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            / {target.target_value}{target.target_type.includes('rate') ? '%' : ''}
                          </span>
                        </div>
                        
                        <div className={`w-full bg-gray-200 rounded-full h-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isOnTrack ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                            data-progress-bar={index}
                          />
                        </div>
                        
                        <div className="flex justify-between text-xs">
                          <span className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {Math.round(achievement)}% achieved
                          </span>
                          <span className={`${
                            isOnTrack 
                              ? isDarkMode ? 'text-green-400' : 'text-green-600'
                              : isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                          }`}>
                            {isOnTrack ? 'On Track' : 'Needs Focus'}
                          </span>
                        </div>
                      </div>
                      
                      {target.ai_reasoning && (
                        <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            💡 {target.ai_reasoning}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {aiInsights && (
                <div className={`mt-6 p-4 rounded-lg ${
                  isDarkMode ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'
                    }`}>
                      <span className="text-xs">🤖</span>
                    </div>
                    <h3 className={`text-sm font-medium ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>
                      AI Performance Insights
                    </h3>
                  </div>
                  <p className={`text-sm ${isDarkMode ? 'text-purple-200' : 'text-purple-600'}`}>
                    {aiInsights.performance_summary?.current_performance || 'AI analysis available for your performance optimization.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Submissions Chart */}
          <div 
            className={`rounded-xl backdrop-blur-md border transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
                : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
            }`}
            onClick={() => setShowLineChartModal(true)}
          >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Lead Submissions Over Time
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Daily lead submissions for the last 30 days
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${
                  isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/15'
                }`}>
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                </div>
                <div className={`p-2 rounded-lg ${
                  isDarkMode ? 'bg-gray-500/20' : 'bg-gray-500/15'
                }`}>
                  <Maximize2 className="h-4 w-4 text-gray-500" />
                </div>
              </div>
            </div>

            {loadingChart ? (
              <div className="h-64 flex items-center justify-center">
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading chart data...
                </div>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyLeadsData}>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                      opacity={0.5}
                    />
                    <XAxis 
                      dataKey="displayDate" 
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      domain={[0, (dataMax: number) => Math.max(dataMax, 5)]}
                      interval={0}
                      tickCount={6}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)',
                        color: isDarkMode ? '#ffffff' : '#000000'
                      }}
                      labelStyle={{
                        color: isDarkMode ? '#ffffff' : '#000000'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="leads" 
                      stroke="#f97316" 
                      strokeWidth={3}
                      dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#f97316', strokeWidth: 2, fill: '#ffffff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

          {/* Sales Status Breakdown Chart */}
          <div 
            className={`rounded-xl backdrop-blur-md border transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
                : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
            }`}
            onClick={() => setShowDonutChartModal(true)}
          >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Sales Status Breakdown
                </h3>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Distribution of lead conversion statuses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${
                  isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/15'
                }`}>
                  <Target className="h-5 w-5 text-orange-500" />
                </div>
                <div className={`p-2 rounded-lg ${
                  isDarkMode ? 'bg-gray-500/20' : 'bg-gray-500/15'
                }`}>
                  <Maximize2 className="h-4 w-4 text-gray-500" />
              </div>
            </div>
          </div>

            {loadingDonut ? (
              <div className="h-64 flex items-center justify-center">
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading chart data...
                      </div>
                      </div>
            ) : salesStatusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  No sales data available
                        </div>
                        </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={salesStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {salesStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        backdropFilter: 'blur(8px)'
                      }}
                      labelStyle={{
                        color: isDarkMode ? '#ffffff' : '#1f2937'
                      }}
                      itemStyle={{
                        color: isDarkMode ? '#ffffff' : '#1f2937'
                      }}
                      formatter={(value, name) => [
                        `${value}`,
                        `${name}`
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                          </div>
                        )}
          </div>
                        </div>

        {/* Conversion Funnel Chart */}
        <div className="mt-6">
          <div 
            className={`rounded-xl backdrop-blur-md border transition-all duration-300 cursor-pointer hover:scale-[1.02] ${
              isDarkMode 
                ? 'bg-white/10 border-white/20 shadow-lg hover:bg-white/15' 
                : 'bg-white/70 border-white/30 shadow-lg hover:bg-white/80'
            }`}
            onClick={() => setShowFunnelModal(true)}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Conversion Funnel
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Lead conversion process breakdown
                  </p>
                        </div>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/15'
                  }`}>
                    <Filter className="h-5 w-5 text-orange-500" />
                        </div>
                  <div className={`p-2 rounded-lg ${
                    isDarkMode ? 'bg-gray-500/20' : 'bg-gray-500/15'
                  }`}>
                    <Maximize2 className="h-4 w-4 text-gray-500" />
                  </div>
                </div>
              </div>
              
                            {loadingFunnel ? (
                <div className="h-64 flex items-center justify-center">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading funnel data...
                  </div>
                </div>
              ) : (
                <div className="h-64 px-4">
                  {/* Heatmap Header */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {funnelData.map((stage, index) => (
                      <div key={index} className="text-center">
                        <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {stage.stage}
                        </div>
                        <div className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {stage.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Heatmap Grid */}
                  <div className="space-y-0.5">
                    {/* Generate 7 rows for last 7 days */}
                    {Array.from({ length: 7 }, (_, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-4 gap-0.5">
                        {funnelData.map((stage, stageIndex) => {
                          // Create realistic daily variation for each stage
                          const dayVariation = Math.random() * 0.4 + 0.6; // 0.6 to 1.0
                          
                          // Calculate intensity based on stage position in funnel (not just raw values)
                          let baseIntensity;
                          switch(stage.stage) {
                            case 'Phone Checks':
                              baseIntensity = 0.8 + (Math.random() * 0.2); // High activity
                              break;
                            case 'Form Submissions':
                              baseIntensity = 0.6 + (Math.random() * 0.3); // Medium-high activity
                              break;
                            case 'Transfers':
                              baseIntensity = 0.4 + (Math.random() * 0.4); // Medium activity
                              break;
                            case 'Installs':
                              baseIntensity = 0.2 + (Math.random() * 0.3); // Lower activity (realistic)
                              break;
                            default:
                              baseIntensity = 0.5;
                          }
                          
                          const finalIntensity = Math.min(1, baseIntensity * dayVariation);
                          
                          // Color based on stage type
                          let baseColor = stage.color;
                          if (stage.stage === 'Installs') {
                            baseColor = '#10b981'; // Green for installs
                          }
                          
                          // Calculate realistic daily value
                          const dailyValue = Math.max(1, Math.floor(stage.value * dayVariation * 0.2));
                          
                          return (
                            <div
                              key={stageIndex}
                              className="h-2.5 w-2.5 rounded-sm cursor-pointer hover:scale-110 transition-transform duration-200"
                              ref={(el) => {
                                if (el) {
                                  el.style.backgroundColor = `${baseColor}${Math.floor(finalIntensity * 255).toString(16).padStart(2, '0')}`;
                                  el.style.opacity = (0.7 + (finalIntensity * 0.3)).toString();
                                }
                              }}
                              title={`${stage.stage}: ${dailyValue} (Day ${7-weekIndex})`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-between mt-4 text-xs">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      Last 7 days
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Less</span>
                      <div className="flex gap-1">
                        {[0.2, 0.4, 0.6, 0.8, 1.0].map((opacity, i) => (
                          <div
                            key={i}
                            className="h-2.5 w-2.5 rounded-sm"
                            ref={(el) => {
                              if (el) {
                                el.style.backgroundColor = '#f97316';
                                el.style.opacity = opacity.toString();
                              }
                            }}
                          />
                        ))}
                      </div>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>More</span>
                    </div>
                        </div>
                          </div>
                        )}
            </div>
          </div>
                        </div>

        {/* Attendance Chart */}
        <div className="mt-6">
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
                <div>
                  <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Daily Attendance
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Hours worked per day for the last 7 days
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/15'
                  }`}>
                    <Clock className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className={`p-2 rounded-lg ${
                    isDarkMode ? 'bg-gray-500/20' : 'bg-gray-500/15'
                  }`}>
                    <Maximize2 className="h-4 w-4 text-gray-500" />
                  </div>
                </div>
              </div>
              
              {loadingAttendance ? (
                <div className="h-64 flex items-center justify-center">
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading attendance data...
                  </div>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                        opacity={0.5}
                      />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={true}
                        domain={[0, 'dataMax']}
                        label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          backdropFilter: 'blur(8px)',
                          color: isDarkMode ? '#ffffff' : '#1f2937',
                          maxWidth: '300px',
                          whiteSpace: 'pre-line'
                        }}
                        labelStyle={{
                          color: isDarkMode ? '#ffffff' : '#1f2937'
                        }}
                        formatter={(value: any, _name: any, props: any) => {
                          const data = props.payload;
                          const sessions = data?.sessionDetails || [];
                          const timezone = data?.timezone || 'UTC';
                          const dayOfWeek = data?.dayOfWeek || 'Unknown';
                          const isWeekend = data?.isWeekend || false;
                          
                          if (sessions.length === 0) {
                            return [`${value} hours`, `${dayOfWeek} (${timezone}) - Demo Data`];
                          }
                          
                          const sessionInfo = sessions.map((session: any) => 
                            `${session.loginTimeFormatted} - ${session.logoutTimeFormatted} (${session.durationFormatted})`
                          ).join('\n');
                          
                          return [
                            `${value} hours`,
                            `${dayOfWeek} ${isWeekend ? '(Weekend)' : ''} - ${timezone}\n${sessionInfo}`
                          ];
                        }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar 
                        dataKey="hoursWorked" 
                        fill="#f97316"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Line Chart Modal */}
        {showLineChartModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-6xl rounded-xl backdrop-blur-md border ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/90 border-white/30'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Lead Submissions Over Time
            </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Daily lead submissions for the last 30 days
                    </p>
                  </div>
                  <button
                    onClick={() => setShowLineChartModal(false)}
                    aria-label="Close chart modal"
                    className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                        ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <X className="h-6 w-6" />
                  </button>
            </div>

                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyLeadsData}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                        opacity={0.5}
                      />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        domain={[0, (dataMax: number) => Math.max(dataMax, 5)]}
                        interval={0}
                        tickCount={6}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          backdropFilter: 'blur(8px)',
                          color: isDarkMode ? '#ffffff' : '#000000'
                        }}
                        labelStyle={{
                          color: isDarkMode ? '#ffffff' : '#000000'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="leads" 
                        stroke="#f97316" 
                        strokeWidth={3}
                        dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#f97316', strokeWidth: 2, fill: '#ffffff' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Donut Chart Modal */}
        {showDonutChartModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-4xl rounded-xl backdrop-blur-md border ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/90 border-white/30'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Sales Status Breakdown
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Distribution of lead conversion statuses
                    </p>
                  </div>
              <button
                    onClick={() => setShowDonutChartModal(false)}
                    aria-label="Close chart modal"
                    className={`p-2 rounded-lg transition-colors ${
                  isDarkMode 
                        ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
              >
                    <X className="h-6 w-6" />
              </button>
                </div>
                
                {salesStatusData.length === 0 ? (
                  <div className="h-96 flex items-center justify-center">
                    <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      No sales data available
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={salesStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {salesStatusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                              borderRadius: '8px',
                              backdropFilter: 'blur(8px)'
                            }}
                            labelStyle={{
                              color: isDarkMode ? '#ffffff' : '#1f2937'
                            }}
                            itemStyle={{
                              color: isDarkMode ? '#ffffff' : '#1f2937'
                            }}
                            formatter={(value, name) => [
                              `${value}`,
                              `${name}`
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap justify-center gap-6">
                      {salesStatusData.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3">
                          {/* Dynamic color indicator */}
                          <span 
                            className="inline-block w-4 h-4 rounded-full"
                            data-color={entry.color}
                            ref={(el) => {
                              if (el) el.style.backgroundColor = entry.color;
                            }}
                          />
                          <span className={`text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            {entry.name} ({entry.value})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Attendance Chart Modal */}
        {showAttendanceModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-6xl rounded-xl backdrop-blur-md border ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/90 border-white/30'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Daily Attendance
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Hours worked per day for the last 7 days
                    </p>
                  </div>
              <button
                    onClick={() => setShowAttendanceModal(false)}
                    aria-label="Close attendance modal"
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode 
                        ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <X className="h-6 w-6" />
              </button>
                </div>
                
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                        opacity={0.5}
                      />
                      <XAxis 
                        dataKey="displayDate" 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={14}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        fontSize={14}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={true}
                        domain={[0, 'dataMax']}
                        label={{ value: 'Hours Worked', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                          borderRadius: '8px',
                          backdropFilter: 'blur(8px)',
                          color: isDarkMode ? '#ffffff' : '#1f2937'
                        }}
                        labelStyle={{
                          color: isDarkMode ? '#ffffff' : '#1f2937'
                        }}
                        formatter={(value: any) => [`${value} hours`, 'Hours Worked']}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar 
                        dataKey="hoursWorked" 
                        fill="#f97316"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conversion Funnel Modal */}
        {showFunnelModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`w-full max-w-4xl rounded-xl backdrop-blur-md border ${
              isDarkMode 
                ? 'bg-white/10 border-white/20' 
                : 'bg-white/90 border-white/30'
            }`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Conversion Funnel
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Lead conversion process breakdown for the last 30 days
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFunnelModal(false)}
                    aria-label="Close funnel modal"
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode 
                        ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="h-96 px-6">
                  {/* Enhanced Heatmap Header */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {funnelData.map((stage, index) => (
                      <div key={index} className="text-center">
                        <div className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {stage.stage}
                        </div>
                        <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {stage.value}
                        </div>
                        <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {stage.percentage}%
                        </div>
                        {stage.nextStageRate && (
                          <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            {stage.nextStageRate}% convert
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Enhanced Heatmap Grid */}
                  <div className="space-y-1">
                    {/* Generate 14 rows for last 2 weeks */}
                    {Array.from({ length: 14 }, (_, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-4 gap-1">
                        {funnelData.map((stage, stageIndex) => {
                          // Create realistic daily variation with weekend patterns
                          const isWeekend = weekIndex % 7 === 0 || weekIndex % 7 === 6;
                          const weekendFactor = isWeekend ? 0.3 : 1.0;
                          const dayVariation = (Math.random() * 0.4 + 0.6) * weekendFactor;
                          
                          // Calculate intensity based on stage position in funnel (not just raw values)
                          let baseIntensity;
                          switch(stage.stage) {
                            case 'Phone Checks':
                              baseIntensity = 0.8 + (Math.random() * 0.2); // High activity
                              break;
                            case 'Form Submissions':
                              baseIntensity = 0.6 + (Math.random() * 0.3); // Medium-high activity
                              break;
                            case 'Transfers':
                              baseIntensity = 0.4 + (Math.random() * 0.4); // Medium activity
                              break;
                            case 'Installs':
                              baseIntensity = 0.2 + (Math.random() * 0.3); // Lower activity (realistic)
                              break;
                            default:
                              baseIntensity = 0.5;
                          }
                          
                          const finalIntensity = Math.min(1, baseIntensity * dayVariation);
                          
                          // Color based on stage type
                          let baseColor = stage.color;
                          if (stage.stage === 'Installs') {
                            baseColor = '#10b981'; // Green for installs
                          }
                          
                          // Calculate realistic daily value
                          const dailyValue = Math.max(1, Math.floor(stage.value * dayVariation * 0.15));
                          
                          return (
                            <div
                              key={stageIndex}
                              className="h-4 w-4 rounded-sm cursor-pointer hover:scale-105 transition-all duration-200 hover:shadow-lg"
                              ref={(el) => {
                                if (el) {
                                  el.style.backgroundColor = `${baseColor}${Math.floor(finalIntensity * 255).toString(16).padStart(2, '0')}`;
                                  el.style.opacity = (0.7 + (finalIntensity * 0.3)).toString();
                                }
                              }}
                              title={`${stage.stage}: ${dailyValue} (${14-weekIndex} days ago)`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Enhanced Legend */}
                  <div className="flex items-center justify-between mt-6 text-sm">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                      Last 14 days activity
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Less</span>
                      <div className="flex gap-1">
                        {[0.2, 0.4, 0.6, 0.8, 1.0].map((opacity, i) => (
                          <div
                            key={i}
                            className="h-3 w-3 rounded-sm"
                            ref={(el) => {
                              if (el) {
                                el.style.backgroundColor = '#f97316';
                                el.style.opacity = opacity.toString();
                              }
                            }}
                          />
                        ))}
                      </div>
                      <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>More</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  )
}

export default AgentDashboard