import { apiRequest, setAccessToken, setRefreshToken, setUser, clearAuthData, getUser, getAccessToken } from './apiService';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { pushNotificationService } from './pushNotificationService';
import { authEventService } from './authEventService';

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
 * Register new user on server
 */
export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const response = await apiRequest<AuthResponse>(API_ENDPOINTS.AUTH.REGISTER, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (response.error) {
    throw new Error(response.message || response.error);
  }

  if (response.data) {
    // Store tokens and user
    await setAccessToken(response.data.tokens.accessToken);
    await setRefreshToken(response.data.tokens.refreshToken);
    await setUser(response.data.user);

    // Notify app of login
    authEventService.notifyAuthChanged();

    return response.data;
  }

  throw new Error('Registration failed');
};

/**
 * Login user on server
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await apiRequest<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (response.error) {
    throw new Error(response.message || response.error);
  }

  if (response.data) {
    // Store tokens and user
    await setAccessToken(response.data.tokens.accessToken);
    await setRefreshToken(response.data.tokens.refreshToken);
    await setUser(response.data.user);

    // Notify app of login
    authEventService.notifyAuthChanged();

    return response.data;
  }

  throw new Error('Login failed');
};

/**
 * Logout user
 */
export const logout = async (): Promise<void> => {
  try {
    await pushNotificationService.removeTokenFromServer();
  } catch (e) {
    console.error('Error removing push token on logout:', e);
  }
  await clearAuthData();
  authEventService.notifyAuthChanged();
};

/**
 * Check if user is logged in
 */
export const isLoggedIn = async (): Promise<boolean> => {
  const token = await getAccessToken();
  const user = await getUser();
  return !!(token && user);
};

/**
 * Get current user
 */
export const getCurrentUser = async () => {
  return await getUser();
};
