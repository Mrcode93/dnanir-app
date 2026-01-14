import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';

export interface RegisterRequest {
  phone: string;
  password: string;
  name?: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    phone: string;
    name?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Authentication API Service
 */
export const authApiService = {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<{ success: boolean; user?: AuthResponse['user']; error?: string }> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      data,
      false // No auth required for registration
    );

    if (response.success && response.data) {
      // Store tokens
      await apiClient.setAccessToken(response.data.tokens.accessToken);
      await apiClient.setRefreshToken(response.data.tokens.refreshToken);

      return {
        success: true,
        user: response.data.user,
      };
    }

    return {
      success: false,
      error: response.error || 'Registration failed',
    };
  },

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<{ success: boolean; user?: AuthResponse['user']; error?: string }> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      data,
      false // No auth required for login
    );

    if (response.success && response.data) {
      // Store tokens
      await apiClient.setAccessToken(response.data.tokens.accessToken);
      await apiClient.setRefreshToken(response.data.tokens.refreshToken);

      return {
        success: true,
        user: response.data.user,
      };
    }

    return {
      success: false,
      error: response.error || 'Login failed',
    };
  },

  /**
   * Logout user (clear tokens)
   */
  async logout(): Promise<void> {
    await apiClient.clearTokens();
  },

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await apiClient.getAccessToken();
    return !!token;
  },

  /**
   * Get stored access token
   */
  async getAccessToken(): Promise<string | null> {
    return await apiClient.getAccessToken();
  },
};
