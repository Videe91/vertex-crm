import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { 
  Plus,
  Users,
  Search,
  Filter,
  X,
  User,
  Building,
  Target,
  Globe,
  ChevronDown,
  Save,
  Mail,
  UserCheck,
  Edit,
  Trash2,
  MoreVertical,
  Minus
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from '../components/Sidebar'
import Logo from '../components/Logo'

const Clients: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()
  const [showAddClientModal, setShowAddClientModal] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [editingClient, setEditingClient] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    clientName: '',
    clientType: '', // 'main_client' or 'broker'
    mainClientNames: [''], // Array of main client names for brokers
    contactPersonName: '', // Contact person on client side
    contactEmail: '', // Contact person email
    country: '' // Client's business country (where company is based)
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchClients = async () => {
    try {
      setIsLoadingClients(true)
      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })

      if (response.ok) {
        const clientsData = await response.json()
        setClients(clientsData)
      } else {
        console.error('Failed to fetch clients')
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setIsLoadingClients(false)
    }
  }

  // Load clients on component mount
  React.useEffect(() => {
    fetchClients()
  }, [])

  const handleEditClient = (client: any) => {
    setEditingClient(client)
    // Handle both old single string and new array format
    let mainClientNames = ['']
    if (client.main_client_name) {
      try {
        // Try to parse as JSON array first
        mainClientNames = JSON.parse(client.main_client_name)
        if (!Array.isArray(mainClientNames)) {
          // If it's a string, convert to array
          mainClientNames = [client.main_client_name]
        }
      } catch {
        // If parsing fails, treat as single string
        mainClientNames = [client.main_client_name]
      }
    }
    
    setFormData({
      clientName: client.client_name,
      clientType: client.client_type,
      mainClientNames: mainClientNames.filter(name => name.trim() !== ''),
      contactPersonName: client.contact_person_name,
      contactEmail: client.contact_email,
      country: client.country
    })
    setShowAddClientModal(true)
  }

  const handleDeleteClient = async (clientId: number) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })

      if (response.ok) {
        setShowDeleteConfirm(null)
        fetchClients() // Refresh the list
      } else {
        console.error('Failed to delete client')
      }
    } catch (error) {
      console.error('Error deleting client:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      clientName: '',
      clientType: '',
      mainClientNames: [''],
      contactPersonName: '',
      contactEmail: '',
      country: ''
    })
    setEditingClient(null)
    setFormError('')
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Reset dependent fields when parent field changes
      ...(field === 'clientType' && value !== 'broker' ? { mainClientNames: [''] } : {})
    }))
    setFormError('')
  }

  const addMainClient = () => {
    setFormData(prev => ({
      ...prev,
      mainClientNames: [...prev.mainClientNames, '']
    }))
  }

  const removeMainClient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      mainClientNames: prev.mainClientNames.filter((_, i) => i !== index)
    }))
  }

  const updateMainClient = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      mainClientNames: prev.mainClientNames.map((name, i) => i === index ? value : name)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.clientName.trim()) {
      setFormError('Client name is required')
      return
    }
    if (!formData.clientType) {
      setFormError('Please select client type')
      return
    }
    if (formData.clientType === 'broker') {
      const validMainClients = formData.mainClientNames.filter(name => name.trim() !== '')
      if (validMainClients.length === 0) {
        setFormError('At least one main client name is required for brokers')
        return
      }
    }
    if (!formData.contactPersonName.trim()) {
      setFormError('Contact person name is required')
      return
    }
    if (!formData.contactEmail.trim()) {
      setFormError('Contact email is required')
      return
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.contactEmail)) {
      setFormError('Please enter a valid email address')
      return
    }
    if (!formData.country) {
      setFormError('Please select country')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    try {
      // Call API to create or update client
      const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients'
      const method = editingClient ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({
          ...formData,
          mainClientName: formData.clientType === 'broker' 
            ? JSON.stringify(formData.mainClientNames.filter(name => name.trim() !== ''))
            : null
        })
      })

      const data = await response.json()

      if (data.success) {
        // Reset form and close modal on success
        resetForm()
        setShowAddClientModal(false)
        
        // Refresh clients list
        fetchClients()
        
      } else {
        setFormError(data.error || `Failed to ${editingClient ? 'update' : 'create'} client`)
      }
    } catch (error) {
      console.error('Client creation error:', error)
      setFormError('Failed to create client. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
        activeItem="users"
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
            <Users className={`w-6 h-6 ${
              isDarkMode ? 'text-orange-400' : 'text-orange-600'
            }`} />
            <h1 className={`text-2xl font-bold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Clients Management
            </h1>
          </div>

          {/* Add Client Button */}
          <button
            onClick={() => setShowAddClientModal(true)}
            className={`flex items-center px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
              isDarkMode
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
            }`}
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Client
          </button>
        </div>

        {/* Page Content */}
        <div className="p-8">
          {/* Search and Filter Bar */}
          <div className={`backdrop-blur-xl rounded-2xl shadow-xl p-6 mb-6 transition-all duration-300 ${
            isDarkMode
              ? 'bg-white/5 border border-white/10'
              : 'bg-white/70 border border-gray-200/50'
          }`}>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                }`} />
                <input
                  type="text"
                  placeholder="Search clients..."
                  className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                      : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>

              {/* Filter Button */}
              <button className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                isDarkMode
                  ? 'bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10'
                  : 'bg-white/50 border border-gray-300 text-gray-600 hover:bg-white/70'
              }`}>
                <Filter className="w-5 h-5 mr-2" />
                Filter
              </button>
            </div>
          </div>

          {/* Clients List */}
          <div className={`backdrop-blur-xl rounded-2xl shadow-xl transition-all duration-300 ${
            isDarkMode
              ? 'bg-white/5 border border-white/10'
              : 'bg-white/70 border border-gray-200/50'
          }`}>
            {isLoadingClients ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading clients...
                </p>
              </div>
            ) : clients.length === 0 ? (
              <div className="p-8 text-center">
                <Users className={`w-16 h-16 mx-auto mb-4 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-400'
                }`} />
                <h3 className={`text-xl font-semibold mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  No clients found
                </h3>
                <p className={`text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Get started by adding your first client
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`border-b ${
                    isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'
                  }`}>
                    <tr>
                      <th className={`text-center p-4 font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>Client</th>
                      <th className={`text-center p-4 font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>Type</th>
                      <th className={`text-center p-4 font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>Contact</th>
                      <th className={`text-center p-4 font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>Business Country</th>
                      <th className={`text-center p-4 font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>Created</th>
                      <th className={`text-center p-4 font-semibold ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client, index) => (
                      <tr key={client.id} className={`border-b transition-colors duration-200 hover:bg-opacity-50 ${
                        isDarkMode 
                          ? 'border-gray-700/30 hover:bg-gray-800/30' 
                          : 'border-gray-200/30 hover:bg-gray-100/30'
                      }`}>
                        <td className="p-4 text-center">
                          <div>
                            <div className={`font-medium ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {client.client_name}
                            </div>
                            {client.main_client_name && (() => {
                              try {
                                const mainClients = JSON.parse(client.main_client_name)
                                if (Array.isArray(mainClients) && mainClients.length > 0) {
                                  return (
                                    <div className={`text-sm ${
                                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                      Main: {mainClients.join(', ')}
                                    </div>
                                  )
                                }
                              } catch {
                                // Fallback for old single string format
                                return (
                                  <div className={`text-sm ${
                                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                  }`}>
                                    Main: {client.main_client_name}
                                  </div>
                                )
                              }
                            })()}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            client.client_type === 'broker'
                              ? isDarkMode
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-blue-500/10 text-blue-600'
                              : isDarkMode
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-green-500/10 text-green-600'
                          }`}>
                            {client.client_type === 'broker' ? 'Broker' : 'Main Client'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div>
                            <div className={`font-medium ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {client.contact_person_name}
                            </div>
                            <div className={`text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {client.contact_email}
                            </div>
                          </div>
                        </td>

                        <td className="p-4 text-center">
                          <span className={`${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {client.country}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {new Date(client.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleEditClient(client)}
                              className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                                isDarkMode
                                  ? 'hover:bg-blue-500/20 text-blue-400 hover:text-blue-300'
                                  : 'hover:bg-blue-500/10 text-blue-600 hover:text-blue-700'
                              }`}
                              aria-label="Edit client"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(client.id)}
                              className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                                isDarkMode
                                  ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
                                  : 'hover:bg-red-500/10 text-red-600 hover:text-red-700'
                              }`}
                              aria-label="Delete client"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/95 border border-white/10'
              : 'bg-white/95 border border-gray-200/50'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-6 border-b ${
              isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl ${
                  isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
                }`}>
                  <Users className={`w-6 h-6 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                </div>
                <h2 className={`text-xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h2>
              </div>
              
              <button
                onClick={() => setShowAddClientModal(false)}
                className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 ${
                  isDarkMode 
                    ? 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200' 
                    : 'hover:bg-gray-100/50 text-gray-600 hover:text-gray-800'
                }`}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Client Form */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                {/* Client Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Client Name *
                  </label>
                  <div className="relative">
                    <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <input
                      type="text"
                      required
                      value={formData.clientName}
                      onChange={(e) => handleInputChange('clientName', e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                        isDarkMode
                          ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                          : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Enter client name"
                    />
                  </div>
                </div>

                {/* Client Type */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Client Type *
                  </label>
                  <div className="relative">
                    <Building className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <select
                      required
                      value={formData.clientType}
                      onChange={(e) => handleInputChange('clientType', e.target.value)}
                      aria-label="Select client type"
                      className={`w-full pl-12 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 appearance-none ${
                        isDarkMode
                          ? 'bg-white/5 border border-white/20 text-white'
                          : 'bg-white/50 border border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">Select client type</option>
                      <option value="main_client">Main Client</option>
                      <option value="broker">Broker (Outsourcing to us)</option>
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`} />
                  </div>
                </div>

                {/* Main Client Names - Only show if client type is broker */}
                {formData.clientType === 'broker' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`block text-sm font-medium ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Main Client Names *
                      </label>
                      <button
                        type="button"
                        onClick={addMainClient}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 ${
                          isDarkMode
                            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                            : 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        Add Client
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {formData.mainClientNames.map((clientName, index) => (
                        <div key={index} className="relative flex gap-2">
                          <div className="flex-1 relative">
                            <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                              isDarkMode ? 'text-orange-400' : 'text-orange-600'
                            }`} />
                            <input
                              type="text"
                              required
                              value={clientName}
                              onChange={(e) => updateMainClient(index, e.target.value)}
                              className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                                isDarkMode
                                  ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                                  : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                              }`}
                              placeholder={`Enter main client name ${index + 1}`}
                            />
                          </div>
                          {formData.mainClientNames.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMainClient(index)}
                              className={`p-3 rounded-xl transition-all duration-200 hover:scale-110 ${
                                isDarkMode
                                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                              }`}
                              aria-label="Remove main client"
                            >
                              <Minus className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <p className={`text-xs mt-2 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      The actual clients that you are outsourcing from
                    </p>
                  </div>
                )}

                {/* Contact Person Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Contact Person Name *
                  </label>
                  <div className="relative">
                    <UserCheck className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <input
                      type="text"
                      required
                      value={formData.contactPersonName}
                      onChange={(e) => handleInputChange('contactPersonName', e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                        isDarkMode
                          ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                          : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Enter contact person name"
                    />
                  </div>
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Primary point of contact on the client side
                  </p>
                </div>

                {/* Contact Email */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Contact Email *
                  </label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <input
                      type="email"
                      required
                      value={formData.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                        isDarkMode
                          ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                          : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Email address for business communications
                  </p>
                </div>

                {/* Country */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Client's Business Country *
                  </label>
                  <div className="relative">
                    <Globe className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <select
                      required
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      aria-label="Select country"
                      className={`w-full pl-12 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 appearance-none ${
                        isDarkMode
                          ? 'bg-white/5 border border-white/20 text-white'
                          : 'bg-white/50 border border-gray-300 text-gray-900'
                      }`}
                    >
                                              <option value="">Select country</option>
                        <option value="USA">United States of America</option>
                        <option value="UK">United Kingdom</option>
                        <option value="India">India</option>
                        <option value="Australia">Australia</option>
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`} />
                  </div>
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Where the client company is based (campaign countries will be specified per campaign)
                  </p>
                </div>

                {/* Error Message */}
                {formError && (
                  <div className={`text-sm text-center p-3 rounded-xl ${
                    isDarkMode 
                      ? 'text-red-400 bg-red-500/10 border border-red-500/20' 
                      : 'text-red-600 bg-red-500/10 border border-red-300'
                  }`}>
                    {formError}
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm()
                      setShowAddClientModal(false)
                    }}
                    className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 border border-gray-600/50'
                        : 'bg-gray-200/50 hover:bg-gray-200/70 text-gray-700 border border-gray-300'
                    }`}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                      isDarkMode
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                        : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        {editingClient ? 'Updating...' : 'Creating...'}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <Save className="w-5 h-5 mr-2" />
                        {editingClient ? 'Update Client' : 'Create Client'}
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl p-6 transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/95 border border-white/10'
              : 'bg-white/95 border border-gray-200/50'
          }`}>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDarkMode ? 'bg-red-500/20' : 'bg-red-500/10'
              }`}>
                <Trash2 className={`w-8 h-8 ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`} />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Delete Client
              </h2>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Are you sure you want to delete this client? This action cannot be undone.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 border border-gray-600/50'
                    : 'bg-gray-200/50 hover:bg-gray-200/70 text-gray-700 border border-gray-300'
                }`}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClient(showDeleteConfirm)}
                disabled={isDeleting}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                }`}
              >
                {isDeleting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Trash2 className="w-5 h-5 mr-2" />
                    Delete
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Clients
