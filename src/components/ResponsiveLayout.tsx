import React from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  title: string
  isDarkMode: boolean
  setIsDarkMode: (value: boolean) => void
  activeItem?: string
  userRole?: string
  className?: string
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  title,
  isDarkMode,
  setIsDarkMode,
  activeItem = 'dashboard',
  userRole,
  className = ''
}) => {
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
        activeItem={activeItem}
        userRole={userRole}
      />
      
      {/* Main Content */}
      <div className="flex-1 ml-16 sm:ml-20 lg:ml-24 transition-all duration-300 overflow-x-hidden">
        {/* Top Header */}
        <Header title={title} isDarkMode={isDarkMode} />
        
        {/* Scrollable Content Area */}
        <div className={`p-4 sm:p-6 lg:p-8 max-w-full overflow-x-auto min-h-[calc(100vh-5rem)] ${className}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default ResponsiveLayout
