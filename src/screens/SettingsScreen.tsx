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
import { getUserSettings, getAppSettings, upsertAppSettings, getNotificationSettings, upsertNotificationSettings, upsertUserSettings, recalculateAllBaseAmounts } from '../database/database';
import { initializeNotifications, requestPermissions, scheduleDailyReminder, sendExpenseReminder, cancelNotification, rescheduleAllNotifications, sendTestNotification, verifyScheduledNotifications } from '../services/notificationService';
import { generateMonthlyReport, generateFullReport, sharePDF } from '../services/pdfService';
import { AuthSettingsModal } from '../components/AuthSettingsModal';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { CURRENCIES, Currency } from '../types';
import { alertService } from '../services/alertService';
import { getExchangeRate, upsertExchangeRate } from '../database/database';
import * as Notifications from 'expo-notifications';
import { authApiService } from '../services/authApiService';
import { authStorage } from '../services/authStorage';
import { syncNewToServer, hasUnsyncedData, getFullFromServer, deleteSyncDataFromServer } from '../services/syncService';
import { createLocalBackup, restoreFromLastLocalBackup, pickBackupFileAndRestore } from '../services/backupService';
import { referralService, ReferralInfo } from '../services/referralService';
import { authenticateWithDevice } from '../services/authService';
import { deleteAllData } from '../database/database';

import { CONTACT_INFO, APP_LINKS, SHARE_APP_MESSAGE } from '../constants/contactConstants';
import { convertArabicToEnglish } from '../utils/numbers';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { notifyCurrencyChanged } from '../services/currencyEvents';
import { convertCurrency } from '../services/currencyService';

export const SettingsScreen = ({ navigation }: any) => {
  const { theme, themeMode, setThemeMode, isDark } = useAppTheme();
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
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'monthly' | 'all'>('monthly');
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadSettings();
    checkAuthStatus();
    // Reload settings when screen comes into focus
    const unsubscribe = navigation?.addListener?.('focus', () => {
      loadSettings();
      checkAuthStatus();
      refreshUnsyncedStatus();
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

  const checkAuthStatus = async (userFromServer?: any) => {
    // if (__DEV__) {
    //   
    // }
    try {
      if (userFromServer) {
        setIsAuthenticated(true);
        setUserData(userFromServer);
        setUserName(userFromServer.name || '');
        setUserPhone(userFromServer.phone || '');
        return;
      }

      const status = await authApiService.checkAuth();
      // if (__DEV__) {
      //   
      // }

      setIsAuthenticated(status.isAuthenticated);
      if (status.isAuthenticated && status.user) {
        setUserData(status.user);
        setUserName(status.user.name || '');
        setUserPhone(status.user.phone || '');
        loadReferralInfo();
      } else {
        setUserData(null);
      }
    } catch (error) {
      
      setIsAuthenticated(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApiService.logout();
      setIsAuthenticated(false);
      setUserPhone('');
      alertService.toastSuccess('تم تسجيل الخروج بنجاح');
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
      themeMode: 'light',
      autoBackupEnabled: false,
      autoSyncEnabled: false,
      currency: 'دينار عراقي',
      language: 'ar',
    };
    await upsertAppSettings({ ...settingsToSave, notificationsEnabled: value, themeMode: settingsToSave.themeMode });
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
      themeMode: 'light',
      autoBackupEnabled: false,
      autoSyncEnabled: false,
      currency: 'دينار عراقي',
      language: 'ar',
    };
    await upsertAppSettings({ ...settingsToSave, autoSyncEnabled: value, themeMode: settingsToSave.themeMode });
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

      alertService.toastSuccess(`تم حفظ وقت التذكير اليومي: ${timeString}`);

      if (dailyReminder) {
        try {
          await scheduleDailyReminder();
        } catch (error) {
          
          alertService.error('خطأ', 'تم حفظ الوقت لكن فشل جدولة التذكير');
        }
      }
    } catch (error) {
      
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
        alertService.toastSuccess(`تم تعيين وقت تذكير المصاريف إلى ${timeString}`);
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
        themeMode: 'light',
        autoBackupEnabled: false,
        autoSyncEnabled: false,
        currency: 'دينار عراقي',
        language: 'ar',
      };
      await upsertAppSettings({ ...settingsToSave, currency: currency.name, themeMode: settingsToSave.themeMode });

      // Recalculate all base amounts for existing records based on the new target currency
      try {
        
        await recalculateAllBaseAmounts(currencyCode, convertCurrency);
      } catch (error) {
        
        // We continue anyway so the currency change takes effect, even if historical normalization fails
      }

      notifyCurrencyChanged();
      setShowCurrencyPicker(false);
      alertService.toastSuccess(`تم تغيير العملة إلى ${currency.name}`);

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
  }; const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      let uri = '';
      if (exportMode === 'all') {
        uri = await generateFullReport();
      } else {
        uri = await generateMonthlyReport(exportMonth, exportYear);
      }
      await sharePDF(uri);
      setShowExportModal(false);
    } catch (error) {
      
      alertService.error('خطأ', 'فشل تصدير التقرير');
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
      alertService.toastSuccess('تم حفظ سعر الصرف بنجاح');
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
      
    }
  };

  const handleDeleteAllData = async () => {
    try {
      const authenticated = await authenticateWithDevice('يرجى التحقق من الهوية لحذف جميع البيانات');

      if (authenticated) {
        setDeletingAll(true);

        // 1. Delete local data
        await deleteAllData();

        // 2. Delete server data if logged in
        try {
          await deleteSyncDataFromServer();
        } catch (serverError) {
          
          // We don't block local success because local data is already gone
        }

        setDeletingAll(false);
        alertService.toastSuccess('تم حذف جميع بيانات التطبيق بنجاح (محلياً ومن السيرفر)');
        await loadSettings();
      }
    } catch (error) {
      setDeletingAll(false);
      
      alertService.error('خطأ', 'حدث خطأ أثناء مسح البيانات');
    }
  };

  const handleShareApp = async () => {
    try {
      // رابط موحد لكل المنصات
      const shareUrl = 'https://urux.guru/apps';
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

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Profile Navigation Block (NEW) */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={[styles.sectionCard, { marginTop: 16 }]}
          activeOpacity={0.7}
        >
          <View style={[styles.sectionContent, { flexDirection: 'row', alignItems: 'center' }]}>
            <View style={[styles.avatarContainer, { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={24} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 16, marginRight: 16 }}>
              <Text style={styles.profileTitle}>الحساب والملف الشخصي</Text>
              <Text style={styles.profileSubtitle}>إدارة الحساب، المزامنة، والإحالة</Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={24} color={theme.colors.textMuted} />
          </View>
        </TouchableOpacity>

        {/* 1. الإعدادات العامة */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="settings-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>الإعدادات العامة</Text>
            </View>

            <View style={styles.premiumRow}>
              <View style={[styles.premiumIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="notifications" size={22} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.premiumItemTitle}>الإشعارات</Text>
                <Text style={styles.premiumItemSubtitle}>تلقي تنبيهات حول المصاريف والأهداف</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: '#767577', true: theme.colors.primary }}
                thumbColor={notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>

            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.premiumIconBox, { backgroundColor: '#8B5CF615', width: 36, height: 36, borderRadius: 10 }]}>
                  <Ionicons name="color-palette" size={18} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.premiumItemTitle, { fontSize: 15 }]}>المظهر (Theme)</Text>
                </View>
              </View>

              <View style={styles.themeOptionsContainer}>
                <TouchableOpacity
                  style={[styles.themeOption, themeMode === 'light' && styles.themeOptionActive]}
                  onPress={async () => {
                    setThemeMode('light');
                    try {
                      const appSettings = await getAppSettings();
                      const settingsToSave = appSettings || {
                        notificationsEnabled: true,
                        darkModeEnabled: false,
                        themeMode: 'light',
                        autoBackupEnabled: false,
                        autoSyncEnabled: false,
                        currency: 'دينار عراقي',
                        language: 'ar',
                      };
                      await upsertAppSettings({ ...settingsToSave, themeMode: 'light', darkModeEnabled: false });
                      // Sync to widget
                      const { saveWidgetData } = await import('../services/widgetDataService');
                      await saveWidgetData();
                    } catch (e) {
                      
                    }
                  }}
                >
                  <Ionicons name="sunny" size={20} color={themeMode === 'light' ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[styles.themeOptionText, themeMode === 'light' && styles.themeOptionTextActive]}>فاتح</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.themeOption, themeMode === 'dark' && styles.themeOptionActive]}
                  onPress={async () => {
                    setThemeMode('dark');
                    try {
                      const appSettings = await getAppSettings();
                      const settingsToSave = appSettings || {
                        notificationsEnabled: true,
                        darkModeEnabled: true,
                        themeMode: 'dark',
                        autoBackupEnabled: false,
                        autoSyncEnabled: false,
                        currency: 'دينار عراقي',
                        language: 'ar',
                      };
                      await upsertAppSettings({ ...settingsToSave, themeMode: 'dark', darkModeEnabled: true });
                      // Sync to widget
                      const { saveWidgetData } = await import('../services/widgetDataService');
                      await saveWidgetData();
                    } catch (e) {
                      
                    }
                  }}
                >
                  <Ionicons name="moon" size={20} color={themeMode === 'dark' ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[styles.themeOptionText, themeMode === 'dark' && styles.themeOptionTextActive]}>داكن</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.themeOption, themeMode === 'system' && styles.themeOptionActive]}
                  onPress={async () => {
                    setThemeMode('system');
                    try {
                      const appSettings = await getAppSettings();
                      const settingsToSave = appSettings || {
                        notificationsEnabled: true,
                        darkModeEnabled: false,
                        themeMode: 'system',
                        autoBackupEnabled: false,
                        autoSyncEnabled: false,
                        currency: 'دينار عراقي',
                        language: 'ar',
                      };
                      await upsertAppSettings({ ...settingsToSave, themeMode: 'system' });
                      // Sync to widget
                      const { saveWidgetData } = await import('../services/widgetDataService');
                      await saveWidgetData();
                    } catch (e) {
                      
                    }
                  }}
                >
                  <Ionicons name="phone-portrait" size={20} color={themeMode === 'system' ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[styles.themeOptionText, themeMode === 'system' && styles.themeOptionTextActive]}>النظام</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>


        {/* 3. النسخ الاحتياطي والاستعادة */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cloud-upload-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>النسخ الاحتياطي والاستعادة</Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                if (backupLoading) return;
                setBackupLoading(true);
                const result = await createLocalBackup();
                setBackupLoading(false);
                if (result.success) {
                  alertService.toastSuccess('تم إنشاء النسخة الاحتياطية بنجاح. يمكنك حفظ الملف في التخزين أو مشاركته.');
                } else {
                  alertService.error('خطأ', result.error);
                }
              }}
              style={[styles.actionItem, { backgroundColor: '#0EA5E9', overflow: 'hidden' }]}
              activeOpacity={0.7}
              disabled={backupLoading}
            >
              <View style={styles.actionItemGradient}>
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconContainer}>
                    {backupLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="save" size={24} color="#FFFFFF" />}
                  </View>
                  <View style={styles.actionItemInfo}>
                    <Text style={styles.actionItemTitleWhite}>نسخ احتياطي داخلي</Text>
                    <Text style={styles.actionItemDescriptionWhite}>حفظ كل بياناتك في ملف واحفظه على جهازك</Text>
                  </View>
                </View>
                {!backupLoading && <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>


            <TouchableOpacity
              onPress={async () => {
                if (backupLoading) return;
                setBackupLoading(true);
                const result = await pickBackupFileAndRestore();
                setBackupLoading(false);
                if (result.success) {
                  alertService.toastSuccess('تم استعادة النسخة الاحتياطية من الملف.');
                  loadSettings();
                } else if (result.error !== 'لم يتم اختيار ملف') {
                  alertService.error('خطأ', result.error);
                }
              }}
              style={[styles.actionItem, { backgroundColor: '#6366F1', overflow: 'hidden' }]}
              activeOpacity={0.7}
              disabled={backupLoading}
            >
              <View style={styles.actionItemGradient}>
                <View style={styles.actionItemLeft}>
                  <View style={styles.actionIconContainer}>
                    {backupLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="folder-open" size={24} color="#FFFFFF" />}
                  </View>
                  <View style={styles.actionItemInfo}>
                    <Text style={styles.actionItemTitleWhite}>استعادة من ملف</Text>
                    <Text style={styles.actionItemDescriptionWhite}>اختر ملف نسخة احتياطية من جهازك (ملف أو iCloud)</Text>
                  </View>
                </View>
                {!backupLoading && <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>

            {isAuthenticated && (
              <TouchableOpacity
                onPress={() => setShowRestoreServerConfirm(true)}
                style={[styles.actionItem, { backgroundColor: '#F59E0B', overflow: 'hidden' }]}
                activeOpacity={0.7}
                disabled={restoreServerLoading}
              >
                <View style={styles.actionItemGradient}>
                  <View style={styles.actionItemLeft}>
                    <View style={styles.actionIconContainer}>
                      {restoreServerLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-download" size={24} color="#FFFFFF" />}
                    </View>
                    <View style={styles.actionItemInfo}>
                      <Text style={styles.actionItemTitleWhite}>استعادة من السيرفر</Text>
                      <Text style={styles.actionItemDescriptionWhite}>جلب آخر نسخة من السيرفر واستبدال البيانات المحلية (مميز)</Text>
                    </View>
                  </View>
                  {!restoreServerLoading && <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            )}

            {showRestoreServerConfirm && (
              <ConfirmAlert
                visible={showRestoreServerConfirm}
                title="استعادة من السيرفر"
                message="سيتم استبدال كل بياناتك المحلية بآخر نسخة من السيرفر. هل أنت متأكد؟"
                confirmText="استعادة"
                cancelText="إلغاء"
                onConfirm={async () => {
                  setShowRestoreServerConfirm(false);
                  setRestoreServerLoading(true);
                  const result = await getFullFromServer();
                  setRestoreServerLoading(false);
                  if (result.success) {
                    alertService.toastSuccess('تم استعادة البيانات من السيرفر.');
                    loadSettings();
                  } else {
                    alertService.error('فشل الاستعادة', result.error);
                  }
                }}
                onCancel={() => setShowRestoreServerConfirm(false)}
              />
            )}
          </View>
        </View>

        {/* 4. اللغة والعملة */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="globe-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>اللغة والعملة</Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
              style={styles.currencyItem}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.currencyItemGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.currencyItemLeft}>
                  <View style={styles.currencyIconContainer}>
                    <Ionicons name="cash" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.currencyItemInfo}>
                    <Text style={styles.currencyItemTitleWhite}>العملة الأساسية</Text>
                    <Text style={styles.currencyItemDescriptionWhite}>
                      {CURRENCIES.find(c => c.code === selectedCurrency)?.name || 'دينار عراقي'}
                    </Text>
                  </View>
                </View>
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {showCurrencyPicker && (
              <View style={styles.currencyPicker}>
                {CURRENCIES.map((currency) => (
                  <TouchableOpacity
                    key={currency.code}
                    style={[
                      styles.currencyOption,
                      selectedCurrency === currency.code && styles.currencyOptionSelected,
                    ]}
                    onPress={() => handleCurrencyChange(currency.code)}
                  >
                    <Text style={[
                      styles.currencyOptionText,
                      selectedCurrency === currency.code && styles.currencyOptionTextSelected,
                    ]}>
                      {currency.symbol} {currency.name}
                    </Text>
                    {selectedCurrency === currency.code && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              onPress={() => setShowLanguagePicker(!showLanguagePicker)}
              style={styles.currencyItem}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.currencyItemGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.currencyItemLeft}>
                  <View style={styles.currencyIconContainer}>
                    <Ionicons name="language" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.currencyItemInfo}>
                    <Text style={styles.currencyItemTitleWhite}>لغة التطبيق</Text>
                    <Text style={styles.currencyItemDescriptionWhite}>
                      {selectedLanguage === 'ar' ? 'العربية (العراق)' : 'English'}
                    </Text>
                  </View>
                </View>
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {showLanguagePicker && (
              <View style={styles.currencyPicker}>
                <TouchableOpacity
                  style={[
                    styles.currencyOption,
                    selectedLanguage === 'ar' && styles.currencyOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedLanguage('ar');
                    setShowLanguagePicker(false);
                  }}
                >
                  <Text style={[
                    styles.currencyOptionText,
                    selectedLanguage === 'ar' && styles.currencyOptionTextSelected,
                  ]}>
                    العربية
                  </Text>
                  {selectedLanguage === 'ar' && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.currencyOption,
                    selectedLanguage === 'en' && styles.currencyOptionSelected,
                  ]}
                  onPress={() => {
                    alertService.info('تنبيه', 'اللغة الإنجليزية ستتوفر قريباً');
                    setShowLanguagePicker(false);
                  }}
                >
                  <Text style={[
                    styles.currencyOptionText,
                    selectedLanguage === 'en' && styles.currencyOptionTextSelected,
                  ]}>
                    English (Coming Soon)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedCurrency !== 'USD' && (
              <TouchableOpacity
                onPress={() => setShowExchangeRateModal(true)}
                style={styles.exchangeRateItem}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.exchangeRateItemGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.exchangeRateItemLeft}>
                    <View style={styles.exchangeRateIconContainer}>
                      <Ionicons name="swap-horizontal" size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.exchangeRateItemInfo}>
                      <Text style={styles.exchangeRateItemTitleWhite}>سعر الصرف</Text>
                      <Text style={styles.exchangeRateItemDescriptionWhite}>
                        1 USD = {usdToIqdRate} {selectedCurrency}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 5. إعدادات الإشعارات */}
        {
          notificationsEnabled && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionContent}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>إعدادات الإشعارات</Text>
                </View>

                {/* Daily Reminder */}
                <View style={styles.notificationItem}>
                  <View style={styles.notificationItemHeader}>
                    <View style={styles.notificationItemLeft}>
                      <View style={styles.notificationIconContainer}>
                        <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                      </View>
                      <View style={styles.notificationItemInfo}>
                        <Text style={styles.notificationItemTitle}>تذكير يومي</Text>
                        <Text style={styles.notificationItemDescription}>تذكير يومي لتسجيل المصاريف</Text>
                      </View>
                    </View>
                    <Switch
                      value={dailyReminder}
                      onValueChange={handleDailyReminderToggle}
                      trackColor={{ false: '#767577', true: theme.colors.primary }}
                      thumbColor={dailyReminder ? '#FFFFFF' : '#f4f3f4'}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleOpenDailyTimePicker}
                    style={styles.timePickerButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.timePickerText}>اختر الوقت: {formatTime(dailyReminderTime)}</Text>
                    <Ionicons name="chevron-back" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>




              </View>
            </View>
          )
        }
        {/* Expense Reminder Time Picker */}
        <Modal
          visible={showExpenseTimePicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowExpenseTimePicker(false)}
        >
          <View style={styles.timePickerModalOverlay}>
            <View style={styles.timePickerModalContent}>
              <View style={styles.timePickerModalHeader}>
                <TouchableOpacity
                  onPress={handleExpenseTimeConfirm}
                  style={styles.timePickerConfirmButton}
                >
                  <Text style={styles.timePickerConfirmText}>تأكيد</Text>
                </TouchableOpacity>
                <Text style={styles.timePickerModalTitle}>اختر الوقت</Text>
                <TouchableOpacity
                  onPress={() => setShowExpenseTimePicker(false)}
                  style={styles.timePickerCancelButton}
                >
                  <Text style={styles.timePickerCancelText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
              {renderTimePickerWheel('expense')}
            </View>
          </View>
        </Modal>

        {/* 6. التصدير */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>التصدير</Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowExportModal(true)}
              disabled={exportingPDF}
              style={[
                styles.exportButton,
                { backgroundColor: isDark ? '#1E3A5F' : theme.colors.primary }
              ]}
              activeOpacity={0.8}
            >
              {exportingPDF ? (
                <ActivityIndicator color={theme.colors.textInverse} />
              ) : (
                <>
                  <Ionicons name="document-text" size={20} color={'#FFFFFF'} />
                  <Text style={styles.exportButtonText}>
                    تصدير البيانات
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 12 }} />

            <TouchableOpacity
              onPress={() => setShowDeleteAllConfirm(true)}
              style={[
                styles.actionItem,
                {
                  backgroundColor: theme.colors.error + '10',
                  borderColor: theme.colors.error + '30',
                  borderWidth: 1,
                  borderRadius: 12,
                  marginHorizontal: 0
                }
              ]}
              activeOpacity={0.7}
              disabled={deletingAll}
            >
              <View style={[styles.actionItemGradient, { paddingVertical: 12 }]}>
                <View style={styles.actionItemLeft}>
                  <View style={[styles.actionIconContainer, { backgroundColor: theme.colors.error + '20', width: 40, height: 40, borderRadius: 20 }]}>
                    {deletingAll ? <ActivityIndicator size="small" color={theme.colors.error} /> : <Ionicons name="trash" size={22} color={theme.colors.error} />}
                  </View>
                  <View style={styles.actionItemInfo}>
                    <Text style={[styles.actionItemTitleWhite, { color: theme.colors.error, fontSize: 16 }]}>حذف جميع البيانات</Text>
                    <Text style={[styles.actionItemDescriptionWhite, { color: theme.colors.textSecondary, fontSize: 12 }]}>سيتم مسح كافة البيانات بشكل نهائي.</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {showDeleteAllConfirm && (
              <ConfirmAlert
                visible={showDeleteAllConfirm}
                title="حذف جميع البيانات؟"
                message="سيتم حذف كافة المصاريف والأهداف والديون بشكل نهائي. هل أنت متأكد من رغبتك في المتابعة؟"
                confirmText="حذف الكل"
                cancelText="إلغاء"
                onConfirm={() => {
                  setShowDeleteAllConfirm(false);
                  handleDeleteAllData();
                }}
                onCancel={() => setShowDeleteAllConfirm(false)}
              />
            )}
          </View>
        </View>

        {/* 7. تواصل معنا */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Ionicons name="chatbubbles-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.sectionTitle}>تواصل معنا</Text>
            </View>

            <TouchableOpacity
              onPress={handleContactEmail}
              style={styles.contactItem}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#6366F1', '#3B82F6']}
                style={styles.contactItemGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.contactItemLeft}>
                  <View style={styles.contactIconContainer}>
                    <Ionicons name="mail" size={26} color="#FFFFFF" />
                  </View>
                  <View style={styles.contactItemInfo}>
                    <Text style={styles.contactItemTitleWhite}>البريد الإلكتروني</Text>
                    <Text style={styles.contactItemDescriptionWhite} numberOfLines={1}>
                      {CONTACT_INFO.email}
                    </Text>
                  </View>
                </View>
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleContactWhatsApp}
              style={styles.contactItem}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.contactItemGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.contactItemLeft}>
                  <View style={styles.contactIconContainer}>
                    <Ionicons name="logo-whatsapp" size={26} color="#FFFFFF" />
                  </View>
                  <View style={styles.contactItemInfo}>
                    <Text style={styles.contactItemTitleWhite}>WhatsApp</Text>
                    <Text style={styles.contactItemDescriptionWhite}>
                      تواصل معنا عبر WhatsApp
                    </Text>
                  </View>
                </View>
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShareApp}
              style={styles.contactItem}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.contactItemGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.contactItemLeft}>
                  <View style={styles.contactIconContainer}>
                    <Ionicons name="share-social" size={26} color="#FFFFFF" />
                  </View>
                  <View style={styles.contactItemInfo}>
                    <Text style={styles.contactItemTitleWhite}>مشاركة التطبيق</Text>
                    <Text style={styles.contactItemDescriptionWhite}>
                      {Platform.OS === 'ios' ? 'شارك رابط App Store عبر واتساب أو أي تطبيق' : 'شارك رابط تيليجرام عبر واتساب أو أي تطبيق'}
                    </Text>
                  </View>
                </View>
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* التذييل */}
        <View style={styles.copyrightWrapper}>
          <LinearGradient
            colors={theme.gradients.primary as any}
            style={styles.copyrightCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Image
              source={require('../../assets/letters-logo.png')}
              style={styles.copyrightLogo}
              resizeMode="contain"
            />
            <Text style={styles.copyrightText}>© 2025 URUX. جميع الحقوق محفوظة.</Text>
            <Text style={styles.versionText}>v.{Constants.expoConfig?.version ?? '1.1.5'}</Text>
          </LinearGradient>
        </View>

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
                          
                        }
                      }

                      setShowNameModal(false);
                      alertService.toastSuccess('تم تحديث الاسم بنجاح');
                    } catch (error) {
                      
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

      <ExportPeriodModal
        visible={showExportModal}
        exportMode={exportMode}
        setExportMode={setExportMode}
        exportMonth={exportMonth}
        setExportMonth={setExportMonth}
        exportYear={exportYear}
        setExportYear={setExportYear}
        onConfirm={handleExportPDF}
        onClose={() => setShowExportModal(false)}
        loading={exportingPDF}
      />

    </SafeAreaView>
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
    backgroundColor: theme.colors.surfaceCard,
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
  themeOptionsContainer: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.border + '30',
    alignItems: 'center',
    gap: 6,
  },
  themeOptionActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  themeOptionText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('600'),
  },
  themeOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('700'),
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
  profileTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  profileSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    textAlign: 'left',
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
    ...getPlatformShadow('sm'),
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
    backgroundColor: theme.colors.surfaceCard,
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
    backgroundColor: theme.colors.surfaceCard,
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
    backgroundColor: theme.colors.surfaceCard,
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
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  referralSubtitleText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 18,
    textAlign: 'left',
  },
  referralCodeBox: {
    backgroundColor: theme.colors.surfaceLight,
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
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 4,
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
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
  },
  referralStatValue: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
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
  exportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  exportModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  exportModalContainer: {
    width: '100%',
    maxHeight: '90%',
  },
  exportModalGradient: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : theme.spacing.lg,
  },
  exportModalHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  exportModalCloseButton: {
    padding: 4,
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  exportModalContent: {
    paddingBottom: 8,
  },
  modeToggle: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.surfaceCard,
    ...getPlatformShadow('sm'),
  },
  modeButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  modeButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('700'),
  },
  periodSelectors: {
    marginBottom: 24,
  },
  selectorGroup: {
    marginBottom: 20,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: 'left',
  },
  selectorScroll: {
    paddingRight: 4,
  },
  periodOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  periodOptionActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary + '30',
  },
  periodOptionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  periodOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('600'),
  },
  confirmExportButton: {
    marginTop: 8,
  },
  confirmExportGradient: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...getPlatformShadow('md'),
  },
  confirmExportText: {
    fontSize: 17,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
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

interface ExportPeriodModalProps {
  visible: boolean;
  exportMode: 'monthly' | 'all';
  setExportMode: (mode: 'monthly' | 'all') => void;
  exportMonth: number;
  setExportMonth: (month: number) => void;
  exportYear: number;
  setExportYear: (year: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

const ExportPeriodModal: React.FC<ExportPeriodModalProps> = ({
  visible,
  exportMode,
  setExportMode,
  exportMonth,
  setExportMonth,
  exportYear,
  setExportYear,
  onConfirm,
  onClose,
  loading,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.exportModalOverlay}>
        <TouchableOpacity style={styles.exportModalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.exportModalContainer}>
          <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.exportModalGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.exportModalHeader}>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.exportModalCloseButton}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.exportModalTitle}>تصدير البيانات</Text>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.exportModalContent}>
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  onPress={() => setExportMode('monthly')}
                  style={[styles.modeButton, exportMode === 'monthly' && styles.modeButtonActive]}
                >
                  <Text style={[styles.modeButtonText, exportMode === 'monthly' && styles.modeButtonTextActive]}>تقرير شهري</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setExportMode('all')}
                  style={[styles.modeButton, exportMode === 'all' && styles.modeButtonActive]}
                >
                  <Text style={[styles.modeButtonText, exportMode === 'all' && styles.modeButtonTextActive]}>جميع البيانات</Text>
                </TouchableOpacity>
              </View>

              {exportMode === 'monthly' && (
                <View style={styles.periodSelectors}>
                  <View style={styles.selectorGroup}>
                    <Text style={styles.selectorLabel}>الشهر</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                      {months.map((m, i) => (
                        <TouchableOpacity key={m} onPress={() => setExportMonth(i)} style={[styles.periodOption, exportMonth === i && styles.periodOptionActive]}>
                          <Text style={[styles.periodOptionText, exportMonth === i && styles.periodOptionTextActive]}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={styles.selectorGroup}>
                    <Text style={styles.selectorLabel}>السنة</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                      {years.map(y => (
                        <TouchableOpacity key={y} onPress={() => setExportYear(y)} style={[styles.periodOption, exportYear === y && styles.periodOptionActive]}>
                          <Text style={[styles.periodOptionText, exportYear === y && styles.periodOptionTextActive]}>{y}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              )}

              <TouchableOpacity onPress={onConfirm} disabled={loading} style={styles.confirmExportButton}>
                <LinearGradient colors={theme.gradients.primary as any} style={styles.confirmExportGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmExportText}>تصدير PDF</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};
