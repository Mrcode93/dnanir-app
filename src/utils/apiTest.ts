/**
 * API Testing Utility
 * 
 * Use this to test and verify API connectivity
 */

import { apiClient } from '../services/apiClient';
import { authApiService } from '../services/authApiService';
import { subscriptionApiService } from '../services/subscriptionApiService';
import { aiApiService } from '../services/aiApiService';
import { API_CONFIG } from '../config/api';

/**
 * Test API connection and log results
 */
export const testAPIConnection = async () => {
  console.log('═══════════════════════════════════════');
  console.log('🧪 API CONNECTION TEST');
  console.log('═══════════════════════════════════════');
  console.log('📍 Base URL:', API_CONFIG.BASE_URL);
  console.log('⏱️  Timeout:', API_CONFIG.TIMEOUT, 'ms');
  console.log('');

  // Test 1: Health Check
  console.log('1️⃣ Testing Health Endpoint...');
  const healthResult = await apiClient.healthCheck();
  console.log(healthResult ? '✅ Server is reachable' : '❌ Server is not reachable');
  console.log('');

  // Test 2: Authentication Status
  console.log('2️⃣ Checking Authentication...');
  const isAuth = await authApiService.isAuthenticated();
  const token = await authApiService.getAccessToken();
  console.log('Authenticated:', isAuth ? '✅ Yes' : '❌ No');
  console.log('Has Token:', token ? '✅ Yes' : '❌ No');
  if (token) {
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
  }
  console.log('');

  // Test 3: Subscription Status (if authenticated)
  if (isAuth) {
    console.log('3️⃣ Testing Subscription Status...');
    const subStatus = await subscriptionApiService.getStatus();
    if (subStatus.success) {
      console.log('✅ Subscription check successful');
      console.log('Is Premium:', subStatus.data?.isPremium ? '✅ Yes' : '❌ No');
    } else {
      console.log('❌ Subscription check failed:', subStatus.error);
    }
    console.log('');
  }

  // Test 4: API Client Test
  console.log('4️⃣ Running API Client Connection Test...');
  const connectionTest = await apiClient.testConnection();
  console.log('Result:', connectionTest.success ? '✅ Success' : '❌ Failed');
  console.log('Message:', connectionTest.message);
  if (connectionTest.details) {
    console.log('Details:', JSON.stringify(connectionTest.details, null, 2));
  }
  console.log('');

  console.log('═══════════════════════════════════════');
  console.log('✅ Test Complete');
  console.log('═══════════════════════════════════════');

  return {
    healthCheck: healthResult,
    authenticated: isAuth,
    connectionTest,
  };
};

/**
 * Test a specific API endpoint
 */
export const testEndpoint = async (
  method: 'GET' | 'POST',
  endpoint: string,
  body?: any,
  includeAuth: boolean = true
) => {
  console.log('🧪 Testing Endpoint:', method, endpoint);
  console.log('📍 Full URL:', `${API_CONFIG.BASE_URL}${endpoint}`);
  console.log('🔐 Auth Required:', includeAuth);

  try {
    let result;
    if (method === 'GET') {
      result = await apiClient.get(endpoint, includeAuth);
    } else {
      result = await apiClient.post(endpoint, body || {}, includeAuth);
    }

    console.log('✅ Request completed');
    console.log('Success:', result.success);
    if (result.success) {
      console.log('Data:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('Error:', result.error);
      console.log('Message:', result.message);
    }

    return result;
  } catch (error: any) {
    console.error('❌ Request failed:', error);
    return {
      success: false,
      error: error.message || 'Request failed',
    };
  }
};

/**
 * Test authentication flow
 */
export const testAuth = async (phone: string, password: string) => {
  console.log('🧪 Testing Authentication...');
  console.log('Phone:', phone);

  // Test Login
  console.log('1️⃣ Testing Login...');
  const loginResult = await authApiService.login({ phone, password });
  console.log('Login Result:', loginResult.success ? '✅ Success' : '❌ Failed');
  if (loginResult.success) {
    console.log('User:', JSON.stringify(loginResult.user, null, 2));
  } else {
    console.log('Error:', loginResult.error);
  }

  return loginResult;
};

/**
 * Test AI Service (requires authentication)
 */
export const testAIService = async () => {
  console.log('🧪 Testing AI Service...');

  const isAuth = await authApiService.isAuthenticated();
  if (!isAuth) {
    console.log('❌ Not authenticated. Please login first.');
    return { success: false, error: 'Not authenticated' };
  }

  // Test Chatbot
  console.log('1️⃣ Testing Chatbot...');
  const chatbotResult = await aiApiService.chatbot('مرحبا');
  console.log('Chatbot Result:', chatbotResult.success ? '✅ Success' : '❌ Failed');
  if (chatbotResult.success) {
    console.log('Response:', chatbotResult.data?.response);
  } else {
    console.log('Error:', chatbotResult.error);
  }

  return chatbotResult;
};
