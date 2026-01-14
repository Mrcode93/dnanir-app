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
const DEV_API_URL = 'http://192.168.0.101:3000'; // Change to your local IP if testing on physical device (e.g., 'http://192.168.1.100:3000')

// Production API URL
const PROD_API_URL = 'https://api.dnanir.com';

// Check if we're in development mode
// In React Native/Expo, __DEV__ is available at runtime but TypeScript doesn't know about it
// We'll use a type assertion or check process.env
const isDev = process.env.NODE_ENV !== 'production';

export const API_CONFIG = {
  BASE_URL: isDev ? DEV_API_URL : PROD_API_URL,
  TIMEOUT: 30000, // 30 seconds (default)
  OCR_TIMEOUT: 60000, // 60 seconds for OCR requests (longer processing time)
  VERSION: '1.0.0',
};

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
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
  },
  // Health
  HEALTH: '/health',
};
