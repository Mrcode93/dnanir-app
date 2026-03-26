/**
 * Internal backup: export data to a local file and optionally share it.
 * Restore: from last saved backup file (same app install), from picked file, or from server (Pro).
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportFullData, importFullData } from '../database/database';
import { encryptForStorage, decryptFromStorage, waitForEncryptionReady } from '../utils/encryption';

const BACKUP_LATEST = 'dnanir-backup-latest.json';

function getBackupPath(): string {
  const dir = FileSystem.documentDirectory || '';
  const date = new Date().toISOString().slice(0, 10);
  return `${dir}dnanir-backup-${date}.json`;
}

function getLatestBackupPath(): string {
  const dir = FileSystem.documentDirectory || '';
  return `${dir}${BACKUP_LATEST}`;
}

export type LocalBackupResult =
  | { success: true; path: string }
  | { success: false; error: string };

/**
 * Create a full backup and save to app directory. Optionally share so user can save to Files/iCloud.
 * Also writes a stable "latest" copy so restore always finds the most recent backup.
 */
export async function createLocalBackup(): Promise<LocalBackupResult> {
  try {
    if (!await waitForEncryptionReady(15_000)) {
      return { success: false, error: 'مفتاح التشفير غير متاح. يرجى تسجيل الخروج وإعادة تسجيل الدخول لتفعيل التشفير.' };
    }
    const raw = await exportFullData();
    // Encrypt the backup before writing to disk
    const data = await encryptForStorage(raw);
    const jsonString = JSON.stringify(data, null, 2);
    const path = getBackupPath();

    // Write date-stamped backup
    await FileSystem.writeAsStringAsync(path, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Also write a stable "latest" copy so restore works regardless of date
    const latestPath = getLatestBackupPath();
    await FileSystem.writeAsStringAsync(latestPath, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, {
        mimeType: 'application/json',
        dialogTitle: 'حفظ النسخة الاحتياطية',
      });
    }
    return { success: true, path };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل في إنشاء النسخة الاحتياطية' };
  }
}

export type RestoreFromLocalResult =
  | { success: true }
  | { success: false; error: string; code?: 'BACKUP_OLDER'; data?: any };

/**
 * Restore from the last backup file.
 * Checks: today's backup → stable "latest" backup → scans for most recent dated backup.
 */
export async function restoreFromLastLocalBackup(force: boolean = false): Promise<RestoreFromLocalResult> {
  try {
    // 1. Try today's backup first
    const todayPath = getBackupPath();
    const todayExists = await FileSystem.getInfoAsync(todayPath);
    if (todayExists.exists) {
      return await restoreFromFileUri(todayPath, force);
    }

    // 2. Try the stable "latest" copy
    const latestPath = getLatestBackupPath();
    const latestExists = await FileSystem.getInfoAsync(latestPath);
    if (latestExists.exists) {
      return await restoreFromFileUri(latestPath, force);
    }

    // 3. Scan for any dnanir-backup-*.json files and pick the most recent
    const dir = FileSystem.documentDirectory || '';
    const files = await FileSystem.readDirectoryAsync(dir);
    const backupFiles = files
      .filter(f => f.startsWith('dnanir-backup-') && f.endsWith('.json') && f !== BACKUP_LATEST)
      .sort()
      .reverse(); // Most recent date first (YYYY-MM-DD sorts correctly)

    if (backupFiles.length > 0) {
      const mostRecent = `${dir}${backupFiles[0]}`;
      return await restoreFromFileUri(mostRecent, force);
    }

    return { success: false, error: 'لا توجد نسخة احتياطية محلية. أنشئ نسخة أولاً من الإعدادات.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل في استعادة النسخة الاحتياطية' };
  }
}

/**
 * Restore from a backup file at the given URI (e.g. from document picker or shared path).
 */
export async function restoreFromFileUri(uri: string, force: boolean = false): Promise<RestoreFromLocalResult> {
  try {
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'ملف غير صالح. اختر ملف نسخة احتياطية من دنانير.' };
    }
    // Decrypt if this backup was encrypted (backwards compatible with plain backups)
    const data = await decryptFromStorage<Record<string, unknown>>(parsed);
    if (!('version' in data || 'expenses' in data)) {
      return { success: false, error: 'ملف غير صالح. اختر ملف نسخة احتياطية من دنانير.' };
    }
    await importFullData(data, force);
    return { success: true };
  } catch (err: any) {
    if (err.message === 'BACKUP_OLDER_THAN_CURRENT') {
      // Re-read or use the already parsed data to return it
      const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = JSON.parse(content);
      const data = await decryptFromStorage<Record<string, unknown>>(parsed);
      return { success: false, error: 'النسخة الاحتياطية أقدم من البيانات الحالية على جهازك', code: 'BACKUP_OLDER', data };
    }
    return { success: false, error: err?.message || 'فشل في استعادة النسخة الاحتياطية' };
  }
}

/**
 * Open system document picker to choose a backup file, then restore from it.
 * Uses copyToCacheDirectory so FileSystem can read the file.
 */
export async function pickBackupFileAndRestore(force: boolean = false): Promise<RestoreFromLocalResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'public.json', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) {
      return { success: false, error: 'لم يتم اختيار ملف' };
    }
    const uri = result.assets[0].uri;
    return await restoreFromFileUri(uri, force);
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل في فتح الملف أو استعادته' };
  }
}
