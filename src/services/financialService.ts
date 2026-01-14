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

/**
 * Get data for a specific month
 */
export const getMonthData = async (year: number, month: number) => {
  const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

  const allExpenses = await getExpenses();
  const allIncome = await getIncome();

  const expenses = allExpenses.filter(
    (e) => e.date >= firstDay && e.date <= lastDay
  );
  const income = allIncome.filter(
    (i) => i.date >= firstDay && i.date <= lastDay
  );

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
    .sort((a, b) => b.amount - a.amount);

  return {
    expenses,
    income,
    totalIncome,
    totalExpenses,
    balance,
    topExpenseCategories,
  };
};

/**
 * Compare two periods (months)
 */
export const comparePeriods = async (
  period1: { year: number; month: number },
  period2: { year: number; month: number }
) => {
  const data1 = await getMonthData(period1.year, period1.month);
  const data2 = await getMonthData(period2.year, period2.month);

  const incomeChange = data2.totalIncome - data1.totalIncome;
  const incomeChangePercent =
    data1.totalIncome > 0
      ? ((incomeChange / data1.totalIncome) * 100).toFixed(1)
      : '0';

  const expensesChange = data2.totalExpenses - data1.totalExpenses;
  const expensesChangePercent =
    data1.totalExpenses > 0
      ? ((expensesChange / data1.totalExpenses) * 100).toFixed(1)
      : '0';

  const balanceChange = data2.balance - data1.balance;
  const balanceChangePercent =
    data1.balance !== 0
      ? ((balanceChange / Math.abs(data1.balance)) * 100).toFixed(1)
      : '0';

  // Compare categories
  const categoryComparison: Array<{
    category: string;
    period1: number;
    period2: number;
    change: number;
    changePercent: string;
  }> = [];

  const allCategories = new Set([
    ...data1.topExpenseCategories.map((c) => c.category),
    ...data2.topExpenseCategories.map((c) => c.category),
  ]);

  allCategories.forEach((category) => {
    const cat1 = data1.topExpenseCategories.find((c) => c.category === category);
    const cat2 = data2.topExpenseCategories.find((c) => c.category === category);
    const amount1 = cat1?.amount || 0;
    const amount2 = cat2?.amount || 0;
    const change = amount2 - amount1;
    const changePercent =
      amount1 > 0 ? ((change / amount1) * 100).toFixed(1) : '0';

    categoryComparison.push({
      category,
      period1: amount1,
      period2: amount2,
      change,
      changePercent,
    });
  });

  return {
    period1: {
      ...data1,
      label: `${period1.year}/${period1.month}`,
    },
    period2: {
      ...data2,
      label: `${period2.year}/${period2.month}`,
    },
    incomeChange,
    incomeChangePercent,
    expensesChange,
    expensesChangePercent,
    balanceChange,
    balanceChangePercent,
    categoryComparison: categoryComparison.sort(
      (a, b) => Math.abs(b.change) - Math.abs(a.change)
    ),
  };
};

/**
 * Predict next month's expenses based on historical data
 */
export const predictNextMonthExpenses = async (monthsToAnalyze: number = 3): Promise<{
  predictedTotal: number;
  predictedByCategory: Array<{ category: string; amount: number }>;
  confidence: 'high' | 'medium' | 'low';
}> => {
  try {
    const now = new Date();
    const allExpenses = await getExpenses();
    
    // Get expenses for last N months
    const monthlyExpenses: Array<{ month: string; total: number; byCategory: Map<string, number> }> = [];
    
    for (let i = 0; i < monthsToAnalyze; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const monthExpenses = allExpenses.filter(
        (e) => e.date >= firstDay && e.date <= lastDay
      );
      
      const total = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const byCategory = new Map<string, number>();
      
      monthExpenses.forEach((exp) => {
        const current = byCategory.get(exp.category) || 0;
        byCategory.set(exp.category, current + exp.amount);
      });
      
      monthlyExpenses.push({
        month: `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`,
        total,
        byCategory,
      });
    }
    
    // Calculate average
    const avgTotal = monthlyExpenses.reduce((sum, m) => sum + m.total, 0) / monthlyExpenses.length;
    
    // Calculate average by category
    const categoryTotals = new Map<string, number[]>();
    monthlyExpenses.forEach((month) => {
      month.byCategory.forEach((amount, category) => {
        if (!categoryTotals.has(category)) {
          categoryTotals.set(category, []);
        }
        categoryTotals.get(category)!.push(amount);
      });
    });
    
    const predictedByCategory = Array.from(categoryTotals.entries()).map(([category, amounts]) => {
      const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      return { category, amount: Math.round(avg) };
    });
    
    // Determine confidence based on data consistency
    const totals = monthlyExpenses.map(m => m.total);
    const variance = totals.reduce((sum, t) => sum + Math.pow(t - avgTotal, 2), 0) / totals.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgTotal;
    
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (coefficientOfVariation < 0.15) {
      confidence = 'high';
    } else if (coefficientOfVariation > 0.3) {
      confidence = 'low';
    }
    
    return {
      predictedTotal: Math.round(avgTotal),
      predictedByCategory: predictedByCategory.sort((a, b) => b.amount - a.amount),
      confidence,
    };
  } catch (error) {
    console.error('Error predicting next month expenses:', error);
    return {
      predictedTotal: 0,
      predictedByCategory: [],
      confidence: 'low',
    };
  }
};

/**
 * Get monthly trend data for the last N months
 */
export const getMonthlyTrendData = async (months: number = 6): Promise<Array<{
  month: string;
  year: number;
  monthNumber: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}>> => {
  try {
    const now = new Date();
    const trendData: Array<{
      month: string;
      year: number;
      monthNumber: number;
      totalIncome: number;
      totalExpenses: number;
      balance: number;
    }> = [];
    
    const allExpenses = await getExpenses();
    const allIncome = await getIncome();
    
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
      
      const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      
      trendData.push({
        month: monthNames[monthDate.getMonth()],
        year: monthDate.getFullYear(),
        monthNumber: monthDate.getMonth() + 1,
        totalIncome: monthIncome,
        totalExpenses: monthExpenses,
        balance: monthIncome - monthExpenses,
      });
    }
    
    return trendData.reverse(); // Reverse to show oldest first
  } catch (error) {
    console.error('Error getting monthly trend data:', error);
    return [];
  }
};
