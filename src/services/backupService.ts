/**
 * Internal backup: export data to a local file and optionally share it.
 * Restore: from last saved backup file (same app install), from picked file, or from server (Pro).
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportFullData, importFullData } from '../database/database';

const BACKUP_FILENAME = 'dnanir-backup.json';

function getBackupPath(): string {
  const dir = FileSystem.documentDirectory || '';
  const date = new Date().toISOString().slice(0, 10);
  return `${dir}dnanir-backup-${date}.json`;
}

export type LocalBackupResult =
  | { success: true; path: string }
  | { success: false; error: string };

/**
 * Create a full backup and save to app directory. Optionally share so user can save to Files/iCloud.
 */
export async function createLocalBackup(): Promise<LocalBackupResult> {
  try {
    const data = await exportFullData();
    const path = getBackupPath();
    await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2), {
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
  | { success: false; error: string };

/**
 * Restore from the last backup file (same path we write to). Use after createLocalBackup without deleting app.
 * For restore after reinstall, user should use "استعادة من السيرفر" (Pro) or re-import the shared file if we add picker later.
 */
export async function restoreFromLastLocalBackup(): Promise<RestoreFromLocalResult> {
  try {
    const path = getBackupPath();
    const exists = await FileSystem.getInfoAsync(path, { size: false });
    if (!exists.exists) {
      return { success: false, error: 'لا توجد نسخة احتياطية محلية. أنشئ نسخة أولاً من الإعدادات.' };
    }
    const content = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const data = JSON.parse(content) as Record<string, unknown>;
    await importFullData(data);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل في استعادة النسخة الاحتياطية' };
  }
}

/**
 * Restore from a backup file at the given URI (e.g. from document picker or shared path).
 */
export async function restoreFromFileUri(uri: string): Promise<RestoreFromLocalResult> {
  try {
    const content = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const data = JSON.parse(content) as Record<string, unknown>;
    if (!data || typeof data !== 'object' || !('version' in data || 'expenses' in data)) {
      return { success: false, error: 'ملف غير صالح. اختر ملف نسخة احتياطية من دنانير.' };
    }
    await importFullData(data);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل في استعادة النسخة الاحتياطية' };
  }
}

/**
 * Open system document picker to choose a backup file, then restore from it.
 * Uses copyToCacheDirectory so FileSystem can read the file.
 */
export async function pickBackupFileAndRestore(): Promise<RestoreFromLocalResult> {
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
    return await restoreFromFileUri(uri);
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل في فتح الملف أو استعادته' };
  }
}
