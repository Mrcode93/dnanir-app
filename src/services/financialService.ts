import { getExpenses, getIncome } from '../database/database';
import { FinancialSummary, ExpenseCategory } from '../types';
import { formatCurrencyAmount } from './currencyService';
import { CURRENCIES } from '../types';
import { getAppSettings } from '../database/database';

/**
 * Get the selected currency code from settings
 */
export const getSelectedCurrencyCode = async (): Promise<string> => {
  try {
    const appSettings = await getAppSettings();
    if (appSettings?.currency) {
      const currency = CURRENCIES.find(c => c.name === appSettings.currency);
      if (currency) {
        return currency.code;
      }
    }
    // Default to IQD
    return 'IQD';
  } catch (error) {
    console.error('Error getting selected currency:', error);
    return 'IQD';
  }
};

/**
 * Format currency amount synchronously (for use in components)
 * This will use IQD as default, but components should use useCurrency hook when possible
 * @deprecated Use useCurrency hook instead
 */
export const formatCurrency = (amount: number, currencyCode: string = 'IQD'): string => {
  return formatCurrencyAmount(amount, currencyCode);
};

export const calculateFinancialSummary = async (): Promise<FinancialSummary> => {
  const expenses = await getExpenses();
  const income = await getIncome();

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Calculate expense categories
  const categoryMap = new Map<string, number>();
  expenses.forEach((expense) => {
    const current = categoryMap.get(expense.category) || 0;
    categoryMap.set(expense.category, current + expense.amount);
  });

  const topExpenseCategories = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    totalIncome,
    totalExpenses,
    balance,
    topExpenseCategories,
  };
};

export const generateFinancialInsights = (summary: FinancialSummary): string[] => {
  const insights: string[] = [];

  if (summary.balance < 0) {
    insights.push('رصيدك سالب! حاول تقليل المصاريف أو زيادة الدخل.');
  }

  if (summary.totalExpenses > summary.totalIncome * 0.8) {
    insights.push('مصاريفك عالية جداً. حاول توفر 20% على الأقل من دخلك.');
  }

  if (summary.balance > summary.totalIncome * 0.2) {
    insights.push('ممتاز! أنت موفر جيد. استمر في ذلك!');
  }

  if (summary.topExpenseCategories.length > 0) {
    const topCategory = summary.topExpenseCategories[0];
    if (topCategory.percentage > 50) {
      insights.push(`فئة "${topCategory.category}" تأخذ أكثر من 50% من مصاريفك.`);
    }
  }

  return insights;
};

export const getCurrentMonthData = async () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const allExpenses = await getExpenses();
  const allIncome = await getIncome();

  const expenses = allExpenses.filter(
    (e) => e.date >= firstDay && e.date <= lastDay
  );
  const income = allIncome.filter(
    (i) => i.date >= firstDay && i.date <= lastDay
  );

  return { expenses, income };
};

/**
 * Calculate average monthly savings based on last N months
 * @param months Number of months to analyze (default: 6)
 * @returns Average monthly savings amount
 */
export const calculateAverageMonthlySavings = async (months: number = 6): Promise<number> => {
  try {
    const allExpenses = await getExpenses();
    const allIncome = await getIncome();
    const now = new Date();
    
    // Calculate savings for each of the last N months
    const monthlySavings: number[] = [];
    
    for (let i = 0; i < months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const monthIncome = allIncome
        .filter((inc) => inc.date >= firstDay && inc.date <= lastDay)
        .reduce((sum, inc) => sum + inc.amount, 0);
      
      const monthExpenses = allExpenses
        .filter((exp) => exp.date >= firstDay && exp.date <= lastDay)
        .reduce((sum, exp) => sum + exp.amount, 0);
      
      const savings = monthIncome - monthExpenses;
      monthlySavings.push(savings);
    }
    
    // Calculate average (only from months with positive savings)
    const positiveSavings = monthlySavings.filter(s => s > 0);
    if (positiveSavings.length === 0) {
      // If no positive savings, use average of all months (could be negative)
      const avg = monthlySavings.reduce((sum, s) => sum + s, 0) / monthlySavings.length;
      return Math.max(0, avg); // Return 0 if average is negative
    }
    
    return positiveSavings.reduce((sum, s) => sum + s, 0) / positiveSavings.length;
  } catch (error) {
    console.error('Error calculating average monthly savings:', error);
    return 0;
  }
};

/**
 * Calculate estimated time to reach goal based on average monthly savings
 * @param remainingAmount Amount remaining to reach goal
 * @param averageMonthlySavings Average monthly savings amount
 * @returns Object with estimated months and formatted string
 */
export const calculateTimeToReachGoal = (
  remainingAmount: number,
  averageMonthlySavings: number
): { months: number | null; days: number | null; formatted: string } => {
  if (remainingAmount <= 0) {
    return {
      months: 0,
      days: 0,
      formatted: 'مكتمل',
    };
  }
  
  if (averageMonthlySavings <= 0) {
    return {
      months: null,
      days: null,
      formatted: 'غير متاح (لا يوجد ادخار شهري)',
    };
  }
  
  const monthsNeeded = remainingAmount / averageMonthlySavings;
  const daysNeeded = Math.ceil(monthsNeeded * 30);
  
  // Format the result
  let formatted = '';
  if (monthsNeeded < 1) {
    formatted = `~${Math.ceil(daysNeeded)} يوم`;
  } else if (monthsNeeded < 12) {
    const wholeMonths = Math.floor(monthsNeeded);
    const remainingDays = Math.ceil((monthsNeeded - wholeMonths) * 30);
    if (remainingDays > 0) {
      formatted = `${wholeMonths} شهر و ${remainingDays} يوم`;
    } else {
      formatted = `${wholeMonths} شهر`;
    }
  } else {
    const years = Math.floor(monthsNeeded / 12);
    const remainingMonths = Math.floor(monthsNeeded % 12);
    if (remainingMonths > 0) {
      formatted = `${years} سنة و ${remainingMonths} شهر`;
    } else {
      formatted = `${years} سنة`;
    }
  }
  
  return {
    months: Math.ceil(monthsNeeded),
    days: daysNeeded,
    formatted,
  };
};
