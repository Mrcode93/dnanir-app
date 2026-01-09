// App Types
export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  description?: string;
}

export interface Income {
  id: number;
  source: string;
  amount: number;
  date: string;
  description?: string;
}

export type ExpenseCategory = 
  | 'food'
  | 'transport'
  | 'shopping'
  | 'bills'
  | 'entertainment'
  | 'health'
  | 'education'
  | 'other'
  | string; // Allow custom categories

export type IncomeSource = 
  | 'salary'
  | 'business'
  | 'investment'
  | 'gift'
  | 'other'
  | string; // Allow custom sources

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  food: 'طعام',
  transport: 'مواصلات',
  shopping: 'تسوق',
  bills: 'فواتير',
  entertainment: 'ترفيه',
  health: 'صحة',
  education: 'تعليم',
  other: 'أخرى',
};

export const INCOME_SOURCES: Record<IncomeSource, string> = {
  salary: 'راتب',
  business: 'تجارة',
  investment: 'استثمار',
  gift: 'هدية',
  other: 'أخرى',
};

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  topExpenseCategories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

export interface UserSettings {
  id?: number;
  name?: string;
  authMethod: 'none' | 'password' | 'biometric';
  passwordHash?: string;
  biometricsEnabled?: boolean;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  darkModeEnabled: boolean;
  autoBackupEnabled: boolean;
  currency: string;
  language: string;
}

export interface FinancialGoal {
  id: number;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // ISO date string
  category: GoalCategory;
  description?: string;
  createdAt: string;
  completed: boolean;
}

export type GoalCategory = 
  | 'emergency'
  | 'vacation'
  | 'car'
  | 'house'
  | 'wedding'
  | 'education'
  | 'business'
  | 'other';

export const GOAL_CATEGORIES: Record<GoalCategory, { label: string; icon: string }> = {
  emergency: { label: 'طوارئ', icon: 'shield' },
  vacation: { label: 'رحلة', icon: 'airplane' },
  car: { label: 'سيارة', icon: 'car' },
  house: { label: 'منزل', icon: 'home' },
  wedding: { label: 'زواج', icon: 'heart' },
  education: { label: 'تعليم', icon: 'school' },
  business: { label: 'تجارة', icon: 'briefcase' },
  other: { label: 'أخرى', icon: 'star' },
};
