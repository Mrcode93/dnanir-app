/**
 * API Configuration
 * 
 * Configure your server URL here.
 * For development, use your local IP address or localhost.
 * For production, use your production server URL.
 */

// Development: Uses production server (no separate dev server).
// To test locally, uncomment the localhost line below and set to your IP.
const DEV_API_URL = 'https://dnanir.up.railway.app';
// const DEV_API_URL = 'https://urcash.up.railway.app';
// const DEV_API_URL = 'http://192.168.31.221:8080';

// Production API URL
const PROD_API_URL = 'https://dnanir.up.railway.app';
// const PROD_API_URL = 'https://urcash.up.railway.app';
// const PROD_API_URL = 'http://192.168.31.221:8080';

// Check if we're in development mode
// In React Native/Expo, __DEV__ is available at runtime but TypeScript doesn't know about it
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const API_CONFIG = {
  BASE_URL: isDev ? DEV_API_URL : PROD_API_URL,
  TIMEOUT: 30000, // 30 seconds (default)
  OCR_TIMEOUT: 60000, // 60 seconds for OCR requests (longer processing time)
  VERSION: '1.1.8',
  ENABLE_LOGGING: true,
};

// Helper to get full URL
export const getApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    CHECK: '/api/auth/check',
    SEND_OTP: '/api/auth/otp/send',
    VERIFY_OTP: '/api/auth/otp/verify',
    RESET_PASSWORD: '/api/auth/reset-password',
    UPDATE_PROFILE: '/api/auth/update-profile',
    REFRESH_TOKEN: '/api/auth/refresh-token',
  },
  // Subscription
  SUBSCRIPTION: {
    STATUS: '/api/subscription/status',
    CREATE: '/api/subscription/create',
    CANCEL: '/api/subscription/cancel',
    REACTIVATE: '/api/subscription/reactivate',
  },
  // AI Services
  AI: {
    RECEIPT_OCR: '/api/ai/receipt-ocr',
    CHATBOT: '/api/ai/chatbot',
    CATEGORIZE: '/api/ai/categorize',
    ANALYZE: '/api/ai/analyze',
    USAGE: '/api/ai/usage',
    INSIGHTS: '/api/ai/insights',
    GOAL_PLAN: '/api/ai/goal-plan',
    SMART_ADD: '/api/ai/smart-add',
    SMART_ADD_USAGE: '/api/ai/smart-add/usage',
    AL_HAJJI: '/api/ai/al-hajji',
  },
  // Health
  HEALTH: '/health',
  // Devices
  DEVICES: {
    REGISTER: '/api/notifications/register',
    REMOVE: '/api/notifications/remove',
  },
  // Sync (Pro)
  SYNC: {
    UPLOAD: '/api/sync/upload',
    FULL: '/api/sync/full',
    ITEMS: '/api/sync/items',
    DELETE_DATA: '/api/sync/data',
  },
  // Sync v2 — conflict-aware, versioned (push/pull per table)
  SYNC_V2: {
    PUSH: (table: string) => `/api/sync/v2/${table}/push`,
    PULL: (table: string) => `/api/sync/v2/${table}/pull`,
  },
  // Referral (Growth)
  REFERRAL: {
    INFO: '/api/referral/info',
    APPLY: '/api/referral/apply',
  },
  // Plans
  PLANS: '/api/plans',
  // Payments
  PAYMENTS: {
    CREATE_SESSION: '/api/payments/create-session',
    STATUS: (id: string) => `/api/payments/status/${id}`,
  },
  // Promo (Marketing)
  PROMO: {
    APPLY: '/api/promo/apply',
  },
  // Updates
  UPDATES: '/api/updates',
};
