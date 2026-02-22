import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REFERRAL_MODAL_DISMISSED_KEY = '@dnanir_referral_dismissed';

export interface ReferralInfo {
    referralCode: string;
    referralCount: number;
    rewardDays: number;
}

export const referralService = {
    /**
     * Get current user's referral information
     */
    async getInfo(): Promise<{ success: boolean; data?: ReferralInfo; error?: string }> {
        const response = await apiClient.get<any>(API_ENDPOINTS.REFERRAL.INFO);

        if (response.success && response.data) {
            return {
                success: true,
                data: response.data.data
            };
        }

        return {
            success: false,
            error: response.error || 'فشل جلب بيانات الإحالة'
        };
    },

    /**
     * Apply a referral code from a friend
     */
    async applyCode(code: string): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
        const response = await apiClient.post<any>(API_ENDPOINTS.REFERRAL.APPLY, { code });

        if (response.success && response.data) {
            // Mark as dismissed locally if successfully applied
            await this.markDismissed();

            return {
                success: true,
                message: response.data.message,
                data: response.data.data
            };
        }

        return {
            success: false,
            error: response.error || 'فشل تفعيل كود الإحالة'
        };
    },

    /**
     * Check if the user has already dismissed the referral modal
     */
    async isDismissed(): Promise<boolean> {
        const value = await AsyncStorage.getItem(REFERRAL_MODAL_DISMISSED_KEY);
        return value === 'true';
    },

    /**
     * Mark the referral modal as dismissed
     */
    async markDismissed(): Promise<void> {
        await AsyncStorage.setItem(REFERRAL_MODAL_DISMISSED_KEY, 'true');
    }
};
