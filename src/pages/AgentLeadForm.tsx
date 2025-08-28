import React, { useState, useEffect } from 'react'
import { 
  FileText
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { apiService } from '../services/api'

const AgentLeadForm = () => {
  const { user, isDarkMode, setIsDarkMode, isLoading: authLoading } = useAuth()
  const [forms, setForms] = useState<any[]>([])
  const [selectedForm, setSelectedForm] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | React.ReactNode>('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [phoneVerification, setPhoneVerification] = useState<{
    status: 'idle' | 'checking' | 'approved' | 'rejected' | 'duplicate' | 'suppressed'
    message: string
    details?: any
  }>({ status: 'idle', message: '' })
  const [zipcodeValidation, setZipcodeValidation] = useState<{
    status: 'idle' | 'checking' | 'serviceable' | 'unserviceable'
    message: string
    zipcode?: string
  }>({ status: 'idle', message: '' })
  const [zipcodeValue, setZipcodeValue] = useState('')

  // Simple, reliable effect that waits for auth to complete
  useEffect(() => {
    if (!authLoading && user) {
      console.log('Auth completed, user loaded:', user)
      console.log('All user properties:', Object.keys(user))
      console.log('user.center_id:', user.center_id)
      console.log('user.centerId:', user.centerId)
      console.log('user.center:', user.center)
      
      const centerId = user.center_id || user.centerId || user.center?.id
      if (centerId) {
        console.log('Found center ID:', centerId)
        fetchCenterForms()
      } else {
        console.log('No center ID found in any property, setting loading to false')
        setLoading(false)
      }
    }
  }, [authLoading, user])

  // ZIP code validation effect
  useEffect(() => {
    if (zipcodeValue && zipcodeValue.length >= 5 && selectedForm?.campaign_id) {
      const timeoutId = setTimeout(() => {
        validateZipcode(zipcodeValue)
      }, 500) // 0.5 second delay
      
      return () => clearTimeout(timeoutId)
    } else {
      setZipcodeValidation({ status: 'idle', message: '' })
    }
  }, [zipcodeValue, selectedForm?.campaign_id])

  // Fallback retry mechanism
  useEffect(() => {
    if (!authLoading && user && forms.length === 0 && !loading) {
      console.log('Setting up fallback retry...')
      const timer = setTimeout(() => {
        const centerId = user.center_id || user.centerId || user.center?.id
        if (centerId) {
          console.log('Fallback retry executing...')
          fetchCenterForms()
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [authLoading, user, forms.length, loading])

  // Auto-redirect effect (same as public form)
  useEffect(() => {
    if (countdown && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && redirectUrl) {
      window.location.href = redirectUrl
    }
  }, [countdown, redirectUrl])

  const fetchCenterForms = async () => {
    const centerId = user?.center_id || user?.centerId || user?.center?.id
    if (!centerId) {
      console.log('No center_id found for user in fetchCenterForms')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('Fetching forms for center:', centerId)
      
      // Get campaigns assigned to this center using the center-specific endpoint
      const campaignsResponse = await apiService.get(`/centers/${centerId}/campaigns`)
      if (!campaignsResponse.success || !campaignsResponse.data) {
        console.log('No campaigns found for this center')
        setLoading(false)
        return
      }

      const centerCampaigns = campaignsResponse.data
      console.log('Center campaigns:', centerCampaigns)

      if (centerCampaigns.length === 0) {
        console.log('No campaigns assigned to this center')
        setLoading(false)
        return
      }

      // Get campaign IDs
      const campaignIds = centerCampaigns.map((campaign: any) => campaign.campaign_id)

      // Now fetch forms for these campaigns
      const formsResponse = await apiService.get('/forms')
      if (formsResponse.success && formsResponse.data) {
        // Filter forms that belong to campaigns assigned to this center
        const centerForms = formsResponse.data.filter((form: any) => {
          return campaignIds.includes(form.campaign_id)
        })

        console.log('Center forms found:', centerForms)
        setForms(centerForms)
        
        if (centerForms.length > 0) {
          setSelectedForm(centerForms[0])
          initializeFormData(centerForms[0])
        }
      }
      setLoading(false)
    } catch (error) {
      console.error('Error fetching forms for center:', error)
      setLoading(false)
    }
  }

  const initializeFormData = (form: any) => {
    if (!form || !form.form_fields || !Array.isArray(form.form_fields)) return
    
    const initialData: any = {}
    form.form_fields.forEach((field: any) => {
      initialData[field.name] = ''
    })
    setFormData(initialData)
  }

  const handleFormSelect = (form: any) => {
    setSelectedForm(form)
    initializeFormData(form)
    setSubmitMessage('')
  }

  const handleInputChange = (fieldName: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }))
    
    // Trigger phone verification when phone field reaches 10 digits
    if (fieldName === 'phone' && typeof value === 'string') {
      const cleanPhone = value.replace(/\D/g, '')
      if (cleanPhone.length === 10) {
        verifyPhone(cleanPhone)
      } else if (cleanPhone.length < 10) {
        setPhoneVerification({ status: 'idle', message: '' })
      }
    }
  }

  const verifyPhone = async (phone: string) => {
    console.log('Starting phone verification for:', phone)
    setPhoneVerification({ status: 'checking', message: '🔍 Checking phone number...' })
    
    if (!selectedForm?.campaign_id) {
      console.log('Campaign not selected, rejecting')
      setPhoneVerification({
        status: 'rejected',
        message: '❌ Campaign not selected'
      })
      return
    }
    
    try {
      const response = await fetch('/api/phone/pre-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({ 
          phone,
          campaignId: selectedForm.campaign_id 
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.log('API Error Response:', errorData)
        setPhoneVerification({
          status: 'rejected',
          message: errorData.error || `❌ API Error: ${response.status}`,
          details: errorData
        })
        return
      }

      const data = await response.json()
      console.log('Phone verification response:', data)
      
      if (data.success) {
        console.log('Phone approved')
        setPhoneVerification({
          status: 'approved',
          message: '✅ PHONE APPROVED - Ready to proceed!',
          details: data.details
        })
      } else {
        let status: 'duplicate' | 'rejected' | 'suppressed' = 'rejected'
        if (data.status === 'duplicate') status = 'duplicate'
        else if (data.status === 'suppressed') status = 'suppressed'
        
        console.log('Phone verification failed:', status, data.message)
        setPhoneVerification({
          status: status,
          message: data.message || data.error || '❌ Phone verification failed',
          details: data.details
        })
      }
    } catch (error) {
      console.error('Phone verification error:', error)
      setPhoneVerification({
        status: 'rejected',
        message: '❌ Verification failed - Please try again'
      })
    }
  }

  const validateZipcode = async (zipcode: string) => {
    setZipcodeValidation({ status: 'checking', message: '🔍 Checking ZIP code...' })
    
    if (!selectedForm?.campaign_id) {
      setZipcodeValidation({
        status: 'unserviceable',
        message: '❌ Campaign not selected'
      })
      return
    }
    
    try {
      const response = await fetch(`/api/campaigns/${selectedForm.campaign_id}/check-zipcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`
        },
        body: JSON.stringify({ zipcode })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setZipcodeValidation({
          status: data.data.serviceable ? 'serviceable' : 'unserviceable',
          message: data.data.serviceable ? '✅ ZIP Code Serviceable' : '❌ ZIP Code Unserviceable',
          zipcode: data.data.zipcode
        })
      } else {
        setZipcodeValidation({
          status: 'unserviceable',
          message: '❌ Validation failed'
        })
      }
    } catch (error) {
      console.error('ZIP code validation error:', error)
      setZipcodeValidation({
        status: 'unserviceable',
        message: '❌ Validation failed - Please try again'
      })
    }
  }

  // Function to check if form is ready for submission
  const isFormReadyForSubmission = () => {
    // Check if phone verification is approved (if phone field exists)
    const phoneField = selectedForm?.form_fields?.find((field: any) => field.type === 'phone')
    if (phoneField && formData.phone && phoneVerification.status !== 'approved') {
      return false
    }

    // Check if ZIP code validation is serviceable (for Vivint campaigns)
    if (selectedForm?.campaign_name?.toLowerCase().includes('vivint') && zipcodeValue) {
      if (zipcodeValidation.status !== 'serviceable') {
        return false
      }
    }

    // Check if required checkbox fields are checked
    const checkboxFields = selectedForm?.form_fields?.filter((field: any) => field.type === 'checkbox' && field.required)
    if (checkboxFields && checkboxFields.length > 0) {
      for (const field of checkboxFields) {
        if (!formData[field.name]) {
          return false
        }
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedForm || !user) return
    
    // Check if form is ready for submission
    if (!isFormReadyForSubmission()) {
      setSubmitMessage('❌ Please complete all required validations before submitting.')
      return
    }

    setIsSubmitting(true)
    setSubmitMessage('')

    try {
      const submitData = {
        ...formData,
        zipcode: zipcodeValue, // Add ZIP code to submission
        center_code: user.center?.center_code || 'AGENT'
      }

      
      const response = await fetch(`/api/forms/submit/${selectedForm.slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('vertex_token')}`,
        },
        body: JSON.stringify(submitData)
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        setSubmitMessage('Lead submitted successfully!')
        initializeFormData(selectedForm) // Reset form
        
        // If there's a redirect URL (autofill URL), set up auto-redirect
        if (data.redirect_url) {
          const delay = 1 // Fast redirect for agents (1 second)
          setRedirectUrl(data.redirect_url)
          setCountdown(delay)
          setSubmitMessage(`Lead submitted successfully! Redirecting to client form in ${delay} second...`)
        } else {
          setSubmitMessage('Lead submitted successfully!')
        }
      } else {
        setSubmitMessage(data.message || data.error || 'Error submitting lead. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      setSubmitMessage('Error submitting lead. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderFormField = (field: any) => {
    const baseClasses = `w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
      isDarkMode
        ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
        : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
    } focus:outline-none focus:ring-2 focus:ring-orange-500/20`

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <input
            key={field.name}
            type={field.type}
            value={formData[field.name] || ''}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder || field.label}
            required={field.required}
            className={`${baseClasses} text-gray-900 placeholder-gray-500`}
          />
        )
      case 'phone':
        return (
          <div key={field.name} className="space-y-2">
            <input
              type={field.type}
              value={formData[field.name] || ''}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder || field.label}
              required={field.required}
              className={`${baseClasses} text-gray-900 placeholder-gray-500`}
            />
            {phoneVerification.status === 'duplicate' && (
              <div className="text-sm text-red-600 mt-1">
                ❌ Already a customer
              </div>
            )}
            {phoneVerification.status === 'approved' && (
              <div className="text-sm text-green-600 mt-1">
                ✅ Phone approved
              </div>
            )}
          </div>
        )
      case 'textarea':
        return (
          <textarea
            key={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.placeholder || field.label}
            required={field.required}
            rows={4}
            className={`${baseClasses} text-gray-900 placeholder-gray-500 resize-vertical`}
          />
        )
      case 'select':
        return (
          <select
            key={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            className={`${baseClasses} text-gray-900`}
            title={`Select ${field.label}`}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map((option: string, index: number) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      case 'checkbox':
        return (
          <div key={field.name} className="flex items-start space-x-3">
            <input
              type="checkbox"
              id={field.name}
              checked={formData[field.name] || false}
              onChange={(e) => handleInputChange(field.name, e.target.checked)}
              required={field.required}
              className={`mt-1 w-4 h-4 rounded border transition-colors duration-200 ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-orange-500 focus:ring-orange-500/20'
                  : 'bg-white border-gray-300 text-orange-600 focus:ring-orange-500/20'
              } focus:ring-2`}
            />
            <label 
              htmlFor={field.name} 
              className={`text-sm leading-relaxed cursor-pointer ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
          </div>
        )
      default:
        return null
    }
  }

  const renderLeadForm = () => {
    if (loading) {
      return (
        <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium mb-2">Loading Forms...</h3>
          <p>Please wait while we fetch your assigned lead forms.</p>
        </div>
      )
    }

    if (forms.length === 0) {
      return (
        <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Forms Available</h3>
          <p>No lead forms are currently assigned to your center.</p>
          <button 
            onClick={() => {
              setLoading(true)
              fetchCenterForms()
            }}
            className={`mt-4 px-4 py-2 rounded-lg text-sm ${
              isDarkMode 
                ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }`}
          >
            Retry Loading Forms
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Form Selector */}
        {forms.length > 1 && (
          <div className="max-w-2xl mx-auto mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Select Form
            </label>
            <select
              value={selectedForm?.id || ''}
              onChange={(e) => {
                const form = forms.find(f => f.id === parseInt(e.target.value))
                if (form) handleFormSelect(form)
              }}
              className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white focus:border-orange-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-orange-500'
              } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
              title="Select Form"
            >
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Selected Form */}
        {selectedForm && (
          <div className={`max-w-2xl mx-auto rounded-xl border p-6 ${
            isDarkMode 
              ? 'bg-gray-800/50 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className="mb-6">
              {/* Campaign Logo and Title */}
              <div className="flex items-center space-x-4 mb-4">
                {selectedForm.campaign_photo && (
                  <img 
                    src={selectedForm.campaign_photo} 
                    alt="Campaign Logo"
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1">
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedForm.name}
                  </h2>
                  {selectedForm.description && (
                    <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedForm.description}
                    </p>
                  )}
                </div>
                
                {/* Transfer Number Info */}
                {selectedForm.transfer_number && (
                  <div className={`px-4 py-2 rounded-lg ${
                    isDarkMode ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <div className={`text-xs font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                      Transfer Number
                    </div>
                    <div className={`text-sm font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                      {selectedForm.transfer_number}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {selectedForm.form_fields && Array.isArray(selectedForm.form_fields) ? (
                selectedForm.form_fields.map((field: any, index: number) => (
                  <div key={index}>
                    {field.type !== 'checkbox' && (
                      <label className={`block text-sm font-medium mb-1 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                    )}
                    {renderFormField(field)}
                    
                    {/* ZIP Code Validation Field - Show after Phone Number field */}
                    {field.type === 'phone' && selectedForm && (
                      <div className="mt-4">
                        <label className={`block text-sm font-medium mb-1 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Service Area ZIP Code
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={zipcodeValue}
                            onChange={(e) => setZipcodeValue(e.target.value)}
                            placeholder="Enter 5-digit ZIP code (e.g., 12345)"
                            required
                            maxLength={10}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-200 ${
                              zipcodeValidation.status === 'serviceable' ? 'border-green-500 bg-green-50 text-gray-900' :
                              zipcodeValidation.status === 'unserviceable' ? 'border-red-500 bg-red-50 text-gray-900' :
                              zipcodeValidation.status === 'checking' ? 'border-orange-500 bg-orange-50 text-gray-900' :
                              isDarkMode
                                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                            }`}
                          />
                          {zipcodeValidation.status !== 'idle' && (
                            <div className={`text-sm p-3 rounded-lg font-medium ${
                              zipcodeValidation.status === 'serviceable' ? 'bg-green-100 text-green-800 border border-green-200' :
                              zipcodeValidation.status === 'unserviceable' ? 'bg-red-100 text-red-800 border border-red-200' :
                              zipcodeValidation.status === 'checking' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                              ''
                            }`}>
                              {zipcodeValidation.message}
                            </div>
                          )}
                          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            Enter at least 5 digits to check service availability. This field will be saved for our records only.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className={`text-center py-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  No form fields available
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormReadyForSubmission()}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    isSubmitting || !isFormReadyForSubmission()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : isDarkMode
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                  } focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
                >
                  {isSubmitting ? 'Submitting...' : 
                   formData.phone && phoneVerification.status === 'checking' ? 'Verifying Phone...' :
                   formData.phone && phoneVerification.status !== 'approved' && phoneVerification.status !== 'idle' ? 'Phone Verification Failed' :
                   selectedForm?.campaign_name?.toLowerCase().includes('vivint') && zipcodeValue && zipcodeValidation.status === 'checking' ? 'Validating ZIP Code...' :
                   !isFormReadyForSubmission() ? 'Complete Required Fields' :
                   'Submit Lead'}
                </button>
              </div>

              {/* Submit Message */}
              {submitMessage && (
                <div className={`text-center ${
                  (typeof submitMessage === 'string' && submitMessage.includes('successfully')) 
                    ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                    : (isDarkMode ? 'text-red-400' : 'text-red-600')
                }`}>
                  <div className="text-sm">
                    {submitMessage}
                  </div>
                  {countdown && countdown > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className={`text-2xl font-bold ${
                        isDarkMode ? 'text-orange-400' : 'text-orange-600'
                      }`}>
                        {countdown}
                      </div>
                      {redirectUrl && (
                        <div className="text-xs text-gray-500">
                          <a 
                            href={redirectUrl}
                            className={`${isDarkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-700'} underline`}
                          >
                            Click here if not redirected automatically
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        )}
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
        activeItem="lead-form"
        userRole="agent"
      />
      
      {/* Main Content */}
      <div className="ml-20 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Lead Form
            </h1>
            <p className={`text-lg mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Submit leads for your assigned campaigns
            </p>
          </div>

          {/* Current Offer Banner */}
          <div className={`mb-6 rounded-xl border-2 p-4 ${
            isDarkMode 
              ? 'bg-gradient-to-r from-orange-900/20 to-amber-900/20 border-orange-500/30' 
              : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-400'
          }`}>
            <div className="flex items-center space-x-4">
              {/* Gift/Offer Icon */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <svg className={`w-6 h-6 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              
              {/* Offer Text */}
              <div className="flex-1">
                <h3 className={`text-lg font-bold ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-700'
                }`}>
                  🎁 Current Offer for Customers
                </h3>
                <p className={`text-sm mt-1 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  <span className="font-semibold">Get Four FREE Months of Monitoring + FREE Installation*</span>
                  <br />
                  <span className="text-xs opacity-75">*with system purchase | Call with code: 4FREE</span>
                </p>
              </div>
              
              {/* Use Code Button */}
              <div className="flex-shrink-0">
                <div className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                  isDarkMode 
                    ? 'bg-orange-600 text-white' 
                    : 'bg-orange-600 text-white'
                } shadow-lg`}>
                  Use Code: 4FREE
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          {renderLeadForm()}
        </div>
      </div>
    </div>
  )
}

export default AgentLeadForm
