import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('dnanir.db');

    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        currency TEXT DEFAULT 'IQD'
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    `);

    // Add currency column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE expenses ADD COLUMN currency TEXT DEFAULT "IQD";');
    } catch (e) {
      // Column already exists, ignore
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        currency TEXT DEFAULT 'IQD'
      );
      CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
    `);

    // Add currency column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE income ADD COLUMN currency TEXT DEFAULT "IQD";');
    } catch (e) {
      // Column already exists, ignore
    }

    // Add category column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE income ADD COLUMN category TEXT;');
    } catch (e) {
      // Column already exists, ignore
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        authMethod TEXT DEFAULT 'none',
        passwordHash TEXT,
        biometricsEnabled INTEGER DEFAULT 0
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notificationsEnabled INTEGER DEFAULT 1,
        darkModeEnabled INTEGER DEFAULT 0,
        autoBackupEnabled INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'دينار عراقي',
        language TEXT DEFAULT 'ar'
      );
    `);

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

    // Add expenseReminderTime column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE notification_settings ADD COLUMN expenseReminderTime TEXT DEFAULT "20:00";');
    } catch (e) {
      // Column already exists, ignore
    }

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

    // Add currency column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE financial_goals ADD COLUMN currency TEXT DEFAULT "IQD";');
    } catch (e) {
      // Column already exists, ignore
    }

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
        createdAt TEXT NOT NULL
      );
    `);

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
        createdAt TEXT NOT NULL
      );
    `);

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
        FOREIGN KEY (debtId) REFERENCES debts(id) ON DELETE CASCADE
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS debt_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debtId INTEGER NOT NULL,
        amount REAL NOT NULL,
        paymentDate TEXT NOT NULL,
        installmentId INTEGER,
        description TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (debtId) REFERENCES debts(id) ON DELETE CASCADE,
        FOREIGN KEY (installmentId) REFERENCES debt_installments(id) ON DELETE SET NULL
      );
    `);

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

    // Add isCustom column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE challenges ADD COLUMN isCustom INTEGER DEFAULT 0;');
    } catch (e) {
      // Column already exists, ignore
    }

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

    // Add image_path column if it doesn't exist (for existing databases)
    try {
      await db.execAsync('ALTER TABLE bills ADD COLUMN image_path TEXT;');
    } catch (e) {
      // Column already exists, ignore
    }

    // Bill payment history table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        billId INTEGER NOT NULL,
        amount REAL NOT NULL,
        paymentDate TEXT NOT NULL,
        description TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (billId) REFERENCES bills(id) ON DELETE CASCADE
      );
    `);

    // Add receipt_image_path column to expenses if it doesn't exist
    try {
      await db.execAsync('ALTER TABLE expenses ADD COLUMN receipt_image_path TEXT;');
    } catch (e) {
      // Column already exists, ignore
    }

    // Initialize default categories
    await initializeDefaultCategories(db);
  } catch (error) {
    // Database initialization error
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

const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

// Expense operations
export const addExpense = async (expense: Omit<import('../types').Expense, 'id'>): Promise<number> => {
  const database = getDb();
  const result = await database.runAsync(
    'INSERT INTO expenses (title, amount, category, date, description, currency, receipt_image_path) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [expense.title, expense.amount, expense.category, expense.date, expense.description || null, expense.currency || 'IQD', expense.receipt_image_path || null]
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

export const getExpenses = async (): Promise<import('../types').Expense[]> => {
  const database = getDb();
  const result = await database.getAllAsync<import('../types').Expense>(
    'SELECT * FROM expenses ORDER BY date DESC, id DESC'
  );
  return result;
};

export const getExpensesCount = async (): Promise<number> => {
  const database = getDb();
  const result = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM expenses');
  return result?.count || 0;
};

export const getExpensesByRange = async (startDate: string, endDate: string): Promise<import('../types').Expense[]> => {
  const database = getDb();
  const result = await database.getAllAsync<import('../types').Expense>(
    'SELECT * FROM expenses WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC',
    [startDate, endDate]
  );
  return result;
};

export const getRecentTransactions = async (limit: number = 5): Promise<(import('../types').Expense | import('../types').Income | any)[]> => {
  const database = getDb();

  // Get expenses and income separately with limits to keep it fast
  const expenses = await database.getAllAsync<any>(
    'SELECT "expense" as type, * FROM expenses ORDER BY date DESC, id DESC LIMIT ?',
    [limit]
  );
  const income = await database.getAllAsync<any>(
    'SELECT "income" as type, * FROM income ORDER BY date DESC, id DESC LIMIT ?',
    [limit]
  );

  // Combine and sort in memory (since we only have 2*limit items, this is very fast)
  const combined = [...expenses, ...income].sort((a, b) => {
    if (b.date !== a.date) return b.date > a.date ? 1 : -1;
    return (b.id || 0) - (a.id || 0);
  });

  return combined.slice(0, limit);
};

export const updateExpense = async (id: number, expense: Omit<import('../types').Expense, 'id'>): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'UPDATE expenses SET title = ?, amount = ?, category = ?, date = ?, description = ?, currency = ?, receipt_image_path = ? WHERE id = ?',
    [expense.title, expense.amount, expense.category, expense.date, expense.description || null, expense.currency || 'IQD', expense.receipt_image_path || null, id]
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
export const addIncome = async (income: Omit<import('../types').Income, 'id'>): Promise<number> => {
  const database = getDb();
  const result = await database.runAsync(
    'INSERT INTO income (source, amount, date, description, currency, category) VALUES (?, ?, ?, ?, ?, ?)',
    [income.source, income.amount, income.date, income.description || null, income.currency || 'IQD', income.category || 'other']
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

export const getIncome = async (): Promise<import('../types').Income[]> => {
  const database = getDb();
  const result = await database.getAllAsync<import('../types').Income>(
    'SELECT * FROM income ORDER BY date DESC, id DESC'
  );
  return result;
};

export const getIncomeCount = async (): Promise<number> => {
  const database = getDb();
  const result = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM income');
  return result?.count || 0;
};

export const getIncomeByRange = async (startDate: string, endDate: string): Promise<import('../types').Income[]> => {
  const database = getDb();
  const result = await database.getAllAsync<import('../types').Income>(
    'SELECT * FROM income WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC',
    [startDate, endDate]
  );
  return result;
};

export const updateIncome = async (id: number, income: Omit<import('../types').Income, 'id'>): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'UPDATE income SET source = ?, amount = ?, date = ?, description = ?, currency = ?, category = ? WHERE id = ?',
    [income.source, income.amount, income.date, income.description || null, income.currency || 'IQD', income.category || 'other', id]
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

export const getAvailableMonths = async (): Promise<{ year: number; month: number }[]> => {
  const database = getDb();

  // Use SQLite to get unique year-month strings directly
  // substr(date, 1, 7) extracts YYYY-MM
  const query = `
    SELECT DISTINCT SUBSTR(date, 1, 7) as month_key FROM expenses
    UNION
    SELECT DISTINCT SUBSTR(date, 1, 7) as month_key FROM income
    ORDER BY month_key DESC
  `;

  const results = await database.getAllAsync<{ month_key: string }>(query);

  return results.map(row => {
    const [year, month] = row.month_key.split('-').map(Number);
    return { year, month };
  });
};

export const getFinancialStatsAggregated = async (startDate?: string, endDate?: string) => {
  const database = getDb();
  let expenseQuery = 'SELECT SUM(amount) as total FROM expenses';
  let incomeQuery = 'SELECT SUM(amount) as total FROM income';
  const params: string[] = [];

  if (startDate && endDate) {
    expenseQuery += ' WHERE date >= ? AND date <= ?';
    incomeQuery += ' WHERE date >= ? AND date <= ?';
    params.push(startDate, endDate);
    params.push(startDate, endDate); // Two pairs of params for two queries
  }

  const expenseResult = await database.getFirstAsync<{ total: number }>(expenseQuery, params.slice(0, 2));
  const incomeResult = await database.getFirstAsync<{ total: number }>(incomeQuery, params.slice(0, 2));

  return {
    totalExpenses: expenseResult?.total || 0,
    totalIncome: incomeResult?.total || 0,
    balance: (incomeResult?.total || 0) - (expenseResult?.total || 0),
  };
};

export const getExpensesByCategoryAggregated = async (startDate?: string, endDate?: string) => {
  const database = getDb();
  let query = 'SELECT category, SUM(amount) as amount FROM expenses';
  const params: string[] = [];

  if (startDate && endDate) {
    query += ' WHERE date >= ? AND date <= ?';
    params.push(startDate, endDate);
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
      autoBackupEnabled: result.autoBackupEnabled === 1,
    };
  }
  return null;
};

export const upsertAppSettings = async (settings: import('../types').AppSettings): Promise<void> => {
  const database = getDb();
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM app_settings LIMIT 1');

  if (existing) {
    await database.runAsync(
      'UPDATE app_settings SET notificationsEnabled = ?, darkModeEnabled = ?, autoBackupEnabled = ?, currency = ?, language = ? WHERE id = ?',
      [
        settings.notificationsEnabled ? 1 : 0,
        settings.darkModeEnabled ? 1 : 0,
        settings.autoBackupEnabled ? 1 : 0,
        settings.currency,
        settings.language,
        existing.id,
      ]
    );
  } else {
    await database.runAsync(
      'INSERT INTO app_settings (notificationsEnabled, darkModeEnabled, autoBackupEnabled, currency, language) VALUES (?, ?, ?, ?, ?)',
      [
        settings.notificationsEnabled ? 1 : 0,
        settings.darkModeEnabled ? 1 : 0,
        settings.autoBackupEnabled ? 1 : 0,
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

export const upsertNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  const database = getDb();
  const existing = await database.getFirstAsync<{ id: number }>('SELECT id FROM notification_settings LIMIT 1');

  if (existing) {
    await database.runAsync(
      'UPDATE notification_settings SET dailyReminder = ?, dailyReminderTime = ?, expenseReminder = ?, expenseReminderTime = ?, incomeReminder = ?, weeklySummary = ?, monthlySummary = ? WHERE id = ?',
      [
        settings.dailyReminder,
        settings.dailyReminderTime,
        settings.expenseReminder,
        settings.expenseReminderTime || '20:00',
        settings.incomeReminder,
        settings.weeklySummary,
        settings.monthlySummary,
        existing.id,
      ]
    );
  } else {
    await database.runAsync(
      'INSERT INTO notification_settings (dailyReminder, dailyReminderTime, expenseReminder, expenseReminderTime, incomeReminder, weeklySummary, monthlySummary) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        settings.dailyReminder,
        settings.dailyReminderTime,
        settings.expenseReminder,
        settings.expenseReminderTime || '20:00',
        settings.incomeReminder,
        settings.weeklySummary,
        settings.monthlySummary,
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
  const result = await database.runAsync(
    'INSERT INTO financial_goals (title, targetAmount, currentAmount, targetDate, category, description, createdAt, completed, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      goal.title,
      goal.targetAmount,
      goal.currentAmount || 0,
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

  if (updates.length > 0) {
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
      throw new Error('الفئة موجودة بالفعل');
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
}

export const addBudget = async (budget: Omit<Budget, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  try {
    const result = await database.runAsync(
      'INSERT OR REPLACE INTO budgets (category, amount, month, year, createdAt, currency) VALUES (?, ?, ?, ?, ?, ?)',
      [budget.category, budget.amount, budget.month, budget.year, createdAt, budget.currency || 'IQD']
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

  if (updates.length > 0) {
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
  lastProcessedDate?: string;
  createdAt: string;
}

export const addRecurringExpense = async (expense: Omit<RecurringExpense, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO recurring_expenses (title, amount, category, recurrenceType, recurrenceValue, startDate, endDate, description, isActive, lastProcessedDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      expense.title,
      expense.amount,
      expense.category,
      expense.recurrenceType,
      expense.recurrenceValue,
      expense.startDate,
      expense.endDate || null,
      expense.description || null,
      expense.isActive ? 1 : 0,
      expense.lastProcessedDate || null,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getRecurringExpenses = async (activeOnly?: boolean): Promise<RecurringExpense[]> => {
  const database = getDb();
  let query = 'SELECT * FROM recurring_expenses';
  const params: any[] = [];
  if (activeOnly) {
    query += ' WHERE isActive = 1';
  }
  query += ' ORDER BY createdAt DESC';
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

  if (updates.length > 0) {
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

export const clearAllData = async (): Promise<void> => {
  const database = getDb();
  await database.execAsync(`
    DELETE FROM expenses;
    DELETE FROM income;
    DELETE FROM user_settings;
    DELETE FROM app_settings;
    DELETE FROM notification_settings;
    DELETE FROM financial_goals;
    DELETE FROM custom_categories;
    DELETE FROM budgets;
    DELETE FROM recurring_expenses;
    DELETE FROM exchange_rates;
    DELETE FROM debt_installments;
    DELETE FROM debts;
    DELETE FROM challenges;
  `);
};

// Debt operations
export interface Debt {
  id: number;
  debtorName: string;
  totalAmount: number;
  remainingAmount: number;
  startDate: string;
  dueDate?: string;
  description?: string;
  type: 'debt' | 'installment' | 'advance'; // دين، أقساط، سلف
  currency?: string;
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

export const addDebt = async (debt: Omit<Debt, 'id' | 'createdAt'>): Promise<number> => {
  const database = getDb();
  const createdAt = new Date().toISOString();
  const result = await database.runAsync(
    'INSERT INTO debts (debtorName, totalAmount, remainingAmount, startDate, dueDate, description, type, currency, isPaid, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      debt.debtorName,
      debt.totalAmount,
      debt.remainingAmount,
      debt.startDate,
      debt.dueDate || null,
      debt.description || null,
      debt.type,
      debt.currency || 'IQD',
      debt.isPaid ? 1 : 0,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
};

export const getDebts = async (): Promise<Debt[]> => {
  const database = getDb();
  const result = await database.getAllAsync<any>(
    'SELECT * FROM debts ORDER BY dueDate ASC'
  );
  return result.map((item: any) => ({
    ...item,
    isPaid: item.isPaid === 1,
  }));
};

export const getDebt = async (id: number): Promise<import('../types').Debt | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>(
    'SELECT * FROM debts WHERE id = ?',
    [id]
  );
  if (result) {
    return {
      ...result,
      isPaid: result.isPaid === 1,
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
  if (debt.currency !== undefined) {
    updates.push('currency = ?');
    values.push(debt.currency || 'IQD');
  }
  if (debt.isPaid !== undefined) {
    updates.push('isPaid = ?');
    values.push(debt.isPaid ? 1 : 0);
  }

  if (updates.length > 0) {
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
    'UPDATE achievements SET isUnlocked = 1, unlockedAt = ? WHERE type = ?',
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
  const result = await database.runAsync(
    'INSERT INTO bills (title, amount, category, dueDate, recurrenceType, recurrenceValue, description, currency, isPaid, paidDate, reminderDaysBefore, image_path, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      bill.title,
      bill.amount,
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
