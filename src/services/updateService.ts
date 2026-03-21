import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import packageJson from '../../package.json';

const UPDATE_CHECK_KEY = '@dnanir_last_update_check';

export interface AppUpdate {
  version: string;
  description: string;
  platform: 'ios' | 'android' | 'all';
  mandatory: boolean;
  releaseDate: string;
  downloadUrl?: string; // We can add this to the server response or model later
}

class UpdateService {
  /**
   * Compare two version strings (semantic versioning)
   * Returns:
   *  1 if v1 > v2
   * -1 if v1 < v2
   *  0 if v1 === v2
   */
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * Check if an update check is needed today
   */
  async shouldCheckForUpdate(): Promise<boolean> {
    // In development, we always check to make testing easier
    if (__DEV__) return true;

    try {
      const lastCheck = await AsyncStorage.getItem(UPDATE_CHECK_KEY);
      if (!lastCheck) return true;

      const lastDate = new Date(lastCheck);
      const today = new Date();

      return (
        lastDate.getDate() !== today.getDate() ||
        lastDate.getMonth() !== today.getMonth() ||
        lastDate.getFullYear() !== today.getFullYear()
      );
    } catch (error) {
      return true;
    }
  }

  /**
   * Mark that a check was performed today
   */
  async markChecked(): Promise<void> {
    try {
      await AsyncStorage.setItem(UPDATE_CHECK_KEY, new Date().toISOString());
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Check for updates from the server
   */
  async checkForUpdate(): Promise<AppUpdate | null> {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      
      // The server returns { success: true, data: AppUpdate[] }
      // ApiResponse<T> wraps this as response.data = { success: true, data: AppUpdate[] }
      const response = await apiClient.get<any>(
        `${API_ENDPOINTS.UPDATES}?platform=${platform}`,
        false // Public endpoint
      );

      if (response.success && response.data && response.data.success && Array.isArray(response.data.data)) {
        const updates: AppUpdate[] = response.data.data;
        
        if (updates.length > 0) {
          const latestUpdate = updates[0];
          const currentVersion = packageJson.version;

          console.log(`[UpdateService] Latest: ${latestUpdate.version}, Current: ${currentVersion}`);

          if (this.compareVersions(latestUpdate.version, currentVersion) > 0) {
            console.log('[UpdateService] New update found!');
            return latestUpdate;
          } else {
            console.log('[UpdateService] App is up to date.');
          }
        } else {
          console.log('[UpdateService] No active updates found for this platform.');
        }
      } else {
        console.log('[UpdateService] Failed to fetch updates or invalid response structure.');
      }
      
      return null;
    } catch (error) {
      console.log('[UpdateService] Error checking for updates:', error);
      return null;
    }
  }
}

export const updateService = new UpdateService();
