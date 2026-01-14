import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';

export interface SubscriptionStatus {
  isPremium: boolean;
  subscriptionId?: string;
  status?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface CreateSubscriptionRequest {
  paymentMethodId: string;
}

export interface CreateSubscriptionResponse {
  subscription: any;
  clientSecret: string;
}

export interface CancelSubscriptionRequest {
  cancelAtPeriodEnd?: boolean;
}

/**
 * Subscription API Service
 */
export const subscriptionApiService = {
  /**
   * Get subscription status
   */
  async getStatus(): Promise<{ success: boolean; data?: SubscriptionStatus; error?: string }> {
    const response = await apiClient.get<SubscriptionStatus>(
      API_ENDPOINTS.SUBSCRIPTION.STATUS
    );

    if (response.success && response.data) {
      return {
        success: true,
        data: response.data,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to get subscription status',
    };
  },

  /**
   * Create premium subscription
   */
  async create(
    data: CreateSubscriptionRequest
  ): Promise<{ success: boolean; data?: CreateSubscriptionResponse; error?: string }> {
    const response = await apiClient.post<CreateSubscriptionResponse>(
      API_ENDPOINTS.SUBSCRIPTION.CREATE,
      data
    );

    if (response.success && response.data) {
      return {
        success: true,
        data: response.data,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to create subscription',
    };
  },

  /**
   * Cancel subscription
   */
  async cancel(
    data: CancelSubscriptionRequest = { cancelAtPeriodEnd: true }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const response = await apiClient.post(
      API_ENDPOINTS.SUBSCRIPTION.CANCEL,
      data
    );

    if (response.success && response.data) {
      return {
        success: true,
        data: response.data,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to cancel subscription',
    };
  },

  /**
   * Reactivate subscription
   */
  async reactivate(): Promise<{ success: boolean; data?: any; error?: string }> {
    const response = await apiClient.post(
      API_ENDPOINTS.SUBSCRIPTION.REACTIVATE,
      {}
    );

    if (response.success && response.data) {
      return {
        success: true,
        data: response.data,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to reactivate subscription',
    };
  },
};
