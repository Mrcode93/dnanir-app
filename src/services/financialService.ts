import { getExpenses, getIncome } from '../database/database';
import { FinancialSummary, ExpenseCategory } from '../types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
