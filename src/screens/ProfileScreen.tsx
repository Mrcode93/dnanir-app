import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  I18nManager,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { List, Switch, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { getUserSettings, getAppSettings, upsertAppSettings, getNotificationSettings, upsertNotificationSettings, upsertUserSettings } from '../database/database';
import { initializeNotifications, requestPermissions, scheduleDailyReminder, sendExpenseReminder, cancelNotification, rescheduleAllNotifications, sendTestNotification, verifyScheduledNotifications } from '../services/notificationService';
import { generateMonthlyReport, sharePDF } from '../services/pdfService';
import { AuthSettingsModal } from '../components/AuthSettingsModal';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { CURRENCIES, Currency } from '../types';
import { alertService } from '../services/alertService';
import { getExchangeRate, upsertExchangeRate } from '../database/database';
import * as Notifications from 'expo-notifications';
import { authApiService } from '../services/authApiService';
import { authStorage } from '../services/authStorage';
import { syncNewToServer, hasUnsyncedData, getFullFromServer } from '../services/syncService';
import { createLocalBackup, restoreFromLastLocalBackup, pickBackupFileAndRestore } from '../services/backupService';
import { referralService, ReferralInfo } from '../services/referralService';

import { CONTACT_INFO, APP_LINKS, SHARE_APP_MESSAGE } from '../constants/contactConstants';
import { convertArabicToEnglish } from '../utils/numbers';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { notifyCurrencyChanged } from '../services/currencyEvents';

export const ProfileScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [userName, setUserName] = useState<string>('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [expenseReminder, setExpenseReminder] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [dailyReminderTime, setDailyReminderTime] = useState<Date>(new Date());
  const [expenseReminderTime, setExpenseReminderTime] = useState<Date>(new Date());
  const [showDailyTimePicker, setShowDailyTimePicker] = useState(false);
  const [showExpenseTimePicker, setShowExpenseTimePicker] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  const [selectedCurrency, setSelectedCurrency] = useState<string>('IQD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ar');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showAuthSettings, setShowAuthSettings] = useState(false);
  const [showExchangeRateModal, setShowExchangeRateModal] = useState(false);
  const [usdToIqdRate, setUsdToIqdRate] = useState<string>('1315');
  const [showCurrencyConverter, setShowCurrencyConverter] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [editingName, setEditingName] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userPhone, setUserPhone] = useState<string>('');
  const [tempHour, setTempHour] = useState<number>(8); // 12-hour format (1-12)
  const [tempMinute, setTempMinute] = useState<number>(0);
  const [tempAmPm, setTempAmPm] = useState<'ص' | 'م'>('م');
  const dailyHourScrollRef = useRef<ScrollView>(null);
  const dailyMinuteScrollRef = useRef<ScrollView>(null);
  const dailyAmPmScrollRef = useRef<ScrollView>(null);
  const expenseHourScrollRef = useRef<ScrollView>(null);
  const expenseMinuteScrollRef = useRef<ScrollView>(null);
  const expenseAmPmScrollRef = useRef<ScrollView>(null);

  const [userData, setUserData] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [hasUnsynced, setHasUnsynced] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreServerLoading, setRestoreServerLoading] = useState(false);
  const [showRestoreServerConfirm, setShowRestoreServerConfirm] = useState(false);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    loadProfileScreenData({ showLoader: true });
    // Reload settings when screen comes into focus
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadProfileScreenData({ showLoader: false });
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [navigation]);

  useEffect(() => {
    if (isAuthenticated) refreshUnsyncedStatus();
  }, [isAuthenticated]);

  const refreshUnsyncedStatus = async () => {
    const v = await hasUnsyncedData();
    setHasUnsynced(v);
  };

  const loadProfileScreenData = async ({
    showLoader = true,
  }: { showLoader?: boolean } = {}) => {
    if (showLoader) setIsProfileLoading(true);
    try {
      await Promise.all([
        loadSettings(),
        checkAuthStatus(),
        refreshUnsyncedStatus(),
      ]);
    } catch (error) {
      console.error('Error loading profile screen data:', error);
    } finally {
      if (showLoader) setIsProfileLoading(false);
    }
  };

  const applyAuthenticatedUser = (user: any) => {
    setIsAuthenticated(true);
    setUserData(user);
    setUserName(user.name || '');
    setUserPhone(user.phone || '');
    if (!referralInfo && !loadingReferral) {
      loadReferralInfo();
    }
  };

  const checkAuthStatus = async (userFromServer?: any, forceServer = false) => {
    // if (__DEV__) {
    //   console.log('🔄 Checking Auth Status...', { hasUserFromServer: !!userFromServer });
    // }
    try {
      if (userFromServer) {
        applyAuthenticatedUser(userFromServer);
        return;
      }

      const token = await authStorage.getAccessToken();
      if (!token) {
        setIsAuthenticated(false);
        setUserData(null);
        setUserPhone('');
        return;
      }

      if (!forceServer) {
        const cachedUser = await authStorage.getUser<any>();
        if (cachedUser) {
          applyAuthenticatedUser(cachedUser);
          return;
        }
      }

      const status = await authApiService.checkAuth();
      // if (__DEV__) {
      //   console.log('✅ Auth API Status:', status);
      // }

      setIsAuthenticated(status.isAuthenticated);
      if (status.isAuthenticated && status.user) {
        applyAuthenticatedUser(status.user);
      } else {
        setUserData(null);
        setUserPhone('');
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      setIsAuthenticated(false);
      setUserData(null);
      setUserPhone('');
    }
  };

  const handleLogout = async () => {
    try {
      await authApiService.logout();
      setIsAuthenticated(false);
      setUserData(null);
      setUserPhone('');
      alertService.success('نجح', 'تم تسجيل الخروج بنجاح');
    } catch (error) {
      alertService.error('خطأ', 'فشل تسجيل الخروج');
    }
  };

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      if (userSettings?.name) {
        setUserName(userSettings.name);
      }

      const appSettings = await getAppSettings();
      if (appSettings) {
        setNotificationsEnabled(appSettings.notificationsEnabled);
        setAutoSyncEnabled(!!appSettings.autoSyncEnabled);
        // Extract currency code from currency string (e.g., "دينار عراقي" -> "IQD")
        const currency = CURRENCIES.find(c => c.name === appSettings.currency);
        if (currency) {
          setSelectedCurrency(currency.code);
        }
      }

      const notificationSettings = await getNotificationSettings();
      if (notificationSettings) {
        setDailyReminder(!!notificationSettings.dailyReminder);
        setExpenseReminder(!!notificationSettings.expenseReminder);

        // Parse daily reminder time
        if (notificationSettings.dailyReminderTime) {
          const [hours, minutes] = notificationSettings.dailyReminderTime.split(':').map(Number);
          const dailyTime = new Date();
          dailyTime.setHours(hours, minutes, 0, 0);
          setDailyReminderTime(dailyTime);
        } else {
          // Default to 8:00 PM if not set
          const dailyTime = new Date();
          dailyTime.setHours(20, 0, 0, 0);
          setDailyReminderTime(dailyTime);
        }

        // Parse expense reminder time
        if (notificationSettings.expenseReminderTime) {
          const [hours, minutes] = notificationSettings.expenseReminderTime.split(':').map(Number);
          const expenseTime = new Date();
          expenseTime.setHours(hours, minutes, 0, 0);
          setExpenseReminderTime(expenseTime);
        } else {
          const expenseTime = new Date();
          expenseTime.setHours(20, 0, 0, 0);
          setExpenseReminderTime(expenseTime);
        }
      } else {
        // Set default times if no settings exist
        const defaultDailyTime = new Date();
        defaultDailyTime.setHours(20, 0, 0, 0);
        setDailyReminderTime(defaultDailyTime);

        const defaultExpenseTime = new Date();
        defaultExpenseTime.setHours(20, 0, 0, 0);
        setExpenseReminderTime(defaultExpenseTime);
      }

      // Load USD to selected currency exchange rate
      const currency = CURRENCIES.find(c => c.code === selectedCurrency);
      if (currency && selectedCurrency !== 'USD') {
        const exchangeRate = await getExchangeRate('USD', selectedCurrency);
        if (exchangeRate) {
          setUsdToIqdRate(exchangeRate.rate.toString());
        } else {
          // Set default rate if not found
          setUsdToIqdRate('1');
        }
      } else {
        setUsdToIqdRate('1');
      }
    } catch (error) {
      // Ignore error
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    const appSettings = await getAppSettings();
    // Create default settings if none exist
    const settingsToSave = appSettings || {
      notificationsEnabled: true,
      darkModeEnabled: false,
      autoBackupEnabled: false,
      autoSyncEnabled: false,
      currency: 'دينار عراقي',
      language: 'ar',
    };
    await upsertAppSettings({ ...settingsToSave, notificationsEnabled: value });
    if (value) {
      const hasPermission = await requestPermissions();
      if (hasPermission) {
        await initializeNotifications();
      } else {
        alertService.warning('إذن مطلوب', 'يرجى السماح بالإشعارات من إعدادات التطبيق');
      }
    } else {
      // Cancel all notifications when disabled
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const handleAutoSyncToggle = async (value: boolean) => {
    if (value) {
      const user = await authStorage.getUser<{ isPro?: boolean; is_pro?: boolean }>();
      const isPro = user?.isPro === true || (user as any)?.is_pro === true;
      if (!isPro) {
        alertService.show({
          title: 'اشتراك مميز',
          message: 'المزامنة التلقائية متاحة للمشتركين المميزين فقط. يجب أن يكون نوع حسابك أو اشتراكك مميزاً.',
          type: 'warning',
          confirmText: 'حسناً',
        });
        return;
      }
    }
    setAutoSyncEnabled(value);
    const appSettings = await getAppSettings();
    const settingsToSave = appSettings || {
      notificationsEnabled: true,
      darkModeEnabled: false,
      autoBackupEnabled: false,
      autoSyncEnabled: false,
      currency: 'دينار عراقي',
      language: 'ar',
    };
    await upsertAppSettings({ ...settingsToSave, autoSyncEnabled: value });
  };

  const handleDailyReminderToggle = async (value: boolean) => {
    setDailyReminder(value);
    const notificationSettings = await getNotificationSettings();

    const dailyTimeString = `${dailyReminderTime.getHours().toString().padStart(2, '0')}:${dailyReminderTime.getMinutes().toString().padStart(2, '0')}`;
    const expenseTimeString = `${expenseReminderTime.getHours().toString().padStart(2, '0')}:${expenseReminderTime.getMinutes().toString().padStart(2, '0')}`;

    const payload = notificationSettings
      ? {
        dailyReminder: value ? 1 : 0,
        dailyReminderTime: notificationSettings.dailyReminderTime ?? dailyTimeString,
        expenseReminder: notificationSettings.expenseReminder ? 1 : 0,
        expenseReminderTime: notificationSettings.expenseReminderTime ?? expenseTimeString,
        incomeReminder: notificationSettings.incomeReminder ? 1 : 0,
        weeklySummary: notificationSettings.weeklySummary ? 1 : 0,
        monthlySummary: notificationSettings.monthlySummary ? 1 : 0,
      }
      : {
        dailyReminder: value ? 1 : 0,
        dailyReminderTime: dailyTimeString,
        expenseReminder: expenseReminder ? 1 : 0,
        expenseReminderTime: expenseTimeString,
        incomeReminder: 1,
        weeklySummary: 1,
        monthlySummary: 1,
      };

    await upsertNotificationSettings(payload);
    await loadSettings();

    if (value) {
      try {
        await scheduleDailyReminder();
      } catch (error) {
        alertService.error('خطأ', 'فشل جدولة التذكير اليومي');
      }
    } else {
      await cancelNotification('daily-reminder');
      await cancelNotification('daily-reminder-repeat');
    }
  };

  const handleExpenseReminderToggle = async (value: boolean) => {
    setExpenseReminder(value);
    const notificationSettings = await getNotificationSettings();

    const dailyTimeString = `${dailyReminderTime.getHours().toString().padStart(2, '0')}:${dailyReminderTime.getMinutes().toString().padStart(2, '0')}`;
    const expenseTimeString = `${expenseReminderTime.getHours().toString().padStart(2, '0')}:${expenseReminderTime.getMinutes().toString().padStart(2, '0')}`;

    const payload = notificationSettings
      ? {
        dailyReminder: notificationSettings.dailyReminder ? 1 : 0,
        dailyReminderTime: notificationSettings.dailyReminderTime ?? dailyTimeString,
        expenseReminder: value ? 1 : 0,
        expenseReminderTime: notificationSettings.expenseReminderTime ?? expenseTimeString,
        incomeReminder: notificationSettings.incomeReminder ? 1 : 0,
        weeklySummary: notificationSettings.weeklySummary ? 1 : 0,
        monthlySummary: notificationSettings.monthlySummary ? 1 : 0,
      }
      : {
        dailyReminder: dailyReminder ? 1 : 0,
        dailyReminderTime: dailyTimeString,
        expenseReminder: value ? 1 : 0,
        expenseReminderTime: expenseTimeString,
        incomeReminder: 1,
        weeklySummary: 1,
        monthlySummary: 1,
      };

    await upsertNotificationSettings(payload);
    await loadSettings();

    if (value) {
      try {
        await sendExpenseReminder();
      } catch (error) {
        alertService.error('خطأ', 'فشل جدولة تذكير المصاريف');
      }
    } else {
      await cancelNotification('expense-reminder');
      await cancelNotification('expense-reminder-repeat');
    }
  };

  const handleDailyTimeChange = async (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowDailyTimePicker(false);
      if (event.type === 'set' && selectedTime) {
        setDailyReminderTime(selectedTime);
        const hours = selectedTime.getHours().toString().padStart(2, '0');
        const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        const notificationSettings = await getNotificationSettings();
        if (notificationSettings) {
          await upsertNotificationSettings({
            ...notificationSettings,
            dailyReminderTime: timeString,
          });
          if (dailyReminder) {
            await scheduleDailyReminder();
          }
        }
      }
    }
  };

  const handleExpenseTimeChange = async (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowExpenseTimePicker(false);
      if (event.type === 'set' && selectedTime) {
        setExpenseReminderTime(selectedTime);
        const hours = selectedTime.getHours().toString().padStart(2, '0');
        const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        const notificationSettings = await getNotificationSettings();
        if (notificationSettings) {
          await upsertNotificationSettings({
            ...notificationSettings,
            expenseReminderTime: timeString,
          });
          if (expenseReminder) {
            await sendExpenseReminder();
          }
        }
      }
    }
  };

  const handleOpenDailyTimePicker = () => {
    const hour24 = dailyReminderTime.getHours();
    const minute = dailyReminderTime.getMinutes();

    // Convert 24-hour to 12-hour format
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const amPm: 'ص' | 'م' = hour24 >= 12 ? 'م' : 'ص';

    setTempHour(hour12);
    setTempMinute(minute);
    setTempAmPm(amPm);
    setShowDailyTimePicker(true);
    setTimeout(() => {
      dailyHourScrollRef.current?.scrollTo({ y: (hour12 - 1) * 50, animated: false });
      dailyMinuteScrollRef.current?.scrollTo({ y: minute * 50, animated: false });
      dailyAmPmScrollRef.current?.scrollTo({ y: amPm === 'ص' ? 0 : 50, animated: false });
    }, 100);
  };

  const handleOpenExpenseTimePicker = () => {
    const hour24 = expenseReminderTime.getHours();
    const minute = expenseReminderTime.getMinutes();

    // Convert 24-hour to 12-hour format
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const amPm: 'ص' | 'م' = hour24 >= 12 ? 'م' : 'ص';

    setTempHour(hour12);
    setTempMinute(minute);
    setTempAmPm(amPm);
    setShowExpenseTimePicker(true);
    setTimeout(() => {
      expenseHourScrollRef.current?.scrollTo({ y: (hour12 - 1) * 50, animated: false });
      expenseMinuteScrollRef.current?.scrollTo({ y: minute * 50, animated: false });
      expenseAmPmScrollRef.current?.scrollTo({ y: amPm === 'ص' ? 0 : 50, animated: false });
    }, 100);
  };

  const handleDailyTimeConfirm = async () => {
    setShowDailyTimePicker(false);

    // Convert 12-hour to 24-hour format
    let hour24 = tempHour;
    if (tempAmPm === 'م' && tempHour !== 12) {
      hour24 = tempHour + 12;
    } else if (tempAmPm === 'ص' && tempHour === 12) {
      hour24 = 0;
    }

    const newTime = new Date();
    newTime.setHours(hour24, tempMinute, 0, 0);
    setDailyReminderTime(newTime);

    const timeString = `${hour24.toString().padStart(2, '0')}:${tempMinute.toString().padStart(2, '0')}`;

    try {
      const notificationSettings = await getNotificationSettings();

      // Build payload with explicit numbers; getNotificationSettings returns booleans for toggles
      const expenseHours = expenseReminderTime.getHours().toString().padStart(2, '0');
      const expenseMinutes = expenseReminderTime.getMinutes().toString().padStart(2, '0');
      const expenseTimeString = `${expenseHours}:${expenseMinutes}`;

      await upsertNotificationSettings({
        dailyReminder: notificationSettings ? (notificationSettings.dailyReminder ? 1 : 0) : (dailyReminder ? 1 : 0),
        dailyReminderTime: timeString,
        expenseReminder: notificationSettings ? (notificationSettings.expenseReminder ? 1 : 0) : (expenseReminder ? 1 : 0),
        expenseReminderTime: notificationSettings?.expenseReminderTime ?? expenseTimeString,
        incomeReminder: notificationSettings ? (notificationSettings.incomeReminder ? 1 : 0) : 1,
        weeklySummary: notificationSettings ? (notificationSettings.weeklySummary ? 1 : 0) : 1,
        monthlySummary: notificationSettings ? (notificationSettings.monthlySummary ? 1 : 0) : 1,
      });

      // Reload from DB so state matches persisted value (handles focus race)
      await loadSettings();

      alertService.success('نجح', `تم حفظ وقت التذكير اليومي: ${timeString}`);

      if (dailyReminder) {
        try {
          await scheduleDailyReminder();
        } catch (error) {
          console.error('Error scheduling daily reminder:', error);
          alertService.error('خطأ', 'تم حفظ الوقت لكن فشل جدولة التذكير');
        }
      }
    } catch (error) {
      console.error('Error saving daily reminder time:', error);
      alertService.error('خطأ', 'فشل حفظ وقت التذكير اليومي');
    }
  };

  const handleExpenseTimeConfirm = async () => {
    setShowExpenseTimePicker(false);

    // Convert 12-hour to 24-hour format
    let hour24 = tempHour;
    if (tempAmPm === 'م' && tempHour !== 12) {
      hour24 = tempHour + 12;
    } else if (tempAmPm === 'ص' && tempHour === 12) {
      hour24 = 0;
    }

    const newTime = new Date();
    newTime.setHours(hour24, tempMinute, 0, 0);
    setExpenseReminderTime(newTime);

    const timeString = `${hour24.toString().padStart(2, '0')}:${tempMinute.toString().padStart(2, '0')}`;

    let notificationSettings = await getNotificationSettings();

    // Create default settings if they don't exist
    if (!notificationSettings) {
      notificationSettings = {
        dailyReminder: dailyReminder ? 1 : 0,
        dailyReminderTime: formatTime(dailyReminderTime),
        expenseReminder: expenseReminder ? 1 : 0,
        expenseReminderTime: timeString,
        incomeReminder: 1,
        weeklySummary: 1,
        monthlySummary: 1,
      };
    }

    await upsertNotificationSettings({
      ...notificationSettings,
      expenseReminderTime: timeString,
    });

    if (expenseReminder) {
      try {
        await sendExpenseReminder();
        alertService.success('نجح', `تم تعيين وقت تذكير المصاريف إلى ${timeString}`);
      } catch (error) {
        alertService.error('خطأ', 'فشل جدولة تذكير المصاريف');
      }
    }
  };

  const renderTimePickerWheel = (type: 'daily' | 'expense') => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 1); // 1-12 for 12-hour format
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const amPmOptions: ('ص' | 'م')[] = ['ص', 'م'];
    const itemHeight = 50;

    const hourRef = type === 'daily' ? dailyHourScrollRef : expenseHourScrollRef;
    const minuteRef = type === 'daily' ? dailyMinuteScrollRef : expenseMinuteScrollRef;
    const amPmRef = type === 'daily' ? dailyAmPmScrollRef : expenseAmPmScrollRef;

    const handleHourScroll = (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / itemHeight);
      const hour = Math.max(1, Math.min(12, index + 1));
      setTempHour(hour);
    };

    const handleMinuteScroll = (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / itemHeight);
      const minute = Math.max(0, Math.min(59, index));
      setTempMinute(minute);
    };

    const handleAmPmScroll = (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / itemHeight);
      const amPm = index === 0 ? 'ص' : 'م';
      setTempAmPm(amPm);
    };

    return (
      <View style={styles.customTimePickerContainer}>
        <View style={styles.timePickerWheel}>
          <View style={styles.timePickerSelectionIndicator} />
          <ScrollView
            ref={hourRef}
            style={styles.timePickerScroll}
            contentContainerStyle={styles.timePickerScrollContent}
            showsVerticalScrollIndicator={false}
            snapToInterval={itemHeight}
            decelerationRate="fast"
            onMomentumScrollEnd={handleHourScroll}
            onScrollEndDrag={handleHourScroll}
          >
            {hours.map((hour) => (
              <View key={hour} style={[styles.timePickerItem, { height: itemHeight }]}>
                <Text style={[
                  styles.timePickerItemText,
                  tempHour === hour && styles.timePickerItemTextSelected
                ]}>
                  {hour.toString().padStart(2, '0')}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.timePickerSeparator}>:</Text>

        <View style={styles.timePickerWheel}>
          <View style={styles.timePickerSelectionIndicator} />
          <ScrollView
            ref={minuteRef}
            style={styles.timePickerScroll}
            contentContainerStyle={styles.timePickerScrollContent}
            showsVerticalScrollIndicator={false}
            snapToInterval={itemHeight}
            decelerationRate="fast"
            onMomentumScrollEnd={handleMinuteScroll}
            onScrollEndDrag={handleMinuteScroll}
          >
            {minutes.map((minute) => (
              <View key={minute} style={[styles.timePickerItem, { height: itemHeight }]}>
                <Text style={[
                  styles.timePickerItemText,
                  tempMinute === minute && styles.timePickerItemTextSelected
                ]}>
                  {minute.toString().padStart(2, '0')}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.timePickerWheel}>
          <View style={styles.timePickerSelectionIndicator} />
          <ScrollView
            ref={amPmRef}
            style={styles.timePickerScroll}
            contentContainerStyle={styles.timePickerScrollContent}
            showsVerticalScrollIndicator={false}
            snapToInterval={itemHeight}
            decelerationRate="fast"
            onMomentumScrollEnd={handleAmPmScroll}
            onScrollEndDrag={handleAmPmScroll}
          >
            {amPmOptions.map((amPm) => (
              <View key={amPm} style={[styles.timePickerItem, { height: itemHeight }]}>
                <Text style={[
                  styles.timePickerItemText,
                  tempAmPm === amPm && styles.timePickerItemTextSelected
                ]}>
                  {amPm}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  const formatTime = (date: Date): string => {
    const hour24 = date.getHours();
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const amPm = hour24 >= 12 ? 'م' : 'ص';
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hour12}:${minutes} ${amPm}`;
  };

  const handleCurrencyChange = async (currencyCode: string) => {
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    if (currency) {
      setSelectedCurrency(currencyCode);
      const appSettings = await getAppSettings();
      // Create default settings if none exist
      const settingsToSave = appSettings || {
        notificationsEnabled: true,
        darkModeEnabled: false,
        autoBackupEnabled: false,
        autoSyncEnabled: false,
        currency: 'دينار عراقي',
        language: 'ar',
      };
      await upsertAppSettings({ ...settingsToSave, currency: currency.name });
      notifyCurrencyChanged();
      setShowCurrencyPicker(false);
      alertService.success('نجح', `تم تغيير العملة إلى ${currency.name}`);

      // Reload exchange rate for new currency
      if (currencyCode !== 'USD') {
        const exchangeRate = await getExchangeRate('USD', currencyCode);
        if (exchangeRate) {
          setUsdToIqdRate(exchangeRate.rate.toString());
        } else {
          setUsdToIqdRate('1');
        }
      } else {
        setUsdToIqdRate('1');
      }
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      const uri = await generateMonthlyReport();
      await sharePDF(uri);
      alertService.success('نجح', 'تم تصدير التقرير بنجاح');
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء تصدير التقرير');
    } finally {
      setExportingPDF(false);
    }
  };



  const handleSaveExchangeRate = async () => {
    if (selectedCurrency === 'USD') {
      alertService.warning('تحذير', 'لا يمكن تعديل سعر الصرف للدولار مع نفسه');
      return;
    }

    const rate = parseFloat(usdToIqdRate);
    if (isNaN(rate) || rate <= 0) {
      alertService.warning('تحذير', 'يرجى إدخال سعر صرف صحيح');
      return;
    }

    try {
      await upsertExchangeRate({
        fromCurrency: 'USD',
        toCurrency: selectedCurrency,
        rate: rate,
      });

      // Also update reverse rate
      await upsertExchangeRate({
        fromCurrency: selectedCurrency,
        toCurrency: 'USD',
        rate: 1 / rate,
      });

      setShowExchangeRateModal(false);
      alertService.success('نجح', 'تم حفظ سعر الصرف بنجاح');
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ سعر الصرف');
    }
  };

  const handleContactEmail = async () => {
    const subject = encodeURIComponent(CONTACT_INFO.emailSubject);
    const body = encodeURIComponent(CONTACT_INFO.emailBody);
    const mailtoUrl = `mailto:${CONTACT_INFO.email}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        alertService.warning('تنبيه', 'لا يمكن فتح تطبيق البريد الإلكتروني');
      }
    } catch (error) {
      console.error('Error opening email:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء فتح البريد الإلكتروني');
    }
  };

  const handleContactWhatsApp = async () => {
    const message = encodeURIComponent(CONTACT_INFO.whatsappMessage);
    const whatsappUrl = `https://wa.me/${CONTACT_INFO.whatsappNumber}?text=${message}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback: try to open WhatsApp app directly
        const whatsappAppUrl = `whatsapp://send?phone=${CONTACT_INFO.whatsappNumber}&text=${message}`;
        try {
          await Linking.openURL(whatsappAppUrl);
        } catch {
          alertService.warning('تنبيه', 'يرجى تثبيت تطبيق WhatsApp');
        }
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء فتح WhatsApp');
    }
  };

  const loadReferralInfo = async () => {
    setLoadingReferral(true);
    try {
      const result = await referralService.getInfo();
      if (result.success && result.data) {
        setReferralInfo(result.data);
      }
    } catch (err) {
      console.error('Error loading referral info:', err);
    } finally {
      setLoadingReferral(false);
    }
  };

  const handleShareReferral = async () => {
    if (!referralInfo?.referralCode) return;

    try {
      const message = `استخدم كود الإحالة الخاص بي (${referralInfo.referralCode}) في تطبيق "دنانير" لتحصل على 7 أيام اشتراك برو مجاناً!\n\nحمل التطبيق من هنا: ${APP_LINKS.apple}`;
      await Share.share({
        message,
      });
    } catch (error) {
      console.error('Error sharing referral:', error);
    }
  };

  const handleShareApp = async () => {
    try {
      // أيفون → رابط App Store، أندرويد → رابط تيليجرام
      const shareUrl = Platform.OS === 'ios' ? APP_LINKS.apple : APP_LINKS.telegram;
      const message = `${SHARE_APP_MESSAGE}\n${shareUrl}`;
      await Share.share({
        message,
        url: Platform.OS === 'ios' ? shareUrl : undefined,
        title: 'دنانير - تطبيق المالية الشخصية',
      });
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        alertService.error('خطأ', 'لم تتم المشاركة');
      }
    }
  };

  const renderProfileSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonProfileCard}>
        <View style={styles.skeletonProfileHeader}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonProfileInfo}>
            <View style={[styles.skeletonLine, styles.skeletonLineLg]} />
            <View style={[styles.skeletonLine, styles.skeletonLineMd]} />
            <View style={[styles.skeletonLine, styles.skeletonLineSm]} />
          </View>
        </View>
      </View>

      <View style={styles.skeletonSectionCard}>
        <View style={styles.skeletonSectionHeader} />
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonTextGroup}>
            <View style={[styles.skeletonLine, styles.skeletonLineMd]} />
            <View style={[styles.skeletonLine, styles.skeletonLineSm]} />
          </View>
        </View>
        <View style={styles.skeletonRow}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonTextGroup}>
            <View style={[styles.skeletonLine, styles.skeletonLineMd]} />
            <View style={[styles.skeletonLine, styles.skeletonLineSm]} />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isProfileLoading ? (
          renderProfileSkeleton()
        ) : (
          <>
            {/* Premium Profile Section */}
            <LinearGradient
              colors={userData?.isPro ? (['#0f0e0a', '#2d2814', '#5c4a1a', '#8B6914'] as any) : (theme.gradients.primary as any)}
              style={[styles.profileCard, userData?.isPro && styles.profileCardPro]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isAuthenticated ? (
                <>
                  <View style={styles.profileHeader}>
                    <View style={styles.avatarWrapper}>
                      <View style={[styles.avatarContainer, userData?.isPro && styles.avatarContainerPro]}>
                        <Ionicons name="person" size={28} color={userData?.isPro ? '#C9A227' : theme.colors.primary} />
                      </View>
                      {userData?.isPro ? (
                        <View style={styles.proCrownBadge}>
                          <Ionicons name="diamond" size={10} color="#FFF" />
                        </View>
                      ) : (
                        <View style={styles.onlineBadge} />
                      )}
                    </View>
                    <View style={styles.userInfo}>
                      <View style={styles.userNameRow}>
                        {userData?.isPro && (
                          <View style={styles.proCrownBanner}>
                            <Ionicons name="diamond" size={12} color="#F5E6A3" />
                            <Text style={styles.proCrownBannerText}>عضو مميز</Text>
                          </View>
                        )}
                        <Text style={[styles.userNameText, userData?.isPro && styles.userNameTextPro]} numberOfLines={1}>
                          {userData?.name || 'مستخدم دنانير'}
                        </Text>
                      </View>
                      <Text style={[styles.userEmail, userData?.isPro && styles.userEmailPro]} numberOfLines={1}>
                        {userData?.email || userData?.phone || 'لا يوجد بريد إلكتروني'}
                      </Text>
                      <View style={[styles.verifiedBadge, userData?.isPro && styles.verifiedBadgePro]}>
                        <Ionicons name={userData?.isPro ? 'diamond' : 'shield-checkmark'} size={12} color="#FFFFFF" />
                        <Text style={styles.verifiedText}>{userData?.isPro ? 'حساب مميز' : 'حساب موثق'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingName(userName);
                        setShowNameModal(true);
                      }}
                      style={styles.editProfileBtn}
                    >
                      <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {isAuthenticated && userData?.isPro && (
                    <View style={styles.proFeaturesRow}>
                      <View style={styles.proFeaturePill}>
                        <Ionicons name="cloud-done" size={14} color="#F5E6A3" />
                        <Text style={styles.proFeaturePillText}>نسخ احتياطي</Text>
                      </View>
                      <View style={styles.proFeaturePill}>
                        <Ionicons name="sparkles" size={14} color="#F5E6A3" />
                        <Text style={styles.proFeaturePillText}>تحليل ذكي</Text>
                      </View>
                      <View style={styles.proFeaturePill}>
                        <Ionicons name="sync" size={14} color="#F5E6A3" />
                        <Text style={styles.proFeaturePillText}>مزامنة</Text>
                      </View>
                      {userData?.id != null && (
                        <TouchableOpacity
                          onPress={async () => {
                            const id = String(userData.id);
                            await Clipboard.setStringAsync(id);
                            alertService.success('تم النسخ', 'تم نسخ معرف المستخدم');
                          }}
                          style={styles.proFeaturePill}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="copy-outline" size={14} color="#F5E6A3" />
                          <Text style={styles.proFeaturePillText}>نسخ المعرف</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {isAuthenticated && !userData?.isPro && userData?.id != null && (
                    <TouchableOpacity
                      onPress={async () => {
                        const id = String(userData.id);
                        await Clipboard.setStringAsync(id);
                        alertService.success('تم النسخ', 'تم نسخ معرف المستخدم');
                      }}
                      style={styles.copyIdButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="copy-outline" size={14} color="rgba(255, 255, 255, 0.8)" />
                      <Text style={styles.copyIdLabel}>نسخ معرف المستخدم</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.unauthProfileHeader}>
                  <View style={styles.unauthTextContainer}>
                    <Text style={styles.unauthTitle}>أهلاً بك في دنانير</Text>
                    <Text style={styles.unauthSubtitle}>سجل دخولك لمزامنة بياناتك والحصول على ميزات إضافية</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.loginBtnHeader}
                    onPress={() => {
                      navigation.navigate('Auth', {
                        onSuccess: (user: any) => checkAuthStatus(user)
                      });
                    }}
                  >
                    <Text style={styles.loginBtnHeaderText}>دخول / تسجيل</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>

            {/* Account Section - Removed for now */}

            {/* 2. حسابي والأمان */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person-circle-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>حسابي والأمان</Text>
                </View>

                {/* Temporarily disabled Security Settings 
                <TouchableOpacity
                  onPress={() => setShowAuthSettings(true)}
                  style={styles.premiumRow}
                  activeOpacity={0.7}
                >
                  <View style={[styles.premiumIconBox, { backgroundColor: '#8B5CF620' }]}>
                    <Ionicons name="lock-closed" size={22} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.premiumItemTitle}>الأمان والقفل</Text>
                    <Text style={styles.premiumItemSubtitle}>كلمة مرور، Face ID، أو البصمة</Text>
                  </View>
                  <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                */}

                {!isAuthenticated && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Auth', {
                      onSuccess: (user: any) => checkAuthStatus(user)
                    })}
                    style={styles.premiumRow}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.premiumIconBox, { backgroundColor: '#3B82F620' }]}>
                      <Ionicons name="person-add" size={22} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.premiumItemTitle}>إنشاء حساب / دخول</Text>
                      <Text style={styles.premiumItemSubtitle}>لحفظ بياناتك وموعد ميزانيتك</Text>
                    </View>
                    <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}

                {isAuthenticated && (
                  <TouchableOpacity
                    onPress={handleLogout}
                    style={[styles.premiumRow, { backgroundColor: '#EF444405', borderColor: '#EF444420' }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.premiumIconBox, { backgroundColor: '#EF444420' }]}>
                      <Ionicons name="log-out" size={22} color="#EF4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.premiumItemTitle, { color: '#EF4444' }]}>تسجيل الخروج</Text>
                      <Text style={styles.premiumItemSubtitle}>الخروج من الحساب الحالي</Text>
                    </View>
                    <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
                {isAuthenticated && (
                  <View style={styles.premiumRow}>
                    <View style={[styles.premiumIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Ionicons name="sync" size={22} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.premiumItemTitle}>مزامنة تلقائية</Text>
                      <Text style={styles.premiumItemSubtitle}>مزامنة البيانات تلقائياً عند فتح التطبيق (مميز)</Text>
                    </View>
                    <Switch
                      value={autoSyncEnabled}
                      onValueChange={handleAutoSyncToggle}
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    />
                  </View>
                )}
                {isAuthenticated && (
                  <TouchableOpacity
                    onPress={async () => {
                      if (syncing) return;
                      const user = await authStorage.getUser<{ isPro?: boolean; is_pro?: boolean }>();
                      const isPro = user?.isPro === true || (user as any)?.is_pro === true;
                      if (!isPro) {
                        alertService.show({
                          title: 'اشتراك مميز',
                          message: 'مزامنة البيانات متاحة للمشتركين المميزين فقط.',
                          type: 'warning',
                          confirmText: 'حسناً',
                        });
                        return;
                      }
                      setSyncing(true);
                      const result = await syncNewToServer();
                      setSyncing(false);
                      if (result.success) {
                        alertService.success('تمت المزامنة', result.count > 0 ? `تمت إضافة ${result.count} عنصر جديد` : 'لا توجد بيانات جديدة');
                      } else {
                        alertService.error('فشل المزامنة', result.error);
                      }
                    }}
                    style={[styles.premiumRow, { backgroundColor: theme.colors.primary + '05', borderColor: theme.colors.primary + '20' }]}
                    activeOpacity={0.7}
                    disabled={syncing}
                  >
                    <View style={[styles.premiumIconBox, { backgroundColor: theme.colors.primary + '20' }]}>
                      {syncing ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <Ionicons name="cloud-upload" size={22} color={theme.colors.primary} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.premiumItemTitle}>
                        {syncing ? 'جاري المزامنة...' : 'مزامنة البيانات'}
                      </Text>
                      <Text style={styles.premiumItemSubtitle}>إضافة البيانات الجديدة للسيرفر (مميز)</Text>
                    </View>
                    {!syncing && <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={18} color={theme.colors.textSecondary} />}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Referral Program Section */}
            {isAuthenticated && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionContent}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="gift-outline" size={22} color="#F59E0B" />
                    <Text style={styles.sectionTitle}>برنامج الإحالة</Text>
                  </View>

                  <View style={styles.referralCard}>
                    <View style={styles.referralHero}>
                      <View style={styles.referralIconBox}>
                        <Ionicons name="gift" size={32} color="#F59E0B" />
                      </View>
                      <View style={styles.referralTextContent}>
                        <Text style={styles.referralTitleText}>ادعُ أصدقاءك واكسب "برو"</Text>
                        <Text style={styles.referralSubtitleText}>كل صديق يستخدم الكود المخصص لك، ستحصل أنت وهو على 7 أيام اشتراك برو مجاناً!</Text>
                      </View>
                    </View>

                    {loadingReferral ? (
                      <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 20 }} />
                    ) : referralInfo ? (
                      <View style={styles.referralCodeBox}>
                        <View style={styles.codeContainer}>
                          <Text style={styles.codeLabel}>الكود المخصص لك:</Text>
                          <View style={styles.codeRow}>
                            <Text style={styles.codeValue}>{referralInfo.referralCode}</Text>
                            <TouchableOpacity
                              onPress={async () => {
                                await Clipboard.setStringAsync(referralInfo.referralCode);
                                alertService.toastSuccess('تم نسخ الكود');
                              }}
                              style={styles.copyButton}
                            >
                              <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={styles.referralStatBox}>
                          <Text style={styles.referralStatLabel}>عدد الإحالات الناجحة:</Text>
                          <Text style={styles.referralStatValue}>{referralInfo.referralCount || 0}</Text>
                        </View>

                        <TouchableOpacity
                          onPress={handleShareReferral}
                          style={styles.shareCodeButton}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                          <Text style={styles.shareCodeButtonText}>مشاركة الكود مع الأصدقاء</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.referralErrorText}>فشل تحميل بيانات الإحالة. يرجى سحب الصفحة للتحديث.</Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
        )}

      </ScrollView >

      <AuthSettingsModal
        visible={showAuthSettings}
        onClose={() => setShowAuthSettings(false)}
        onAuthChanged={() => {
          // Reload settings if needed
        }}
      />


      {/* Exchange Rate Modal */}
      {
        showExchangeRateModal && selectedCurrency !== 'USD' && (
          <ExchangeRateModal
            visible={showExchangeRateModal}
            rate={usdToIqdRate}
            selectedCurrency={selectedCurrency}
            onRateChange={setUsdToIqdRate}
            onSave={handleSaveExchangeRate}
            onClose={() => setShowExchangeRateModal(false)}
          />
        )
      }

      {/* Daily Reminder Time Picker */}
      <Modal
        visible={showDailyTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDailyTimePicker(false)}
      >
        <View style={styles.timePickerModalOverlay}>
          <View style={styles.timePickerModalContent}>
            <View style={styles.timePickerModalHeader}>
              <TouchableOpacity
                onPress={handleDailyTimeConfirm}
                style={styles.timePickerConfirmButton}
              >
                <Text style={styles.timePickerConfirmText}>تأكيد</Text>
              </TouchableOpacity>
              <Text style={styles.timePickerModalTitle}>اختر الوقت</Text>
              <TouchableOpacity
                onPress={() => setShowDailyTimePicker(false)}
                style={styles.timePickerCancelButton}
              >
                <Text style={styles.timePickerCancelText}>إلغاء</Text>
              </TouchableOpacity>
            </View>
            {renderTimePickerWheel('daily')}
          </View>
        </View>
      </Modal>





      {/* Name Edit Modal */}
      <Modal
        visible={showNameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>تعديل الاسم</Text>
                <TouchableOpacity
                  onPress={() => setShowNameModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>الاسم</Text>
                <TextInput
                  style={styles.nameInput}
                  value={editingName}
                  onChangeText={setEditingName}
                  placeholder="أدخل اسمك"
                  placeholderTextColor={theme.colors.textMuted}
                  autoFocus={true}
                  maxLength={50}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowNameModal(false)}
                  style={[styles.modalButton, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!editingName.trim()) {
                      alertService.warning('تنبيه', 'يرجى إدخال الاسم');
                      return;
                    }

                    try {
                      // 1. Update locally
                      const currentSettings = await getUserSettings();
                      await upsertUserSettings({
                        name: editingName.trim() || undefined,
                        authMethod: currentSettings?.authMethod || 'none',
                        passwordHash: currentSettings?.passwordHash,
                        biometricsEnabled: currentSettings?.biometricsEnabled || false,
                      });

                      setUserName(editingName.trim());

                      // 2. Update on server if authenticated
                      if (isAuthenticated) {
                        const result = await authApiService.updateProfile(editingName.trim());
                        if (result.success && result.user) {
                          setUserData(result.user);
                        } else if (!result.success) {
                          // If server update fails, we still keep local for now but log it
                          console.error('Failed to sync name to server:', result.error);
                        }
                      }

                      setShowNameModal(false);
                      alertService.success('نجح', 'تم تحديث الاسم بنجاح');
                    } catch (error) {
                      console.error('Error saving name:', error);
                      alertService.error('خطأ', 'فشل تحديث الاسم');
                    }
                  }}
                  style={[styles.modalButton, styles.saveButton]}
                >
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.saveButtonGradient}
                  >
                    <Text style={styles.saveButtonText}>حفظ</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </Modal>


    </SafeAreaView >
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    direction: 'rtl' as const,
  },
  skeletonContainer: {
    gap: theme.spacing.md,
  },
  skeletonProfileCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border + '30',
    ...getPlatformShadow('sm'),
  },
  skeletonProfileHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  skeletonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceLight,
  },
  skeletonProfileInfo: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceLight,
  },
  skeletonLineLg: {
    width: '70%',
    height: 16,
  },
  skeletonLineMd: {
    width: '52%',
  },
  skeletonLineSm: {
    width: '36%',
  },
  skeletonSectionCard: {
    borderRadius: 24,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border + '30',
    ...getPlatformShadow('sm'),
    gap: 12,
  },
  skeletonSectionHeader: {
    height: 18,
    width: '45%',
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceLight,
    marginBottom: 2,
  },
  skeletonRow: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
  },
  skeletonTextGroup: {
    flex: 1,
    gap: 8,
  },
  sectionCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border + '30',
    ...getPlatformShadow('md'),
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '20',
  },
  sectionContent: {
    padding: theme.spacing.lg,
    direction: 'rtl' as const,
  },
  profileCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('lg'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  profileCardPro: {
    borderColor: 'rgba(212, 175, 55, 0.6)',
    borderWidth: 1.5,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  proCrownBanner: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginBottom: 4,
    alignSelf: isRTL ? 'flex-start' : 'flex-end',
  },
  proCrownBannerText: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('700'),
    color: '#F5E6A3',
    fontFamily: theme.typography.fontFamily,
  },
  profileHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarContainerPro: {
    borderColor: 'rgba(212, 175, 55, 0.6)',
  },
  proCrownBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#B8860B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F5E6A3',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  userInfo: {
    flex: 1,
    gap: 3,
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  userNameRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  userNameTextPro: {
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  proSparkIcon: {
    opacity: 0.95,
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: theme.typography.fontFamily,
  },
  userEmailPro: {
    color: 'rgba(245, 230, 163, 0.95)',
  },
  verifiedBadge: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: isRTL ? 'flex-start' : 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  verifiedBadgePro: {
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  unauthProfileHeader: {
    paddingVertical: 15,
    alignItems: 'center',
    gap: 20,
  },
  unauthTextContainer: {
    alignItems: 'center',
    gap: 8,
  },
  unauthTitle: {
    fontSize: 24,
    fontWeight: getPlatformFontWeight('900'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  unauthSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    paddingHorizontal: 30,
    lineHeight: 22,
  },
  loginBtnHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    ...getPlatformShadow('md'),
  },
  loginBtnHeaderText: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('900'),
    fontSize: 17,
    fontFamily: theme.typography.fontFamily,
  },
  statsRow: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    fontFamily: theme.typography.fontFamily,
  },
  statValue: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  statValuePro: {
    color: '#FDE047',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  copyIdButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
  },
  copyIdLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
  },
  statDivider: {
    width: 1,
    height: '60%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  proFeaturesRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 230, 163, 0.2)',
  },
  proFeaturePill: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  proFeaturePillText: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('600'),
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: theme.typography.fontFamily,
  },
  actionItem: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border + '20',
  },
  actionItemGradient: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  actionItemLeft: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemInfo: {
    flex: 1,
  },
  actionItemTitleWhite: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  actionItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },

  // Premium Custom Action Items (no full color, cleaner look)
  premiumRow: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border + '15',
  },
  premiumIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : 16,
    marginLeft: isRTL ? 16 : 0,
  },
  premiumItemTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  premiumItemSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    textAlign: 'left',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 32,
    overflow: 'hidden',
    ...getPlatformShadow('xl'),
    borderWidth: 1,
    borderColor: theme.colors.border + '20',
  },
  modalHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '15',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 10,
    textAlign: isRTL ? 'right' : 'left',
  },
  nameInput: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    borderWidth: 1,
    borderColor: theme.colors.border + '40',
  },
  modalActions: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '15',
  },
  modalButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceLight,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'left' : 'right',
  },
  accountInfo: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border + '15',
  },
  accountInfoLeft: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfoText: {
    flex: 1,
  },
  accountStatusText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  accountPhoneText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  loginButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  loginButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  loginButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  logoutButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    ...getPlatformShadow('sm'),
  },
  logoutButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  logoutButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  listItemTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  listItemDescription: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  notificationItem: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    direction: 'rtl' as const,
  },
  notificationItemHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationItemLeft: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationItemInfo: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  notificationItemDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  timePickerButton: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceLight,
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border + '20',
  },
  timePickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'left' : 'right',
  },
  testNotificationButton: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  testNotificationButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  testNotificationButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  exportButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 8,
    ...getPlatformShadow('md'),
  },
  exportButtonGradient: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily,
    color: '#FFFFFF',
  },
  currencyItem: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
    ...getPlatformShadow('sm'),
  },
  currencyItemGradient: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  currencyItemLeft: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  currencyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyItemInfo: {
    flex: 1,
  },
  currencyItemTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  currencyItemTitleWhite: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  currencyItemDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  currencyItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  currencyPicker: {
    marginTop: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border + '20',
  },
  currencyOption: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceCard,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primary + '10',
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  currencyOptionText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  currencyOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('800'),
  },
  authItem: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    ...getPlatformShadow('sm'),
  },
  authItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    direction: 'rtl' as const,
  },
  authItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  authIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authItemInfo: {
    flex: 1,
  },
  authItemTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  authItemTitleWhite: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  authItemDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  authItemDescriptionWhite: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  exchangeRateItem: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 12,
    ...getPlatformShadow('sm'),
  },
  exchangeRateItemGradient: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  exchangeRateItemLeft: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  exchangeRateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeRateItemInfo: {
    flex: 1,
  },
  exchangeRateItemTitleWhite: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  exchangeRateItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  contactItem: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 14,
    ...getPlatformShadow('md'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  contactItemGradient: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  contactItemLeft: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  contactIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  contactItemInfo: {
    flex: 1,
    gap: 2,
  },
  contactItemTitleWhite: {
    fontSize: 17,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  contactItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    lineHeight: 18,
    fontWeight: getPlatformFontWeight('500'),
  },
  copyrightWrapper: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  copyrightCard: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    ...getPlatformShadow('md'),
  },
  copyrightLogo: {
    width: 140,
    height: 45,
    marginBottom: 8,
    tintColor: '#FFFFFF',
  },
  copyrightText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    marginTop: 4,
  },
  exchangeRateModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  exchangeRateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  exchangeRateModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
    zIndex: 2,
    position: 'relative',
  },
  exchangeRateModalGradient: {
    width: '100%',
    minHeight: 300,
  },
  exchangeRateModalSafeArea: {
    width: '100%',
  },
  exchangeRateModalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  exchangeRateModalCloseButton: {
    padding: theme.spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeRateModalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    flex: 1,
  },
  exchangeRateModalContent: {
    padding: theme.spacing.lg,
  },
  exchangeRateInfoCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('md'),
  },
  exchangeRateInfoCardGradient: {
    padding: theme.spacing.lg,
  },
  exchangeRateInfoCardContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  exchangeRateInfoCardText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  exchangeRateInputSection: {
    marginBottom: theme.spacing.lg,
  },
  exchangeRateInputLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: isRTL ? 'right' : 'left',
  },
  exchangeRateInputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...getPlatformShadow('sm'),
  },
  exchangeRateInput: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    paddingVertical: theme.spacing.xs,
  },
  exchangeRateInputUnit: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
  },
  exchangeRateHint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: isRTL ? 'right' : 'left',
    opacity: 0.7,
  },
  exchangeRateModalActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  exchangeRateCancelButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  exchangeRateCancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  exchangeRateSaveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  exchangeRateSaveButtonGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeRateSaveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  placeholder: {
    width: 40,
  },
  timePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timePickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : theme.spacing.lg,
    maxHeight: '50%',
    ...getPlatformShadow('lg'),
    direction: 'rtl' as const,
  },
  timePickerModalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  timePickerModalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    textAlign: 'center',
  },
  timePickerCancelButton: {
    padding: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  timePickerCancelText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  timePickerConfirmButton: {
    padding: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'flex-start',
  },
  timePickerConfirmText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  customTimePickerContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    backgroundColor: '#FFFFFF',
    minHeight: 250,
    position: 'relative',
  },
  timePickerWheel: {
    height: 250,
    width: 80,
    overflow: 'hidden',
    position: 'relative',
  },
  timePickerScroll: {
    flex: 1,
  },
  timePickerScrollContent: {
    paddingVertical: 100,
  },
  timePickerItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerItemText: {
    fontSize: 24,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
  },
  timePickerItemTextSelected: {
    fontSize: 28,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
  timePickerSeparator: {
    fontSize: 32,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: theme.spacing.md,
  },
  timePickerSelectionIndicator: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    height: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    pointerEvents: 'none',
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...getPlatformShadow('sm'),
  },
  referralHero: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  referralIconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#F59E0B15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralTextContent: {
    flex: 1,
  },
  referralTitleText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: '#1E293B',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  referralSubtitleText: {
    fontSize: 13,
    color: '#64748B',
    fontFamily: theme.typography.fontFamily,
    lineHeight: 18,
    textAlign: 'left',
  },
  referralCodeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeContainer: {
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: getPlatformFontWeight('900'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    letterSpacing: 1,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralStatBox: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  referralStatLabel: {
    fontSize: 14,
    color: '#64748B',
    fontFamily: theme.typography.fontFamily,
  },
  referralStatValue: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: '#1E293B',
    fontFamily: theme.typography.fontFamily,
  },
  shareCodeButton: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    height: 52,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...getPlatformShadow('md'),
  },
  shareCodeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  referralErrorText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    backgroundColor: '#EF444410',
    padding: 12,
    borderRadius: 12,
  },
});

interface ExchangeRateModalProps {
  visible: boolean;
  rate: string;
  selectedCurrency: string;
  onRateChange: (rate: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const ExchangeRateModal: React.FC<ExchangeRateModalProps> = ({
  visible,
  rate,
  selectedCurrency,
  onRateChange,
  onSave,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.exchangeRateModalOverlay}>
        <TouchableOpacity
          style={styles.exchangeRateModalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.exchangeRateModalContainer}>
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.exchangeRateModalGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <SafeAreaView edges={['top']} style={styles.exchangeRateModalSafeArea}>
                {/* Header */}
                <View style={styles.exchangeRateModalHeader}>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.exchangeRateModalCloseButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                  <Text style={styles.exchangeRateModalTitle}>تعديل سعر الصرف</Text>
                  <View style={styles.placeholder} />
                </View>

                {/* Content */}
                <View style={styles.exchangeRateModalContent}>
                  <View style={styles.exchangeRateInfoCard}>
                    <LinearGradient
                      colors={theme.gradients.primary as any}
                      style={styles.exchangeRateInfoCardGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.exchangeRateInfoCardContent}>
                        <Ionicons name="cash" size={32} color="#FFFFFF" />
                        <Text style={styles.exchangeRateInfoCardText}>
                          1 USD = ? IQD
                        </Text>
                      </View>
                    </LinearGradient>
                  </View>

                  <View style={styles.exchangeRateInputSection}>
                    <Text style={styles.exchangeRateInputLabel}>
                      سعر الصرف (1 دولار = ? {CURRENCIES.find(c => c.code === selectedCurrency)?.name || 'دينار عراقي'})
                    </Text>
                    <View style={styles.exchangeRateInputContainer}>
                      <TextInput
                        style={styles.exchangeRateInput}
                        value={rate}
                        onChangeText={(val) => onRateChange(convertArabicToEnglish(val))}
                        placeholder="1315"
                        placeholderTextColor={theme.colors.textSecondary}
                        keyboardType="decimal-pad"
                        textAlign={isRTL ? 'right' : 'left'}
                      />
                      <Text style={styles.exchangeRateInputUnit}>
                        {selectedCurrency}
                      </Text>
                    </View>
                    <Text style={styles.exchangeRateHint}>
                      أدخل سعر الصرف الحالي للدولار مقابل {CURRENCIES.find(c => c.code === selectedCurrency)?.name || 'الدينار العراقي'}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View style={styles.exchangeRateModalActions}>
                    <TouchableOpacity
                      onPress={onClose}
                      style={styles.exchangeRateCancelButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.exchangeRateCancelButtonText}>إلغاء</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={onSave}
                      style={styles.exchangeRateSaveButton}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={theme.gradients.primary as any}
                        style={styles.exchangeRateSaveButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.exchangeRateSaveButtonText}>حفظ</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </SafeAreaView>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
