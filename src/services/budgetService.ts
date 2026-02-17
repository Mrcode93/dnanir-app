import { getBudgets, getBudget, Budget, getExpenses } from '../database/database';
import { getCurrentMonthData } from './financialService';
import { EXPENSE_CATEGORIES } from '../types';

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  isExceeded: boolean;
}

export const getCurrentMonthBudgets = async (): Promise<Budget[]> => {
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear();
  return await getBudgets(month, year);
};

export const calculateBudgetStatus = async (): Promise<BudgetStatus[]> => {
  const budgets = await getCurrentMonthBudgets();
  const monthlyData = await getCurrentMonthData();

  const statuses: BudgetStatus[] = [];

  for (const budget of budgets) {
    const categoryExpenses = monthlyData.expenses.filter(
      (expense) => {
        const expenseCat = expense.category;
        const budgetCat = budget.category;

        // Direct match
        if (expenseCat === budgetCat) return true;

        // Match English budget category with Arabic expense category
        if (EXPENSE_CATEGORIES[budgetCat as keyof typeof EXPENSE_CATEGORIES] === expenseCat) return true;

        // Match Arabic budget category with English expense category
        if (EXPENSE_CATEGORIES[expenseCat as keyof typeof EXPENSE_CATEGORIES] === budgetCat) return true;

        return false;
      }
    );

    const spent = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const remaining = budget.amount - spent;
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    const isExceeded = spent > budget.amount;

    statuses.push({
      budget,
      spent,
      remaining,
      percentage,
      isExceeded,
    });
  }

  return statuses;
};

export const getTotalBudget = async (): Promise<number> => {
  const budgets = await getCurrentMonthBudgets();
  return budgets.reduce((sum, budget) => sum + budget.amount, 0);
};

export const getTotalSpent = async (): Promise<number> => {
  const monthlyData = await getCurrentMonthData();
  return monthlyData.expenses.reduce((sum, expense) => sum + expense.amount, 0);
};
