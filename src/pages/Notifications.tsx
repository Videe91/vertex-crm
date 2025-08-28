import React, { useState, useEffect } from 'react'
import { 
  Send, 
  Users, 
  Building2, 
  UserCheck, 
  AlertTriangle, 
  Info, 
  Target, 
  Megaphone, 
  TrendingUp,
  Calendar,
  X
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'

interface Campaign {
  id: number
  campaign_name: string
}

interface Center {
  id: number
  center_name: string
  country: string
}



const Notifications: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
    target_type: 'all',
    target_centers: [] as number[],
    campaign_id: null as number | null,
    expires_at: ''
  })
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [centers, setCenters] = useState<Center[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Fetch data on mount and handle forwarding
  useEffect(() => {
    fetchCampaigns()
    if (user?.role === 'super_admin') {
      fetchCenters()
    }
    
    // Check if we're forwarding a notification
    const urlParams = new URLSearchParams(window.location.search)
    const forwardId = urlParams.get('forward')
    if (forwardId && user?.role === 'center_admin') {
      fetchOriginalNotification(parseInt(forwardId))
    }
  }, [user])

  // Fetch original notification for forwarding
  const fetchOriginalNotification = async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications?limit=50`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        const originalNotification = data.notifications.find((n: any) => n.id === notificationId)
        if (originalNotification) {
          setFormData({
            title: `FWD: ${originalNotification.title}`,
            message: `[Forwarded from Super Admin]\n\n${originalNotification.message}`,
            type: originalNotification.type,
            priority: originalNotification.priority,
            target_type: 'agents',
            target_centers: [],
            campaign_id: originalNotification.campaign_id,
            expires_at: ''
          })
        }
      }
    } catch (error) {
      console.error('Error fetching original notification:', error)
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setCampaigns(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  const fetchCenters = async () => {
    try {
      const response = await fetch('/api/centers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setCenters(data || [])
      }
    } catch (error) {
      console.error('Error fetching centers:', error)
    }
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.message) {
      setError('Title and message are required')
      return
    }

    if (formData.target_type === 'campaign' && !formData.campaign_id) {
      setError('Please select a campaign when targeting Campaign Centers')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`Notification sent successfully to ${data.recipients_count} recipients`)
        setFormData({
          title: '',
          message: '',
          type: 'info',
          priority: 'medium',
          target_type: 'all',
          target_centers: [],
          campaign_id: null,
          expires_at: ''
        })
      } else {
        setError(data.error || 'Failed to send notification')
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      setError('Failed to send notification')
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'campaign': return <Megaphone className="w-5 h-5" />
      case 'target': return <Target className="w-5 h-5" />
      case 'performance': return <TrendingUp className="w-5 h-5" />
      case 'alert': return <AlertTriangle className="w-5 h-5" />
      default: return <Info className="w-5 h-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500'
      case 'high': return 'text-orange-500'
      case 'medium': return 'text-blue-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode}
        activeItem="notifications"
        userRole={user?.role}
      />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Send Notification
          </h1>
          <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Send updates and alerts to centers and agents
          </p>
        </div>

        {/* Notification Form */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="Enter notification title"
                required
              />
            </div>

            {/* Message */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Message *
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                placeholder="Enter notification message"
                required
              />
            </div>

            {/* Type and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  title="Select notification type"
                  aria-label="Select notification type"
                >
                  <option value="info">Information</option>
                  <option value="campaign">Campaign Update</option>
                  <option value="target">Target Update</option>
                  <option value="performance">Performance Update</option>
                  <option value="alert">Alert</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  title="Select notification priority"
                  aria-label="Select notification priority"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Target Type */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Send To
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {user?.role === 'super_admin' && (
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.target_type === 'all'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : isDarkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="target_type"
                      value="all"
                      checked={formData.target_type === 'all'}
                      onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                      className="sr-only"
                    />
                    <Users className="w-5 h-5 mr-2 text-orange-500" />
                    <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>All Users</span>
                  </label>
                )}

                {user?.role === 'super_admin' && (
                  <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    formData.target_type === 'campaign'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : isDarkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      name="target_type"
                      value="campaign"
                      checked={formData.target_type === 'campaign'}
                      onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                      className="sr-only"
                    />
                    <Megaphone className="w-5 h-5 mr-2 text-orange-500" />
                    <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>Campaign Centers</span>
                  </label>
                )}

                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.target_type === 'centers'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : isDarkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="target_type"
                    value="centers"
                    checked={formData.target_type === 'centers'}
                    onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                    className="sr-only"
                  />
                  <Building2 className="w-5 h-5 mr-2 text-orange-500" />
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>Specific Centers</span>
                </label>

                <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.target_type === 'agents'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : isDarkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="target_type"
                    value="agents"
                    checked={formData.target_type === 'agents'}
                    onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                    className="sr-only"
                  />
                  <UserCheck className="w-5 h-5 mr-2 text-orange-500" />
                  <span className={isDarkMode ? 'text-white' : 'text-gray-900'}>Agents</span>
                </label>
              </div>
            </div>

            {/* Center Selection */}
            {(formData.target_type === 'centers' || formData.target_type === 'agents') && user?.role === 'super_admin' && (
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Centers
                </label>
                {centers.length === 0 ? (
                  <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading centers...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
                    {centers.map((center) => (
                      <label key={center.id} className={`flex items-center p-2 border rounded cursor-pointer ${
                        isDarkMode ? 'border-gray-600' : 'border-gray-300'
                      }`}>
                        <input
                          type="checkbox"
                          checked={formData.target_centers.includes(center.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ 
                                ...formData, 
                                target_centers: [...formData.target_centers, center.id] 
                              })
                            } else {
                              setFormData({ 
                                ...formData, 
                                target_centers: formData.target_centers.filter(id => id !== center.id) 
                              })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {center.center_name} ({center.country})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}



            {/* Campaign Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {formData.target_type === 'campaign' ? 'Select Campaign *' : 'Related Campaign (Optional)'}
              </label>
              <select
                value={formData.campaign_id || ''}
                onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value ? parseInt(e.target.value) : null })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                title="Select related campaign"
                aria-label="Select related campaign"
                required={formData.target_type === 'campaign'}
              >
                <option value="">{formData.target_type === 'campaign' ? 'Select a campaign' : 'No campaign'}</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.campaign_name}
                  </option>
                ))}
              </select>
              {formData.target_type === 'campaign' && (
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  This will notify all Center Admins assigned to this campaign
                </p>
              )}
            </div>

            {/* Expiry Date */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Expiry Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                title="Select expiry date and time"
                placeholder="Select expiry date and time"
              />
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center p-3 bg-red-100 border border-red-300 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center p-3 bg-green-100 border border-green-300 rounded-lg">
                <Info className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-700">{success}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className={`flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {loading ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Notifications
