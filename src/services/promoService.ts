import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';

export interface PromoResult {
    success: boolean;
    message?: string;
    data?: any;
    error?: string;
}

export const promoService = {
    /**
     * Apply a promo code
     * @param code The promo code string entered by the user
     */
    async applyCode(code: string): Promise<PromoResult> {
        if (!code || code.trim() === '') {
            return {
                success: false,
                error: 'يرجى إدخال كود البرومو'
            };
        }

        const response = await apiClient.post<any>(API_ENDPOINTS.PROMO.APPLY, { code: code.toUpperCase() });

        if (response.success && response.data) {
            return {
                success: true,
                message: response.data.message || 'تم تفعيل الكود بنجاح!',
                data: response.data.data
            };
        }

        let errorMessage = 'فشل تفعيل كود البرومو';
        if (response.error) {
            errorMessage = response.error;
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};
