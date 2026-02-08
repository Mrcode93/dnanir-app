import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import * as FileSystem from 'expo-file-system/legacy';

export interface ReceiptOCRRequest {
  imageBase64: string;
  language?: 'ar' | 'en' | 'ar+en';
}

export interface ReceiptOCRResponse {
  text: string;
  amount?: number;
  date?: string;
  merchant?: string;
  items?: Array<{ name: string; price: number; quantity?: number }>;
}

export interface ChatbotRequest {
  message: string;
  context?: Record<string, unknown>;
}

export interface ChatbotResponse {
  response: string;
  suggestions?: string[];
}

export interface CategorizeRequest {
  description: string;
  amount?: number;
}

export interface CategorizeResponse {
  category: string;
  confidence: number;
  suggestions?: string[];
}

export interface AnalyzeRequest {
  expenses: Array<Record<string, unknown>>;
  income: Array<Record<string, unknown>>;
  goals?: Array<Record<string, unknown>>;
  budget?: Record<string, unknown>;
}

export interface AnalyzeResponse {
  insights: string[];
  recommendations: string[];
  trends?: Record<string, unknown>;
  predictions?: Record<string, unknown>;
}

/**
 * AI API Service
 * Available to all authenticated users
 */
export const aiApiService = {
  /**
   * Process receipt OCR
   * Converts image URI to base64 and sends to server
   */
  async processReceiptOCR(
    imageUri: string,
    language: 'ar' | 'en' | 'ar+en' = 'ar+en'
  ): Promise<{ success: boolean; data?: ReceiptOCRResponse; error?: string }> {
    try {
      // Read image file and convert to base64 using legacy API
      console.log('📸 Reading image file:', imageUri);

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('✅ Image converted to base64, length:', base64.length);

      const request: ReceiptOCRRequest = {
        imageBase64: base64,
        language,
      };

      const response = await apiClient.post<{ message: string; data: ReceiptOCRResponse }>(
        API_ENDPOINTS.AI.RECEIPT_OCR,
        request
      );

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to process receipt',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process receipt image';
      console.error('Receipt OCR error:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Chatbot - Ask financial questions
   */
  async chatbot(
    message: string,
    context?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: ChatbotResponse; error?: string }> {
    const request: ChatbotRequest = {
      message,
      context,
    };

    const response = await apiClient.post<{ message: string; data: ChatbotResponse }>(
      API_ENDPOINTS.AI.CHATBOT,
      request
    );

    if (response.success && response.data?.data) {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to get chatbot response',
    };
  },

  /**
   * Categorize expense automatically
   */
  async categorize(
    description: string,
    amount?: number
  ): Promise<{ success: boolean; data?: CategorizeResponse; error?: string }> {
    const request: CategorizeRequest = {
      description,
      amount,
    };

    const response = await apiClient.post<{ message: string; data: CategorizeResponse }>(
      API_ENDPOINTS.AI.CATEGORIZE,
      request
    );

    if (response.success && response.data?.data) {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to categorize expense',
    };
  },

  /**
   * Analyze financial data and get insights
   */
  async analyze(
    expenses: Array<Record<string, unknown>>,
    income: Array<Record<string, unknown>>,
    goals?: Array<Record<string, unknown>>,
    budget?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: AnalyzeResponse; error?: string }> {
    const request: AnalyzeRequest = {
      expenses,
      income,
      goals,
      budget,
    };

    const response = await apiClient.post<{ message: string; data: AnalyzeResponse }>(
      API_ENDPOINTS.AI.ANALYZE,
      request
    );

    if (response.success && response.data?.data) {
      return {
        success: true,
        data: response.data.data,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to analyze financial data',
    };
  },
};
