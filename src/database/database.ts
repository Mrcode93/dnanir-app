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
        description TEXT
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS income (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT
      );
    `);

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
        incomeReminder INTEGER DEFAULT 1,
        weeklySummary INTEGER DEFAULT 1,
        monthlySummary INTEGER DEFAULT 1
      );
    `);

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
        completed INTEGER DEFAULT 0
      );
    `);

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
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
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
    'INSERT INTO expenses (title, amount, category, date, description) VALUES (?, ?, ?, ?, ?)',
    [expense.title, expense.amount, expense.category, expense.date, expense.description || null]
  );
  return result.lastInsertRowId;
};

export const getExpenses = async (): Promise<import('../types').Expense[]> => {
  const database = getDb();
  const result = await database.getAllAsync<import('../types').Expense>(
    'SELECT * FROM expenses ORDER BY date DESC'
  );
  return result;
};

export const updateExpense = async (id: number, expense: Omit<import('../types').Expense, 'id'>): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'UPDATE expenses SET title = ?, amount = ?, category = ?, date = ?, description = ? WHERE id = ?',
    [expense.title, expense.amount, expense.category, expense.date, expense.description || null, id]
  );
};

export const deleteExpense = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
};

// Income operations
export const addIncome = async (income: Omit<import('../types').Income, 'id'>): Promise<number> => {
  const database = getDb();
  const result = await database.runAsync(
    'INSERT INTO income (source, amount, date, description) VALUES (?, ?, ?, ?)',
    [income.source, income.amount, income.date, income.description || null]
  );
  return result.lastInsertRowId;
};

export const getIncome = async (): Promise<import('../types').Income[]> => {
  const database = getDb();
  const result = await database.getAllAsync<import('../types').Income>(
    'SELECT * FROM income ORDER BY date DESC'
  );
  return result;
};

export const updateIncome = async (id: number, income: Omit<import('../types').Income, 'id'>): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'UPDATE income SET source = ?, amount = ?, date = ?, description = ? WHERE id = ?',
    [income.source, income.amount, income.date, income.description || null, id]
  );
};

export const deleteIncome = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM income WHERE id = ?', [id]);
};

// User settings
export const getUserSettings = async (): Promise<import('../types').UserSettings | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<import('../types').UserSettings & { biometricsEnabled: number }>(
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
  
  if (existing) {
    await database.runAsync(
      'UPDATE user_settings SET name = ?, authMethod = ?, passwordHash = ?, biometricsEnabled = ? WHERE id = ?',
      [
        settings.name || null,
        settings.authMethod,
        settings.passwordHash || null,
        settings.biometricsEnabled ? 1 : 0,
        existing.id,
      ]
    );
  } else {
    await database.runAsync(
      'INSERT INTO user_settings (name, authMethod, passwordHash, biometricsEnabled) VALUES (?, ?, ?, ?)',
      [
        settings.name || null,
        settings.authMethod,
        settings.passwordHash || null,
        settings.biometricsEnabled ? 1 : 0,
      ]
    );
  }
};

// App settings
export const getAppSettings = async (): Promise<import('../types').AppSettings | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<import('../types').AppSettings & {
    notificationsEnabled: number;
    darkModeEnabled: number;
    autoBackupEnabled: number;
  }>('SELECT * FROM app_settings LIMIT 1');
  
  if (result) {
    return {
      notificationsEnabled: Boolean(result.notificationsEnabled),
      darkModeEnabled: Boolean(result.darkModeEnabled),
      autoBackupEnabled: Boolean(result.autoBackupEnabled),
      currency: result.currency,
      language: result.language,
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
    'INSERT INTO financial_goals (title, targetAmount, currentAmount, targetDate, category, description, createdAt, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      goal.title,
      goal.targetAmount,
      goal.currentAmount || 0,
      goal.targetDate || null,
      goal.category,
      goal.description || null,
      createdAt,
      goal.completed ? 1 : 0,
    ]
  );
  return result.lastInsertRowId;
};

export const getFinancialGoals = async (): Promise<import('../types').FinancialGoal[]> => {
  const database = getDb();
  const result = await database.getAllAsync<import('../types').FinancialGoal & { completed: number }>(
    'SELECT * FROM financial_goals ORDER BY createdAt DESC'
  );
  return result.map(goal => ({
    ...goal,
    completed: Boolean(goal.completed),
  }));
};

export const getFinancialGoal = async (id: number): Promise<import('../types').FinancialGoal | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<import('../types').FinancialGoal & { completed: number }>(
    'SELECT * FROM financial_goals WHERE id = ?',
    [id]
  );
  if (result) {
    return {
      ...result,
      completed: Boolean(result.completed),
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
  query += ' ORDER BY createdAt DESC';
  const result = await database.getAllAsync<CustomCategory>(query, params);
  return result;
};

export const deleteCustomCategory = async (id: number): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM custom_categories WHERE id = ?', [id]);
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
  `);
};
