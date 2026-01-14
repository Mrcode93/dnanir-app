import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@money_app:access_token';
const REFRESH_TOKEN_KEY = '@money_app:refresh_token';

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

  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
  }

  /**
   * Get stored access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(TOKEN_KEY);
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
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error storing access token:', error);
    }
  }

  /**
   * Get stored refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
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
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch (error) {
      console.error('Error storing refresh token:', error);
    }
  }

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
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
  private enableLogging: boolean = process.env.NODE_ENV !== 'production' || true; // Always log in dev, can be toggled

  /**
   * Log request details
   */
  private logRequest(method: string, url: string, body?: unknown, headers?: HeadersInit) {
    if (this.enableLogging) {
      console.log('🌐 API Request:', {
        method,
        url,
        body: body ? JSON.stringify(body, null, 2) : undefined,
        headers: headers ? Object.fromEntries(new Headers(headers).entries()) : undefined,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Log response details
   */
  private logResponse(method: string, url: string, response: ApiResponse<unknown>, duration: number) {
    if (this.enableLogging) {
      console.log('✅ API Response:', {
        method,
        url,
        status: response.success ? 'SUCCESS' : 'FAILED',
        data: response.data ? JSON.stringify(response.data, null, 2) : undefined,
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
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
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
        error: apiError.error || 'Request failed',
        message: apiError.message,
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
