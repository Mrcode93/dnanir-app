import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = '@dnanir_access_token';
const REFRESH_TOKEN_KEY = '@dnanir_refresh_token';
const USER_KEY = '@dnanir_user';

let secureStoreAvailable: boolean | null = null;

const isSecureStoreAvailable = async (): Promise<boolean> => {
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }

  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch (error) {
    secureStoreAvailable = false;
  }

  return secureStoreAvailable;
};

const getItem = async (key: string): Promise<string | null> => {
  const canUseSecureStore = await isSecureStoreAvailable();

  if (canUseSecureStore) {
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) {
        return value;
      }
    } catch (error) {
      // Fall back to AsyncStorage
    }
  }

  try {
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue !== null && canUseSecureStore) {
      // Migrate legacy value to SecureStore
      try {
        await SecureStore.setItemAsync(key, legacyValue);
        await AsyncStorage.removeItem(key);
      } catch (error) {
        // Ignore migration errors
      }
    }
    return legacyValue;
  } catch (error) {
    return null;
  }
};

const setItem = async (key: string, value: string): Promise<void> => {
  const canUseSecureStore = await isSecureStoreAvailable();

  if (canUseSecureStore) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (error) {
      // Fall back to AsyncStorage
    }
  }

  await AsyncStorage.setItem(key, value);
};

const removeItem = async (key: string): Promise<void> => {
  const canUseSecureStore = await isSecureStoreAvailable();

  if (canUseSecureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      // Ignore secure store removal errors
    }
  }

  await AsyncStorage.removeItem(key);
};

const clearTokens = async (): Promise<void> => {
  await Promise.all([removeItem(TOKEN_KEY), removeItem(REFRESH_TOKEN_KEY)]);
};

const clearAuthData = async (): Promise<void> => {
  await Promise.all([removeItem(TOKEN_KEY), removeItem(REFRESH_TOKEN_KEY), removeItem(USER_KEY)]);
};

export const authStorage = {
  async getAccessToken(): Promise<string | null> {
    return await getItem(TOKEN_KEY);
  },
  async setAccessToken(token: string): Promise<void> {
    await setItem(TOKEN_KEY, token);
  },
  async getRefreshToken(): Promise<string | null> {
    return await getItem(REFRESH_TOKEN_KEY);
  },
  async setRefreshToken(token: string): Promise<void> {
    await setItem(REFRESH_TOKEN_KEY, token);
  },
  async getUser<T = any>(): Promise<T | null> {
    const userStr = await getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr) as T;
    } catch (error) {
      return null;
    }
  },
  async setUser(user: any): Promise<void> {
    await setItem(USER_KEY, JSON.stringify(user));
  },
  clearTokens,
  clearAuthData,
};
