import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../config/api';
import { authStorage } from './authStorage';
import * as SecureStore from 'expo-secure-store';
import { 
  encryptForStorage, 
  decryptFromStorage, 
  isEncryptedEnvelope, 
  isEncryptionReady, 
  waitForEncryptionReady 
} from '../utils/encryption';
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
  markSavingsSynced,
  markSavingsTransactionsSynced,
  markDebtorsSynced,
  markDebtPaymentsSynced,
  markDebtInstallmentsSynced,
  markBillPaymentsSynced,
  markWalletsSynced,
  markSubscriptionsSynced,
} from '../database/database';

export type SyncResult =
  | { success: true; synced: { expenses: number; income: number } }
  | { success: false; error: string; code?: 'NOT_AUTHENTICATED' | 'NOT_PRO' | 'NETWORK' };

export type FullSyncResult =
  | { success: true; exportedAt?: string; count?: number }
  | { success: false; error: string; code?: 'NOT_AUTHENTICATED' | 'NOT_PRO' | 'NETWORK' | 'NO_BACKUP' | 'BACKUP_OLDER'; serverData?: any };

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

    if (!await waitForEncryptionReady(15_000)) {
      return { success: false, error: 'مفتاح التشفير غير متاح. يرجى تسجيل الخروج وإعادة تسجيل الدخول.', code: 'NETWORK' };
    }

    const [expenses, income] = await Promise.all([
      getUnsyncedExpenses(),
      getUnsyncedIncome(),
    ]);

    if (expenses.length === 0 && income.length === 0) {
      return { success: true, synced: { expenses: 0, income: 0 } };
    }

    // Encrypt each record's sensitive data before sending to server
    const encryptedExpenses = await Promise.all(
      expenses.map(async (e) => ({
        localId: e.id,
        data: await encryptForStorage({
          title: e.title,
          amount: e.amount,
          base_amount: e.base_amount,
          category: e.category,
          date: e.date,
          description: e.description ?? null,
          currency: e.currency ?? 'IQD',
          receipt_image_path: e.receipt_image_path ?? null,
        }),
      }))
    );

    const encryptedIncome = await Promise.all(
      income.map(async (i) => ({
        localId: i.id,
        data: await encryptForStorage({
          source: i.source,
          amount: i.amount,
          base_amount: i.base_amount,
          date: i.date,
          description: i.description ?? null,
          currency: i.currency ?? 'IQD',
          category: i.category ?? 'other',
        }),
      }))
    );

    const wrapped_dek = await SecureStore.getItemAsync('dnanir_dek_wrapped');

    const payload = { 
      expenses: encryptedExpenses, 
      income: encryptedIncome,
      wrapped_dek: wrapped_dek || undefined
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

    if (!await waitForEncryptionReady(15_000)) {
      return { success: false, error: 'مفتاح التشفير غير متاح. يرجى تسجيل الخروج وإعادة تسجيل الدخول.', code: 'NETWORK' };
    }

    const rawPayload = await exportFullData();
    // Encrypt entire backup. includeWrappedDek=true embeds the DEK wrapper so the
    // user can restore on a new device using only their password + userId.
    const encryptedData = await encryptForStorage(rawPayload, true) as Record<string, unknown>;

    const wrapped_dek = await SecureStore.getItemAsync('dnanir_dek_wrapped');

    const payload = { 
      data: encryptedData,
      wrapped_dek: wrapped_dek || undefined
    };

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
    const exportedAt = response.data?.data?.exportedAt || (rawPayload.exportedAt as string) || new Date().toISOString();
    
    // Save lastFullSyncAt locally to track data age
    try {
      const { getDb } = await import('../database/database');
      await getDb().runAsync('UPDATE app_settings SET lastFullSyncAt = ?', [exportedAt]);
    } catch (e) {
      console.log('[Sync] Failed to save lastFullSyncAt', e);
    }

    return { success: true, exportedAt };
  } catch (err: any) {
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

    if (!await waitForEncryptionReady(15_000)) {
      return { success: false, error: 'مفتاح التشفير غير متاح. يرجى تسجيل الخروج وإعادة تسجيل الدخول.', code: 'NETWORK' };
    }

    const { items } = await exportNewDataOnly();
    let syncedCount = 0;

    if (items.length > 0) {
      // Encrypt each item's data field before sending to server
      const encryptedItems = await Promise.all(
        items.map(async (item) => ({
          type: item.type,
          localId: item.localId,
          data: await encryptForStorage(item.data),
        }))
      );

      const wrapped_dek = await SecureStore.getItemAsync('dnanir_dek_wrapped');

      const response = await apiClient.post<{
        success?: boolean;
        data?: { count?: number };
        error?: string;
        message?: string;
      }>(API_ENDPOINTS.SYNC.ITEMS, { 
        items: encryptedItems,
        wrapped_dek: wrapped_dek || undefined
      });

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
      if (byType('savings').length) await markSavingsSynced(byType('savings'));
      if (byType('savings_transaction').length) await markSavingsTransactionsSynced(byType('savings_transaction'));
      if (byType('debtor').length) await markDebtorsSynced(byType('debtor'));
      if (byType('debt_payment').length) await markDebtPaymentsSynced(byType('debt_payment'));
      if (byType('debt_installment').length) await markDebtInstallmentsSynced(byType('debt_installment'));
      if (byType('bill_payment').length) await markBillPaymentsSynced(byType('bill_payment'));
      if (byType('wallet').length) await markWalletsSynced(byType('wallet'));
      if (byType('subscription').length) await markSubscriptionsSynced(byType('subscription'));
    }

    return { success: true, count: syncedCount };
  } catch (err: any) {
    const message = err?.message || err?.error || 'فشل في مزامنة البيانات';
    return { success: false, error: message, code: 'NETWORK' };
  }
}

export type RestoreFromServerResult =
  | { success: true }
  | { success: false; error: string; code?: 'NOT_AUTHENTICATED' | 'NOT_PRO' | 'NETWORK' | 'NO_BACKUP' | 'BACKUP_OLDER'; serverData?: any };

/**
 * Restore full data from server (Pro only). Replaces local data with server snapshot.
 */
export async function getFullFromServer(force: boolean = false): Promise<RestoreFromServerResult> {
  console.log('[Sync] Starting full restore from server...');
  try {
    const token = await apiClient.getAccessToken();
    if (!token) {
      console.log('[Sync] Failed: No access token');
      return { success: false, error: 'يجب تسجيل الدخول أولاً', code: 'NOT_AUTHENTICATED' };
    }

    const user = await authStorage.getUser<{ isPro?: boolean }>();
    if (!user?.isPro) {
      console.log('[Sync] Failed: User is not Pro');
      return {
        success: false,
        error: 'استعادة البيانات من السيرفر متاحة لمشتركي الخطة المميزة فقط',
        code: 'NOT_PRO',
      };
    }

    const { waitForEncryptionReady } = await import('../utils/encryption');
    console.log('[Sync] Waiting for encryption engine...');
    const isReady = await waitForEncryptionReady(10000);
    if (!isReady) {
      console.log('[Sync] Failed: Encryption timeout');
      return { success: false, error: 'مفتاح التشفير غير جاهز. يرجى المحاولة لاحقاً.', code: 'NETWORK' };
    }

    console.log('[Sync] Fetching full backup from API...');
    const response = await apiClient.get<any>(API_ENDPOINTS.SYNC.FULL);
    
    if (!response.success || !response.data) {
      console.log('[Sync] Failed: No backup data found', response);
      const msg = response.error || 'لا توجد نسخة احتياطية على السيرفر';
      return { success: false, error: msg, code: 'NO_BACKUP' };
    }

    const { decryptFromStorage, isEncryptedEnvelope } = await import('../utils/encryption');
    let serverBody = response.data;
    let payload: Record<string, any> = {};

    try {
      // Handle new wrapped DEK if present — try to adopt it so we can decrypt backup data
      if (serverBody.wrapped_dek) {
        console.log('[Sync] New wrapped DEK found from server, attempting to adopt...');
        // Diagnostic: log the wrapped DEK shape
        const wdek = serverBody.wrapped_dek;
        console.log(`[Sync] 🔍 wrapped_dek type: ${typeof wdek}, length: ${wdek?.length}, starts: ${typeof wdek === 'string' ? wdek.substring(0, 40) + '...' : JSON.stringify(wdek).substring(0, 80)}`);
        
        const SecureStore = await import('expo-secure-store');
        await SecureStore.setItemAsync('dnanir_dek_wrapped', serverBody.wrapped_dek);
        
        // Try to unwrap the backup's DEK using the cached KEK from login
        const { adoptWrappedDEK } = await import('../utils/encryption');
        const adopted = await adoptWrappedDEK(serverBody.wrapped_dek);
        if (adopted) {
          console.log('[Sync] ✅ Session DEK swapped to backup DEK — decryption should succeed');
        } else {
          console.log('[Sync] ⚠️ Could not adopt backup DEK — encrypted items may fail to decrypt');
        }
      }

      // Diagnostic: dump the shape of the first encrypted item for debugging
      const diagData = serverBody.data || serverBody;
      for (const tbl of ['expenses', 'income', 'wallets', 'custom_categories']) {
        const arr = diagData[tbl];
        if (Array.isArray(arr) && arr.length > 0) {
          const sample = arr[0];
          console.log(`[Sync] 🔍 Sample ${tbl}[0] keys: ${Object.keys(sample).join(', ')}`);
          console.log(`[Sync] 🔍 Sample ${tbl}[0] _enc: ${sample._enc}, v: ${sample.v}, payload type: ${typeof sample.payload}, payload len: ${sample.payload?.length}`);
          if (typeof sample.payload === 'string') {
            console.log(`[Sync] 🔍 Sample ${tbl}[0] payload starts: ${sample.payload.substring(0, 50)}...`);
          }
          break; // only need one sample
        }
      }

      // Determine the raw data to decrypt
      // The backup can be nested: { success: true, data: { data: "AES...", ... } }
      // Or plain: { achievements: [], ... }
      let rawData = serverBody.data || serverBody;

      // Handle legacy double-nested format: { data: encryptedBlob, wrapped_dek }
      // Old server code stored the entire request body, not just the encrypted blob.
      // Detect and unwrap: if rawData is not an encrypted envelope but rawData.data is, use rawData.data
      if (!isEncryptedEnvelope(rawData) && rawData && typeof rawData === 'object' && isEncryptedEnvelope((rawData as any).data)) {
        rawData = (rawData as any).data;
      }

      // If rawData is already a proper backup object (has tables), we use it directly
      // Otherwise if it's an encrypted envelope (string or object with 'cipher'), we decrypt it
      if (isEncryptedEnvelope(rawData)) {
        console.log('[Sync] Step 1: Decrypting main payload...');
        try {
          const decoded = await decryptFromStorage(rawData);
          payload = decoded as Record<string, unknown>;
        } catch (err) {
          console.log('[Sync] Decrypting main payload FAILED', err);
          throw err;
        }
      } else {
        console.log('[Sync] Payload appears to be already decrypted or plain.');
        payload = rawData as Record<string, any>;
      }

    // Verify it looks like a backup (should have exportedAt or some tables)
    if (!payload || (typeof payload === 'object' && Object.keys(payload).length < 2)) {
       console.log('[Sync] Failed: Decoded payload is invalid', payload);
       return { success: false, error: 'النسخة الاحتياطية تالفة أو غير صالحة', code: 'NO_BACKUP' };
    }

    console.log('[Sync] Step 2: Decrypting individual items...');
    const keys = Object.keys(payload);
    for (const key of keys) {
      const list = payload[key];
      if (Array.isArray(list)) {
        const encryptedCount = list.filter(item => isEncryptedEnvelope(item)).length;
        const plainCount = list.length - encryptedCount;
        console.log(`[Sync] Decrypting ${list.length} items for table: ${key} (${encryptedCount} encrypted, ${plainCount} plain)`);
        
        let failedCount = 0;
        const decrypted: any[] = [];
        
        for (const item of list) {
          if (isEncryptedEnvelope(item)) {
            try {
              const result = await decryptFromStorage(item);
              decrypted.push(result);
            } catch (e) {
              failedCount++;
              // Skip this item entirely — inserting the raw envelope would
              // cause NOT NULL constraint failures (debtId, billId, etc.)
            }
          } else {
            decrypted.push(item);
          }
        }
        
        if (failedCount > 0) {
          console.log(`[Sync] ⚠️ ${key}: ${failedCount}/${list.length} items could not be decrypted and were SKIPPED (key mismatch or corrupted data)`);
        }
        
        payload[key] = decrypted;
      }
    }

      console.log('[Sync] Step 3: Importing into database...');
      const { importFullData } = await import('../database/database');
      await importFullData(payload, force);

      console.log('[Sync] Full restoration SUCCESSFUL');
      return { success: true };
    } catch (err: any) {
      if (err.message === 'BACKUP_OLDER_THAN_CURRENT') {
        return { success: false, error: 'النسخة الاحتياطية أقدم من البيانات الحالية على جهازك', code: 'BACKUP_OLDER', serverData: payload };
      }
      throw err;
    }
  } catch (err: any) {
    console.log('[Sync] Full restoration CRITICAL ERROR', err);
    const message = err?.message || err?.error || 'فشل في استعادة البيانات';
    return { success: false, error: message, code: 'NETWORK' };
  }
}

/**
 * Delete all sync data for the current user from the server.
 */
export async function deleteSyncDataFromServer(): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await apiClient.getAccessToken();
    if (!token) return { success: true }; // Not logged in, nothing to delete on server

    const response = await apiClient.delete(API_ENDPOINTS.SYNC.DELETE_DATA);

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'فشل في حذف البيانات من السيرفر',
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'فشل في حذف البيانات من السيرفر' };
  }
}
