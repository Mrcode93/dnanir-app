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
  
  
  
  
  
  

  // Test 1: Health Check
  
  const healthResult = await apiClient.healthCheck();
  
  

  // Test 2: Authentication Status
  
  const isAuth = await authApiService.isAuthenticated();
  const token = await authApiService.getAccessToken();
  
  
  

  // Test 3: Subscription Status (if authenticated)
  if (isAuth) {
    
    const subStatus = await subscriptionApiService.getStatus();
    if (subStatus.success) {
      
      
    } else {
      
    }
    
  }

  // Test 4: API Client Test
  
  const connectionTest = await apiClient.testConnection();
  
  
  if (connectionTest.details) {
    // console.log('Details:', JSON.stringify(connectionTest.details, null, 2));
  }
  

  
  
  

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
  
  
  

  try {
    let result;
    if (method === 'GET') {
      result = await apiClient.get(endpoint, includeAuth);
    } else {
      result = await apiClient.post(endpoint, body || {}, includeAuth);
    }

    
    
    if (result.success) {
      // console.log('Data:', JSON.stringify(result.data, null, 2));
    } else {
      
      
    }

    return result;
  } catch (error: any) {
    
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
  
  

  // Test Login
  
  const loginResult = await authApiService.login({ phone, password });
  
  if (loginResult.success) {
    // console.log('User:', JSON.stringify(loginResult.user, null, 2));
  } else {
    
  }

  return loginResult;
};

/**
 * Test AI Service (requires authentication)
 */
export const testAIService = async () => {
  

  const isAuth = await authApiService.isAuthenticated();
  if (!isAuth) {
    
    return { success: false, error: 'Not authenticated' };
  }

  // Test Chatbot
  
  const chatbotResult = await aiApiService.chatbot('مرحبا');
  
  if (chatbotResult.success) {
    
  } else {
    
  }

  return chatbotResult;
};
