import React, { useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, User, Lock, BarChart3, Users, TrendingUp, Sun, Moon, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import vertexLogoDark from '../assets/logos/vertex_logo_darkmode.png'
import vertexLogoLight from '../assets/logos/vertex_logo_lightmode.png'

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [error, setError] = useState('')
  const [lockoutInfo, setLockoutInfo] = useState<{remainingMinutes: number, failedAttempts: number} | null>(null)

  const { login, isAuthenticated, isLoading: authLoading, user, isDarkMode, setIsDarkMode } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Clear error when user starts typing
    if (error && (username || password)) {
      setError('')
      setLockoutInfo(null)
    }
  }, [username, password, error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username || !password) {
      setError('Please enter both username and password')
      return
    }

    setIsLoading(true)
    setError('')

    const result = await login(username, password)

    if (result.success) {
      if (result.redirectUrl) {
        navigate(result.redirectUrl, { replace: true })
      }
    } else {
      setError(result.error || 'Login failed')
      setLockoutInfo(result.lockoutInfo || null)
    }

    setIsLoading(false)
  }

  if (authLoading) {
    return (
      <div className={`min-h-screen relative overflow-hidden transition-all duration-500 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900' 
          : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
      } flex items-center justify-center`}>
        <div className={isDarkMode ? 'text-white' : 'text-gray-900'}>Loading...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    // Auto-redirect based on user role
    const roleRoutes = {
      'super_admin': '/super-admin',
      'center_admin': '/center-admin',
      'agent': '/agent', 
      'qa': '/dashboard',
      'client': '/dashboard'
    }
    
    const redirectUrl = roleRoutes[user?.role as keyof typeof roleRoutes] || '/dashboard'
    return <Navigate to={redirectUrl} replace />
  }

  return (
    <div className={`min-h-screen relative overflow-hidden transition-all duration-500 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-black to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Logo */}
      <div className="fixed -top-2 left-4 z-20 flex items-center">
        <img 
          src={isDarkMode ? vertexLogoDark : vertexLogoLight} 
          alt="VERTEX CRM Logo" 
          className={`w-auto h-32 transition-all duration-300 hover:scale-105 ${
            isDarkMode ? 'brightness-100 drop-shadow-2xl' : 'brightness-90 drop-shadow-xl'
          }`}
        />
      </div>

      {/* Theme switcher */}
      <div className="fixed -top-2 right-6 z-20 flex items-center h-32">
        <div
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`w-14 h-7 rounded-full backdrop-blur-xl border transition-all duration-300 hover:scale-110 cursor-pointer relative ${
            isDarkMode
              ? 'bg-black/80 border-white/20 hover:bg-black/90'
              : 'bg-white/80 border-black/20 hover:bg-white/90'
          }`}
        >
          {/* Icons */}
          <Moon className={`absolute left-1.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 transition-opacity duration-300 ${
            isDarkMode ? 'text-white opacity-100' : 'text-gray-400 opacity-50'
          }`} />
          <Sun className={`absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 transition-opacity duration-300 ${
            !isDarkMode ? 'text-gray-800 opacity-100' : 'text-gray-400 opacity-50'
          }`} />
          
          {/* Sliding orange circle */}
          <div className={`absolute top-0.5 w-5 h-5 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full shadow-lg transition-all duration-300 ease-in-out ${
            isDarkMode ? 'left-8' : 'left-1'
          }`}></div>
        </div>
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse ${
          isDarkMode ? 'opacity-30' : 'opacity-10'
        }`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000 ${
          isDarkMode ? 'opacity-30' : 'opacity-10'
        }`}></div>
        <div className={`absolute top-40 left-1/2 transform -translate-x-1/2 w-60 h-60 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000 ${
          isDarkMode ? 'opacity-20' : 'opacity-5'
        }`}></div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Login form */}
          <div className={`backdrop-blur-xl rounded-3xl shadow-2xl p-8 transition-all duration-300 ${
            isDarkMode
              ? 'bg-white/10 border border-white/20'
              : 'bg-white/80 border border-gray-200'
          }`}>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username field */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className={`h-5 w-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                      : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Username"
                  disabled={isLoading}
                />
              </div>

              {/* Password field */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-12 pr-12 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                      : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="Password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  disabled={isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className={`h-5 w-5 transition-colors ${isDarkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-500'}`} />
                  ) : (
                    <Eye className={`h-5 w-5 transition-colors ${isDarkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-500'}`} />
                  )}
                </button>
              </div>

              {/* Remember me and forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={`custom-checkbox w-4 h-4 border-2 border-orange-500 rounded focus:ring-orange-500/50 focus:ring-2 checked:bg-orange-500 checked:border-orange-500 relative ${
                      isDarkMode ? 'bg-black' : 'bg-white'
                    }`}
                    disabled={isLoading}
                  />
                  <span className={`ml-2 text-sm ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className={`text-sm transition-colors ${
                    isDarkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-500'
                  }`}
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className={`text-sm text-center p-3 rounded-2xl border ${
                  isDarkMode 
                    ? 'text-red-400 bg-red-500/10 border-red-500/30' 
                    : 'text-red-600 bg-red-50 border-red-200'
                }`}>
                  <div>{error}</div>
                  {lockoutInfo && (
                    <div className="mt-2 text-xs opacity-80">
                      <div>Failed attempts: {lockoutInfo.failedAttempts}/5</div>
                      {lockoutInfo.remainingMinutes > 0 && (
                        <div>Try again in: {lockoutInfo.remainingMinutes} minutes</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full font-semibold py-4 px-6 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                    : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Features showcase */}
            <div className={`mt-8 pt-6 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <p className={`text-sm text-center mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Trusted by sales teams worldwide</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Users className={`w-6 h-6 mx-auto mb-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Team Management</p>
                </div>
                <div className="text-center">
                  <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sales Analytics</p>
                </div>
                <div className="text-center">
                  <BarChart3 className={`w-6 h-6 mx-auto mb-2 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Performance Tracking</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Don't have an account?{' '}
              <button className={`transition-colors font-medium ${
                isDarkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-500'
              }`}>
                Contact Admin
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl p-8 transition-all duration-300 ${
            isDarkMode
              ? 'bg-white/10 border border-white/20'
              : 'bg-white/80 border border-gray-200'
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Reset Password</h2>
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className={`p-2 rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                }`}
                aria-label="Close modal"
              >
                <X className={`w-5 h-5 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`} />
              </button>
            </div>
            <div className="text-center">
              <p className={`text-base mb-8 leading-relaxed ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                To reset your password, please contact your centre admin.
              </p>
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className={`w-full font-semibold py-3 px-6 rounded-2xl transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                    : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                }`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login

