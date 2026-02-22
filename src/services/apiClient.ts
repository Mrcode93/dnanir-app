import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { authStorage } from './authStorage';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  errors?: Array<{ msg: string; param: string }>;
}

/**
 * API Client for making HTTP requests to the server
 */
class ApiClient {
  private baseURL: string;
  private isRefreshing: boolean = false;

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
  }

  /**
   * Get stored access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await authStorage.getAccessToken();
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Store access token
   */
  async setAccessToken(token: string): Promise<void> {
    try {
      await authStorage.setAccessToken(token);
    } catch (error) {
      console.error('Error storing access token:', error);
    }
  }

  /**
   * Get stored refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await authStorage.getRefreshToken();
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  /**
   * Store refresh token
   */
  async setRefreshToken(token: string): Promise<void> {
    try {
      await authStorage.setRefreshToken(token);
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await authStorage.clearTokens();
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  /**
   * Build full URL
   */
  private buildURL(endpoint: string): string {
    return `${this.baseURL}${endpoint}`;
  }

  /**
   * Enable/disable request logging
   */
  private enableLogging: boolean = API_CONFIG.ENABLE_LOGGING;

  private isSensitiveKey(key: string): boolean {
    return /password|token|authorization|secret/i.test(key);
  }

  private maskSensitive(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.maskSensitive(item));
    }

    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        if (this.isSensitiveKey(key)) {
          result[key] = '***';
        } else {
          result[key] = this.maskSensitive(nestedValue);
        }
      }
      return result;
    }

    return value;
  }

  private sanitizeHeaders(headers?: HeadersInit): Record<string, string> | undefined {
    if (!headers) return undefined;
    const result: Record<string, string> = {};
    const normalized = new Headers(headers);
    normalized.forEach((value, key) => {
      if (key.toLowerCase() === 'authorization') {
        result[key] = 'Bearer ***';
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  private sanitizeBody(body?: unknown): unknown {
    if (!body) return undefined;
    return this.maskSensitive(body);
  }

  /**
   * Log request details
   */
  private logRequest(method: string, url: string, body?: unknown, headers?: HeadersInit) {
    if (this.enableLogging) {
      const safeBody = this.sanitizeBody(body);
      const safeHeaders = this.sanitizeHeaders(headers);
      console.log('🌐 API Request:', {
        method,
        url,
        body: safeBody ? JSON.stringify(safeBody, null, 2) : undefined,
        headers: safeHeaders,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log response details
   */
  private logResponse(method: string, url: string, response: ApiResponse<unknown>, duration: number) {
    if (this.enableLogging) {
      const safeData = response.data ? this.sanitizeBody(response.data) : undefined;
      console.log('✅ API Response:', {
        method,
        url,
        status: response.success ? 'SUCCESS' : 'FAILED',
        data: safeData ? JSON.stringify(safeData, null, 2) : undefined,
        error: response.error,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Build request headers
   */
  private async buildHeaders(includeAuth: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (includeAuth) {
      const token = await this.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T> & { statusCode?: number }> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let data: unknown;
    try {
      data = isJson ? await response.json() : await response.text();
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse response',
      };
    }

    if (!response.ok) {
      const apiError: ApiError = isJson && typeof data === 'object' && data !== null
        ? (data as ApiError)
        : { error: typeof data === 'string' ? data : 'Unknown error' };
      return {
        success: false,
        error: apiError.error || apiError.message || 'Request failed',
        message: apiError.message,
        statusCode: response.status,
      };
    }

    return {
      success: true,
      data: isJson ? (data as T) : undefined,
      message: typeof data === 'object' && data !== null && 'message' in data
        ? (data as { message?: string }).message
        : undefined,
    };
  }

  /**
   * Try to refresh the access token using the stored refresh token.
   * Returns true on success, false on failure.
   */
  private async tryRefreshToken(): Promise<boolean> {
    if (this.isRefreshing) return false;
    this.isRefreshing = true;

    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) return false;

      const url = this.buildURL(API_ENDPOINTS.AUTH.REFRESH_TOKEN);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh failed — clear auth
        await authStorage.clearAuthData();
        return false;
      }

      const data = await response.json();
      if (data.tokens) {
        await this.setAccessToken(data.tokens.accessToken);
        await this.setRefreshToken(data.tokens.refreshToken);
        if (data.user) {
          await authStorage.setUser(data.user);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Create abort controller with timeout
   */
  private createAbortControllerWithCleanup(timeout?: number): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    const timeoutMs = timeout || API_CONFIG.TIMEOUT;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const cleanup = () => clearTimeout(timeoutId);
    return { controller, cleanup };
  }

  /**
   * Make GET request
   */
  async get<T>(endpoint: string, includeAuth: boolean = true): Promise<ApiResponse<T>> {
    const { controller, cleanup } = this.createAbortControllerWithCleanup();
    const startTime = Date.now();
    try {
      const url = this.buildURL(endpoint);
      const headers = await this.buildHeaders(includeAuth);

      this.logRequest('GET', url, undefined, headers);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      cleanup();

      // Auto-refresh on 401
      if (response.status === 401 && includeAuth && !this.isRefreshing) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Retry with new token
          return this.get<T>(endpoint, includeAuth);
        }
      }

      const result = await this.handleResponse<T>(response);
      const duration = Date.now() - startTime;
      this.logResponse('GET', url, result, duration);
      return result;
    } catch (error: unknown) {
      cleanup();
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      const errorName = error instanceof Error ? error.name : '';
      console.error('❌ GET request error:', {
        endpoint,
        error: errorMessage,
        duration: `${duration}ms`,
      });
      if (errorName === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Make POST request
   */
  async post<T>(
    endpoint: string,
    body: unknown,
    includeAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    // Use longer timeout for OCR requests
    const isOCRRequest = endpoint.includes('/receipt-ocr');
    const timeout = isOCRRequest ? API_CONFIG.OCR_TIMEOUT : undefined;
    const { controller, cleanup } = this.createAbortControllerWithCleanup(timeout);
    const startTime = Date.now();
    try {
      const url = this.buildURL(endpoint);
      const headers = await this.buildHeaders(includeAuth);

      this.logRequest('POST', url, body, headers);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      cleanup();

      // Auto-refresh on 401 (skip for refresh-token endpoint itself)
      if (response.status === 401 && includeAuth && !this.isRefreshing && !endpoint.includes('refresh-token')) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          return this.post<T>(endpoint, body, includeAuth);
        }
      }

      const result = await this.handleResponse<T>(response);
      const duration = Date.now() - startTime;
      this.logResponse('POST', url, result, duration);
      return result;
    } catch (error: unknown) {
      cleanup();
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      const errorName = error instanceof Error ? error.name : '';
      console.error('❌ POST request error:', {
        endpoint,
        error: errorMessage,
        duration: `${duration}ms`,
      });
      if (errorName === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Make PUT request
   */
  async put<T>(
    endpoint: string,
    body: unknown,
    includeAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    const { controller, cleanup } = this.createAbortControllerWithCleanup();
    try {
      const url = this.buildURL(endpoint);
      const headers = await this.buildHeaders(includeAuth);

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      cleanup();
      return await this.handleResponse<T>(response);
    } catch (error: unknown) {
      cleanup();
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      const errorName = error instanceof Error ? error.name : '';
      console.error('PUT request error:', error);
      if (errorName === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Make DELETE request
   */
  async delete<T>(endpoint: string, includeAuth: boolean = true): Promise<ApiResponse<T>> {
    const { controller, cleanup } = this.createAbortControllerWithCleanup();
    try {
      const url = this.buildURL(endpoint);
      const headers = await this.buildHeaders(includeAuth);

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });

      cleanup();
      return await this.handleResponse<T>(response);
    } catch (error: unknown) {
      cleanup();
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      const errorName = error instanceof Error ? error.name : '';
      console.error('DELETE request error:', error);
      if (errorName === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
        };
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if server is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get(API_ENDPOINTS.HEALTH, false);
      return response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current API configuration (for debugging)
   */
  getConfig() {
    return {
      baseURL: this.baseURL,
      timeout: API_CONFIG.TIMEOUT,
    };
  }

  /**
   * Test API connection with detailed logging
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: {
      baseURL: string;
      healthCheck?: string;
      authenticated?: boolean;
      hasToken?: boolean;
      error?: string;
    };
  }> {
    console.log('🧪 Testing API Connection...');
    console.log('📍 API Base URL:', this.baseURL);

    try {
      // Test 1: Health check
      console.log('1️⃣ Testing health endpoint...');
      const healthResult = await this.healthCheck();

      if (!healthResult) {
        return {
          success: false,
          message: 'Server health check failed',
          details: {
            baseURL: this.baseURL,
            healthCheck: 'FAILED',
          },
        };
      }

      console.log('✅ Health check passed');

      // Test 2: Check authentication status
      console.log('2️⃣ Checking authentication...');
      const token = await this.getAccessToken();
      const isAuth = !!token;
      console.log('Auth status:', isAuth ? '✅ Authenticated' : '❌ Not authenticated');

      return {
        success: true,
        message: 'API connection successful',
        details: {
          baseURL: this.baseURL,
          healthCheck: 'OK',
          authenticated: isAuth,
          hasToken: !!token,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      const errorString = error instanceof Error ? error.toString() : String(error);
      console.error('❌ Connection test failed:', error);
      return {
        success: false,
        message: errorMessage,
        details: {
          baseURL: this.baseURL,
          error: errorString,
        },
      };
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
