import React from 'react'
import { Search } from 'lucide-react'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  title: string
  isDarkMode: boolean
}

const Header: React.FC<HeaderProps> = ({ title, isDarkMode }) => {
  return (
    <div className={`h-20 flex items-center justify-between px-8 ml-16 border-b backdrop-blur-xl ${
      isDarkMode 
        ? 'bg-gray-900/50 border-gray-700/50' 
        : 'bg-white/50 border-gray-200/50'
    }`}>
      <div>
        <h1 className={`text-2xl font-bold ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>
          {title}
        </h1>
      </div>
      
      {/* Right side - Search and Notifications */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`} />
          <input
            type="text"
            placeholder="Search..."
            className={`pl-10 pr-4 py-2 rounded-xl border transition-all duration-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
              isDarkMode
                ? 'bg-gray-800/50 border-gray-700 text-white placeholder-gray-400'
                : 'bg-white/50 border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <NotificationBell isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  )
}

export default Header
