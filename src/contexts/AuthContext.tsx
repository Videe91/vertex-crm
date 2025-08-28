import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, apiService } from '../services/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isDarkMode: boolean
  setIsDarkMode: (isDarkMode: boolean) => void
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; redirectUrl?: string }>
  logout: () => Promise<void>
  updateProfile?: (updatedUser: any) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDarkMode, setIsDarkModeState] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    let isCanceled = false
    
    const initAuth = async () => {
      // Clean up any stale state on initialization
      apiService.cleanup()
      
      const token = localStorage.getItem('vertex_token')
      if (token && !isCanceled) {
        try {
          const currentUser = await apiService.getCurrentUser()
          if (!isCanceled && currentUser) {
            setUser(currentUser)
          }
        } catch (error) {
          console.error('Failed to get current user:', error)
          // Only clear token if we're still the active effect
          if (!isCanceled) {
            localStorage.removeItem('vertex_token')
            setUser(null)
          }
        }
      }
      if (!isCanceled) {
        setIsLoading(false)
      }
    }

    initAuth()
    
    return () => {
      isCanceled = true
    }
  }, [])

  const login = async (username: string, password: string) => {
    // Clear any existing user state first to prevent conflicts
    setUser(null)
    
    try {
      const response = await apiService.login({ username, password })
      
      if (response.success) {
        setUser(response.user)
        
        // Check if this is a first login requiring password change
        if (response.firstLogin) {
          window.location.href = '/change-password'
          return { success: true }
        }
        
        // Auto-route based on user role
        const roleRoutes = {
          'super_admin': '/super-admin',
          'center_admin': '/center-admin',
          'agent': '/agent', 
          'qa': '/dashboard',
          'client': '/dashboard'
        }
        
        const redirectUrl = roleRoutes[response.user.role as keyof typeof roleRoutes] || '/dashboard'
        
        return { success: true, redirectUrl }
      } else {
        // Ensure user state is cleared on failed login
        setUser(null)
        return { success: false, error: response.error || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      // Ensure user state is cleared on error
      setUser(null)
      return { success: false, error: 'Connection error. Please try again.' }
    }
  }

  const logout = async () => {
    // Clear user state immediately to prevent UI flicker
    setUser(null)
    
    try {
      await apiService.logout()
    } catch (error) {
      console.error('Logout error:', error)
      // Continue with cleanup even if server logout fails
    }
  }

  const updateProfile = (updatedUser: any) => {
    setUser(updatedUser)
  }

  const setIsDarkMode = (newDarkMode: boolean) => {
    setIsDarkModeState(newDarkMode)
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light')
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isDarkMode,
    setIsDarkMode,
    login,
    logout,
    updateProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

