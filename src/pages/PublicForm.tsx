import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

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
  campaign_name: string
  campaign_photo: string
  description: string
  form_fields: FormField[]
  success_message: string
  redirect_delay: number
}

interface Center {
  id: number
  name: string
  code: string
}

const PublicForm: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const centerCode = searchParams.get('center')

  const [form, setForm] = useState<LeadForm | null>(null)
  const [center, setCenter] = useState<Center | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)

  const [formData, setFormData] = useState<{[key: string]: string}>({})

  useEffect(() => {
    fetchForm()
  }, [slug, centerCode])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && redirectUrl) {
      window.location.href = redirectUrl
    }
  }, [countdown, redirectUrl])

  const fetchForm = async () => {
    try {
      setLoading(true)
      const centerParam = centerCode ? `?center=${centerCode}` : ''
      const response = await fetch(`/api/forms/public/${slug}${centerParam}`)
      const data = await response.json()
      
      if (data.success) {
        setForm(data.data)
        if (data.data.center) {
          setCenter(data.data.center)
        }
        
        // Initialize form data
        const initialData: {[key: string]: string} = {}
        data.data.form_fields.forEach((field: FormField) => {
          initialData[field.name] = ''
        })
        setFormData(initialData)
      } else {
        setError(data.error || 'Form not found')
      }
    } catch (err) {
      setError('Failed to load form')
      console.error('Error fetching form:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!centerCode) {
      setError('Invalid center code')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/forms/submit/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          center_code: centerCode
        })
      })

      const data = await response.json()

      if (data.success) {
        setSubmitted(true)
        if (data.redirect_url) {
          setRedirectUrl(data.redirect_url)
          setCountdown(form?.redirect_delay || 3)
        }
      } else {
        setError(data.message || 'Submission failed')
      }
    } catch (err) {
      setError('Failed to submit form')
      console.error('Error submitting form:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 p-6 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Form not found</h1>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 p-6 bg-white rounded-lg shadow-lg">
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Thank You!</h1>
            <p className="text-gray-600 mb-6">{form.success_message}</p>
            
            {redirectUrl && countdown > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-sm">
                  Redirecting to {form.campaign_name} in {countdown} seconds...
                </p>
                <div className="mt-2">
                  <a 
                    href={redirectUrl}
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Click here if not redirected automatically
                  </a>
                </div>
              </div>
            )}
            
            {center && (
              <div className="mt-4 text-xs text-gray-500">
                Submitted via {center.name} ({center.code})
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="text-center mb-6">
            {form.campaign_photo && (
              <img 
                src={form.campaign_photo} 
                alt={form.campaign_name}
                className="w-16 h-16 mx-auto mb-4 rounded-lg object-cover"
              />
            )}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {form.name}
            </h1>
            {form.description && (
              <p className="text-gray-600 text-sm">
                {form.description}
              </p>
            )}
            <div className="text-xs text-gray-500 mt-2">
              {form.campaign_name}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {form.form_fields.map((field) => (
              <div key={field.id}>
                {field.type !== 'checkbox' && (
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                )}
                
                {field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    required={field.required}
                    title={field.label}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                  >
                    <option value="">Select an option</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id={field.name}
                      checked={Boolean(formData[field.name])}
                      onChange={(e) => handleInputChange(field.name, String(e.target.checked))}
                      required={field.required}
                      className="mt-1 w-4 h-4 text-orange-600 bg-white border-gray-300 rounded focus:ring-orange-500 focus:ring-2"
                    />
                    <label 
                      htmlFor={field.name} 
                      className="text-sm leading-relaxed text-gray-700 cursor-pointer"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  </div>
                ) : (
                  <input
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                  />
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>

          {center && (
            <div className="mt-6 text-center text-xs text-gray-500">
              Powered by {center.name} • Secured by Vertex CRM
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PublicForm
