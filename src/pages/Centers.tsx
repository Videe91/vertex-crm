import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
  Plus,
  Building2,
  Search,
  Filter,
  X,
  ChevronDown,
  Save,
  Edit,
  Trash2,
  MapPin,
  Eye,
  EyeOff,
  DollarSign,
  PoundSterling
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'

const Centers: React.FC = () => {
  const { isDarkMode, setIsDarkMode } = useAuth()
  const [showAddCenterModal, setShowAddCenterModal] = useState(false)
  const [centers, setCenters] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [isLoadingCenters, setIsLoadingCenters] = useState(true)
  const [editingCenter, setEditingCenter] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showCenterDetails, setShowCenterDetails] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState<number | null>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 500 })
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})
  const [showAdminModal, setShowAdminModal] = useState<any>(null)
  const [adminFormData, setAdminFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false)
  const [adminFormError, setAdminFormError] = useState('')
  
  // Password state management
  const [centerPasswords, setCenterPasswords] = useState<{ [key: number]: string }>({})
  const [showPasswords, setShowPasswords] = useState<{ [key: number]: boolean }>({})
  
  // Commission state management
  const [showCommissionModal, setShowCommissionModal] = useState<any>(null)
  const [commissionAmount, setCommissionAmount] = useState('')
  
  // Multi-campaign assignment state
  const [centerCampaigns, setCenterCampaigns] = useState<{ [key: number]: any[] }>({})
    const [selectedCampaignForCommission, setSelectedCampaignForCommission] = useState<any>(null)
  const [newCampaignCommission, setNewCampaignCommission] = useState('')
  const [showCampaignSelector, setShowCampaignSelector] = useState<number | null>(null)
  
  // Edit modal campaign assignment state
  const [editModalCampaigns, setEditModalCampaigns] = useState<any[]>([])
  const [showEditCampaignSelector, setShowEditCampaignSelector] = useState(false)
  const [editSelectedCampaign, setEditSelectedCampaign] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    centerName: '',
    centerCode: '', // Auto-generated from name + country
    country: '', // Country where center is located
    address: '',
    adminName: '', // Center Admin Name
    adminEmail: '', // Center Admin Email (optional)
    campaignId: '', // Link to campaign (but no client info)
    status: 'active' // active, inactive, maintenance
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')



  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown && !(event.target as Element).closest('.dropdown-container')) {
        setShowDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])



  // Show center details popup
  const handleShowCenterDetails = (center: any) => {
    setShowCenterDetails(center)
  }

  // Get currency symbol based on campaign country
  const getCurrencySymbol = (center: any) => {
    // Find the campaign associated with this center
    const campaign = campaigns.find(c => c.id === center.campaign_id)
    if (!campaign) return '$' // Default to USD
    
    switch (campaign.country) {
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

  // Fetch campaigns for a specific center
  const fetchCenterCampaigns = async (centerId: number) => {
    try {
      const response = await fetch(`/api/centers/${centerId}/campaigns`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setCenterCampaigns(prev => ({
            ...prev,
            [centerId]: data.data
          }))
                  } else {
          console.error('Invalid center campaigns response format:', data)
          setCenterCampaigns(prev => ({
            ...prev,
            [centerId]: []
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching center campaigns:', error)
    }
  }

  // Handle campaign assignment to center
  const handleAssignCampaign = async (centerId: number, campaignId: number, commission: number) => {
    try {
      const response = await fetch(`/api/campaign-assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({
          campaignId,
          centerId,
          centerCommission: commission
        })
      })

      if (response.ok) {
        fetchCenterCampaigns(centerId) // Refresh center campaigns
        setSelectedCampaignForCommission(null)
        setNewCampaignCommission('')
        alert('Campaign assigned successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to assign campaign')
      }
    } catch (error) {
      console.error('Error assigning campaign:', error)
      alert('Error assigning campaign. Please try again.')
    }
  }

  // Handle campaign commission update
  const handleUpdateCampaignCommission = async (centerId: number, campaignId: number, commission: number) => {
    try {
      const response = await fetch(`/api/campaign-assignments/${campaignId}/${centerId}/commission`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({ commission })
      })

      if (response.ok) {
        fetchCenterCampaigns(centerId) // Refresh center campaigns
        alert('Commission updated successfully!')
      } else {
        console.error('Failed to update commission')
        alert('Failed to update commission. Please try again.')
      }
    } catch (error) {
      console.error('Error updating commission:', error)
      alert('Error updating commission. Please try again.')
    }
  }

  // Get currency symbol based on campaign country
  const getCampaignCurrencySymbol = (campaign: any) => {
    switch (campaign.country) {
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

  // Remove campaign from center
  const handleRemoveCampaignFromCenter = async (centerId: number, campaignId: number) => {
    try {
      const response = await fetch(`/api/campaign-assignments/${campaignId}/${centerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })

      if (response.ok) {
        // Refresh campaigns for edit modal
        const campaignsResponse = await fetch(`/api/centers/${centerId}/campaigns`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
          }
        })
        if (campaignsResponse.ok) {
          const data = await campaignsResponse.json()
          setEditModalCampaigns(data.campaigns || [])
        }
        
        // Also refresh the dropdown campaigns if this center dropdown is open
        if (showDropdown === centerId) {
          fetchCenterCampaigns(centerId)
        }
        
        alert('Campaign removed successfully!')
      } else {
        console.error('Failed to remove campaign')
        alert('Failed to remove campaign. Please try again.')
      }
    } catch (error) {
      console.error('Error removing campaign:', error)
      alert('Error removing campaign. Please try again.')
    }
  }

  // Handle center commission update (legacy - now per campaign)
  const handleCenterCommissionUpdate = async (center: any) => {
    if (!commissionAmount) {
      alert('Please enter a commission amount')
      return
    }

    try {
      const response = await fetch(`/api/centers/${center.id}/commission`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({ commission: commissionAmount })
      })

      if (response.ok) {
        setShowCommissionModal(null)
        setCommissionAmount('')
        fetchCenters() // Refresh the list
        alert('Center commission updated successfully!')
      } else {
        console.error('Failed to update center commission')
        alert('Failed to update center commission. Please try again.')
      }
    } catch (error) {
      console.error('Error updating center commission:', error)
      alert('Error updating center commission. Please try again.')
    }
  }

  // Toggle dropdown for center actions
  const toggleDropdown = (centerId: number) => {
    if (showDropdown === centerId) {
      setShowDropdown(null)
    } else {
      const button = buttonRefs.current[centerId]
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
      
      // Pre-generate password when dropdown opens
      const center = centers.find(c => c.id === centerId)
      if (center && !centerPasswords[centerId] && !center.admin_password) {
        const { password } = generateAdminCredentials(center)
        setCenterPasswords(prev => ({ ...prev, [centerId]: password }))
      }
      
      // Fetch campaigns for this center when dropdown opens
      fetchCenterCampaigns(centerId)
      
      setShowDropdown(centerId)
    }
  }

  // Generate auto credentials for center admin
  const generateAdminCredentials = (center: any) => {
    const centerCode = center.center_code || 'CTR'
    const adminName = center.admin_name || center.manager_name || 'Admin'
    
    // Generate username: CODE_CA_FirstName (first 5 letters)
    const firstName = adminName.split(' ')[0].substring(0, 5).toUpperCase()
    const username = `${centerCode}_CA_${firstName}`
    
    // Generate random password (8 characters with mix of upper, lower, numbers, symbols)
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%'
    
    let password = ''
    // Ensure at least one character from each category
    password += upper[Math.floor(Math.random() * upper.length)]
    password += lower[Math.floor(Math.random() * lower.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    
    // Fill remaining 4 characters randomly
    const allChars = upper + lower + numbers + symbols
    for (let i = 4; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // Shuffle the password to randomize the order
    password = password.split('').sort(() => Math.random() - 0.5).join('')
    
    return { username, password }
  }

  // Initialize or get password for a center
  const getCenterPassword = (centerId: number, center: any) => {
    if (centerPasswords[centerId]) {
      return centerPasswords[centerId]
    }
    
    // If center has stored password, use it
    if (center.admin_password) {
      setCenterPasswords(prev => ({ ...prev, [centerId]: center.admin_password }))
      return center.admin_password
    }
    
    // Generate new password and store it
    const { password } = generateAdminCredentials(center)
    setCenterPasswords(prev => ({ ...prev, [centerId]: password }))
    return password
  }

  // Reset password for a center
  const resetCenterPassword = async (centerId: number, center: any) => {
    const { password } = generateAdminCredentials(center)
    
    try {
      // Update password in database
      const response = await fetch(`/api/centers/${centerId}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        // Update local state
        setCenterPasswords(prev => ({ ...prev, [centerId]: password }))
        
        // Update centers array to reflect the new password
        setCenters(prev => prev.map(c => 
          c.id === centerId 
            ? { ...c, admin_password: password }
            : c
        ))
        
        // Auto-show the new password temporarily
        setShowPasswords(prev => ({ ...prev, [centerId]: true }))
        
        // Show success message with new password
        setTimeout(() => {
          alert(`Password reset successfully!\nNew Password: ${password}\n\nThe password is now visible in the dropdown.`)
        }, 100)
      } else {
        // If API fails, still update local state for demo purposes
        setCenterPasswords(prev => ({ ...prev, [centerId]: password }))
        setCenters(prev => prev.map(c => 
          c.id === centerId 
            ? { ...c, admin_password: password }
            : c
        ))
        // Auto-show the new password temporarily
        setShowPasswords(prev => ({ ...prev, [centerId]: true }))
        
        // Show success message with new password
        setTimeout(() => {
          alert(`Password reset successfully!\nNew Password: ${password}\n\nThe password is now visible in the dropdown.`)
        }, 100)
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      // Still update local state for demo purposes
      setCenterPasswords(prev => ({ ...prev, [centerId]: password }))
      setCenters(prev => prev.map(c => 
        c.id === centerId 
          ? { ...c, admin_password: password }
          : c
      ))
      alert(`Password reset successfully!\nNew Password: ${password}`)
    }
  }

  // Toggle password visibility
  const togglePasswordVisibility = (centerId: number) => {
    setShowPasswords(prev => {
      // Explicitly handle undefined as false
      const currentValue = prev[centerId] === true
      const newValue = !currentValue
      return { ...prev, [centerId]: newValue }
    })
  }

  // Handle admin creation/editing
  const handleAddAdmin = (center: any) => {
    const isNewAdmin = !center.admin_username
    let credentials = { username: '', password: '' }
    
    if (isNewAdmin) {
      credentials = generateAdminCredentials(center)
    }
    
    setShowAdminModal(center)
    setAdminFormData({
      username: center.admin_username || credentials.username,
      email: center.admin_email || '',
      password: isNewAdmin ? credentials.password : '',
      confirmPassword: isNewAdmin ? credentials.password : ''
    })
    setShowDropdown(null)
  }

  const handleAdminInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setAdminFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const resetAdminForm = () => {
    setAdminFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    })
    setShowAdminModal(null)
    setAdminFormError('')
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!adminFormData.username.trim()) {
      setAdminFormError('Username is required')
      return
    }

    if (!adminFormData.email.trim()) {
      setAdminFormError('Email is required')
      return
    }

    if (!adminFormData.password) {
      setAdminFormError('Password is required')
      return
    }

    if (adminFormData.password !== adminFormData.confirmPassword) {
      setAdminFormError('Passwords do not match')
      return
    }

    if (adminFormData.password.length < 6) {
      setAdminFormError('Password must be at least 6 characters')
      return
    }

    setIsSubmittingAdmin(true)
    setAdminFormError('')

    try {
      const response = await fetch(`/api/centers/${showAdminModal.id}/admin`, {
        method: showAdminModal.admin_username ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({
          username: adminFormData.username,
          email: adminFormData.email,
          password: adminFormData.password
        })
      })

      if (response.ok) {
        await fetchCenters() // Refresh centers list
        resetAdminForm()
      } else {
        const errorData = await response.json()
        setAdminFormError(errorData.error || 'Failed to save admin details')
      }
    } catch (error) {
      console.error('Error saving admin:', error)
      setAdminFormError('Failed to save admin details')
    } finally {
      setIsSubmittingAdmin(false)
    }
  }

  // Auto-generate center code from name + country
  const generateCenterCode = (name: string, country: string) => {
    if (!name || !country) return ''
    
    // Get initials from center name (first letter of each word)
    const nameInitials = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2) // Take first 2 initials
    
    // Country abbreviations mapping
    const countryAbbreviations: { [key: string]: string } = {
      'India': 'IN',
      'United States': 'US',
      'United Kingdom': 'UK',
      'Canada': 'CA',
      'Australia': 'AU',
      'Philippines': 'PH',
      'Mexico': 'MX',
      'Brazil': 'BR',
      'South Africa': 'ZA',
      'Germany': 'DE',
      'France': 'FR',
      'Netherlands': 'NL',
      'Poland': 'PL',
      'Romania': 'RO',
      'Ukraine': 'UA',
      'Egypt': 'EG'
    }
    
    const countryCode = countryAbbreviations[country] || country.substring(0, 2).toUpperCase()
    
    return `${nameInitials}_${countryCode}`
  }

  const fetchCenters = async () => {
    try {
      setIsLoadingCenters(true)
      const response = await fetch('/api/centers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const centersData = await response.json()
        setCenters(centersData)
        
        // Initialize passwords for centers that have them
        const passwordMap: { [key: number]: string } = {}
        centersData.forEach((center: any) => {
          if (center.admin_password && center.id) {
            passwordMap[center.id] = center.admin_password
          }
        })
        if (Object.keys(passwordMap).length > 0) {
          setCenterPasswords(prev => ({ ...prev, ...passwordMap }))
        }
      } else {
        console.error('Failed to fetch centers')
      }
    } catch (error) {
      console.error('Error fetching centers:', error)
    } finally {
      setIsLoadingCenters(false)
    }
  }

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      if (response.ok) {
        const campaignsData = await response.json()
        if (campaignsData.success && campaignsData.data) {
          setCampaigns(campaignsData.data)
        } else if (Array.isArray(campaignsData)) {
          // Handle case where API returns array directly
          setCampaigns(campaignsData)
        } else {
          console.error('Invalid campaigns response format:', campaignsData)
          setCampaigns([])
        }
      } else {
        console.error('Failed to fetch campaigns')
        setCampaigns([])
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    }
  }

  // Load centers and campaigns on component mount
  useEffect(() => {
    fetchCenters()
    fetchCampaigns()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      const newData = { ...prev, [name]: value }
      
      // Auto-generate center code when name or country changes
      if (name === 'centerName' || name === 'country') {
        const centerName = name === 'centerName' ? value : prev.centerName
        const country = name === 'country' ? value : prev.country
        newData.centerCode = generateCenterCode(centerName, country)
      }
      
      return newData
    })
  }



  const resetForm = () => {
    setFormData({
      centerName: '',
      centerCode: '',
      country: '',
      address: '',
      adminName: '',
      adminEmail: '',
      campaignId: '',
      status: 'active'
    })
    setEditingCenter(null)
    setFormError('')
    setEditModalCampaigns([])
    setShowEditCampaignSelector(false)
    setEditSelectedCampaign(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.centerName.trim()) {
      setFormError('Center name is required')
      return
    }

    if (!formData.centerCode.trim()) {
      setFormError('Center code is required')
      return
    }

    if (!editingCenter && editModalCampaigns.length === 0) {
      setFormError('Please assign at least one campaign')
      return
    }

    if (!formData.adminName.trim()) {
      setFormError('Center admin name is required')
      return
    }

    if (!formData.country) {
      setFormError('Country is required')
      return
    }

    if (!formData.address.trim()) {
      setFormError('Address is required')
      return
    }

    setIsSubmitting(true)
    setFormError('')

    try {
      // Generate admin credentials if this is a new center or admin name changed
      const shouldGenerateCredentials = !editingCenter || 
        (editingCenter && editingCenter.manager_name !== formData.adminName)
      
      let adminCredentials = { username: '', password: '' }
      if (shouldGenerateCredentials && formData.adminName.trim()) {
        // Create a mock center object for credential generation
        const centerForCredentials = {
          center_code: formData.centerCode,
          admin_name: formData.adminName,
          manager_name: formData.adminName
        }
        adminCredentials = generateAdminCredentials(centerForCredentials)
      }

      // Prepare the form data with admin credentials
      const centerData = {
        ...formData,
        // Use the first selected campaign's ID as the initial campaignId
        campaignId: !editingCenter && editModalCampaigns.length > 0 ? editModalCampaigns[0].campaign_id : formData.campaignId,
        admin_username: adminCredentials.username || (editingCenter?.admin_username || ''),
        admin_password: adminCredentials.password || (editingCenter?.admin_password || '')
      }
      
      const url = editingCenter ? `/api/centers/${editingCenter.id}` : `/api/centers`
      const method = editingCenter ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify(centerData)
      })

      if (response.ok) {
        const responseData = await response.json()
        const centerId = responseData.center?.id || editingCenter?.id
        
        // Assign additional campaigns to the center (for new centers)
        // Skip the first campaign since it's already assigned during center creation
        if (!editingCenter && editModalCampaigns.length > 1 && centerId) {
          for (let i = 1; i < editModalCampaigns.length; i++) {
            const campaign = editModalCampaigns[i]
            try {
              await handleAssignCampaign(centerId, campaign.campaign_id, 0.00)
            } catch (error) {
              console.error('Error assigning additional campaign:', error)
            }
          }
        }
        
        // If we generated new credentials, store them and show to user
        if (shouldGenerateCredentials && adminCredentials.password) {
          if (centerId) {
            setCenterPasswords(prev => ({ ...prev, [centerId]: adminCredentials.password }))
          }
          
          alert(`Center ${editingCenter ? 'updated' : 'created'} successfully!\n\nAdmin Login Credentials:\nUsername: ${adminCredentials.username}\nPassword: ${adminCredentials.password}\n\nPlease save these credentials securely.`)
        } else {
          alert(`Center ${editingCenter ? 'updated' : 'created'} successfully!`)
        }
        
        resetForm()
        setShowAddCenterModal(false)
        fetchCenters()
      } else {
        const errorData = await response.json()
        setFormError(errorData.error || `Failed to ${editingCenter ? 'update' : 'create'} center`)
      }
    } catch (error) {
      console.error('Center operation error:', error)
      setFormError('Failed to save center. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCenter = async (center: any) => {
    setEditingCenter(center)
    setFormData({
      centerName: center.center_name || center.name || '',
      centerCode: center.center_code || center.code || '',
      country: center.country || '',
      address: center.address || '',
      adminName: center.manager_name || '',
      adminEmail: center.admin_email || '',
      campaignId: '', // No longer used for single campaign
      status: center.status || 'active'
    })
    
    // Fetch assigned campaigns for this center
    try {
      const response = await fetch(`/api/centers/${center.id}/campaigns`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setEditModalCampaigns(data.campaigns || [])
      }
    } catch (error) {
      console.error('Error fetching center campaigns:', error)
      setEditModalCampaigns([])
    }
    
    setShowAddCenterModal(true)
  }

  const handleDeleteCenter = async (centerId: number) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/centers/${centerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        }
      })

      const data = await response.json()
      if (data.success) {
        fetchCenters()
        setShowDeleteConfirm(null)
      } else {
        console.error('Failed to delete center')
      }
    } catch (error) {
      console.error('Error deleting center:', error)
    } finally {
      setIsDeleting(false)
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
        activeItem="centers"
      />
      
      <div className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className={`p-2 rounded-xl ${
                  isDarkMode ? 'bg-blue-500/20' : 'bg-blue-500/10'
                }`}>
                  <Building2 className={`w-6 h-6 ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                </div>
                <h1 className={`text-3xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Centers
                </h1>

              </div>
              <p className={`${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Manage your operational centers and their assignments
              </p>
            </div>
            
            <button
              onClick={() => setShowAddCenterModal(true)}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Center
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <input
                type="text"
                placeholder="Search centers..."
                className={`w-full pl-12 pr-4 py-3 rounded-xl border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                  isDarkMode 
                    ? 'bg-gray-800/50 ring-gray-700 text-white placeholder-gray-400' 
                    : 'bg-white ring-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
            
            <button 
              className={`flex items-center px-4 py-3 rounded-xl border-0 ring-1 ring-inset transition-all duration-200 hover:ring-2 hover:ring-orange-500 ${
                isDarkMode 
                  ? 'bg-gray-800/50 ring-gray-700 text-gray-300 hover:text-white' 
                  : 'bg-white ring-gray-300 text-gray-700 hover:text-gray-900'
              }`}
              aria-label="Filter centers"
              title="Filter centers"
            >
              <Filter className="w-5 h-5 mr-2" />
              Filter
              <ChevronDown className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>

        {/* Centers Table */}
        <div 
          className={`rounded-2xl ring-1 ring-inset ${
            isDarkMode 
              ? 'bg-gray-800/30 ring-gray-700/30' 
              : 'bg-white ring-gray-200/30'
          }`}

        >
          {isLoadingCenters ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Loading centers...
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full relative">
                <thead>
                  <tr className={`border-b ${
                    isDarkMode ? 'border-gray-700/30' : 'border-gray-200/30'
                  }`}>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Center</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Campaign</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Country</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Status</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Admin</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Agents</th>
                    <th className={`text-center p-4 font-semibold ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {centers && centers.length > 0 ? centers.map((center) => (
                    <tr key={center.id} className={`border-b transition-colors duration-200 hover:bg-opacity-50 ${
                      isDarkMode 
                        ? 'border-gray-700/30 hover:bg-gray-800/30' 
                        : 'border-gray-200/30 hover:bg-gray-100/30'
                    }`}>
                      <td className="p-4 text-center">
                        <div>
                          <div 
                            className={`font-medium cursor-pointer transition-colors duration-200 hover:text-orange-500 ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}
                            onClick={() => handleShowCenterDetails(center)}
                            title="Click to view center details"
                          >
                            {center.center_name}
                          </div>
                          <div className={`text-sm ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            Code: {center.center_code}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {center.campaign_name || 'Not Assigned'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {center.country || 'Not Set'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          center.status === 'active'
                            ? isDarkMode
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-green-500/10 text-green-600'
                            : center.status === 'inactive'
                              ? isDarkMode
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-red-500/10 text-red-600'
                              : isDarkMode
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-yellow-500/10 text-yellow-600'
                        }`}>
                          {center.status === 'active' ? 'Active' :
                           center.status === 'inactive' ? 'Inactive' : 'Maintenance'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {center.manager_name || 'Not assigned'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          0 {/* This will be auto-counted from agents later */}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleEditCenter(center)}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                              isDarkMode
                                ? 'hover:bg-blue-500/20 text-blue-400 hover:text-blue-300'
                                : 'hover:bg-blue-500/10 text-blue-600 hover:text-blue-700'
                            }`}
                            aria-label="Edit center"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(center.id)}
                            className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                              isDarkMode
                                ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
                                : 'hover:bg-red-500/10 text-red-600 hover:text-red-700'
                            }`}
                            aria-label="Delete center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="relative dropdown-container">
                            <button
                              ref={(el) => { buttonRefs.current[center.id] = el }}
                              onClick={() => toggleDropdown(center.id)}
                              className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                                isDarkMode
                                  ? 'hover:bg-orange-500/20 text-orange-400 hover:text-orange-300'
                                  : 'hover:bg-orange-500/10 text-orange-600 hover:text-orange-700'
                              }`}
                              aria-label="Center admin options"
                              title="Center admin options"
                            >
                              <ChevronDown className={`w-4 h-4 text-orange-500 transition-transform duration-200 ${
                                showDropdown === center.id ? 'rotate-180' : ''
                              }`} />

                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <span className={`${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          No centers found
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

      {/* Add/Edit Center Modal */}
      {showAddCenterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {editingCenter ? 'Edit Center' : 'Add New Center'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddCenterModal(false)
                    resetForm()
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Close modal"
                  title="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {formError && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-red-500 text-sm">{formError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Center Name */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Center Name *
                    </label>
                    <input
                      type="text"
                      name="centerName"
                      value={formData.centerName}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                        isDarkMode 
                          ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Enter center name"
                      required
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Country *
                    </label>
                    <select
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                        isDarkMode 
                          ? 'bg-gray-700/50 ring-gray-600 text-white' 
                          : 'bg-gray-50 ring-gray-300 text-gray-900'
                      }`}
                      required
                      aria-label="Select country"
                    >
                      <option value="">Select country</option>
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Philippines">Philippines</option>
                      <option value="Mexico">Mexico</option>
                      <option value="Brazil">Brazil</option>
                      <option value="South Africa">South Africa</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Netherlands">Netherlands</option>
                      <option value="Poland">Poland</option>
                      <option value="Romania">Romania</option>
                      <option value="Ukraine">Ukraine</option>
                      <option value="Egypt">Egypt</option>
                    </select>
                  </div>

                  {/* Center Code (Auto-generated) */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Center Code (Auto-generated)
                    </label>
                    <input
                      type="text"
                      name="centerCode"
                      value={formData.centerCode}
                      readOnly
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset ${
                        isDarkMode 
                          ? 'bg-gray-800/50 ring-gray-700 text-gray-400' 
                          : 'bg-gray-100 ring-gray-300 text-gray-500'
                      }`}
                      placeholder="Will be generated automatically"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                        isDarkMode 
                          ? 'bg-gray-700/50 ring-gray-600 text-white' 
                          : 'bg-gray-50 ring-gray-300 text-gray-900'
                      }`}
                      aria-label="Select status"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  {/* Campaign Assignment - New Multi-Campaign Section */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className={`block text-sm font-medium ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Assigned Campaigns
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowEditCampaignSelector(true)}
                        className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isDarkMode
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        title="Add Campaign"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Display assigned campaigns */}
                    <div className="space-y-2 mb-4">
                      {editModalCampaigns.length > 0 ? (
                        editModalCampaigns.map((campaign) => (
                          <div key={campaign.campaign_id} className={`p-3 rounded-lg border ${
                            isDarkMode 
                              ? 'bg-orange-500/10 border-orange-500/20' 
                              : 'bg-orange-50 border-orange-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {campaign.campaign_name}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (editingCenter && confirm(`Remove ${campaign.campaign_name} from this center?`)) {
                                    await handleRemoveCampaignFromCenter(editingCenter.id, campaign.campaign_id)
                                  }
                                }}
                                className={`p-2 rounded-lg text-sm transition-all duration-200 ${
                                  isDarkMode
                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                                title="Remove Campaign"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className={`p-4 rounded-lg text-center ${
                          isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'
                        }`}>
                          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            No campaigns assigned yet. Click + to add campaigns.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Campaign Selector */}
                    {showEditCampaignSelector && (
                      <div className={`p-4 rounded-lg border ${
                        isDarkMode 
                          ? 'bg-blue-500/10 border-blue-500/20' 
                          : 'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="space-y-3">
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Select Campaign
                            </label>
                            <select
                              value={editSelectedCampaign?.id || ''}
                              onChange={(e) => {
                                const campaign = campaigns.find(c => c.id == e.target.value)
                                setEditSelectedCampaign(campaign || null)
                              }}
                              aria-label="Select campaign to assign"
                              title="Select campaign to assign to center"
                              className={`w-full px-3 py-2 rounded-lg border ${
                                isDarkMode
                                  ? 'bg-gray-800 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            >
                              <option value="">Choose a campaign...</option>
                              {campaigns.filter(c => 
                                !editModalCampaigns.some(ec => ec.campaign_id === c.id)
                              ).map(campaign => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.campaign_name} ({campaign.country})
                                </option>
                              ))}
                            </select>
                          </div>



                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowEditCampaignSelector(false)
                                setEditSelectedCampaign(null)
                              }}
                              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                isDarkMode
                                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (editSelectedCampaign) {
                                  if (editingCenter) {
                                    // For existing centers, assign immediately
                                    await handleAssignCampaign(
                                      editingCenter.id, 
                                      editSelectedCampaign.id,
                                      0.00 // Default commission, will be set in dropdown
                                    )
                                    // Refresh campaigns
                                    const response = await fetch(`/api/centers/${editingCenter.id}/campaigns`, {
                                      headers: {
                                        'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
                                      }
                                    })
                                    if (response.ok) {
                                      const data = await response.json()
                                      setEditModalCampaigns(data.campaigns || [])
                                    }
                                  } else {
                                    // For new centers, add to temporary list
                                    const newCampaign = {
                                      campaign_id: editSelectedCampaign.id,
                                      campaign_name: editSelectedCampaign.campaign_name,
                                      country: editSelectedCampaign.country,
                                      commission: 0.00
                                    }
                                    setEditModalCampaigns(prev => [...prev, newCampaign])
                                  }
                                  setShowEditCampaignSelector(false)
                                  setEditSelectedCampaign(null)
                                }
                              }}
                              disabled={!editSelectedCampaign}
                              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                                !editSelectedCampaign
                                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                  : isDarkMode
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              <Save className="w-4 h-4 mr-1 inline" />
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    )}


                  </div>
                </div>

                {/* Center Admin Name */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Center Admin Name *
                  </label>
                  <input
                    type="text"
                    name="adminName"
                    value={formData.adminName}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                      isDarkMode 
                        ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                        : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="Enter admin name"
                    required
                  />
                </div>

                {/* Center Admin Email (Optional) */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Center Admin Email (Optional)
                  </label>
                  <input
                    type="email"
                    name="adminEmail"
                    value={formData.adminEmail || ''}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                      isDarkMode 
                        ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                        : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="Enter admin email (optional)"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Address *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 resize-none ${
                      isDarkMode 
                        ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                        : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder="Enter center address"
                    required
                  />
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCenterModal(false)
                      resetForm()
                    }}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {editingCenter ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingCenter ? 'Update Center' : 'Create Center'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              
              <h3 className={`text-lg font-semibold text-center mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Delete Center
              </h3>
              
              <p className={`text-center mb-6 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Are you sure you want to delete this center? This action cannot be undone.
              </p>
              
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isDarkMode
                      ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCenter(showDeleteConfirm)}
                  disabled={isDeleting}
                  className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Center Details Modal */}
      {showCenterDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-4xl rounded-2xl shadow-2xl ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          } max-h-[90vh] overflow-y-auto`}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg mr-4 ${
                    isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
                  }`}>
                    <Building2 className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {showCenterDetails.center_name}
                    </h3>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Center Information
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCenterDetails(null)}
                  className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                    isDarkMode
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Close details"
                  title="Close details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Basic Information Card */}
                <div className={`p-6 rounded-xl border ${
                  isDarkMode ? 'border-gray-700/50 bg-gray-700/20' : 'border-gray-200/50 bg-gray-50/50'
                }`}>
                  <h4 className={`font-semibold mb-4 flex items-center ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Building2 className="w-5 h-5 mr-2 text-orange-500" />
                    Basic Information
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Center Name:</span>
                      <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{showCenterDetails.center_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Center Code:</span>
                      <span className={`font-mono px-2 py-1 rounded text-sm ${
                        isDarkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-500/10 text-orange-600'
                      }`}>{showCenterDetails.center_code}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Country:</span>
                      <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{showCenterDetails.country || 'Not Set'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status:</span>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        showCenterDetails.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : showCenterDetails.status === 'inactive'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {showCenterDetails.status === 'active' ? 'Active' :
                         showCenterDetails.status === 'inactive' ? 'Inactive' : 'Maintenance'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact & Assignment Card */}
                <div className={`p-6 rounded-xl border ${
                  isDarkMode ? 'border-gray-700/50 bg-gray-700/20' : 'border-gray-200/50 bg-gray-50/50'
                }`}>
                  <h4 className={`font-semibold mb-4 flex items-center ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    <MapPin className="w-5 h-5 mr-2 text-orange-500" />
                    Contact & Assignment
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <span className={`font-medium block mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Address:</span>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {showCenterDetails.address || 'Not provided'}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Admin:</span>
                      <span className={`font-medium ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>{showCenterDetails.manager_name || 'Not assigned'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Campaign:</span>
                      <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{showCenterDetails.campaign_name || 'Not assigned'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Creation/Edit Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg mr-4 ${
                    isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
                  }`}>
                    {showAdminModal.admin_username ? (
                      <Edit className="w-6 h-6 text-orange-500" />
                    ) : (
                      <Plus className="w-6 h-6 text-orange-500" />
                    )}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {showAdminModal.admin_username ? 'Edit Admin' : 'Add Centre Admin'}
                    </h3>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {showAdminModal.center_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetAdminForm}
                  className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                    isDarkMode
                      ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAdminSubmit}>
                {adminFormError && (
                  <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-red-500 text-sm">{adminFormError}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Username */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Username *
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={adminFormData.username}
                      onChange={handleAdminInputChange}
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                        isDarkMode 
                          ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Enter username"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={adminFormData.email}
                      onChange={handleAdminInputChange}
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                        isDarkMode 
                          ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Enter email address"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {showAdminModal.admin_username ? 'New Password *' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={adminFormData.password}
                      onChange={handleAdminInputChange}
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                        isDarkMode 
                          ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Enter password"
                      required
                    />
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={adminFormData.confirmPassword}
                      onChange={handleAdminInputChange}
                      className={`w-full px-4 py-3 rounded-lg border-0 ring-1 ring-inset transition-all duration-200 focus:ring-2 focus:ring-orange-500 ${
                        isDarkMode 
                          ? 'bg-gray-700/50 ring-gray-600 text-white placeholder-gray-400' 
                          : 'bg-gray-50 ring-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 mt-6">
                  <button
                    type="button"
                    onClick={resetAdminForm}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'text-gray-300 hover:text-white hover:bg-gray-700'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAdmin}
                    className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmittingAdmin ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                        {showAdminModal.admin_username ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {showAdminModal.admin_username ? 'Update Admin' : 'Create Admin'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Portal Dropdown - Center Report Card */}
      {showDropdown !== null && createPortal(
          <div 
            className={`dropdown-container fixed rounded-xl shadow-2xl border z-[99999] transition-all duration-300 ease-in-out ${
              isDarkMode 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
{...({
            style: { 
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width
            }
          } as any)}
          >
          {(() => {
            const currentCenter = centers.find(c => c.id === showDropdown)
            if (!currentCenter) return null
            
            return (
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {currentCenter.center_name}
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Code: {currentCenter.center_code} • {currentCenter.country}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Only show if truly no admin exists */}
                    {!currentCenter.manager_name && !currentCenter.admin_username && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          handleAddAdmin(currentCenter)
                        }}
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg text-sm"
                        aria-label="Add Centre Admin"
                        title="Add Centre Admin"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Centre Admin
                      </button>
                    )}
                    <button
                      onClick={() => setShowDropdown(null)}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                      }`}
                      aria-label="Close center details"
                      title="Close center details"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Admin Management Section - Show if admin exists */}
                {currentCenter.manager_name && (
                  <div className="mb-6">
                    <h4 className={`text-md font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Center Administration
                    </h4>
                    <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-4">
                              <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {currentCenter.manager_name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Username:</span>
                                <span className="text-sm font-mono text-orange-500">
                                {currentCenter.admin_username || (() => {
                                  // Use manager_name for credential generation
                                  const centerForCredentials = { ...currentCenter, admin_name: currentCenter.manager_name }
                                  const { username } = generateAdminCredentials(centerForCredentials)
                                  return username
                                })()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Password:</span>
                              <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {(() => {
                                  // Explicit check for true (not just truthy)
                                  const shouldShowPassword = showPasswords[currentCenter.id] === true
                                  
                                  if (shouldShowPassword) {
                                    return getCenterPassword(currentCenter.id, currentCenter)
                                  } else {
                                    return '••••••••'
                                  }
                                })()}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  togglePasswordVisibility(currentCenter.id)
                                }}
                                className={`p-2 rounded transition-colors ${
                                  isDarkMode
                                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                }`}
                                title={showPasswords[currentCenter.id] === true ? "Hide password" : "Show password"}
                              >
                                {showPasswords[currentCenter.id] === true ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  if (confirm('Are you sure you want to reset the password to a new auto-generated one?')) {
                                    resetCenterPassword(currentCenter.id, currentCenter)
                                  }
                                }}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  isDarkMode
                                    ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                }`}
                                title="Reset to new auto-generated password"
                              >
                                Reset
                              </button>
                            </div>
                          </div>

                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAddAdmin(currentCenter)}
                            className={`p-2 rounded-lg transition-colors ${
                              isDarkMode
                                ? 'hover:bg-gray-600 text-gray-300 hover:text-orange-400'
                                : 'hover:bg-gray-200 text-gray-600 hover:text-orange-600'
                            }`}
                            aria-label="Edit admin details"
                            title="Edit admin details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Multi-Campaign Commission Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-md font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Campaign Details
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        setShowCampaignSelector(currentCenter.id)
                      }}
                      className={`p-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isDarkMode
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                      title="Add Campaign"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Display assigned campaigns */}
                  <div className="space-y-2">
                    {centerCampaigns[currentCenter.id]?.length > 0 ? (
                      centerCampaigns[currentCenter.id].map((campaign) => (
                          <div key={campaign.campaign_id} className={`p-3 rounded-lg border ${
                            isDarkMode 
                              ? 'bg-orange-500/10 border-orange-500/20' 
                              : 'bg-orange-50 border-orange-200'
                          }`}>
                                                          <div className="flex items-center justify-between">
<div className="flex-1">
                                <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {campaign.campaign_name}
</div>
                              <div className={`text-lg font-bold ${
                                isDarkMode ? 'text-orange-400' : 'text-orange-600'
                              }`}>
                                {getCampaignCurrencySymbol(campaign)}{campaign.center_commission || '0.00'}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {campaign.payment_type?.replace('_', ' ')} • {campaign.client_name}
                              </div>
                              {campaign.form_id && (
                                <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  Form ID: {campaign.form_id}
                                </div>
                              )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setSelectedCampaignForCommission(campaign)
                                    setNewCampaignCommission(campaign.center_commission || '')
                                  }}
                                  className={`p-2 rounded-lg text-sm transition-all duration-200 ${
                                    isDarkMode
                                      ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                      : 'bg-orange-600 text-white hover:bg-orange-700'
                                  }`}
                                  title="Edit Commission"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                              </div>
                                </div>
))
                    ) : (
                        <div className={`p-4 rounded-lg text-center ${
                          isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'
                        }`}>
                          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            No campaigns assigned yet. Click + to add campaigns.
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Campaign Selector */}
                  {showCampaignSelector === currentCenter.id && (
                    <div className={`p-4 rounded-lg border ${
                      isDarkMode 
                        ? 'bg-blue-500/10 border-blue-500/20' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="space-y-3">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Select Campaign
                          </label>
                          <select
                            value={selectedCampaignForCommission?.campaign_id || ''}
                            onChange={(e) => {
                              const campaign = campaigns.find(c => c.id == e.target.value)
                              setSelectedCampaignForCommission(campaign ? { ...campaign, campaign_id: campaign.id } : null)
                            }}
                            aria-label="Select campaign to assign"
                            title="Select campaign to assign to center"
                            className={`w-full px-3 py-2 rounded-lg border ${
                              isDarkMode
                                ? 'bg-gray-800 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                          >
                            <option value="">Choose a campaign...</option>
                            {campaigns.filter(c => 
                              !centerCampaigns[currentCenter.id]?.some(cc => cc.campaign_id === c.id)
                            ).map(campaign => (
                              <option key={campaign.id} value={campaign.id}>
                                {campaign.campaign_name} ({campaign.country})
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedCampaignForCommission && (
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Commission Amount
                            </label>
                            <div className="relative">
                              <span className={`absolute left-3 top-1/2 transform -translate-y-1/2 font-bold ${
                                isDarkMode ? 'text-blue-400' : 'text-blue-600'
                              }`}>
                                {getCampaignCurrencySymbol(selectedCampaignForCommission)}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                value={newCampaignCommission}
                                onChange={(e) => setNewCampaignCommission(e.target.value)}
                                className={`w-full pl-8 pr-4 py-2 rounded-lg border ${
                                  isDarkMode
                                    ? 'bg-gray-800 border-gray-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setShowCampaignSelector(null)
                              setSelectedCampaignForCommission(null)
                              setNewCampaignCommission('')
                            }}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isDarkMode
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (selectedCampaignForCommission && newCampaignCommission) {
                                handleAssignCampaign(
                                  currentCenter.id, 
                                  selectedCampaignForCommission.campaign_id,
                                  parseFloat(newCampaignCommission)
                                )
                                setShowCampaignSelector(null)
                              }
                            }}
                            disabled={!selectedCampaignForCommission || !newCampaignCommission}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              (!selectedCampaignForCommission || !newCampaignCommission)
                                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                : isDarkMode
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            <Save className="w-4 h-4 mr-1 inline" />
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commission Edit Modal */}
                  {selectedCampaignForCommission && !showCampaignSelector && (
                    <div className={`p-4 rounded-lg border ${
                      isDarkMode 
                        ? 'bg-blue-500/10 border-blue-500/20' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="space-y-3">
                        <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Edit Commission: {selectedCampaignForCommission.campaign_name}
                        </div>
                        <div className="relative">
                          <span className={`absolute left-3 top-1/2 transform -translate-y-1/2 font-bold ${
                            isDarkMode ? 'text-blue-400' : 'text-blue-600'
                          }`}>
                            {getCampaignCurrencySymbol(selectedCampaignForCommission)}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={newCampaignCommission}
                            onChange={(e) => setNewCampaignCommission(e.target.value)}
                            className={`w-full pl-8 pr-4 py-2 rounded-lg border ${
                              isDarkMode
                                ? 'bg-gray-800 border-gray-600 text-white'
                                : 'bg-white border-gray-300 text-gray-900'
                            }`}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedCampaignForCommission(null)
                              setNewCampaignCommission('')
                            }}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isDarkMode
                                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (newCampaignCommission) {
                                handleUpdateCampaignCommission(
                                  currentCenter.id,
                                  selectedCampaignForCommission.campaign_id,
                                  parseFloat(newCampaignCommission)
                                )
                                setSelectedCampaignForCommission(null)
                                setNewCampaignCommission('')
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isDarkMode
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            <Save className="w-4 h-4 mr-1 inline" />
                            Update
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Analytics Section - Only show if admin exists and center is operational */}
                {currentCenter.manager_name && (
                  <div className="space-y-4">
                    <h4 className={`text-md font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Center Analytics
                    </h4>
                    
                    {/* Check if center has operational data */}
                    <div className={`p-4 rounded-lg text-center ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Analytics available after adding agents and campaigns.
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                            <button
                              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                isDarkMode
                                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                              }`}
                              aria-label="View center agents"
                              title="View center agents"
                            >
                              View Agents
                            </button>
                            <button
                              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              }`}
                              aria-label="View full center report"
                              title="View full center report"
                            >
                              Full Report
                            </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>,
        document.body
)}

      {/* Center Commission Modal */}
      {showCommissionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl p-6 transition-all duration-300 ${
            isDarkMode
              ? 'bg-gray-900/95 border border-white/10'
              : 'bg-white/95 border border-gray-200/50'
          }`}>
            {/* Modal Header */}
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/10'
              }`}>
                {getCurrencySymbol(showCommissionModal) === '£' ? (
                  <PoundSterling className={`w-8 h-8 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                ) : (
                  <DollarSign className={`w-8 h-8 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`} />
                )}
              </div>
              <h2 className={`text-xl font-bold mb-2 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Set Center Commission
              </h2>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Enter commission amount for {showCommissionModal.center_name}
              </p>
            </div>

            {/* Commission Input */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Commission Amount
              </label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-lg font-bold ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                }`}>
                  {getCurrencySymbol(showCommissionModal)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={commissionAmount}
                  onChange={(e) => setCommissionAmount(e.target.value)}
                  className={`w-full pl-8 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 ${
                    isDarkMode
                      ? 'bg-white/5 border border-white/20 text-white placeholder-gray-400'
                      : 'bg-white/50 border border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCommissionModal(null)
                  setCommissionAmount('')
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
                onClick={() => handleCenterCommissionUpdate(showCommissionModal)}
                className={`flex-1 font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                    : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white'
                }`}
              >
                <div className="flex items-center justify-center">
                  <Save className="w-5 h-5 mr-2" />
                  Save Commission
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
          </div>
  )
}

export default Centers
