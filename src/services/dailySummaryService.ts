import { getExpensesByDateRange, getIncomeByDateRange } from '../database/database';
import NotificationService from './notificationService';

interface DailySummary {
  date: string;
  totalExpenses: number;
  totalIncome: number;
  netAmount: number;
  expenseCount: number;
  incomeCount: number;
  topExpenseCategory: string;
  topIncomeSource: string;
}

class DailySummaryService {
  private static instance: DailySummaryService;
  private notificationService: NotificationService;

  private constructor() {
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): DailySummaryService {
    if (!DailySummaryService.instance) {
      DailySummaryService.instance = new DailySummaryService();
    }
    return DailySummaryService.instance;
  }

  // Generate daily summary for a specific date
  async generateDailySummary(date: string): Promise<DailySummary> {
    try {
      // Get expenses for the day
      const expenses = await getExpensesByDateRange(date, date);
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const expenseCount = expenses.length;

      // Get income for the day
      const income = await getIncomeByDateRange(date, date);
      const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
      const incomeCount = income.length;

      // Calculate net amount
      const netAmount = totalIncome - totalExpenses;

      // Find top expense category
      const expenseCategories = expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);
      const topExpenseCategory = Object.keys(expenseCategories).reduce((a, b) => 
        expenseCategories[a] > expenseCategories[b] ? a : b, 'لا يوجد'
      );

      // Find top income source
      const incomeSources = income.reduce((acc, inc) => {
        acc[inc.source] = (acc[inc.source] || 0) + inc.amount;
        return acc;
      }, {} as Record<string, number>);
      const topIncomeSource = Object.keys(incomeSources).reduce((a, b) => 
        incomeSources[a] > incomeSources[b] ? a : b, 'لا يوجد'
      );

      return {
        date,
        totalExpenses,
        totalIncome,
        netAmount,
        expenseCount,
        incomeCount,
        topExpenseCategory,
        topIncomeSource,
      };
    } catch (error) {
      console.error('Error generating daily summary:', error);
      throw error;
    }
  }

  // Send daily summary notification
  async sendDailySummaryNotification(date: string): Promise<void> {
    try {
      const summary = await this.generateDailySummary(date);
      
      // Create notification message based on summary
      let title = 'ملخص يومي - دنانير';
      let body = '';
      
      if (summary.expenseCount === 0 && summary.incomeCount === 0) {
        body = 'لم تسجل أي معاملات مالية اليوم 📝';
      } else {
        const isPositive = summary.netAmount >= 0;
        const emoji = isPositive ? '📈' : '📉';
        const netText = isPositive 
          ? `رصيد إيجابي: +${summary.netAmount} دينار`
          : `رصيد سلبي: ${summary.netAmount} دينار`;
        
        body = `${netText} ${emoji}\n`;
        body += `المصروفات: ${summary.totalExpenses} دينار (${summary.expenseCount} معاملة)\n`;
        body += `الدخل: ${summary.totalIncome} دينار (${summary.incomeCount} معاملة)`;
        
        if (summary.topExpenseCategory !== 'لا يوجد') {
          body += `\nأعلى فئة مصروف: ${summary.topExpenseCategory}`;
        }
        if (summary.topIncomeSource !== 'لا يوجد') {
          body += `\nأعلى مصدر دخل: ${summary.topIncomeSource}`;
        }
      }

      await this.notificationService.sendImmediateNotification(title, body, {
        type: 'daily_summary',
        date: summary.date,
        summary: summary,
      });
    } catch (error) {
      console.error('Error sending daily summary notification:', error);
    }
  }

  // Generate weekly summary
  async generateWeeklySummary(startDate: string, endDate: string): Promise<{
    totalExpenses: number;
    totalIncome: number;
    netAmount: number;
    averageDailyExpenses: number;
    averageDailyIncome: number;
    expenseCount: number;
    incomeCount: number;
  }> {
    try {
      const expenses = await getExpensesByDateRange(startDate, endDate);
      const income = await getIncomeByDateRange(startDate, endDate);
      
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
      const netAmount = totalIncome - totalExpenses;
      
      // Calculate number of days in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        totalExpenses,
        totalIncome,
        netAmount,
        averageDailyExpenses: totalExpenses / daysDiff,
        averageDailyIncome: totalIncome / daysDiff,
        expenseCount: expenses.length,
        incomeCount: income.length,
      };
    } catch (error) {
      console.error('Error generating weekly summary:', error);
      throw error;
    }
  }

  // Send weekly summary notification
  async sendWeeklySummaryNotification(): Promise<void> {
    try {
      // Get last week's date range
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1); // Yesterday
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6); // 7 days ago
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const summary = await this.generateWeeklySummary(startDateStr, endDateStr);
      
      const title = 'ملخص أسبوعي - دنانير';
      const isPositive = summary.netAmount >= 0;
      const emoji = isPositive ? '📈' : '📉';
      const netText = isPositive 
        ? `رصيد إيجابي: +${summary.netAmount} دينار`
        : `رصيد سلبي: ${summary.netAmount} دينار`;
      
      let body = `${netText} ${emoji}\n`;
      body += `إجمالي المصروفات: ${summary.totalExpenses} دينار\n`;
      body += `إجمالي الدخل: ${summary.totalIncome} دينار\n`;
      body += `متوسط المصروفات اليومية: ${Math.round(summary.averageDailyExpenses)} دينار\n`;
      body += `متوسط الدخل اليومي: ${Math.round(summary.averageDailyIncome)} دينار`;

      await this.notificationService.sendImmediateNotification(title, body, {
        type: 'weekly_summary',
        startDate: startDateStr,
        endDate: endDateStr,
        summary: summary,
      });
    } catch (error) {
      console.error('Error sending weekly summary notification:', error);
    }
  }

  // Generate monthly summary
  async generateMonthlySummary(year: number, month: number): Promise<{
    totalExpenses: number;
    totalIncome: number;
    netAmount: number;
    averageDailyExpenses: number;
    averageDailyIncome: number;
    expenseCount: number;
    incomeCount: number;
  }> {
    try {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
      
      const expenses = await getExpensesByDateRange(startDate, endDate);
      const income = await getIncomeByDateRange(startDate, endDate);
      
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalIncome = income.reduce((sum, inc) => sum + inc.amount, 0);
      const netAmount = totalIncome - totalExpenses;
      
      const daysInMonth = new Date(year, month, 0).getDate();
      
      return {
        totalExpenses,
        totalIncome,
        netAmount,
        averageDailyExpenses: totalExpenses / daysInMonth,
        averageDailyIncome: totalIncome / daysInMonth,
        expenseCount: expenses.length,
        incomeCount: income.length,
      };
    } catch (error) {
      console.error('Error generating monthly summary:', error);
      throw error;
    }
  }

  // Send monthly summary notification
  async sendMonthlySummaryNotification(): Promise<void> {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      
      const summary = await this.generateMonthlySummary(
        lastMonth.getFullYear(), 
        lastMonth.getMonth() + 1
      );
      
      const title = 'ملخص شهري - دنانير';
      const isPositive = summary.netAmount >= 0;
      const emoji = isPositive ? '📈' : '📉';
      const netText = isPositive 
        ? `رصيد إيجابي: +${summary.netAmount} دينار`
        : `رصيد سلبي: ${summary.netAmount} دينار`;
      
      let body = `${netText} ${emoji}\n`;
      body += `إجمالي المصروفات: ${summary.totalExpenses} دينار\n`;
      body += `إجمالي الدخل: ${summary.totalIncome} دينار\n`;
      body += `متوسط المصروفات اليومية: ${Math.round(summary.averageDailyExpenses)} دينار\n`;
      body += `متوسط الدخل اليومي: ${Math.round(summary.averageDailyIncome)} دينار`;

      await this.notificationService.sendImmediateNotification(title, body, {
        type: 'monthly_summary',
        year: lastMonth.getFullYear(),
        month: lastMonth.getMonth() + 1,
        summary: summary,
      });
    } catch (error) {
      console.error('Error sending monthly summary notification:', error);
    }
  }
}

export default DailySummaryService;
