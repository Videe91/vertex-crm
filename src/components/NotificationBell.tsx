import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Bell, X, ChevronDown, Megaphone, Target, TrendingUp, AlertTriangle, Info } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Notification {
  id: number
  title: string
  message: string
  type: string
  priority: string
  sender_name: string
  sender_role: string
  campaign_name?: string
  created_at: string
  is_read: boolean
  read_at?: string
}

interface NotificationBellProps {
  isDarkMode: boolean
}

interface NotificationModalProps {
  notification: Notification | null
  isOpen: boolean
  onClose: () => void
  onMarkAsRead: (id: number) => void
  isDarkMode: boolean
}

// Notification Modal Component
const NotificationModal: React.FC<NotificationModalProps> = ({ 
  notification, 
  isOpen, 
  onClose, 
  onMarkAsRead, 
  isDarkMode 
}) => {
  console.log('Modal render:', { 
    isOpen, 
    hasNotification: !!notification, 
    notificationTitle: notification?.title,
    notificationId: notification?.id 
  })
  
  if (!isOpen || !notification) {
    console.log('Modal not rendering:', { isOpen, hasNotification: !!notification })
    return null
  }
  
  console.log('Modal IS rendering!')

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = `w-6 h-6 ${
      priority === 'urgent' ? 'text-red-500' :
      priority === 'high' ? 'text-orange-500' :
      priority === 'medium' ? 'text-blue-500' : 'text-gray-500'
    }`

    switch (type) {
      case 'campaign': return <Megaphone className={iconClass} />
      case 'target': return <Target className={iconClass} />
      case 'performance': return <TrendingUp className={iconClass} />
      case 'alert': return <AlertTriangle className={iconClass} />
      default: return <Info className={iconClass} />
    }
  }

  const getPriorityBadge = (priority: string) => {
    const baseClass = "px-3 py-1 text-sm rounded-full font-medium"
    switch (priority) {
      case 'urgent':
        return `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`
      case 'high':
        return `${baseClass} bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300`
      case 'medium':
        return `${baseClass} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`
      default:
        return `${baseClass} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const handleMarkAsRead = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className={`max-w-2xl w-full rounded-xl shadow-2xl ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            {getNotificationIcon(notification.type, notification.priority)}
            <h2 className={`text-xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {notification.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-gray-400 hover:bg-gray-700 hover:text-white' 
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title="Close notification"
            aria-label="Close notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className={getPriorityBadge(notification.priority)}>
              {notification.priority.charAt(0).toUpperCase() + notification.priority.slice(1)} Priority
            </span>
            {notification.campaign_name && (
              <span className={`px-3 py-1 text-sm rounded-full ${
                isDarkMode 
                  ? 'bg-gray-700 text-gray-300' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {notification.campaign_name}
              </span>
            )}
            {!notification.is_read && (
              <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                Unread
              </span>
            )}
          </div>

          <div className={`text-lg leading-relaxed mb-6 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-700'
          }`}>
            {notification.message}
          </div>

          <div className={`flex items-center justify-between text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <div>
              <span className="font-medium">From: </span>
              {notification.sender_name} ({notification.sender_role.replace('_', ' ')})
            </div>
            <div>
              {formatTime(notification.created_at)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={`flex items-center justify-end gap-3 p-6 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-gray-400 hover:bg-gray-700 hover:text-white' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            Close
          </button>
          {!notification.is_read && (
            <button
              onClick={handleMarkAsRead}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Mark as Read
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const NotificationBell: React.FC<NotificationBellProps> = ({ isDarkMode }) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications?limit=20', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mark notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, is_read: true, read_at: new Date().toISOString() }
              : notif
          )
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        
        // Update selected notification if it's the one being marked as read
        // Note: selectedNotification functionality removed
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Handle notification click to mark as read
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.is_read) {
      try {
        const token = localStorage.getItem('vertex_token')
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id 
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        )
        fetchUnreadCount() // Refresh unread count
      } catch (error) {
        console.error('Error marking notification as read:', error)
      }
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, is_read: true, read_at: new Date().toISOString() }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  // Get notification icon
  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = `w-4 h-4 ${
      priority === 'urgent' ? 'text-red-500' :
      priority === 'high' ? 'text-orange-500' :
      priority === 'medium' ? 'text-blue-500' : 'text-gray-500'
    }`

    switch (type) {
      case 'campaign': return <Megaphone className={iconClass} />
      case 'target': return <Target className={iconClass} />
      case 'performance': return <TrendingUp className={iconClass} />
      case 'alert': return <AlertTriangle className={iconClass} />
      default: return <Info className={iconClass} />
    }
  }

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    const baseClass = "px-3 py-1 text-xs rounded-full font-semibold border"
    switch (priority) {
      case 'urgent':
        return `${baseClass} bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50`
      case 'high':
        return `${baseClass} bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/50`
      case 'medium':
        return `${baseClass} bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50`
      default:
        return `${baseClass} bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:border-gray-600/50`
    }
  }

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch unread count on mount and periodically
  useEffect(() => {
    if (user) {
      fetchUnreadCount()
      const interval = setInterval(fetchUnreadCount, 30000) // Check every 30 seconds
      return () => clearInterval(interval)
    }
  }, [user])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && user) {
      fetchNotifications()
    }
  }, [isOpen, user])



  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Notification Bell Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-2 rounded-xl transition-all duration-300 hover:scale-110 ${
            isDarkMode
              ? 'hover:bg-gray-800/50 text-gray-300 hover:text-orange-400'
              : 'hover:bg-white/20 text-gray-600 hover:text-orange-500'
          }`}
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Dropdown - Rendered via Portal to ensure it's always on top */}
      {isOpen && createPortal(
        <div 
          className="fixed inset-0 z-[999999]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false)
            }
          }}
        >
          <div 
            className={`absolute right-8 top-20 w-96 rounded-2xl shadow-2xl border z-[999999] ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-600' 
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-5 border-b ${
              isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
                }`}>
                  <Bell className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className={`text-sm px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                      isDarkMode 
                        ? 'text-blue-400 hover:bg-blue-500/20 hover:text-blue-300' 
                        : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 ${
                    isDarkMode 
                      ? 'text-gray-400 hover:bg-gray-700/50 hover:text-white' 
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                  title="Close notifications"
                  aria-label="Close notifications"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-3"></div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading notifications...
                  </p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                    isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <Bell className={`w-8 h-8 ${
                      isDarkMode ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                  </div>
                  <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    No notifications yet
                  </h4>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                    You'll see updates and alerts here when they arrive
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-5 border-b transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                      isDarkMode ? 'border-gray-700/50 hover:bg-gray-700/30' : 'border-gray-100/50 hover:bg-gray-50/80'
                    } ${!notification.is_read ? (isDarkMode ? 'bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-l-4 border-l-blue-500' : 'bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-l-4 border-l-blue-500') : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 p-2 rounded-xl ${
                        notification.priority === 'urgent' ? 'bg-red-500/20' :
                        notification.priority === 'high' ? 'bg-orange-500/20' :
                        notification.priority === 'medium' ? 'bg-blue-500/20' : 'bg-gray-500/20'
                      }`}>
                        {getNotificationIcon(notification.type, notification.priority)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`font-semibold text-sm ${
                                isDarkMode ? 'text-white' : 'text-gray-900'
                              }`}>
                                {notification.title}
                              </h4>
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              )}
                            </div>
                            <p className={`text-sm leading-relaxed line-clamp-2 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              {notification.message}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <span className={getPriorityBadge(notification.priority)}>
                              {notification.priority.charAt(0).toUpperCase() + notification.priority.slice(1)}
                            </span>
                            {notification.campaign_name && (
                              <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                                isDarkMode 
                                  ? 'bg-gray-700/80 text-gray-300 border border-gray-600' 
                                  : 'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}>
                                {notification.campaign_name}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {notification.sender_name}
                            </span>
                            <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              {formatTime(notification.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className={`p-4 text-center border-t backdrop-blur-sm ${
                isDarkMode ? 'border-gray-700/50 bg-gray-800/50' : 'border-gray-200/50 bg-gray-50/50'
              }`}>
                <button
                  className={`text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 ${
                    isDarkMode 
                      ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10' 
                      : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                  title="View all notifications"
                  aria-label="View all notifications"
                >
                  View all notifications →
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default NotificationBell
