import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import { authStorage } from './authStorage';
import {
  getUnsyncedExpenses,
  getUnsyncedIncome,
  markExpensesSynced,
  markIncomeSynced,
  markAllExpensesAndIncomeSynced,
  exportFullData,
  exportNewDataOnly,
  markFinancialGoalsSynced,
  markCustomCategoriesSynced,
  markBudgetsSynced,
  markRecurringExpensesSynced,
  markDebtsSynced,
  markBillsSynced,
  markChallengesSynced,
  markAchievementsSynced,
  markExpenseShortcutsSynced,
  markIncomeShortcutsSynced,
  markNotificationsSynced,
  markUserSettingsSynced,
  markAppSettingsSynced,
  markNotificationSettingsSynced,
} from '../database/database';

export type SyncResult =
  | { success: true; synced: { expenses: number; income: number } }
  | { success: false; error: string; code?: 'NOT_AUTHENTICATED' | 'NOT_PRO' | 'NETWORK' };

export type FullSyncResult =
  | { success: true; exportedAt: string }
  | { success: false; error: string; code?: 'NOT_AUTHENTICATED' | 'NOT_PRO' | 'NETWORK' };

export type NewSyncResult =
  | { success: true; count: number }
  | { success: false; error: string; code?: 'NOT_AUTHENTICATED' | 'NOT_PRO' | 'NETWORK' };

/**
 * Upload unsynced expenses and income to the server.
 * Requires: user logged in + Pro (user.isPro from server).
 */
export async function syncToServer(): Promise<SyncResult> {
  try {
    const token = await apiClient.getAccessToken();
    if (!token) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً', code: 'NOT_AUTHENTICATED' };
    }

    const user = await authStorage.getUser<{ isPro?: boolean }>();
    if (!user?.isPro) {
      return {
        success: false,
        error: 'مزامنة البيانات متاحة للمشتركين في الخطة البرو فقط',
        code: 'NOT_PRO',
      };
    }

    const [expenses, income] = await Promise.all([
      getUnsyncedExpenses(),
      getUnsyncedIncome(),
    ]);

    if (expenses.length === 0 && income.length === 0) {
      return { success: true, synced: { expenses: 0, income: 0 } };
    }

    const payload = {
      expenses: expenses.map((e) => ({
        localId: e.id,
        title: e.title,
        amount: e.amount,
        base_amount: e.base_amount,
        category: e.category,
        date: e.date,
        description: e.description ?? null,
        currency: e.currency ?? 'IQD',
        receipt_image_path: e.receipt_image_path ?? null,
      })),
      income: income.map((i) => ({
        localId: i.id,
        source: i.source,
        amount: i.amount,
        base_amount: i.base_amount,
        date: i.date,
        description: i.description ?? null,
        currency: i.currency ?? 'IQD',
        category: i.category ?? 'other',
      })),
    };

    const response = await apiClient.post<{
      data?: { synced?: { expenses: number; income: number } };
      success?: boolean;
      error?: string;
      message?: string;
    }>(API_ENDPOINTS.SYNC.UPLOAD, payload);

    if (!response.success || !response.data?.data?.synced) {
      const msg =
        response.error ||
        response.message ||
        (response.data as any)?.message ||
        'فشل في مزامنة البيانات';
      return { success: false, error: msg, code: 'NETWORK' };
    }

    const { expenses: expCount, income: incCount } = response.data.data.synced;
    if (expenses.length > 0) {
      await markExpensesSynced(expenses.map((e) => e.id));
    }
    if (income.length > 0) {
      await markIncomeSynced(income.map((i) => i.id));
    }

    return {
      success: true,
      synced: { expenses: expCount, income: incCount },
    };
  } catch (err: any) {
    const message = err?.message || err?.error || 'فشل في مزامنة البيانات';
    return { success: false, error: message, code: 'NETWORK' };
  }
}

/**
 * Returns whether there is any unsynced data (for UI badge or prompt).
 */
export async function hasUnsyncedData(): Promise<boolean> {
  try {
    const [expenses, income] = await Promise.all([
      getUnsyncedExpenses(),
      getUnsyncedIncome(),
    ]);
    return expenses.length > 0 || income.length > 0;
  } catch {
    return false;
  }
}

/**
 * Full backup: export entire DB to JSON and upload to server (Pro only).
 * One snapshot = expenses, income, bills, budgets, goals, debts, settings, etc.
 */
export async function syncFullToServer(): Promise<FullSyncResult> {
  try {
    const token = await apiClient.getAccessToken();
    if (!token) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً', code: 'NOT_AUTHENTICATED' };
    }

    const user = await authStorage.getUser<{ isPro?: boolean }>();
    if (!user?.isPro) {
      return {
        success: false,
        error: 'مزامنة البيانات متاحة للمشتركين في الخطة البرو فقط',
        code: 'NOT_PRO',
      };
    }

    const payload = await exportFullData();
    if (__DEV__) {
      const keys = Object.keys(payload).filter(k => Array.isArray((payload as any)[k])).map(k => `${k}:${(payload as any)[k].length}`);
      console.log('[sync] POST full payload keys:', keys);
    }
    const response = await apiClient.post<{
      success?: boolean;
      data?: { exportedAt?: string };
      error?: string;
      message?: string;
    }>(API_ENDPOINTS.SYNC.FULL, payload);

    if (!response.success) {
      const msg =
        response.error ||
        response.message ||
        (response.data as any)?.message ||
        'فشل في رفع النسخة الاحتياطية';
      return { success: false, error: msg, code: 'NETWORK' };
    }

    await markAllExpensesAndIncomeSynced();
    const exportedAt = response.data?.data?.exportedAt || (payload.exportedAt as string) || new Date().toISOString();
    if (__DEV__) console.log('[sync] POST full success', exportedAt);
    return { success: true, exportedAt };
  } catch (err: any) {
    if (__DEV__) console.error('[sync] syncFullToServer error:', err?.message ?? err);
    const message = err?.message || err?.error || 'فشل في رفع النسخة الاحتياطية';
    return { success: false, error: message, code: 'NETWORK' };
  }
}

/**
 * Incremental sync: upload only new (unsynced) data to server. Server adds/updates items, does not replace.
 * Use this for manual sync and on app foreground (instead of full backup).
 */
export async function syncNewToServer(): Promise<NewSyncResult> {
  try {
    const token = await apiClient.getAccessToken();
    if (!token) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً', code: 'NOT_AUTHENTICATED' };
    }

    const user = await authStorage.getUser<{ isPro?: boolean }>();
    if (!user?.isPro) {
      return {
        success: false,
        error: 'مزامنة البيانات متاحة للمشتركين في الخطة البرو فقط',
        code: 'NOT_PRO',
      };
    }

    const { items } = await exportNewDataOnly();
    let syncedCount = 0;

    if (items.length > 0) {
      const response = await apiClient.post<{
        success?: boolean;
        data?: { count?: number };
        error?: string;
        message?: string;
      }>(API_ENDPOINTS.SYNC.ITEMS, { items });

      if (!response.success) {
        const msg =
          response.error ||
          response.message ||
          (response.data as any)?.message ||
          'فشل في مزامنة البيانات';
        return { success: false, error: msg, code: 'NETWORK' };
      }

      syncedCount = response.data?.data?.count ?? items.length;

      const byType = (type: string) => items.filter((i) => i.type === type).map((i) => i.localId);
      if (byType('expense').length) await markExpensesSynced(byType('expense'));
      if (byType('income').length) await markIncomeSynced(byType('income'));
      if (byType('financial_goal').length) await markFinancialGoalsSynced(byType('financial_goal'));
      if (byType('custom_category').length) await markCustomCategoriesSynced(byType('custom_category'));
      if (byType('budget').length) await markBudgetsSynced(byType('budget'));
      if (byType('recurring_expense').length) await markRecurringExpensesSynced(byType('recurring_expense'));
      if (byType('debt').length) await markDebtsSynced(byType('debt'));
      if (byType('bill').length) await markBillsSynced(byType('bill'));
      if (byType('challenge').length) await markChallengesSynced(byType('challenge'));
      if (byType('achievement').length) await markAchievementsSynced(byType('achievement'));
      if (byType('expense_shortcut').length) await markExpenseShortcutsSynced(byType('expense_shortcut'));
      if (byType('income_shortcut').length) await markIncomeShortcutsSynced(byType('income_shortcut'));
      if (byType('notification').length) await markNotificationsSynced(byType('notification'));
      if (byType('user_settings').length) await markUserSettingsSynced(byType('user_settings'));
      if (byType('app_settings').length) await markAppSettingsSynced(byType('app_settings'));
      if (byType('notification_settings').length) await markNotificationSettingsSynced(byType('notification_settings'));
    }

    if (__DEV__) console.log('[sync] incremental done, syncedCount:', syncedCount);
    return { success: true, count: syncedCount };
  } catch (err: any) {
    if (__DEV__) console.error('[sync] syncNewToServer error:', err?.message ?? err);
    const message = err?.message || err?.error || 'فشل في مزامنة البيانات';
    return { success: false, error: message, code: 'NETWORK' };
  }
}

export type RestoreFromServerResult =
  | { success: true }
  | { success: false; error: string; code?: 'NOT_AUTHENTICATED' | 'NOT_PRO' | 'NETWORK' | 'NO_BACKUP' };

/**
 * Restore full data from server (Pro only). Replaces local data with server snapshot.
 */
export async function getFullFromServer(): Promise<RestoreFromServerResult> {
  try {
    const token = await apiClient.getAccessToken();
    if (!token) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً', code: 'NOT_AUTHENTICATED' };
    }

    const user = await authStorage.getUser<{ isPro?: boolean }>();
    if (!user?.isPro) {
      return {
        success: false,
        error: 'استعادة البيانات من السيرفر متاحة لمشتركي الخطة المميزة فقط',
        code: 'NOT_PRO',
      };
    }

    const response = await apiClient.get<{ success?: boolean; data?: Record<string, unknown>; exportedAt?: string }>(
      API_ENDPOINTS.SYNC.FULL
    );

    if (__DEV__) {
      console.log('[sync] GET full response:', {
        success: response.success,
        hasData: !!response.data,
        hasDataData: !!(response as any).data?.data,
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
      });
    }

    if (!response.success || !response.data?.data) {
      const msg =
        (response as any).message ||
        (response as any).error ||
        'لا توجد نسخة احتياطية على السيرفر';
      if (__DEV__) console.warn('[sync] GET full failed:', msg);
      return { success: false, error: msg, code: response.success === false ? 'NO_BACKUP' : 'NETWORK' };
    }

    const payload = response.data.data as Record<string, unknown>;
    const counts = {
      expenses: (payload.expenses as any[])?.length ?? 0,
      income: (payload.income as any[])?.length ?? 0,
    };
    if (__DEV__) console.log('[sync] GET full importing:', counts);

    const { importFullData } = await import('../database/database');
    await importFullData(payload);
    if (__DEV__) console.log('[sync] GET full import done');
    return { success: true };
  } catch (err: any) {
    if (__DEV__) console.error('[sync] GET full error:', err?.message ?? err);
    const message = err?.message || err?.error || 'فشل في استعادة البيانات';
    return { success: false, error: message, code: 'NETWORK' };
  }
}
