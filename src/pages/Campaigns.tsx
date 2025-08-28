import React, { useState, useRef } from 'react'
import { 
  Plus,
  Target,
  Search,
  Filter,
  X,
  User,
  Building,
  Globe,
  ChevronDown,
  Save,
  Upload,
  Phone,
  DollarSign,
  CheckCircle,
  ArrowRight,
  Edit,
  Trash2,
  Shield,
  FileText,
  AlertTriangle,
  Download,
  MapPin
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'

const Campaigns: React.FC = () => {
  const { isDarkMode, setIsDarkMode } = useAuth()
  const [showAddCampaignModal, setShowAddCampaignModal] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true)
  const [editingCampaign, setEditingCampaign] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDropdown, setShowDropdown] = useState<number | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 500 })
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState<any>(null)
  const [paymentFormData, setPaymentFormData] = useState({
    paymentType: '',
    clientRate: '',
    paymentFrequency: ''
  })
  const [showSuppressionModal, setShowSuppressionModal] = useState<any>(null)
  const [suppressionFile, setSuppressionFile] = useState<File | null>(null)
  const [suppressionStats, setSuppressionStats] = useState<any>(null)
  const [isUploadingSuppression, setIsUploadingSuppression] = useState(false)
  const [suppressionUploadResult, setSuppressionUploadResult] = useState<any>(null)
  const [showPostcodeModal, setShowPostcodeModal] = useState<any>(null)
  const [postcodeFile, setPostcodeFile] = useState<File | null>(null)
  const [postcodeStats, setPostcodeStats] = useState<any>(null)
  const [isUploadingPostcodes, setIsUploadingPostcodes] = useState(false)
  const [postcodeUploadResult, setPostcodeUploadResult] = useState<any>(null)


  // Form state
  const [formData, setFormData] = useState({
    campaignName: '',
    campaignType: '', // 'sales', 'lead_generation', 'lead_generation_hotkey', 'customer_support', 'marketing', 'other'
    clientId: '',
    mainClientName: '', // Only if client is broker
    country: '', // Campaign execution country
    transferNumber: '', // For hotkey and sales transfers
    collectPayment: '', // For sales: 'yes', 'no'
    closeSale: '', // For sales: 'yes', 'no'
    transferToDepartment: '', // For sales when closeSale is 'no'
    departmentTransferNumber: '', // Transfer number for department
    campaignPhoto: null as File | null,
    // Payment Terms
    paymentType: '', // 'per_sale', 'per_install', 'per_lead', 'monthly', 'per_appointment'
    clientRate: '', // How much client pays you
    paymentFrequency: '' // 'per_transaction', 'monthly', 'weekly'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Toggle dropdown for campaign actions
  const toggleDropdown = (campaignId: number) => {
    if (showDropdown === campaignId) {
      setShowDropdown(null)
    } else {
      const button = buttonRefs.current[campaignId]
      if (button) {
        const rect = button.getBoundingClientRect()
        
        // Find the table row to match its width
        const tableRow = button.closest('tr')
        const tableRect = tableRow?.getBoundingClientRect()
        
        const dropdownWidth = tableRect ? tableRect.width - 32 : 800 // Match row width minus padding
        const viewportWidth = window.innerWidth
        
        // Position dropdown to align with the start of the table row
        let left = tableRect ? tableRect.left + 16 : rect.left // 16px padding from table edge
        
        // Ensure dropdown doesn't go off screen
        if (left + dropdownWidth > viewportWidth - 20) {
          left = viewportWidth - dropdownWidth - 20
        }
        if (left < 20) {
          left = 20
        }
        
        setDropdownPosition({
          top: rect.bottom + 8,
          left: Math.max(20, left),
          width: dropdownWidth
        })
      }
      
      setShowDropdown(campaignId)
    }
  }

  // Get currency symbol based on country
  const getCurrencySymbol = (country: string) => {
    switch (country) {
      case 'UK':
        return '£'
      case 'USA':
        return '$'
      case 'India':
        return '₹'
      case 'Australia':
        return 'A$'
      default:
        return '$'
    }
  }

  // Handle file change for campaign photo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      
      setFormData(prev => ({
        ...prev,
        campaignPhoto: file
      }))
    }
  }

  // Handle campaign status toggle
  const handleStatusToggle = async (campaign: any) => {
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active'
      
      const response = await fetch(`/api/campaigns/${campaign.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        // Update the campaign status in the local state
        setCampaigns(prevCampaigns => 
          prevCampaigns.map(c => 
            c.id === campaign.id ? { ...c, status: newStatus } : c
          )
        )
      } else {
        console.error('Failed to update campaign status')
        alert('Failed to update campaign status. Please try again.')
      }
    } catch (error) {
      console.error('Error updating campaign status:', error)
      alert('Failed to update campaign status. Please try again.')
    }
  }

  // Handle payment terms update
  const handlePaymentTermsUpdate = async (campaign: any) => {
    if (!paymentFormData.paymentType || !paymentFormData.clientRate || !paymentFormData.paymentFrequency) {
      alert('Please fill in all payment terms fields')
      return
    }

    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/payment-terms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({
          paymentType: paymentFormData.paymentType,
          clientRate: paymentFormData.clientRate,
          paymentFrequency: paymentFormData.paymentFrequency
        })
      })

      if (response.ok) {
        setShowPaymentModal(null)
        setPaymentFormData({ paymentType: '', clientRate: '', paymentFrequency: '' })
        fetchCampaigns() // Refresh the list
        alert('Payment terms updated successfully!')
      } else {
        console.error('Failed to update payment terms')
        alert('Failed to update payment terms. Please try again.')
      }
    } catch (error) {
      console.error('Error updating payment terms:', error)
      alert('Error updating payment terms. Please try again.')
    }
  }

  // Fetch suppression stats for a campaign
  const fetchSuppressionStats = async (campaignId: number) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/suppression/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSuppressionStats(data.success ? data.data : null)
      } else {
        setSuppressionStats(null)
      }
    } catch (error) {
      console.error('Error fetching suppression stats:', error)
      setSuppressionStats(null)
    }
  }

  // Fetch postcode stats for a campaign
  const fetchPostcodeStats = async (campaignId: number) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/postcodes/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setPostcodeStats(data.success ? data.data : null)
      } else {
        setPostcodeStats(null)
      }
    } catch (error) {
      console.error('Error fetching postcode stats:', error)
      setPostcodeStats(null)
    }
  }

  // Handle suppression file upload
  const handleSuppressionUpload = async (campaign: any) => {
    if (!suppressionFile) {
      alert('Please select a CSV file to upload')
      return
    }

    setIsUploadingSuppression(true)
    setSuppressionUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('suppressionFile', suppressionFile)
      formData.append('campaignId', campaign.id.toString())

      const response = await fetch(`/api/campaigns/${campaign.id}/suppression/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: formData
      })

      const data = await response.json()
      
      if (data.success) {
        setSuppressionUploadResult(data.data)
        setSuppressionFile(null)
        // Refresh stats
        await fetchSuppressionStats(campaign.id)
      } else {
        alert(data.error || 'Failed to upload suppression file')
      }
    } catch (error) {
      console.error('Error uploading suppression file:', error)
      alert('Error uploading suppression file. Please try again.')
    } finally {
      setIsUploadingSuppression(false)
    }
  }

  // Handle suppression file selection
  const handleSuppressionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('Please select a CSV file')
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      
      setSuppressionFile(file)
      setSuppressionUploadResult(null)
    }
  }

  // Handle postcode file upload
  const handlePostcodeUpload = async (campaign: any) => {
    if (!postcodeFile) {
      alert('Please select a CSV or TXT file to upload')
      return
    }

    setIsUploadingPostcodes(true)
    setPostcodeUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('postcodeFile', postcodeFile)
      formData.append('campaignId', campaign.id.toString())

      const response = await fetch(`/api/campaigns/${campaign.id}/postcodes/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: formData
      })

      const data = await response.json()
      
      if (data.success) {
        setPostcodeUploadResult(data.data)
        setPostcodeFile(null)
        // Refresh stats
        await fetchPostcodeStats(campaign.id)
      } else {
        alert(data.error || 'Failed to upload postcode file')
      }
    } catch (error) {
      console.error('Error uploading postcode file:', error)
      alert('Error uploading postcode file. Please try again.')
    } finally {
      setIsUploadingPostcodes(false)
    }
  }



  // Role check is handled by ProtectedRoute in App.tsx


  const fetchCampaigns = async () => {
    try {
      setIsLoadingCampaigns(true)
      const response = await fetch('/api/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const campaignsData = await response.json()
        if (campaignsData.success && campaignsData.data) {
          setCampaigns(campaignsData.data)
        } else {
          console.error('Invalid response format:', campaignsData)
          setCampaigns([])
        }
      } else {
        console.error('Failed to fetch campaigns')
        setCampaigns([])
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setIsLoadingCampaigns(false)
    }
  }

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const clientsData = await response.json()
        if (clientsData.success && clientsData.data) {
          setClients(clientsData.data)
        } else if (Array.isArray(clientsData)) {
          // Handle case where API returns array directly
          setClients(clientsData)
        } else {
          console.error('Invalid clients response format:', clientsData)
          setClients([])
        }
      } else {
        console.error('Failed to fetch clients')
        setClients([])
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
      setClients([])
    }
  }

  // Load campaigns and clients on component mount
  React.useEffect(() => {
    fetchCampaigns()
    fetchClients()
  }, [])

  // Update dropdown position when it's shown
  React.useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const element = dropdownRef.current
      element.style.top = `${dropdownPosition.top}px`
      element.style.left = `${dropdownPosition.left}px`
      element.style.width = `${dropdownPosition.width}px`
    }
  }, [showDropdown, dropdownPosition])

  const handleEditCampaign = (campaign: any) => {
    setEditingCampaign(campaign)
    setFormData({
      campaignName: campaign.campaign_name,
      campaignType: campaign.campaign_type,
      clientId: campaign.client_id.toString(),
      mainClientName: campaign.main_client_name || '',
      country: campaign.country,
      transferNumber: campaign.transfer_number || '',
      collectPayment: campaign.collect_payment || '',
      closeSale: campaign.close_sale || '',
      transferToDepartment: campaign.transfer_to_department || '',
      departmentTransferNumber: campaign.department_transfer_number || '',
      campaignPhoto: null,
      paymentType: campaign.payment_type || 'per_sale',
      clientRate: campaign.client_rate || '',
      paymentFrequency: campaign.payment_frequency || 'per_transaction'
    })
    setShowAddCampaignModal(true)
  }

  const handleDeleteCampaign = async (campaignId: number) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })

      if (response.ok) {
        setShowDeleteConfirm(null)
        fetchCampaigns() // Refresh the list
      } else {
        console.error('Failed to delete campaign')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      campaignName: '',
      campaignType: '',
      clientId: '',
      mainClientName: '',
      country: '',
      transferNumber: '',
      collectPayment: '',
      closeSale: '',
      transferToDepartment: '',
      departmentTransferNumber: '',
      campaignPhoto: null,
      paymentType: '',
      clientRate: '',
      paymentFrequency: ''
    })
    setEditingCampaign(null)
    setFormError('')
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      // Reset dependent fields when parent field changes
      ...(field === 'campaignType' && value !== 'lead_generation_hotkey' ? { transferNumber: '' } : {}),
      ...(field === 'campaignType' && value !== 'sales' ? { 
        collectPayment: '', 
        closeSale: '', 
        transferToDepartment: '', 
        departmentTransferNumber: '' 
      } : {}),
      ...(field === 'closeSale' && value !== 'no' ? { 
        transferToDepartment: '', 
        departmentTransferNumber: '' 
      } : {}),
      ...(field === 'transferToDepartment' && value !== 'yes' ? { 
        departmentTransferNumber: '' 
      } : {})
    }))
    setFormError('')
  }

  const selectedClient = clients.find(client => client.id.toString() === formData.clientId)
  const isClientBroker = selectedClient?.client_type === 'broker'
  const availableMainClients = isClientBroker && selectedClient?.main_client_name ? 
    (() => {
      try {
        const parsed = JSON.parse(selectedClient.main_client_name)
        return Array.isArray(parsed) ? parsed : [selectedClient.main_client_name]
      } catch {
        return [selectedClient.main_client_name]
      }
    })() : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.campaignName.trim()) {
      setFormError('Campaign name is required')
      return
    }
    if (!formData.campaignType) {
      setFormError('Please select campaign type')
      return
    }
    if (!formData.clientId) {
      setFormError('Please select client')
      return
    }
    if (isClientBroker && !formData.mainClientName.trim()) {
      setFormError('Main client name is required for broker campaigns')
      return
    }
    if (!formData.country) {
      setFormError('Please select country')
      return
    }
    if (formData.campaignType === 'lead_generation_hotkey' && !formData.transferNumber.trim()) {
      setFormError('Transfer number is required for hotkey campaigns')
      return
    }
    if (formData.campaignType === 'sales') {
      if (!formData.collectPayment) {
        setFormError('Please specify if you collect payment')
        return
      }
      if (!formData.closeSale) {
        setFormError('Please specify if you close the sale')
        return
      }
      if (formData.closeSale === 'no' && !formData.transferToDepartment) {
        setFormError('Please specify if you transfer to another department')
        return
      }
      if (formData.transferToDepartment === 'yes' && !formData.departmentTransferNumber.trim()) {
        setFormError('Department transfer number is required')
        return
      }
    }

    setIsSubmitting(true)
    setFormError('')

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('campaignName', formData.campaignName)
      formDataToSend.append('campaignType', formData.campaignType)
      formDataToSend.append('clientId', formData.clientId)
      formDataToSend.append('mainClientName', formData.mainClientName)
      formDataToSend.append('country', formData.country)
      formDataToSend.append('transferNumber', formData.transferNumber)
      formDataToSend.append('collectPayment', formData.collectPayment)
      formDataToSend.append('closeSale', formData.closeSale)
      formDataToSend.append('transferToDepartment', formData.transferToDepartment)
      formDataToSend.append('departmentTransferNumber', formData.departmentTransferNumber)
      formDataToSend.append('paymentType', formData.paymentType)
      formDataToSend.append('clientRate', formData.clientRate)
      formDataToSend.append('paymentFrequency', formData.paymentFrequency)
      
      if (formData.campaignPhoto) {
        formDataToSend.append('campaignPhoto', formData.campaignPhoto)
      }

      const url = editingCampaign ? `/api/campaigns/${editingCampaign.id}` : '/api/campaigns'
      const method = editingCampaign ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: formDataToSend
      })

      const data = await response.json()

      if (data.success) {
        resetForm()
        setShowAddCampaignModal(false)
        fetchCampaigns()
      } else {
        setFormError(data.error || `Failed to ${editingCampaign ? 'update' : 'create'} campaign`)
      }
    } catch (error) {
      console.error('Campaign operation error:', error)
      setFormError('Failed to save campaign. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
                <Target className={`w-8 h-8 ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                }`} />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Campaigns
                </h1>
                <p className={`${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Manage your marketing and sales campaigns
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowAddCampaignModal(true)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                    : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                }`}
              >
                <Plus className="w-5 h-5" />
                Add Campaign
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`} />
            <input
              type="text"
              placeholder="Search campaigns..."
              className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                isDarkMode
                  ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                  : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
          </div>
          <button 
            className={`px-4 py-3 rounded-xl transition-all duration-200 ${
              isDarkMode
                ? 'bg-white/5 border border-white/20 text-gray-300 hover:bg-white/10'
                : 'bg-white/50 border border-gray-300 text-gray-700 hover:bg-white/70'
            }`}
            aria-label="Filter campaigns"
            title="Filter campaigns"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Campaigns Table */}
        <div className={`rounded-2xl shadow-2xl backdrop-blur-xl border overflow-hidden ${
          isDarkMode
            ? 'bg-white/5 border-white/10'
            : 'bg-white/50 border-gray-200/50'
        }`}>
          {isLoadingCampaigns ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Target className={`w-16 h-16 mx-auto mb-4 ${
                isDarkMode ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-xl font-semibold mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                No campaigns yet
              </h3>
              <p className={`${
                isDarkMode ? 'text-gray-500' : 'text-gray-600'
              }`}>
                Create your first campaign to get started
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
                    }`}>Campaign</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Type</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Client</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Country</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Assigned Centers</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Created</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns && campaigns.length > 0 ? campaigns.map((campaign) => (
                    <tr key={campaign.id} className={`border-b transition-colors duration-200 hover:bg-opacity-50 ${
                      isDarkMode 
                        ? 'border-gray-700/30 hover:bg-gray-800/30' 
                        : 'border-gray-200/30 hover:bg-gray-100/30'
                    }`}>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-3">
                          {campaign.photo_url && (
                            <img 
                              src={`http://localhost:3000${campaign.photo_url}`}
                              alt={`${campaign.campaign_name} thumbnail`}
                              className="w-12 h-12 rounded-lg object-cover border-2 border-gray-300 dark:border-gray-600"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <div className={`font-medium ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {campaign.campaign_name}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          campaign.campaign_type === 'sales'
                            ? isDarkMode
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-green-500/10 text-green-600'
                            : campaign.campaign_type === 'lead_generation_hotkey'
                              ? isDarkMode
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-orange-500/10 text-orange-600'
                              : isDarkMode
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {campaign.campaign_type === 'sales' ? 'Sales' :
                           campaign.campaign_type === 'lead_generation' ? 'Lead Generation' :
                           campaign.campaign_type === 'lead_generation_hotkey' ? 'Lead Gen - Hotkey' :
                           campaign.campaign_type === 'customer_support' ? 'Customer Support' :
                           campaign.campaign_type === 'marketing' ? 'Marketing' :
                           campaign.campaign_type === 'other' ? 'Other' : 
                           campaign.campaign_type ? campaign.campaign_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 'Unknown'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div>
                          <div className={`font-medium ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            {campaign.client_name || 'Unknown Client'}
                          </div>
                          {campaign.main_client_name && (
                            <div className={`text-sm ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              Main: {campaign.main_client_name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {campaign.country}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="space-y-1">
                          {campaign.center_assignments && campaign.center_assignments.length > 0 ? (
                            campaign.center_assignments.map((assignment: any, index: number) => (
                              <div key={assignment.center_id} className={`inline-flex items-center px-2 py-1 rounded-lg text-xs ${
                                isDarkMode 
                                  ? 'bg-orange-500/20 text-orange-400' 
                                  : 'bg-orange-500/10 text-orange-600'
                              }`}>
                                <span className="font-medium">{assignment.center_name}</span>
                                <span className="mx-1">•</span>
                                <span className="font-bold">${assignment.center_commission}</span>
                              </div>
                            ))
                          ) : (
                            <span className={`text-xs ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              No centers assigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {new Date(campaign.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleEditCampaign(campaign)}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                              isDarkMode
                                ? 'hover:bg-blue-500/20 text-blue-400 hover:text-blue-300'
                                : 'hover:bg-blue-500/10 text-blue-600 hover:text-blue-700'
                            }`}
                            aria-label="Edit campaign"
                            title="Edit Campaign"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(campaign.id)}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                              isDarkMode
                                ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
                                : 'hover:bg-red-500/10 text-red-600 hover:text-red-700'
                            }`}
                            aria-label="Delete campaign"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            ref={(el) => buttonRefs.current[campaign.id] = el}
                            onClick={() => toggleDropdown(campaign.id)}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                              isDarkMode
                                ? 'hover:bg-orange-500/20 text-orange-400 hover:text-orange-300'
                                : 'hover:bg-orange-500/10 text-orange-600 hover:text-orange-700'
                            }`}
                            aria-label="Campaign options"
                            title="Campaign Options"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          
                          {/* Status Toggle Switch - Constant Background with Color-Changing Circle */}
                          <button
                            onClick={() => handleStatusToggle(campaign)}
                            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 ${
                              isDarkMode 
                                ? 'bg-gray-600 focus:ring-gray-400' 
                                : 'bg-gray-300 focus:ring-gray-500'
                            }`}
                            aria-label={`Toggle campaign status - currently ${campaign.status}`}
                            title={`Campaign is ${campaign.status} - click to ${campaign.status === 'active' ? 'pause' : 'activate'}`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full transition-all duration-200 ${
                                campaign.status === 'active' 
                                  ? 'translate-x-4 bg-emerald-500 shadow-emerald-500/50 shadow-md' 
                                  : 'translate-x-0.5 bg-amber-500 shadow-amber-500/50 shadow-md'
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <span className={`${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          No campaigns found
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Campaign Modal */}
      {showAddCampaignModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6 transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/95 border border-white/10'
              : 'bg-white/95 border border-gray-200/50'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
                }`}>
                  <Target className={`w-6 h-6 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                </div>
                <h2 className={`text-xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {editingCampaign ? 'Edit Campaign' : 'Add New Campaign'}
                </h2>
              </div>
              
              <button
                onClick={() => {
                  resetForm()
                  setShowAddCampaignModal(false)
                }}
                className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 ${
                  isDarkMode
                    ? 'hover:bg-gray-800/50 text-gray-400'
                    : 'hover:bg-gray-100/50 text-gray-600'
                }`}
                aria-label="Close modal"
                title="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Campaign Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Campaign Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Campaign Name *
                </label>
                <div className="relative">
                  <Target className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                  <input
                    type="text"
                    required
                    value={formData.campaignName}
                    onChange={(e) => handleInputChange('campaignName', e.target.value)}
                    className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                        : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="Enter campaign name"
                  />
                </div>
              </div>

              {/* Campaign Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Campaign Type *
                </label>
                <div className="relative">
                  <Building className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                  <select
                    required
                    value={formData.campaignType}
                    onChange={(e) => handleInputChange('campaignType', e.target.value)}
                    aria-label="Select campaign type"
                    className={`w-full pl-12 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 appearance-none ${
                      isDarkMode
                        ? 'bg-white/5 border border-white/20 text-white'
                        : 'bg-white/50 border border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select campaign type</option>
                    <option value="sales">Sales</option>
                    <option value="lead_generation">Lead Generation</option>
                    <option value="lead_generation_hotkey">Lead Generation - Hotkey</option>
                    <option value="customer_support">Customer Support</option>
                    <option value="marketing">Marketing</option>
                    <option value="other">Other</option>
                  </select>
                  <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`} />
                </div>
              </div>

              {/* Client Selection */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Client *
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                  <select
                    required
                    value={formData.clientId}
                    onChange={(e) => handleInputChange('clientId', e.target.value)}
                    aria-label="Select client"
                    className={`w-full pl-12 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 appearance-none ${
                      isDarkMode
                        ? 'bg-white/5 border border-white/20 text-white'
                        : 'bg-white/50 border border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="">Select client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.client_name} ({client.client_type === 'broker' ? 'Broker' : 'Main Client'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`} />
                </div>
              </div>

              {/* Main Client - Only show if selected client is broker */}
              {isClientBroker && availableMainClients.length > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Main Client *
                  </label>
                  <div className="relative">
                    <Building className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <select
                      required
                      value={formData.mainClientName}
                      onChange={(e) => handleInputChange('mainClientName', e.target.value)}
                      aria-label="Select main client"
                      className={`w-full pl-12 pr-10 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 appearance-none ${
                        isDarkMode
                          ? 'bg-white/5 border border-white/20 text-white'
                          : 'bg-white/50 border border-gray-300 text-gray-900'
                      }`}
                    >
                      <option value="">Select main client</option>
                      {availableMainClients.map((mainClient, index) => (
                        <option key={index} value={mainClient}>
                          {mainClient}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`} />
                  </div>
                </div>
              )}

              {/* Country */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Campaign Country *
                </label>
                <div className="relative">
                  <Globe className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                  <select
                    required
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    aria-label="Select campaign country"
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
                  Where you will execute this campaign
                </p>
              </div>

              {/* Transfer Number for Hotkey */}
              {formData.campaignType === 'lead_generation_hotkey' && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Transfer Number *
                  </label>
                  <div className="relative">
                    <Phone className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} />
                    <input
                      type="text"
                      required
                      value={formData.transferNumber}
                      onChange={(e) => handleInputChange('transferNumber', e.target.value)}
                      className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                        isDarkMode
                          ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                          : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Enter transfer number"
                    />
                  </div>
                  <p className={`text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Number to transfer live customers
                  </p>
                </div>
              )}

              {/* Sales-specific fields */}
              {formData.campaignType === 'sales' && (
                <>
                  {/* Collect Payment */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Do you collect payment? *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                        formData.collectPayment === 'yes'
                          ? isDarkMode
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-orange-500/10 border-orange-500/30 text-orange-600'
                          : isDarkMode
                            ? 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                            : 'bg-white/50 border-gray-300 text-gray-700 hover:bg-white/70'
                      }`}>
                        <input
                          type="radio"
                          name="collectPayment"
                          value="yes"
                          checked={formData.collectPayment === 'yes'}
                          onChange={(e) => handleInputChange('collectPayment', e.target.value)}
                          className="sr-only"
                        />
                        <DollarSign className="w-5 h-5 mr-2" />
                        <span className="font-medium">Yes</span>
                      </label>
                      <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                        formData.collectPayment === 'no'
                          ? isDarkMode
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-orange-500/10 border-orange-500/30 text-orange-600'
                          : isDarkMode
                            ? 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                            : 'bg-white/50 border-gray-300 text-gray-700 hover:bg-white/70'
                      }`}>
                        <input
                          type="radio"
                          name="collectPayment"
                          value="no"
                          checked={formData.collectPayment === 'no'}
                          onChange={(e) => handleInputChange('collectPayment', e.target.value)}
                          className="sr-only"
                        />
                        <X className="w-5 h-5 mr-2" />
                        <span className="font-medium">No</span>
                      </label>
                    </div>
                  </div>

                  {/* Close Sale */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Do you close the sale? *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                        formData.closeSale === 'yes'
                          ? isDarkMode
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-orange-500/10 border-orange-500/30 text-orange-600'
                          : isDarkMode
                            ? 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                            : 'bg-white/50 border-gray-300 text-gray-700 hover:bg-white/70'
                      }`}>
                        <input
                          type="radio"
                          name="closeSale"
                          value="yes"
                          checked={formData.closeSale === 'yes'}
                          onChange={(e) => handleInputChange('closeSale', e.target.value)}
                          className="sr-only"
                        />
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <span className="font-medium">Yes</span>
                      </label>
                      <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                        formData.closeSale === 'no'
                          ? isDarkMode
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-orange-500/10 border-orange-500/30 text-orange-600'
                          : isDarkMode
                            ? 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                            : 'bg-white/50 border-gray-300 text-gray-700 hover:bg-white/70'
                      }`}>
                        <input
                          type="radio"
                          name="closeSale"
                          value="no"
                          checked={formData.closeSale === 'no'}
                          onChange={(e) => handleInputChange('closeSale', e.target.value)}
                          className="sr-only"
                        />
                        <X className="w-5 h-5 mr-2" />
                        <span className="font-medium">No</span>
                      </label>
                    </div>
                  </div>

                  {/* Transfer to Department - Only show if closeSale is 'no' */}
                  {formData.closeSale === 'no' && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Do you transfer to another department? *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                          formData.transferToDepartment === 'yes'
                            ? isDarkMode
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                              : 'bg-orange-500/10 border-orange-500/30 text-orange-600'
                            : isDarkMode
                              ? 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                              : 'bg-white/50 border-gray-300 text-gray-700 hover:bg-white/70'
                        }`}>
                          <input
                            type="radio"
                            name="transferToDepartment"
                            value="yes"
                            checked={formData.transferToDepartment === 'yes'}
                            onChange={(e) => handleInputChange('transferToDepartment', e.target.value)}
                            className="sr-only"
                          />
                          <ArrowRight className="w-5 h-5 mr-2" />
                          <span className="font-medium">Yes</span>
                        </label>
                        <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                          formData.transferToDepartment === 'no'
                            ? isDarkMode
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                              : 'bg-orange-500/10 border-orange-500/30 text-orange-600'
                            : isDarkMode
                              ? 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                              : 'bg-white/50 border-gray-300 text-gray-700 hover:bg-white/70'
                        }`}>
                          <input
                            type="radio"
                            name="transferToDepartment"
                            value="no"
                            checked={formData.transferToDepartment === 'no'}
                            onChange={(e) => handleInputChange('transferToDepartment', e.target.value)}
                            className="sr-only"
                          />
                          <X className="w-5 h-5 mr-2" />
                          <span className="font-medium">No</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Department Transfer Number - Only show if transferToDepartment is 'yes' */}
                  {formData.transferToDepartment === 'yes' && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Department Transfer Number *
                      </label>
                      <div className="relative">
                        <Phone className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                          isDarkMode ? 'text-orange-400' : 'text-orange-600'
                        }`} />
                        <input
                          type="text"
                          required
                          value={formData.departmentTransferNumber}
                          onChange={(e) => handleInputChange('departmentTransferNumber', e.target.value)}
                          className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                            isDarkMode
                              ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                              : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                          }`}
                          placeholder="Enter department transfer number"
                        />
                      </div>
                      <p className={`text-xs mt-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Number to transfer unsuccessful sales
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Campaign Photo Upload */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Campaign Photo (Optional)
                </label>
                <div className="relative">
                  <Upload className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    aria-label="Upload campaign photo"
                    title="Upload campaign photo"
                    className={`w-full pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-white/5 border border-white/20 text-white file:bg-orange-500/20 file:text-orange-400 file:border-none file:rounded-lg file:px-3 file:py-1 file:mr-3'
                        : 'bg-white/50 border border-gray-300 text-gray-900 file:bg-orange-500/10 file:text-orange-600 file:border-none file:rounded-lg file:px-3 file:py-1 file:mr-3'
                    }`}
                  />
                </div>
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Upload an image to represent this campaign
                </p>
              </div>



              {/* Error Message */}
              {formError && (
                <div className={`text-sm text-center p-3 rounded-xl ${
                  isDarkMode 
                    ? 'text-red-400 bg-red-500/10 border border-red-500/20' 
                    : 'text-red-600 bg-red-500/10 border border-red-500/20'
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
                    setShowAddCampaignModal(false)
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
                      {editingCampaign ? 'Updating...' : 'Creating...'}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Save className="w-5 h-5 mr-2" />
                      {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                    </div>
                  )}
                </button>
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
                Delete Campaign
              </h2>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Are you sure you want to delete this campaign? This action cannot be undone.
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
                onClick={() => handleDeleteCampaign(showDeleteConfirm)}
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

      {/* Campaign Actions Dropdown */}
      {showDropdown && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(null)}
          />
          <div 
            ref={dropdownRef}
            className={`fixed z-50 rounded-2xl shadow-2xl backdrop-blur-xl border overflow-hidden ${
              isDarkMode
                ? 'bg-gray-900/95 border-white/10'
                : 'bg-white/95 border-gray-200/50'
            }`}
          >
            {(() => {
              const campaign = campaigns.find(c => c.id === showDropdown)
              if (!campaign) return null
              
              const currencySymbol = getCurrencySymbol(campaign.country)
              
              return (
                <div className={`p-6 space-y-4 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {/* Campaign Header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-200/20">
                    <div className={`p-2 rounded-xl ${
                      isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
                    }`}>
                      <Target className={`w-5 h-5 ${
                        isDarkMode ? 'text-orange-400' : 'text-orange-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`text-lg font-semibold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {campaign.campaign_name}
                      </h3>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {campaign.client_name} • {campaign.country}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {/* Manage Suppression Button - Super Admin Only */}
                    <button
                      onClick={() => {
                        setShowSuppressionModal(campaign)
                        fetchSuppressionStats(campaign.id)
                        setShowDropdown(null)
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                        isDarkMode
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                          : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                      }`}
                    >
                      <Shield className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Manage Suppression</div>
                        <div className={`text-xs ${
                          isDarkMode ? 'text-red-400/70' : 'text-red-500/70'
                        }`}>
                          Upload client DNC lists
                        </div>
                      </div>
                    </button>

                    {/* Manage Postcodes Button - Super Admin Only */}
                    <button
                      onClick={() => {
                        setShowPostcodeModal(campaign)
                        fetchPostcodeStats(campaign.id)
                        setShowDropdown(null)
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                        isDarkMode
                          ? 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'
                          : 'bg-green-50 hover:bg-green-100 text-green-600 border border-green-200'
                      }`}
                    >
                      <MapPin className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Manage ZIP Codes</div>
                        <div className={`text-xs ${
                          isDarkMode ? 'text-green-400/70' : 'text-green-500/70'
                        }`}>
                          Upload service area ZIP codes
                        </div>
                      </div>
                    </button>

                    {/* Commission Section */}
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`text-sm font-medium ${
                          isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                          Revenue from Client
                        </div>
                        <button
                          onClick={() => {
                            setShowPaymentModal(campaign)
                            setPaymentFormData({
                              paymentType: campaign.payment_type || 'per_sale',
                              clientRate: campaign.client_rate || '',
                              paymentFrequency: campaign.payment_frequency || 'per_transaction'
                            })
                            setShowDropdown(null)
                          }}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode
                              ? 'hover:bg-blue-500/20 text-blue-400'
                              : 'hover:bg-blue-500/10 text-blue-600'
                          }`}
                          title="Edit Payment Terms"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                      </div>
                      <div className={`text-lg font-bold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {currencySymbol}{campaign.client_rate || '0.00'} {campaign.payment_type?.replace('_', ' ') || 'per sale'}
                      </div>
                      <div className={`text-xs ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Paid {campaign.payment_frequency?.replace('_', ' ') || 'per transaction'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* Payment Terms Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl p-6 transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/95 border border-white/10'
              : 'bg-white/95 border border-gray-200/50'
          }`}>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDarkMode ? 'bg-blue-500/20' : 'bg-blue-500/10'
              }`}>
                <DollarSign className={`w-8 h-8 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              <h2 className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Edit Payment Terms
              </h2>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Update payment terms for {showPaymentModal.campaign_name}
              </p>
            </div>

            {/* Payment Terms Form */}
            <div className="space-y-4">
              {/* Payment Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  What do you get paid for?
                </label>
                <select
                  value={paymentFormData.paymentType}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentType: e.target.value }))}
                  aria-label="Select payment type"
                  title="Select what you get paid for"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="per_sale">Per Sale</option>
                  <option value="per_install">Per Install</option>
                  <option value="per_lead">Per Lead</option>
                  <option value="per_appointment">Per Appointment</option>
                  <option value="monthly">Monthly Retainer</option>
                </select>
              </div>

              {/* Client Rate */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  How much does client pay you?
                </label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 transform -translate-y-1/2 font-bold ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    {getCurrencySymbol(showPaymentModal.country)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentFormData.clientRate}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, clientRate: e.target.value }))}
                    className={`w-full pl-8 pr-4 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Payment Frequency */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Payment Frequency
                </label>
                <select
                  value={paymentFormData.paymentFrequency}
                  onChange={(e) => setPaymentFormData(prev => ({ ...prev, paymentFrequency: e.target.value }))}
                  aria-label="Select payment frequency"
                  title="Select how often you get paid"
                  className={`w-full px-3 py-2 rounded-lg border ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="per_transaction">Per Transaction</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPaymentModal(null)
                  setPaymentFormData({ paymentType: '', clientRate: '', paymentFrequency: '' })
                }}
                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 border border-gray-600/50'
                    : 'bg-gray-200/50 hover:bg-gray-200/70 text-gray-700 border border-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handlePaymentTermsUpdate(showPaymentModal)}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                }`}
              >
                <div className="flex items-center justify-center">
                  <Save className="w-5 h-5 mr-2" />
                  Update Terms
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suppression Management Modal */}
      {showSuppressionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6 transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/95 border border-white/10'
              : 'bg-white/95 border border-gray-200/50'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDarkMode ? 'bg-red-500/20' : 'bg-red-500/10'
                }`}>
                  <Shield className={`w-6 h-6 ${
                    isDarkMode ? 'text-red-400' : 'text-red-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Client Suppression - {showSuppressionModal.campaign_name}
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Manage do-not-call lists for this campaign
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setShowSuppressionModal(null)
                  setSuppressionFile(null)
                  setSuppressionStats(null)
                  setSuppressionUploadResult(null)
                }}
                className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 ${
                  isDarkMode
                    ? 'hover:bg-gray-800/50 text-gray-400'
                    : 'hover:bg-gray-100/50 text-gray-600'
                }`}
                aria-label="Close modal"
                title="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Current Suppression Status */}
            {suppressionStats && (
              <div className={`p-4 rounded-lg mb-6 ${
                isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/50'
              }`}>
                <h3 className={`text-lg font-semibold mb-3 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Current Suppression Status
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      {suppressionStats.totalNumbers?.toLocaleString() || '0'}
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Total Suppressed Numbers
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-green-500/10' : 'bg-green-50'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      isDarkMode ? 'text-green-400' : 'text-green-600'
                    }`}>
                      {suppressionStats.lastUpload ? new Date(suppressionStats.lastUpload).toLocaleDateString() : 'Never'}
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Last Upload
                    </div>
                  </div>
                </div>
                {suppressionStats.lastFilename && (
                  <div className={`mt-3 text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <FileText className="w-4 h-4 inline mr-2" />
                    Last file: {suppressionStats.lastFilename}
                  </div>
                )}
              </div>
            )}

            {/* Upload Result */}
            {suppressionUploadResult && (
              <div className={`p-4 rounded-lg mb-6 ${
                isDarkMode ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-3 flex items-center ${
                  isDarkMode ? 'text-green-400' : 'text-green-600'
                }`}>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Upload Successful
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className={`font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {suppressionUploadResult.validNumbersAdded}
                    </div>
                    <div className={`${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      New Numbers Added
                    </div>
                  </div>
                  <div>
                    <div className={`font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {suppressionUploadResult.duplicateNumbersSkipped}
                    </div>
                    <div className={`${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Duplicates Skipped
                    </div>
                  </div>
                  <div>
                    <div className={`font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {suppressionUploadResult.invalidNumbersRejected}
                    </div>
                    <div className={`${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Invalid Numbers
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Section */}
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Upload New Suppression File
              </h3>
              
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                suppressionFile
                  ? isDarkMode
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-green-500/50 bg-green-50'
                  : isDarkMode
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleSuppressionFileChange}
                  className="hidden"
                  id="suppression-file-upload"
                />
                <label
                  htmlFor="suppression-file-upload"
                  className="cursor-pointer"
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${
                    suppressionFile
                      ? isDarkMode ? 'text-green-400' : 'text-green-600'
                      : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <div className={`text-lg font-medium mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {suppressionFile ? suppressionFile.name : 'Drop CSV file here or click to browse'}
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Format: One 10-digit phone number per line<br />
                    Example: 7192296018
                  </div>
                </label>
              </div>

              {/* Upload Options */}
              <div className={`p-4 rounded-lg ${
                isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                  <div>
                    <div className={`font-medium mb-1 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`}>
                      Merge Mode (Default)
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      New numbers will be added to existing suppression list. Duplicates will be automatically skipped.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSuppressionModal(null)
                  setSuppressionFile(null)
                  setSuppressionStats(null)
                  setSuppressionUploadResult(null)
                }}
                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 border border-gray-600/50'
                    : 'bg-gray-200/50 hover:bg-gray-200/70 text-gray-700 border border-gray-300'
                }`}
                disabled={isUploadingSuppression}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSuppressionUpload(showSuppressionModal)}
                disabled={!suppressionFile || isUploadingSuppression}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                }`}
              >
                {isUploadingSuppression ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Upload className="w-5 h-5 mr-2" />
                    Upload & Process
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Postcode Management Modal */}
      {showPostcodeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6 transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/95 border border-white/10'
              : 'bg-white/95 border border-gray-200/50'
          }`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDarkMode ? 'bg-green-500/20' : 'bg-green-500/10'
                }`}>
                  <MapPin className={`w-6 h-6 ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Service Area ZIP Codes - {showPostcodeModal.campaign_name}
                  </h2>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Manage service area ZIP codes for this campaign
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setShowPostcodeModal(null)
                  setPostcodeFile(null)
                  setPostcodeStats(null)
                  setPostcodeUploadResult(null)
                }}
                className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 ${
                  isDarkMode
                    ? 'hover:bg-gray-800/50 text-gray-400'
                    : 'hover:bg-gray-100/50 text-gray-600'
                }`}
                aria-label="Close modal"
                title="Close modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Current Postcode Status */}
            {postcodeStats && (
              <div className={`p-4 rounded-lg mb-6 ${
                isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/50'
              }`}>
                <h3 className={`text-lg font-semibold mb-3 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Current ZIP Code Status
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-green-500/10' : 'bg-green-50'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      isDarkMode ? 'text-green-400' : 'text-green-600'
                    }`}>
                      {postcodeStats.totalPostcodes?.toLocaleString() || '0'}
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Total Service ZIP Codes
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      {postcodeStats.lastUpload ? new Date(postcodeStats.lastUpload).toLocaleDateString() : 'Never'}
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Last Upload
                    </div>
                  </div>
                </div>
                {postcodeStats.lastFilename && (
                  <div className={`mt-3 text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <FileText className="w-4 h-4 inline mr-2" />
                    Last file: {postcodeStats.lastFilename}
                  </div>
                )}
              </div>
            )}

            {/* Upload Result */}
            {postcodeUploadResult && (
              <div className={`p-4 rounded-lg mb-6 ${
                isDarkMode ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-3 flex items-center ${
                  isDarkMode ? 'text-green-400' : 'text-green-600'
                }`}>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Upload Successful
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className={`font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {postcodeUploadResult.validPostcodesAdded}
                    </div>
                    <div className={`${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      New ZIP Codes Added
                    </div>
                  </div>
                  <div>
                    <div className={`font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {postcodeUploadResult.duplicatePostcodesSkipped}
                    </div>
                    <div className={`${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Duplicates Skipped
                    </div>
                  </div>
                  <div>
                    <div className={`font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {postcodeUploadResult.invalidPostcodesRejected}
                    </div>
                    <div className={`${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Invalid ZIP Codes
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Section */}
            <div className="space-y-4">
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Upload New ZIP Code List
              </h3>
              
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                postcodeFile
                  ? isDarkMode
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-green-500/50 bg-green-50'
                  : isDarkMode
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // Validate file type
                      if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
                        alert('Please select a CSV or TXT file')
                        return
                      }
                      
                      // Validate file size (max 5MB)
                      if (file.size > 5 * 1024 * 1024) {
                        alert('File size must be less than 5MB')
                        return
                      }
                      
                      setPostcodeFile(file)
                      setPostcodeUploadResult(null)
                    }
                  }}
                  className="hidden"
                  id="postcode-file-upload"
                />
                <label
                  htmlFor="postcode-file-upload"
                  className="cursor-pointer"
                >
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${
                    postcodeFile
                      ? isDarkMode ? 'text-green-400' : 'text-green-600'
                      : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <div className={`text-lg font-medium mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {postcodeFile ? postcodeFile.name : 'Drop CSV/TXT file here or click to browse'}
                  </div>
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Format: One ZIP code per line<br />
                    Example: 12345, 90210, 10001-1234
                  </div>
                </label>
              </div>

              {/* Upload Options */}
              <div className={`p-4 rounded-lg ${
                isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
              }`}>
                <div className="flex items-start gap-3">
                  <MapPin className={`w-5 h-5 mt-0.5 ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <div>
                    <div className={`font-medium mb-1 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      Service Area Management
                    </div>
                    <div className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Upload ZIP codes where your service is available. New ZIP codes will be added to existing list. Duplicates will be automatically skipped.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowPostcodeModal(null)
                  setPostcodeFile(null)
                  setPostcodeStats(null)
                  setPostcodeUploadResult(null)
                }}
                className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  isDarkMode
                    ? 'bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 border border-gray-600/50'
                    : 'bg-gray-200/50 hover:bg-gray-200/70 text-gray-700 border border-gray-300'
                }`}
                disabled={isUploadingPostcodes}
              >
                Cancel
              </button>
              <button
                onClick={() => handlePostcodeUpload(showPostcodeModal)}
                disabled={!postcodeFile || isUploadingPostcodes}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                    : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                }`}
              >
                {isUploadingPostcodes ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Upload className="w-5 h-5 mr-2" />
                    Upload & Process
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

export default Campaigns
