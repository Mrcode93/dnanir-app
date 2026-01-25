/**
 * Authentication-related constants
 */

export const AUTH_CONSTANTS = {
  MAX_ATTEMPTS: 5,
  BIOMETRIC_DELAY_MS: 500,
  KEEP_UNLOCKED_DURATION_MS: 60000,
  DATABASE_COMMIT_DELAY_MS: 200,
  MIN_PASSWORD_LENGTH: 4,
} as const;

export type AuthMethod = 'none' | 'password' | 'biometric';
