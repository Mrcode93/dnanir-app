import * as SQLite from 'expo-sqlite';
import { encryptField, decryptField } from '../utils/encryption';
import { CURRENCIES } from '../types';

let db: SQLite.SQLiteDatabase | null = null;
let hasBaseAmountColumnsCache: boolean | null = null;

export const initDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('dnanir.db');

    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    const addColumnIfNeeded = async (table: string, column: string, definition: string) => {
      try {
        const info = await db!.getAllAsync<any>(`PRAGMA table_info(${table})`);
        const exists = info.some(col => col.name === column);
        if (!exists) {
          await db!.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
          return true;
        }
      } catch (e) {
        console.error(`Error adding column ${column} to ${table}:`, e);
      }
      return false;
    };

    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        currency TEXT DEFAULT 'IQD',
        walletId INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    `);
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_expenses_date_category ON expenses(date, category);');

    // Safe migrations
    await addColumnIfNeeded('expenses', 'base_amount', 'REAL');
    await addColumnIfNeeded('expenses', 'synced_at', 'INTEGER');
    await addColumnIfNeeded('expenses', 'enc_blob', 'TEXT');
    await addColumnIfNeeded('expenses', 'walletId', 'INTEGER');

    // Create index after column exists
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_expenses_wallet ON expenses(walletId);');

    // Initialize existing records for base_amount
    await db.execAsync('UPDATE expenses SET base_amount = amount WHERE base_amount IS NULL;');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount REAL NOT NULL,
        base_amount REAL,
        date TEXT NOT NULL,
        description TEXT,
        currency TEXT DEFAULT 'IQD',
        walletId INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
    `);

    await addColumnIfNeeded('income', 'base_amount', 'REAL');
    await addColumnIfNeeded('income', 'currency', 'TEXT DEFAULT "IQD"');
    await addColumnIfNeeded('income', 'category', 'TEXT');
    await addColumnIfNeeded('income', 'synced_at', 'INTEGER');
    await addColumnIfNeeded('income', 'enc_blob', 'TEXT');
    await addColumnIfNeeded('income', 'walletId', 'INTEGER');

    // Create index after column exists
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_income_wallet ON income(walletId);');

    // Initialize existing records
    await db.execAsync('UPDATE income SET base_amount = amount WHERE base_amount IS NULL;');

    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_income_category ON income(category);');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_income_date_category ON income(date, category);');

    hasBaseAmountColumnsCache = true;

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        authMethod TEXT DEFAULT 'none',
        passwordHash TEXT,
        biometricsEnabled INTEGER DEFAULT 0
      );
    `);
    await addColumnIfNeeded('user_settings', 'synced_at', 'INTEGER');
    await addColumnIfNeeded('user_settings', 'userId', 'TEXT');
    await addColumnIfNeeded('user_settings', 'phone', 'TEXT');
    await addColumnIfNeeded('user_settings', 'email', 'TEXT');
    await addColumnIfNeeded('user_settings', 'isPro', 'INTEGER DEFAULT 0');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notificationsEnabled INTEGER DEFAULT 1,
        darkModeEnabled INTEGER DEFAULT 0,
        themeMode TEXT DEFAULT 'light',
        autoBackupEnabled INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'دينار عراقي',
        language TEXT DEFAULT 'ar'
      );
    `);

    await addColumnIfNeeded('app_settings', 'themeMode', "TEXT DEFAULT 'light'");
    await addColumnIfNeeded('app_settings', 'synced_at', 'INTEGER');
    await addColumnIfNeeded('app_settings', 'autoSyncEnabled', 'INTEGER DEFAULT 0');
    await addColumnIfNeeded('app_settings', 'lastAutoSyncTime', 'INTEGER');
    await addColumnIfNeeded('app_settings', 'lastFullSyncAt', 'TEXT');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dailyReminder INTEGER DEFAULT 1,
        dailyReminderTime TEXT DEFAULT '20:00',
        expenseReminder INTEGER DEFAULT 1,
        expenseReminderTime TEXT DEFAULT '20:00',
        incomeReminder INTEGER DEFAULT 1,
        weeklySummary INTEGER DEFAULT 1,
        monthlySummary INTEGER DEFAULT 1
      );
    `);

    await addColumnIfNeeded('notification_settings', 'expenseReminderTime', 'TEXT DEFAULT "20:00"');
    await addColumnIfNeeded('notification_settings', 'synced_at', 'INTEGER');

    // Initialize default notification settings if table is empty
    try {
      const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM notification_settings LIMIT 1');
      if (!existing) {
        await db.runAsync(
          'INSERT INTO notification_settings (dailyReminder, dailyReminderTime, expenseReminder, expenseReminderTime, incomeReminder, weeklySummary, monthlySummary) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [0, '20:00', 0, '20:00', 1, 1, 1]
        );
      }
    } catch (e) {
      // Ignore error
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS financial_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        targetAmount REAL NOT NULL,
        currentAmount REAL DEFAULT 0,
        targetDate TEXT,
        category TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'IQD'
      );
    `);

    await addColumnIfNeeded('financial_goals', 'currency', 'TEXT DEFAULT "IQD"');
    await addColumnIfNeeded('financial_goals', 'base_target_amount', 'REAL');
    await addColumnIfNeeded('financial_goals', 'base_current_amount', 'REAL');
    await addColumnIfNeeded('financial_goals', 'synced_at', 'INTEGER');

    // Initialize goals base columns
    await db.execAsync('UPDATE financial_goals SET base_target_amount = targetAmount WHERE base_target_amount IS NULL;');
    await db.execAsync('UPDATE financial_goals SET base_current_amount = currentAmount WHERE base_current_amount IS NULL;');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        icon TEXT DEFAULT 'ellipse',
        color TEXT DEFAULT '#6B7280',
        createdAt TEXT NOT NULL
      );
    `);
    await addColumnIfNeeded('custom_categories', 'synced_at', 'INTEGER');

    // Migrate custom_categories: change UNIQUE(name) to UNIQUE(name, type)
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS custom_categories_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          icon TEXT DEFAULT 'ellipse',
          color TEXT DEFAULT '#6B7280',
          createdAt TEXT NOT NULL,
          synced_at INTEGER,
          UNIQUE(name, type)
        );
        INSERT OR IGNORE INTO custom_categories_new (id, name, type, icon, color, createdAt, synced_at)
          SELECT id, name, type, icon, color, createdAt, synced_at FROM custom_categories;
        DROP TABLE custom_categories;
        ALTER TABLE custom_categories_new RENAME TO custom_categories;
      `);
    } catch (e) { }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        currency TEXT DEFAULT 'IQD',
        UNIQUE(category, month, year)
      );
    `);

    // Add currency column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE budgets ADD COLUMN currency TEXT DEFAULT "IQD";');
    } catch (e) {
      // Column already exists, ignore
    }
    // Add base_amount column if it doesn't exist
    try {
      await db.execAsync('ALTER TABLE budgets ADD COLUMN base_amount REAL;');
      // Initialize existing records
      await db.execAsync('UPDATE budgets SET base_amount = amount WHERE base_amount IS NULL;');
    } catch (e) {
      // Column already exists, ignore
    }
    try {
      await db.execAsync('ALTER TABLE budgets ADD COLUMN synced_at INTEGER;');
    } catch (e) { }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        recurrenceType TEXT NOT NULL,
        recurrenceValue INTEGER NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        lastProcessedDate TEXT,
        createdAt TEXT NOT NULL,
        walletId INTEGER
      );
    `);
    try {
      await db.execAsync('ALTER TABLE recurring_expenses ADD COLUMN base_amount REAL;');
      await db.execAsync('UPDATE recurring_expenses SET base_amount = amount WHERE base_amount IS NULL;');
    } catch (e) { }
    try {
      await db.execAsync('ALTER TABLE recurring_expenses ADD COLUMN currency TEXT DEFAULT "IQD";');
    } catch (e) { }
    try {
      await db.execAsync('ALTER TABLE recurring_expenses ADD COLUMN synced_at INTEGER;');
    } catch (e) { }
    try {
      await db.execAsync('ALTER TABLE recurring_expenses ADD COLUMN walletId INTEGER;');
    } catch (e) { }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromCurrency TEXT NOT NULL,
        toCurrency TEXT NOT NULL,
        rate REAL NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(fromCurrency, toCurrency)
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debtors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        image_path TEXT,
        createdAt TEXT NOT NULL,
        synced_at INTEGER DEFAULT 0,
        enc_blob TEXT,
        UNIQUE(name)
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debtorName TEXT NOT NULL,
        totalAmount REAL NOT NULL,
        remainingAmount REAL NOT NULL,
        startDate TEXT NOT NULL,
        dueDate TEXT,
        description TEXT,
        type TEXT NOT NULL,
        currency TEXT DEFAULT 'IQD',
        isPaid INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        debtorId INTEGER,
        FOREIGN KEY (debtorId) REFERENCES debtors(id)
      );
    `);

    await addColumnIfNeeded('debts', 'base_total_amount', 'REAL');
    await addColumnIfNeeded('debts', 'base_remaining_amount', 'REAL');
    await addColumnIfNeeded('debts', 'synced_at', 'INTEGER');
    await addColumnIfNeeded('debts', 'enc_blob', 'TEXT');
    await addColumnIfNeeded('debts', 'direction', "TEXT DEFAULT 'owed_by_me'");
    await addColumnIfNeeded('debts', 'debtorId', 'INTEGER');

    // Initialize missing records
    await db.execAsync('UPDATE debts SET base_total_amount = totalAmount WHERE base_total_amount IS NULL;');
    await db.execAsync('UPDATE debts SET base_remaining_amount = remainingAmount WHERE base_remaining_amount IS NULL;');

    // Migration: Populate debtors Table from existing debts
    try {
      const debtsToMigrate = await db.getAllAsync<{ id: number, debtorName: string, createdAt: string }>(
        'SELECT id, debtorName, createdAt FROM debts WHERE debtorId IS NULL'
      );
      if (debtsToMigrate && debtsToMigrate.length > 0) {
        for (const debt of debtsToMigrate) {
          let debtorId: number;
          const existingDebtor = await db.getFirstAsync<{ id: number }>('SELECT id FROM debtors WHERE name = ?', [debt.debtorName]);

          if (existingDebtor) {
            debtorId = existingDebtor.id;
          } else {
            const result = await db.runAsync(
              'INSERT INTO debtors (name, createdAt) VALUES (?, ?)',
              [debt.debtorName, debt.createdAt || new Date().toISOString()]
            );
            debtorId = result.lastInsertRowId;
          }

          await db.runAsync('UPDATE debts SET debtorId = ? WHERE id = ?', [debtorId, debt.id]);
        }
      }
    } catch (migrationError) {

    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debt_installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debtId INTEGER NOT NULL,
        amount REAL NOT NULL,
        dueDate TEXT NOT NULL,
        isPaid INTEGER DEFAULT 0,
        paidDate TEXT,
        installmentNumber INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        synced_at INTEGER,
        FOREIGN KEY (debtId) REFERENCES debts(id) ON DELETE CASCADE
      );
    `);
    await addColumnIfNeeded('debt_installments', 'synced_at', 'INTEGER');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debtId INTEGER NOT NULL,
        amount REAL NOT NULL,
        paymentDate TEXT NOT NULL,
        installmentId INTEGER,
        description TEXT,
        createdAt TEXT NOT NULL,
        synced_at INTEGER,
        FOREIGN KEY (debtId) REFERENCES debts(id) ON DELETE CASCADE,
        FOREIGN KEY (installmentId) REFERENCES debt_installments(id) ON DELETE SET NULL
      );
    `);
    await addColumnIfNeeded('debt_payments', 'synced_at', 'INTEGER');

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        icon TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        targetValue REAL,
        targetCategory TEXT,
        currentProgress REAL DEFAULT 0,
        targetProgress REAL NOT NULL,
        completed INTEGER DEFAULT 0,
        completedAt TEXT,
        reward TEXT,
        isCustom INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );
    `);

    await addColumnIfNeeded('challenges', 'isCustom', 'INTEGER DEFAULT 0');
    await addColumnIfNeeded('challenges', 'synced_at', 'INTEGER');

    // Achievements and Badges table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        category TEXT NOT NULL,
        unlockedAt TEXT,
        progress REAL DEFAULT 0,
        targetProgress REAL NOT NULL,
        isUnlocked INTEGER DEFAULT 0
      );
    `);
    await addColumnIfNeeded('achievements', 'synced_at', 'INTEGER');

    // Expense Shortcuts table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expense_shortcuts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        currency TEXT DEFAULT 'IQD',
        description TEXT,
        createdAt TEXT NOT NULL
      );
    `);
    await addColumnIfNeeded('expense_shortcuts', 'synced_at', 'INTEGER');

    // Income Shortcuts table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS income_shortcuts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount REAL NOT NULL,
        incomeSource TEXT NOT NULL,
        currency TEXT DEFAULT 'IQD',
        description TEXT,
        createdAt TEXT NOT NULL
      );
    `);
    await addColumnIfNeeded('income_shortcuts', 'synced_at', 'INTEGER');

    // Bills table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        dueDate TEXT NOT NULL,
        recurrenceType TEXT,
        recurrenceValue INTEGER,
        description TEXT,
        currency TEXT DEFAULT 'IQD',
        isPaid INTEGER DEFAULT 0,
        paidDate TEXT,
        reminderDaysBefore INTEGER DEFAULT 3,
        image_path TEXT,
        createdAt TEXT NOT NULL
      );
    `);
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_bills_due_date_paid ON bills(dueDate, isPaid);');

    await addColumnIfNeeded('bills', 'image_path', 'TEXT');
    await addColumnIfNeeded('bills', 'base_amount', 'REAL');
    await addColumnIfNeeded('bills', 'synced_at', 'INTEGER');

    // Initialize missing records
    await db.execAsync('UPDATE bills SET base_amount = amount WHERE base_amount IS NULL;');

    // Bill payment history table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        billId INTEGER NOT NULL,
        amount REAL NOT NULL,
        paymentDate TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        synced_at INTEGER,
        FOREIGN KEY (billId) REFERENCES bills(id) ON DELETE CASCADE
      );
    `);
    await addColumnIfNeeded('bill_payments', 'synced_at', 'INTEGER');

    await addColumnIfNeeded('expenses', 'receipt_image_path', 'TEXT');

    // Notifications table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data TEXT,
        date INTEGER NOT NULL,
        read INTEGER DEFAULT 0,
        type TEXT DEFAULT 'default'
      );
    `);

    await addColumnIfNeeded('notifications', 'type', 'TEXT DEFAULT "default"');
    await addColumnIfNeeded('notifications', 'synced_at', 'INTEGER');

    // AI Smart Insights cache (last response stored locally)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ai_insights_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT NOT NULL,
        analysis_type TEXT DEFAULT 'full',
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        walletId INTEGER
      );
    `);


    // Savings table (Hassala)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS savings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        targetAmount REAL,
        currentAmount REAL DEFAULT 0,
        currency TEXT DEFAULT 'IQD',
        description TEXT,
        icon TEXT DEFAULT 'wallet',
        color TEXT DEFAULT '#10B981',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        synced_at INTEGER
      );
    `);

    await addColumnIfNeeded('savings', 'base_target_amount', 'REAL');
    await addColumnIfNeeded('savings', 'base_current_amount', 'REAL');
    await addColumnIfNeeded('savings', 'synced_at', 'INTEGER');

    // Initialize missing records
    await db.execAsync('UPDATE savings SET base_target_amount = targetAmount WHERE base_target_amount IS NULL;');
    await db.execAsync('UPDATE savings SET base_current_amount = currentAmount WHERE base_current_amount IS NULL;');

    // Savings transactions table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS savings_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        savingsId INTEGER NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        synced_at INTEGER,
        FOREIGN KEY (savingsId) REFERENCES savings(id) ON DELETE CASCADE
      );
    `);
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_savings_transactions_savings_id ON savings_transactions(savingsId);');

    // Migration: ensure walletId exists on ai_insights_cache
    await addColumnIfNeeded('ai_insights_cache', 'walletId', 'INTEGER');

    // Legacy migration check for old Month/Year structure
    const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(ai_insights_cache)");
    const hasMonthColumn = tableInfo.some((col) => col.name === 'month');
    if (!hasMonthColumn) {
      // Migrate old structure if it only has data/analysis_type/created_at
      await db.execAsync('CREATE TABLE IF NOT EXISTS ai_insights_cache_new (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, analysis_type TEXT DEFAULT "full", month INTEGER NOT NULL, year INTEGER NOT NULL, created_at INTEGER NOT NULL, walletId INTEGER);');
      const existingData = await db.getAllAsync<{ data: string; analysis_type: string | null; created_at: number; walletId?: number }>('SELECT * FROM ai_insights_cache');
      for (const row of existingData) {
        const d = new Date(row.created_at);
        await db.runAsync('INSERT INTO ai_insights_cache_new (data, analysis_type, month, year, created_at, walletId) VALUES (?, ?, ?, ?, ?, ?)', [row.data, row.analysis_type || 'full', d.getMonth() + 1, d.getFullYear(), row.created_at, row.walletId || null]);
      }
      await db.execAsync('DROP TABLE ai_insights_cache;');
      await db.execAsync('ALTER TABLE ai_insights_cache_new RENAME TO ai_insights_cache;');
    }

    // Goal plan cache (history of plans per goal)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS goal_plan_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    // Migration: Check if table needs migration (old structure without month/year)
    try {
      const tableInfo = await db.getAllAsync<{ name: string }>("PRAGMA table_info(goal_plan_cache)");
      const hasMonthColumn = tableInfo.some((col) => col.name === 'month');
      const hasYearColumn = tableInfo.some((col) => col.name === 'year');
      const hasIdColumn = tableInfo.some((col) => col.name === 'id');

      if (!hasMonthColumn || !hasYearColumn || !hasIdColumn) {
        // Old table structure exists, migrate it
        await db.execAsync('CREATE TABLE IF NOT EXISTS goal_plan_cache_new (id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL, data TEXT NOT NULL, month INTEGER NOT NULL, year INTEGER NOT NULL, created_at INTEGER NOT NULL);');

        // Copy existing data if any
        const existingData = await db.getAllAsync<{ goal_id: number; data: string; created_at: number }>('SELECT goal_id, data, created_at FROM goal_plan_cache');
        if (existingData.length > 0) {
          for (const row of existingData) {
            const createdAt = row.created_at;
            const date = new Date(createdAt);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            await db.runAsync(
              'INSERT INTO goal_plan_cache_new (goal_id, data, month, year, created_at) VALUES (?, ?, ?, ?, ?)',
              [row.goal_id, row.data, month, year, createdAt]
            );
          }
        }

        await db.execAsync('DROP TABLE goal_plan_cache;');
        await db.execAsync('ALTER TABLE goal_plan_cache_new RENAME TO goal_plan_cache;');
      }

      // Create indexes if they don't exist
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_goal_plan_cache_goal_id ON goal_plan_cache(goal_id);');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_goal_plan_cache_month_year ON goal_plan_cache(year, month);');
    } catch (e) {
      // Migration failed, table might already be in correct format

    }
    try {
      // Create indexes for better performance
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_ai_insights_cache_month_year ON ai_insights_cache(year, month);');
    } catch (e) {
      // Indexes already exist, ignore
    }

    // Initialize default categories
    await initializeDefaultCategories(db);

    // Exchange rates are non-critical for first frame; run in background.
    initializeExchangeRates(db).catch(err => {

    });

    // Clean up old AI cache (keep last 6 months) - run in background, don't block initialization
    cleanupOldAiCache().catch(err => {

    });

    // --- MULTI-WALLET SUPPORT ---
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        currency TEXT DEFAULT 'IQD',
        balance REAL DEFAULT 0,
        icon TEXT DEFAULT 'wallet',
        color TEXT DEFAULT '#0B5A7A',
        isDefault INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT,
        synced_at INTEGER
      );
    `);

    // Migration for older wallets table versions
    await addColumnIfNeeded('wallets', 'currency', 'TEXT DEFAULT "IQD"');
    await addColumnIfNeeded('wallets', 'balance', 'REAL DEFAULT 0');
    await addColumnIfNeeded('wallets', 'icon', 'TEXT DEFAULT "wallet"');
    await addColumnIfNeeded('wallets', 'color', 'TEXT DEFAULT "#0B5A7A"');
    await addColumnIfNeeded('wallets', 'isDefault', 'INTEGER DEFAULT 0');
    await addColumnIfNeeded('wallets', 'synced_at', 'INTEGER');

    // Migration: Create default wallet if none exists and link records
    try {
      const existingWallets = await db.getAllAsync<{ id: number }>('SELECT id FROM wallets LIMIT 1');
      if (existingWallets.length === 0) {
        // Create default wallet
        const now = new Date().toISOString();
        const result = await db.runAsync(
          'INSERT INTO wallets (name, currency, balance, icon, color, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ['المحفظة الرئيسية', 'IQD', 0, 'wallet', '#0B5A7A', 1, now]
        );
        const defaultWalletId = result.lastInsertRowId;

        // Link all existing expenses and income to this wallet
        await db.runAsync('UPDATE expenses SET walletId = ? WHERE walletId IS NULL', [defaultWalletId]);
        await db.runAsync('UPDATE income SET walletId = ? WHERE walletId IS NULL', [defaultWalletId]);
      } else {
        // Ensure all records have a walletId (legacy data)
        const defaultWallet = await db.getFirstAsync<{ id: number }>('SELECT id FROM wallets WHERE isDefault = 1 LIMIT 1')
          || await db.getFirstAsync<{ id: number }>('SELECT id FROM wallets LIMIT 1');

        if (defaultWallet) {
          await db.runAsync('UPDATE expenses SET walletId = ? WHERE walletId IS NULL', [defaultWallet.id]);
          await db.runAsync('UPDATE income SET walletId = ? WHERE walletId IS NULL', [defaultWallet.id]);
        }
      }
    } catch (e) {
      console.error('Multi-wallet migration error:', e);
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};



/**
 * Delete all data from all tables and reset to defaults
 */
export const deleteAllData = async () => {
  const database = getDb();

  try {
    // 1. Get all tables dynamically to ensure we don't miss any (like financial_goals)
    const rows = await database.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    );
    const tables = rows.map(r => r.name);

    // Disable foreign keys temporarily
    await database.execAsync('PRAGMA foreign_keys = OFF;');

    for (const table of tables) {
      try {
        await database.runAsync(`DELETE FROM ${table}`);
        // Reset autoincrement
        await database.runAsync(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
      } catch (error) {
        console.error(`[Database] Failed to delete table ${table}:`, error);
      }
    }

    // Re-enable foreign keys
    await database.execAsync('PRAGMA foreign_keys = ON;');

    // Re-initialize default categories
    await initializeDefaultCategories(database);

    // Re-initialize default wallet
    const now = new Date().toISOString();
    await database.runAsync(
      'INSERT INTO wallets (name, currency, balance, icon, color, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['المحفظة الرئيسية', 'IQD', 0, 'wallet', '#0B5A7A', 1, now, now]
    );

    // Re-initialize default settings
    await database.runAsync(
      'INSERT INTO notification_settings (dailyReminder, dailyReminderTime, expenseReminder, expenseReminderTime, incomeReminder, weeklySummary, monthlySummary) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [0, '20:00', 0, '20:00', 1, 1, 1]
    );

    await database.runAsync(
      'INSERT INTO app_settings (notificationsEnabled, darkModeEnabled, autoBackupEnabled, currency, language, lastFullSyncAt) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 0, 0, 'دينار عراقي', 'ar', new Date().toISOString()]
    );

    await database.runAsync(
      'INSERT INTO user_settings (name, authMethod, biometricsEnabled) VALUES (?, ?, ?)',
      ['المستخدم', 'none', 0]
    );

    return true;
  } catch (error) {
    console.error('[Database] Reset failed:', error);
    throw error;
  }
};

// Initialize default categories for expenses and income
const initializeDefaultCategories = async (database: SQLite.SQLiteDatabase) => {
  const now = new Date().toISOString();

  // Default expense categories
  const defaultExpenseCategories = [
    { name: 'طعام', type: 'expense', icon: 'restaurant', color: '#F59E0B' },
    { name: 'مواصلات', type: 'expense', icon: 'car', color: '#3B82F6' },
    { name: 'تسوق', type: 'expense', icon: 'bag', color: '#EC4899' },
    { name: 'فواتير', type: 'expense', icon: 'receipt', color: '#EF4444' },
    { name: 'ترفيه', type: 'expense', icon: 'musical-notes', color: '#8B5CF6' },
    { name: 'صحة', type: 'expense', icon: 'medical', color: '#10B981' },
    { name: 'تعليم', type: 'expense', icon: 'school', color: '#06B6D4' },
    { name: 'أخرى', type: 'expense', icon: 'ellipse', color: '#6B7280' },
  ];

  // Default income sources
  const defaultIncomeSources = [
    { name: 'راتب', type: 'income', icon: 'cash', color: '#10B981' },
    { name: 'تجارة', type: 'income', icon: 'briefcase', color: '#3B82F6' },
    { name: 'استثمار', type: 'income', icon: 'trending-up', color: '#8B5CF6' },
    { name: 'هدية', type: 'income', icon: 'gift', color: '#EC4899' },
    { name: 'أخرى', type: 'income', icon: 'ellipse', color: '#6B7280' },
  ];

  // Insert default expense categories (ignore if already exists)
  for (const category of defaultExpenseCategories) {
    try {
      await database.runAsync(
        'INSERT OR IGNORE INTO custom_categories (name, type, icon, color, createdAt) VALUES (?, ?, ?, ?, ?)',
        [category.name, category.type, category.icon, category.color, now]
      );
    } catch (error) {
      // Ignore errors (category might already exist)
    }
  }

  // Insert default income sources (ignore if already exists)
  for (const source of defaultIncomeSources) {
    try {
      await database.runAsync(
        'INSERT OR IGNORE INTO custom_categories (name, type, icon, color, createdAt) VALUES (?, ?, ?, ?, ?)',
        [source.name, source.type, source.icon, source.color, now]
      );
    } catch (error) {
      // Ignore errors (source might already exist)
    }
  }
};

// Initialize default exchange rates for new currencies
const initializeExchangeRates = async (database: SQLite.SQLiteDatabase) => {
  const now = new Date().toISOString();

  // Base rates relative to USD (approximate data for initialization)
  // These will be updated by the user in the app, but providing starting points
  const usdRates: Record<string, number> = {
    'IQD': 1310, 'SAR': 3.75, 'AED': 3.67, 'KWD': 0.31,
    'EGP': 48.0, 'QAR': 3.64, 'BHD': 0.38, 'OMR': 0.38,
    'JOD': 0.71, 'LBP': 89500, 'SYP': 13000, 'TND': 3.12,
    'MAD': 10.1, 'DZD': 134.5, 'LYD': 4.82, 'SDG': 600,
    'YER': 250, 'TRY': 31.5, 'EUR': 0.92, 'GBP': 0.79,
    'CAD': 1.35, 'AUD': 1.52, 'CHF': 0.88, 'CNY': 7.20,
    'JPY': 150.0, 'INR': 83.0, 'RUB': 92.0, 'BRL': 4.95,
  };

  for (const [code, rate] of Object.entries(usdRates)) {
    if (code === 'USD') continue;
    try {
      // Add or update USD to Currency
      await database.runAsync(
        'INSERT OR IGNORE INTO exchange_rates (fromCurrency, toCurrency, rate, updatedAt) VALUES (?, ?, ?, ?)',
        ['USD', code, rate, now]
      );

      // Also add inverse for common use cases
      await database.runAsync(
        'INSERT OR IGNORE INTO exchange_rates (fromCurrency, toCurrency, rate, updatedAt) VALUES (?, ?, ?, ?)',
        [code, 'USD', 1 / rate, now]
      );

      // If IQD is the base for the app, or for common Iraqi usage, add IQD relation
      if (code !== 'IQD') {
        const iqdRate = usdRates['IQD'] / rate;
        await database.runAsync(
          'INSERT OR IGNORE INTO exchange_rates (fromCurrency, toCurrency, rate, updatedAt) VALUES (?, ?, ?, ?)',
          ['IQD', code, 1 / iqdRate, now]
        );
        await database.runAsync(
          'INSERT OR IGNORE INTO exchange_rates (fromCurrency, toCurrency, rate, updatedAt) VALUES (?, ?, ?, ?)',
          [code, 'IQD', iqdRate, now]
        );
      }
    } catch (error) {
      // Ignore if already exists or other constraints
    }
  }
};

export const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

// Expense operations
export const addExpense = async (expense: Omit<import('../types').Expense, 'id'>): Promise<number> => {
  const database = getDb();
  let baseAmount = expense.base_amount !== undefined ? expense.base_amount : expense.amount;
  if (isNaN(baseAmount)) baseAmount = expense.amount;

  const encBlob = encryptField({ title: expense.title, description: expense.description ?? null });

  const result = await database.runAsync(
    'INSERT INTO expenses (title, amount, base_amount, category, date, description, currency, receipt_image_path, enc_blob, walletId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      expense.title ? String(expense.title) : 'مصروف',
      Number(expense.amount) || 0,
      Number(baseAmount) || 0,
      expense.category ? String(expense.category) : 'other',
      expense.date ? String(expense.date) : new Date().toISOString().split('T')[0],
      expense.description ? String(expense.description) : null,
      expense.currency ? String(expense.currency) : 'IQD',
      expense.receipt_image_path ? String(expense.receipt_image_path) : null,
      encBlob,
      expense.walletId || (await getWallets())[0]?.id || 1,
    ]
  );

  // Check achievements after adding expense (async, don't wait)
  try {
    const { checkAllAchievements } = await import('../services/achievementService');
    checkAllAchievements().catch(() => { });
  } catch (error) {
    // Ignore if achievementService is not available
  }

  // Update widgets (async, don't wait)
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (error) {
    // Ignore if widget service is not available
  }

  return result.lastInsertRowId;
};

function decryptExpenseRow<T extends { enc_blob?: string | null; title?: string; description?: string | null }>(row: T): T {
  const dec = decryptField<{ title?: string; description?: string | null }>(row.enc_blob);
  if (!dec) return row;
  return { ...row, ...(dec.title !== undefined ? { title: dec.title } : {}), ...(dec.description !== undefined ? { description: dec.description } : {}) };
}

export const getExpenses = async (walletId?: number): Promise<import('../types').Expense[]> => {
  const database = getDb();
  let query = 'SELECT * FROM expenses';
  const params: any[] = [];

  if (walletId) {
    query += ' WHERE walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY date DESC, id DESC';

  const result = await database.getAllAsync<import('../types').Expense>(query, params);
  return result.map(decryptExpenseRow);
};

export const getRecentExpensesForShortcutRanking = async (
  limit: number = 300,
  walletId?: number
): Promise<Array<{ title?: string; category?: string; amount: number; base_amount?: number; date: string }>> => {
  const database = getDb();
  let query = 'SELECT title, category, amount, base_amount, date FROM expenses';
  const params: any[] = [];

  if (walletId) {
    query += ' WHERE walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY date DESC, id DESC LIMIT ?';
  params.push(limit);

  return database.getAllAsync<{ title?: string; category?: string; amount: number; base_amount?: number; date: string }>(
    query, params
  );
};

export const getExpensesCount = async (options: {
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  category?: string;
  walletId?: number;
} = {}): Promise<number> => {
  const { startDate, endDate, searchQuery, category, walletId } = options;
  const database = getDb();
  let query = 'SELECT COUNT(*) as count FROM expenses WHERE 1=1';
  const params: any[] = [];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (searchQuery) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  const result = await database.getFirstAsync<{ count: number }>(query, params);
  return result?.count || 0;
};

export const getExpensesByRange = async (startDate: string, endDate: string, walletId?: number): Promise<import('../types').Expense[]> => {
  const database = getDb();
  let query = 'SELECT * FROM expenses WHERE date >= ? AND date <= ?';
  const params: any[] = [startDate, endDate];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY date DESC, id DESC';
  const result = await database.getAllAsync<import('../types').Expense>(query, params);
  return result.map(decryptExpenseRow);
};

export const getRecentTransactions = async (limit: number = 5, walletId?: number): Promise<(import('../types').Expense | import('../types').Income | any)[]> => {
  const database = getDb();
  const params: any[] = [];

  const query = `
    SELECT * FROM (
      SELECT id, 'expense' as type, title, amount, base_amount, category, date, description, currency, receipt_image_path, walletId
      FROM expenses
      UNION ALL
      SELECT id, 'income' as type, source as title, amount, base_amount, category, date, description, currency, null as receipt_image_path, walletId
      FROM income
    ) 
    WHERE 1=1
    ${walletId ? 'AND walletId = ?' : ''}
    ORDER BY date DESC, id DESC
    LIMIT ?
  `;

  if (walletId) params.push(walletId);
  params.push(limit);

  const result = await database.getAllAsync<any>(query, params);
  return result.map((row: any) =>
    row.type === 'expense' ? decryptExpenseRow(row) : decryptIncomeRow(row)
  );
};

export const getTransactionsPaginated = async (options: {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  category?: string;
  type?: 'all' | 'income' | 'expense';
  walletId?: number;
}): Promise<any[]> => {
  const { limit = 20, offset = 0, startDate, endDate, searchQuery, category, type = 'all', walletId } = options;
  const database = getDb();

  let baseQuery = `
    SELECT * FROM (
      SELECT id, 'expense' as type, title, amount, base_amount, category, date, description, currency, receipt_image_path, walletId
      FROM expenses
      UNION ALL
      SELECT id, 'income' as type, source as title, amount, base_amount, category, date, description, currency, null as receipt_image_path, walletId
      FROM income
    ) WHERE 1=1
  `;
  const params: any[] = [];

  if (walletId) {
    baseQuery += ' AND walletId = ?';
    params.push(walletId);
  }
  if (type !== 'all') {
    baseQuery += ' AND type = ?';
    params.push(type);
  }
  if (startDate) {
    baseQuery += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    baseQuery += ' AND date <= ?';
    params.push(endDate);
  }
  if (searchQuery) {
    baseQuery += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (category && category !== 'all') {
    baseQuery += ' AND category = ?';
    params.push(category);
  }

  baseQuery += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await database.getAllAsync<any>(baseQuery, params);
};

export const getExpensesPaginated = async (options: {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  category?: string;
  walletId?: number;
}): Promise<import('../types').Expense[]> => {
  const { limit = 20, offset = 0, startDate, endDate, searchQuery, category, walletId } = options;
  const database = getDb();
  let query = 'SELECT * FROM expenses WHERE 1=1';
  const params: any[] = [];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (searchQuery) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await database.getAllAsync<import('../types').Expense>(query, params);
  return result.map(decryptExpenseRow);
};

export const getExpensesTotalAmount = async (options: {
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  category?: string;
  walletId?: number;
}): Promise<number> => {
  const { startDate, endDate, searchQuery, category, walletId } = options;
  const database = getDb();
  let query = 'SELECT SUM(base_amount) as total FROM expenses WHERE 1=1';
  const params: any[] = [];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (searchQuery) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  const result = await database.getFirstAsync<{ total: number }>(query, params);
  return result?.total || 0;
};

export const updateExpense = async (id: number, expense: Omit<import('../types').Expense, 'id'>): Promise<void> => {
  const database = getDb();
  let baseAmount = expense.base_amount !== undefined ? expense.base_amount : expense.amount;
  if (isNaN(baseAmount)) baseAmount = expense.amount;

  const encBlob = encryptField({ title: expense.title, description: expense.description ?? null });

  await database.runAsync(
    'UPDATE expenses SET title = ?, amount = ?, base_amount = ?, category = ?, date = ?, description = ?, currency = ?, receipt_image_path = ?, enc_blob = ?, synced_at = NULL WHERE id = ?',
    [
      expense.title ? String(expense.title) : 'مصروف',
      Number(expense.amount) || 0,
      Number(baseAmount) || 0,
      expense.category ? String(expense.category) : 'other',
      expense.date ? String(expense.date) : new Date().toISOString().split('T')[0],
      expense.description ? String(expense.description) : null,
      expense.currency ? String(expense.currency) : 'IQD',
      expense.receipt_image_path ? String(expense.receipt_image_path) : null,
      encBlob,
      id
    ]
  );

  // Update widgets (async, don't wait)
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (error) {
    // Ignore if widget service is not available
  }
};

export const deleteExpense = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM expenses WHERE id = ?', [id]);

  // Update widgets (async, don't wait)
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (error) {
    // Ignore if widget service is not available
  }
};

// Income operations
function decryptIncomeRow<T extends { enc_blob?: string | null; source?: string; description?: string | null }>(row: T): T {
  const dec = decryptField<{ source?: string; description?: string | null }>(row.enc_blob);
  if (!dec) return row;
  return { ...row, ...(dec.source !== undefined ? { source: dec.source } : {}), ...(dec.description !== undefined ? { description: dec.description } : {}) };
}

export const addIncome = async (income: Omit<import('../types').Income, 'id'>): Promise<number> => {
  const database = getDb();
  let baseAmount = income.base_amount !== undefined ? income.base_amount : income.amount;
  if (isNaN(baseAmount)) baseAmount = income.amount;

  const encBlob = encryptField({ source: income.source, description: income.description ?? null });

  const result = await database.runAsync(
    'INSERT INTO income (source, amount, base_amount, date, description, currency, category, enc_blob, walletId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      income.source ? String(income.source) : 'أخرى',
      Number(income.amount) || 0,
      Number(baseAmount) || 0,
      income.date ? String(income.date) : new Date().toISOString().split('T')[0],
      income.description ? String(income.description) : null,
      income.currency ? String(income.currency) : 'IQD',
      income.category ? String(income.category) : 'other',
      encBlob,
      income.walletId || (await getWallets())[0]?.id || 1,
    ]
  );

  // Check achievements after adding income (async, don't wait)
  try {
    const { checkAllAchievements } = await import('../services/achievementService');
    checkAllAchievements().catch(() => { });
  } catch (error) {
    // Ignore if achievementService is not available
  }

  // Update widgets (async, don't wait)
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (error) {
    // Ignore if widget service is not available
  }

  return result.lastInsertRowId;
};

export const getIncome = async (walletId?: number): Promise<import('../types').Income[]> => {
  const database = getDb();
  let query = 'SELECT * FROM income';
  const params: any[] = [];

  if (walletId) {
    query += ' WHERE walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY date DESC, id DESC';

  const result = await database.getAllAsync<import('../types').Income>(query, params);
  return result.map(decryptIncomeRow);
};

export const getRecentIncomeForShortcutRanking = async (
  limit: number = 300,
  walletId?: number
): Promise<Array<{ source?: string; category?: string; amount: number; base_amount?: number; date: string }>> => {
  const database = getDb();
  let query = 'SELECT source, category, amount, base_amount, date FROM income';
  const params: any[] = [];

  if (walletId) {
    query += ' WHERE walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY date DESC, id DESC LIMIT ?';
  params.push(limit);

  return database.getAllAsync<{ source?: string; category?: string; amount: number; base_amount?: number; date: string }>(
    query, params
  );
};

export const getIncomeCount = async (options: {
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  category?: string;
  walletId?: number;
} = {}): Promise<number> => {
  const { startDate, endDate, searchQuery, category, walletId } = options;
  const database = getDb();
  let query = 'SELECT COUNT(*) as count FROM income WHERE 1=1';
  const params: any[] = [];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }
  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (searchQuery) {
    query += ' AND (source LIKE ? OR description LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  const result = await database.getFirstAsync<{ count: number }>(query, params);
  return result?.count || 0;
};

export const getIncomeByRange = async (startDate: string, endDate: string, walletId?: number): Promise<import('../types').Income[]> => {
  const database = getDb();
  let query = 'SELECT * FROM income WHERE date >= ? AND date <= ?';
  const params: any[] = [startDate, endDate];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY date DESC, id DESC';
  const result = await database.getAllAsync<import('../types').Income>(query, params);
  return result.map(decryptIncomeRow);
};

export const getIncomePaginated = async (options: {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  category?: string;
  walletId?: number;
}): Promise<import('../types').Income[]> => {
  const { limit = 20, offset = 0, startDate, endDate, searchQuery, category, walletId } = options;
  const database = getDb();
  let query = 'SELECT * FROM income WHERE 1=1';
  const params: any[] = [];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (searchQuery) {
    query += ' AND (source LIKE ? OR description LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await database.getAllAsync<import('../types').Income>(query, params);
  return result.map(decryptIncomeRow);
};

export const getIncomeTotalAmount = async (options: {
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  category?: string;
  walletId?: number;
}): Promise<number> => {
  const { startDate, endDate, searchQuery, category, walletId } = options;
  const database = getDb();
  let query = 'SELECT SUM(base_amount) as total FROM income WHERE 1=1';
  const params: any[] = [];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  if (startDate) {
    query += ' AND date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date <= ?';
    params.push(endDate);
  }
  if (searchQuery) {
    query += ' AND (source LIKE ? OR description LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  const result = await database.getFirstAsync<{ total: number }>(query, params);
  return result?.total || 0;
};

export const updateIncome = async (id: number, income: Omit<import('../types').Income, 'id'>): Promise<void> => {
  const database = getDb();
  let baseAmount = income.base_amount !== undefined ? income.base_amount : income.amount;
  if (isNaN(baseAmount)) baseAmount = income.amount;

  const encBlob = encryptField({ source: income.source, description: income.description ?? null });

  await database.runAsync(
    'UPDATE income SET source = ?, amount = ?, base_amount = ?, date = ?, description = ?, currency = ?, category = ?, enc_blob = ?, synced_at = NULL WHERE id = ?',
    [
      income.source ? String(income.source) : 'أخرى',
      Number(income.amount) || 0,
      Number(baseAmount) || 0,
      income.date ? String(income.date) : new Date().toISOString().split('T')[0],
      income.description ? String(income.description) : null,
      income.currency ? String(income.currency) : 'IQD',
      income.category ? String(income.category) : 'other',
      encBlob,
      id
    ]
  );

  // Update widgets (async, don't wait)
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (error) {
    // Ignore if widget service is not available
  }
};

export const deleteIncome = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM income WHERE id = ?', [id]);

  // Update widgets (async, don't wait)
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (error) {
    // Ignore if widget service is not available
  }
};

// Sync helpers: get unsynced records (synced_at IS NULL)
export const getUnsyncedExpenses = async (): Promise<import('../types').Expense[]> => {
  const database = getDb();
  const hasSyncedColumn = await database
    .getAllAsync<{ name: string }>("PRAGMA table_info(expenses)")
    .then(cols => cols.some(c => c.name === 'synced_at'));
  if (!hasSyncedColumn) return [];
  const result = await database.getAllAsync<import('../types').Expense>(
    'SELECT * FROM expenses WHERE synced_at IS NULL ORDER BY id ASC'
  );
  return result.map(decryptExpenseRow);
};

export const getUnsyncedIncome = async (): Promise<import('../types').Income[]> => {
  const database = getDb();
  const hasSyncedColumn = await database
    .getAllAsync<{ name: string }>("PRAGMA table_info(income)")
    .then(cols => cols.some(c => c.name === 'synced_at'));
  if (!hasSyncedColumn) return [];
  const result = await database.getAllAsync<import('../types').Income>(
    'SELECT * FROM income WHERE synced_at IS NULL ORDER BY id ASC'
  );
  return result.map(decryptIncomeRow);
};

export const markExpensesSynced = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return;
  const database = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const ts = Math.floor(Date.now() / 1000);
  await database.runAsync(
    `UPDATE expenses SET synced_at = ? WHERE id IN (${placeholders})`,
    [ts, ...ids]
  );
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (_) { }
};

export const markIncomeSynced = async (ids: number[]): Promise<void> => {
  if (ids.length === 0) return;
  const database = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const ts = Math.floor(Date.now() / 1000);
  await database.runAsync(
    `UPDATE income SET synced_at = ? WHERE id IN (${placeholders})`,
    [ts, ...ids]
  );
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (_) { }
};

/** Mark all expenses and income as synced (e.g. after full backup upload). */
export const markAllExpensesAndIncomeSynced = async (): Promise<void> => {
  const database = getDb();
  const ts = Math.floor(Date.now() / 1000);
  const hasExpensesSynced = await database
    .getAllAsync<{ name: string }>('PRAGMA table_info(expenses)')
    .then(cols => cols.some(c => c.name === 'synced_at'));
  const hasIncomeSynced = await database
    .getAllAsync<{ name: string }>('PRAGMA table_info(income)')
    .then(cols => cols.some(c => c.name === 'synced_at'));
  if (hasExpensesSynced) {
    await database.runAsync('UPDATE expenses SET synced_at = ? WHERE synced_at IS NULL', [ts]);
  }
  if (hasIncomeSynced) {
    await database.runAsync('UPDATE income SET synced_at = ? WHERE synced_at IS NULL', [ts]);
  }

  const tables = [
    'financial_goals', 'budgets', 'recurring_expenses', 'debts', 'debtors',
    'debt_installments', 'debt_payments', 'bills', 'bill_payments',
    'custom_categories', 'challenges', 'achievements', 'expense_shortcuts',
    'income_shortcuts', 'notifications', 'user_settings', 'app_settings',
    'notification_settings', 'savings', 'savings_transactions', 'wallets'
  ];

  for (const table of tables) {
    const hasSync = await hasSyncedColumn(database, table);
    if (hasSync) {
      await database.runAsync(`UPDATE ${table} SET synced_at = ? WHERE synced_at IS NULL`, [ts]);
    }
  }
  try {
    const { saveWidgetData } = await import('../services/widgetDataService');
    saveWidgetData().catch(() => { });
  } catch (_) { }
};

const hasSyncedColumn = async (database: SQLite.SQLiteDatabase, table: string): Promise<boolean> => {
  const cols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some(c => c.name === 'synced_at');
};

const getUnsyncedFromTable = async <T>(table: string): Promise<T[]> => {
  const database = getDb();
  if (!(await hasSyncedColumn(database, table))) return [];
  return database.getAllAsync<T>(`SELECT * FROM ${table} WHERE synced_at IS NULL ORDER BY id ASC`);
};

const markTableSynced = async (table: string, ids: number[]): Promise<void> => {
  if (ids.length === 0) return;
  const database = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const ts = Math.floor(Date.now() / 1000);
  await database.runAsync(
    `UPDATE ${table} SET synced_at = ? WHERE id IN (${placeholders})`,
    [ts, ...ids]
  );
};

export const getUnsyncedFinancialGoals = () => getUnsyncedFromTable<import('../types').FinancialGoal>('financial_goals');
export const getUnsyncedCustomCategories = () => getUnsyncedFromTable<CustomCategory>('custom_categories');
export const getUnsyncedBudgets = () => getUnsyncedFromTable<Budget>('budgets');
export const getUnsyncedRecurringExpenses = () => getUnsyncedFromTable<RecurringExpense>('recurring_expenses');
export const getUnsyncedDebts = () => getUnsyncedFromTable<Debt>('debts');
export const getUnsyncedBills = () => getUnsyncedFromTable<Bill>('bills');
export const getUnsyncedChallenges = () => getUnsyncedFromTable<import('../types').Challenge>('challenges');
export const getUnsyncedAchievements = () => getUnsyncedFromTable<Achievement>('achievements');
export const getUnsyncedExpenseShortcuts = () => getUnsyncedFromTable<ExpenseShortcut>('expense_shortcuts');
export const getUnsyncedIncomeShortcuts = () => getUnsyncedFromTable<IncomeShortcut>('income_shortcuts');
export const getUnsyncedNotifications = () => getUnsyncedFromTable<DBNotification>('notifications');
export const getUnsyncedUserSettings = () => getUnsyncedFromTable<import('../types').UserSettings>('user_settings');
export const getUnsyncedAppSettings = () => getUnsyncedFromTable<import('../types').AppSettings>('app_settings');
export const getUnsyncedNotificationSettings = () => getUnsyncedFromTable<NotificationSettings>('notification_settings');
export const getUnsyncedSavings = () => getUnsyncedFromTable<import('../types').Savings>('savings');
export const getUnsyncedSavingsTransactions = () => getUnsyncedFromTable<import('../types').SavingsTransaction>('savings_transactions');
export const getUnsyncedDebtors = () => getUnsyncedFromTable<any>('debtors');
export const getUnsyncedDebtPayments = () => getUnsyncedFromTable<any>('debt_payments');
export const getUnsyncedDebtInstallments = () => getUnsyncedFromTable<any>('debt_installments');
export const getUnsyncedBillPayments = () => getUnsyncedFromTable<any>('bill_payments');
export const getUnsyncedWallets = () => getUnsyncedFromTable<import('../types').Wallet>('wallets');

export const markFinancialGoalsSynced = (ids: number[]) => markTableSynced('financial_goals', ids);
export const markCustomCategoriesSynced = (ids: number[]) => markTableSynced('custom_categories', ids);
export const markBudgetsSynced = (ids: number[]) => markTableSynced('budgets', ids);
export const markRecurringExpensesSynced = (ids: number[]) => markTableSynced('recurring_expenses', ids);
export const markDebtsSynced = (ids: number[]) => markTableSynced('debts', ids);
export const markBillsSynced = (ids: number[]) => markTableSynced('bills', ids);
export const markChallengesSynced = (ids: number[]) => markTableSynced('challenges', ids);
export const markAchievementsSynced = (ids: number[]) => markTableSynced('achievements', ids);
export const markExpenseShortcutsSynced = (ids: number[]) => markTableSynced('expense_shortcuts', ids);
export const markIncomeShortcutsSynced = (ids: number[]) => markTableSynced('income_shortcuts', ids);
export const markNotificationsSynced = (ids: number[]) => markTableSynced('notifications', ids);
export const markUserSettingsSynced = (ids: number[]) => markTableSynced('user_settings', ids);
export const markAppSettingsSynced = (ids: number[]) => markTableSynced('app_settings', ids);
export const markNotificationSettingsSynced = (ids: number[]) => markTableSynced('notification_settings', ids);
export const markSavingsSynced = (ids: number[]) => markTableSynced('savings', ids);
export const markSavingsTransactionsSynced = (ids: number[]) => markTableSynced('savings_transactions', ids);
export const markDebtorsSynced = (ids: number[]) => markTableSynced('debtors', ids);
export const markDebtPaymentsSynced = (ids: number[]) => markTableSynced('debt_payments', ids);
export const markDebtInstallmentsSynced = (ids: number[]) => markTableSynced('debt_installments', ids);
export const markBillPaymentsSynced = (ids: number[]) => markTableSynced('bill_payments', ids);
export const markWalletsSynced = (ids: number[]) => markTableSynced('wallets', ids);

export const getAvailableMonths = async (walletId?: number): Promise<{ year: number; month: number }[]> => {
  const database = getDb();

  let query = `
    SELECT DISTINCT SUBSTR(date, 1, 4) as year, SUBSTR(date, 6, 2) as month 
    FROM (
      SELECT date, walletId FROM expenses
      UNION ALL
      SELECT date, walletId FROM income
    )
    WHERE 1=1
  `;
  const params: any[] = [];
  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }
  query += ' ORDER BY year DESC, month DESC';

  const results = await database.getAllAsync<any>(query, params);
  return results.map(row => ({ year: parseInt(row.year), month: parseInt(row.month) }));
};

export const getAvailableExpenseMonths = async (walletId?: number): Promise<{ year: number; month: number }[]> => {
  const database = getDb();
  let query = 'SELECT DISTINCT SUBSTR(date, 1, 4) as year, SUBSTR(date, 6, 2) as month FROM expenses WHERE 1=1';
  const params: any[] = [];
  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }
  query += ' ORDER BY year DESC, month DESC';

  const results = await database.getAllAsync<any>(query, params);
  return results.map(row => ({ year: parseInt(row.year), month: parseInt(row.month) }));
};

export const getAvailableIncomeMonths = async (walletId?: number): Promise<{ year: number; month: number }[]> => {
  const database = getDb();
  let query = 'SELECT DISTINCT SUBSTR(date, 1, 4) as year, SUBSTR(date, 6, 2) as month FROM income WHERE 1=1';
  const params: any[] = [];
  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }
  query += ' ORDER BY year DESC, month DESC';

  const results = await database.getAllAsync<any>(query, params);
  return results.map(row => ({ year: parseInt(row.year), month: parseInt(row.month) }));
};

const hasBaseAmountColumns = async (database: SQLite.SQLiteDatabase): Promise<boolean> => {
  if (hasBaseAmountColumnsCache !== null) {
    return hasBaseAmountColumnsCache;
  }

  try {
    const [expenseInfo, incomeInfo] = await Promise.all([
      database.getAllAsync<any>("PRAGMA table_info(expenses)"),
      database.getAllAsync<any>("PRAGMA table_info(income)"),
    ]);
    const hasExpenseBaseAmount = expenseInfo.some(col => col.name === 'base_amount');
    const hasIncomeBaseAmount = incomeInfo.some(col => col.name === 'base_amount');
    hasBaseAmountColumnsCache = hasExpenseBaseAmount && hasIncomeBaseAmount;
  } catch (e) {
    hasBaseAmountColumnsCache = true;
  }

  return hasBaseAmountColumnsCache;
};

export const getFinancialStatsAggregated = async (startDate?: string, endDate?: string, walletId?: number) => {
  const database = getDb();
  let expenseQuery = 'SELECT SUM(base_amount) as total FROM expenses WHERE 1=1';
  let incomeQuery = 'SELECT SUM(base_amount) as total FROM income WHERE 1=1';
  const params: any[] = [];

  const hasBaseAmount = await hasBaseAmountColumns(database);
  if (!hasBaseAmount) {
    expenseQuery = 'SELECT SUM(amount) as total FROM expenses WHERE 1=1';
    incomeQuery = 'SELECT SUM(amount) as total FROM income WHERE 1=1';
  }

  if (startDate && endDate) {
    expenseQuery += ' AND date >= ? AND date <= ?';
    incomeQuery += ' AND date >= ? AND date <= ?';
    params.push(startDate, endDate);
  }

  if (walletId) {
    expenseQuery += ' AND walletId = ?';
    incomeQuery += ' AND walletId = ?';
    params.push(walletId);
  }

  // We need to be careful with params if both date and walletId are present
  const expenseParams = [];
  const incomeParams = [];
  if (startDate && endDate) {
    expenseParams.push(startDate, endDate);
    incomeParams.push(startDate, endDate);
  }
  if (walletId) {
    expenseParams.push(walletId);
    incomeParams.push(walletId);
  }

  const expenseResult = await database.getFirstAsync<{ total: number }>(expenseQuery, expenseParams);
  const incomeResult = await database.getFirstAsync<{ total: number }>(incomeQuery, incomeParams);

  return {
    totalExpenses: expenseResult?.total || 0,
    totalIncome: incomeResult?.total || 0,
    balance: (incomeResult?.total || 0) - (expenseResult?.total || 0),
  };
};

export const getExpensesByCategoryAggregated = async (startDate?: string, endDate?: string, walletId?: number) => {
  const database = getDb();
  const hasBaseAmount = await hasBaseAmountColumns(database);
  const amountCol = hasBaseAmount ? 'base_amount' : 'amount';

  let query = `SELECT category, SUM(${amountCol}) as amount FROM expenses WHERE 1=1`;
  const params: any[] = [];

  if (startDate && endDate) {
    query += ' AND date >= ? AND date <= ?';
    params.push(startDate, endDate);
  }

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  query += ' GROUP BY category ORDER BY amount DESC';

  const results = await database.getAllAsync<{ category: string; amount: number }>(query, params);
  return results;
};

// User settings
export const getUserSettings = async (): Promise<import('../types').UserSettings | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM user_settings LIMIT 1'
  );
  if (result) {
    return {
      ...result,
      biometricsEnabled: Boolean(result.biometricsEnabled),
    };
  }
  return null;
};

export const upsertUserSettings = async (settings: import('../types').UserSettings): Promise<void> => {
  const database = getDb();
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM user_settings LIMIT 1');

  const passwordHash = settings.passwordHash === undefined ? null : (settings.passwordHash || null);
  const authMethod = settings.authMethod || 'none';

  if (existing) {
    await database.runAsync(
      'UPDATE user_settings SET name = ?, authMethod = ?, passwordHash = ?, biometricsEnabled = ? WHERE id = ?',
      [
        settings.name || null,
        authMethod,
        passwordHash,
        settings.biometricsEnabled ? 1 : 0,
        existing.id,
      ]
    );
  } else {
    await database.runAsync(
      'INSERT INTO user_settings (name, authMethod, passwordHash, biometricsEnabled) VALUES (?, ?, ?, ?)',
      [
        settings.name || null,
        authMethod,
        passwordHash,
        settings.biometricsEnabled ? 1 : 0,
      ]
    );
  }
};

// User profile operations
export interface UserProfile {
  userId: string;
  phone: string;
  name?: string;
  email?: string;
  isPro?: boolean;
}

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  const database = getDb();
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM user_settings LIMIT 1');

  if (existing) {
    await database.runAsync(
      'UPDATE user_settings SET userId = ?, phone = ?, name = ?, email = ?, isPro = ? WHERE id = ?',
      [
        profile.userId,
        profile.phone,
        profile.name || null,
        profile.email || null,
        profile.isPro ? 1 : 0,
        existing.id,
      ]
    );
  } else {
    await database.runAsync(
      'INSERT INTO user_settings (userId, phone, name, email, isPro, authMethod, biometricsEnabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        profile.userId,
        profile.phone,
        profile.name || null,
        profile.email || null,
        profile.isPro ? 1 : 0,
        'none',
        0,
      ]
    );
  }
};

export const clearUserProfile = async (): Promise<void> => {
  const database = getDb();
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM user_settings LIMIT 1');

  if (existing) {
    await database.runAsync(
      'UPDATE user_settings SET name = NULL, userId = NULL, phone = NULL, email = NULL, isPro = 0 WHERE id = ?',
      [existing.id]
    );
  }
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT userId, phone, name, email, isPro FROM user_settings WHERE userId IS NOT NULL LIMIT 1'
  );

  if (result && result.userId) {
    return {
      userId: result.userId,
      phone: result.phone || '',
      name: result.name || undefined,
      email: result.email || undefined,
      isPro: result.isPro === 1,
    };
  }
  return null;
};

// App settings
export const getAppSettings = async (): Promise<import('../types').AppSettings | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM app_settings LIMIT 1'
  );
  if (result) {
    return {
      ...result,
      notificationsEnabled: result.notificationsEnabled === 1,
      darkModeEnabled: result.darkModeEnabled === 1,
      themeMode: result.themeMode || (result.darkModeEnabled === 1 ? 'dark' : 'light'),
      autoBackupEnabled: result.autoBackupEnabled === 1,
      autoSyncEnabled: result.autoSyncEnabled === 1,
      lastAutoSyncTime: result.lastAutoSyncTime,
    };
  }
  return null;
};

export const upsertAppSettings = async (settings: import('../types').AppSettings): Promise<void> => {
  const database = getDb();
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM app_settings LIMIT 1');

  const autoSync = settings.autoSyncEnabled ? 1 : 0;
  const lastSyncTime = settings.lastAutoSyncTime ?? null;
  if (existing) {
    await database.runAsync(
      'UPDATE app_settings SET notificationsEnabled = ?, darkModeEnabled = ?, themeMode = ?, autoBackupEnabled = ?, autoSyncEnabled = ?, lastAutoSyncTime = ?, currency = ?, language = ? WHERE id = ?',
      [
        settings.notificationsEnabled ? 1 : 0,
        settings.darkModeEnabled ? 1 : 0,
        settings.themeMode || (settings.darkModeEnabled ? 'dark' : 'light'),
        settings.autoBackupEnabled ? 1 : 0,
        autoSync,
        lastSyncTime,
        settings.currency,
        settings.language,
        existing.id,
      ]
    );
  } else {
    await database.runAsync(
      'INSERT INTO app_settings (notificationsEnabled, darkModeEnabled, themeMode, autoBackupEnabled, autoSyncEnabled, lastAutoSyncTime, currency, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        settings.notificationsEnabled ? 1 : 0,
        settings.darkModeEnabled ? 1 : 0,
        settings.themeMode || (settings.darkModeEnabled ? 'dark' : 'light'),
        settings.autoBackupEnabled ? 1 : 0,
        autoSync,
        lastSyncTime,
        settings.currency,
        settings.language,
      ]
    );
  }
};

// Notification settings
export interface NotificationSettings {
  id?: number;
  dailyReminder: number;
  dailyReminderTime: string;
  expenseReminder: number;
  expenseReminderTime?: string;
  incomeReminder: number;
  weeklySummary: number;
  monthlySummary: number;
}

export const getNotificationSettings = async (): Promise<NotificationSettings | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM notification_settings LIMIT 1'
  );
  if (result) {
    return {
      ...result,
      dailyReminder: result.dailyReminder === 1,
      expenseReminder: result.expenseReminder === 1,
      incomeReminder: result.incomeReminder === 1,
      weeklySummary: result.weeklySummary === 1,
      monthlySummary: result.monthlySummary === 1,
    };
  }
  return null;
};

function toNum(v: number | boolean | undefined): number {
  if (v === true || v === 1) return 1;
  return 0;
}

export const upsertNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  const database = getDb();
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM notification_settings LIMIT 1');

  const dailyReminder = toNum(settings.dailyReminder);
  const dailyReminderTime = String(settings.dailyReminderTime || '20:00');
  const expenseReminder = toNum(settings.expenseReminder);
  const expenseReminderTime = String(settings.expenseReminderTime || '20:00');
  const incomeReminder = toNum(settings.incomeReminder);
  const weeklySummary = toNum(settings.weeklySummary);
  const monthlySummary = toNum(settings.monthlySummary);

  if (existing) {
    await database.runAsync(
      'UPDATE notification_settings SET dailyReminder = ?, dailyReminderTime = ?, expenseReminder = ?, expenseReminderTime = ?, incomeReminder = ?, weeklySummary = ?, monthlySummary = ? WHERE id = ?',
      [
        dailyReminder,
        dailyReminderTime,
        expenseReminder,
        expenseReminderTime,
        incomeReminder,
        weeklySummary,
        monthlySummary,
        existing.id,
      ]
    );
  } else {
    await database.runAsync(
      'INSERT INTO notification_settings (dailyReminder, dailyReminderTime, expenseReminder, expenseReminderTime, incomeReminder, weeklySummary, monthlySummary) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        dailyReminder,
        dailyReminderTime,
        expenseReminder,
        expenseReminderTime,
        incomeReminder,
        weeklySummary,
        monthlySummary,
      ]
    );
  }
};

// Clear data
export const clearExpenses = async (): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM expenses');
};

export const clearIncome = async (): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM income');
};

// Financial Goals operations
export const addFinancialGoal = async (goal: Omit<import('../types').FinancialGoal, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();

  let baseTargetAmount = goal.base_target_amount !== undefined ? goal.base_target_amount : goal.targetAmount;
  if (isNaN(baseTargetAmount)) baseTargetAmount = goal.targetAmount;

  let baseCurrentAmount = goal.base_current_amount !== undefined ? goal.base_current_amount : goal.currentAmount || 0;
  if (isNaN(baseCurrentAmount)) baseCurrentAmount = goal.currentAmount || 0;

  const result = await database.runAsync(
    'INSERT INTO financial_goals (title, targetAmount, base_target_amount, currentAmount, base_current_amount, targetDate, category, description, createdAt, completed, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      goal.title,
      goal.targetAmount,
      baseTargetAmount,
      goal.currentAmount || 0,
      baseCurrentAmount,
      goal.targetDate || null,
      goal.category,
      goal.description || null,
      createdAt,
      goal.completed ? 1 : 0,
      goal.currency || 'IQD',
    ]
  );
  return result.lastInsertRowId;
};

export const getFinancialGoals = async (): Promise<import('../types').FinancialGoal[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM financial_goals ORDER BY targetDate ASC'
  );
  return result.map((item: any) => ({
    ...item,
    completed: item.completed === 1,
  }));
};

export const getFinancialGoal = async (id: number): Promise<import('../types').FinancialGoal | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM financial_goals WHERE id = ?',
    [id]
  );
  if (result) {
    return {
      ...result,
      completed: result.completed === 1,
    };
  }
  return null;
};

export const updateFinancialGoal = async (id: number, goal: Partial<import('../types').FinancialGoal>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (goal.title !== undefined) {
    updates.push('title = ?');
    values.push(goal.title);
  }
  if (goal.targetAmount !== undefined) {
    updates.push('targetAmount = ?');
    values.push(goal.targetAmount);
  }
  if (goal.currentAmount !== undefined) {
    updates.push('currentAmount = ?');
    values.push(goal.currentAmount);
  }
  if (goal.targetDate !== undefined) {
    updates.push('targetDate = ?');
    values.push(goal.targetDate || null);
  }
  if (goal.category !== undefined) {
    updates.push('category = ?');
    values.push(goal.category);
  }
  if (goal.description !== undefined) {
    updates.push('description = ?');
    values.push(goal.description || null);
  }
  if (goal.completed !== undefined) {
    updates.push('completed = ?');
    values.push(goal.completed ? 1 : 0);
  }
  if (goal.currency !== undefined) {
    updates.push('currency = ?');
    values.push(goal.currency || 'IQD');
  }
  if (goal.base_target_amount !== undefined) {
    updates.push('base_target_amount = ?');
    values.push(goal.base_target_amount);
  }
  if (goal.base_current_amount !== undefined) {
    updates.push('base_current_amount = ?');
    values.push(goal.base_current_amount);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE financial_goals SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const deleteFinancialGoal = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM financial_goals WHERE id = ?', [id]);
};

// Custom Categories operations
export interface CustomCategory {
  id: number;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  createdAt: string;
}

export const addCustomCategory = async (category: Omit<CustomCategory, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  try {
    const result = await database.runAsync(
      'INSERT INTO custom_categories (name, type, icon, color, createdAt) VALUES (?, ?, ?, ?, ?)',
      [category.name, category.type, category.icon || 'ellipse', category.color || '#6B7280', createdAt]
    );
    return result.lastInsertRowId;
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      throw new Error('هذه الفئة موجودة بالفعل في نفس النوع');
    }
    throw error;
  }
};

export const getCustomCategories = async (type?: 'expense' | 'income'): Promise<CustomCategory[]> => {
  const database = getDb();
  let query = 'SELECT * FROM custom_categories';
  const params: any[] = [];
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  query += ' ORDER BY createdAt ASC';
  const result = await database.getAllAsync<CustomCategory>(query, params);
  return result;
};

export const deleteCustomCategory = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM custom_categories WHERE id = ?', [id]);
};

export const updateCustomCategory = async (id: number, category: Partial<Omit<CustomCategory, 'id' | 'createdAt'>>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (category.name !== undefined) {
    updates.push('name = ?');
    values.push(category.name);
  }
  if (category.type !== undefined) {
    updates.push('type = ?');
    values.push(category.type);
  }
  if (category.icon !== undefined) {
    updates.push('icon = ?');
    values.push(category.icon);
  }
  if (category.color !== undefined) {
    updates.push('color = ?');
    values.push(category.color);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE custom_categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

// Budget operations
export interface Budget {
  id: number;
  category: string;
  amount: number;
  month: string;
  year: number;
  createdAt: string;
  currency?: string;
  base_amount?: number;
}

export const addBudget = async (budget: Omit<Budget, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();

  let baseAmount = budget.base_amount !== undefined ? budget.base_amount : budget.amount;
  if (isNaN(baseAmount)) baseAmount = budget.amount;

  try {
    const result = await database.runAsync(
      'INSERT OR REPLACE INTO budgets (category, amount, base_amount, month, year, createdAt, currency) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [budget.category, budget.amount, baseAmount, budget.month, budget.year, createdAt, budget.currency || 'IQD']
    );
    return result.lastInsertRowId;
  } catch (error) {
    // Error adding budget
    throw error;
  }
};

export const getBudgets = async (month?: string, year?: number): Promise<Budget[]> => {
  const database = getDb();
  let query = 'SELECT * FROM budgets';
  const params: any[] = [];

  if (month && year) {
    query += ' WHERE month = ? AND year = ?';
    params.push(month, year);
  } else if (year) {
    query += ' WHERE year = ?';
    params.push(year);
  }

  query += ' ORDER BY createdAt DESC';
  const result = await database.getAllAsync<Budget>(query, params);
  return result;
};

export const getBudget = async (category: string, month: string, year: number): Promise<Budget | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<Budget>(
    'SELECT * FROM budgets WHERE category = ? AND month = ? AND year = ?',
    [category, month, year]
  );
  return result || null;
};

export const updateBudget = async (id: number, budget: Partial<Budget>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (budget.category !== undefined) {
    updates.push('category = ?');
    values.push(budget.category);
  }
  if (budget.amount !== undefined) {
    updates.push('amount = ?');
    values.push(budget.amount);
  }
  if (budget.month !== undefined) {
    updates.push('month = ?');
    values.push(budget.month);
  }
  if (budget.year !== undefined) {
    updates.push('year = ?');
    values.push(budget.year);
  }
  if (budget.currency !== undefined) {
    updates.push('currency = ?');
    values.push(budget.currency || 'IQD');
  }
  if (budget.base_amount !== undefined) {
    updates.push('base_amount = ?');
    values.push(budget.base_amount);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE budgets SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const deleteBudget = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
};

// Recurring Expenses operations
export interface RecurringExpense {
  id: number;
  title: string;
  amount: number;
  category: string;
  recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceValue: number; // e.g., every 2 weeks = 2
  startDate: string;
  endDate?: string;
  description?: string;
  isActive: boolean;
  currency?: string;
  base_amount?: number;
  lastProcessedDate?: string;
  createdAt: string;
}

export const addRecurringExpense = async (expense: Omit<RecurringExpense, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();

  let baseAmount = expense.base_amount !== undefined ? expense.base_amount : expense.amount;
  if (isNaN(baseAmount)) baseAmount = expense.amount;

  const result = await database.runAsync(
    'INSERT INTO recurring_expenses (title, amount, base_amount, category, recurrenceType, recurrenceValue, startDate, endDate, description, isActive, lastProcessedDate, createdAt, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      expense.title,
      expense.amount,
      baseAmount,
      expense.category,
      expense.recurrenceType,
      expense.recurrenceValue,
      expense.startDate,
      expense.endDate || null,
      expense.description || null,
      expense.isActive ? 1 : 0,
      expense.lastProcessedDate || null,
      createdAt,
      expense.currency || 'IQD',
    ]
  );
  return result.lastInsertRowId;
};

export const getRecurringExpenses = async (activeOnly?: boolean, walletId?: number): Promise<RecurringExpense[]> => {
  const database = getDb();
  let query = 'SELECT * FROM recurring_expenses WHERE 1=1';
  const params: any[] = [];

  if (activeOnly) {
    query += ' AND isActive = 1';
  }

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY createdAt DESC'; // Keeping original ORDER BY for consistency, as the instruction didn't explicitly ask to change it.
  const result = await database.getAllAsync<any>(query, params);
  return result.map((exp: any) => ({
    ...exp,
    isActive: exp.isActive === 1,
  }));
};

export const getRecurringExpense = async (id: number): Promise<RecurringExpense | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM recurring_expenses WHERE id = ?',
    [id]
  );
  if (result) {
    return {
      ...result,
      isActive: result.isActive === 1,
    };
  }
  return null;
};

export const updateRecurringExpense = async (id: number, expense: Partial<RecurringExpense>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (expense.title !== undefined) {
    updates.push('title = ?');
    values.push(expense.title);
  }
  if (expense.amount !== undefined) {
    updates.push('amount = ?');
    values.push(expense.amount);
  }
  if (expense.category !== undefined) {
    updates.push('category = ?');
    values.push(expense.category);
  }
  if (expense.recurrenceType !== undefined) {
    updates.push('recurrenceType = ?');
    values.push(expense.recurrenceType);
  }
  if (expense.recurrenceValue !== undefined) {
    updates.push('recurrenceValue = ?');
    values.push(expense.recurrenceValue);
  }
  if (expense.startDate !== undefined) {
    updates.push('startDate = ?');
    values.push(expense.startDate);
  }
  if (expense.endDate !== undefined) {
    updates.push('endDate = ?');
    values.push(expense.endDate || null);
  }
  if (expense.description !== undefined) {
    updates.push('description = ?');
    values.push(expense.description || null);
  }
  if (expense.isActive !== undefined) {
    updates.push('isActive = ?');
    values.push(expense.isActive ? 1 : 0);
  }
  if (expense.lastProcessedDate !== undefined) {
    updates.push('lastProcessedDate = ?');
    values.push(expense.lastProcessedDate || null);
  }
  if (expense.currency !== undefined) {
    updates.push('currency = ?');
    values.push(expense.currency || 'IQD');
  }
  if (expense.base_amount !== undefined) {
    updates.push('base_amount = ?');
    values.push(expense.base_amount);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE recurring_expenses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const deleteRecurringExpense = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM recurring_expenses WHERE id = ?', [id]);
};

// Exchange Rates operations
export interface ExchangeRate {
  id: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  updatedAt: string;
}

export const upsertExchangeRate = async (rate: Omit<ExchangeRate, 'id' | 'updatedAt'>): Promise<void> => {
  const database = getDb();
  const updatedAt = new Date().toISOString();
  await database.runAsync(
    'INSERT OR REPLACE INTO exchange_rates (fromCurrency, toCurrency, rate, updatedAt) VALUES (?, ?, ?, ?)',
    [rate.fromCurrency, rate.toCurrency, rate.rate, updatedAt]
  );
};

export const getExchangeRate = async (fromCurrency: string, toCurrency: string): Promise<ExchangeRate | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<ExchangeRate>(
    'SELECT * FROM exchange_rates WHERE fromCurrency = ? AND toCurrency = ?',
    [fromCurrency, toCurrency]
  );
  return result || null;
};

export const getAllExchangeRates = async (): Promise<ExchangeRate[]> => {
  const database = getDb();
  const result = await database.getAllAsync<ExchangeRate>(
    'SELECT * FROM exchange_rates ORDER BY updatedAt DESC'
  );
  return result;
};

export const clearAllData = async (skipPragma: boolean = false): Promise<void> => {
  const database = getDb();

  // Tables in order of deletion to respect foreign keys if any
  const tables = [
    'debt_installments', 'debt_payments', 'debts', 'debtors',
    'bill_payments', 'bills',
    'savings_transactions', 'savings',
    'expenses', 'income',
    'financial_goals', 'budgets', 'recurring_expenses',
    'challenges', 'achievements', 'notifications',
    'expense_shortcuts', 'income_shortcuts',
    'wallets',
    'user_settings', 'app_settings', 'notification_settings',
    'custom_categories', 'exchange_rates',
    'ai_insights_cache', 'goal_plan_cache'
  ];

  try {
    // Disable foreign keys temporarily to ignore order during mass clear
    if (!skipPragma) await database.execAsync('PRAGMA foreign_keys = OFF;');

    for (const table of tables) {
      try {
        await database.runAsync(`DELETE FROM ${table}`);
      } catch (err) {
        // Skipping table if it doesn't exist
      }
    }

    // Re-enable (will be checked on commit if in transaction)
    if (!skipPragma) await database.execAsync('PRAGMA foreign_keys = ON;');
  } catch (err) {
    console.log('[Database] Error in clearAllData:', err);
  }
};

/**
 * Clean up old AI insights and goal plan cache (keep last 6 months)
 * Call this periodically or on app startup
 */
export const cleanupOldAiCache = async (): Promise<void> => {
  try {
    const { clearOldAiInsightsCache } = await import('./aiInsightsCache');
    const { clearOldGoalPlanCache } = await import('./goalPlanCache');
    await Promise.all([
      clearOldAiInsightsCache(6), // Keep 6 months
      clearOldGoalPlanCache(6), // Keep 6 months
    ]);
  } catch (error) {

  }
};

// Debt operations
export interface Debt {
  id: number;
  debtorId?: number;
  debtorName: string;
  totalAmount: number;
  remainingAmount: number;
  startDate: string;
  dueDate?: string;
  description?: string;
  type: 'debt' | 'installment' | 'advance';
  direction?: 'owed_by_me' | 'owed_to_me';
  currency?: string;
  base_total_amount?: number;
  base_remaining_amount?: number;
  isPaid: boolean;
  createdAt: string;
}

export interface DebtInstallment {
  id: number;
  debtId: number;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  paidDate?: string;
  installmentNumber: number;
  createdAt: string;
}

function decryptDebtRow<T extends { enc_blob?: string | null; debtorName?: string; description?: string | null }>(row: T): T {
  const dec = decryptField<{ debtorName?: string; description?: string | null }>(row.enc_blob);
  if (!dec) return row;
  return { ...row, ...(dec.debtorName !== undefined ? { debtorName: dec.debtorName } : {}), ...(dec.description !== undefined ? { description: dec.description } : {}) };
}

export const addDebt = async (debt: Omit<Debt, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const direction = debt.direction || 'owed_by_me';

  let baseTotal = debt.base_total_amount !== undefined ? debt.base_total_amount : debt.totalAmount;
  if (isNaN(baseTotal)) baseTotal = debt.totalAmount;

  let baseRemaining = debt.base_remaining_amount !== undefined ? debt.base_remaining_amount : debt.remainingAmount;
  if (isNaN(baseRemaining)) baseRemaining = debt.remainingAmount;

  const encBlob = encryptField({ debtorName: debt.debtorName, description: debt.description ?? null });

  const result = await database.runAsync(
    'INSERT INTO debts (debtorName, totalAmount, base_total_amount, remainingAmount, base_remaining_amount, startDate, dueDate, description, type, direction, currency, isPaid, createdAt, enc_blob, debtorId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      debt.debtorName,
      debt.totalAmount,
      baseTotal,
      debt.remainingAmount,
      baseRemaining,
      debt.startDate,
      debt.dueDate || null,
      debt.description || null,
      debt.type,
      direction,
      debt.currency || 'IQD',
      debt.isPaid ? 1 : 0,
      createdAt,
      encBlob,
      debt.debtorId || null,
    ]
  );
  return result.lastInsertRowId;
};

export interface Debtor {
  id: number;
  name: string;
  phone?: string;
  image_path?: string;
  createdAt: string;
  synced_at?: number;
}

export const addDebtor = async (debtor: Omit<Debtor, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();

  // Try to find by name first to avoid duplicates
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM debtors WHERE name = ?', [debtor.name]);
  if (existing) {
    if (debtor.phone) {
      await database.runAsync('UPDATE debtors SET phone = ?, synced_at = NULL WHERE id = ?', [debtor.phone, existing.id]);
    }
    return existing.id;
  }

  const result = await database.runAsync(
    'INSERT INTO debtors (name, phone, image_path, createdAt) VALUES (?, ?, ?, ?)',
    [debtor.name, debtor.phone || null, debtor.image_path || null, createdAt]
  );
  return result.lastInsertRowId;
};

export const updateDebtor = async (id: number, debtor: Partial<Debtor>): Promise<void> => {
  const database = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (debtor.name !== undefined) { fields.push('name = ?'); values.push(debtor.name); }
  if (debtor.phone !== undefined) { fields.push('phone = ?'); values.push(debtor.phone); }
  if (debtor.image_path !== undefined) { fields.push('image_path = ?'); values.push(debtor.image_path); }

  if (fields.length === 0) return;

  fields.push('synced_at = NULL');
  values.push(id);
  await database.runAsync(
    `UPDATE debtors SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const getDebtor = async (id: number): Promise<Debtor | null> => {
  const database = getDb();
  return await database.getFirstAsync<Debtor>('SELECT * FROM debtors WHERE id = ?', [id]);
};

export const deleteDebtor = async (id: number): Promise<void> => {
  const database = getDb();
  // This will NOT delete debts associated with the debtor, but will set their debtorId to null if FK is configured Correctly
  // Or we just delete the debtor and leave the debts (orphan state but still have debtorName)
  await database.runAsync('DELETE FROM debtors WHERE id = ?', [id]);
  await database.runAsync('UPDATE debts SET debtorId = NULL WHERE debtorId = ?', [id]);
};

export const getDebtors = async (): Promise<Debtor[]> => {
  const database = getDb();
  return await database.getAllAsync<Debtor>('SELECT * FROM debtors ORDER BY name ASC');
};

export interface DebtorSummary extends Debtor {
  totalOwedToMe: number;
  totalOwedByMe: number;
  netBalance: number;
  totalDebts: number;
  balances: {
    currency: string;
    totalOwedToMe: number;
    totalOwedByMe: number;
    netBalance: number;
  }[];
}

export const getDebtorSummaries = async (): Promise<DebtorSummary[]> => {
  const debtors = await getDebtors();
  const allDebts = await getDebts();

  return debtors.map(debtor => {
    const personDebts = allDebts.filter(d => d.debtorId === debtor.id || (!d.debtorId && d.debtorName === debtor.name));

    // Group by currency
    const groups: Record<string, { toMe: number; byMe: number }> = {};

    let totalToMe = 0;
    let totalByMe = 0;

    personDebts.forEach(d => {
      if (d.isPaid) return;

      const cur = d.currency || 'IQD';
      if (!groups[cur]) groups[cur] = { toMe: 0, byMe: 0 };

      if (d.direction === 'owed_to_me') {
        groups[cur].toMe += d.remainingAmount;
        totalToMe += d.remainingAmount; // Legacy fallback
      } else {
        groups[cur].byMe += d.remainingAmount;
        totalByMe += d.remainingAmount; // Legacy fallback
      }
    });

    const balances = Object.keys(groups).map(cur => ({
      currency: cur,
      totalOwedToMe: groups[cur].toMe,
      totalOwedByMe: groups[cur].byMe,
      netBalance: groups[cur].toMe - groups[cur].byMe
    }));

    return {
      ...debtor,
      totalOwedToMe: totalToMe,
      totalOwedByMe: totalByMe,
      netBalance: totalToMe - totalByMe,
      totalDebts: personDebts.length,
      balances
    };
  }).sort((a, b) => {
    // Sort by largest absolute net balance across all currencies (just an approximation since currencies differ)
    const maxA = Math.max(0, ...a.balances.map(bal => Math.abs(bal.netBalance)));
    const maxB = Math.max(0, ...b.balances.map(bal => Math.abs(bal.netBalance)));
    return maxB - maxA;
  });
};

export const getDebts = async (): Promise<Debt[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM debts ORDER BY dueDate ASC'
  );
  return result.map((item: any) => {
    const decrypted = decryptDebtRow(item);
    return {
      ...decrypted,
      isPaid: item.isPaid === 1,
      direction: item.direction === 'owed_to_me' ? 'owed_to_me' : 'owed_by_me',
    };
  });
};

export const getDebt = async (id: number): Promise<import('../types').Debt | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM debts WHERE id = ?',
    [id]
  );
  if (result) {
    const decrypted = decryptDebtRow(result);
    return {
      ...decrypted,
      isPaid: result.isPaid === 1,
      direction: result.direction === 'owed_to_me' ? 'owed_to_me' : 'owed_by_me',
    };
  }
  return null;
};

export const updateDebt = async (id: number, debt: Partial<Debt>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (debt.debtorName !== undefined) {
    updates.push('debtorName = ?');
    values.push(debt.debtorName);
  }
  if (debt.debtorId !== undefined) {
    updates.push('debtorId = ?');
    values.push(debt.debtorId);
  }
  if (debt.totalAmount !== undefined) {
    updates.push('totalAmount = ?');
    values.push(debt.totalAmount);
  }
  if (debt.remainingAmount !== undefined) {
    updates.push('remainingAmount = ?');
    values.push(debt.remainingAmount);
  }
  if (debt.startDate !== undefined) {
    updates.push('startDate = ?');
    values.push(debt.startDate);
  }
  if (debt.dueDate !== undefined) {
    updates.push('dueDate = ?');
    values.push(debt.dueDate || null);
  }
  if (debt.description !== undefined) {
    updates.push('description = ?');
    values.push(debt.description || null);
  }
  if (debt.type !== undefined) {
    updates.push('type = ?');
    values.push(debt.type);
  }
  if (debt.direction !== undefined) {
    updates.push('direction = ?');
    values.push(debt.direction);
  }
  if (debt.currency !== undefined) {
    updates.push('currency = ?');
    values.push(debt.currency || 'IQD');
  }
  if (debt.base_total_amount !== undefined) {
    updates.push('base_total_amount = ?');
    values.push(debt.base_total_amount);
  }
  if (debt.base_remaining_amount !== undefined) {
    updates.push('base_remaining_amount = ?');
    values.push(debt.base_remaining_amount);
  }
  if (debt.isPaid !== undefined) {
    updates.push('isPaid = ?');
    values.push(debt.isPaid ? 1 : 0);
  }

  // Re-encrypt enc_blob if any sensitive field changed
  if (debt.debtorName !== undefined || debt.description !== undefined) {
    // Fetch current values to merge with partial update
    const current = await database.getFirstAsync<any>('SELECT debtorName, description FROM debts WHERE id = ?', [id]);
    const newName = debt.debtorName !== undefined ? debt.debtorName : current?.debtorName;
    const newDesc = debt.description !== undefined ? debt.description : current?.description;
    const encBlob = encryptField({ debtorName: newName, description: newDesc ?? null });
    if (encBlob !== null) {
      updates.push('enc_blob = ?');
      values.push(encBlob);
    }
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE debts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const deleteDebt = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM debts WHERE id = ?', [id]);
};

// Debt Installment operations
export const addDebtInstallment = async (installment: Omit<DebtInstallment, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO debt_installments (debtId, amount, dueDate, isPaid, paidDate, installmentNumber, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      installment.debtId,
      installment.amount,
      installment.dueDate,
      installment.isPaid ? 1 : 0,
      installment.paidDate || null,
      installment.installmentNumber,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getDebtInstallments = async (debtId: number): Promise<import('../types').DebtInstallment[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM debt_installments WHERE debtId = ? ORDER BY dueDate ASC',
    [debtId]
  );
  return result.map((item: any) => ({
    ...item,
    isPaid: item.isPaid === 1,
  }));
};

export const updateDebtInstallment = async (id: number, installment: Partial<DebtInstallment>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (installment.amount !== undefined) {
    updates.push('amount = ?');
    values.push(installment.amount);
  }
  if (installment.dueDate !== undefined) {
    updates.push('dueDate = ?');
    values.push(installment.dueDate);
  }
  if (installment.isPaid !== undefined) {
    updates.push('isPaid = ?');
    values.push(installment.isPaid ? 1 : 0);
  }
  if (installment.paidDate !== undefined) {
    updates.push('paidDate = ?');
    values.push(installment.paidDate || null);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE debt_installments SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const deleteDebtInstallment = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM debt_installments WHERE id = ?', [id]);
};

// Debt Payment History
export interface DebtPayment {
  id: number;
  debtId: number;
  amount: number;
  paymentDate: string;
  installmentId?: number;
  description?: string;
  createdAt: string;
}

export const addDebtPayment = async (payment: Omit<DebtPayment, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO debt_payments (debtId, amount, paymentDate, installmentId, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [
      payment.debtId,
      payment.amount,
      payment.paymentDate,
      payment.installmentId || null,
      payment.description || null,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getDebtPayments = async (debtId: number): Promise<DebtPayment[]> => {
  const database = getDb();
  const result = await database.getAllAsync<DebtPayment>(
    'SELECT * FROM debt_payments WHERE debtId = ? ORDER BY paymentDate DESC, createdAt DESC',
    [debtId]
  );
  return result.map(payment => ({
    ...payment,
    installmentId: payment.installmentId || undefined,
    description: payment.description || undefined,
  }));
};

export const getDebtPaymentsForAll = async (): Promise<DebtPayment[]> => {
  const database = getDb();
  return await database.getAllAsync<DebtPayment>('SELECT * FROM debt_payments ORDER BY paymentDate DESC');
};

export const getUpcomingDebtPayments = async (days: number = 7): Promise<{ debt: Debt; installment?: DebtInstallment }[]> => {
  const database = getDb();
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  const todayStr = today.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  // Get debts that are not paid and have a due date in the range
  const debts = await database.getAllAsync<any>(
    'SELECT * FROM debts WHERE isPaid = 0 AND dueDate >= ? AND dueDate <= ? ORDER BY dueDate ASC',
    [todayStr, futureStr]
  );

  // Get installments with due dates in the range
  const installments = await database.getAllAsync<any>(
    `SELECT di.*, d.debtorName, d.type, d.currency
     FROM debt_installments di
     JOIN debts d ON di.debtId = d.id
     WHERE di.isPaid = 0
     AND d.isPaid = 0
     AND di.dueDate >= ? AND di.dueDate <= ?
     ORDER BY di.dueDate ASC`,
    [todayStr, futureStr]
  );

  const result: { debt: Debt; installment?: DebtInstallment }[] = [];

  // Add debts without installments
  for (const debt of debts) {
    const debtObj: Debt = {
      ...debt,
      isPaid: Boolean(debt.isPaid),
    };
    result.push({ debt: debtObj });
  }

  // Add installments
  for (const inst of installments) {
    const debt = await getDebt(inst.debtId);
    if (debt) {
      const installment: DebtInstallment = {
        ...inst,
        isPaid: Boolean(inst.isPaid),
      };
      result.push({ debt, installment });
    }
  }

  return result;
};

// Challenge operations
export interface Challenge {
  id: number;
  type: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  startDate: string;
  endDate: string;
  targetValue?: number;
  targetCategory?: string;
  currentProgress: number;
  targetProgress: number;
  completed: boolean;
  completedAt?: string;
  reward?: string;
  isCustom?: boolean;
  createdAt: string;
}

export const addChallenge = async (challenge: Omit<Challenge, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO challenges (type, title, description, category, icon, startDate, endDate, targetValue, targetCategory, currentProgress, targetProgress, completed, completedAt, reward, isCustom, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      challenge.type,
      challenge.title,
      challenge.description,
      challenge.category,
      challenge.icon,
      challenge.startDate,
      challenge.endDate,
      challenge.targetValue || null,
      challenge.targetCategory || null,
      challenge.currentProgress || 0,
      challenge.targetProgress,
      challenge.completed ? 1 : 0,
      challenge.completedAt || null,
      challenge.reward || null,
      challenge.isCustom ? 1 : 0,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getChallenges = async (): Promise<import('../types').Challenge[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM challenges ORDER BY createdAt DESC'
  );
  return result.map((item: any) => ({
    ...item,
    completed: item.completed === 1,
    isCustom: item.isCustom === 1,
  }));
};

export const getChallenge = async (id: number): Promise<Challenge | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM challenges WHERE id = ?',
    [id]
  );
  if (result) {
    return {
      ...result,
      completed: result.completed === 1,
      isCustom: result.isCustom === 1,
    };
  }
  return null;
};

export const updateChallenge = async (id: number, challenge: Partial<Challenge>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (challenge.type !== undefined) {
    updates.push('type = ?');
    values.push(challenge.type);
  }
  if (challenge.title !== undefined) {
    updates.push('title = ?');
    values.push(challenge.title);
  }
  if (challenge.description !== undefined) {
    updates.push('description = ?');
    values.push(challenge.description);
  }
  if (challenge.category !== undefined) {
    updates.push('category = ?');
    values.push(challenge.category);
  }
  if (challenge.icon !== undefined) {
    updates.push('icon = ?');
    values.push(challenge.icon);
  }
  if (challenge.startDate !== undefined) {
    updates.push('startDate = ?');
    values.push(challenge.startDate);
  }
  if (challenge.endDate !== undefined) {
    updates.push('endDate = ?');
    values.push(challenge.endDate);
  }
  if (challenge.targetValue !== undefined) {
    updates.push('targetValue = ?');
    values.push(challenge.targetValue || null);
  }
  if (challenge.targetCategory !== undefined) {
    updates.push('targetCategory = ?');
    values.push(challenge.targetCategory || null);
  }
  if (challenge.currentProgress !== undefined) {
    updates.push('currentProgress = ?');
    values.push(challenge.currentProgress);
  }
  if (challenge.targetProgress !== undefined) {
    updates.push('targetProgress = ?');
    values.push(challenge.targetProgress);
  }
  if (challenge.completed !== undefined) {
    updates.push('completed = ?');
    values.push(challenge.completed ? 1 : 0);
  }
  if (challenge.completedAt !== undefined) {
    updates.push('completedAt = ?');
    values.push(challenge.completedAt || null);
  }
  if (challenge.reward !== undefined) {
    updates.push('reward = ?');
    values.push(challenge.reward || null);
  }
  if (challenge.isCustom !== undefined) {
    updates.push('isCustom = ?');
    values.push(challenge.isCustom ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE challenges SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const deleteChallenge = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM challenges WHERE id = ?', [id]);
};

// Achievement operations
export interface Achievement {
  id: number;
  type: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  unlockedAt?: string;
  progress: number;
  targetProgress: number;
  isUnlocked: boolean;
}

export const addAchievement = async (achievement: Omit<Achievement, 'id'>): Promise<number> => {
  const database = getDb();
  const result = await database.runAsync(
    'INSERT INTO achievements (type, title, description, icon, category, unlockedAt, progress, targetProgress, isUnlocked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      achievement.type,
      achievement.title,
      achievement.description,
      achievement.icon,
      achievement.category,
      achievement.unlockedAt || null,
      achievement.progress,
      achievement.targetProgress,
      achievement.isUnlocked ? 1 : 0,
    ]
  );
  return result.lastInsertRowId;
};

export const getAchievements = async (): Promise<Achievement[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM achievements ORDER BY isUnlocked DESC, category ASC'
  );
  return result.map(achievement => ({
    ...achievement,
    isUnlocked: achievement.isUnlocked === 1,
  }));
};

export const getAchievement = async (type: string): Promise<Achievement | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM achievements WHERE type = ?',
    [type]
  );
  if (result) {
    return {
      ...result,
      isUnlocked: Boolean(result.isUnlocked),
    };
  }
  return null;
};

export const updateAchievement = async (type: string, achievement: Partial<Achievement>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (achievement.title !== undefined) {
    updates.push('title = ?');
    values.push(achievement.title);
  }
  if (achievement.description !== undefined) {
    updates.push('description = ?');
    values.push(achievement.description);
  }
  if (achievement.icon !== undefined) {
    updates.push('icon = ?');
    values.push(achievement.icon);
  }
  if (achievement.category !== undefined) {
    updates.push('category = ?');
    values.push(achievement.category);
  }
  if (achievement.unlockedAt !== undefined) {
    updates.push('unlockedAt = ?');
    values.push(achievement.unlockedAt || null);
  }
  if (achievement.progress !== undefined) {
    updates.push('progress = ?');
    values.push(achievement.progress);
  }
  if (achievement.targetProgress !== undefined) {
    updates.push('targetProgress = ?');
    values.push(achievement.targetProgress);
  }
  if (achievement.isUnlocked !== undefined) {
    updates.push('isUnlocked = ?');
    values.push(achievement.isUnlocked ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(type);
    await database.runAsync(
      `UPDATE achievements SET ${updates.join(', ')} WHERE type = ?`,
      values
    );
  }
};

export const unlockAchievement = async (type: string): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'UPDATE achievements SET isUnlocked = 1, unlockedAt = ?, synced_at = NULL WHERE type = ?',
    [new Date().toISOString(), type]
  );
};

// Expense Shortcuts operations
export interface ExpenseShortcut {
  id: number;
  title: string;
  amount: number;
  category: string;
  currency?: string;
  description?: string;
  createdAt: string;
}

export const addExpenseShortcut = async (shortcut: Omit<ExpenseShortcut, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO expense_shortcuts (title, amount, category, currency, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [
      shortcut.title,
      shortcut.amount,
      shortcut.category,
      shortcut.currency || 'IQD',
      shortcut.description || null,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getExpenseShortcuts = async (): Promise<ExpenseShortcut[]> => {
  const database = getDb();
  const result = await database.getAllAsync<ExpenseShortcut>(
    'SELECT * FROM expense_shortcuts ORDER BY createdAt DESC'
  );
  return result;
};

export const deleteExpenseShortcut = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM expense_shortcuts WHERE id = ?', [id]);
};

export const updateExpenseShortcut = async (id: number, shortcut: Partial<ExpenseShortcut>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (shortcut.title !== undefined) {
    updates.push('title = ?');
    values.push(shortcut.title);
  }
  if (shortcut.amount !== undefined) {
    updates.push('amount = ?');
    values.push(shortcut.amount);
  }
  if (shortcut.category !== undefined) {
    updates.push('category = ?');
    values.push(shortcut.category);
  }
  if (shortcut.currency !== undefined) {
    updates.push('currency = ?');
    values.push(shortcut.currency || 'IQD');
  }
  if (shortcut.description !== undefined) {
    updates.push('description = ?');
    values.push(shortcut.description || null);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE expense_shortcuts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

// Income Shortcuts operations
export interface IncomeShortcut {
  id: number;
  source: string;
  amount: number;
  incomeSource: string;
  currency?: string;
  description?: string;
  createdAt: string;
}

export const addIncomeShortcut = async (shortcut: Omit<IncomeShortcut, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO income_shortcuts (source, amount, incomeSource, currency, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [
      shortcut.source,
      shortcut.amount,
      shortcut.incomeSource,
      shortcut.currency || 'IQD',
      shortcut.description || null,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getIncomeShortcuts = async (): Promise<IncomeShortcut[]> => {
  const database = getDb();
  const result = await database.getAllAsync<IncomeShortcut>(
    'SELECT * FROM income_shortcuts ORDER BY createdAt DESC'
  );
  return result;
};

export const deleteIncomeShortcut = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM income_shortcuts WHERE id = ?', [id]);
};

export const updateIncomeShortcut = async (id: number, shortcut: Partial<IncomeShortcut>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (shortcut.source !== undefined) {
    updates.push('source = ?');
    values.push(shortcut.source);
  }
  if (shortcut.amount !== undefined) {
    updates.push('amount = ?');
    values.push(shortcut.amount);
  }
  if (shortcut.incomeSource !== undefined) {
    updates.push('incomeSource = ?');
    values.push(shortcut.incomeSource);
  }
  if (shortcut.currency !== undefined) {
    updates.push('currency = ?');
    values.push(shortcut.currency || 'IQD');
  }
  if (shortcut.description !== undefined) {
    updates.push('description = ?');
    values.push(shortcut.description || null);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE income_shortcuts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

// Bills operations
export interface Bill {
  id: number;
  title: string;
  amount: number;
  category: string;
  dueDate: string;
  recurrenceType?: string;
  recurrenceValue?: number;
  description?: string;
  currency?: string;
  base_amount?: number;
  isPaid: boolean;
  paidDate?: string;
  reminderDaysBefore: number;
  image_path?: string;
  createdAt: string;
}

export interface BillPayment {
  id: number;
  billId: number;
  amount: number;
  paymentDate: string;
  description?: string;
  createdAt: string;
}

export const addBill = async (bill: Omit<Bill, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();

  let baseAmount = bill.base_amount !== undefined ? bill.base_amount : bill.amount;
  if (isNaN(baseAmount)) baseAmount = bill.amount;

  const result = await database.runAsync(
    'INSERT INTO bills (title, amount, base_amount, category, dueDate, recurrenceType, recurrenceValue, description, currency, isPaid, paidDate, reminderDaysBefore, image_path, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      bill.title,
      bill.amount,
      baseAmount,
      bill.category,
      bill.dueDate,
      bill.recurrenceType || null,
      bill.recurrenceValue || null,
      bill.description || null,
      bill.currency || 'IQD',
      bill.isPaid ? 1 : 0,
      bill.paidDate || null,
      bill.reminderDaysBefore || 3,
      bill.image_path || null,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getBills = async (): Promise<Bill[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM bills ORDER BY dueDate ASC, createdAt DESC'
  );
  return result.map(bill => ({
    ...bill,
    isPaid: bill.isPaid === 1,
  }));
};

export const getBillById = async (id: number): Promise<Bill | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM bills WHERE id = ?',
    [id]
  );
  if (!result) return null;
  return {
    ...result,
    isPaid: result.isPaid === 1,
  };
};

export const updateBill = async (id: number, bill: Partial<Bill>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const values: any[] = [];

  if (bill.title !== undefined) {
    updates.push('title = ?');
    values.push(bill.title);
  }
  if (bill.amount !== undefined) {
    updates.push('amount = ?');
    values.push(bill.amount);
  }
  if (bill.category !== undefined) {
    updates.push('category = ?');
    values.push(bill.category);
  }
  if (bill.dueDate !== undefined) {
    updates.push('dueDate = ?');
    values.push(bill.dueDate);
  }
  if (bill.recurrenceType !== undefined) {
    updates.push('recurrenceType = ?');
    values.push(bill.recurrenceType || null);
  }
  if (bill.recurrenceValue !== undefined) {
    updates.push('recurrenceValue = ?');
    values.push(bill.recurrenceValue || null);
  }
  if (bill.description !== undefined) {
    updates.push('description = ?');
    values.push(bill.description || null);
  }
  if (bill.currency !== undefined) {
    updates.push('currency = ?');
    values.push(bill.currency || 'IQD');
  }
  if (bill.base_amount !== undefined) {
    updates.push('base_amount = ?');
    values.push(bill.base_amount);
  }
  if (bill.isPaid !== undefined) {
    updates.push('isPaid = ?');
    values.push(bill.isPaid ? 1 : 0);
  }
  if (bill.paidDate !== undefined) {
    updates.push('paidDate = ?');
    values.push(bill.paidDate || null);
  }
  if (bill.reminderDaysBefore !== undefined) {
    updates.push('reminderDaysBefore = ?');
    values.push(bill.reminderDaysBefore);
  }
  if (bill.image_path !== undefined) {
    updates.push('image_path = ?');
    values.push(bill.image_path || null);
  }

  if (updates.length > 0) {
    updates.push('synced_at = NULL');
    values.push(id);
    await database.runAsync(
      `UPDATE bills SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
};

export const deleteBill = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM bills WHERE id = ?', [id]);
};

export const addBillPayment = async (payment: Omit<BillPayment, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO bill_payments (billId, amount, paymentDate, description, createdAt) VALUES (?, ?, ?, ?, ?)',
    [
      payment.billId,
      payment.amount,
      payment.paymentDate,
      payment.description || null,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getBillPayments = async (billId: number): Promise<BillPayment[]> => {
  const database = getDb();
  const result = await database.getAllAsync<BillPayment>(
    'SELECT * FROM bill_payments WHERE billId = ? ORDER BY paymentDate DESC',
    [billId]
  );
  return result;
};

export const getBillsDueSoon = async (days: number = 7): Promise<Bill[]> => {
  const database = getDb();
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const result = await database.getAllAsync<any>(
    `SELECT * FROM bills 
     WHERE isPaid = 0 
     AND dueDate BETWEEN ? AND ? 
     ORDER BY dueDate ASC`,
    [today.toISOString().split('T')[0], futureDate.toISOString().split('T')[0]]
  );
  return result.map(bill => ({
    ...bill,
    isPaid: bill.isPaid === 1,
  }));
};

/**
 * Get unpaid bills with dueDate within [startDate, endDate] (inclusive)
 */
export const getBillsDueInRange = async (startDate: string, endDate: string): Promise<Bill[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    `SELECT * FROM bills
     WHERE isPaid = 0
     AND dueDate >= ?
     AND dueDate <= ?
     ORDER BY dueDate ASC`,
    [startDate, endDate]
  );
  return result.map(bill => ({
    ...bill,
    isPaid: bill.isPaid === 1,
  }));
};

export interface DBNotification {
  id: number;
  title: string;
  body: string;
  data?: string; // JSON string
  date: number; // timestamp
  read: boolean;
  type?: string;
}

export const addNotification = async (notification: Omit<DBNotification, 'id' | 'read'>): Promise<number> => {
  const database = getDb();
  // Ensure data is a string
  const dataStr = typeof notification.data === 'string' ? notification.data : JSON.stringify(notification.data);
  const result = await database.runAsync(
    'INSERT INTO notifications (title, body, data, date, read, type) VALUES (?, ?, ?, ?, ?, ?)',
    [
      notification.title,
      notification.body,
      dataStr,
      notification.date,
      0, // not read by default
      notification.type || 'default'
    ]
  );
  return result.lastInsertRowId;
};

export const getNotifications = async (): Promise<DBNotification[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM notifications ORDER BY date DESC'
  );
  return result.map((item: any) => ({
    ...item,
    read: item.read === 1,
  }));
};

export const markNotificationRead = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('UPDATE notifications SET read = 1, synced_at = NULL WHERE id = ?', [id]);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const database = getDb();
  await database.runAsync('UPDATE notifications SET read = 1, synced_at = NULL');
};

export const deleteNotification = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM notifications WHERE id = ?', [id]);
};

export const clearNotifications = async (): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM notifications');
};

export const getUnreadNotificationsCount = async (): Promise<number> => {
  const database = getDb();
  const result = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM notifications WHERE read = 0');
  return result?.count || 0;
};

export const exportNewDataOnly = async (): Promise<{ items: { type: string; localId: number; data: Record<string, unknown> }[] }> => {
  const [
    expenses,
    income,
    financialGoals,
    customCategories,
    budgets,
    recurringExpenses,
    debts,
    bills,
    challenges,
    achievements,
    expenseShortcuts,
    incomeShortcuts,
    notifications,
    userSettings,
    appSettings,
    notificationSettings,
    savings,
    savingsTransactions,
    debtorsRaw,
    debtPayments,
    wallets,
    debtInstallments,
    billPayments,
  ] = await Promise.all([
    getUnsyncedExpenses(),
    getUnsyncedIncome(),
    getUnsyncedFinancialGoals(),
    getUnsyncedCustomCategories(),
    getUnsyncedBudgets(),
    getUnsyncedRecurringExpenses(),
    getUnsyncedDebts(),
    getUnsyncedBills(),
    getUnsyncedChallenges(),
    getUnsyncedAchievements(),
    getUnsyncedExpenseShortcuts(),
    getUnsyncedIncomeShortcuts(),
    getUnsyncedNotifications(),
    getUnsyncedUserSettings(),
    getUnsyncedAppSettings(),
    getUnsyncedNotificationSettings(),
    getUnsyncedSavings(),
    getUnsyncedSavingsTransactions(),
    getUnsyncedDebtors(),
    getUnsyncedDebtPayments(),
    getUnsyncedWallets(),
    getUnsyncedDebtInstallments(),
    getUnsyncedBillPayments(),
  ]);

  const items: { type: string; localId: number; data: Record<string, unknown> }[] = [];

  const walletArray = Array.isArray(wallets) ? wallets : [];
  for (const w of walletArray) {
    items.push({ type: 'wallet', localId: w.id, data: w as unknown as Record<string, unknown> });
  }

  for (const e of expenses) {
    items.push({ type: 'expense', localId: e.id, data: e as unknown as Record<string, unknown> });
  }
  for (const i of income) {
    items.push({ type: 'income', localId: i.id, data: i as unknown as Record<string, unknown> });
  }
  for (const g of financialGoals) {
    items.push({ type: 'financial_goal', localId: g.id, data: g as unknown as Record<string, unknown> });
  }
  for (const c of customCategories) {
    items.push({ type: 'custom_category', localId: c.id, data: c as unknown as Record<string, unknown> });
  }
  for (const b of budgets) {
    items.push({ type: 'budget', localId: b.id, data: b as unknown as Record<string, unknown> });
  }
  for (const r of recurringExpenses) {
    items.push({ type: 'recurring_expense', localId: r.id, data: r as unknown as Record<string, unknown> });
  }
  for (const d of debts) {
    items.push({
      type: 'debt',
      localId: d.id,
      data: d as unknown as Record<string, unknown>,
    });
  }
  for (const b of bills) {
    items.push({
      type: 'bill',
      localId: b.id,
      data: b as unknown as Record<string, unknown>,
    });
  }
  for (const c of challenges) {
    items.push({ type: 'challenge', localId: c.id, data: c as unknown as Record<string, unknown> });
  }
  for (const a of achievements) {
    items.push({ type: 'achievement', localId: a.id, data: a as unknown as Record<string, unknown> });
  }
  for (const s of expenseShortcuts) {
    items.push({ type: 'expense_shortcut', localId: s.id, data: s as unknown as Record<string, unknown> });
  }
  for (const s of incomeShortcuts) {
    items.push({ type: 'income_shortcut', localId: s.id, data: s as unknown as Record<string, unknown> });
  }
  for (const n of notifications) {
    items.push({ type: 'notification', localId: n.id, data: n as unknown as Record<string, unknown> });
  }
  for (const u of userSettings) {
    const row = u as unknown as Record<string, unknown>;
    const id = row.id as number | undefined;
    if (typeof id === 'number') items.push({ type: 'user_settings', localId: id, data: row });
  }
  for (const a of appSettings) {
    const row = a as unknown as Record<string, unknown>;
    const id = row.id as number | undefined;
    if (typeof id === 'number') items.push({ type: 'app_settings', localId: id, data: row });
  }
  for (const n of notificationSettings) {
    const row = n as unknown as Record<string, unknown>;
    const id = row.id as number | undefined;
    if (typeof id === 'number') items.push({ type: 'notification_settings', localId: id, data: row });
  }
  for (const s of savings) {
    items.push({ type: 'savings', localId: (s as any).id, data: s as unknown as Record<string, unknown> });
  }
  for (const st of savingsTransactions) {
    items.push({ type: 'savings_transaction', localId: (st as any).id, data: st as unknown as Record<string, unknown> });
  }
  for (const d of debtorsRaw) {
    items.push({ type: 'debtor', localId: d.id, data: d as unknown as Record<string, unknown> });
  }
  for (const dp of debtPayments) {
    items.push({ type: 'debt_payment', localId: dp.id, data: dp as unknown as Record<string, unknown> });
  }
  const installmentArray = Array.isArray(debtInstallments) ? debtInstallments : [];
  for (const di of installmentArray) {
    items.push({ type: 'debt_installment', localId: di.id, data: di as unknown as Record<string, unknown> });
  }
  const billPaymentArray = Array.isArray(billPayments) ? billPayments : [];
  for (const bp of billPaymentArray) {
    items.push({ type: 'bill_payment', localId: bp.id, data: bp as unknown as Record<string, unknown> });
  }

  return { items };
};

export const exportFullData = async (): Promise<Record<string, unknown>> => {
  const [
    expenses,
    income,
    budgets,
    financial_goals,
    custom_categories,
    recurring_expenses,
    debts,
    bills,
    user_settings,
    app_settings,
    notification_settings,
    challenges,
    achievements,
    expense_shortcuts,
    income_shortcuts,
    exchange_rates,
    notifications,
    savings,
    savings_transactions,
    debtors,
    wallets,
    ai_insights_cache,
    goal_plan_cache,
  ] = await Promise.all([
    getExpenses(),
    getIncome(),
    getBudgets(),
    getFinancialGoals(),
    getCustomCategories(),
    getRecurringExpenses(false),
    getDebts(),
    getBills(),
    getUserSettings(),
    getAppSettings(),
    getNotificationSettings(),
    getChallenges(),
    getAchievements(),
    getExpenseShortcuts(),
    getIncomeShortcuts(),
    getAllExchangeRates(),
    getNotifications(),
    getSavings(),
    getSavingsTransactionsForAll(),
    getDebtPaymentsForAll(),
    getDebtors(),
    getWallets(),
    getDb().getAllAsync('SELECT * FROM ai_insights_cache'),
    getDb().getAllAsync('SELECT * FROM goal_plan_cache'),
  ]);

  const debt_installments: any[] = [];
  for (const d of debts) {
    const installments = await getDebtInstallments(d.id);
    debt_installments.push(...installments);
  }

  const bill_payments: any[] = [];
  for (const b of bills) {
    const payments = await getBillPayments(b.id);
    bill_payments.push(...payments);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
    income,
    budgets,
    financial_goals,
    custom_categories,
    recurring_expenses,
    debts,
    debt_installments,
    bills,
    bill_payments,
    user_settings,
    app_settings,
    notification_settings,
    challenges,
    achievements,
    expense_shortcuts,
    income_shortcuts,
    exchange_rates,
    notifications,
    savings,
    savings_transactions,
    debtors,
    wallets,
    ai_insights_cache,
    goal_plan_cache,
  };
};

/** Restore full data from backup (server or local file). Clears existing data and inserts backup. */
export const importFullData = async (data: Record<string, unknown>, force: boolean = false): Promise<void> => {
  const database = getDb();

  // New logic: Check if incoming data is older than current data (based on exportedAt/timestamp)
  try {
    const exportedAt = data.exportedAt as string;
    if (exportedAt && !force) {
      // Find the last local backup timestamp from app_settings or find newest record
      const appSettings = await database.getFirstAsync<{ lastFullSyncAt?: string }>('SELECT * FROM app_settings ORDER BY id ASC LIMIT 1');
      if (appSettings?.lastFullSyncAt && new Date(exportedAt) < new Date(appSettings.lastFullSyncAt)) {
        throw new Error('BACKUP_OLDER_THAN_CURRENT');
      }
    }
  } catch (err: any) {
    if (err.message === 'BACKUP_OLDER_THAN_CURRENT') throw err;
    // Otherwise ignore metadata check errors
  }

  // Disable foreign keys for the entire import process to avoid order issues
  await database.execAsync('PRAGMA foreign_keys = OFF;');
  await database.execAsync('BEGIN TRANSACTION;');

  try {
    await clearAllData(true);
    // Keep foreign_keys off for the entire import
    await database.execAsync('PRAGMA foreign_keys = OFF;');

    const runSection = async (name: string, fn: () => Promise<void>) => {
      try {
        console.log(`[Database] Importing section: ${name}...`);
        await fn();
        console.log(`[Database] Section ${name} import successful.`);
      } catch (err: any) {
        console.log(`[Database] Section ${name} import FAILED`, err);
        throw new Error(`${name}: ${err?.message ?? err}`);
      }
    };

    const toSql = (v: any) => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'number' || typeof v === 'string') return v;
      return String(v);
    };

    // Ensure all tables have expected columns for newer schema
    const allMigrations = [
      'ALTER TABLE budgets ADD COLUMN currency TEXT DEFAULT "IQD"',
      'ALTER TABLE budgets ADD COLUMN base_amount REAL',
      'ALTER TABLE budgets ADD COLUMN createdAt TEXT',
      'ALTER TABLE budgets ADD COLUMN synced_at INTEGER',
      'ALTER TABLE income ADD COLUMN currency TEXT DEFAULT "IQD"',
      'ALTER TABLE income ADD COLUMN category TEXT',
      'ALTER TABLE income ADD COLUMN synced_at INTEGER',
      'ALTER TABLE income ADD COLUMN enc_blob TEXT',
      'ALTER TABLE wallet_transfers ADD COLUMN synced_at INTEGER',
      'ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT "IQD"',
      'ALTER TABLE expenses ADD COLUMN synced_at INTEGER',
      'ALTER TABLE expenses ADD COLUMN enc_blob TEXT',
      'ALTER TABLE expenses ADD COLUMN image_path TEXT',
      'ALTER TABLE expenses ADD COLUMN base_amount REAL',
      'ALTER TABLE budgets ADD COLUMN synced_at INTEGER',
      'ALTER TABLE recurring_expenses ADD COLUMN base_amount REAL',
      'ALTER TABLE recurring_expenses ADD COLUMN currency TEXT DEFAULT "IQD"',
      'ALTER TABLE recurring_expenses ADD COLUMN walletId INTEGER',
    ];
    for (const sql of allMigrations) {
      try { await database.execAsync(sql + ';'); } catch (_) { /* ignore already exists */ }
    }

    await runSection('wallets', async () => {
      // Ensure all wallet columns exist (older DBs may be missing some)
      const walletMigrations = [
        'ALTER TABLE wallets ADD COLUMN currency TEXT DEFAULT "IQD"',
        'ALTER TABLE wallets ADD COLUMN balance REAL DEFAULT 0',
        'ALTER TABLE wallets ADD COLUMN icon TEXT DEFAULT "wallet"',
        'ALTER TABLE wallets ADD COLUMN color TEXT DEFAULT "#0B5A7A"',
        'ALTER TABLE wallets ADD COLUMN isDefault INTEGER DEFAULT 0',
        'ALTER TABLE wallets ADD COLUMN synced_at INTEGER',
        'ALTER TABLE wallets ADD COLUMN updatedAt TEXT',
      ];
      for (const sql of walletMigrations) {
        try { await database.execAsync(sql + ';'); } catch (_) { /* column already exists */ }
      }

      const wallets = (data.wallets as any[]) || [];
      for (const w of wallets) {
        await database.runAsync(
          'INSERT OR REPLACE INTO wallets (id, name, currency, balance, icon, color, isDefault, createdAt, updatedAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(w.id),
            toSql(w.name) ?? 'المحفظة',
            toSql(w.currency) ?? 'IQD',
            toSql(w.balance) || 0,
            toSql(w.icon) ?? 'wallet',
            toSql(w.color) ?? '#0B5A7A',
            toSql(w.isDefault),
            toSql(w.createdAt) ?? new Date().toISOString(),
            toSql(w.updatedAt) ?? new Date().toISOString(),
            toSql(w.synced_at)
          ]
        );
      }
    });

    const expenses = (data.expenses as any[]) || [];
    await runSection('debtors', async () => {
      const debtors = (data.debtors as any[]) || [];
      for (const de of debtors) {
        await database.runAsync(
          'INSERT OR REPLACE INTO debtors (id, name, phone, image_path, createdAt, synced_at, enc_blob) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(de.id),
            toSql(de.name) ?? 'غير معروف',
            toSql(de.phone),
            toSql(de.image_path),
            toSql(de.createdAt) ?? new Date().toISOString(),
            toSql(de.synced_at),
            toSql(de.enc_blob)
          ]
        );
      }
    });

    await runSection('expenses', async () => {
      for (const e of expenses) {
        const amount = typeof e.amount === 'number' ? e.amount : 0;
        await database.runAsync(
          'INSERT OR REPLACE INTO expenses (id, title, amount, base_amount, category, date, description, currency, receipt_image_path, synced_at, enc_blob, walletId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(e.id),
            toSql(e.title) ?? 'بدون عنوان',
            amount,
            toSql(e.base_amount) ?? amount,
            toSql(e.category) ?? 'other',
            toSql(e.date) ?? new Date().toISOString().slice(0, 10),
            toSql(e.description),
            toSql(e.currency) ?? 'IQD',
            toSql(e.receipt_image_path),
            toSql(e.synced_at),
            toSql(e.enc_blob),
            toSql(e.walletId)
          ]
        );
      }
    });

    const income = (data.income as any[]) || [];
    await runSection('income', async () => {
      for (const i of income) {
        const amount = typeof i.amount === 'number' ? i.amount : 0;
        await database.runAsync(
          'INSERT OR REPLACE INTO income (id, source, amount, base_amount, date, description, currency, category, synced_at, enc_blob, walletId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(i.id),
            toSql(i.source) ?? 'دخل',
            amount,
            toSql(i.base_amount) ?? amount,
            toSql(i.date) ?? new Date().toISOString().slice(0, 10),
            toSql(i.description),
            toSql(i.currency) ?? 'IQD',
            toSql(i.category) ?? 'other',
            toSql(i.synced_at),
            toSql(i.enc_blob),
            toSql(i.walletId)
          ]
        );
      }
    });

    await runSection('user_settings', async () => {
      const userSettingsRaw = data.user_settings;
      const user_settings = Array.isArray(userSettingsRaw) ? userSettingsRaw : (userSettingsRaw ? [userSettingsRaw] : []);
      if (user_settings.length > 0) {
        const u = user_settings[0];
        await database.runAsync(
          'INSERT OR REPLACE INTO user_settings (id, name, authMethod, passwordHash, biometricsEnabled, synced_at, userId, phone, email, isPro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(u.id),
            toSql(u.name),
            toSql(u.authMethod),
            toSql(u.passwordHash),
            toSql(u.biometricsEnabled),
            toSql(u.synced_at),
            toSql(u.userId),
            toSql(u.phone),
            toSql(u.email),
            toSql(u.isPro)
          ]
        );
      }
    });

    await runSection('app_settings', async () => {
      const appSettingsRaw = data.app_settings;
      const app_settings = Array.isArray(appSettingsRaw) ? appSettingsRaw : (appSettingsRaw ? [appSettingsRaw] : []);
      if (app_settings.length > 0) {
        const a = app_settings[0];
        await database.runAsync(
          'INSERT OR REPLACE INTO app_settings (id, notificationsEnabled, darkModeEnabled, autoBackupEnabled, autoSyncEnabled, currency, language, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(a.id),
            toSql(a.notificationsEnabled),
            toSql(a.darkModeEnabled),
            toSql(a.autoBackupEnabled),
            toSql(a.autoSyncEnabled),
            toSql(a.currency),
            toSql(a.language),
            toSql(a.synced_at)
          ]
        );
      }
    });

    await runSection('notification_settings', async () => {
      const notifSettingsRaw = data.notification_settings;
      const notification_settings = Array.isArray(notifSettingsRaw) ? notifSettingsRaw : (notifSettingsRaw ? [notifSettingsRaw] : []);
      if (notification_settings.length > 0) {
        const n = notification_settings[0];
        await database.runAsync(
          'INSERT OR REPLACE INTO notification_settings (id, dailyReminder, dailyReminderTime, expenseReminder, expenseReminderTime, incomeReminder, weeklySummary, monthlySummary, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(n.id),
            toSql(n.dailyReminder) || 0,
            toSql(n.dailyReminderTime),
            toSql(n.expenseReminder) || 0,
            toSql(n.expenseReminderTime),
            toSql(n.incomeReminder) || 0,
            toSql(n.weeklySummary) || 0,
            toSql(n.monthlySummary) || 0,
            toSql(n.synced_at)
          ]
        );
      }
    });

    await runSection('custom_categories', async () => {
      const custom_categories = (data.custom_categories as any[]) || [];
      for (const c of custom_categories) {
        await database.runAsync(
          'INSERT OR REPLACE INTO custom_categories (id, name, type, icon, color, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(c.id),
            toSql(c.name) ?? 'فئة',
            toSql(c.type) ?? 'expense',
            toSql(c.icon) ?? 'ellipse',
            toSql(c.color) ?? '#6B7280',
            toSql(c.createdAt) ?? new Date().toISOString(),
            toSql(c.synced_at)
          ]
        );
      }
    });

    await runSection('budgets', async () => {
      const budgets = (data.budgets as any[]) || [];
      const now = new Date().toISOString();
      for (const b of budgets) {
        // Double check NOT NULL constraints
        const createdAtValue = toSql(b.createdAt) || toSql(b.created_at) || now;
        await database.runAsync(
          'INSERT OR REPLACE INTO budgets (id, category, amount, month, year, createdAt, currency, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(b.id),
            toSql(b.category) ?? 'أخرى',
            toSql(b.amount) || 0,
            toSql(b.month) ?? String(new Date().getMonth() + 1),
            toSql(b.year) || new Date().getFullYear(),
            createdAtValue,
            toSql(b.currency) || 'IQD',
            toSql(b.synced_at)
          ]
        );
      }
    });

    await runSection('financial_goals', async () => {
      const financial_goals = (data.financial_goals as any[]) || [];
      for (const g of financial_goals) {
        await database.runAsync(
          'INSERT OR REPLACE INTO financial_goals (id, title, targetAmount, currentAmount, targetDate, category, description, createdAt, completed, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(g.id),
            toSql(g.title) ?? 'هدف',
            toSql(g.targetAmount) || 0,
            toSql(g.currentAmount) || 0,
            toSql(g.targetDate) ?? new Date().toISOString().slice(0, 10),
            toSql(g.category) ?? 'أخرى',
            toSql(g.description),
            toSql(g.createdAt) ?? new Date().toISOString(),
            toSql(g.completed),
            toSql(g.synced_at)
          ]
        );
      }
    });

    await runSection('recurring_expenses', async () => {
      const recurring_expenses = (data.recurring_expenses as any[]) || [];
      for (const r of recurring_expenses) {
        await database.runAsync(
          'INSERT OR REPLACE INTO recurring_expenses (id, title, amount, base_amount, category, recurrenceType, recurrenceValue, startDate, endDate, description, isActive, lastProcessedDate, createdAt, currency, walletId, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(r.id),
            toSql(r.title) ?? 'بدون عنوان',
            toSql(r.amount) || 0,
            toSql(r.base_amount) ?? toSql(r.amount) ?? 0,
            toSql(r.category) ?? 'أخرى',
            toSql(r.recurrenceType ?? r.frequency) ?? 'monthly',
            toSql(r.recurrenceValue) || 1,
            toSql(r.startDate) ?? new Date().toISOString().slice(0, 10),
            toSql(r.endDate),
            toSql(r.description),
            toSql(r.isActive !== false),
            toSql(r.lastProcessedDate),
            toSql(r.createdAt) ?? new Date().toISOString(),
            toSql(r.currency) ?? 'IQD',
            toSql(r.walletId),
            toSql(r.synced_at)
          ]
        );
      }
    });

    await runSection('debts', async () => {
      const debts = (data.debts as any[]) || [];
      for (const d of debts) {
        const direction = d.direction === 'owed_to_me' ? 'owed_to_me' : 'owed_by_me';
        await database.runAsync(
          'INSERT OR REPLACE INTO debts (id, debtorName, totalAmount, base_total_amount, remainingAmount, base_remaining_amount, startDate, dueDate, description, type, direction, currency, isPaid, createdAt, synced_at, enc_blob) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(d.id),
            toSql(d.debtorName) ?? 'دين',
            toSql(d.totalAmount) || 0,
            (toSql(d.base_total_amount) ?? toSql(d.totalAmount)) || 0,
            toSql(d.remainingAmount) || 0,
            (toSql(d.base_remaining_amount) ?? toSql(d.remainingAmount)) || 0,
            toSql(d.startDate) ?? new Date().toISOString().slice(0, 10),
            toSql(d.dueDate),
            toSql(d.description),
            toSql(d.type) ?? 'debt',
            direction,
            toSql(d.currency) ?? 'IQD',
            toSql(d.isPaid),
            toSql(d.createdAt) ?? new Date().toISOString(),
            toSql(d.synced_at),
            toSql(d.enc_blob)
          ]
        );
      }
    });

    await runSection('debt_installments', async () => {
      const debt_installments = (data.debt_installments as any[]) || [];
      for (const di of debt_installments) {
        await database.runAsync(
          'INSERT OR REPLACE INTO debt_installments (id, debtId, amount, dueDate, isPaid, paidDate, installmentNumber, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(di.id),
            toSql(di.debtId),
            toSql(di.amount) || 0,
            toSql(di.dueDate) ?? new Date().toISOString().slice(0, 10),
            toSql(di.isPaid),
            toSql(di.paidDate),
            toSql(di.installmentNumber) || 1,
            toSql(di.createdAt) ?? new Date().toISOString(),
            toSql(di.synced_at)
          ]
        );
      }
    });

    await runSection('bills', async () => {
      const bills = (data.bills as any[]) || [];
      for (const b of bills) {
        await database.runAsync(
          'INSERT OR REPLACE INTO bills (id, title, amount, base_amount, category, dueDate, recurrenceType, recurrenceValue, description, currency, isPaid, paidDate, reminderDaysBefore, image_path, createdAt, synced_at, enc_blob) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(b.id),
            toSql(b.title ?? b.name) ?? 'فاتورة',
            toSql(b.amount) || 0,
            (toSql(b.base_amount) ?? toSql(b.amount)) || 0,
            toSql(b.category) ?? 'أخرى',
            toSql(b.dueDate ?? b.dueDay) ?? new Date().toISOString().slice(0, 10),
            toSql(b.recurrenceType),
            toSql(b.recurrenceValue),
            toSql(b.description),
            toSql(b.currency) ?? 'IQD',
            toSql(b.isPaid),
            toSql(b.paidDate),
            toSql(b.reminderDaysBefore) || 3,
            toSql(b.image_path),
            toSql(b.createdAt) ?? new Date().toISOString(),
            toSql(b.synced_at),
            toSql(b.enc_blob)
          ]
        );
      }
    });

    await runSection('bill_payments', async () => {
      const bill_payments = (data.bill_payments as any[]) || [];
      for (const bp of bill_payments) {
        await database.runAsync(
          'INSERT OR REPLACE INTO bill_payments (id, billId, amount, paymentDate, description, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(bp.id),
            toSql(bp.billId),
            toSql(bp.amount) || 0,
            toSql(bp.paymentDate ?? bp.paidDate) ?? new Date().toISOString().slice(0, 10),
            toSql(bp.description),
            toSql(bp.createdAt) ?? new Date().toISOString(),
            toSql(bp.synced_at)
          ]
        );
      }
    });

    await runSection('debt_payments', async () => {
      const debt_payments = (data.debt_payments as any[]) || [];
      for (const dp of debt_payments) {
        await database.runAsync(
          'INSERT OR REPLACE INTO debt_payments (id, debtId, amount, paymentDate, installmentId, description, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(dp.id),
            toSql(dp.debtId),
            toSql(dp.amount) || 0,
            toSql(dp.paymentDate ?? dp.date) ?? new Date().toISOString().slice(0, 10),
            toSql(dp.installmentId),
            toSql(dp.description),
            toSql(dp.createdAt) ?? new Date().toISOString(),
            toSql(dp.synced_at)
          ]
        );
      }
    });

    await runSection('challenges', async () => {
      const challenges = (data.challenges as any[]) || [];
      for (const ch of challenges) {
        await database.runAsync(
          'INSERT OR REPLACE INTO challenges (id, type, title, description, category, icon, startDate, endDate, targetValue, targetCategory, currentProgress, targetProgress, completed, completedAt, reward, isCustom, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(ch.id),
            toSql(ch.type) ?? 'custom',
            toSql(ch.title) ?? 'تحدي',
            toSql(ch.description) ?? '',
            toSql(ch.category) ?? 'أخرى',
            toSql(ch.icon) ?? 'flag',
            toSql(ch.startDate) ?? new Date().toISOString().slice(0, 10),
            toSql(ch.endDate) ?? new Date().toISOString().slice(0, 10),
            toSql(ch.targetValue) || 0,
            toSql(ch.targetCategory),
            toSql(ch.currentProgress) || 0,
            toSql(ch.targetProgress) || 1,
            toSql(ch.completed),
            toSql(ch.completedAt),
            toSql(ch.reward),
            toSql(ch.isCustom),
            toSql(ch.createdAt) ?? new Date().toISOString(),
            toSql(ch.synced_at)
          ]
        );
      }
    });

    await runSection('achievements', async () => {
      const achievements = (data.achievements as any[]) || [];
      for (const ac of achievements) {
        await database.runAsync(
          'INSERT OR REPLACE INTO achievements (id, type, title, description, icon, category, progress, targetProgress, unlockedAt, isUnlocked, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(ac.id),
            toSql(ac.type) ?? 'default',
            toSql(ac.title) ?? '',
            toSql(ac.description) ?? '',
            toSql(ac.icon) ?? 'trophy',
            toSql(ac.category) ?? 'أخرى',
            toSql(ac.progress) || 0,
            toSql(ac.targetProgress) || 1,
            toSql(ac.unlockedAt),
            toSql(ac.isUnlocked),
            toSql(ac.synced_at)
          ]
        );
      }
    });

    await runSection('expense_shortcuts', async () => {
      const expense_shortcuts = (data.expense_shortcuts as any[]) || [];
      for (const es of expense_shortcuts) {
        await database.runAsync(
          'INSERT OR REPLACE INTO expense_shortcuts (id, title, amount, category, currency, description, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(es.id),
            toSql(es.title) ?? 'اختصار',
            toSql(es.amount) || 0,
            toSql(es.category) ?? 'أخرى',
            toSql(es.currency) ?? 'IQD',
            toSql(es.description),
            toSql(es.createdAt) ?? new Date().toISOString(),
            toSql(es.synced_at)
          ]
        );
      }
    });

    await runSection('income_shortcuts', async () => {
      const income_shortcuts = (data.income_shortcuts as any[]) || [];
      for (const is_ of income_shortcuts) {
        await database.runAsync(
          'INSERT OR REPLACE INTO income_shortcuts (id, source, amount, incomeSource, currency, description, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(is_.id),
            toSql(is_.source) ?? 'دخل',
            toSql(is_.amount) || 0,
            toSql(is_.incomeSource ?? is_.source) ?? 'دخل',
            toSql(is_.currency) ?? 'IQD',
            toSql(is_.description),
            toSql(is_.createdAt) ?? new Date().toISOString(),
            toSql(is_.synced_at)
          ]
        );
      }
    });

    await runSection('exchange_rates', async () => {
      const exchange_rates = (data.exchange_rates as any[]) || [];
      for (const er of exchange_rates) {
        await database.runAsync(
          'INSERT OR REPLACE INTO exchange_rates (id, fromCurrency, toCurrency, rate, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [
            toSql(er.id),
            toSql(er.baseCurrency ?? er.fromCurrency) ?? 'USD',
            toSql(er.targetCurrency ?? er.toCurrency) ?? 'IQD',
            toSql(er.rate) || 0,
            toSql(er.updatedAt) ?? new Date().toISOString()
          ]
        );
      }
    });

    await runSection('notifications', async () => {
      const notifications = (data.notifications as any[]) || [];
      for (const n of notifications) {
        await database.runAsync(
          'INSERT OR REPLACE INTO notifications (id, title, body, data, date, read, type, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(n.id),
            toSql(n.title) ?? '',
            toSql(n.body) ?? '',
            typeof n.data === 'string' ? n.data : JSON.stringify(n.data || {}),
            toSql(n.date) || Date.now(),
            toSql(n.read),
            toSql(n.type) ?? 'default',
            toSql(n.synced_at)
          ]
        );
      }
    });

    await runSection('savings', async () => {
      const savings = (data.savings as any[]) || [];
      for (const s of savings) {
        await database.runAsync(
          'INSERT OR REPLACE INTO savings (id, title, targetAmount, base_target_amount, currentAmount, base_current_amount, currency, description, icon, color, createdAt, updatedAt, synced_at, enc_blob) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(s.id),
            toSql(s.title) ?? 'حصالة',
            toSql(s.targetAmount) || 0,
            (toSql(s.base_target_amount) ?? toSql(s.targetAmount)) || 0,
            toSql(s.currentAmount) || 0,
            (toSql(s.base_current_amount) ?? toSql(s.currentAmount)) || 0,
            toSql(s.currency) ?? 'IQD',
            toSql(s.description),
            toSql(s.icon) ?? 'wallet',
            toSql(s.color) ?? '#10B981',
            toSql(s.createdAt) ?? new Date().toISOString(),
            toSql(s.updatedAt) ?? new Date().toISOString(),
            toSql(s.synced_at),
            toSql(s.enc_blob)
          ]
        );
      }
    });

    await runSection('savings_transactions', async () => {
      const savings_transactions = (data.savings_transactions as any[]) || [];
      for (const st of savings_transactions) {
        await database.runAsync(
          'INSERT OR REPLACE INTO savings_transactions (id, savingsId, amount, type, date, description, createdAt, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(st.id),
            toSql(st.savingsId) || 0,
            toSql(st.amount) || 0,
            toSql(st.type) ?? 'deposit',
            toSql(st.date) ?? new Date().toISOString().slice(0, 10),
            toSql(st.description),
            toSql(st.createdAt) ?? new Date().toISOString(),
            toSql(st.synced_at)
          ]
        );
      }
    });

    await runSection('ai_insights_cache', async () => {
      const ai_insights_cache = (data.ai_insights_cache as any[]) || [];
      const now = new Date();
      for (const row of ai_insights_cache) {
        await database.runAsync(
          'INSERT OR REPLACE INTO ai_insights_cache (id, data, analysis_type, month, year, created_at, walletId) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            toSql(row.id),
            typeof row.data === 'string' ? row.data : JSON.stringify(row.data || {}),
            toSql(row.analysisType || row.analysis_type),
            toSql(row.month) ?? (now.getMonth() + 1),
            toSql(row.year) ?? now.getFullYear(),
            toSql(row.created_at) || Date.now(),
            toSql(row.walletId)
          ]
        );
      }
    });

    await runSection('goal_plan_cache', async () => {
      const goal_plan_cache = (data.goal_plan_cache as any[]) || [];
      const now = new Date();
      for (const row of goal_plan_cache) {
        await database.runAsync(
          'INSERT OR REPLACE INTO goal_plan_cache (id, goal_id, data, month, year, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            toSql(row.id),
            toSql(row.goalId || row.goal_id),
            typeof row.data === 'string' ? row.data : JSON.stringify(row.data || {}),
            toSql(row.month) ?? (now.getMonth() + 1),
            toSql(row.year) ?? now.getFullYear(),
            toSql(row.createdAt || row.created_at) || Date.now()
          ]
        );
      }
    });

    // Update lastFullSyncAt after successful import
    const exportedAt = data.exportedAt as string;
    if (exportedAt) {
      await database.runAsync('UPDATE app_settings SET lastFullSyncAt = ?', [exportedAt]);
    }

    // Fallback: Ensure at least one wallet exists
    const currentWallets = await getWallets();
    if (currentWallets.length === 0) {
      const now = new Date().toISOString();
      const result = await database.runAsync(
        'INSERT INTO wallets (name, currency, balance, icon, color, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['المحفظة الرئيسية', 'IQD', 0, 'wallet', '#0B5A7A', 1, now, now]
      );
      const defaultWalletId = result.lastInsertRowId;
      // Link any orphan transactions to this wallet
      await database.runAsync('UPDATE expenses SET walletId = ? WHERE walletId IS NULL', [defaultWalletId]);
      await database.runAsync('UPDATE income SET walletId = ? WHERE walletId IS NULL', [defaultWalletId]);
    }

    await database.execAsync('COMMIT;');
    // Re-enable foreign keys after total success
    await database.execAsync('PRAGMA foreign_keys = ON;');
    console.log('[Database] FULL DATA IMPORT SUCCESSFUL');
  } catch (err) {
    console.log('[Database] FULL DATA IMPORT FAILED - Rolling back', err);
    await database.execAsync('ROLLBACK;');
    await database.execAsync('PRAGMA foreign_keys = ON;');
    throw err;
  }
};



// Savings operations
export const getSavings = async (): Promise<import('../types').Savings[]> => {
  const database = getDb();
  return await database.getAllAsync<import('../types').Savings>('SELECT * FROM savings ORDER BY createdAt DESC');
};

export const addSavings = async (savings: Omit<import('../types').Savings, 'id' | 'currentAmount' | 'createdAt' | 'updatedAt'>): Promise<number> => {
  const database = getDb();
  const now = new Date().toISOString();

  let baseTarget = savings.base_target_amount !== undefined ? savings.base_target_amount : savings.targetAmount || 0;
  if (isNaN(baseTarget)) baseTarget = savings.targetAmount || 0;

  let baseCurrent = savings.base_current_amount !== undefined ? savings.base_current_amount : 0;
  if (isNaN(baseCurrent)) baseCurrent = 0;

  const result = await database.runAsync(
    'INSERT INTO savings (title, targetAmount, base_target_amount, currentAmount, base_current_amount, currency, description, icon, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      savings.title,
      savings.targetAmount || null,
      baseTarget,
      0,
      baseCurrent,
      savings.currency || 'IQD',
      savings.description || null,
      savings.icon || 'wallet',
      savings.color || '#10B981',
      now,
      now
    ]
  );
  return result.lastInsertRowId;
};

export const updateSavings = async (id: number, savings: Partial<import('../types').Savings>): Promise<void> => {
  const database = getDb();
  const fields: string[] = [];
  const vals: any[] = [];
  const now = new Date().toISOString();

  Object.entries(savings).forEach(([key, val]) => {
    if (key === 'id') return;
    fields.push(`${key} = ?`);
    vals.push(val);
  });

  if (fields.length === 0) return;

  // Always update updatedAt
  if (!fields.includes('updatedAt = ?')) {
    fields.push('updatedAt = ?');
    vals.push(now);
  }
  fields.push('synced_at = NULL');

  vals.push(id);
  await database.runAsync(
    `UPDATE savings SET ${fields.join(', ')} WHERE id = ?`,
    vals
  );
};

export const deleteSavings = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM savings WHERE id = ?', [id]);
};

export const addSavingsTransaction = async (transaction: Omit<import('../types').SavingsTransaction, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const now = new Date().toISOString();

  // Start transaction
  await database.execAsync('BEGIN TRANSACTION;');

  try {
    const result = await database.runAsync(
      'INSERT INTO savings_transactions (savingsId, amount, type, date, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [
        transaction.savingsId,
        transaction.amount,
        transaction.type,
        transaction.date,
        transaction.description || null,
        now
      ]
    );

    // Update currentAmount in savings table
    // 1. Get savings record to check currency
    const savings = await database.getFirstAsync<any>('SELECT currency FROM savings WHERE id = ?', [transaction.savingsId]);
    const currency = savings?.currency || 'IQD';
    const appSettings = await getAppSettings();
    const targetCurrency = appSettings?.currency ? (CURRENCIES.find(c => c.name === appSettings.currency)?.code || 'IQD') : 'IQD';
    
    // 2. Convert delta to base currency
    const { convertCurrency } = await import('../services/currencyService');
    const amountDelta = transaction.type === 'deposit' ? transaction.amount : -transaction.amount;
    const baseDelta = await convertCurrency(amountDelta, currency, targetCurrency);

    await database.runAsync(
      'UPDATE savings SET currentAmount = currentAmount + ?, base_current_amount = base_current_amount + ?, updatedAt = ?, synced_at = NULL WHERE id = ?',
      [amountDelta, baseDelta, now, transaction.savingsId]
    );

    await database.execAsync('COMMIT;');
    return result.lastInsertRowId;
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};

export const transferBetweenSavings = async (
  fromId: number,
  toId: number,
  amount: number,
  date: string,
  description?: string
): Promise<void> => {
  const database = getDb();
  const now = new Date().toISOString();

  await database.execAsync('BEGIN TRANSACTION;');

  try {
    // 0. Get currencies and target currency
    const [fromSavings, toSavings] = await Promise.all([
      database.getFirstAsync<any>('SELECT currency FROM savings WHERE id = ?', [fromId]),
      database.getFirstAsync<any>('SELECT currency FROM savings WHERE id = ?', [toId]),
    ]);
    const fromCur = fromSavings?.currency || 'IQD';
    const toCur = toSavings?.currency || 'IQD';
    
    const appSettings = await getAppSettings();
    const mainCur = appSettings?.currency ? (CURRENCIES.find(c => c.name === appSettings.currency)?.code || 'IQD') : 'IQD';
    const { convertCurrency } = await import('../services/currencyService');

    const targetAmount = await convertCurrency(amount, fromCur, toCur);
    const baseAmountFrom = await convertCurrency(amount, fromCur, mainCur);
    const baseAmountTo = await convertCurrency(targetAmount, toCur, mainCur);

    // 1. Withdrawal from source
    await database.runAsync(
      'INSERT INTO savings_transactions (savingsId, amount, type, date, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [fromId, amount, 'withdrawal', date, description || 'تحويل إلى حصالة أخرى', now]
    );
    await database.runAsync(
      'UPDATE savings SET currentAmount = currentAmount - ?, base_current_amount = base_current_amount - ?, updatedAt = ?, synced_at = NULL WHERE id = ?',
      [amount, baseAmountFrom, now, fromId]
    );

    // 2. Deposit to destination
    await database.runAsync(
      'INSERT INTO savings_transactions (savingsId, amount, type, date, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [toId, targetAmount, 'deposit', date, description || 'تحويل من حصالة أخرى', now]
    );
    await database.runAsync(
      'UPDATE savings SET currentAmount = currentAmount + ?, base_current_amount = base_current_amount + ?, updatedAt = ?, synced_at = NULL WHERE id = ?',
      [targetAmount, baseAmountTo, now, toId]
    );

    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};

export const getSavingsTransactionsForAll = async (): Promise<import('../types').SavingsTransaction[]> => {
  const database = getDb();
  return await database.getAllAsync<import('../types').SavingsTransaction>(
    'SELECT * FROM savings_transactions ORDER BY date DESC, createdAt DESC'
  );
};

export const getSavingsTransactions = async (savingsId: number): Promise<import('../types').SavingsTransaction[]> => {
  const database = getDb();
  return await database.getAllAsync<import('../types').SavingsTransaction>(
    'SELECT * FROM savings_transactions WHERE savingsId = ? ORDER BY date DESC, createdAt DESC',
    [savingsId]
  );
};

/**
 * Recalculate all base_amount values for all items based on target currency.
 * This should be called when the user changes their primary currency in settings.
 */
export const recalculateAllBaseAmounts = async (targetCurrency: string, convertFn: (amount: number, from: string, to: string) => Promise<number>) => {
  const database = getDb();


  try {
    // 1. Expenses
    const expenses = await database.getAllAsync<any>('SELECT id, amount, currency FROM expenses');
    for (const item of expenses) {
      const baseAmount = await convertFn(item.amount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE expenses SET base_amount = ?, synced_at = NULL WHERE id = ?', [baseAmount, item.id]);
    }

    // 2. Income
    const income = await database.getAllAsync<any>('SELECT id, amount, currency FROM income');
    for (const item of income) {
      const baseAmount = await convertFn(item.amount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE income SET base_amount = ?, synced_at = NULL WHERE id = ?', [baseAmount, item.id]);
    }

    // 3. Budgets
    const budgets = await database.getAllAsync<any>('SELECT id, amount, currency FROM budgets');
    for (const item of budgets) {
      const baseAmount = await convertFn(item.amount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE budgets SET base_amount = ?, synced_at = NULL WHERE id = ?', [baseAmount, item.id]);
    }

    // 4. Goals
    const goals = await database.getAllAsync<any>('SELECT id, targetAmount, currentAmount, currency FROM financial_goals');
    for (const item of goals) {
      const baseTarget = await convertFn(item.targetAmount, item.currency || 'IQD', targetCurrency);
      const baseCurrent = await convertFn(item.currentAmount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE financial_goals SET base_target_amount = ?, base_current_amount = ?, synced_at = NULL WHERE id = ?', [baseTarget, baseCurrent, item.id]);
    }

    // 5. Debts
    const debts = await database.getAllAsync<any>('SELECT id, totalAmount, remainingAmount, currency FROM debts');
    for (const item of debts) {
      const baseTotal = await convertFn(item.totalAmount, item.currency || 'IQD', targetCurrency);
      const baseRem = await convertFn(item.remainingAmount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE debts SET base_total_amount = ?, base_remaining_amount = ?, synced_at = NULL WHERE id = ?', [baseTotal, baseRem, item.id]);
    }

    // 6. Savings
    const savingsItems = await database.getAllAsync<any>('SELECT id, targetAmount, currentAmount, currency FROM savings');
    for (const item of savingsItems) {
      const baseTarget = await convertFn(item.targetAmount || 0, item.currency || 'IQD', targetCurrency);
      const baseCurrent = await convertFn(item.currentAmount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE savings SET base_target_amount = ?, base_current_amount = ?, synced_at = NULL WHERE id = ?', [baseTarget, baseCurrent, item.id]);
    }

    // 7. Bills
    const bills = await database.getAllAsync<any>('SELECT id, amount, currency FROM bills');
    for (const item of bills) {
      const baseAmount = await convertFn(item.amount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE bills SET base_amount = ?, synced_at = NULL WHERE id = ?', [baseAmount, item.id]);
    }

    // 8. Recurring Expenses
    const recurring = await database.getAllAsync<any>('SELECT id, amount, currency FROM recurring_expenses');
    for (const item of recurring) {
      const baseAmount = await convertFn(item.amount, item.currency || 'IQD', targetCurrency);
      await database.runAsync('UPDATE recurring_expenses SET base_amount = ?, synced_at = NULL WHERE id = ?', [baseAmount, item.id]);
    }


  } catch (error) {

    throw error;
  }
};

// Wallet Operations
const normalizeWalletRow = (wallet: import('../types').Wallet): import('../types').Wallet => ({
  ...wallet,
  isDefault: Boolean(wallet.isDefault),
});

export const getWallets = async (): Promise<import('../types').Wallet[]> => {
  const database = getDb();
  // Calculate dynamic balance for each wallet: initial balance + sum(income) - sum(expenses)
  const query = `
    SELECT w.*, 
      (w.balance + COALESCE(inc.total, 0) - COALESCE(exp.total, 0)) as balance
    FROM wallets w
    LEFT JOIN (SELECT walletId, SUM(amount) as total FROM income GROUP BY walletId) inc ON inc.walletId = w.id
    LEFT JOIN (SELECT walletId, SUM(amount) as total FROM expenses GROUP BY walletId) exp ON exp.walletId = w.id
    ORDER BY w.isDefault DESC, w.name ASC
  `;
  const wallets = await database.getAllAsync<import('../types').Wallet>(query);
  return wallets.map(normalizeWalletRow);
};

export const getWalletById = async (id: number): Promise<import('../types').Wallet | null> => {
  const database = getDb();
  const query = `
    SELECT w.*, 
      (w.balance + COALESCE(inc.total, 0) - COALESCE(exp.total, 0)) as balance
    FROM wallets w
    LEFT JOIN (SELECT walletId, SUM(amount) as total FROM income GROUP BY walletId) inc ON inc.walletId = w.id
    LEFT JOIN (SELECT walletId, SUM(amount) as total FROM expenses GROUP BY walletId) exp ON exp.walletId = w.id
    WHERE w.id = ?
  `;
  const wallet = await database.getFirstAsync<import('../types').Wallet>(
    query,
    [id]
  );
  return wallet ? normalizeWalletRow(wallet) : null;
};

export const addWallet = async (wallet: Omit<import('../types').Wallet, 'id'>): Promise<number> => {
  const database = getDb();
  const now = new Date().toISOString();

  // If this is the first wallet, make it default
  const existingWallets = await getWallets();
  const isDefault = existingWallets.length === 0 || wallet.isDefault ? 1 : 0;

  if (isDefault) {
    await database.runAsync('UPDATE wallets SET isDefault = 0, synced_at = NULL');
  }

  const result = await database.runAsync(
    'INSERT INTO wallets (name, currency, balance, icon, color, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [wallet.name, wallet.currency || 'IQD', wallet.balance || 0, wallet.icon || 'wallet', wallet.color || '#0B5A7A', isDefault, now, now]
  );

  return result.lastInsertRowId;
};

export const updateWallet = async (id: number, wallet: Partial<import('../types').Wallet>): Promise<void> => {
  const database = getDb();
  const updates: string[] = [];
  const params: any[] = [];
  const now = new Date().toISOString();

  if (wallet.name) { updates.push('name = ?'); params.push(wallet.name); }
  if (wallet.currency) { updates.push('currency = ?'); params.push(wallet.currency); }
  if (wallet.balance !== undefined) { updates.push('balance = ?'); params.push(wallet.balance); }
  if (wallet.icon) { updates.push('icon = ?'); params.push(wallet.icon); }
  if (wallet.color) { updates.push('color = ?'); params.push(wallet.color); }

  if (updates.length > 0) {
    updates.push('updatedAt = ?');
    params.push(now);
    updates.push('synced_at = NULL'); // Mark as unsynced
    params.push(id);
    await database.runAsync(`UPDATE wallets SET ${updates.join(', ')} WHERE id = ?`, params);
  }
};

export const setDefaultWallet = async (id: number): Promise<void> => {
  const database = getDb();
  await database.execAsync('BEGIN TRANSACTION;');
  try {
    await database.runAsync('UPDATE wallets SET isDefault = 0, synced_at = NULL');
    await database.runAsync('UPDATE wallets SET isDefault = 1, synced_at = NULL WHERE id = ?', [id]);
    await database.execAsync('COMMIT;');
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};

export const deleteWallet = async (id: number): Promise<void> => {
  const database = getDb();
  // Don't delete the last wallet
  const wallets = await getWallets();
  if (wallets.length <= 1) {
    throw new Error('لا يمكن حذف المحفظة الوحيدة');
  }

  const walletToDelete = wallets.find(w => w.id === id);
  if (walletToDelete?.isDefault) {
    const nextWallet = wallets.find(w => w.id !== id);
    if (nextWallet) {
      await setDefaultWallet(nextWallet.id);
    }
  }

  await database.runAsync('DELETE FROM wallets WHERE id = ?', [id]);
  // Also optionally re-link expenses/income or delete them? 
  // For safety, let's link them to the new default wallet or leave as-is (they have a walletId but it might be invalid)
  // Re-linking to default is safer.
  const newDefaultId = (await getWallets())[0]?.id;
  if (newDefaultId) {
    await database.runAsync('UPDATE expenses SET walletId = ? WHERE walletId = ?', [newDefaultId, id]);
    await database.runAsync('UPDATE income SET walletId = ? WHERE walletId = ?', [newDefaultId, id]);
  }
};



// in debts i want user can chose the currency of debt, and when. show debts show any debt with its currency 
export const transferBetweenWallets = async (data: {
  fromWalletId: number;
  toWalletId: number;
  amount: number;
  date: string;
  description?: string;
  currency: string;
}): Promise<void> => {
  const database = getDb();
  const { fromWalletId, toWalletId, amount, date, description, currency } = data;

  const wallets = await getWallets();
  const fromWallet = wallets.find(w => w.id === fromWalletId);
  const toWallet = wallets.find(w => w.id === toWalletId);

  if (!fromWallet || !toWallet) {
    throw new Error('One or both wallets not found');
  }

  // 1. Create Expense from source wallet
  // This will trigger base_amount calculation inside addExpense
  await addExpense({
    title: `تحويل إلى ${toWallet.name}`,
    amount,
    category: 'transfer',
    date,
    description: description || `تحويل مالي من ${fromWallet.name} إلى ${toWallet.name}`,
    currency,
    walletId: fromWalletId
  });

  // 2. Create Income for destination wallet
  await addIncome({
    source: `تحويل من ${fromWallet.name}`,
    amount,
    category: 'transfer',
    date,
    description: description || `تحويل مالي من ${fromWallet.name} إلى ${toWallet.name}`,
    currency,
    walletId: toWalletId
  });
};
