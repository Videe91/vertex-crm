import React, { useState, useRef } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Camera, 
  User, 
  Building, 
  Save,
  Shield,
  Key
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from '../components/Sidebar'
import Logo from '../components/Logo'

const Profile: React.FC = () => {
  const { user, updateProfile, isDarkMode, setIsDarkMode } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form state - Auto-populate from user.name if firstName/lastName are empty
  const [firstName, setFirstName] = useState(() => {
    if (user?.firstName) return user.firstName
    if (user?.name) {
      const nameParts = user.name.split(' ')
      return nameParts[0] || ''
    }
    return ''
  })
  const [lastName, setLastName] = useState(() => {
    if (user?.lastName) return user.lastName
    if (user?.name) {
      const nameParts = user.name.split(' ')
      return nameParts.slice(1).join(' ') || ''
    }
    return ''
  })
  const [companyName, setCompanyName] = useState(() => {
    if (user?.companyName) return user.companyName
    // Auto-set company name based on center for center admins and agents
    if ((user?.role === 'center_admin' || user?.role === 'agent') && user?.center?.center_name) {
      return user.center.center_name
    }
    return ''
  })
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState(user?.photoUrl || '')

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Photo size must be less than 5MB')
        return
      }
      
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      
      setProfilePhoto(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Profile form submitted!')
    
    if (!firstName.trim() && user?.role !== 'agent') {
      setError('First name is required')
      return
    }
    
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('vertex_token')
      console.log('Token exists:', !!token)
      
      if (!token) {
        setError('Authentication token not found. Please login again.')
        return
      }

      const formData = new FormData()
      // Only allow name changes for non-agents
      if (user?.role !== 'agent') {
        formData.append('firstName', firstName.trim())
        formData.append('lastName', lastName.trim())
        formData.append('companyName', companyName.trim())
      } else {
        // For agents, only allow photo updates
        // Names and company are managed by the system
      }
      
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto)
      }

      // Call API to update profile
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: formData
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)
      
      const data = await response.json()
      console.log('Response data:', data)

      if (data.success) {
        // Update user context
        if (updateProfile) {
          updateProfile({
            ...user,
            firstName,
            lastName,
            companyName,
            photoUrl: data.photoUrl || photoPreview
          })
        }
        
        setSuccess('Profile updated successfully!')
        
        // Redirect back to appropriate dashboard after 2 seconds
        setTimeout(() => {
          if (user?.role === 'center_admin') {
            navigate('/center-admin')
          } else if (user?.role === 'agent') {
            navigate('/agent')
          } else {
            navigate('/super-admin')
          }
        }, 2000)
      } else {
        setError(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Profile update error:', error)
      setError('Failed to update profile. Please try again.')
    }

    setIsLoading(false)
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Independent Logo */}
      <Logo isDarkMode={isDarkMode} />

      {/* Floating Sidebar */}
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode}
        activeItem="profile"
      />

      {/* Main Content */}
      <div className="flex-1 ml-24 transition-all duration-300">
        {/* Top Header */}
        <div className={`h-20 flex items-center justify-between px-8 ml-16 border-b backdrop-blur-xl ${
          isDarkMode 
            ? 'bg-gray-900/50 border-gray-700/50' 
            : 'bg-white/50 border-gray-200/50'
        }`}>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                if (user?.role === 'center_admin') {
                  navigate('/center-admin')
                } else if (user?.role === 'agent') {
                  navigate('/agent')
                } else {
                  navigate('/super-admin')
                }
              }}
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 ${
                isDarkMode 
                  ? 'hover:bg-gray-800/50 text-gray-300' 
                  : 'hover:bg-gray-100/50 text-gray-600'
              }`}
              aria-label="Go back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className={`text-2xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Profile Settings
            </h1>
          </div>
        </div>

        {/* Profile Form */}
        <div className="p-8">
          <div className="max-w-2xl mx-auto">
            <div className={`backdrop-blur-xl rounded-3xl shadow-2xl p-8 transition-all duration-300 ${
              isDarkMode
                ? 'bg-white/5 border border-white/10'
                : 'bg-white/70 border border-gray-200/50'
            }`}>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Profile Photo Section */}
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <div className={`w-24 h-24 rounded-full overflow-hidden ${
                      photoPreview ? 'border-4 border-orange-500' : 'bg-gradient-to-r from-orange-500 to-orange-600'
                    } flex items-center justify-center`}>
                      {photoPreview ? (
                        <img 
                          src={photoPreview} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-bold text-2xl">
                          {firstName?.charAt(0) || user?.name?.charAt(0) || 'S'}
                        </span>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 w-8 h-8 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center transition-colors duration-200"
                      aria-label="Upload profile photo"
                    >
                      <Camera className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    aria-label="Profile photo file input"
                  />
                  
                  <p className={`text-sm text-center ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Click the camera icon to upload your photo
                    <br />
                    (Max size: 5MB)
                  </p>
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      First Name *
                    </label>
                    <div className="relative">
                      <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? 'text-orange-400' : 'text-orange-600'
                      }`} />
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        readOnly={user?.role === 'agent'}
                        className={`w-full pl-12 pr-4 py-3 rounded-xl transition-all duration-300 ${
                          user?.role === 'agent'
                            ? `cursor-not-allowed ${
                                isDarkMode
                                  ? 'bg-gray-800/50 border border-gray-700/50 text-gray-400'
                                  : 'bg-gray-100/50 border border-gray-300/50 text-gray-600'
                              }`
                            : `focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                                isDarkMode
                                  ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                                  : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                              }`
                        }`}
                        placeholder={user?.role === 'agent' ? 'Auto-filled from your account' : 'Enter your first name'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Last Name
                    </label>
                    <div className="relative">
                      <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                        isDarkMode ? 'text-orange-400' : 'text-orange-600'
                      }`} />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        readOnly={user?.role === 'agent'}
                        className={`w-full pl-12 pr-4 py-3 rounded-xl transition-all duration-300 ${
                          user?.role === 'agent'
                            ? `cursor-not-allowed ${
                                isDarkMode
                                  ? 'bg-gray-800/50 border border-gray-700/50 text-gray-400'
                                  : 'bg-gray-100/50 border border-gray-300/50 text-gray-600'
                              }`
                            : `focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                                isDarkMode
                                  ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                                  : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                              }`
                        }`}
                        placeholder={user?.role === 'agent' ? 'Auto-filled from your account' : 'Enter your last name'}
                      />
                    </div>
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Company Name
                  </label>
                  <div className="relative">
                    <Building className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      readOnly={user?.role === 'agent'}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl transition-all duration-300 ${
                        user?.role === 'agent'
                          ? `cursor-not-allowed ${
                              isDarkMode
                                ? 'bg-gray-800/50 border border-gray-700/50 text-gray-400'
                                : 'bg-gray-100/50 border border-gray-300/50 text-gray-600'
                            }`
                          : `focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                              isDarkMode
                                ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                                : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                            }`
                      }`}
                      placeholder={user?.role === 'agent' ? 'Auto-filled from your center' : 'Enter your company name'}
                    />
                  </div>
                </div>

                {/* Role Display */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Account Type
                  </label>
                  <div className="relative">
                    <Shield className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <div className={`w-full pl-12 pr-4 py-3 rounded-xl border ${
                      isDarkMode
                        ? 'bg-white/5 border-white/20 text-white'
                        : 'bg-white/50 border-gray-300 text-gray-900'
                    }`}>
                      <span className="font-semibold text-orange-500">
                        {user?.role === 'super_admin' ? 'Super Administrator' : 
                         user?.role === 'center_admin' ? 'Center Administrator' :
                         user?.role === 'agent' ? 'Agent' :
                         user?.role === 'qa' ? 'Quality Assurance' :
                         user?.role === 'client' ? 'Client' : 'User'}
                      </span>
                      <span className={`ml-2 text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        • {user?.role === 'super_admin' ? 'Full system access' : 
                           user?.role === 'center_admin' ? 'Center management access' :
                           'Limited access'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Change Password Button - For Super Admin, Center Admin, and Agent */}
                {(user?.role === 'super_admin' || user?.role === 'center_admin' || user?.role === 'agent') && (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Security Settings
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate('/change-password')}
                      className={`w-full flex items-center justify-center py-3 px-6 rounded-xl border-2 border-dashed transition-all duration-300 hover:border-solid ${
                        isDarkMode
                          ? 'border-orange-500/50 hover:border-orange-500 bg-orange-500/5 hover:bg-orange-500/10 text-orange-400 hover:text-orange-300'
                          : 'border-orange-400/50 hover:border-orange-500 bg-orange-50 hover:bg-orange-100 text-orange-600 hover:text-orange-700'
                      }`}
                    >
                      <Key className="w-5 h-5 mr-2" />
                      Change Password
                    </button>
                  </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                  <div className={`text-sm text-center p-3 rounded-xl ${
                    isDarkMode 
                      ? 'text-red-400 bg-red-500/10 border border-red-500/20' 
                      : 'text-red-600 bg-red-500/10 border border-red-300'
                  }`}>
                    {error}
                  </div>
                )}

                {success && (
                  <div className={`text-sm text-center p-3 rounded-xl ${
                    isDarkMode 
                      ? 'text-green-400 bg-green-500/10 border border-green-500/20' 
                      : 'text-green-600 bg-green-500/10 border border-green-300'
                  }`}>
                    {success}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                    isDarkMode
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                      : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Updating Profile...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Save className="w-5 h-5 mr-2" />
                      Save Profile
                    </div>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
