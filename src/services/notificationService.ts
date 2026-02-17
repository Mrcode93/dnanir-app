import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getNotificationSettings } from '../database/database';
import { calculateBudgetStatus } from './budgetService';
import { getDebtsDueToday } from './debtService';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_MESSAGES,
  DEFAULT_TIMING
} from '../constants/notificationConstants';

// لا نلغي الإشعارات في وضع التطوير حتى يعمل التذكير اليومي ويبقى مفعّلاً عند فتح التطبيق
const disableScheduledNotificationsInDev = false;

// Configure notification handler so local and push notifications show when app is open
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (error) {
  // Ignore notification handler setup errors
}

/**
 * Helper to get a random message from a list
 */
const getRandomMessage = (messages: { title: string, body: string }[]) => {
  const index = Math.floor(Math.random() * messages.length);
  return messages[index];
};

/**
 * Internal helper to save sent notifications to the local database
 */
const saveToInternalInbox = async (title: string, body: string, type: string, data: any = {}) => {
  try {
    const { addNotification } = await import('../database/database');
    await addNotification({
      title,
      body,
      date: Date.now(),
      type,
      data: JSON.stringify(data)
    });
  } catch (error) {
    console.warn('Could not save notification to inbox:', error);
  }
};

const clearScheduledNotificationsInDevelopment = async (): Promise<boolean> => {
  if (!disableScheduledNotificationsInDev) return false;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    // Ignore cleanup errors in development
  }

  return true;
};

export const requestPermissions = async (): Promise<boolean> => {
  try {
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
        await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.FINANCIAL, {
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
    return false;
  }
};

export const scheduleDailyReminder = async () => {
  try {
    if (await clearScheduledNotificationsInDevelopment()) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    // Cancel existing
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = allScheduled.filter(n => n.identifier.startsWith(NOTIFICATION_CATEGORIES.DAILY_REMINDER));
    for (const notification of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }

    const settings = await getNotificationSettings();
    if (!settings || !settings.dailyReminder) return;

    const timeString = settings.dailyReminderTime || DEFAULT_TIMING.EVENING_REMINDER;
    const [hours, minutes] = timeString.split(':').map(Number);

    const message = getRandomMessage(NOTIFICATION_MESSAGES.DAILY_EVENING);

    const contentBase = {
      ...message,
      sound: true,
      data: { type: NOTIFICATION_CATEGORIES.DAILY_REMINDER },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
    };
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_CATEGORIES.DAILY_REMINDER,
        content: contentBase,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        } as Notifications.DailyTriggerInput,
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_CATEGORIES.DAILY_REMINDER,
        content: contentBase,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: hours,
          minute: minutes,
          repeats: true,
        } as Notifications.CalendarTriggerInput,
      });
    }
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
  }
};

export const checkBudgetAlerts = async () => {
  try {
    const budgetStatuses = await calculateBudgetStatus();

    for (const status of budgetStatuses) {
      let title = '';
      let body = '';
      let type = NOTIFICATION_CATEGORIES.BUDGET_ALERTS;

      if (status.isExceeded) {
        title = NOTIFICATION_MESSAGES.BUDGET_EXCEEDED.title;
        body = NOTIFICATION_MESSAGES.BUDGET_EXCEEDED.body(status.budget.category, Math.abs(status.remaining));
      } else if (status.percentage >= 80) {
        title = NOTIFICATION_MESSAGES.BUDGET_WARNING.title;
        body = NOTIFICATION_MESSAGES.BUDGET_WARNING.body(status.budget.category, Math.round(status.percentage));
      }

      if (title) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: { type, category: status.budget.category },
            ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
          },
          trigger: null,
        });

        // Save to internal inbox
        await saveToInternalInbox(title, body, type, { category: status.budget.category });
      }
    }
  } catch (error) {
    // Ignore budget alert errors
  }
};

export const sendExpenseReminder = async () => {
  try {
    if (await clearScheduledNotificationsInDevelopment()) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of allScheduled) {
      if (notification.identifier.startsWith(NOTIFICATION_CATEGORIES.EXPENSE_REMINDER)) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }

    const settings = await getNotificationSettings();
    if (!settings || !settings.expenseReminder) return;

    const timeString = settings.expenseReminderTime || DEFAULT_TIMING.EVENING_REMINDER;
    const [hours, minutes] = timeString.split(':').map(Number);

    const message = getRandomMessage(NOTIFICATION_MESSAGES.DAILY_EVENING);
    const contentBase = {
      ...message,
      sound: true,
      data: { type: NOTIFICATION_CATEGORIES.EXPENSE_REMINDER },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
    };
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_CATEGORIES.EXPENSE_REMINDER,
        content: contentBase,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        } as Notifications.DailyTriggerInput,
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_CATEGORIES.EXPENSE_REMINDER,
        content: contentBase,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: hours,
          minute: minutes,
          repeats: true,
        } as Notifications.CalendarTriggerInput,
      });
    }
  } catch (error) {
    console.error('Error scheduling expense reminder:', error);
  }
};

export const initializeNotifications = async () => {
  try {
    if (await clearScheduledNotificationsInDevelopment()) return;

    const hasPermission = await requestPermissions();
    if (hasPermission) {
      const settings = await getNotificationSettings();

      if (settings?.dailyReminder) {
        await scheduleDailyReminder();
      }

      if (settings?.expenseReminder) {
        await sendExpenseReminder();
      }

      await scheduleDebtReminders();
      await checkBudgetAlerts();
    }
  } catch (error) {
    // Ignore
  }
};

export const cancelNotification = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await Notifications.cancelScheduledNotificationAsync(`${identifier}-repeat`);
  } catch (error) {
    // Ignore
  }
};

export const sendTestNotification = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) throw new Error('No permission');

    const title = '🔔 إشعار تجريبي';
    const body = 'نظام الإشعارات يعمل بنجاح! نصوصك وأوقاتك صارت منظمة.';

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: 'test' },
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
      },
      trigger: null,
    });

    await saveToInternalInbox(title, body, 'test');
    return true;
  } catch (error) {
    throw error;
  }
};

export const checkDebtReminders = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const debtsDueToday = await getDebtsDueToday();
    if (debtsDueToday.length === 0) return;

    for (const { debt, installment } of debtsDueToday) {
      let title = installment ? '📅 استحقاق قسط' : '📅 استحقاق دين';
      let body = installment
        ? `يوجد قسط مستحق لـ ${debt.debtorName} بقيمة ${installment.amount} دينار`
        : `يوجد دين مستحق لـ ${debt.debtorName} بقيمة ${debt.remainingAmount} دينار`;

      const type = NOTIFICATION_CATEGORIES.DEBT_REMINDERS;

      await Notifications.scheduleNotificationAsync({
        identifier: `debt-${debt.id}-${installment?.id || 'full'}`,
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { type, debtId: debt.id },
          ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
        },
        trigger: null,
      });

      await saveToInternalInbox(title, body, type, { debtId: debt.id });
    }
  } catch (error) {
    // Ignore
  }
};

export const scheduleDebtReminders = async () => {
  try {
    if (await clearScheduledNotificationsInDevelopment()) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = allScheduled.filter(n => n.identifier === 'debt-check-daily');
    for (const n of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }

    const [hours, minutes] = DEFAULT_TIMING.DEBT_CHECK.split(':').map(Number);
    const contentBase = {
      title: '📅 تذكير بالالتزامات',
      body: 'تحقق من الديون والأقساط المستحقة اليوم.',
      sound: true,
      data: { type: NOTIFICATION_CATEGORIES.DEBT_REMINDERS },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
    };
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        identifier: 'debt-check-daily',
        content: contentBase,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
        } as Notifications.DailyTriggerInput,
      });
    } else {
      await Notifications.scheduleNotificationAsync({
        identifier: 'debt-check-daily',
        content: contentBase,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: hours,
          minute: minutes,
          repeats: true,
        } as Notifications.CalendarTriggerInput,
      });
    }

    await checkDebtReminders();
  } catch (error) {
    // Ignore
  }
};

export const rescheduleAllNotifications = async () => {
  try {
    if (await clearScheduledNotificationsInDevelopment()) return;

    const hasPermission = await requestPermissions();
    if (hasPermission) {
      await scheduleDailyReminder();
      await sendExpenseReminder();
      await scheduleDebtReminders();
    }
  } catch (error) {
    // Ignore
  }
};

export const verifyScheduledNotifications = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map(n => ({
      identifier: n.identifier,
      trigger: n.trigger,
    }));
  } catch (error) {
    return [];
  }
};

/**
 * Send local notification when user unlocks an achievement (and save to inbox)
 */
export const sendAchievementUnlockedNotification = async (achievement: {
  title: string;
  description?: string;
  type?: string;
}): Promise<void> => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const title = '🏆 إنجاز جديد!';
    const body = achievement.title + (achievement.description ? `\n${achievement.description}` : '');

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: { type: NOTIFICATION_CATEGORIES.ACHIEVEMENTS, achievementType: achievement.type },
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
      },
      trigger: null,
    });

    await saveToInternalInbox(title, body, NOTIFICATION_CATEGORIES.ACHIEVEMENTS, {
      achievementType: achievement.type,
    });
  } catch (error) {
    console.warn('Could not send achievement notification:', error);
  }
};
