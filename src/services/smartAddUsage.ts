/**
 * Smart Add Usage Limiter
 * Now uses SERVER-SIDE tracking (usage stored in database, not local)
 * Local check only for login status
 * Pro users: 10 uses/day | Free users: 1 use total (lifetime)
 */

import { authStorage } from './authStorage';
import { getServerSmartAddUsage, SmartAddUsageFromServer } from './geminiService';

export const checkIsLoggedIn = async (): Promise<boolean> => {
    try {
        const token = await authStorage.getAccessToken();
        return !!token;
    } catch {
        return false;
    }
};

export const checkIsPro = async (): Promise<boolean> => {
    try {
        const user = await authStorage.getUser<{ isPro?: boolean; is_pro?: boolean }>();
        return user?.isPro === true || (user as any)?.is_pro === true;
    } catch {
        return false;
    }
};

export interface SmartAddUsageInfo {
    isLoggedIn: boolean;
    isPro: boolean;
    used: number;
    limit: number;
    remaining: number;
    canUse: boolean;
}

export const getSmartAddUsageInfo = async (): Promise<SmartAddUsageInfo> => {
    const isLoggedIn = await checkIsLoggedIn();
    const isPro = await checkIsPro();

    if (!isLoggedIn) {
        return { isLoggedIn, isPro, used: 0, limit: 0, remaining: 0, canUse: false };
    }

    // Get usage from server
    try {
        const serverUsage = await getServerSmartAddUsage();
        if (serverUsage) {
            return {
                isLoggedIn,
                isPro: serverUsage.isPro,
                used: serverUsage.used,
                limit: serverUsage.limit,
                remaining: serverUsage.remaining,
                canUse: serverUsage.remaining > 0,
            };
        }
    } catch {
        // Server unreachable, fallback to local estimate
    }

    // Fallback: allow usage (server will enforce limits)
    return {
        isLoggedIn,
        isPro,
        used: 0,
        limit: isPro ? 10 : 1,
        remaining: isPro ? 10 : 1,
        canUse: true,
    };
};

// No longer needed locally — server handles increment
export const incrementSmartAddUsage = async (): Promise<void> => {
    // Server-side increment happens automatically when parsing succeeds
};
