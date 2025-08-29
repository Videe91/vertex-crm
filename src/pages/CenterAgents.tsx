import React, { useState, useEffect, useRef } from 'react'
import { 
  Plus, 
  Search, 
  Eye, 
  EyeOff,
  Users, 
  Shield, 
  Crown,
  User,
  Key,
  Building2,
  Trash2,
  Copy,
  Check,
  Edit
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'

interface Agent {
  id: number
  agent_id: string
  title?: string
  name: string
  alias?: string
  email: string
  phone: string
  role: 'agent' | 'team_leader' | 'manager' | 'sme'
  team_id?: number
  manager_id?: number
  temp_password?: string
  first_login?: number
  current_password?: string
  status: 'active' | 'inactive' | 'training'
  created_at: string
  last_login?: string
  campaign_id?: number
  campaign_name?: string
  date_of_birth?: string
  team_leader_id?: number
}

interface Campaign {
  campaign_id: number
  campaign_name: string
  campaign_type: string
  country: string
  client_rate: number
  payment_type: string
  payment_frequency: string
  campaign_status: string
  center_commission: number
  assigned_date: string
  assignment_status: string
  client_name?: string
}

const CenterAgents: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [copiedPasswords, setCopiedPasswords] = useState<{[key: number]: boolean}>({})
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [passwordVisibility, setPasswordVisibility] = useState<{[key: number]: boolean}>({})
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const agentHeaderRef = useRef<HTMLTableCellElement>(null)
  
  // Alias suggestion states
  const [aliasSuggestions, setAliasSuggestions] = useState<string[]>([])
  const [loadingAliasSuggestions, setLoadingAliasSuggestions] = useState(false)

  
  // Form state for adding new agent
  const [formData, setFormData] = useState({
    title: '',
    name: '',
    alias: '',
    email: '',
    phone: '',
    role: 'agent' as Agent['role'],
    campaign_id: '',
    date_of_birth: ''
  })

  // Form state for editing agent
  const [editFormData, setEditFormData] = useState({
    email: '',
    phone: '',
    campaign_id: '',
    date_of_birth: ''
  })

  // Generate alias suggestions
  const generateAliasSuggestions = async () => {
    if (!formData.name.trim()) return
    
    setLoadingAliasSuggestions(true)
    try {
      const response = await fetch('/api/center-admin/generate-alias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({
          agentName: formData.name,
          agentTitle: formData.title,
          campaignId: formData.campaign_id || null
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setAliasSuggestions(data.suggestions || [])
      } else {
        console.error('Failed to generate alias suggestions')
        setAliasSuggestions([])
      }
    } catch (error) {
      console.error('Error generating alias suggestions:', error)
      setAliasSuggestions([])
    } finally {
      setLoadingAliasSuggestions(false)
    }
  }

  // Fetch agents
  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/center-admin/agents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setAgents(data.agents || [])
      }
    } catch (error) {
      console.error('Error fetching agents:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch campaigns available to this center
  const fetchCampaigns = async () => {
    // Try both user.center.id and user.center_id for compatibility
    const centerId = user?.center?.id || user?.center_id
    

    
    if (!centerId) {
      console.log('No center ID found, cannot fetch campaigns')
      return
    }
    
    try {
      const response = await fetch(`/api/centers/${centerId}/campaigns`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()

        // Server returns { success: true, data: campaigns }
        setCampaigns(data.data || data.campaigns || [])
      } else {
        const error = await response.json()
        console.error('Failed to fetch campaigns:', error)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  useEffect(() => {
    if (user) {
      fetchAgents()
      fetchCampaigns()
    }
  }, [user])

  // Auto-generate alias suggestions when campaign or name changes
  useEffect(() => {
    if (formData.name.trim() && formData.campaign_id && !formData.alias) {
      // Small delay to avoid too many API calls while typing
      const timeoutId = setTimeout(() => {
        generateAliasSuggestions()
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }, [formData.campaign_id, formData.name])

  // Set custom padding for agent header to align with name text
  useEffect(() => {
    if (agentHeaderRef.current) {
      agentHeaderRef.current.style.paddingLeft = '88px'
    }
  }, [])

  // Generate agent ID
  const generateAgentId = (centerCode: string, role: string, name: string) => {
    const rolePrefix = {
      'agent': 'AG',
      'team_leader': 'TL', 
      'manager': 'MG',
      'sme': 'SME'
    }[role] || 'AG'
    
    const namePrefix = name.split(' ')[0].substring(0, 3).toUpperCase()
    const randomNum = Math.floor(Math.random() * 999) + 1
    return `${centerCode}_${rolePrefix}_${namePrefix}${randomNum.toString().padStart(3, '0')}`
  }

  // Generate temporary password
  const generateTempPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const centerCode = user?.center?.center_code || 'CTR'
    const agentId = generateAgentId(centerCode, formData.role, formData.name)
    const tempPassword = generateTempPassword()
    
    try {
      const response = await fetch('/api/center-admin/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({
          ...formData,
          agent_id: agentId,
          temp_password: tempPassword,
          campaign_id: formData.campaign_id ? parseInt(formData.campaign_id) : null,
          date_of_birth: formData.date_of_birth || null
        })
      })
      
      if (response.ok) {
        const selectedCampaign = campaigns.find(c => c.campaign_id === parseInt(formData.campaign_id))
        const campaignInfo = selectedCampaign ? `\nAssigned Campaign: ${selectedCampaign.campaign_name}` : ''
        alert(`Agent created successfully!\n\nAgent ID: ${agentId}\nTemporary Password: ${tempPassword}${campaignInfo}\n\nPlease share these credentials with the agent.`)
        setFormData({ title: '', name: '', alias: '', email: '', phone: '', role: 'agent', campaign_id: '', date_of_birth: '' })
        setAliasSuggestions([])
        setShowAddModal(false)
        fetchAgents()
      } else {
        const error = await response.json()
        alert('Error creating agent: ' + error.message)
      }
    } catch (error) {
      console.error('Error creating agent:', error)
      alert('Error creating agent. Please try again.')
    }
  }

  // Toggle password visibility
  const togglePasswordVisibility = (agentId: number) => {
    setPasswordVisibility(prev => ({ ...prev, [agentId]: !prev[agentId] }))
  }

  // Copy password to clipboard
  const copyPassword = async (agent: Agent) => {
    try {
      const password = agent.temp_password || agent.current_password
      if (password) {
        await navigator.clipboard.writeText(password)
        setCopiedPasswords(prev => ({ ...prev, [agent.id]: true }))
        setTimeout(() => {
          setCopiedPasswords(prev => ({ ...prev, [agent.id]: false }))
        }, 2000)
      } else {
        alert('No password available. Please reset the password first.')
      }
    } catch (error) {
      console.error('Error copying password:', error)
      alert('Failed to copy password. Please try again.')
    }
  }

  // Reset agent password
  const resetPassword = async (agent: Agent) => {
    const newPassword = generateTempPassword()
    
    try {
      const response = await fetch(`/api/center-admin/agents/${agent.id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({ temp_password: newPassword })
      })
      
      if (response.ok) {
        alert(`Password reset for ${agent.name}\n\nNew Temporary Password: ${newPassword}\n\nPlease share this with the agent.`)
        fetchAgents()
      }
    } catch (error) {
      console.error('Error resetting password:', error)
    }
  }

  // Delete agent
  const deleteAgent = async (agent: Agent) => {
    try {
      const response = await fetch(`/api/center-admin/agents/${agent.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      
      if (response.ok) {
        alert(`Agent ${agent.name} has been deleted.`)
        fetchAgents()
        setDeleteConfirm(null)
      } else {
        const error = await response.json()
        alert('Error deleting agent: ' + (error.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error deleting agent:', error)
      alert('Error deleting agent. Please try again.')
    }
  }

  // Open edit modal
  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent)
    setEditFormData({
      email: agent.email || '',
      phone: agent.phone || '',
      campaign_id: agent.campaign_id?.toString() || '',
      date_of_birth: agent.date_of_birth || ''
    })
    setShowEditModal(true)
  }

  // Handle edit form submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingAgent) return
    
    try {
      const response = await fetch(`/api/center-admin/agents/${editingAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({
          email: editFormData.email,
          phone: editFormData.phone,
          campaign_id: editFormData.campaign_id ? parseInt(editFormData.campaign_id) : null,
          date_of_birth: editFormData.date_of_birth || null
        })
      })
      
      if (response.ok) {
        const selectedCampaign = campaigns.find(c => c.campaign_id === parseInt(editFormData.campaign_id))
        const campaignInfo = selectedCampaign ? `\nUpdated Campaign: ${selectedCampaign.campaign_name}` : '\nCampaign: Not assigned'
        alert(`Agent ${editingAgent.name} updated successfully!${campaignInfo}`)
        setShowEditModal(false)
        setEditingAgent(null)
        fetchAgents()
      } else {
        const error = await response.json()
        alert('Error updating agent: ' + error.message)
      }
    } catch (error) {
      console.error('Error updating agent:', error)
      alert('Error updating agent. Please try again.')
    }
  }

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.agent_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (agent.alias && agent.alias.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesRole = roleFilter === 'all' || agent.role === roleFilter
    return matchesSearch && matchesRole
  })

  // Role icons and colors
  const getRoleDisplay = (role: Agent['role']) => {
    switch (role) {
      case 'manager':
        return { icon: Crown, label: 'Manager', color: 'text-purple-500' }
      case 'team_leader':
        return { icon: Shield, label: 'Team Leader', color: 'text-blue-500' }
      case 'sme':
        return { icon: Users, label: 'SME', color: 'text-green-500' }
      default:
        return { icon: User, label: 'Agent', color: 'text-gray-500' }
    }
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Sidebar */}
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode}
        activeItem="agents"
        userRole={user?.role}
      />

      {/* Main Content */}
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Agent Management
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage your center's agents, team leaders, and managers
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              isDarkMode ? 'bg-gray-800' : 'bg-white border'
            }`}>
              <Building2 className="w-4 h-4 text-orange-500" />
              <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {user?.center?.center_name}
              </span>
            </div>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Agent
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
              isDarkMode ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            title="Filter by role"
            aria-label="Filter agents by role"
            className={`px-4 py-2 rounded-lg border ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Roles</option>
            <option value="agent">Agents</option>
            <option value="team_leader">Team Leaders</option>
            <option value="manager">Managers</option>
            <option value="sme">SME</option>
          </select>
        </div>

        {/* Agents List */}
        <div className={`rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg overflow-hidden`}>
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
              <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading agents...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <tr>
                    <th 
                      ref={agentHeaderRef}
                      className={`py-3 text-left text-xs font-medium ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-500'
                      } uppercase tracking-wider`}
                    >
                      Agent
                    </th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    } uppercase tracking-wider`}>Role</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    } uppercase tracking-wider`}>Contact</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    } uppercase tracking-wider`}>Campaign</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    } uppercase tracking-wider`}>Password</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    } uppercase tracking-wider`}>Status</th>
                    <th className={`px-2 py-3 text-left text-xs font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    } uppercase tracking-wider`}>Last Login</th>
                    <th className={`pl-2 pr-6 py-3 text-left text-xs font-medium ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-500'
                    } uppercase tracking-wider`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} divide-y ${
                  isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
                }`}>
                  {filteredAgents.map((agent) => {
                    const roleDisplay = getRoleDisplay(agent.role)
                    const RoleIcon = roleDisplay.icon
                    
                    return (
                      <tr key={agent.id} className={`hover:${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <td className="pl-6 pr-2 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center">
                                <span className="text-white font-semibold">
                                  {agent.name.charAt(0)}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {agent.name}
                                {agent.alias && (
                                  <span className={`ml-2 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    ({agent.alias})
                                  </span>
                                )}
                              </div>
                              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {agent.agent_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                            agent.role === 'agent' 
                              ? 'bg-orange-100 text-orange-800' 
                              : agent.role === 'team_leader'
                              ? 'bg-blue-100 text-blue-800'
                              : agent.role === 'manager'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            <RoleIcon className="w-3 h-3" />
                            {roleDisplay.label}
                          </span>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap">
                          <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {agent.email}
                          </div>
                          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {agent.phone}
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap">
                          <div className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {agent.campaign_name || 'Not assigned'}
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`text-sm font-mono ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                              {agent.temp_password ? (
                                passwordVisibility[agent.id] ? agent.temp_password : '••••••••'
                              ) : agent.current_password ? (
                                passwordVisibility[agent.id] ? agent.current_password : '••••••••'
                              ) : 'Password set - use reset to view'}
                            </div>
                            {(agent.temp_password || agent.current_password) && (
                              <button
                                onClick={() => togglePasswordVisibility(agent.id)}
                                className={`p-1 rounded transition-colors ${
                                  isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                                }`}
                                title={passwordVisibility[agent.id] ? "Hide Password" : "Show Password"}
                              >
                                {passwordVisibility[agent.id] ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => copyPassword(agent)}
                              className={`p-1 rounded transition-colors ${
                                copiedPasswords[agent.id] 
                                  ? 'text-green-600 hover:text-green-700' 
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                              title={copiedPasswords[agent.id] ? "Password Copied!" : "Copy Password"}
                            >
                              {copiedPasswords[agent.id] ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            agent.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : agent.status === 'training'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {agent.status}
                          </span>
                        </td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm">
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                            {agent.last_login ? new Date(agent.last_login).toLocaleDateString() : 'Never'}
                          </span>
                        </td>
                        <td className="pl-2 pr-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(agent)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded"
                              title="Edit Agent"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => resetPassword(agent)}
                              className="text-orange-600 hover:text-orange-900 p-1 rounded"
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            {deleteConfirm === agent.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => deleteAgent(agent)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded text-xs font-medium"
                                  title="Confirm Delete"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-gray-600 hover:text-gray-800 p-1 rounded text-xs font-medium"
                                  title="Cancel Delete"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(agent.id)}
                                className="text-red-600 hover:text-red-900 p-1 rounded"
                                title="Delete Agent"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {filteredAgents.length === 0 && !loading && (
                <div className="p-8 text-center">
                  <Users className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    No agents found
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                    {searchTerm || roleFilter !== 'all' ? 'Try adjusting your filters' : 'Start by adding your first agent'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl p-6 w-full max-w-md ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Add New Agent
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Title *
                </label>
                <select
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  title="Select agent's title"
                  aria-label="Select the title for the agent (Mr., Ms., Mrs., Mx.)"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select Title</option>
                  <option value="Mr">Mr.</option>
                  <option value="Ms">Ms.</option>
                  <option value="Mrs">Mrs.</option>
                  <option value="Mx">Mx.</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter agent's full name"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Date of Birth *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                  title="Select date of birth"
                  aria-label="Select the agent's date of birth"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Role *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as Agent['role']})}
                  title="Select agent role"
                  aria-label="Select the role for the new agent"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="agent">Agent</option>
                  <option value="team_leader">Team Leader</option>
                  <option value="manager">Manager</option>
                  <option value="sme">SME (Subject Matter Expert)</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Assign Campaign *
                </label>
                <select
                  required
                  value={formData.campaign_id}
                  onChange={(e) => setFormData({...formData, campaign_id: e.target.value})}
                  title="Select campaign to assign"
                  aria-label="Select the campaign to assign to the agent"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Select Campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.campaign_id} value={campaign.campaign_id}>
                      {campaign.campaign_name}
                    </option>
                  ))}
                </select>
                {campaigns.length === 0 && (
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-600'
                  }`}>
                    No campaigns available. Please contact admin to assign campaigns to this center.
                  </p>
                )}
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`block text-sm font-medium ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Alias
                    <span className={`ml-1 text-xs font-normal ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                      (cannot be changed later)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={generateAliasSuggestions}
                    disabled={!formData.name.trim() || loadingAliasSuggestions}
                    className={`text-xs px-2 py-1 rounded ${
                      isDarkMode 
                        ? 'bg-orange-600 hover:bg-orange-700 text-white disabled:bg-gray-600' 
                        : 'bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-300'
                    } disabled:cursor-not-allowed`}
                  >
                    {loadingAliasSuggestions ? '...' : '✨ Suggest'}
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => setFormData({...formData, alias: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter agent's alias (optional)"
                />
                
                {/* Alias Suggestions */}
                {aliasSuggestions.length > 0 && (
                  <div className="mt-2">
                    <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      AI Suggestions:
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {aliasSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setFormData({...formData, alias: suggestion})}
                          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                            formData.alias === suggestion
                              ? isDarkMode
                                ? 'bg-orange-600 border-orange-600 text-white'
                                : 'bg-orange-500 border-orange-500 text-white'
                              : isDarkMode
                                ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setAliasSuggestions([])
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
                >
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {showEditModal && editingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className={`rounded-xl p-6 w-full max-w-md ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Edit Agent: {editingAgent.name}
              {editingAgent.alias && (
                <span className={`ml-2 text-sm font-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  (Alias: {editingAgent.alias})
                </span>
              )}
            </h3>
            
            {editingAgent.alias && (
              <div className={`mb-4 p-3 rounded-lg ${
                isDarkMode ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <span className="font-medium">Current Alias:</span> {editingAgent.alias}
                </p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                  ⚠️ Alias cannot be changed once set for security and consistency reasons.
                </p>
              </div>
            )}
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editFormData.date_of_birth}
                  onChange={(e) => setEditFormData({...editFormData, date_of_birth: e.target.value})}
                  title="Select date of birth"
                  aria-label="Select the agent's date of birth"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Assign Campaign
                </label>
                <select
                  value={editFormData.campaign_id}
                  onChange={(e) => setEditFormData({...editFormData, campaign_id: e.target.value})}
                  title="Select campaign to assign"
                  aria-label="Select the campaign to assign to the agent"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">No Campaign (Optional)</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.campaign_id} value={campaign.campaign_id}>
                      {campaign.campaign_name}
                    </option>
                  ))}
                </select>
                {campaigns.length === 0 && (
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-600'
                  }`}>
                    No campaigns available. Please contact admin to assign campaigns to this center.
                  </p>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingAgent(null)
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg border ${
                    isDarkMode 
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Update Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CenterAgents
