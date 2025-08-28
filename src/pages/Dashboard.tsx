import React from 'react'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-white">VERTEX CRM Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-white">
                <User className="w-5 h-5" />
                <span>{user?.name}</span>
                <span className="text-sm text-slate-400">({user?.role?.replace('_', ' ').toUpperCase()})</span>
              </div>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Welcome to VERTEX CRM, {user?.name}!
          </h2>
          <p className="text-slate-400 mb-6">
            Your dashboard is ready. The full CRM interface will be implemented here.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Quick Stats</h3>
              <p className="text-slate-400">Dashboard statistics will appear here</p>
            </div>
            
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Recent Activity</h3>
              <p className="text-slate-400">Latest activities will be shown here</p>
            </div>
            
            <div className="bg-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Performance</h3>
              <p className="text-slate-400">Performance metrics will be displayed here</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard

