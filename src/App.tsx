import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import FrontendLogger from './utils/logger'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import CenterAdminDashboard from './pages/CenterAdminDashboard'
import CenterAgents from './pages/CenterAgents'
import CenterAdminCampaigns from './pages/CenterAdminCampaigns'
import PasswordChange from './pages/PasswordChange'
import Profile from './pages/Profile'
import Clients from './pages/Clients'
import Campaigns from './pages/Campaigns'
import Centers from './pages/Centers'
import Forms from './pages/Forms'
import PublicForm from './pages/PublicForm'
import TPSCheck from './pages/TPSCheck'
import SalesLogs from './pages/SalesLogs'
import AgentDashboard from './pages/AgentDashboard'
import AgentLeadForm from './pages/AgentLeadForm'
import AITargets from './pages/AITargets'
import CampaignAIConfig from './pages/CampaignAIConfig'
import AITargetDashboard from './pages/AITargetDashboard'
import SystemLogs from './pages/SystemLogs'
import CenterTargets from './pages/CenterTargets'
import Notifications from './pages/Notifications'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  useEffect(() => {
    // Initialize frontend logging
    FrontendLogger.init()
    
    // Cleanup on unmount
    return () => {
      FrontendLogger.cleanup()
    }
  }, [])

  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="min-h-screen">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/change-password" 
              element={
                <ProtectedRoute>
                  <PasswordChange />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/super-admin" 
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <SuperAdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/center-admin" 
              element={
                <ProtectedRoute requiredRole="center_admin">
                  <CenterAdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/center-admin/agents" 
              element={
                <ProtectedRoute requiredRole="center_admin">
                  <CenterAgents />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/center-admin/targets" 
              element={
                <ProtectedRoute requiredRole="center_admin">
                  <CenterTargets />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/center-admin/campaigns" 
              element={
                <ProtectedRoute requiredRole="center_admin">
                  <CenterAdminCampaigns />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/agent" 
              element={
                <ProtectedRoute requiredRole="agent">
                  <AgentDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/agent/lead-form" 
              element={
                <ProtectedRoute requiredRole="agent">
                  <AgentLeadForm />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
                            <Route
                  path="/users"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <Clients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/campaigns"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <Campaigns />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/centers"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <Centers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/forms"
                  element={
                    <ProtectedRoute requiredRole="super_admin">
                      <Forms />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales-logs"
                  element={
                    <ProtectedRoute>
                      <SalesLogs />
                    </ProtectedRoute>
                  }
                />
                            <Route 
              path="/ai-targets" 
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <AITargets />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/campaign-ai-config" 
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <CampaignAIConfig />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ai-target-dashboard" 
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <AITargetDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/system-logs" 
              element={
                <ProtectedRoute requiredRole="super_admin">
                  <SystemLogs />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute requiredRole={["super_admin", "center_admin"]}>
                  <Notifications />
                </ProtectedRoute>
              } 
            />
                
                {/* Public Routes - No Authentication Required */}
                <Route path="/form/:slug" element={<PublicForm />} />
                <Route path="/tps-check" element={<TPSCheck />} />
                
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

