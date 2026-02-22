import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import { authStorage } from './authStorage';
import { authEventService } from './authEventService';
import { saveUserProfile } from '../database/database';

export interface RegisterRequest {
  phone: string;
  password: string;
  name?: string;
  country?: string;
  referralCode?: string;
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface UserData {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  country?: string;
  referredBy?: string | null;
  referralCode?: string | null;
  isPro?: boolean;
  proExpiresAt?: string | null;
  hasUnlimitedAi?: boolean;
}

export interface AuthResponse {
  user: UserData;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/**
 * Helper function to save user profile to local database
 */
const saveUserProfileToLocal = async (user: UserData): Promise<void> => {
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
 * Store tokens and user data after successful auth
 */
const storeAuthData = async (data: AuthResponse): Promise<void> => {
  await apiClient.setAccessToken(data.tokens.accessToken);
  await apiClient.setRefreshToken(data.tokens.refreshToken);
  await authStorage.setUser(data.user);
  await saveUserProfileToLocal(data.user);
  authEventService.notifyAuthChanged();
};

/**
 * Authentication API Service
 */
export const authApiService = {
  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<{ success: boolean; user?: UserData; error?: string }> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      data,
      false // No auth required for registration
    );

    if (response.success && response.data) {
      await storeAuthData(response.data);
      return { success: true, user: response.data.user };
    }

    return {
      success: false,
      error: response.error || response.message || 'Registration failed',
    };
  },

  /**
   * Login user
   */
  async login(data: LoginRequest): Promise<{ success: boolean; user?: UserData; error?: string }> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      data,
      false // No auth required for login
    );

    if (response.success && response.data) {
      await storeAuthData(response.data);
      return { success: true, user: response.data.user };
    }

    return {
      success: false,
      error: response.error || response.message || 'Login failed',
    };
  },

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<{ success: boolean; user?: UserData; error?: string }> {
    const refreshToken = await authStorage.getRefreshToken();
    if (!refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      { refreshToken },
      false // Don't include (possibly expired) access token
    );

    if (response.success && response.data) {
      await storeAuthData(response.data);
      return { success: true, user: response.data.user };
    }

    // If refresh fails, clear auth data (token expired or invalid)
    await authStorage.clearAuthData();
    authEventService.notifyAuthChanged();

    return {
      success: false,
      error: response.error || 'Token refresh failed',
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
  async checkAuth(): Promise<{ isAuthenticated: boolean; user?: UserData }> {
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

      // Access token might be expired — try refreshing
      const refreshResult = await this.refreshAccessToken();
      if (refreshResult.success) {
        return { isAuthenticated: true, user: refreshResult.user };
      }

      return { isAuthenticated: false };
    } catch (error) {
      console.error('Check auth error:', error);
      return { isAuthenticated: false };
    }
  },

  /**
   * Send OTP code to phone
   */
  async sendOtp(phone: string, country?: string): Promise<{ success: boolean; error?: string; devMode?: boolean }> {
    const response = await apiClient.post<any>(
      API_ENDPOINTS.AUTH.SEND_OTP,
      { phone, country },
      false
    );

    if (response.success) {
      return {
        success: true,
        devMode: response.data?.devMode
      };
    }

    return {
      success: false,
      error: response.error || response.message || 'Failed to send OTP',
    };
  },

  /**
   * Verify OTP code
   */
  async verifyOtp(phone: string, code: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient.post<any>(
      API_ENDPOINTS.AUTH.VERIFY_OTP,
      { phone, code },
      false
    );

    if (response.success) {
      return { success: true };
    }

    return {
      success: false,
      error: response.error || response.message || 'Verification failed',
    };
  },

  /**
   * Reset user password
   */
  async resetPassword(phone: string, code: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiClient.post<any>(
      API_ENDPOINTS.AUTH.RESET_PASSWORD,
      { phone, code, newPassword },
      false
    );

    if (response.success) {
      return { success: true };
    }

    return {
      success: false,
      error: response.error || response.message || 'Reset password failed',
    };
  },

  /**
   * Update user profile (name, country)
   */
  async updateProfile(name: string, country?: string): Promise<{ success: boolean; user?: UserData; error?: string }> {
    const response = await apiClient.post<{ user: UserData }>(
      API_ENDPOINTS.AUTH.UPDATE_PROFILE,
      { name, country },
      true // Auth required
    );

    if (response.success && response.data) {
      await authStorage.setUser(response.data.user);

      // Update local profile too
      try {
        await saveUserProfileToLocal(response.data.user);
      } catch (err) {
        console.error('Error updating local profile:', err);
      }

      authEventService.notifyAuthChanged();
      return { success: true, user: response.data.user };
    }

    return {
      success: false,
      error: response.error || response.message || 'Failed to update profile',
    };
  }
};
