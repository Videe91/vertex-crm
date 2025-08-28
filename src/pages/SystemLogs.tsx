import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  Filter, 
  Search, 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  Bug,
  RefreshCw,
  User,
  Clock,
  Database,
  Shield,
  Cpu,
  Globe,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface LogEntry {
  id: number
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  category: string
  source: string
  user_id?: number
  username?: string
  user_name?: string
  user_role?: string
  session_id?: string
  ip_address?: string
  user_agent?: string
  message: string
  details?: any
  stack_trace?: string
  request_id?: string
  duration_ms?: number
  status_code?: number
}

interface LogStats {
  levelStats: Array<{ level: string; count: number }>
  categoryStats: Array<{ category: string; count: number }>
  recentErrors: LogEntry[]
  hourlyActivity: Array<{ hour: string; count: number }>
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  pages: number
}

const SystemLogs: React.FC = () => {
  const { isDarkMode } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set())
  
  // Filters
  const [filters, setFilters] = useState({
    level: '',
    category: '',
    source: '',
    user_id: '',
    start_date: '',
    end_date: '',
    search: ''
  })
  
  // Pagination
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })

  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [filters, pagination.page])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, value]) => value))
      })

      const response = await apiService.get(`/api/logs?${queryParams}`)
      if (response.success && response.data) {
        setLogs(response.data.logs || [])
        setPagination(prev => ({ ...prev, ...(response.data.pagination || {}) }))
      }
    } catch (error) {
      console.error('Error fetching logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await apiService.get('/api/logs/stats?hours=24')
      if (response.success && response.data) {
        setStats(response.data.stats || response.data)
      }
    } catch (error) {
      console.error('Error fetching log stats:', error)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      level: '',
      category: '',
      source: '',
      user_id: '',
      start_date: '',
      end_date: '',
      search: ''
    })
  }

  const toggleLogExpansion = (logId: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'warn': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'info': return <Info className="w-4 h-4 text-blue-500" />
      case 'debug': return <Bug className="w-4 h-4 text-gray-500" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'api': return <Globe className="w-4 h-4" />
      case 'database': return <Database className="w-4 h-4" />
      case 'auth': return <Shield className="w-4 h-4" />
      case 'system': return <Cpu className="w-4 h-4" />
      case 'ai': return <Bug className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200'
      case 'warn': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'debug': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar isDarkMode={isDarkMode} setIsDarkMode={() => {}} />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className={`w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              System Logs
            </h1>
          </div>
          <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Monitor system activity, errors, and performance
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Error Count */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Errors (24h)
                  </p>
                  <p className="text-2xl font-bold text-red-500">
                    {stats.levelStats.find(s => s.level === 'error')?.count || 0}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* Warning Count */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Warnings (24h)
                  </p>
                  <p className="text-2xl font-bold text-yellow-500">
                    {stats.levelStats.find(s => s.level === 'warn')?.count || 0}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
            </div>

            {/* API Calls */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    API Calls (24h)
                  </p>
                  <p className="text-2xl font-bold text-blue-500">
                    {stats.categoryStats.find(s => s.category === 'api')?.count || 0}
                  </p>
                </div>
                <Globe className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            {/* Total Logs */}
            <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Total Logs (24h)
                  </p>
                  <p className="text-2xl font-bold text-green-500">
                    {stats.levelStats.reduce((sum, s) => sum + s.count, 0)}
                  </p>
                </div>
                <FileText className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6 mb-8`}>
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5" />
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Filters
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Level Filter */}
            <select
              value={filters.level}
              onChange={(e) => handleFilterChange('level', e.target.value)}
              title="Filter by log level"
              aria-label="Filter logs by level"
              className={`px-3 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All Levels</option>
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            {/* Category Filter */}
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              title="Filter by log category"
              aria-label="Filter logs by category"
              className={`px-3 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            >
              <option value="">All Categories</option>
              <option value="api">API</option>
              <option value="database">Database</option>
              <option value="auth">Authentication</option>
              <option value="system">System</option>
              <option value="ai">AI</option>
              <option value="frontend">Frontend</option>
            </select>

            {/* Start Date */}
            <input
              type="datetime-local"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              title="Filter logs from this date"
              placeholder="Start date"
              className={`px-3 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />

            {/* End Date */}
            <input
              type="datetime-local"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              title="Filter logs until this date"
              placeholder="End date"
              className={`px-3 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>

          <div className="flex gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className={`w-full pl-10 pr-3 py-2 rounded-lg border ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className={`px-4 py-2 rounded-lg border ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                  : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
              }`}
            >
              Clear
            </button>

            {/* Refresh */}
            <button
              onClick={() => { fetchLogs(); fetchStats(); }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg overflow-hidden`}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              System Logs ({pagination.total} total)
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Loading logs...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200 dark:divide-gray-700`}>
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {formatTimestamp(log.timestamp)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getLevelColor(log.level)}`}>
                            {getLevelIcon(log.level)}
                            {log.level.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(log.category)}
                            {log.category}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="max-w-md truncate">
                            {log.message}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {log.username ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>{log.username}</span>
                              <span className="text-xs text-gray-500">({log.user_role})</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">System</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatDuration(log.duration_ms || null)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => toggleLogExpansion(log.id)}
                            className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                          >
                            {expandedLogs.has(log.id) ? (
                              <>
                                <ChevronDown className="w-4 h-4" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronRight className="w-4 h-4" />
                                Details
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {expandedLogs.has(log.id) && (
                        <tr>
                          <td colSpan={7} className={`px-6 py-4 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
                            <div className="space-y-4">
                              {/* Basic Info */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Source:</span>
                                  <p className="text-gray-600 dark:text-gray-400">{log.source}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Request ID:</span>
                                  <p className="text-gray-600 dark:text-gray-400 font-mono text-xs">{log.request_id || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">IP Address:</span>
                                  <p className="text-gray-600 dark:text-gray-400">{log.ip_address || 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Status Code:</span>
                                  <p className="text-gray-600 dark:text-gray-400">{log.status_code || 'N/A'}</p>
                                </div>
                              </div>

                              {/* Details */}
                              {log.details && (
                                <div>
                                  <span className="font-medium">Details:</span>
                                  <pre className={`mt-2 p-3 rounded-lg text-xs overflow-x-auto ${
                                    isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {/* Stack Trace */}
                              {log.stack_trace && (
                                <div>
                                  <span className="font-medium text-red-600">Stack Trace:</span>
                                  <pre className={`mt-2 p-3 rounded-lg text-xs overflow-x-auto ${
                                    isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-50 text-red-700'
                                  }`}>
                                    {log.stack_trace}
                                  </pre>
                                </div>
                              )}

                              {/* User Agent */}
                              {log.user_agent && (
                                <div>
                                  <span className="font-medium">User Agent:</span>
                                  <p className="text-gray-600 dark:text-gray-400 text-xs">{log.user_agent}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {logs.length === 0 && !loading && (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    No logs found matching your criteria
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SystemLogs
