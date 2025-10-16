export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
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

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  topExpenseCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
}

export type ExpenseCategory = 
  | 'food'
  | 'bills'
  | 'entertainment'
  | 'transport'
  | 'shopping'
  | 'health'
  | 'education'
  | 'other';

export type IncomeSource = 
  | 'salary'
  | 'freelance'
  | 'grants'
  | 'investment'
  | 'other';

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  food: 'طعام',
  bills: 'فواتير',
  entertainment: 'ترفيه',
  transport: 'مواصلات',
  shopping: 'تسوق',
  health: 'صحة',
  education: 'تعليم',
  other: 'أخرى'
};

export const INCOME_SOURCES: Record<IncomeSource, string> = {
  salary: 'راتب',
  freelance: 'عمل حر',
  grants: 'منح',
  investment: 'استثمار',
  other: 'أخرى'
};
