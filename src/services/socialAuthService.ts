import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { apiClient } from './apiClient';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export const socialAuthService = {
    /**
     * Verify Clerk session token on server
     * This sends the Clerk session token to your backend for verification
     */
    verifyClerkToken: async (sessionToken: string): Promise<SocialAuthResponse> => {
        try {
            const response = await apiClient.post<any>(
                API_ENDPOINTS.AUTH.CLERK,
                { sessionToken },
                false
            );

            if (!response.success) {
                return { success: false, error: response.error || 'Clerk login failed' };
            }

            return { success: true, data: response.data };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Verify Apple token on server (legacy - kept for backwards compatibility)
     */
    verifyAppleToken: async (identityToken: string, fullName?: any): Promise<SocialAuthResponse> => {
        try {
            const response = await apiClient.post<any>(
                API_ENDPOINTS.AUTH.APPLE,
                { identityToken, fullName },
                false
            );

            if (!response.success) {
                return { success: false, error: response.error || 'Apple login failed' };
            }

            return { success: true, data: response.data };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Verify Google token on server (legacy - kept for backwards compatibility)
     */
    verifyGoogleToken: async (token: string, tokenType: 'idToken' | 'accessToken' = 'idToken'): Promise<SocialAuthResponse> => {
        try {
            const payload = tokenType === 'idToken'
                ? { idToken: token }
                : { accessToken: token };

            const response = await apiClient.post<any>(
                API_ENDPOINTS.AUTH.GOOGLE,
                payload,
                false
            );

            if (!response.success) {
                return { success: false, error: response.error || 'Google login failed' };
            }

            return { success: true, data: response.data };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
};
