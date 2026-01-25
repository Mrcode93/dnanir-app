import { getExpenses, getIncome } from '../database/database';
import { formatCurrencyAmount } from './currencyService';
import { getSelectedCurrencyCode } from './financialService';

export interface WidgetBalanceData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  currency: string;
  lastUpdated: string;
}

export interface WidgetMonthlySummary {
  month: string;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  currency: string;
  expenseCount: number;
  incomeCount: number;
  lastUpdated: string;
}

export interface WidgetQuickAddData {
  recentCategories: Array<{
    category: string;
    label: string;
    icon: string;
    lastUsed: string;
  }>;
  recentIncomeSources: Array<{
    source: string;
    label: string;
    icon: string;
    lastUsed: string;
  }>;
  shortcuts: Array<{
    id: number;
    title: string;
    amount: number;
    type: 'expense' | 'income';
    category?: string;
    source?: string;
  }>;
  lastUpdated: string;
}

/**
 * Get balance data for Quick Balance widget
 */
export const getWidgetBalanceData = async (): Promise<WidgetBalanceData> => {
  try {
    const currency = await getSelectedCurrencyCode();
    const expenses = await getExpenses();
    const income = await getIncome();
    
    // Get current month data
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && 
             expenseDate.getFullYear() === currentYear;
    });
    
    const monthIncome = income.filter(inc => {
      const incomeDate = new Date(inc.date);
      return incomeDate.getMonth() === currentMonth && 
             incomeDate.getFullYear() === currentYear;
    });
    
    const totalExpenses = monthExpenses.reduce((sum, exp) => {
      // Convert to base currency if needed
      return sum + exp.amount;
    }, 0);
    
    const totalIncome = monthIncome.reduce((sum, inc) => {
      return sum + inc.amount;
    }, 0);
    
    const balance = totalIncome - totalExpenses;
    
    return {
      totalIncome,
      totalExpenses,
      balance,
      currency,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting widget balance data:', error);
    return {
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      currency: 'IQD',
      lastUpdated: new Date().toISOString(),
    };
  }
};

/**
 * Get monthly summary data for Monthly Summary widget
 */
export const getWidgetMonthlySummary = async (): Promise<WidgetMonthlySummary> => {
  try {
    const currency = await getSelectedCurrencyCode();
    const expenses = await getExpenses();
    const income = await getIncome();
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === currentMonth && 
             expenseDate.getFullYear() === currentYear;
    });
    
    const monthIncome = income.filter(inc => {
      const incomeDate = new Date(inc.date);
      return incomeDate.getMonth() === currentMonth && 
             incomeDate.getFullYear() === currentYear;
    });
    
    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalIncome = monthIncome.reduce((sum, inc) => sum + inc.amount, 0);
    const balance = totalIncome - totalExpenses;
    
    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    return {
      month: monthNames[currentMonth],
      year: currentYear,
      totalIncome,
      totalExpenses,
      balance,
      currency,
      expenseCount: monthExpenses.length,
      incomeCount: monthIncome.length,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting widget monthly summary:', error);
    const now = new Date();
    const monthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return {
      month: monthNames[now.getMonth()],
      year: now.getFullYear(),
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      currency: 'IQD',
      expenseCount: 0,
      incomeCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
};

/**
 * Update widget data (to be called from native modules)
 * This will be implemented in native code to update widgets
 */
export const updateWidgets = async (): Promise<void> => {
  try {
    const balanceData = await getWidgetBalanceData();
    const monthlySummary = await getWidgetMonthlySummary();
    const quickAddData = await getWidgetQuickAddData();
    
    // Store data in shared storage for widgets to access
    // This will be implemented via native modules
    if (typeof window !== 'undefined' && (window as any).NativeModules?.WidgetModule) {
      const { NativeModules } = require('react-native');
      NativeModules.WidgetModule.updateWidgetData({
        balance: balanceData,
        monthlySummary: monthlySummary,
        quickAdd: quickAddData,
      });
    }
  } catch (error) {
    console.error('Error updating widgets:', error);
  }
};

/**
 * Get quick add data for Quick Add Expense/Income widget
 */
export const getWidgetQuickAddData = async (): Promise<WidgetQuickAddData> => {
  try {
    const dbModule = await import('../database/database');
    const { getExpenseShortcuts, getIncomeShortcuts } = dbModule;
    const { EXPENSE_CATEGORIES } = await import('../types');
    const { INCOME_SOURCES } = await import('../types');
    
    const expenseShortcuts = await getExpenseShortcuts();
    const incomeShortcuts = await getIncomeShortcuts();
    
    // Get recent categories from expenses
    const { getExpenses } = await import('../database/database');
    const expenses = await getExpenses();
    const categoryUsage = new Map<string, { count: number; lastUsed: string }>();
    
    expenses.forEach(exp => {
      const existing = categoryUsage.get(exp.category);
      if (!existing || exp.date > existing.lastUsed) {
        categoryUsage.set(exp.category, {
          count: (existing?.count || 0) + 1,
          lastUsed: exp.date,
        });
      }
    });
    
    // Get recent income sources
    const { getIncome } = await import('../database/database');
    const income = await getIncome();
    const sourceUsage = new Map<string, { count: number; lastUsed: string }>();
    
    income.forEach(inc => {
      const existing = sourceUsage.get(inc.source);
      if (!existing || inc.date > existing.lastUsed) {
        sourceUsage.set(inc.source, {
          count: (existing?.count || 0) + 1,
          lastUsed: inc.date,
        });
      }
    });
    
    // Get top 5 most used categories
    const recentCategories = Array.from(categoryUsage.entries())
      .sort((a, b) => {
        if (b[1].lastUsed !== a[1].lastUsed) {
          return b[1].lastUsed.localeCompare(a[1].lastUsed);
        }
        return b[1].count - a[1].count;
      })
      .slice(0, 5)
      .map(([category, data]) => {
        const categoryKey = Object.keys(EXPENSE_CATEGORIES).find(
          key => EXPENSE_CATEGORIES[key as any] === category || key === category
        );
        const label = EXPENSE_CATEGORIES[categoryKey as any] || category;
        
        const categoryIcons: Record<string, string> = {
          food: 'restaurant',
          transport: 'car',
          shopping: 'bag',
          bills: 'receipt',
          entertainment: 'musical-notes',
          health: 'medical',
          education: 'school',
          other: 'ellipse',
        };
        
        return {
          category,
          label,
          icon: categoryIcons[categoryKey || 'other'] || 'ellipse',
          lastUsed: data.lastUsed,
        };
      });
    
    // Get top 5 most used income sources
    const recentIncomeSources = Array.from(sourceUsage.entries())
      .sort((a, b) => {
        if (b[1].lastUsed !== a[1].lastUsed) {
          return b[1].lastUsed.localeCompare(a[1].lastUsed);
        }
        return b[1].count - a[1].count;
      })
      .slice(0, 5)
      .map(([source, data]) => {
        const sourceKey = Object.keys(INCOME_SOURCES).find(
          key => INCOME_SOURCES[key as any] === source || key === source
        );
        const label = INCOME_SOURCES[sourceKey as any] || source;
        
        const sourceIcons: Record<string, string> = {
          salary: 'cash',
          business: 'briefcase',
          investment: 'trending-up',
          gift: 'gift',
          other: 'ellipse',
        };
        
        return {
          source,
          label,
          icon: sourceIcons[sourceKey || 'other'] || 'trending-up',
          lastUsed: data.lastUsed,
        };
      });
    
    // Combine shortcuts
    const shortcuts = [
      ...expenseShortcuts.slice(0, 3).map((s: any) => ({
        id: s.id,
        title: s.title,
        amount: s.amount,
        type: 'expense' as const,
        category: s.category,
      })),
      ...incomeShortcuts.slice(0, 3).map((s: any) => ({
        id: s.id,
        title: s.source,
        amount: s.amount,
        type: 'income' as const,
        source: s.source,
      })),
    ];
    
    return {
      recentCategories,
      recentIncomeSources,
      shortcuts,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting widget quick add data:', error);
    return {
      recentCategories: [],
      recentIncomeSources: [],
      shortcuts: [],
      lastUpdated: new Date().toISOString(),
    };
  }
};

/**
 * Format currency for widget display
 */
export const formatWidgetCurrency = (amount: number, currency: string): string => {
  return formatCurrencyAmount(amount, currency);
};
