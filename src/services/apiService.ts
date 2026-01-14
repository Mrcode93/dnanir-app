import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, getApiUrl } from '../config/api';

const TOKEN_KEY = '@dnanir_access_token';
const REFRESH_TOKEN_KEY = '@dnanir_refresh_token';
const USER_KEY = '@dnanir_user';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  errors?: any[];
}

/**
 * Get stored access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

/**
 * Store access token
 */
export const setAccessToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing access token:', error);
  }
};

/**
 * Get stored refresh token
 */
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

/**
 * Store refresh token
 */
export const setRefreshToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing refresh token:', error);
  }
};

/**
 * Store user data
 */
export const setUser = async (user: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error storing user:', error);
  }
};

/**
 * Get stored user data
 */
export const getUser = async (): Promise<any | null> => {
  try {
    const userStr = await AsyncStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

/**
 * Clear all stored auth data
 */
export const clearAuthData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};

/**
 * Make API request with authentication
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  try {
    const token = await getAccessToken();
    const url = getApiUrl(endpoint);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers as HeadersInit),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.error || 'Request failed',
        message: data.message,
        data: data.errors,
      };
    }

    return { data };
  } catch (error: any) {
    console.error('API request error:', error);
    return {
      error: 'Network error',
      message: error.message || 'Failed to connect to server',
    };
  }
};

/**
 * Make API request with file upload (base64)
 */
export const apiRequestWithFile = async <T = any>(
  endpoint: string,
  fileUri: string,
  fieldName: string = 'file',
  additionalData: Record<string, any> = {}
): Promise<ApiResponse<T>> => {
  try {
    const token = await getAccessToken();
    const url = getApiUrl(endpoint);

    // For React Native, we need to use a different approach
    // Using expo-file-system to read the file
    const FileSystem = require('expo-file-system');
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const body = JSON.stringify({
      imageBase64: base64,
      ...additionalData,
    });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.error || 'Request failed',
        message: data.message,
      };
    }

    return { data };
  } catch (error: any) {
    console.error('File upload error:', error);
    return {
      error: 'Upload error',
      message: error.message || 'Failed to upload file',
    };
  }
};
