import React, { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: 'super_admin' | 'center_admin' | 'agent' | 'qa' | 'client' | ('super_admin' | 'center_admin' | 'agent' | 'qa' | 'client')[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Check role-based access
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    
    if (!allowedRoles.includes(user?.role as any)) {
      // Redirect to appropriate dashboard based on user role
      const roleRoutes = {
        'super_admin': '/super-admin',
        'center_admin': '/center-admin',
        'agent': '/agent', 
        'qa': '/dashboard',
        'client': '/dashboard'
      }
      
      const userRoute = roleRoutes[user?.role as keyof typeof roleRoutes] || '/dashboard'
      return <Navigate to={userRoute} replace />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute

