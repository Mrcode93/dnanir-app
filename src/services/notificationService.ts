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
  console.warn('Error setting notification handler:', error);
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
        console.warn('Warning: Could not set notification channel:', error);
      }
    }
    
    return true;
  } catch (error) {
    // Local notifications should still work even if there's a warning about push notifications
    console.warn('Notification permission error (this is normal in Expo Go for local notifications):', error);
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
    console.log('[scheduleDailyReminder] Starting...');
    
    // Check permissions first
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.error('[scheduleDailyReminder] Cannot schedule: permissions not granted');
      throw new Error('Notification permissions not granted');
    }
    console.log('[scheduleDailyReminder] Permissions granted');
    
    // Cancel all existing daily reminder notifications first
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = allScheduled.filter(n => n.identifier.startsWith('daily-reminder'));
      console.log(`[scheduleDailyReminder] Canceling ${toCancel.length} existing notifications`);
      for (const notification of toCancel) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    } catch (e) {
      // Ignore if notifications don't exist
      console.warn('[scheduleDailyReminder] Warning: Error canceling existing notifications:', e);
    }
    
    const settings = await getNotificationSettings();
    console.log('[scheduleDailyReminder] Settings:', settings);
    
    if (!settings || !settings.dailyReminder) {
      console.log('[scheduleDailyReminder] Daily reminder is disabled in settings');
      return;
    }
    
    // Parse time (format: HH:MM)
    const timeString = settings.dailyReminderTime || '20:00';
    console.log(`[scheduleDailyReminder] Time string: ${timeString}`);
    const [hours, minutes] = timeString.split(':').map(Number);
    console.log(`[scheduleDailyReminder] Parsed time: ${hours}:${minutes}`);
    
    // Validate time
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('[scheduleDailyReminder] Invalid time format:', timeString);
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
        console.warn('Warning: Could not set notification channel:', error);
      }
    }
    
    // Use platform-specific triggers for exact time scheduling
    let notificationIds: string[] = [];
    
    console.log(`[scheduleDailyReminder] Platform: ${Platform.OS}, Scheduling for ${hours}:${minutes}`);
    
    if (Platform.OS === 'android') {
      // Android: Use DailyTriggerInput for exact daily time
      console.log('[scheduleDailyReminder] Scheduling Android DailyTriggerInput...');
      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          identifier: 'daily-reminder',
          content: {
            title: 'تذكير يومي',
            body: 'لا تنسى تسجيل مصاريفك اليومية!',
            sound: true,
            data: { type: 'daily-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          } as Notifications.DailyTriggerInput,
        });
        console.log(`[scheduleDailyReminder] Android notification scheduled with ID: ${notificationId}`);
        notificationIds.push(notificationId);
      } catch (error) {
        console.error('[scheduleDailyReminder] Error scheduling Android notification:', error);
        throw error;
      }
    } else {
      // iOS: Use CalendarTriggerInput for exact time, plus timeInterval backup
      const oneDayInSeconds = 24 * 60 * 60;
      
      // Schedule calendar trigger for exact time (repeats daily)
      console.log('[scheduleDailyReminder] Scheduling iOS CalendarTriggerInput...');
      try {
        const calendarId = await Notifications.scheduleNotificationAsync({
          identifier: 'daily-reminder',
          content: {
            title: 'تذكير يومي',
            body: 'لا تنسى تسجيل مصاريفك اليومية!',
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
        console.log(`[scheduleDailyReminder] iOS calendar notification scheduled with ID: ${calendarId}`);
        notificationIds.push(calendarId);
      } catch (error) {
        console.error('[scheduleDailyReminder] Error scheduling iOS calendar notification:', error);
        throw error;
      }
      
      // Schedule timeInterval backup (repeats every 24 hours)
      console.log('[scheduleDailyReminder] Scheduling iOS TimeIntervalTriggerInput backup...');
      try {
        const repeatId = await Notifications.scheduleNotificationAsync({
          identifier: 'daily-reminder-repeat',
          content: {
            title: 'تذكير يومي',
            body: 'لا تنسى تسجيل مصاريفك اليومية!',
            sound: true,
            data: { type: 'daily-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: oneDayInSeconds,
            repeats: true,
          } as Notifications.TimeIntervalTriggerInput,
        });
        console.log(`[scheduleDailyReminder] iOS timeInterval notification scheduled with ID: ${repeatId}`);
        notificationIds.push(repeatId);
      } catch (error) {
        console.error('[scheduleDailyReminder] Error scheduling iOS timeInterval notification:', error);
        throw error;
      }
    }
    
    console.log(`[scheduleDailyReminder] Successfully scheduled ${notificationIds.length} notification(s) for ${hours}:${minutes} on ${Platform.OS} (IDs: ${notificationIds.join(', ')})`);
    
    // Verify the notifications were scheduled
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ourNotifications = scheduled.filter(n => 
      n.identifier === 'daily-reminder' || n.identifier === 'daily-reminder-repeat'
    );
    
    console.log(`[scheduleDailyReminder] Verification: Found ${ourNotifications.length} of our notifications in scheduled list`);
    
    if (ourNotifications.length > 0) {
      console.log('[scheduleDailyReminder] Verified scheduled notifications:', ourNotifications.map(n => ({
        identifier: n.identifier,
        trigger: n.trigger,
      })));
    } else {
      console.warn('[scheduleDailyReminder] WARNING: Notifications were scheduled but not found in scheduled list!');
      console.warn('[scheduleDailyReminder] All scheduled notifications:', scheduled.map(n => n.identifier));
    }
    
    return notificationIds[0];
  } catch (error) {
    console.error('[scheduleDailyReminder] ERROR:', error);
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
            title: 'تجاوز الميزانية',
            body: `لقد تجاوزت ميزانية ${status.budget.category} بمبلغ ${Math.abs(status.remaining).toFixed(0)} دينار`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Show immediately
        });
      } else if (status.percentage >= 80) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'اقتراب من الميزانية',
            body: `أنت قريب من تجاوز ميزانية ${status.budget.category} (${status.percentage.toFixed(0)}%)`,
            sound: true,
          },
          trigger: null,
        });
      }
    }
  } catch (error) {
    console.error('Error checking budget alerts:', error);
  }
};

export const sendExpenseReminder = async () => {
  try {
    // Check permissions first
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.error('Cannot schedule expense reminder: permissions not granted');
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
      console.warn('Warning: Error canceling existing notifications:', e);
    }
    
    const settings = await getNotificationSettings();
    if (!settings || !settings.expenseReminder) {
      console.log('Expense reminder is disabled in settings');
      return;
    }
    
    // Parse time (format: HH:MM)
    const timeString = settings.expenseReminderTime || '20:00';
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Validate time
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.error('Invalid time format:', timeString);
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
        console.warn('Warning: Could not set notification channel:', error);
      }
    }
    
    // Use platform-specific triggers for exact time scheduling
    let notificationIds: string[] = [];
    
    if (Platform.OS === 'android') {
      // Android: Use DailyTriggerInput for exact daily time
      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: 'expense-reminder',
        content: {
          title: 'تذكير المصاريف',
          body: 'هل سجلت جميع مصاريفك اليوم؟',
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
          title: 'تذكير المصاريف',
          body: 'هل سجلت جميع مصاريفك اليوم؟',
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
          title: 'تذكير المصاريف',
          body: 'هل سجلت جميع مصاريفك اليوم؟',
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
    
    console.log(`Expense reminder scheduled for ${hours}:${minutes} on ${Platform.OS} (IDs: ${notificationIds.join(', ')})`);
    
    // Verify the notifications were scheduled
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ourNotifications = scheduled.filter(n => 
      n.identifier === 'expense-reminder' || n.identifier === 'expense-reminder-repeat'
    );
    
    if (ourNotifications.length > 0) {
      console.log('Verified scheduled notifications:', ourNotifications.map(n => ({
        identifier: n.identifier,
        trigger: n.trigger,
      })));
    } else {
      console.warn('Warning: Notifications were not found in scheduled list');
    }
    
    return notificationIds[0];
  } catch (error) {
    console.error('Error sending expense reminder:', error);
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
        console.warn('Warning: Error canceling existing notifications:', e);
      }
      
      // Check settings and only schedule enabled notifications
      const settings = await getNotificationSettings();
      console.log('Notification settings:', settings);
      
      if (settings?.dailyReminder) {
        console.log('Scheduling daily reminder...');
        await scheduleDailyReminder();
      } else {
        console.log('Daily reminder is disabled');
      }
      
      if (settings?.expenseReminder) {
        console.log('Scheduling expense reminder...');
        await sendExpenseReminder();
      } else {
        console.log('Expense reminder is disabled');
      }
      
      // Schedule debt reminders
      console.log('Scheduling debt reminders...');
      await scheduleDebtReminders();
      
      console.log('Notifications initialized successfully');
    } else {
      console.warn('Notification permissions not granted');
    }
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
};

// Function to cancel specific notification types
export const cancelNotification = async (identifier: string) => {
  try {
    console.log(`[cancelNotification] Canceling notification: ${identifier}`);
    await Notifications.cancelScheduledNotificationAsync(identifier);
    // Also cancel related notifications
    await Notifications.cancelScheduledNotificationAsync(`${identifier}-first`);
    await Notifications.cancelScheduledNotificationAsync(`${identifier}-repeat`);
    await Notifications.cancelScheduledNotificationAsync(`${identifier}-initial`);
    console.log(`[cancelNotification] Successfully cancelled notification: ${identifier}`);
  } catch (error) {
    console.error(`[cancelNotification] Error cancelling notification ${identifier}:`, error);
  }
};

// Function to reschedule all notifications (useful when settings change)
export const rescheduleAllNotifications = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (hasPermission) {
      await scheduleDailyReminder();
      await sendExpenseReminder();
      console.log('All notifications rescheduled');
    }
  } catch (error) {
    console.error('Error rescheduling notifications:', error);
  }
};

// Function to verify scheduled notifications
export const verifyScheduledNotifications = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    
    // Log all scheduled notifications in detail
    console.log('=== All Scheduled Notifications ===');
    console.log(`Total: ${scheduled.length} notifications`);
    
    scheduled.forEach((n, index) => {
      const trigger = n.trigger as any;
      let triggerInfo = '';
      
      if (trigger?.type === 'daily') {
        triggerInfo = `Daily at ${trigger.hour}:${trigger.minute || '00'}`;
      } else if (trigger?.type === 'calendar') {
        const dateComponents = trigger.dateComponents || {};
        triggerInfo = `Calendar: ${dateComponents.hour || '?'}:${dateComponents.minute || '?'} (repeats: ${trigger.repeats || false})`;
      } else if (trigger?.type === 'timeInterval') {
        const hours = Math.floor(trigger.seconds / 3600);
        const minutes = Math.floor((trigger.seconds % 3600) / 60);
        triggerInfo = `TimeInterval: every ${hours}h ${minutes}m (${trigger.seconds}s, repeats: ${trigger.repeats || false})`;
      } else if (trigger?.type === 'date') {
        triggerInfo = `Date: ${new Date(trigger.timestamp * 1000).toLocaleString()}`;
      } else {
        triggerInfo = JSON.stringify(trigger);
      }
      
      console.log(`${index + 1}. ${n.identifier}: ${triggerInfo}`);
    });
    
    console.log('===================================');
    
    // Also return in the format used by the UI
    return scheduled.map(n => ({
      identifier: n.identifier,
      trigger: n.trigger,
    }));
  } catch (error) {
    console.error('Error verifying notifications:', error);
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
        console.warn('Warning: Could not set notification channel:', error);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'اختبار الإشعارات',
        body: 'هذا إشعار تجريبي للتأكد من عمل الإشعارات بشكل صحيح',
        sound: true,
        data: { type: 'test' },
      },
      trigger: null, // Show immediately
    });
    
    console.log('Test notification sent');
    return true;
  } catch (error) {
    console.error('Error sending test notification:', error);
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
      console.log('Cannot send debt reminders: permissions not granted');
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
      console.warn('Warning: Error canceling existing debt notifications:', e);
    }

    // Send notifications for each debt due today
    for (const { debt, installment } of debtsDueToday) {
      let title = 'تذكير دفع دين';
      let body = '';

      if (installment) {
        title = 'تذكير دفع قسط';
        body = `لازم تدفع لـ ${debt.debtorName} اليوم! القسط ${installment.installmentNumber}: ${installment.amount.toFixed(0)} دينار`;
      } else {
        body = `لازم تدفع لـ ${debt.debtorName} اليوم! المبلغ: ${debt.remainingAmount.toFixed(0)} دينار`;
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

    console.log(`Sent ${debtsDueToday.length} debt reminder notification(s)`);
  } catch (error) {
    console.error('Error checking debt reminders:', error);
  }
};

/**
 * Schedule daily check for debt reminders
 */
export const scheduleDebtReminders = async () => {
  try {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      console.log('Cannot schedule debt reminders: permissions not granted');
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
      console.warn('Warning: Error canceling existing debt reminder checks:', e);
    }

    // Schedule daily check at 8 AM
    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        identifier: 'debt-reminder-check',
        content: {
          title: 'فحص الديون',
          body: 'جارٍ فحص الديون المستحقة اليوم...',
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
          title: 'فحص الديون',
          body: 'جارٍ فحص الديون المستحقة اليوم...',
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
    console.error('Error scheduling debt reminders:', error);
  }
};
