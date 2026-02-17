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

export interface SmartInsightsData {
  status: 'green' | 'yellow' | 'red';
  statusMessage: string;
  analysis: string[];
  categoryInsights?: Array<{ category: string; insight: string; recommendation: string }>;
  risks?: string[];
  monthComparison?: {
    message: string;
    incomeChangePercent: number | null;
    expenseChangePercent: number | null;
  };
  savingTips: string[];
  actionItems?: Array<{ priority: number; title: string; description: string }>;
  budgetRecommendations?: Array<{ category: string; suggestedPercent: number; note: string }>;
  prediction: {
    message: string;
    willLastUntilEndOfMonth: boolean | null;
    estimatedRemaining: number | null;
    dailyBudgetSuggested?: string | null;
  };
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
      // console.log('📸 Reading image file:', imageUri);

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // console.log('✅ Image converted to base64, length:', base64.length);

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

  /**
   * جلب استهلاك التحليلات الذكية (مستخدم / الحد / المتبقي)
   */
  async getAiUsage(): Promise<{
    success: boolean;
    data?: { insightsUsed: number; limit: number; remaining: number; isPro: boolean };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<{ success?: boolean; data?: { insightsUsed: number; limit: number; remaining: number; isPro: boolean } }>(
        API_ENDPOINTS.AI.USAGE
      );
      const data = response.data?.data ?? (response.data as any)?.data;
      if (response.success && data != null) {
        return {
          success: true,
          data: {
            insightsUsed: data.insightsUsed ?? 0,
            limit: data.limit ?? 1,
            remaining: data.remaining ?? 0,
            isPro: !!data.isPro,
          },
        };
      }
      return {
        success: false,
        error: (response as any).error || (response as any).message || 'فشل في جلب الاستهلاك',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل في جلب الاستهلاك';
      return { success: false, error: message };
    }
  },

  /**
   * AI Smart Insights – تحليل مالي مفصل، نصائح توفير، توقعات، ومقارنات
   */
  async getSmartInsights(
    payload: {
      summary: {
        totalIncome: number;
        totalExpenses: number;
        balance: number;
        byCategory: Array<{ category: string; amount: number; percentage?: number }>;
        currentMonth?: { totalIncome: number; totalExpenses: number };
        previousMonth?: { totalIncome: number; totalExpenses: number };
        daysLeftInMonth: number;
        /** إجمالي الفواتير المستحقة هذا الشهر (غير المدفوعة) */
        billsDueThisMonth?: number;
        /** تقدير المصروفات الدورية لهذا الشهر */
        recurringEstimatedTotal?: number;
        /** تفاصيل الفواتير المستحقة للذكاء الاصطناعي */
        billsDue?: Array<{ title: string; amount: number; dueDate: string }>;
      };
      currency?: string;
      analysisType?: 'full' | 'savings' | 'comparison';
    }
  ): Promise<{
    success: boolean;
    data?: SmartInsightsData;
    usage?: { insightsUsed: number; limit: number; remaining: number; isPro: boolean };
    error?: string;
  }> {
    try {
      const response = await apiClient.post<{
        success?: boolean;
        data?: Record<string, unknown>;
        usage?: { insightsUsed: number; limit: number; remaining: number; isPro: boolean };
      }>(API_ENDPOINTS.AI.INSIGHTS, payload);
      const data = response.data?.data ?? response.data;
      const usage = (response.data as any)?.usage;
      if (response.success && data) {
        return {
          success: true,
          data: data as any,
          usage: usage
            ? {
                insightsUsed: usage.insightsUsed ?? 0,
                limit: usage.limit ?? 1,
                remaining: usage.remaining ?? 0,
                isPro: !!usage.isPro,
              }
            : undefined,
        };
      }
      return {
        success: false,
        error: (response as any).error || (response as any).message || 'فشل في جلب الرؤى الذكية',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل في جلب الرؤى الذكية';
      return { success: false, error: message };
    }
  },

  /**
   * AI goal plan – خطة ونصائح لتحقيق هدف مالي
   * Now includes user's actual financial data (income, expenses) for realistic analysis
   */
  async getGoalPlan(payload: {
    goal: {
      title: string;
      targetAmount: number;
      currentAmount: number;
      targetDate?: string | null;
      category: string;
    };
    currency?: string;
    userFinancialData?: {
      currentMonth: {
        totalIncome: number;
        totalExpenses: number;
        balance: number;
        expenses: Array<Record<string, unknown>>;
        income: Array<Record<string, unknown>>;
        byCategory: Array<{ category: string; amount: number; percentage: number }>;
        /** إجمالي الفواتير المستحقة هذا الشهر */
        billsDueTotal?: number;
        /** تقدير المصروفات الدورية لهذا الشهر */
        recurringEstimatedTotal?: number;
      };
      previousMonth: {
        totalIncome: number;
        totalExpenses: number;
        balance: number;
      };
    };
  }): Promise<{
    success: boolean;
    data?: GoalPlanData;
    error?: string;
  }> {
    try {
      const response = await apiClient.post<{ success?: boolean; data?: GoalPlanData }>(
        API_ENDPOINTS.AI.GOAL_PLAN,
        payload
      );
      const data = response.data?.data ?? response.data;
      if (response.success && data) {
        return { success: true, data: data as GoalPlanData };
      }
      return {
        success: false,
        error: (response as any).error || (response as any).message || 'فشل في إنشاء الخطة',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'فشل في إنشاء الخطة';
      return { success: false, error: message };
    }
  },
};

export interface GoalPlanData {
  message: string;
  planSteps: string[];
  tips: string[];
  suggestedMonthlySaving: number | null;
}
