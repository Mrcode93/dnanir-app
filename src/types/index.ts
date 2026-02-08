// App Types
export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  description?: string;
  currency?: string;
  receipt_image_path?: string; // Path to stored receipt image
}

export interface Income {
  id: number;
  source: string;
  amount: number;
  date: string;
  description?: string;
  currency?: string;
  category?: IncomeSource;
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
  currency?: string;
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

// Recurring Expenses
export interface RecurringExpense {
  id: number;
  title: string;
  amount: number;
  category: ExpenseCategory;
  recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceValue: number;
  startDate: string;
  endDate?: string;
  description?: string;
  isActive: boolean;
  lastProcessedDate?: string;
  createdAt: string;
}

export const RECURRENCE_TYPES = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
  yearly: 'سنوي',
};

// Currency
export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'IQD', name: 'دينار عراقي', symbol: 'د.ع' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك' },
  { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م' },
];

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  updatedAt: string;
}

// Advanced Reports
export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  categories?: string[];
  minAmount?: number;
  maxAmount?: number;
  incomeSources?: string[];
}

// Debts
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

export const DEBT_TYPES = {
  debt: 'دين',
  installment: 'أقساط',
  advance: 'سلف',
};

// Challenges
export type ChallengeType =
  | 'no_coffee'           // بدون كوفي
  | 'no_delivery'         // لا دليفري
  | 'daily_budget'        // اقتصاد
  | 'save_amount'         // 50 ألف
  | 'save_percentage'     // حصالة
  | 'emergency_fund'      // للطوارئ
  | 'log_all_expenses'    // تسجيل
  | 'no_missed_days'      // بدون نسيان
  | 'stay_in_budget'      // واعي
  | 'pay_first_debt'      // قاطع
  | 'reduce_debts'        // نظف
  | 'complete_loan'       // حر
  | 'custom';             // تحديات مخصصة

export type ChallengeCategory = 'spending_reduction' | 'saving' | 'discipline' | 'debt';

export interface Challenge {
  id: number;
  type: ChallengeType;
  title: string;
  description: string;
  category: ChallengeCategory;
  icon: string; // Icon name for Ionicons or custom
  startDate: string;
  endDate: string;
  targetValue?: number; // For challenges that need a numeric target
  targetCategory?: string; // For category-specific challenges
  currentProgress: number;
  targetProgress: number;
  completed: boolean;
  completedAt?: string;
  reward?: string;
  createdAt: string;
  isCustom?: boolean; // Flag to indicate custom challenge
}

export const CHALLENGE_TYPES: Record<Exclude<ChallengeType, 'custom'>, {
  title: string;
  description: string;
  category: ChallengeCategory;
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  defaultDuration: number; // days
  defaultTarget?: number;
}> = {
  no_coffee: {
    title: 'بدون كوفي',
    description: 'لا تصرف على القهوة لمدة 5 أيام',
    category: 'spending_reduction',
    icon: 'cafe-outline',
    defaultDuration: 5,
  },
  no_delivery: {
    title: 'لا دليفري',
    description: 'لا طلبات مطاعم لمدة 7 أيام',
    category: 'spending_reduction',
    icon: 'fast-food-outline',
    defaultDuration: 7,
  },
  daily_budget: {
    title: 'اقتصاد',
    description: 'مصروف يومي أقل من 10,000',
    category: 'spending_reduction',
    icon: 'wallet-outline',
    defaultDuration: 7,
    defaultTarget: 10000,
  },
  save_amount: {
    title: '50 ألف',
    description: 'ادخر 50,000 خلال أسبوع',
    category: 'saving',
    icon: 'cash-outline',
    defaultDuration: 7,
    defaultTarget: 50000,
  },
  save_percentage: {
    title: 'حصالة',
    description: 'ادخر 10% من دخلك',
    category: 'saving',
    icon: 'wallet-outline',
    defaultDuration: 30,
    defaultTarget: 10, // percentage
  },
  emergency_fund: {
    title: 'للطوارئ',
    description: 'كوّن صندوق طوارئ',
    category: 'saving',
    icon: 'shield-outline',
    defaultDuration: 90,
    defaultTarget: 100000, // example amount
  },
  log_all_expenses: {
    title: 'تسجيل',
    description: 'سجل كل مصروف لمدة 7 أيام',
    category: 'discipline',
    icon: 'calendar-outline',
    defaultDuration: 7,
  },
  no_missed_days: {
    title: 'بدون نسيان',
    description: 'لا يوم بدون تسجيل',
    category: 'discipline',
    icon: 'checkmark-circle-outline',
    defaultDuration: 30,
  },
  stay_in_budget: {
    title: 'واعي',
    description: 'لا تتجاوز الميزانية',
    category: 'discipline',
    icon: 'bulb-outline',
    defaultDuration: 30,
  },
  pay_first_debt: {
    title: 'قاطع',
    description: 'سد أول دين',
    category: 'debt',
    icon: 'link-outline',
    defaultDuration: 90,
  },
  reduce_debts: {
    title: 'نظف',
    description: 'قلل الديون 10%',
    category: 'debt',
    icon: 'trash-outline',
    defaultDuration: 60,
    defaultTarget: 10, // percentage
  },
  complete_loan: {
    title: 'حر',
    description: 'خلص قرض',
    category: 'debt',
    icon: 'flag-outline',
    defaultDuration: 180,
  },
};

export const CHALLENGE_CATEGORIES: Record<ChallengeCategory, { label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; color: string }> = {
  spending_reduction: { label: 'تقليل الصرف', icon: 'trending-down-outline', color: '#EF4444' },
  saving: { label: 'الادخار', icon: 'cash-outline', color: '#10B981' },
  discipline: { label: 'الانضباط', icon: 'checkmark-circle-outline', color: '#3B82F6' },
  debt: { label: 'الديون', icon: 'link-outline', color: '#F59E0B' },
};

// Expense Shortcuts
export interface ExpenseShortcut {
  id: number;
  title: string;
  amount: number;
  category: ExpenseCategory;
  currency?: string;
  description?: string;
  createdAt: string;
}

// Bills
export interface Bill {
  id: number;
  title: string;
  amount: number;
  category: BillCategory;
  dueDate: string; // ISO date string
  recurrenceType?: 'monthly' | 'yearly' | 'quarterly' | 'weekly';
  recurrenceValue?: number;
  description?: string;
  currency?: string;
  isPaid: boolean;
  paidDate?: string;
  reminderDaysBefore: number;
  image_path?: string; // Path to stored bill image
  createdAt: string;
}

export type BillCategory =
  | 'utilities'      // فواتير الخدمات
  | 'rent'           // إيجار
  | 'insurance'      // تأمين
  | 'internet'        // إنترنت
  | 'phone'          // هاتف
  | 'subscription'   // اشتراكات
  | 'loan'           // قرض
  | 'other';         // أخرى

export const BILL_CATEGORIES: Record<BillCategory, { label: string; icon: string }> = {
  utilities: { label: 'فواتير الخدمات', icon: 'flash' },
  rent: { label: 'إيجار', icon: 'home' },
  insurance: { label: 'تأمين', icon: 'shield' },
  internet: { label: 'إنترنت', icon: 'wifi' },
  phone: { label: 'هاتف', icon: 'call' },
  subscription: { label: 'اشتراكات', icon: 'card' },
  loan: { label: 'قرض', icon: 'document' },
  other: { label: 'أخرى', icon: 'ellipse' },
};

export interface BillPayment {
  id: number;
  billId: number;
  amount: number;
  paymentDate: string;
  description?: string;
  createdAt: string;
}

