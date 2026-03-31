import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';

export interface Plan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationValue: number;
  durationUnit: 'day' | 'month' | 'year';
  type: 'recurring' | 'one_time';
  isActive: boolean;
  features?: string[];
}

export interface PaymentSession {
  paymentUrl: string;
  transactionId: string;
}

export const plansService = {
  async getPlans(): Promise<{ success: boolean; data?: Plan[]; error?: string }> {
    const response = await apiClient.get<any>(API_ENDPOINTS.PLANS, false);
    if (response.success && response.data) {
      const plans: Plan[] = response.data.data ?? response.data;
      return { success: true, data: Array.isArray(plans) ? plans : [] };
    }
    return { success: false, error: response.error || 'فشل جلب الباقات' };
  },

  async createPaymentSession(
    planId: string,
    successUrl: string,
  ): Promise<{ success: boolean; data?: PaymentSession; error?: string }> {
    const response = await apiClient.post<any>(API_ENDPOINTS.PAYMENTS.CREATE_SESSION, {
      planId,
      successUrl,
    });
    if (response.success && response.data) {
      const session: PaymentSession = response.data.data ?? response.data;
      return { success: true, data: session };
    }
    return { success: false, error: response.error || 'فشل إنشاء جلسة الدفع' };
  },
};
