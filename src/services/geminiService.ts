/**
 * Gemini AI Service for Smart Transaction Parsing
 * Routes through the server (API key stays on server)
 * Falls back to local parsing if server is unreachable
 */

import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import { getCustomCategories, CustomCategory } from '../database/database';
import { CATEGORY_DISPLAY_NAMES } from '../utils/iraqi-language-pack';

export interface GeminiTransaction {
    title: string;
    amount: number;
    type: 'expense' | 'income';
    category: string;
}

export interface SmartAddUsageFromServer {
    isPro: boolean;
    used: number;
    limit: number;
    remaining: number;
}

// Built-in categories
const BUILTIN_EXPENSE_CATEGORIES = ['food', 'transport', 'shopping', 'bills', 'health', 'education', 'entertainment', 'home', 'other'];
const BUILTIN_INCOME_CATEGORIES = ['salary', 'business', 'freelance', 'gift', 'investment', 'other'];

export const parseWithGemini = async (text: string): Promise<GeminiTransaction[] | null> => {
    // Load custom categories to send to server
    let categories: { key: string; name: string }[] = [];
    try {
        const customCategories = await getCustomCategories();
        console.log(`[Gemini] Loaded ${customCategories.length} custom categories`);

        // Build categories list (built-in + custom)
        categories = [
            ...BUILTIN_EXPENSE_CATEGORIES.map(key => ({ key, name: CATEGORY_DISPLAY_NAMES[key] || key })),
            ...BUILTIN_INCOME_CATEGORIES.map(key => ({ key, name: CATEGORY_DISPLAY_NAMES[key] || key })),
            ...customCategories.map(c => ({ key: c.name, name: c.name })),
        ];
    } catch (e) {
        console.log('[Gemini] Could not load custom categories, using built-in only');
        categories = [
            ...BUILTIN_EXPENSE_CATEGORIES.map(key => ({ key, name: CATEGORY_DISPLAY_NAMES[key] || key })),
            ...BUILTIN_INCOME_CATEGORIES.map(key => ({ key, name: CATEGORY_DISPLAY_NAMES[key] || key })),
        ];
    }

    try {
        console.log('[Gemini] Sending request to server...');

        const response = await apiClient.post<{
            success?: boolean;
            data?: GeminiTransaction[];
            message?: string;
            usage?: SmartAddUsageFromServer;
        }>(API_ENDPOINTS.AI.SMART_ADD, { text, categories });

        const result = response.data as any;

        if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
            console.log(`[Gemini] ✅ Server returned ${result.data.length} valid transactions`);
            result.data.forEach((t: GeminiTransaction, i: number) =>
                console.log(`  [${i}]: "${t.title}" - ${t.amount} IQD (${t.type}/${t.category})`)
            );
            return result.data;
        }

        if (result?.message) {
            console.log(`[Gemini] Server message: ${result.message}`);
        }

        return null;
    } catch (error: any) {
        console.error('[Gemini] Server request failed:', error.message);
        return null;
    }
};

/**
 * Get smart add usage from server
 */
export const getServerSmartAddUsage = async (): Promise<SmartAddUsageFromServer | null> => {
    try {
        const response = await apiClient.get<{
            success?: boolean;
            data?: SmartAddUsageFromServer;
        }>(API_ENDPOINTS.AI.SMART_ADD_USAGE);

        const result = response.data as any;
        if (result?.success && result.data) {
            return result.data;
        }
        return null;
    } catch {
        return null;
    }
};
