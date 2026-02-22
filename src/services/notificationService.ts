import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDateLocal } from '../utils/date';
import { getAppSettings, getBillsDueSoon, getExpenses, getNotificationSettings } from '../database/database';
import { calculateBudgetStatus } from './budgetService';
import { getDebtsDueToday } from './debtService';
import { scheduleAllBillReminders } from './billService';
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

const pushInstantNotification = async (params: {
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
  priority?: Notifications.AndroidNotificationPriority;
}): Promise<void> => {
  const { title, body, type, data = {}, priority = Notifications.AndroidNotificationPriority.DEFAULT } = params;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority,
      data: { ...data, type },
      ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
    },
    trigger: null,
  });
  await saveToInternalInbox(title, body, type, data);
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

const SMART_ALERTS_MEMORY_KEY = '@dnanir_smart_alerts_memory_v1';
const SMART_ALERTS_MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

type SmartAlertsMemory = {
  sent: Record<string, string>;
  lastRunAt: number;
};

const defaultSmartAlertsMemory = (): SmartAlertsMemory => ({
  sent: {},
  lastRunAt: 0,
});

const loadSmartAlertsMemory = async (): Promise<SmartAlertsMemory> => {
  try {
    const raw = await AsyncStorage.getItem(SMART_ALERTS_MEMORY_KEY);
    if (!raw) return defaultSmartAlertsMemory();
    const parsed = JSON.parse(raw) as Partial<SmartAlertsMemory>;
    return {
      sent: parsed.sent || {},
      lastRunAt: typeof parsed.lastRunAt === 'number' ? parsed.lastRunAt : 0,
    };
  } catch {
    return defaultSmartAlertsMemory();
  }
};

const saveSmartAlertsMemory = async (memory: SmartAlertsMemory): Promise<void> => {
  try {
    await AsyncStorage.setItem(SMART_ALERTS_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Ignore cache write errors
  }
};

const wasAlertSent = (memory: SmartAlertsMemory, key: string, marker: string): boolean => {
  return memory.sent[key] === marker;
};

const markAlertSent = (memory: SmartAlertsMemory, key: string, marker: string): void => {
  memory.sent[key] = marker;
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

export const checkBudgetAlerts = async (memory?: SmartAlertsMemory) => {
  try {
    const currentMemory = memory || await loadSmartAlertsMemory();
    const budgetStatuses = await calculateBudgetStatus();

    for (const status of budgetStatuses) {
      let title = '';
      let body = '';
      let level: 'warning' | 'exceeded' | null = null;

      if (status.isExceeded) {
        level = 'exceeded';
        title = NOTIFICATION_MESSAGES.BUDGET_EXCEEDED.title;
        body = NOTIFICATION_MESSAGES.BUDGET_EXCEEDED.body(status.budget.category, Math.abs(status.remaining));
      } else if (status.percentage >= 80) {
        level = 'warning';
        title = NOTIFICATION_MESSAGES.BUDGET_WARNING.title;
        body = NOTIFICATION_MESSAGES.BUDGET_WARNING.body(status.budget.category, Math.round(status.percentage));
      }

      if (!level || !title) continue;

      const key = `budget:${status.budget.category}:${level}`;
      const marker = `${status.budget.year}-${status.budget.month}`;
      if (wasAlertSent(currentMemory, key, marker)) {
        continue;
      }

      await pushInstantNotification({
        title,
        body,
        type: NOTIFICATION_CATEGORIES.BUDGET_ALERTS,
        data: {
          category: status.budget.category,
          level,
          percentage: Math.round(status.percentage),
        },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      });

      markAlertSent(currentMemory, key, marker);
    }

    if (!memory) {
      await saveSmartAlertsMemory(currentMemory);
    }
  } catch (error) {
    // Ignore budget alert errors
  }
};

const checkBillsDueSoonAlerts = async (memory: SmartAlertsMemory): Promise<void> => {
  const dueSoonBills = await getBillsDueSoon(3);
  if (dueSoonBills.length === 0) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const bill of dueSoonBills) {
    if (bill.isPaid) continue;

    const dueDate = new Date(`${bill.dueDate}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) continue;

    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 3) continue;

    const key = `bill:${bill.id}`;
    const marker = bill.dueDate;
    if (wasAlertSent(memory, key, marker)) continue;

    const title = NOTIFICATION_MESSAGES.BILL_DUE_SOON.title(diffDays);
    const body = NOTIFICATION_MESSAGES.BILL_DUE_SOON.body(
      bill.title,
      Math.round(bill.amount),
      bill.currency || 'IQD',
      diffDays,
    );

    await pushInstantNotification({
      title,
      body,
      type: NOTIFICATION_CATEGORIES.BILL_ALERTS,
      data: {
        billId: bill.id,
        dueDate: bill.dueDate,
        daysLeft: diffDays,
      },
      priority: Notifications.AndroidNotificationPriority.HIGH,
    });

    markAlertSent(memory, key, marker);
  }
};

const checkUnusualSpendingPatternAlerts = async (memory: SmartAlertsMemory): Promise<void> => {
  const todayKey = formatDateLocal(new Date());
  if (wasAlertSent(memory, 'spending-anomaly', todayKey)) return;

  const expenses = await getExpenses();
  if (expenses.length < 8) return;

  const totalsByDate = new Map<string, number>();
  for (const expense of expenses) {
    const dateKey = (expense.date || '').slice(0, 10);
    if (!dateKey) continue;
    const amount = Number.isFinite(expense.base_amount as number)
      ? (expense.base_amount as number)
      : expense.amount;
    totalsByDate.set(dateKey, (totalsByDate.get(dateKey) || 0) + (Number.isFinite(amount) ? amount : 0));
  }

  const todayTotal = totalsByDate.get(todayKey) || 0;
  if (todayTotal <= 0) return;

  const previousWeekTotals: number[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = formatDateLocal(date);
    previousWeekTotals.push(totalsByDate.get(dateKey) || 0);
  }

  const activeDays = previousWeekTotals.filter((value) => value > 0);
  if (activeDays.length < 3) return;

  const avg = activeDays.reduce((sum, value) => sum + value, 0) / activeDays.length;
  if (avg <= 0) return;

  const ratio = todayTotal / avg;
  const increaseAmount = todayTotal - avg;
  if (ratio < 1.8 || increaseAmount < 5000) return;

  const increasePercent = Math.round((increaseAmount / avg) * 100);
  const title = NOTIFICATION_MESSAGES.SPENDING_ANOMALY.title;
  const body = NOTIFICATION_MESSAGES.SPENDING_ANOMALY.body(
    Math.round(todayTotal),
    Math.round(avg),
    increasePercent,
  );

  await pushInstantNotification({
    title,
    body,
    type: NOTIFICATION_CATEGORIES.SPENDING_ALERTS,
    data: {
      todayTotal: Math.round(todayTotal),
      weeklyAverage: Math.round(avg),
      increasePercent,
    },
    priority: Notifications.AndroidNotificationPriority.HIGH,
  });

  markAlertSent(memory, 'spending-anomaly', todayKey);
};

export const runSmartFinancialAlerts = async (options?: { force?: boolean }) => {
  try {
    const memory = await loadSmartAlertsMemory();
    const now = Date.now();
    if (!options?.force && memory.lastRunAt && now - memory.lastRunAt < SMART_ALERTS_MIN_INTERVAL_MS) {
      return;
    }

    await checkBudgetAlerts(memory);
    await checkBillsDueSoonAlerts(memory);
    await checkUnusualSpendingPatternAlerts(memory);

    memory.lastRunAt = now;
    await saveSmartAlertsMemory(memory);
  } catch (error) {
    // Ignore smart alert errors
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

    const appSettings = await getAppSettings();
    if (appSettings && appSettings.notificationsEnabled === false) {
      return;
    }

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
      await scheduleAllBillReminders();
      await runSmartFinancialAlerts();
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

    const appSettings = await getAppSettings();
    if (appSettings && appSettings.notificationsEnabled === false) {
      return;
    }

    const hasPermission = await requestPermissions();
    if (hasPermission) {
      await scheduleDailyReminder();
      await sendExpenseReminder();
      await scheduleDebtReminders();
      await scheduleAllBillReminders();
      await runSmartFinancialAlerts({ force: true });
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

/**
 * Send local notification when a challenge is completed
 */
export const sendChallengeCompletionNotification = async (challenge: {
  id?: number;
  title: string;
  reward?: string;
}): Promise<void> => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const title = '🎯 اكتمل تحدي جديد';
    const body = challenge.reward
      ? `أحسنت! أنهيت "${challenge.title}" والمكافأة: ${challenge.reward}`
      : `أحسنت! أنهيت التحدي "${challenge.title}"`;

    await pushInstantNotification({
      title,
      body,
      type: NOTIFICATION_CATEGORIES.ACHIEVEMENTS,
      data: {
        challengeId: challenge.id,
        challengeTitle: challenge.title,
      },
      priority: Notifications.AndroidNotificationPriority.HIGH,
    });
  } catch (error) {
    console.warn('Could not send challenge completion notification:', error);
  }
};
