const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api')

export interface LoginCredentials {
  username: string
  password: string
}

export interface User {
  id: number
  user_id: string
  username: string
  name: string
  firstName?: string
  lastName?: string
  companyName?: string
  photoUrl?: string
  email?: string
  role: 'super_admin' | 'center_admin' | 'agent' | 'qa' | 'client'
  center_id?: number
  center?: {
    center_name: string
    center_code: string
    id: number
  }
}

export interface LoginResponse {
  success: boolean
  token: string
  user: User
  firstLogin?: boolean
  error?: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiService {
  private refreshPromise: Promise<boolean> | null = null
  
  // Clean up any stale tokens or refresh promises
  public cleanup() {
    this.refreshPromise = null
    const token = localStorage.getItem('vertex_token')
    if (token && this.isTokenExpired(token)) {
      localStorage.removeItem('vertex_token')
    }
  }
  
  private getAuthHeaders() {
    const token = localStorage.getItem('vertex_token')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  }

  // Check if token is expired
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      return payload.exp < currentTime
    } catch {
      return true
    }
  }

  // Check if token will expire soon (within 30 minutes)
  private isTokenExpiringSoon(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Date.now() / 1000
      const thirtyMinutes = 30 * 60
      return payload.exp < (currentTime + thirtyMinutes)
    } catch {
      return true
    }
  }

  // Refresh token automatically with race condition prevention
  private async refreshToken(): Promise<boolean> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.doRefreshToken()
    try {
      const result = await this.refreshPromise
      return result
    } finally {
      this.refreshPromise = null
    }
  }

  private async doRefreshToken(): Promise<boolean> {
    try {
      const currentToken = localStorage.getItem('vertex_token')
      if (!currentToken) return false

      // Double check if token is still valid before refreshing
      if (this.isTokenExpired(currentToken)) {
        localStorage.removeItem('vertex_token')
        return false
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.token) {
          localStorage.setItem('vertex_token', data.token)
          return true
        }
      }
      
      // If refresh failed, remove the token
      localStorage.removeItem('vertex_token')
      return false
    } catch {
      localStorage.removeItem('vertex_token')
      return false
    }
  }

  // Enhanced fetch with auto token management
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('vertex_token')
    
    // Skip token management if no token exists
    if (!token) {
      throw new Error('No authentication token available')
    }
    
    // Check if token is expired first
    if (this.isTokenExpired(token)) {
      localStorage.removeItem('vertex_token')
      throw new Error('Token expired')
    }
    
    // Check if we need to refresh token (only if not expired)
    if (this.isTokenExpiringSoon(token)) {
      const refreshed = await this.refreshToken()
      if (!refreshed) {
        throw new Error('Failed to refresh token')
      }
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers || {})
      }
    })

    // Handle 401 responses (but don't redirect automatically)
    if (response.status === 401) {
      localStorage.removeItem('vertex_token')
      throw new Error('Unauthorized - token may be invalid')
    }

    return response
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    // Clean up any stale state before attempting login
    this.cleanup()
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    })

    const data = await response.json()
    
    if (data.success && data.token) {
      localStorage.setItem('vertex_token', data.token)
    }
    
    return data
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const token = localStorage.getItem('vertex_token')
      if (!token) return null

      // Check if token is expired before making the request
      if (this.isTokenExpired(token)) {
        localStorage.removeItem('vertex_token')
        return null
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        return data.user
      } else if (response.status === 401) {
        // Token is invalid, clear it
        localStorage.removeItem('vertex_token')
        return null
      }
      
      return null
    } catch (error) {
      console.error('Failed to get current user:', error)
      // Don't clear token on network errors, only on auth errors
      return null
    }
  }

  async logout(): Promise<void> {
    try {
      const token = localStorage.getItem('vertex_token')
      if (token) {
        // Only attempt server logout if we have a token
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders()
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Continue with local cleanup even if server logout fails
    } finally {
      // Always cleanup local state
      localStorage.removeItem('vertex_token')
      // Reset any ongoing refresh attempts
      this.refreshPromise = null
    }
  }

  async getDashboardStats(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/analytics/dashboard`, {
      headers: this.getAuthHeaders()
    })

    if (response.ok) {
      return response.json()
    }
    
    throw new Error('Failed to fetch dashboard stats')
  }

  async getLeads(limit?: number): Promise<any[]> {
    const url = limit ? `${API_BASE_URL}/leads?limit=${limit}` : `${API_BASE_URL}/leads`
    const response = await fetch(url, {
      headers: this.getAuthHeaders()
    })

    if (response.ok) {
      return response.json()
    }
    
    throw new Error('Failed to fetch leads')
  }

  // Generic GET method for API calls
  async get(endpoint: string): Promise<ApiResponse> {
    try {
      // Remove /api prefix from endpoint if it exists since API_BASE_URL already includes it
      const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.substring(4) : endpoint
      const url = cleanEndpoint.startsWith('/') ? `${API_BASE_URL}${cleanEndpoint}` : `${API_BASE_URL}/${cleanEndpoint}`
      const response = await this.fetchWithAuth(url, {
        method: 'GET'
      })

      if (response.ok) {
        return await response.json()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { success: false, error: errorData.error || `HTTP ${response.status}` }
      }
    } catch (error) {
      console.error('GET request failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }

  // Generic POST method for API calls
  async post(endpoint: string, data?: any): Promise<ApiResponse> {
    try {
      const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.substring(4) : endpoint
      const url = cleanEndpoint.startsWith('/') ? `${API_BASE_URL}${cleanEndpoint}` : `${API_BASE_URL}/${cleanEndpoint}`
      const response = await this.fetchWithAuth(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
      })

      if (response.ok) {
        return await response.json()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { success: false, error: errorData.error || `HTTP ${response.status}` }
      }
    } catch (error) {
      console.error('POST request failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }

  // Generic PUT method for API calls
  async put(endpoint: string, data?: any): Promise<ApiResponse> {
    try {
      const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.substring(4) : endpoint
      const url = cleanEndpoint.startsWith('/') ? `${API_BASE_URL}${cleanEndpoint}` : `${API_BASE_URL}/${cleanEndpoint}`
      const response = await this.fetchWithAuth(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
      })

      if (response.ok) {
        return await response.json()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { success: false, error: errorData.error || `HTTP ${response.status}` }
      }
    } catch (error) {
      console.error('PUT request failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }

  // Generic DELETE method for API calls
  async delete(endpoint: string): Promise<ApiResponse> {
    try {
      const cleanEndpoint = endpoint.startsWith('/api/') ? endpoint.substring(4) : endpoint
      const url = cleanEndpoint.startsWith('/') ? `${API_BASE_URL}${cleanEndpoint}` : `${API_BASE_URL}/${cleanEndpoint}`
      const response = await this.fetchWithAuth(url, {
        method: 'DELETE'
      })

      if (response.ok) {
        return await response.json()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { success: false, error: errorData.error || `HTTP ${response.status}` }
      }
    } catch (error) {
      console.error('DELETE request failed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Network error' }
    }
  }
}

export const apiService = new ApiService()

