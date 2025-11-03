import * as SQLite from 'expo-sqlite';
import { Expense, Income } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('dinar_financial.db');
    
    // Create expenses table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT
      );
    `);

    // Create income table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT
      );
    `);

    // Create user settings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT,
        auth_method TEXT, -- 'biometric' | 'password' | 'none'
        password_hash TEXT,
        biometrics_enabled INTEGER DEFAULT 0
      );
    `);

    // Create app_settings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        notifications_enabled INTEGER DEFAULT 1, -- 0 for false, 1 for true
        dark_mode_enabled INTEGER DEFAULT 1, -- 0 for false, 1 for true
        auto_backup_enabled INTEGER DEFAULT 0, -- 0 for false, 1 for true
        currency TEXT DEFAULT 'دينار عراقي',
        language TEXT DEFAULT 'ar',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create notification_settings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        daily_reminder INTEGER DEFAULT 1, -- 0 for false, 1 for true
        daily_reminder_time TEXT DEFAULT '20:00', -- Format: HH:MM
        expense_reminder INTEGER DEFAULT 1, -- 0 for false, 1 for true
        income_reminder INTEGER DEFAULT 1, -- 0 for false, 1 for true
        weekly_summary INTEGER DEFAULT 1, -- 0 for false, 1 for true
        monthly_summary INTEGER DEFAULT 1, -- 0 for false, 1 for true
        transaction_notifications INTEGER DEFAULT 1, -- 0 for false, 1 for true
        budget_warnings INTEGER DEFAULT 1, -- 0 for false, 1 for true
        sound_enabled INTEGER DEFAULT 1, -- 0 for false, 1 for true
        vibration_enabled INTEGER DEFAULT 1, -- 0 for false, 1 for true
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create notification_log table for tracking sent notifications
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'daily_reminder', 'expense_reminder', 'income_reminder', etc.
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_action TEXT, -- 'opened', 'dismissed', 'ignored'
        data TEXT -- JSON string for additional data
      );
    `);

  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

// Expense operations
export const addExpense = async (expense: Omit<Expense, 'id'>): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.runAsync(
      'INSERT INTO expenses (title, amount, category, date, description) VALUES (?, ?, ?, ?, ?)',
      [expense.title, expense.amount, expense.category, expense.date, expense.description || '']
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
};

export const getExpenses = async (): Promise<Expense[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.getAllAsync('SELECT * FROM expenses ORDER BY date DESC');
    return result as Expense[];
  } catch (error) {
    console.error('Error getting expenses:', error);
    throw error;
  }
};

export const updateExpense = async (id: number, expense: Omit<Expense, 'id'>): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync(
      'UPDATE expenses SET title = ?, amount = ?, category = ?, date = ?, description = ? WHERE id = ?',
      [expense.title, expense.amount, expense.category, expense.date, expense.description || '', id]
    );
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
};

export const deleteExpense = async (id: number): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
};

// Income operations
export const addIncome = async (income: Omit<Income, 'id'>): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.runAsync(
      'INSERT INTO income (source, amount, date, description) VALUES (?, ?, ?, ?)',
      [income.source, income.amount, income.date, income.description || '']
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding income:', error);
    throw error;
  }
};

export const getIncome = async (): Promise<Income[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.getAllAsync('SELECT * FROM income ORDER BY date DESC');
    return result as Income[];
  } catch (error) {
    console.error('Error getting income:', error);
    throw error;
  }
};

export const updateIncome = async (id: number, income: Omit<Income, 'id'>): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync(
      'UPDATE income SET source = ?, amount = ?, date = ?, description = ? WHERE id = ?',
      [income.source, income.amount, income.date, income.description || '', id]
    );
  } catch (error) {
    console.error('Error updating income:', error);
    throw error;
  }
};

export const deleteIncome = async (id: number): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync('DELETE FROM income WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error deleting income:', error);
    throw error;
  }
};

// Get expenses by date range
export const getExpensesByDateRange = async (startDate: string, endDate: string): Promise<Expense[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC',
      [startDate, endDate]
    );
    return result as Expense[];
  } catch (error) {
    console.error('Error getting expenses by date range:', error);
    throw error;
  }
};

// Get income by date range
export const getIncomeByDateRange = async (startDate: string, endDate: string): Promise<Income[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM income WHERE date >= ? AND date <= ? ORDER BY date DESC',
      [startDate, endDate]
    );
    return result as Income[];
  } catch (error) {
    console.error('Error getting income by date range:', error);
    throw error;
  }
};

// User settings operations
export interface UserSettings {
  name: string;
  authMethod: 'biometric' | 'password' | 'none';
  passwordHash?: string | null;
  biometricsEnabled: boolean;
}

// App settings operations
export interface AppSettings {
  notificationsEnabled: boolean;
  darkModeEnabled: boolean;
  autoBackupEnabled: boolean;
  currency: string;
  language: string;
}

export interface NotificationSettings {
  dailyReminder: boolean;
  dailyReminderTime: string; // Format: "HH:MM"
  expenseReminder: boolean;
  incomeReminder: boolean;
  weeklySummary: boolean;
  monthlySummary: boolean;
  transactionNotifications: boolean;
  budgetWarnings: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface NotificationLog {
  id?: number;
  type: string;
  title: string;
  body: string;
  sentAt?: string;
  userAction?: string;
  data?: string;
}

export const getUserSettings = async (): Promise<UserSettings | null> => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const result = await db.getAllAsync('SELECT * FROM user_settings WHERE id = 1');
    if (!result || result.length === 0) return null;
    const row: any = result[0];
    return {
      name: row.name || '',
      authMethod: (row.auth_method as 'biometric' | 'password' | 'none') || 'none',
      passwordHash: row.password_hash || null,
      biometricsEnabled: !!row.biometrics_enabled,
    };
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw error;
  }
};

export const getAppSettings = async (): Promise<AppSettings | null> => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const result = await db.getAllAsync('SELECT * FROM app_settings WHERE id = 1');
    if (!result || result.length === 0) return null;
    const row: any = result[0];
    return {
      notificationsEnabled: !!row.notifications_enabled,
      darkModeEnabled: !!row.dark_mode_enabled,
      autoBackupEnabled: !!row.auto_backup_enabled,
      currency: row.currency || 'دينار عراقي',
      language: row.language || 'ar',
    };
  } catch (error) {
    console.error('Error getting app settings:', error);
    throw error;
  }
};

export const upsertAppSettings = async (settings: AppSettings): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  try {
    await db.runAsync(
      `INSERT INTO app_settings (id, notifications_enabled, dark_mode_enabled, auto_backup_enabled, currency, language, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         notifications_enabled = excluded.notifications_enabled,
         dark_mode_enabled = excluded.dark_mode_enabled,
         auto_backup_enabled = excluded.auto_backup_enabled,
         currency = excluded.currency,
         language = excluded.language,
         updated_at = CURRENT_TIMESTAMP
      `,
      [
        settings.notificationsEnabled ? 1 : 0,
        settings.darkModeEnabled ? 1 : 0,
        settings.autoBackupEnabled ? 1 : 0,
        settings.currency,
        settings.language,
      ]
    );
  } catch (error) {
    console.error('Error saving app settings:', error);
    throw error;
  }
};

export const upsertUserSettings = async (settings: UserSettings): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  try {
    // Ensure single row with id=1
    await db.runAsync(
      `INSERT INTO user_settings (id, name, auth_method, password_hash, biometrics_enabled)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         auth_method = excluded.auth_method,
         password_hash = excluded.password_hash,
         biometrics_enabled = excluded.biometrics_enabled
      `,
      [
        settings.name,
        settings.authMethod,
        settings.passwordHash || null,
        settings.biometricsEnabled ? 1 : 0,
      ]
    );
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw error;
  }
};

// Notification settings operations
export const getNotificationSettings = async (): Promise<NotificationSettings | null> => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    const result = await db.getAllAsync('SELECT * FROM notification_settings WHERE id = 1');
    if (!result || result.length === 0) return null;
    const row: any = result[0];
    return {
      dailyReminder: !!row.daily_reminder,
      dailyReminderTime: row.daily_reminder_time || '20:00',
      expenseReminder: !!row.expense_reminder,
      incomeReminder: !!row.income_reminder,
      weeklySummary: !!row.weekly_summary,
      monthlySummary: !!row.monthly_summary,
      transactionNotifications: !!row.transaction_notifications,
      budgetWarnings: !!row.budget_warnings,
      soundEnabled: !!row.sound_enabled,
      vibrationEnabled: !!row.vibration_enabled,
    };
  } catch (error) {
    console.error('Error getting notification settings:', error);
    throw error;
  }
};

export const upsertNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  try {
    await db.runAsync(
      `INSERT INTO notification_settings (
        id, daily_reminder, daily_reminder_time, expense_reminder, income_reminder,
        weekly_summary, monthly_summary, transaction_notifications, budget_warnings,
        sound_enabled, vibration_enabled, updated_at
      )
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         daily_reminder = excluded.daily_reminder,
         daily_reminder_time = excluded.daily_reminder_time,
         expense_reminder = excluded.expense_reminder,
         income_reminder = excluded.income_reminder,
         weekly_summary = excluded.weekly_summary,
         monthly_summary = excluded.monthly_summary,
         transaction_notifications = excluded.transaction_notifications,
         budget_warnings = excluded.budget_warnings,
         sound_enabled = excluded.sound_enabled,
         vibration_enabled = excluded.vibration_enabled,
         updated_at = CURRENT_TIMESTAMP
      `,
      [
        settings.dailyReminder ? 1 : 0,
        settings.dailyReminderTime,
        settings.expenseReminder ? 1 : 0,
        settings.incomeReminder ? 1 : 0,
        settings.weeklySummary ? 1 : 0,
        settings.monthlySummary ? 1 : 0,
        settings.transactionNotifications ? 1 : 0,
        settings.budgetWarnings ? 1 : 0,
        settings.soundEnabled ? 1 : 0,
        settings.vibrationEnabled ? 1 : 0,
      ]
    );
  } catch (error) {
    console.error('Error saving notification settings:', error);
    throw error;
  }
};

// Notification log operations
export const addNotificationLog = async (log: Omit<NotificationLog, 'id'>): Promise<number> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.runAsync(
      'INSERT INTO notification_log (type, title, body, user_action, data) VALUES (?, ?, ?, ?, ?)',
      [log.type, log.title, log.body, log.userAction || null, log.data || null]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error adding notification log:', error);
    throw error;
  }
};

export const getNotificationLogs = async (limit: number = 50): Promise<NotificationLog[]> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    const result = await db.getAllAsync(
      'SELECT * FROM notification_log ORDER BY sent_at DESC LIMIT ?',
      [limit]
    );
    return result as NotificationLog[];
  } catch (error) {
    console.error('Error getting notification logs:', error);
    throw error;
  }
};

export const updateNotificationLogAction = async (id: number, userAction: string): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync(
      'UPDATE notification_log SET user_action = ? WHERE id = ?',
      [userAction, id]
    );
  } catch (error) {
    console.error('Error updating notification log action:', error);
    throw error;
  }
};

export const clearNotificationLogs = async (): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  try {
    await db.runAsync('DELETE FROM notification_log');
  } catch (error) {
    console.error('Error clearing notification logs:', error);
    throw error;
  }
};

// Clear all data functions
export const clearAllData = async (): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    // Clear all tables
    await db.execAsync('DELETE FROM expenses');
    await db.execAsync('DELETE FROM income');
    await db.execAsync('DELETE FROM user_settings');
    await db.execAsync('DELETE FROM app_settings');
    
    console.log('All data cleared successfully');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};

export const clearExpenses = async (): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    await db.execAsync('DELETE FROM expenses');
    console.log('Expenses cleared successfully');
  } catch (error) {
    console.error('Error clearing expenses:', error);
    throw error;
  }
};

export const clearIncome = async (): Promise<void> => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    await db.execAsync('DELETE FROM income');
    console.log('Income cleared successfully');
  } catch (error) {
    console.error('Error clearing income:', error);
    throw error;
  }
};
