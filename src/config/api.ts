/**
 * API Configuration
 * 
 * Configure your server URL here.
 * For development, use your local IP address or localhost.
 * For production, use your production server URL.
 */

// Development: Use your local IP address (e.g., http://192.168.1.100:3000)
// To find your IP: On Mac/Linux run `ifconfig | grep "inet "`, on Windows run `ipconfig`
// Or use localhost if running on simulator/emulator
// const DEV_API_URL = 'http://192.168.0.101:3000'; // Change to your local IP if testing on physical device (e.g., 'http://192.168.1.100:3000')
const DEV_API_URL = 'https://urcash.up.railway.app';
// const DEV_API_URL = 'http://localhost:3002';

// Production API URL
// const PROD_API_URL = 'https://api.dnanir.com';
const PROD_API_URL = 'https://urcash.up.railway.app';
// const PROD_API_URL = 'http://localhost:3002';

// Check if we're in development mode
// In React Native/Expo, __DEV__ is available at runtime but TypeScript doesn't know about it
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const API_CONFIG = {
  BASE_URL: isDev ? DEV_API_URL : PROD_API_URL,
  TIMEOUT: 30000, // 30 seconds (default)
  OCR_TIMEOUT: 60000, // 60 seconds for OCR requests (longer processing time)
  VERSION: '1.0.6',
  ENABLE_LOGGING: false,
};

// Helper to get full URL
export const getApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: '/api/dnanir/auth/register',
    LOGIN: '/api/dnanir/auth/login',
    CHECK: '/api/dnanir/auth/check',
    GOOGLE: '/api/dnanir/auth/google',
    APPLE: '/api/dnanir/auth/apple',
    CLERK: '/api/dnanir/auth/clerk',
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
    USAGE: '/api/dnanir/ai/usage',
    INSIGHTS: '/api/dnanir/ai/insights',
    GOAL_PLAN: '/api/dnanir/ai/goal-plan',
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
    UPLOAD: '/api/dnanir/sync/upload',
    FULL: '/api/dnanir/sync/full',
    ITEMS: '/api/dnanir/sync/items',
  },
};
