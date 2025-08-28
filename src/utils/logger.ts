// Frontend Logger - Captures client-side errors and activities
import { apiService } from '../services/api'

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  category: 'frontend' | 'ui' | 'api' | 'navigation' | 'performance'
  source: string
  message: string
  details?: any
  error?: Error
}

class FrontendLogger {
  private static queue: LogEntry[] = []
  private static isOnline = navigator.onLine
  private static flushInterval: NodeJS.Timeout | null = null

  static init() {
    // Start flush interval
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 5000) // Flush every 5 seconds

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flush()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.error('frontend', 'window.error', 'Unhandled JavaScript error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      }, event.error)
    })

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('frontend', 'unhandledrejection', 'Unhandled promise rejection', {
        reason: event.reason,
        stack: event.reason?.stack
      }, event.reason)
    })

    // Capture React errors (if using error boundary)
    this.setupReactErrorCapture()

    // Log page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        this.logPagePerformance()
      }, 100)
    })

    console.log('Frontend Logger initialized')
  }

  private static setupReactErrorCapture() {
    // Store original console.error
    const originalConsoleError = console.error

    // Override console.error to capture React errors
    console.error = (...args: any[]) => {
      // Check if this looks like a React error
      const errorMessage = args.join(' ')
      if (errorMessage.includes('React') || errorMessage.includes('component')) {
        this.error('ui', 'react.error', 'React component error', {
          arguments: args,
          stack: new Error().stack
        })
      }

      // Call original console.error
      originalConsoleError.apply(console, args)
    }
  }

  private static logPagePerformance() {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')

      this.info('performance', 'page.load', 'Page load performance', {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
        transferSize: navigation.transferSize,
        url: window.location.href
      })
    }
  }

  static log(entry: LogEntry) {
    // Add timestamp and session info
    const enhancedEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId()
    }

    // Console output with styling
    const styles = {
      error: 'color: #ef4444; font-weight: bold',
      warn: 'color: #f59e0b; font-weight: bold',
      info: 'color: #3b82f6; font-weight: bold',
      debug: 'color: #6b7280; font-weight: normal'
    }

    console.log(
      `%c[${entry.level.toUpperCase()}] [${entry.category}] ${entry.source}: ${entry.message}`,
      styles[entry.level]
    )

    if (entry.details) {
      console.log('Details:', entry.details)
    }

    if (entry.error) {
      console.error('Error:', entry.error)
    }

    // Add to queue for server logging
    this.queue.push(enhancedEntry)

    // Flush immediately for errors
    if (entry.level === 'error') {
      this.flush()
    }
  }

  static info(category: LogEntry['category'], source: string, message: string, details?: any) {
    this.log({ level: 'info', category, source, message, details })
  }

  static warn(category: LogEntry['category'], source: string, message: string, details?: any) {
    this.log({ level: 'warn', category, source, message, details })
  }

  static error(category: LogEntry['category'], source: string, message: string, details?: any, error?: Error) {
    this.log({ level: 'error', category, source, message, details, error })
  }

  static debug(category: LogEntry['category'], source: string, message: string, details?: any) {
    this.log({ level: 'debug', category, source, message, details })
  }

  // Specific logging methods for common scenarios
  static logNavigation(from: string, to: string) {
    this.info('navigation', 'router', 'Page navigation', { from, to })
  }

  static logUserAction(action: string, component: string, details?: any) {
    this.info('ui', component, `User action: ${action}`, details)
  }

  static logApiCall(method: string, url: string, duration: number, status: number, success: boolean) {
    this.log({
      level: success ? 'info' : 'warn',
      category: 'api',
      source: `${method} ${url}`,
      message: `API call ${success ? 'completed' : 'failed'} - ${status}`,
      details: { method, url, duration, status, success }
    })
  }

  static logFormSubmission(formName: string, success: boolean, errors?: any) {
    this.log({
      level: success ? 'info' : 'warn',
      category: 'ui',
      source: formName,
      message: `Form submission ${success ? 'successful' : 'failed'}`,
      details: { success, errors }
    })
  }

  private static async flush() {
    if (this.queue.length === 0 || !this.isOnline) {
      return
    }

    const logsToSend = [...this.queue]
    this.queue = []

    try {
      // Send logs to backend
      const token = localStorage.getItem('vertex_token')
      const headers: any = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      await fetch('/api/logs/frontend', {
        method: 'POST',
        headers,
        body: JSON.stringify({ logs: logsToSend })
      })
    } catch (error) {
      // If sending fails, put logs back in queue
      this.queue.unshift(...logsToSend)
      console.warn('Failed to send logs to server:', error)
    }
  }

  private static getSessionId(): string {
    let sessionId = sessionStorage.getItem('frontend-session-id')
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36)
      sessionStorage.setItem('frontend-session-id', sessionId)
    }
    return sessionId
  }

  static cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    // Final flush
    this.flush()
  }
}

export default FrontendLogger
