import React, { useState } from 'react'
import { 
  LayoutDashboard,
  BarChart3, 
  Building2,
  Users, 
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  FileText,
  ScrollText,
  Brain
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

import { useNavigate } from 'react-router-dom'

interface SidebarProps {
  isDarkMode: boolean
  setIsDarkMode: (value: boolean) => void
  activeItem?: string
  userRole?: string
}

const Sidebar: React.FC<SidebarProps> = ({ isDarkMode, setIsDarkMode, activeItem = 'dashboard', userRole }) => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Different menu items based on user role
  const getMenuItems = () => {
    if (userRole === 'center_admin' || user?.role === 'center_admin') {
      return [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/center-admin' },
        { id: 'targets', icon: Target, label: 'Targets', href: '/center-admin/targets' },
        { id: 'campaigns', icon: BarChart3, label: 'Campaigns', href: '/center-admin/campaigns' },
        { id: 'agents', icon: Users, label: 'Agents', href: '/center-admin/agents' },
        { id: 'notifications', icon: Bell, label: 'Send Notifications', href: '/notifications' },
        { id: 'sales-logs', icon: ScrollText, label: 'Sales Logs', href: '/sales-logs' },
        { id: 'settings', icon: Settings, label: 'Settings', href: '/center-admin/settings' }
      ]
    } else if (userRole === 'agent' || user?.role === 'agent') {
      return [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/agent' },
        { id: 'lead-form', icon: FileText, label: 'Lead Form', href: '/agent/lead-form' },
        { id: 'sales-logs', icon: ScrollText, label: 'Sales Logs', href: '/sales-logs' }
      ]
    } else {
      // Super admin menu items
      return [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', href: '/super-admin' },
        { id: 'analytics', icon: BarChart3, label: 'Analytics', href: '/analytics' },
        { id: 'ai-targets', icon: Brain, label: 'AI Targets', href: '/ai-targets' },
        { id: 'ai-target-dashboard', icon: BarChart3, label: 'AI Target Dashboard', href: '/ai-target-dashboard' },
        { id: 'campaign-ai-config', icon: Settings, label: 'Campaign AI Config', href: '/campaign-ai-config' },
        { id: 'system-logs', icon: FileText, label: 'System Logs', href: '/system-logs' },
        { id: 'notifications', icon: Bell, label: 'Send Notifications', href: '/notifications' },
        { id: 'centers', icon: Building2, label: 'Centers', href: '/centers' },
        { id: 'users', icon: Users, label: 'Clients', href: '/users' },
        { id: 'campaigns', icon: Target, label: 'Campaigns', href: '/campaigns' },
        { id: 'forms', icon: FileText, label: 'Forms', href: '/forms' },
        { id: 'sales-logs', icon: ScrollText, label: 'Sales Logs', href: '/sales-logs' },
        { id: 'settings', icon: Settings, label: 'Settings', href: '/settings' }
      ]
    }
  }

  const menuItems = getMenuItems()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className={`fixed left-4 top-24 bottom-4 z-30 transition-all duration-300 ease-in-out rounded-2xl shadow-2xl flex flex-col scale-smooth ${
      isCollapsed ? 'w-auto-sidebar-collapsed' : 'w-auto-sidebar'
    } ${
      isDarkMode 
        ? 'bg-gray-900/95 backdrop-blur-xl border border-gray-800/50' 
        : 'bg-white/95 backdrop-blur-xl border border-gray-200/50'
    }`}>
      {/* Navigation Menu */}
      <nav className="flex-1 py-6 pt-8">
        <div className="space-y-2 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.id
            
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? isDarkMode
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      : 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                aria-label={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                
                {!isCollapsed && (
                  <span className="font-medium text-sm truncate">
                    {item.label}
                  </span>
                )}

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className={`absolute left-16 px-3 py-2 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap ${
                    isDarkMode
                      ? 'bg-gray-800 text-gray-200 border border-gray-700'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}>
                    {item.label}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-gray-700/30 p-3 space-y-3">
        {/* Theme Switcher */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isCollapsed && (
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Theme
            </span>
          )}
          
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-xl transition-all duration-300 hover:scale-110 ${
              isDarkMode
                ? 'hover:bg-gray-800/50 text-orange-400'
                : 'hover:bg-gray-100/50 text-orange-600'
            }`}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>



        {/* User Profile */}
        <button 
          onClick={() => navigate('/profile')}
          className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 hover:scale-105 ${
            isDarkMode ? 'bg-gray-800/30 hover:bg-gray-800/50' : 'bg-gray-100/30 hover:bg-gray-100/50'
          } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
            isCollapsed ? '' : 'mr-3'
          } ${user?.photoUrl ? 'border-2 border-orange-500' : 'bg-gradient-to-r from-orange-500 to-orange-600'}`}>
            {user?.photoUrl ? (
              <img 
                src={user.photoUrl} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            ) : (
              user?.firstName?.charAt(0) || user?.name?.charAt(0) || 'S'
            )}
          </div>
          
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.name || 'Super Admin'}
              </p>
              <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {user?.companyName || user?.role?.replace('_', ' ') || 'Administrator'}
              </p>
            </div>
          )}
        </button>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className={`w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative ${
            isDarkMode
              ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
              : 'text-red-600 hover:text-red-700 hover:bg-red-500/10'
          } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
          aria-label={isCollapsed ? 'Logout' : undefined}
        >
          <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
          
          {!isCollapsed && (
            <span className="font-medium text-sm truncate">
              Logout
            </span>
          )}

          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className={`absolute left-16 px-3 py-2 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap ${
              isDarkMode
                ? 'bg-gray-800 text-gray-200 border border-gray-700'
                : 'bg-white text-gray-900 border border-gray-200'
            }`}>
              Logout
            </div>
          )}
        </button>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full border-2 border-orange-500 bg-gradient-to-r from-orange-400 to-orange-500 text-white flex items-center justify-center transition-all duration-200 hover:scale-110 hover:from-orange-500 hover:to-orange-600 z-40 shadow-lg"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </div>
  )
}

export default Sidebar
