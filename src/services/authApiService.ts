import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import { authStorage } from './authStorage';
import { authEventService } from './authEventService';
import { saveUserProfile } from '../database/database';

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
    email?: string;
    isPro?: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Helper function to save user profile to local database
 */
const saveUserProfileToLocal = async (user: AuthResponse['user']): Promise<void> => {
  try {
    await saveUserProfile({
      userId: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      isPro: user.isPro || false,
    });
  } catch (error) {
    console.error('Error saving user profile:', error);
    // Don't fail login if profile save fails
  }
};

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
      await authStorage.setUser(response.data.user);
      
      // Save user profile to local database
      await saveUserProfileToLocal(response.data.user);
      
      authEventService.notifyAuthChanged();

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
      await authStorage.setUser(response.data.user);
      
      // Save user profile to local database
      await saveUserProfileToLocal(response.data.user);
      
      authEventService.notifyAuthChanged();

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
   * Logout user (clear tokens and profile data)
   */
  async logout(): Promise<void> {
    await authStorage.clearAuthData();
    
    // Clear user profile from local database
    try {
      const { clearUserProfile } = await import('../database/database');
      await clearUserProfile();
    } catch (error) {
      console.error('Error clearing user profile:', error);
      // Don't fail logout if profile clear fails
    }
    
    authEventService.notifyAuthChanged();
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

  /**
   * Check authentication status and return user data
   */
  async checkAuth(): Promise<{ isAuthenticated: boolean; user?: AuthResponse['user'] }> {
    const token = await apiClient.getAccessToken();
    if (!token) {
      return { isAuthenticated: false };
    }

    try {
      const response = await apiClient.get<any>(API_ENDPOINTS.AUTH.CHECK);

      if (response.success && response.data) {
        if (response.data.user) {
          await authStorage.setUser(response.data.user);
        }
        return {
          isAuthenticated: true,
          user: response.data.user
        };
      }
      return { isAuthenticated: false };
    } catch (error) {
      console.error('Check auth error:', error);
      return { isAuthenticated: false };
    }
  },

  /**
   * Verify Google Login on server
   */
  async googleLogin(accessToken: string): Promise<{ success: boolean; user?: AuthResponse['user']; error?: string }> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.GOOGLE,
      { accessToken },
      false
    );

    if (response.success && response.data) {
      await apiClient.setAccessToken(response.data.tokens.accessToken);
      await apiClient.setRefreshToken(response.data.tokens.refreshToken);
      await authStorage.setUser(response.data.user);
      
      // Save user profile to local database
      await saveUserProfileToLocal(response.data.user);
      
      authEventService.notifyAuthChanged();
      return {
        success: true,
        user: response.data.user,
      };
    }

    return {
      success: false,
      error: response.error || 'Google login failed',
    };
  },

  /**
   * Verify Apple Login on server
   */
  async appleLogin(identityToken: string, fullName?: any): Promise<{ success: boolean; user?: AuthResponse['user']; error?: string }> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.APPLE,
      { identityToken, fullName },
      false
    );

    if (response.success && response.data) {
      await apiClient.setAccessToken(response.data.tokens.accessToken);
      await apiClient.setRefreshToken(response.data.tokens.refreshToken);
      await authStorage.setUser(response.data.user);
      
      // Save user profile to local database
      await saveUserProfileToLocal(response.data.user);
      
      authEventService.notifyAuthChanged();
      return {
        success: true,
        user: response.data.user,
      };
    }

    return {
      success: false,
      error: response.error || 'Apple login failed',
    };
  }
};
