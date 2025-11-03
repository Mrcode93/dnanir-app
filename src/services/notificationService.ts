import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { 
  getNotificationSettings, 
  upsertNotificationSettings, 
  addNotificationLog,
  NotificationSettings as DBNotificationSettings 
} from '../database/database';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationSettings {
  dailyReminder: boolean;
  dailyReminderTime: string; // Format: "HH:MM"
  expenseReminder: boolean;
  incomeReminder: boolean;
  weeklySummary: boolean;
  monthlySummary: boolean;
}

export interface NotificationData {
  type: 'daily_reminder' | 'expense_reminder' | 'income_reminder' | 'weekly_summary' | 'monthly_summary';
  title: string;
  body: string;
  data?: any;
}

class NotificationService {
  private static instance: NotificationService;
  private notificationSettings: NotificationSettings = {
    dailyReminder: true,
    dailyReminderTime: '20:00',
    expenseReminder: true,
    incomeReminder: true,
    weeklySummary: true,
    monthlySummary: true,
  };

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Configure notification channel for Android (required for Android 8+)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'دنانير - تذكيرات مالية',
          description: 'تذكيرات يومية وأسبوعية وشهرية لإدارة الأموال',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#20B2AA', // Use app primary color
          sound: 'default',
          enableVibrate: true,
          showBadge: false,
        });
        
        // Create additional channel for transaction notifications
        await Notifications.setNotificationChannelAsync('transactions', {
          name: 'معاملات مالية',
          description: 'إشعارات عند إضافة أو تعديل المصروفات والدخل',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 200],
          lightColor: '#20B2AA',
          sound: 'default',
          enableVibrate: true,
          showBadge: false,
        });
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  // Schedule a notification
  async scheduleNotification(
    identifier: string,
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: any,
    channelId: string = 'default'
  ): Promise<string | null> {
    try {
      // Check permissions before scheduling
      const hasPermission = await this.areNotificationsEnabled();
      if (!hasPermission) {
        console.warn(`Cannot schedule ${identifier} - notifications not permitted`);
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          data,
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId }),
        },
        trigger,
      });

      console.log(`Scheduled notification: ${identifier} with ID: ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error(`Error scheduling notification ${identifier}:`, error);
      return null;
    }
  }

  // Cancel a specific notification
  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log(`Cancelled notification: ${identifier}`);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Cancelled all notifications');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Schedule daily reminder
  async scheduleDailyReminder(time: string = '20:00'): Promise<void> {
    const [hours, minutes] = time.split(':').map(Number);
    
    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    };

    await this.scheduleNotification(
      'daily_reminder',
      'تذكير يومي - دنانير',
      'لا تنس تسجيل مصروفاتك اليومية! 📊',
      trigger,
      { type: 'daily_reminder' }
    );
  }

  // Schedule expense reminder
  async scheduleExpenseReminder(): Promise<void> {
    // Schedule for 2 hours from now if no expense recorded today
    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2 * 60 * 60, // 2 hours
    };

    await this.scheduleNotification(
      'expense_reminder',
      'تذكير المصروفات',
      'هل سجلت مصروفاتك اليوم؟ 💰',
      trigger,
      { type: 'expense_reminder' }
    );
  }

  // Schedule income reminder
  async scheduleIncomeReminder(): Promise<void> {
    // Schedule for 1 hour from now if no income recorded today
    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1 * 60 * 60, // 1 hour
    };

    await this.scheduleNotification(
      'income_reminder',
      'تذكير الدخل',
      'لا تنس تسجيل دخلك اليوم! 💵',
      trigger,
      { type: 'income_reminder' }
    );
  }

  // Schedule weekly summary
  async scheduleWeeklySummary(): Promise<void> {
      // Schedule for every Sunday at 9 AM (weekday 1 = Sunday, 7 = Saturday)
    const trigger: Notifications.WeeklyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 7, // Sunday (1 = Monday, 7 = Sunday in iOS/Android)
      hour: 9,
      minute: 0,
    };

    await this.scheduleNotification(
      'weekly_summary',
      'ملخص أسبوعي - دنانير',
      'اطلع على ملخصك المالي لهذا الأسبوع 📈',
      trigger,
      { type: 'weekly_summary' }
    );
  }

  // Schedule monthly summary
  async scheduleMonthlySummary(): Promise<void> {
      // Schedule for the 1st of every month at 10 AM
    const trigger: Notifications.MonthlyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour: 10,
      minute: 0,
    };

    await this.scheduleNotification(
      'monthly_summary',
      'ملخص شهري - دنانير',
      'اطلع على ملخصك المالي لهذا الشهر 📊',
      trigger,
      { type: 'monthly_summary' }
    );
  }

  // Setup all notifications based on settings
  async setupNotifications(settings: NotificationSettings): Promise<void> {
    try {
      // Check permissions first
      const hasPermission = await this.areNotificationsEnabled();
      if (!hasPermission) {
        console.warn('Notifications not enabled - requesting permissions');
        const granted = await this.requestPermissions();
        if (!granted) {
          console.error('Cannot setup notifications - permissions denied');
          return;
        }
      }

      // Cancel existing notifications first
      await this.cancelAllNotifications();

      this.notificationSettings = settings;

      // Schedule notifications based on settings
      if (settings.dailyReminder) {
        await this.scheduleDailyReminder(settings.dailyReminderTime);
      }

      if (settings.weeklySummary) {
        await this.scheduleWeeklySummary();
      }

      if (settings.monthlySummary) {
        await this.scheduleMonthlySummary();
      }

      console.log('All notifications scheduled successfully');
    } catch (error) {
      console.error('Error setting up notifications:', error);
      throw error; // Re-throw for proper error handling
    }
  }

  // Send immediate notification
  async sendImmediateNotification(title: string, body: string, data?: any): Promise<void> {
    try {
      // Check permissions before sending
      const hasPermission = await this.areNotificationsEnabled();
      if (!hasPermission) {
        console.warn('Cannot send notification - notifications not permitted');
        return;
      }

      const notificationType = data?.type || 'immediate';
      const channelId = notificationType === 'expense_reminder' || notificationType === 'income_reminder' 
        ? 'transactions' 
        : 'default';

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
          ...(Platform.OS === 'android' && { channelId }),
        },
        trigger: null, // Immediate
      });
      
      // Log notification to database
      await addNotificationLog({
        type: notificationType,
        title,
        body,
        data: data ? JSON.stringify(data) : undefined,
      });
    } catch (error) {
      console.error('Error sending immediate notification:', error);
    }
  }

  // Get notification settings from database
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const dbSettings = await getNotificationSettings();
      if (dbSettings) {
        this.notificationSettings = {
          dailyReminder: dbSettings.dailyReminder,
          dailyReminderTime: dbSettings.dailyReminderTime,
          expenseReminder: dbSettings.expenseReminder,
          incomeReminder: dbSettings.incomeReminder,
          weeklySummary: dbSettings.weeklySummary,
          monthlySummary: dbSettings.monthlySummary,
        };
      }
      return { ...this.notificationSettings };
    } catch (error) {
      console.error('Error getting notification settings from database:', error);
      return { ...this.notificationSettings };
    }
  }

  // Update notification settings in database
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      this.notificationSettings = { ...this.notificationSettings, ...settings };
      
      // Convert to database format
      const dbSettings: DBNotificationSettings = {
        dailyReminder: this.notificationSettings.dailyReminder,
        dailyReminderTime: this.notificationSettings.dailyReminderTime,
        expenseReminder: this.notificationSettings.expenseReminder,
        incomeReminder: this.notificationSettings.incomeReminder,
        weeklySummary: this.notificationSettings.weeklySummary,
        monthlySummary: this.notificationSettings.monthlySummary,
        transactionNotifications: true, // Always enabled
        budgetWarnings: true, // Always enabled
        soundEnabled: true, // Default enabled
        vibrationEnabled: true, // Default enabled
      };
      
      await upsertNotificationSettings(dbSettings);
    } catch (error) {
      console.error('Error updating notification settings in database:', error);
    }
  }

  // Check if notifications are enabled
  async areNotificationsEnabled(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return false;
    }
  }

  // Handle notification response (when user taps notification)
  addNotificationResponseListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  // Handle notification received (when app is in foreground)
  addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(listener);
  }
}

export default NotificationService;
