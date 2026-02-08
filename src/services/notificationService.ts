import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getNotificationSettings, upsertNotificationSettings } from '../database/database';
import { calculateBudgetStatus } from './budgetService';
import { getDebtsDueToday } from './debtService';

// Configure notification handler
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  // Ignore notification handler setup errors
}

export const requestPermissions = async (): Promise<boolean> => {
  try {
    // Note: Local notifications work in Expo Go, only push notifications don't
    // This warning can be safely ignored if you're only using local notifications
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('financial-reminders', {
          name: 'تذكيرات مالية',
          description: 'تذكيرات يومية لتسجيل المصاريف والدخل',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
        });
      } catch (error) {
        // Ignore channel setup errors
      }
    }

    return true;
  } catch (error) {
    // Local notifications should still work even if there's a warning about push notifications
    return false;
  }
};

// Helper function to get the next occurrence of a specific time
const getNextTriggerDate = (hour: number, minute: number): Date => {
  const now = new Date();
  const trigger = new Date();

  trigger.setHours(hour, minute, 0, 0);

  // If target time has passed today, schedule for tomorrow
  if (trigger.getTime() <= now.getTime()) {
    trigger.setDate(trigger.getDate() + 1);
  }

  return trigger;
};

export const scheduleDailyReminder = async () => {
  try {
    // Check permissions first
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    // Cancel all existing daily reminder notifications first
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = allScheduled.filter(n => n.identifier.startsWith('daily-reminder'));
      for (const notification of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (e) {
      // Ignore if notifications don't exist
    }

    const settings = await getNotificationSettings();

    if (!settings || !settings.dailyReminder) {
      return;
    }

    // Parse time (format: HH:MM)
    const timeString = settings.dailyReminderTime || '20:00';
    const [hours, minutes] = timeString.split(':').map(Number);

    // Validate time
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return;
    }

    // Ensure Android channel is set before scheduling
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('financial-reminders', {
          name: 'تذكيرات مالية',
          description: 'تذكيرات يومية لتسجيل المصاريف والدخل',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
        });
      } catch (error) {
        // Ignore channel setup errors
      }
    }

    // Use platform-specific triggers for exact time scheduling
    let notificationIds: string[] = [];

    if (Platform.OS === 'android') {
      // Android: Use DailyTriggerInput for exact daily time
      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          identifier: 'daily-reminder',
          content: {
            title: '📝 تذكير يومي',
            body: 'تذكر تسجيل مصاريفك اليومية للحفاظ على ميزانيتك.',
            sound: true,
            data: { type: 'daily-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          } as Notifications.DailyTriggerInput,
        });
        notificationIds.push(notificationId);
      } catch (error) {
        throw error;
      }
    } else {
      // iOS: Use CalendarTriggerInput for exact time, plus timeInterval backup
      const oneDayInSeconds = 24 * 60 * 60;

      // Schedule calendar trigger for exact time (repeats daily)
      try {
        const calendarId = await Notifications.scheduleNotificationAsync({
          identifier: 'daily-reminder',
          content: {
            title: '📝 تذكير يومي',
            body: 'تذكر تسجيل مصاريفك اليومية للحفاظ على ميزانيتك.',
            sound: true,
            data: { type: 'daily-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour: hours,
            minute: minutes,
            second: 0,
            repeats: true,
          } as Notifications.CalendarTriggerInput,
        });
        notificationIds.push(calendarId);
      } catch (error) {
        throw error;
      }

      // Schedule timeInterval backup (repeats every 24 hours)
      try {
        const repeatId = await Notifications.scheduleNotificationAsync({
          identifier: 'daily-reminder-repeat',
          content: {
            title: '📝 تذكير يومي',
            body: 'تذكر تسجيل مصاريفك اليومية للحفاظ على ميزانيتك.',
            sound: true,
            data: { type: 'daily-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: oneDayInSeconds,
            repeats: true,
          } as Notifications.TimeIntervalTriggerInput,
        });
        notificationIds.push(repeatId);
      } catch (error) {
        throw error;
      }
    }

    // Verify the notifications were scheduled
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ourNotifications = scheduled.filter(n =>
      n.identifier === 'daily-reminder' || n.identifier === 'daily-reminder-repeat'
    );

    return notificationIds[0];
  } catch (error) {
    throw error;
  }
};

export const checkBudgetAlerts = async () => {
  try {
    const budgetStatuses = await calculateBudgetStatus();

    for (const status of budgetStatuses) {
      if (status.isExceeded) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ تنبيه الميزانية',
            body: `لقد تجاوزت ميزانية ${status.budget.category} بمبلغ ${Math.abs(status.remaining).toFixed(0)} دينار. يرجى الانتباه!`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Show immediately
        });
      } else if (status.percentage >= 80) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📈 اقتراب من الحد',
            body: `أنت على وشك تجاوز ميزانية ${status.budget.category} (وصلت ${status.percentage.toFixed(0)}%)`,
            sound: true,
          },
          trigger: null,
        });
      }
    }
  } catch (error) {
    // Ignore budget alert errors
  }
};

export const sendExpenseReminder = async () => {
  try {
    // Check permissions first
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    // Cancel all existing expense reminder notifications first
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of allScheduled) {
        if (notification.identifier.startsWith('expense-reminder')) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (e) {
      // Ignore if notifications don't exist
    }

    const settings = await getNotificationSettings();
    if (!settings || !settings.expenseReminder) {
      return;
    }

    // Parse time (format: HH:MM)
    const timeString = settings.expenseReminderTime || '20:00';
    const [hours, minutes] = timeString.split(':').map(Number);

    // Validate time
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return;
    }

    // Ensure Android channel is set before scheduling
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('financial-reminders', {
          name: 'تذكيرات مالية',
          description: 'تذكيرات يومية لتسجيل المصاريف والدخل',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
        });
      } catch (error) {
        // Ignore channel setup errors
      }
    }

    // Use platform-specific triggers for exact time scheduling
    let notificationIds: string[] = [];

    if (Platform.OS === 'android') {
      // Android: Use DailyTriggerInput for exact daily time
      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: 'expense-reminder',
        content: {
          title: '👋 متابعة المصاريف',
          body: 'مساء الخير! هل قمت بتسجيل جميع معاملاتك اليوم؟',
          sound: true,
          data: { type: 'expense-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        } as Notifications.DailyTriggerInput,
      });
      notificationIds.push(notificationId);
    } else {
      // iOS: Use CalendarTriggerInput for exact time, plus timeInterval backup
      const oneDayInSeconds = 24 * 60 * 60;

      // Schedule calendar trigger for exact time (repeats daily)
      const calendarId = await Notifications.scheduleNotificationAsync({
        identifier: 'expense-reminder',
        content: {
          title: '👋 متابعة المصاريف',
          body: 'مساء الخير! هل قمت بتسجيل جميع معاملاتك اليوم؟',
          sound: true,
          data: { type: 'expense-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: hours,
          minute: minutes,
          second: 0,
          repeats: true,
        } as Notifications.CalendarTriggerInput,
      });
      notificationIds.push(calendarId);

      // Schedule timeInterval backup (repeats every 24 hours)
      const repeatId = await Notifications.scheduleNotificationAsync({
        identifier: 'expense-reminder-repeat',
        content: {
          title: '👋 متابعة المصاريف',
          body: 'مساء الخير! هل قمت بتسجيل جميع معاملاتك اليوم؟',
          sound: true,
          data: { type: 'expense-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: oneDayInSeconds,
          repeats: true,
        } as Notifications.TimeIntervalTriggerInput,
      });
      notificationIds.push(repeatId);
    }

    // Verify the notifications were scheduled
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ourNotifications = scheduled.filter(n =>
      n.identifier === 'expense-reminder' || n.identifier === 'expense-reminder-repeat'
    );

    return notificationIds[0];
  } catch (error) {
    throw error;
  }
};

export const initializeNotifications = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (hasPermission) {
      // Only cancel our own notifications, not all notifications (to avoid canceling other app notifications)
      try {
        const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
        for (const notification of allScheduled) {
          if (notification.identifier.startsWith('daily-reminder') ||
            notification.identifier.startsWith('expense-reminder')) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          }
        }
      } catch (e) {
        // Ignore if notifications don't exist
      }

      // Check settings and only schedule enabled notifications
      const settings = await getNotificationSettings();

      if (settings?.dailyReminder) {
        await scheduleDailyReminder();
      }

      if (settings?.expenseReminder) {
        await sendExpenseReminder();
      }

      // Schedule debt reminders
      await scheduleDebtReminders();
    }
  } catch (error) {
    // Ignore initialization errors
  }
};

// Function to cancel specific notification types
export const cancelNotification = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    // Also cancel related notifications
    await Notifications.cancelScheduledNotificationAsync(`${identifier}-first`);
    await Notifications.cancelScheduledNotificationAsync(`${identifier}-repeat`);
    await Notifications.cancelScheduledNotificationAsync(`${identifier}-initial`);
  } catch (error) {
    // Ignore cancellation errors
  }
};

// Function to reschedule all notifications (useful when settings change)
export const rescheduleAllNotifications = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (hasPermission) {
      await scheduleDailyReminder();
      await sendExpenseReminder();
    }
  } catch (error) {
    // Ignore rescheduling errors
  }
};

// Function to verify scheduled notifications
export const verifyScheduledNotifications = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    // Also return in the format used by the UI
    return scheduled.map(n => ({
      identifier: n.identifier,
      trigger: n.trigger,
    }));
  } catch (error) {
    return [];
  }
};

// Function to send a test notification immediately
export const sendTestNotification = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    // Ensure Android channel is set
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('financial-reminders', {
          name: 'تذكيرات مالية',
          description: 'تذكيرات يومية لتسجيل المصاريف والدخل',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3B82F6',
        });
      } catch (error) {
        // Ignore channel setup errors
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 إشعار تجريبي',
        body: 'نظام الإشعارات يعمل بنجاح! سنقوم بتذكيرك بالأمور المالية المهمة.',
        sound: true,
        data: { type: 'test' },
      },
      trigger: null, // Show immediately
    });

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Check and send notifications for debts due today
 */
export const checkDebtReminders = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return;
    }

    const debtsDueToday = await getDebtsDueToday();

    if (debtsDueToday.length === 0) {
      return;
    }

    // Cancel existing debt reminders
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of allScheduled) {
        if (notification.identifier.startsWith('debt-reminder-')) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (e) {
      // Ignore cancellation errors
    }

    // Send notifications for each debt due today
    for (const { debt, installment } of debtsDueToday) {
      let title = 'تذكير دفع دين';
      let body = '';

      if (installment) {
        title = '📅 استحقاق قسط';
        body = `يوجد قسط مستحق لـ ${debt.debtorName} اليوم (رقم ${installment.installmentNumber}) بقيمة ${installment.amount.toFixed(0)} دينار`;
      } else {
        title = '📅 استحقاق دين';
        body = `يوجد دين مستحق لـ ${debt.debtorName} اليوم بقيمة ${debt.remainingAmount.toFixed(0)} دينار`;
      }

      await Notifications.scheduleNotificationAsync({
        identifier: `debt-reminder-${debt.id}${installment ? `-${installment.id}` : ''}`,
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { type: 'debt-reminder', debtId: debt.id, installmentId: installment?.id },
        },
        trigger: null, // Show immediately
      });
    }
  } catch (error) {
    // Ignore debt reminder errors
  }
};

/**
 * Send notification when an achievement is unlocked
 */
export const sendAchievementUnlockedNotification = async (achievement: any) => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return;
    }

    // Ensure Android channel is set
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('challenge-achievements', {
          name: 'إنجازات التحديات',
          description: 'إشعارات عند إكمال التحديات',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
        });
      } catch (error) {
        // Ignore channel setup errors
      }
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `achievement-unlocked-${achievement.type}-${Date.now()}`,
      content: {
        title: '🏆 إنجاز جديد!',
        body: `مبروك! حصلت على: ${achievement.title}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: 'achievement-unlocked',
          achievementType: achievement.type,
          achievementTitle: achievement.title,
        },
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    // Ignore achievement notification errors
  }
};

/**
 * Send notification when a challenge is completed
 */
export const sendChallengeCompletionNotification = async (challenge: any) => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return;
    }

    // Ensure Android channel is set
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('challenge-achievements', {
          name: 'إنجازات التحديات',
          description: 'إشعارات عند إكمال التحديات',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#10B981',
        });
      } catch (error) {
        // Ignore channel setup errors
      }
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `challenge-completed-${challenge.id}-${Date.now()}`,
      content: {
        title: '🎉 مبروك! خلصت التحدي',
        body: `خلصت تحدياً: ${challenge.title}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: 'challenge-completed',
          challengeId: challenge.id,
          challengeTitle: challenge.title,
        },
      },
      trigger: null, // Show immediately
    });
  } catch (error) {
    // Ignore challenge notification errors
  }
};

/**
 * Schedule daily check for debt reminders
 */
export const scheduleDebtReminders = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return;
    }

    // Cancel existing scheduled debt reminder checks
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of allScheduled) {
        if (notification.identifier === 'debt-reminder-check') {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (e) {
      // Ignore cancellation errors
    }

    // Schedule daily check at 8 AM
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        identifier: 'debt-reminder-check',
        content: {
          title: '🔄 فحص دوري',
          body: 'جارٍ التحقق من الالتزامات المالية...',
          sound: false,
          data: { type: 'debt-check' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
        } as Notifications.DailyTriggerInput,
      });
    } else {
      // iOS: Use time interval for daily check
      const oneDayInSeconds = 24 * 60 * 60;
      const now = new Date();
      const triggerTime = new Date();
      triggerTime.setHours(8, 0, 0, 0);
      if (triggerTime <= now) {
        triggerTime.setDate(triggerTime.getDate() + 1);
      }
      const secondsUntilTrigger = Math.floor((triggerTime.getTime() - now.getTime()) / 1000);

      await Notifications.scheduleNotificationAsync({
        identifier: 'debt-reminder-check',
        content: {
          title: '🔄 فحص دوري',
          body: 'جارٍ التحقق من الالتزامات المالية...',
          sound: false,
          data: { type: 'debt-check' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntilTrigger,
          repeats: true,
        } as Notifications.TimeIntervalTriggerInput,
      });
    }

    // Also check immediately
    await checkDebtReminders();
  } catch (error) {
    // Ignore scheduling errors
  }
};
