import { useEffect, useCallback } from 'react';
import NotificationService from '../services/notificationService';

export const useNotifications = () => {
  const notificationService = NotificationService.getInstance();

  // Check if user has recorded expenses/income today and schedule reminders if needed
  const checkAndScheduleReminders = useCallback(async () => {
    try {
      // This would typically check your database for today's entries
      // For now, we'll implement basic reminder scheduling
      
      const settings = await notificationService.getNotificationSettings();
      
      if (settings.expenseReminder) {
        // Schedule expense reminder if no expenses recorded today
        await notificationService.scheduleExpenseReminder();
      }
      
      if (settings.incomeReminder) {
        // Schedule income reminder if no income recorded today
        await notificationService.scheduleIncomeReminder();
      }
    } catch (error) {
      console.error('Error scheduling reminders:', error);
    }
  }, [notificationService]);

  // Send immediate notification when expense is added
  const notifyExpenseAdded = useCallback(async (amount: number, category: string) => {
    try {
      await notificationService.sendImmediateNotification(
        'تم إضافة مصروف جديد',
        `تم إضافة مصروف ${amount} دينار في فئة ${category} 💰`
      );
    } catch (error) {
      console.error('Error sending expense notification:', error);
    }
  }, [notificationService]);

  // Send immediate notification when income is added
  const notifyIncomeAdded = useCallback(async (amount: number, source: string) => {
    try {
      await notificationService.sendImmediateNotification(
        'تم إضافة دخل جديد',
        `تم إضافة دخل ${amount} دينار من ${source} 💵`
      );
    } catch (error) {
      console.error('Error sending income notification:', error);
    }
  }, [notificationService]);

  // Send budget warning notification
  const notifyBudgetWarning = useCallback(async (category: string, spent: number, budget: number) => {
    try {
      const percentage = Math.round((spent / budget) * 100);
      await notificationService.sendImmediateNotification(
        'تحذير الميزانية',
        `لقد أنفقت ${percentage}% من ميزانية ${category} (${spent}/${budget} دينار) ⚠️`
      );
    } catch (error) {
      console.error('Error sending budget warning:', error);
    }
  }, [notificationService]);

  // Send budget exceeded notification
  const notifyBudgetExceeded = useCallback(async (category: string, spent: number, budget: number) => {
    try {
      const exceeded = spent - budget;
      await notificationService.sendImmediateNotification(
        'تم تجاوز الميزانية',
        `تم تجاوز ميزانية ${category} بمبلغ ${exceeded} دينار! 💸`
      );
    } catch (error) {
      console.error('Error sending budget exceeded notification:', error);
    }
  }, [notificationService]);

  // Send daily summary notification
  const sendDailySummary = useCallback(async (totalExpenses: number, totalIncome: number, netAmount: number) => {
    try {
      const isPositive = netAmount >= 0;
      const emoji = isPositive ? '📈' : '📉';
      const message = isPositive 
        ? `رائع! رصيدك اليوم إيجابي: +${netAmount} دينار`
        : `انتبه! رصيدك اليوم سلبي: ${netAmount} دينار`;
      
      await notificationService.sendImmediateNotification(
        'ملخص يومي - دنانير',
        `${message}\nالمصروفات: ${totalExpenses} دينار\nالدخل: ${totalIncome} دينار ${emoji}`
      );
    } catch (error) {
      console.error('Error sending daily summary:', error);
    }
  }, [notificationService]);

  // Setup notification listeners
  useEffect(() => {
    const responseListener = notificationService.addNotificationResponseListener((response) => {
      console.log('Notification response:', response);
      // Handle notification tap - could navigate to specific screens
      const data = response.notification.request.content.data;
      if (data?.type) {
        // Handle different notification types
        switch (data.type) {
          case 'daily_reminder':
            // Navigate to expense screen
            break;
          case 'expense_reminder':
            // Navigate to expense screen
            break;
          case 'income_reminder':
            // Navigate to income screen
            break;
          case 'weekly_summary':
            // Navigate to insights screen
            break;
          case 'monthly_summary':
            // Navigate to insights screen
            break;
        }
      }
    });

    const receivedListener = notificationService.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      // Handle notification received while app is in foreground
    });

    return () => {
      responseListener.remove();
      receivedListener.remove();
    };
  }, [notificationService]);

  return {
    checkAndScheduleReminders,
    notifyExpenseAdded,
    notifyIncomeAdded,
    notifyBudgetWarning,
    notifyBudgetExceeded,
    sendDailySummary,
  };
};
