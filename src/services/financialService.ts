import { FinancialSummary, ExpenseCategory, FinancialInsight, EXPENSE_CATEGORIES } from '../types';
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

/**
 * Get unpaid bills due within [startDate, endDate] and their total amount
 */
export const getBillsDueInPeriod = async (
  startDate: string,
  endDate: string
): Promise<{ bills: Array<{ id: number; title: string; amount: number; dueDate: string; category: string }>; totalAmount: number }> => {
  const { getBillsDueInRange } = await import('../database/database');
  const bills = await getBillsDueInRange(startDate, endDate);
  const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
  return { bills, totalAmount };
};

/**
 * Estimate total recurring expenses amount for a given month (active recurring only)
 */
export const getRecurringEstimatedForMonth = async (year: number, month: number): Promise<number> => {
  const { getRecurringExpenses } = await import('../database/database');
  const list = await getRecurringExpenses(true);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  let total = 0;
  for (const r of list) {
    const start = r.startDate ? new Date(r.startDate) : null;
    const end = r.endDate ? new Date(r.endDate) : null;
    if (start && lastDay < start) continue;
    if (end && firstDay > end) continue;
    const type = (r.recurrenceType || 'monthly').toLowerCase();
    const val = Math.max(1, r.recurrenceValue || 1);
    if (type === 'monthly') total += r.amount / val; // e.g. every 2 months => amount/2 per month
    else if (type === 'weekly') total += (r.amount * (30 / 7)) / val;
    else if (type === 'daily') total += (r.amount * 30) / val;
    else if (type === 'yearly') total += (r.amount * val) / 12;
    else total += r.amount;
  }
  return Math.round(total);
};

export const calculateFinancialSummary = async (): Promise<FinancialSummary> => {
  const { getFinancialStatsAggregated, getExpensesByCategoryAggregated } = await import('../database/database');

  const stats = await getFinancialStatsAggregated();
  const categories = await getExpensesByCategoryAggregated();

  const topExpenseCategories = categories
    .map((item) => ({
      category: item.category,
      amount: item.amount,
      percentage: stats.totalExpenses > 0 ? (item.amount / stats.totalExpenses) * 100 : 0,
    }))
    .slice(0, 5);

  return {
    totalIncome: stats.totalIncome,
    totalExpenses: stats.totalExpenses,
    balance: stats.balance,
    topExpenseCategories,
  };
};

export const generateFinancialInsights = (summary: FinancialSummary): FinancialInsight[] => {
  const insights: FinancialInsight[] = [];
  const savingsRate = summary.totalIncome > 0 ? (summary.balance / summary.totalIncome) * 100 : 0;
  const expenseRate = summary.totalIncome > 0 ? (summary.totalExpenses / summary.totalIncome) * 100 : 0;

  // Balance & Savings Insights
  if (summary.balance < 0) {
    insights.push({
      type: 'warning',
      title: 'تنبيه العجز المالي',
      content: 'إجمالي المصاريف يتجاوز الدخل هذا الشهر. راجع نفقاتك فوراً لتجنب الديون المتراكمة.'
    });
  } else if (savingsRate >= 30) {
    insights.push({
      type: 'success',
      title: 'أداء مالي استثنائي',
      content: 'أنت تدخر أكثر من 30% من دخلك. هذا معدل ممتاز جداً يساعدك في بناء ثروتك بسرعة.'
    });
  } else if (savingsRate >= 20) {
    insights.push({
      type: 'success',
      title: 'استقرار مالي جيد',
      content: 'اتزانك بين الصرف والادخار ممتاز. استمر على معدل ادخار 20% لضمان أمانك المالي.'
    });
  } else if (savingsRate > 0 && savingsRate < 10) {
    insights.push({
      type: 'info',
      title: 'فرصة لزيادة الادخار',
      content: 'لديك فائض بسيط. حاول تقليص المصاريف غير الضرورية لرفع معدل ادخارك إلى 15%.'
    });
  }

  // Expense Analysis
  if (expenseRate > 90) {
    insights.push({
      type: 'warning',
      title: 'معدل إنفاق مرتفع',
      content: 'المصاريف تستهلك معظم دخلك. طبق قاعدة 50/30/20 (احتياجات، رغبات، ادخار) لتحسين وضعك.'
    });
  }

  // Category Insights
  if (summary.topExpenseCategories && summary.topExpenseCategories.length > 0) {
    const topCategory = summary.topExpenseCategories[0];
    const categoryName = EXPENSE_CATEGORIES[topCategory.category as keyof typeof EXPENSE_CATEGORIES] || topCategory.category;

    if (topCategory.percentage > 40) {
      insights.push({
        type: 'info',
        title: 'تركيز الإنفاق',
        content: `إنفاقك على "${categoryName}" يمثل ${topCategory.percentage.toFixed(0)}% من ميزانيتك. فكر في بدائل لتقليل هذا البند.`
      });
    } else if (topCategory.percentage > 25) {
      insights.push({
        type: 'tip',
        title: 'تحليل الفئات',
        content: `تعتبر "${categoryName}" هي الأعلى إنفاقاً حالياً. مراقبة هذه الفئة ستمنحك تحكماً أكبر بالسيولة.`
      });
    }
  }

  // General Pro Advice
  const proTips: FinancialInsight[] = [
    {
      type: 'tip',
      title: 'نصيحة احترافية',
      content: 'تسجيل المصاريف لحظة وقوعها يمنع تسرب الأموال في بنود غير محسوبة ويمنحك رؤية واقعية.'
    },
    {
      type: 'goal',
      title: 'بناء الأمان المالي',
      content: 'احرص على بناء صندوق طوارئ يغطي مصاريف 3 أشهر قبل التوسع في الاستثمارات عالية المخاطر.'
    },
    {
      type: 'tip',
      title: 'تحسين الاشتراكات',
      content: 'راجع الاشتراكات الشهرية التلقائية؛ الغاء خدمة واحدة لا تستخدمها يوفر لك مبلغاً تراكمياً جيداً.'
    },
    {
      type: 'info',
      title: 'قوة الادخار التراكمي',
      content: 'ادخار مبلغ بسيط شهرياً بشكل مستمر أفضل من ادخار مبالغ كبيرة بشكل متقطع.'
    },
  ];

  // Add 1-2 random pro tips to keep the insights varied
  const shuffled = proTips.sort(() => 0.5 - Math.random());
  insights.push(...shuffled.slice(0, 1));

  return insights;
};

export const getCurrentMonthData = async () => {
  const now = new Date();
  return getMonthData(now.getFullYear(), now.getMonth() + 1);
};

/**
 * Calculate average monthly savings based on last N months
 * @param months Number of months to analyze (default: 6)
 * @returns Average monthly savings amount
 */
export const calculateAverageMonthlySavings = async (months: number = 6): Promise<number> => {
  try {
    const now = new Date();

    // Calculate savings for each of the last N months
    const monthlySavings: number[] = [];

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth(); // 0-indexed

      const firstDay = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      const lastDayObj = new Date(year, month + 1, 0);
      const lastDay = `${year}-${(month + 1).toString().padStart(2, '0')}-${lastDayObj.getDate().toString().padStart(2, '0')}`;

      const { getFinancialStatsAggregated } = await import('../database/database');
      const stats = await getFinancialStatsAggregated(firstDay, lastDay);

      monthlySavings.push(stats.balance);
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
 * Get data for a specific month (includes expenses, income, and bills/recurring due in that month).
 * For the current month, "bills due" = unpaid bills from today through end of next month (all upcoming).
 * For past months, "bills due" = unpaid bills with due date within that month only.
 */
export const getMonthData = async (year: number, month: number) => {
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const lastDayObj = new Date(year, month, 0);
  const firstDay = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = `${year}-${month.toString().padStart(2, '0')}-${lastDayObj.getDate().toString().padStart(2, '0')}`;

  // Bills due: for current month show all upcoming (today → end of next month); for past months use that month only
  let billsStart = firstDay;
  let billsEnd = lastDay;
  if (isCurrentMonth) {
    const today = now.toISOString().slice(0, 10);
    const nextMonth = now.getMonth() + 2;
    const nextYear = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
    const nextMonthNum = nextMonth > 12 ? 1 : nextMonth;
    const lastDayNext = new Date(nextYear, nextMonthNum, 0);
    billsStart = today;
    billsEnd = `${nextYear}-${nextMonthNum.toString().padStart(2, '0')}-${lastDayNext.getDate().toString().padStart(2, '0')}`;
  }

  const { getExpensesByRange, getIncomeByRange, getFinancialStatsAggregated, getExpensesByCategoryAggregated } = await import('../database/database');

  const [expenses, income, stats, categories, billsDueResult, recurringTotal] = await Promise.all([
    getExpensesByRange(firstDay, lastDay),
    getIncomeByRange(firstDay, lastDay),
    getFinancialStatsAggregated(firstDay, lastDay),
    getExpensesByCategoryAggregated(firstDay, lastDay),
    getBillsDueInPeriod(billsStart, billsEnd),
    getRecurringEstimatedForMonth(year, month),
  ]);

  const topExpenseCategories = categories.map((item) => ({
    category: item.category,
    amount: item.amount,
    percentage: stats.totalExpenses > 0 ? (item.amount / stats.totalExpenses) * 100 : 0,
  }));

  return {
    expenses,
    income,
    totalIncome: stats.totalIncome,
    totalExpenses: stats.totalExpenses,
    balance: stats.balance,
    topExpenseCategories,
    billsDueInPeriod: billsDueResult.bills,
    billsDueTotal: billsDueResult.totalAmount,
    recurringEstimatedTotal: recurringTotal,
    /** Total expected outflows this month (expenses + unpaid bills due + recurring) */
    totalObligations: stats.totalExpenses + billsDueResult.totalAmount + recurringTotal,
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

    // Use Promise.all to fetch data for all months in parallel for better performance
    const promises = [];
    const { getExpensesByRange } = await import('../database/database');

    for (let i = 0; i < monthsToAnalyze; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const lastDayObj = new Date(year, month + 1, 0);

      const firstDay = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      const lastDay = `${year}-${(month + 1).toString().padStart(2, '0')}-${lastDayObj.getDate().toString().padStart(2, '0')}`;

      // Push the promise immediately
      promises.push(
        getExpensesByRange(firstDay, lastDay).then(monthExpenses => {
          const total = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
          const byCategory = new Map<string, number>();

          monthExpenses.forEach((exp) => {
            const current = byCategory.get(exp.category) || 0;
            byCategory.set(exp.category, current + exp.amount);
          });

          return {
            month: `${year}-${month + 1}`,
            total,
            byCategory
          };
        })
      );
    }

    const monthlyExpenses = await Promise.all(promises);

    if (monthlyExpenses.length === 0) {
      return {
        predictedTotal: 0,
        predictedByCategory: [],
        confidence: 'low',
      };
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
    const coefficientOfVariation = avgTotal > 0 ? stdDev / avgTotal : 0; // Prevent division by zero

    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (coefficientOfVariation < 0.15 && monthlyExpenses.length >= 3) {
      confidence = 'high';
    } else if (coefficientOfVariation > 0.3 || monthlyExpenses.length < 2) {
      confidence = 'low';
    }

    // Add next month's bills and recurring to prediction
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth() + 1;
    const lastDayNext = new Date(nextYear, nextMonth, 0);
    const firstDayNext = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
    const lastDayNextStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-${lastDayNext.getDate().toString().padStart(2, '0')}`;
    const [billsNext, recurringNext] = await Promise.all([
      getBillsDueInPeriod(firstDayNext, lastDayNextStr),
      getRecurringEstimatedForMonth(nextYear, nextMonth),
    ]);
    const basePredicted = Math.round(avgTotal);
    const withBillsAndRecurring = basePredicted + billsNext.totalAmount + recurringNext;

    const categoryList = predictedByCategory.sort((a, b) => b.amount - a.amount);
    if (billsNext.totalAmount > 0) {
      categoryList.push({ category: 'فواتير', amount: billsNext.totalAmount });
    }
    if (recurringNext > 0) {
      categoryList.push({ category: 'مصروفات دورية', amount: recurringNext });
    }

    return {
      predictedTotal: withBillsAndRecurring,
      predictedByCategory: categoryList.sort((a, b) => b.amount - a.amount),
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


    const { getExpensesByRange, getIncomeByRange } = await import('../database/database');
    const promises = [];

    for (let i = 0; i < months; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const lastDayObj = new Date(year, month + 1, 0);

      const firstDay = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      const lastDay = `${year}-${(month + 1).toString().padStart(2, '0')}-${lastDayObj.getDate().toString().padStart(2, '0')}`;

      // Create a promise for this month's data
      const monthPromise = Promise.all([
        getExpensesByRange(firstDay, lastDay),
        getIncomeByRange(firstDay, lastDay)
      ]).then(([expenses, income]) => {
        const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

        return {
          month: monthNames[month],
          year: year,
          monthNumber: month + 1,
          totalIncome,
          totalExpenses,
          balance: totalIncome - totalExpenses,
        };
      });

      promises.push(monthPromise);
    }

    const results = await Promise.all(promises);
    return results.reverse(); // Reverse to show oldest first

    return trendData.reverse(); // Reverse to show oldest first
  } catch (error) {
    console.error('Error getting monthly trend data:', error);
    return [];
  }
};
