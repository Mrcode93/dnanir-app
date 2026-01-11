import { getExpenses, getIncome } from '../database/database';
import { Expense, Income, ReportFilter } from '../types';
import { formatCurrency } from './financialService';

/**
 * Get filtered expenses based on report filters
 */
export const getFilteredExpenses = async (filter: ReportFilter): Promise<Expense[]> => {
  const allExpenses = await getExpenses();
  
  return allExpenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    
    // Date filter
    if (filter.startDate) {
      const startDate = new Date(filter.startDate);
      if (expenseDate < startDate) return false;
    }
    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (expenseDate > endDate) return false;
    }
    
    // Category filter
    if (filter.categories && filter.categories.length > 0) {
      if (!filter.categories.includes(expense.category)) return false;
    }
    
    // Amount filter
    if (filter.minAmount !== undefined && expense.amount < filter.minAmount) {
      return false;
    }
    if (filter.maxAmount !== undefined && expense.amount > filter.maxAmount) {
      return false;
    }
    
    return true;
  });
};

/**
 * Get filtered income based on report filters
 */
export const getFilteredIncome = async (filter: ReportFilter): Promise<Income[]> => {
  const allIncome = await getIncome();
  
  return allIncome.filter(income => {
    const incomeDate = new Date(income.date);
    
    // Date filter
    if (filter.startDate) {
      const startDate = new Date(filter.startDate);
      if (incomeDate < startDate) return false;
    }
    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (incomeDate > endDate) return false;
    }
    
    // Source filter
    if (filter.incomeSources && filter.incomeSources.length > 0) {
      if (!filter.incomeSources.includes(income.source)) return false;
    }
    
    // Amount filter
    if (filter.minAmount !== undefined && income.amount < filter.minAmount) {
      return false;
    }
    if (filter.maxAmount !== undefined && income.amount > filter.maxAmount) {
      return false;
    }
    
    return true;
  });
};

/**
 * Generate advanced report data
 */
export interface AdvancedReportData {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactionCount: number;
  };
  expenses: Expense[];
  income: Income[];
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }[];
  dailyBreakdown: {
    date: string;
    income: number;
    expenses: number;
    balance: number;
  }[];
  topExpenses: Expense[];
  topIncome: Income[];
}

export const generateAdvancedReport = async (
  filter: ReportFilter
): Promise<AdvancedReportData> => {
  const expenses = await getFilteredExpenses(filter);
  const income = await getFilteredIncome(filter);
  
  const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const balance = totalIncome - totalExpenses;
  
  // Category breakdown
  const categoryMap = new Map<string, { amount: number; count: number }>();
  expenses.forEach(exp => {
    const existing = categoryMap.get(exp.category) || { amount: 0, count: 0 };
    categoryMap.set(exp.category, {
      amount: existing.amount + exp.amount,
      count: existing.count + 1,
    });
  });
  
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);
  
  // Daily breakdown
  const dailyMap = new Map<string, { income: number; expenses: number }>();
  
  income.forEach(inc => {
    const date = inc.date.split('T')[0];
    const existing = dailyMap.get(date) || { income: 0, expenses: 0 };
    dailyMap.set(date, { ...existing, income: existing.income + inc.amount });
  });
  
  expenses.forEach(exp => {
    const date = exp.date.split('T')[0];
    const existing = dailyMap.get(date) || { income: 0, expenses: 0 };
    dailyMap.set(date, { ...existing, expenses: existing.expenses + exp.amount });
  });
  
  const dailyBreakdown = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      income: data.income,
      expenses: data.expenses,
      balance: data.income - data.expenses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Top expenses and income
  const topExpenses = [...expenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  
  const topIncome = [...income]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  
  return {
    summary: {
      totalIncome,
      totalExpenses,
      balance,
      transactionCount: expenses.length + income.length,
    },
    expenses,
    income,
    categoryBreakdown,
    dailyBreakdown,
    topExpenses,
    topIncome,
  };
};

/**
 * Export report to CSV format
 */
export const exportReportToCSV = async (filter: ReportFilter): Promise<string> => {
  const report = await generateAdvancedReport(filter);
  
  let csv = 'التاريخ,النوع,الوصف,الفئة/المصدر,المبلغ\n';
  
  // Add expenses
  report.expenses.forEach(exp => {
    csv += `${exp.date},مصروف,${exp.title},${exp.category},${exp.amount}\n`;
  });
  
  // Add income
  report.income.forEach(inc => {
    csv += `${inc.date},دخل,${inc.source},${inc.source},${inc.amount}\n`;
  });
  
  return csv;
};
