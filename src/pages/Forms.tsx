import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Copy, 
  ExternalLink,
  Search,
  Filter,
  FileText,
  Target,
  Globe,
  Calendar,
  MoreVertical
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

interface FormField {
  id: string
  name: string
  label: string
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea' | 'checkbox' | 'radio'
  required: boolean
  options?: string[]
  placeholder?: string
  validation?: string
}

interface LeadForm {
  id: number
  name: string
  campaign_id: number
  campaign_name: string
  description: string
  client_form_url?: string
  success_message?: string
  redirect_delay?: number
  fields: FormField[]
  status: 'active' | 'draft' | 'archived'
  submissions: number
  conversion_rate: number
  created_at: string
  updated_at: string
  form_url: string
}

interface Campaign {
  id: number
  name: string
  client_name: string
  country: string
  status: string
}

const Forms: React.FC = () => {
  const { user, isDarkMode, setIsDarkMode } = useAuth()

  // State management
  const [forms, setForms] = useState<LeadForm[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null)

  // Form creation/editing state
  const [formData, setFormData] = useState({
    name: '',
    campaign_id: '',
    description: '',
    client_form_url: '',
    success_message: 'Thank you for your interest! You will be redirected shortly.',
    redirect_delay: 3,
    fields: [] as FormField[]
  })
  
  // Field mapping for client form autofill
  const [fieldMapping, setFieldMapping] = useState<{[key: string]: string}>({
    first_name: 'first_name',
    last_name: 'last_name',
    phone: 'phone',
    email: 'email'
  })

  // Default form fields
  const defaultFields: FormField[] = [
    {
      id: '1',
      name: 'first_name',
      label: 'First Name',
      type: 'text',
      required: true,
      placeholder: 'Enter your first name'
    },
    {
      id: '2',
      name: 'last_name',
      label: 'Last Name',
      type: 'text',
      required: true,
      placeholder: 'Enter your last name'
    },
    {
      id: '3',
      name: 'email',
      label: 'Email Address',
      type: 'email',
      required: false,
      placeholder: 'Enter your email address'
    },
    {
      id: '4',
      name: 'phone',
      label: 'Phone Number',
      type: 'phone',
      required: true,
      placeholder: 'Enter your phone number'
    }
  ]

  useEffect(() => {
    if (user) {
      fetchForms()
      fetchCampaigns()
    }
  }, [user])

  const fetchForms = async () => {
    try {
      setLoading(true)
      const response = await apiService.get('forms')
      if (response.success) {
        setForms(response.data.map((form: any) => ({
          id: form.id,
          name: form.name,
          campaign_id: form.campaign_id,
          campaign_name: form.campaign_name,
          description: form.description,
          fields: form.form_fields || [],
          status: form.status,
          submissions: form.total_submissions || 0,
          conversion_rate: parseFloat(form.conversion_rate) || 0,
          created_at: form.created_at,
          updated_at: form.updated_at,
          form_url: `${window.location.origin}/form/${form.slug}`
        })))
      }
    } catch (error) {
      console.error('Error fetching forms:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await apiService.get('campaigns')
      
      if (response.success && response.data) {
        const mappedCampaigns = response.data.map((campaign: any) => ({
          id: campaign.id,
          name: campaign.campaign_name,
          client_name: campaign.client_name,
          country: campaign.country || 'USA',
          status: campaign.status
        }))
        setCampaigns(mappedCampaigns)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  const handleCreateForm = () => {
    setFormData({
      name: '',
      campaign_id: '',
      description: '',
      client_form_url: '',
      success_message: 'Thank you for your interest! You will be redirected shortly.',
      redirect_delay: 3,
      fields: [...defaultFields]
    })
    setFieldMapping({
      first_name: 'first_name',
      last_name: 'last_name',
      phone: 'phone',
      email: 'email'
    })
    setShowCreateModal(true)
  }

  const handleEditForm = (form: LeadForm) => {
    setSelectedForm(form)
    setFormData({
      name: form.name,
      campaign_id: form.campaign_id.toString(),
      description: form.description,
      client_form_url: form.client_form_url || '',
      success_message: form.success_message || 'Thank you for your submission!',
      redirect_delay: form.redirect_delay || 3,
      fields: [...form.fields]
    })
    setShowEditModal(true)
  }

  const handleSaveForm = async () => {
    try {
      const payload = {
        name: formData.name,
        campaign_id: parseInt(formData.campaign_id),
        description: formData.description,
        form_fields: formData.fields,
        client_form_url: formData.client_form_url,
        field_mapping: fieldMapping,
        success_message: formData.success_message,
        redirect_delay: formData.redirect_delay
      }

      const response = await apiService.post('forms', payload)
      if (response.success) {
        setShowCreateModal(false)
        setShowEditModal(false)
        fetchForms() // Refresh the list
      } else {
        console.error('Error saving form:', response.error)
      }
    } catch (error) {
      console.error('Error saving form:', error)
    }
  }

  const handleDeleteForm = async (formId: number) => {
    try {
      const response = await apiService.delete(`forms/${formId}`)
      if (response.success) {
        console.log('Form deleted successfully:', response.message)
        setShowDeleteConfirm(null)
        fetchForms() // Refresh the list
        // Show success message (can be implemented with toast)
        alert(response.message || 'Form deleted successfully')
      } else {
        console.error('Error deleting form:', response.error)
        alert('Failed to delete form: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error deleting form:', error)
      alert('Failed to delete form. Please try again.')
    }
  }

  const handleCopyFormUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    // Show success message (can be implemented with toast)
    console.log('Form URL copied to clipboard')
  }

  const toggleDropdown = (formId: number) => {
    setDropdownOpen(dropdownOpen === formId ? null : formId)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'draft':
        return 'bg-yellow-100 text-yellow-800'
      case 'archived':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredForms = forms.filter(form => {
    const matchesSearch = form.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         form.campaign_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || form.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-all duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      <Sidebar 
        isDarkMode={isDarkMode} 
        setIsDarkMode={setIsDarkMode} 
      />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${
                isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
              }`}>
                <FileText className={`w-8 h-8 ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                }`} />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Lead Forms
                </h1>
                <p className={`mt-2 text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Create and manage lead capture forms for your campaigns
                </p>
              </div>
            </div>
            <button
              onClick={handleCreateForm}
              className={`inline-flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:scale-105 ${
                isDarkMode
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25'
              }`}
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Form
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <input
              type="text"
              placeholder="Search forms..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border transition-colors duration-200 ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400 focus:border-orange-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500'
              } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-4 py-2 rounded-lg border transition-colors duration-200 ${
              isDarkMode
                ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
            } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
            aria-label="Filter forms by status"
            title="Filter by Status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Forms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <div
              key={form.id}
              className={`rounded-xl border transition-all duration-200 hover:shadow-lg ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Card Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold mb-2 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {form.name}
                    </h3>
                    <p className={`text-sm mb-3 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {form.description}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => toggleDropdown(form.id)}
                      className={`p-2 rounded-lg transition-colors duration-200 ${
                        isDarkMode
                          ? 'hover:bg-gray-700 text-gray-400'
                          : 'hover:bg-gray-100 text-gray-500'
                      }`}
                      aria-label="Form options"
                      title="Form Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    
                    {dropdownOpen === form.id && (
                      <div className={`absolute right-0 top-10 w-48 rounded-lg shadow-lg border z-10 ${
                        isDarkMode
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-white border-gray-200'
                      }`}>
                        <button
                          onClick={() => {
                            handleEditForm(form)
                            setDropdownOpen(null)
                          }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center hover:bg-opacity-50 ${
                            isDarkMode
                              ? 'text-gray-300 hover:bg-gray-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Form
                        </button>
                        <button
                          onClick={() => {
                            handleCopyFormUrl(form.form_url)
                            setDropdownOpen(null)
                          }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center hover:bg-opacity-50 ${
                            isDarkMode
                              ? 'text-gray-300 hover:bg-gray-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy URL
                        </button>
                        <button
                          onClick={() => {
                            window.open(form.form_url, '_blank')
                            setDropdownOpen(null)
                          }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center hover:bg-opacity-50 ${
                            isDarkMode
                              ? 'text-gray-300 hover:bg-gray-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Preview Form
                        </button>
                        <hr className={`my-1 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`} />
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(form.id)
                            setDropdownOpen(null)
                          }}
                          className="w-full px-4 py-2 text-left text-sm flex items-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Form
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Campaign Info */}
                <div className={`flex items-center text-sm mb-4 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <Target className="w-4 h-4 mr-1" />
                  {form.campaign_name}
                </div>

                {/* Status Badge */}
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(form.status)}`}>
                  {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                </span>
              </div>

              {/* Card Stats */}
              <div className={`px-6 py-4 border-t ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Submissions
                    </p>
                    <p className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {form.submissions.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Conversion
                    </p>
                    <p className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {form.conversion_rate}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className={`px-6 py-3 text-xs ${
                isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}>
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  Created {new Date(form.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredForms.length === 0 && (
          <div className="text-center py-12">
            <FileText className={`mx-auto h-12 w-12 ${
              isDarkMode ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <h3 className={`mt-2 text-sm font-medium ${
              isDarkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              No forms found
            </h3>
            <p className={`mt-1 text-sm ${
              isDarkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first lead form.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <div className="mt-6">
                <button
                  onClick={handleCreateForm}
                  className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Form
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-lg p-6 max-w-md w-full mx-4 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-medium mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Delete Form
              </h3>
              <p className={`text-sm mb-6 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Are you sure you want to delete this form? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteForm(showDeleteConfirm)}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Form Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <h3 className={`text-lg font-medium mb-6 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                {showCreateModal ? 'Create New Form' : 'Edit Form'}
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form Configuration */}
                <div>
                  <h4 className={`text-md font-medium mb-4 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Form Configuration
                  </h4>
                  
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Form Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g., Vivint Home Security Lead Form"
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-orange-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500'
                        } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Campaign *
                      </label>
                      <select
                        value={formData.campaign_id}
                        onChange={(e) => setFormData({...formData, campaign_id: e.target.value})}
                        title="Select campaign for this form"
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-orange-500'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
                        } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                      >
                        <option value="">Select a campaign</option>
                        {campaigns.map(campaign => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Brief description of this form"
                        rows={3}
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-orange-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500'
                        } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Client Form URL *
                      </label>
                      <input
                        type="url"
                        value={formData.client_form_url}
                        onChange={(e) => setFormData({...formData, client_form_url: e.target.value})}
                        placeholder="https://www.vivint.com/get-quote"
                        className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                          isDarkMode
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-orange-500'
                            : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500'
                        } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                      />
                      <p className={`text-xs mt-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Clean leads will be redirected to this URL with pre-filled data
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Success Message
                        </label>
                        <input
                          type="text"
                          value={formData.success_message}
                          onChange={(e) => setFormData({...formData, success_message: e.target.value})}
                          placeholder="Thank you message"
                          title="Success message shown to users"
                          className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-orange-500'
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500'
                          } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Redirect Delay (seconds)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={formData.redirect_delay}
                          onChange={(e) => setFormData({...formData, redirect_delay: parseInt(e.target.value) || 3})}
                          title="Delay before redirecting to client form"
                          className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                            isDarkMode
                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-orange-500'
                              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-orange-500'
                          } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Field Mapping */}
                  <div className="mt-6">
                    <h5 className={`text-sm font-medium mb-3 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      Field Mapping (Our Form → Client Form)
                    </h5>
                    <div className="space-y-2">
                      {formData.fields.map(field => (
                        <div key={field.id} className="flex items-center gap-3">
                          <span className={`text-sm w-24 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {field.label}:
                          </span>
                          <input
                            type="text"
                            value={fieldMapping[field.name] || field.name}
                            onChange={(e) => setFieldMapping({
                              ...fieldMapping,
                              [field.name]: e.target.value
                            })}
                            placeholder={field.name}
                            className={`flex-1 px-2 py-1 text-sm rounded border ${
                              isDarkMode
                                ? 'bg-gray-700 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className={`text-xs mt-2 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Map your form fields to the client's form field names
                    </p>
                  </div>
                </div>

                {/* Form Preview */}
                <div>
                  <h4 className={`text-md font-medium mb-4 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Form Preview
                  </h4>
                  
                  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="bg-white rounded-lg p-2">
                            <div className="w-12 h-6 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600">
                              LOGO
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-white">
                            {formData.name || 'Form Name'}
                          </h3>
                        </div>
                        <div className="bg-slate-700 rounded-lg px-3 py-2 text-center">
                          <div className="text-xs text-slate-300 font-medium">Transfer Number</div>
                          <div className="text-sm font-bold text-blue-400">855-360-1251</div>
                        </div>
                      </div>
                      
                      {/* Form Fields */}
                      <div className="space-y-4">
                        {formData.fields.map(field => (
                          <div key={field.id}>
                            <label className="block text-sm font-medium text-white mb-2">
                              {field.label} {field.required && <span className="text-red-400">*</span>}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea
                                placeholder={field.placeholder}
                                rows={3}
                                disabled
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                              />
                            ) : field.type === 'select' ? (
                              <select
                                disabled
                                title="Preview select field"
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white"
                              >
                                <option>Select an option</option>
                              </select>
                            ) : (
                              <input
                                type={field.type}
                                placeholder={field.placeholder}
                                disabled
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                              />
                            )}
                          </div>
                        ))}
                        
                        {/* ZIP Code Field */}
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">
                            Service Area ZIP Code <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Enter 5-digit ZIP code (e.g., 12345)"
                            disabled
                            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            Enter at least 5 digits to check service availability. This field will be saved for our records only.
                          </p>
                        </div>
                        
                        {/* Consent Checkbox */}
                        <div>
                          <div className="flex items-start space-x-3">
                            <input
                              type="checkbox"
                              id="consent-preview"
                              disabled
                              className="mt-1 w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded"
                              aria-label="Consent checkbox for marketing communications"
                            />
                            <label 
                              htmlFor="consent-preview"
                              className="text-sm leading-relaxed text-slate-300 cursor-pointer"
                            >
                              Before transferring you, I need your consent: By continuing, you agree to Vivint's Electronic 
                              Disclosure, Terms of Service, and Privacy Policy. You also agree to receive marketing calls, 
                              texts, and emails from Vivint - though this isn't required for purchase. You can opt-out 
                              anytime by replying STOP. May I proceed with your transfer? <span className="text-red-400">*</span>
                            </label>
                          </div>
                        </div>
                        
                        <button
                          disabled
                          className="w-full bg-slate-600 text-white py-4 px-6 rounded-lg font-medium opacity-75"
                        >
                          Complete Required Fields
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Center URL Preview */}
                  {formData.name && (
                    <div className="mt-4">
                      <h5 className={`text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        Center URLs (Example)
                      </h5>
                      <div className={`text-xs p-3 rounded border ${
                        isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-300' : 'border-gray-300 bg-gray-50 text-gray-600'
                      }`}>
                        <div className="space-y-1">
                          <div>FI_IN: /form/{formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?center=FI_IN</div>
                          <div>TCC001: /form/{formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?center=TCC001</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-8">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveForm}
                  disabled={!formData.name || !formData.campaign_id || !formData.client_form_url}
                  className="px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showCreateModal ? 'Create Form' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Forms
