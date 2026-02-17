import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { getUserSettings, upsertUserSettings } from '../database/database';
import { alertService } from './alertService';
import * as Crypto from 'expo-crypto';

export interface AuthMethod {
  type: 'none' | 'password' | 'biometric';
  enabled: boolean;
}

const SALT_BYTES = 16;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

const generateSalt = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(SALT_BYTES);
  return toHex(bytes);
};

const hashPassword = async (password: string, salt: string): Promise<string> => {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
};

const buildPasswordHash = async (password: string): Promise<string> => {
  const salt = await generateSalt();
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
};

/**
 * Check if biometric authentication is available
 * Note: On Android, biometric is disabled - only password is used
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    // Disable biometric on Android devices - use password only
    if (Platform.OS === 'android') {
      return false;
    }

    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return false;
    }

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch (error) {
    console.error('Error checking biometric availability:', error);
    return false;
  }
};

/**
 * Get available biometric types
 */
export const getBiometricType = async (): Promise<string> => {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris';
    }
    return 'Biometric';
  } catch (error) {
    console.error('Error getting biometric type:', error);
    return 'Biometric';
  }
};

/**
 * Authenticate using biometric
 */
export const authenticateWithBiometric = async (): Promise<boolean> => {
  try {
    const available = await isBiometricAvailable();
    if (!available) {
      alertService.warning('غير متاح', 'المصادقة البيومترية غير متاحة على هذا الجهاز');
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'افتح التطبيق',
      cancelLabel: 'إلغاء',
      disableDeviceFallback: false,
      fallbackLabel: 'استخدم كلمة المرور',
    });

    return result.success;
  } catch (error) {
    console.error('Error authenticating with biometric:', error);
    return false;
  }
};

/**
 * Set up password authentication
 */
export const setupPassword = async (password: string): Promise<boolean> => {
  try {
    const hashedPassword = await buildPasswordHash(password);
    
    const currentSettings = await getUserSettings();
    // Keep existing biometricsEnabled if it's already enabled
    await upsertUserSettings({
      ...currentSettings,
      authMethod: currentSettings?.biometricsEnabled ? 'biometric' : 'password',
      passwordHash: hashedPassword,
      biometricsEnabled: currentSettings?.biometricsEnabled || false,
    });

    return true;
  } catch (error) {
    console.error('Error setting up password:', error);
    return false;
  }
};

/**
 * Verify password
 */
export const verifyPassword = async (password: string): Promise<boolean> => {
  try {
    const settings = await getUserSettings();
    if (!settings || !settings.passwordHash) {
      return false;
    }

    const stored = settings.passwordHash;

    // New format: "salt:hash"
    if (stored.includes(':')) {
      const [salt, hash] = stored.split(':');
      if (!salt || !hash) {
        return false;
      }
      const candidate = await hashPassword(password, salt);
      return candidate === hash;
    }

    // Legacy plaintext support with upgrade on success
    const legacyMatch = stored === password;
    if (legacyMatch) {
      try {
        const upgradedHash = await buildPasswordHash(password);
        await upsertUserSettings({
          ...settings,
          passwordHash: upgradedHash,
        });
      } catch (error) {
        // Ignore upgrade failures
      }
    }

    return legacyMatch;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
};

/**
 * Set up biometric authentication
 * Note: On Android, biometric setup is disabled - only password is used
 */
export const setupBiometric = async (): Promise<boolean> => {
  try {
    // Disable biometric on Android devices
    if (Platform.OS === 'android') {
      alertService.warning('غير متاح', 'المصادقة البيومترية غير متاحة على أجهزة Android. يرجى استخدام كلمة المرور');
      return false;
    }

    const available = await isBiometricAvailable();
    if (!available) {
      alertService.warning('غير متاح', 'المصادقة البيومترية غير متاحة على هذا الجهاز');
      return false;
    }

    const currentSettings = await getUserSettings();
    // Keep existing passwordHash if it exists
    await upsertUserSettings({
      ...currentSettings,
      authMethod: currentSettings?.passwordHash ? 'password' : 'biometric',
      passwordHash: currentSettings?.passwordHash || undefined,
      biometricsEnabled: true,
    });

    return true;
  } catch (error) {
    console.error('Error setting up biometric:', error);
    return false;
  }
};

/**
 * Disable password authentication
 */
export const disablePassword = async (): Promise<void> => {
  try {
    const currentSettings = await getUserSettings();
    await upsertUserSettings({
      ...currentSettings,
      authMethod: currentSettings?.biometricsEnabled ? 'biometric' : 'none',
      passwordHash: undefined,
      biometricsEnabled: currentSettings?.biometricsEnabled || false,
    });
  } catch (error) {
    console.error('Error disabling password:', error);
  }
};

/**
 * Disable biometric authentication
 */
export const disableBiometric = async (): Promise<void> => {
  try {
    const currentSettings = await getUserSettings();
    await upsertUserSettings({
      ...currentSettings,
      authMethod: currentSettings?.passwordHash ? 'password' : 'none',
      passwordHash: currentSettings?.passwordHash || undefined,
      biometricsEnabled: false,
    });
  } catch (error) {
    console.error('Error disabling biometric:', error);
  }
};

/**
 * Disable all authentication
 */
export const disableAuthentication = async (): Promise<void> => {
  try {
    const currentSettings = await getUserSettings();
    
    const newSettings = {
      name: currentSettings?.name || null,
      authMethod: 'none' as const,
      passwordHash: null as any,
      biometricsEnabled: false,
    };
    
    await upsertUserSettings(newSettings);
    
    // Wait for database to commit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify the change was saved
    const verifySettings = await getUserSettings();
    if (verifySettings?.authMethod !== 'none') {
      throw new Error('Failed to disable authentication - database update did not persist');
    }
  } catch (error) {
    console.error('Error disabling authentication:', error);
    throw error;
  }
};

/**
 * Check if authentication is enabled
 */
export const isAuthenticationEnabled = async (): Promise<boolean> => {
  try {
    const settings = await getUserSettings();
    return settings?.authMethod !== undefined && settings?.authMethod !== 'none';
  } catch (error) {
    console.error('Error checking authentication status:', error);
    return false;
  }
};

/**
 * Get authentication method
 * Note: On Android, always returns 'password' if enabled, never 'biometric'
 */
export const getAuthenticationMethod = async (): Promise<'none' | 'password' | 'biometric'> => {
  try {
    const settings = await getUserSettings();
    if (!settings) return 'none';
    
    // On Android, only use password - ignore biometric even if enabled
    if (Platform.OS === 'android') {
      if (settings.passwordHash) {
        return 'password';
      }
      return 'none';
    }
    
    // On iOS, use biometric if available, otherwise password
    // If both are enabled, prefer biometric
    if (settings.biometricsEnabled && settings.passwordHash) {
      return 'biometric';
    }
    if (settings.biometricsEnabled) {
      return 'biometric';
    }
    if (settings.passwordHash) {
      return 'password';
    }
    return 'none';
  } catch (error) {
    console.error('Error getting authentication method:', error);
    return 'none';
  }
};

/**
 * Check if password is enabled
 */
export const isPasswordEnabled = async (): Promise<boolean> => {
  try {
    const settings = await getUserSettings();
    return !!(settings?.passwordHash);
  } catch (error) {
    console.error('Error checking password status:', error);
    return false;
  }
};

/**
 * Check if biometric is enabled
 * Note: On Android, always returns false even if enabled in settings
 */
export const isBiometricEnabled = async (): Promise<boolean> => {
  try {
    // On Android, biometric is always disabled
    if (Platform.OS === 'android') {
      return false;
    }

    const settings = await getUserSettings();
    return !!(settings?.biometricsEnabled);
  } catch (error) {
    console.error('Error checking biometric status:', error);
    return false;
  }
};
