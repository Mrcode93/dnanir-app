import { Expense, Income, FinancialSummary, ExpenseCategory } from '../types';
import { getExpenses, getIncome } from '../database/database';

export const calculateFinancialSummary = async (): Promise<FinancialSummary> => {
  const expenses = await getExpenses();
  const income = await getIncome();

  const totalIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Calculate category distribution
  const categoryTotals: Record<string, number> = {};
  expenses.forEach(expense => {
    categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
  });

  const topExpenseCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return {
    totalIncome,
    totalExpenses,
    balance,
    topExpenseCategories
  };
};

export const generateFinancialInsights = (summary: FinancialSummary): string[] => {
  const insights: string[] = [];
  const { totalIncome, totalExpenses, balance, topExpenseCategories } = summary;

  // Balance insights
  if (balance > 0) {
    insights.push(`💰 ممتاز! عندك رصيد إيجابي: ${balance.toLocaleString()} دينار`);
  } else if (balance < 0) {
    insights.push(`⚠️ انتبه! مصاريفك أكثر من دخلك بـ ${Math.abs(balance).toLocaleString()} دينار`);
  } else {
    insights.push(`⚖️ دخل ومصاريف متوازنة تماماً!`);
  }

  // Expense ratio insights
  if (totalIncome > 0) {
    const expenseRatio = (totalExpenses / totalIncome) * 100;
    if (expenseRatio > 90) {
      insights.push(`🚨 مصاريفك تشكل ${expenseRatio.toFixed(1)}% من دخلك - خليك حذر!`);
    } else if (expenseRatio > 80) {
      insights.push(`⚠️ مصاريفك تشكل ${expenseRatio.toFixed(1)}% من دخلك - حاول توفر شوية`);
    } else if (expenseRatio < 50) {
      insights.push(`🎉 ممتاز! مصاريفك بس ${expenseRatio.toFixed(1)}% من دخلك - أنت موفر حقيقي!`);
    }
  }

  // Top category insights
  if (topExpenseCategories.length > 0) {
    const topCategory = topExpenseCategories[0];
    if (topCategory.percentage > 50) {
      insights.push(`📊 فئة "${topCategory.category}" تشكل ${topCategory.percentage.toFixed(1)}% من مصاريفك - راجعها!`);
    }
  }

  // Savings suggestions
  if (balance < totalIncome * 0.1) {
    insights.push(`💡 نصيحة: حاول توفر على الأقل 10% من دخلك شهرياً`);
  }

  return insights;
};

export const formatCurrency = (amount: number): string => {
  // Format with RTL-friendly currency display
  const formattedAmount = amount.toLocaleString('ar-IQ');
  return `${formattedAmount} دينار`;
};

export const getCurrentMonthData = async () => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const expenses = await getExpenses();
  const income = await getIncome();

  const currentMonthExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
  });

  const currentMonthIncome = income.filter(incomeItem => {
    const incomeDate = new Date(incomeItem.date);
    return incomeDate.getMonth() === currentMonth && incomeDate.getFullYear() === currentYear;
  });

  return {
    expenses: currentMonthExpenses,
    income: currentMonthIncome
  };
};
