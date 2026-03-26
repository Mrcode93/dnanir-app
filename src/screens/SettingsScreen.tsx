import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, I18nManager, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions, Image, Linking, Share, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenContainer } from '../design-system';
import { List, Switch, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme } from '../utils/theme-context';
import { getUserSettings, getAppSettings, upsertAppSettings, getNotificationSettings, upsertNotificationSettings, upsertUserSettings, recalculateAllBaseAmounts, importFullData } from '../database/database';
import { initializeNotifications, requestPermissions, scheduleDailyReminder, sendExpenseReminder, cancelNotification, rescheduleAllNotifications, sendTestNotification, verifyScheduledNotifications } from '../services/notificationService';
import { generateMonthlyReport, generateFullReport, sharePDF } from '../services/pdfService';

import { authModalService } from '../services/authModalService';
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
import { useWallets } from '../context/WalletContext';
import { CONTACT_INFO, APP_LINKS, SHARE_APP_MESSAGE } from '../constants/contactConstants';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';
import { convertArabicToEnglish } from '../utils/numbers';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { notifyCurrencyChanged } from '../services/currencyEvents';
import { convertCurrency } from '../services/currencyService';
import { isRTL as globalRTL } from '../utils/rtl';
import { type AppLanguage, getCurrencyDisplayName, getCurrentLanguage, getLanguageDisplayName, getLanguageNativeName, isSupportedLanguage, translate as translateText, useLocalization, tl } from '../localization';

type Meridiem = 'am' | 'pm';
export const SettingsScreen = ({
  navigation
}: any) => {
  const {
    theme,
    themeMode,
    setThemeMode,
    isDark
  } = useAppTheme();
  const {
    language,
    setLanguage,
    t,
    isRTL
  } = useLocalization();
  const { refreshWallets, setSelectedWallet } = useWallets();
  const styles = useMemo(() => createStyles(theme, isRTL), [theme, isRTL]);
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
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>('ar');
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
  const [tempAmPm, setTempAmPm] = useState<Meridiem>('pm');
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
  const [showRestoreOldConfirm, setShowRestoreOldConfirm] = useState(false);
  const [showRestoreLocalOldConfirm, setShowRestoreLocalOldConfirm] = useState(false);
  const [pickedBackupData, setPickedBackupData] = useState<any>(null);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(false);
  const [showDeleteChoiceModal, setShowDeleteChoiceModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'local' | 'both'>('local');
  const [deletingAll, setDeletingAll] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<'monthly' | 'all'>('monthly');
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const settingsDebugKey = `${language}-${selectedLanguage}-${isRTL ? 'rtl' : 'ltr'}`;
  const getDefaultAppSettings = () => ({
    notificationsEnabled: true,
    darkModeEnabled: false,
    themeMode: 'light' as const,
    autoBackupEnabled: false,
    autoSyncEnabled: false,
    currency: 'دينار عراقي',
    language: 'ar'
  });
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
      alertService.toastSuccess(tl("تم تسجيل الخروج بنجاح"));
    } catch (error) {
      alertService.error(tl("خطأ"), tl("فشل تسجيل الخروج"));
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
        const nextLanguage = isSupportedLanguage(appSettings.language) ? appSettings.language : 'ar';
        setSelectedLanguage(nextLanguage);
        if (nextLanguage !== language) {
          setLanguage(nextLanguage);
        }
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
    const settingsToSave = appSettings || getDefaultAppSettings();
    await upsertAppSettings({
      ...settingsToSave,
      notificationsEnabled: value,
      themeMode: settingsToSave.themeMode
    });
    if (value) {
      const hasPermission = await requestPermissions();
      if (hasPermission) {
        await initializeNotifications();
      } else {
        alertService.warning(t('settings.notificationsPermissionTitle'), t('settings.notificationsPermissionMessage'));
      }
    } else {
      // Cancel all notifications when disabled
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };
  const handleAutoSyncToggle = async (value: boolean) => {
    if (value) {
      const user = await authStorage.getUser<{
        isPro?: boolean;
        is_pro?: boolean;
      }>();
      const isPro = user?.isPro === true || (user as any)?.is_pro === true;
      if (!isPro) {
        alertService.show({
          title: t('sync.premiumTitle'),
          message: t('settings.autoSyncPremiumMessage'),
          type: 'warning',
          confirmText: t('common.ok')
        });
        return;
      }
    }
    setAutoSyncEnabled(value);
    const appSettings = await getAppSettings();
    const settingsToSave = appSettings || getDefaultAppSettings();
    await upsertAppSettings({
      ...settingsToSave,
      autoSyncEnabled: value,
      themeMode: settingsToSave.themeMode
    });
  };
  const handleDailyReminderToggle = async (value: boolean) => {
    setDailyReminder(value);
    const notificationSettings = await getNotificationSettings();
    const dailyTimeString = `${dailyReminderTime.getHours().toString().padStart(2, '0')}:${dailyReminderTime.getMinutes().toString().padStart(2, '0')}`;
    const expenseTimeString = `${expenseReminderTime.getHours().toString().padStart(2, '0')}:${expenseReminderTime.getMinutes().toString().padStart(2, '0')}`;
    const payload = notificationSettings ? {
      dailyReminder: value ? 1 : 0,
      dailyReminderTime: notificationSettings.dailyReminderTime ?? dailyTimeString,
      expenseReminder: notificationSettings.expenseReminder ? 1 : 0,
      expenseReminderTime: notificationSettings.expenseReminderTime ?? expenseTimeString,
      incomeReminder: notificationSettings.incomeReminder ? 1 : 0,
      weeklySummary: notificationSettings.weeklySummary ? 1 : 0,
      monthlySummary: notificationSettings.monthlySummary ? 1 : 0
    } : {
      dailyReminder: value ? 1 : 0,
      dailyReminderTime: dailyTimeString,
      expenseReminder: expenseReminder ? 1 : 0,
      expenseReminderTime: expenseTimeString,
      incomeReminder: 1,
      weeklySummary: 1,
      monthlySummary: 1
    };
    await upsertNotificationSettings(payload);
    await loadSettings();
    if (value) {
      try {
        await scheduleDailyReminder();
      } catch (error) {
        alertService.error(tl("خطأ"), tl("فشل جدولة التذكير اليومي"));
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
    const payload = notificationSettings ? {
      dailyReminder: notificationSettings.dailyReminder ? 1 : 0,
      dailyReminderTime: notificationSettings.dailyReminderTime ?? dailyTimeString,
      expenseReminder: value ? 1 : 0,
      expenseReminderTime: notificationSettings.expenseReminderTime ?? expenseTimeString,
      incomeReminder: notificationSettings.incomeReminder ? 1 : 0,
      weeklySummary: notificationSettings.weeklySummary ? 1 : 0,
      monthlySummary: notificationSettings.monthlySummary ? 1 : 0
    } : {
      dailyReminder: dailyReminder ? 1 : 0,
      dailyReminderTime: dailyTimeString,
      expenseReminder: value ? 1 : 0,
      expenseReminderTime: expenseTimeString,
      incomeReminder: 1,
      weeklySummary: 1,
      monthlySummary: 1
    };
    await upsertNotificationSettings(payload);
    await loadSettings();
    if (value) {
      try {
        await sendExpenseReminder();
      } catch (error) {
        alertService.error(tl("خطأ"), tl("فشل جدولة تذكير المصاريف"));
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
            dailyReminderTime: timeString
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
            expenseReminderTime: timeString
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
    const amPm: Meridiem = hour24 >= 12 ? 'pm' : 'am';
    setTempHour(hour12);
    setTempMinute(minute);
    setTempAmPm(amPm);
    setShowDailyTimePicker(true);
    setTimeout(() => {
      dailyHourScrollRef.current?.scrollTo({
        y: (hour12 - 1) * 50,
        animated: false
      });
      dailyMinuteScrollRef.current?.scrollTo({
        y: minute * 50,
        animated: false
      });
      dailyAmPmScrollRef.current?.scrollTo({
        y: amPm === 'am' ? 0 : 50,
        animated: false
      });
    }, 100);
  };
  const handleOpenExpenseTimePicker = () => {
    const hour24 = expenseReminderTime.getHours();
    const minute = expenseReminderTime.getMinutes();

    // Convert 24-hour to 12-hour format
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const amPm: Meridiem = hour24 >= 12 ? 'pm' : 'am';
    setTempHour(hour12);
    setTempMinute(minute);
    setTempAmPm(amPm);
    setShowExpenseTimePicker(true);
    setTimeout(() => {
      expenseHourScrollRef.current?.scrollTo({
        y: (hour12 - 1) * 50,
        animated: false
      });
      expenseMinuteScrollRef.current?.scrollTo({
        y: minute * 50,
        animated: false
      });
      expenseAmPmScrollRef.current?.scrollTo({
        y: amPm === 'am' ? 0 : 50,
        animated: false
      });
    }, 100);
  };
  const handleDailyTimeConfirm = async () => {
    setShowDailyTimePicker(false);

    // Convert 12-hour to 24-hour format
    let hour24 = tempHour;
    if (tempAmPm === 'pm' && tempHour !== 12) {
      hour24 = tempHour + 12;
    } else if (tempAmPm === 'am' && tempHour === 12) {
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
        dailyReminder: notificationSettings ? notificationSettings.dailyReminder ? 1 : 0 : dailyReminder ? 1 : 0,
        dailyReminderTime: timeString,
        expenseReminder: notificationSettings ? notificationSettings.expenseReminder ? 1 : 0 : expenseReminder ? 1 : 0,
        expenseReminderTime: notificationSettings?.expenseReminderTime ?? expenseTimeString,
        incomeReminder: notificationSettings ? notificationSettings.incomeReminder ? 1 : 0 : 1,
        weeklySummary: notificationSettings ? notificationSettings.weeklySummary ? 1 : 0 : 1,
        monthlySummary: notificationSettings ? notificationSettings.monthlySummary ? 1 : 0 : 1
      });

      // Reload from DB so state matches persisted value (handles focus race)
      await loadSettings();
      alertService.toastSuccess(tl("تم حفظ وقت التذكير اليومي: {{}}", [timeString]));
      if (dailyReminder) {
        try {
          await scheduleDailyReminder();
        } catch (error) {
          alertService.error(tl("خطأ"), tl("تم حفظ الوقت لكن فشل جدولة التذكير"));
        }
      }
    } catch (error) {
      alertService.error(tl("خطأ"), tl("فشل حفظ وقت التذكير اليومي"));
    }
  };
  const handleExpenseTimeConfirm = async () => {
    setShowExpenseTimePicker(false);

    // Convert 12-hour to 24-hour format
    let hour24 = tempHour;
    if (tempAmPm === 'pm' && tempHour !== 12) {
      hour24 = tempHour + 12;
    } else if (tempAmPm === 'am' && tempHour === 12) {
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
        monthlySummary: 1
      };
    }
    await upsertNotificationSettings({
      ...notificationSettings,
      expenseReminderTime: timeString
    });
    if (expenseReminder) {
      try {
        await sendExpenseReminder();
        alertService.toastSuccess(tl("تم تعيين وقت تذكير المصاريف إلى {{}}", [timeString]));
      } catch (error) {
        alertService.error(tl("خطأ"), tl("فشل جدولة تذكير المصاريف"));
      }
    }
  };
  const renderTimePickerWheel = (type: 'daily' | 'expense') => {
    const hours = Array.from({
      length: 12
    }, (_, i) => i + 1); // 1-12 for 12-hour format
    const minutes = Array.from({
      length: 60
    }, (_, i) => i);
    const amPmOptions: Meridiem[] = ['am', 'pm'];
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
      const amPm: Meridiem = index === 0 ? 'am' : 'pm';
      setTempAmPm(amPm);
    };
    return <View style={styles.customTimePickerContainer}>
      <View style={styles.timePickerWheel}>
        <View style={styles.timePickerSelectionIndicator} />
        <ScrollView ref={hourRef} style={styles.timePickerScroll} contentContainerStyle={styles.timePickerScrollContent} showsVerticalScrollIndicator={false} snapToInterval={itemHeight} decelerationRate="fast" onMomentumScrollEnd={handleHourScroll} onScrollEndDrag={handleHourScroll}>
          {hours.map(hour => <View key={hour} style={[styles.timePickerItem, {
            height: itemHeight
          }]}>
            <Text style={[styles.timePickerItemText, tempHour === hour && styles.timePickerItemTextSelected]}>
              {hour.toString().padStart(2, '0')}
            </Text>
          </View>)}
        </ScrollView>
      </View>

      <Text style={styles.timePickerSeparator}>:</Text>

      <View style={styles.timePickerWheel}>
        <View style={styles.timePickerSelectionIndicator} />
        <ScrollView ref={minuteRef} style={styles.timePickerScroll} contentContainerStyle={styles.timePickerScrollContent} showsVerticalScrollIndicator={false} snapToInterval={itemHeight} decelerationRate="fast" onMomentumScrollEnd={handleMinuteScroll} onScrollEndDrag={handleMinuteScroll}>
          {minutes.map(minute => <View key={minute} style={[styles.timePickerItem, {
            height: itemHeight
          }]}>
            <Text style={[styles.timePickerItemText, tempMinute === minute && styles.timePickerItemTextSelected]}>
              {minute.toString().padStart(2, '0')}
            </Text>
          </View>)}
        </ScrollView>
      </View>

      <View style={styles.timePickerWheel}>
        <View style={styles.timePickerSelectionIndicator} />
        <ScrollView ref={amPmRef} style={styles.timePickerScroll} contentContainerStyle={styles.timePickerScrollContent} showsVerticalScrollIndicator={false} snapToInterval={itemHeight} decelerationRate="fast" onMomentumScrollEnd={handleAmPmScroll} onScrollEndDrag={handleAmPmScroll}>
          {amPmOptions.map(amPm => <View key={amPm} style={[styles.timePickerItem, {
            height: itemHeight
          }]}>
            <Text style={[styles.timePickerItemText, tempAmPm === amPm && styles.timePickerItemTextSelected]}>
              {amPm === 'am' ? tl("ص") : tl("م")}
            </Text>
          </View>)}
        </ScrollView>
      </View>
    </View>;
  };
  const formatTime = (date: Date): string => {
    const hour24 = date.getHours();
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const amPm = hour24 >= 12 ? tl("م") : tl("ص");
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hour12}:${minutes} ${amPm}`;
  };
  const handleCurrencyChange = async (currencyCode: string) => {
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    if (currency) {
      setSelectedCurrency(currencyCode);
      const appSettings = await getAppSettings();
      // Create default settings if none exist
      const settingsToSave = appSettings || getDefaultAppSettings();
      await upsertAppSettings({
        ...settingsToSave,
        currency: currency.name,
        themeMode: settingsToSave.themeMode
      });

      // Recalculate all base amounts for existing records based on the new target currency
      try {
        await recalculateAllBaseAmounts(currencyCode, convertCurrency);
      } catch (error) {

        // We continue anyway so the currency change takes effect, even if historical normalization fails
      }
      notifyCurrencyChanged();
      setShowCurrencyPicker(false);
      alertService.toastSuccess(t('settings.currencyChanged', {
        currency: getCurrencyDisplayName(currencyCode, language)
      }));

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
      let uri = '';
      if (exportMode === 'all') {
        uri = await generateFullReport();
      } else {
        uri = await generateMonthlyReport(exportMonth, exportYear);
      }
      await sharePDF(uri);
      setShowExportModal(false);
    } catch (error) {
      alertService.error(tl("خطأ"), tl("فشل تصدير التقرير"));
    } finally {
      setExportingPDF(false);
    }
  };
  const handleSaveExchangeRate = async () => {
    if (selectedCurrency === 'USD') {
      alertService.warning(tl("تحذير"), tl("لا يمكن تعديل سعر الصرف للدولار مع نفسه"));
      return;
    }
    const rate = parseFloat(usdToIqdRate);
    if (isNaN(rate) || rate <= 0) {
      alertService.warning(tl("تحذير"), tl("يرجى إدخال سعر صرف صحيح"));
      return;
    }
    try {
      await upsertExchangeRate({
        fromCurrency: 'USD',
        toCurrency: selectedCurrency,
        rate: rate
      });

      // Also update reverse rate
      await upsertExchangeRate({
        fromCurrency: selectedCurrency,
        toCurrency: 'USD',
        rate: 1 / rate
      });
      setShowExchangeRateModal(false);
      alertService.toastSuccess(tl("تم حفظ سعر الصرف بنجاح"));
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حفظ سعر الصرف"));
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
        alertService.warning(tl("تنبيه"), tl("لا يمكن فتح تطبيق البريد الإلكتروني"));
      }
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء فتح البريد الإلكتروني"));
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
          alertService.warning(tl("تنبيه"), tl("يرجى تثبيت تطبيق WhatsApp"));
        }
      }
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء فتح WhatsApp"));
    }
  };
  const loadReferralInfo = async () => {
    setLoadingReferral(true);
    try {
      const result = await referralService.getInfo();
      if (result.success && result.data) {
        setReferralInfo(result.data);
      }
    } catch (err) { } finally {
      setLoadingReferral(false);
    }
  };
  const handleShareReferral = async () => {
    if (!referralInfo?.referralCode) return;
    try {
      const message = tl("استخدم كود الإحالة الخاص بي ({{}}) في تطبيق \"دنانير\" لتحصل على 7 أيام اشتراك برو مجاناً! حمل التطبيق من هنا: {{}}", [referralInfo.referralCode, APP_LINKS.apple]);
      await Share.share({
        message
      });
    } catch (error) { }
  };
  const handleDeleteAllData = async (mode: 'local' | 'both') => {
    try {
      const authenticated = await authenticateWithDevice(tl("يرجى التحقق من الهوية لحذف جميع البيانات"));
      if (authenticated) {
        setDeletingAll(true);

        // 1. Delete local data
        await deleteAllData();

        // 2. Delete server data only if user chose 'both'
        if (mode === 'both') {
          try {
            await deleteSyncDataFromServer();
          } catch (serverError) {
            // We don't block local success because local data is already gone
          }
        }
        setDeletingAll(false);
        const successMsg = mode === 'both'
          ? tl("تم حذف جميع بيانات التطبيق بنجاح (محلياً ومن السيرفر)")
          : tl("تم حذف جميع البيانات المحلية بنجاح");
        alertService.toastSuccess(successMsg);
        setSelectedWallet(null);
        await refreshWallets();
        await loadSettings();
      }
    } catch (error) {
      setDeletingAll(false);
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء مسح البيانات"));
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
        title: tl("دنانير - تطبيق المالية الشخصية")
      });
    } catch (err: any) {
      if (err?.message !== 'User did not share') {
        alertService.error(tl("خطأ"), tl("لم تتم المشاركة"));
      }
    }
  };

  const handleLanguageChange = async (lang: AppLanguage) => {
    if (lang === selectedLanguage) return;
    setSelectedLanguage(lang);
    setLanguage(lang);
    try {
      const appSettings = await getAppSettings();
      const settingsToSave = appSettings || getDefaultAppSettings();
      await upsertAppSettings({ ...settingsToSave, language: lang });
    } catch (e) { }
  };

  return (
    <ScreenContainer
      key={`settings-${language}-${isRTL ? 'rtl' : 'ltr'}`}
      scrollable={false}
      edges={['left', 'right']}
      style={{ writingDirection: isRTL ? 'rtl' : 'ltr' } as any}
    >
      <ScrollView
        key={`settings-scroll-${language}-${isRTL ? 'rtl' : 'ltr'}`}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Account */}
        <Text style={styles.sectionLabel}>{tl("الحساب")}</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.7}>
            <View style={[styles.sectionContent, { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 }]}>
              <View style={[styles.avatarContainer, { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary + '10', borderWidth: 0, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={28} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.profileTitle, { fontSize: 18, marginBottom: 0, textAlign: 'left' }]}>
                    {isAuthenticated ? (userName || tl("مستخدم دنانير")) : tl("مستخدم دنانير")}
                  </Text>
                  {isAuthenticated && (
                    <View style={{ backgroundColor: '#D4AF3720', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#B8860B', fontFamily: theme.typography.fontFamily }}>{tl("PRO")}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.profileSubtitle, { marginTop: 2, textAlign: 'left' }]}>
                  {isAuthenticated ? (userPhone || tl("سجل الدخول لمزامنة بياناتك")) : tl("سجل الدخول لمزامنة بياناتك")}
                </Text>
              </View>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>

          {isAuthenticated ? (
            <>

            </>
          ) : (
            <>
              <View style={styles.compactRowDivider} />
              <TouchableOpacity
                style={[styles.compactRow, { paddingVertical: 14, paddingHorizontal: 20 }]}
                onPress={() => authModalService.show()}
              >
                <View style={[styles.compactIconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                  <Ionicons name="log-in" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.compactRowContent}>
                  <Text style={[styles.compactRowText, { color: theme.colors.primary }]}>{tl("تسجيل الدخول / إنشاء حساب")}</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Section: General Settings */}
        <Text style={styles.sectionLabel}>{tl("الإعدادات العامة")}</Text>
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            {/* Notifications Toggle */}
            <View style={styles.compactRow}>
              <View style={styles.compactIconContainer}>
                <Ionicons name="notifications" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("التنبيهات")}</Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={notificationsEnabled ? '#FFFFFF' : '#f4f3f4'}
                />
              </View>
            </View>

            {notificationsEnabled && (
              <>
                <View style={styles.compactRowDivider} />
                <TouchableOpacity style={styles.compactRow} onPress={handleOpenDailyTimePicker}>
                  <View style={[styles.compactIconContainer, { backgroundColor: theme.colors.primary + '05' }]}>
                    <Ionicons name="alarm" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={styles.compactRowContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compactRowText}>{tl("تذكير يومي")}</Text>
                      <Text style={styles.compactRowValue}>{formatTime(dailyReminderTime)}</Text>
                    </View>
                    <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.compactRowDivider} />

            {/* Theme Selector */}
            <View style={[styles.compactRow, { alignItems: 'flex-start', paddingVertical: 14 }]}>
              <View style={styles.compactIconContainer}>
                <Ionicons name="color-palette" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.compactRowText}>{tl("المظهر")}</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[styles.segmentedOption, themeMode === 'light' && styles.segmentedOptionActive]}
                    onPress={() => setThemeMode('light')}
                  >
                    <Ionicons name="sunny" size={16} color={themeMode === 'light' ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.segmentedOptionText, themeMode === 'light' && styles.segmentedOptionTextActive]}>{tl("فاتح")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentedOption, themeMode === 'dark' && styles.segmentedOptionActive]}
                    onPress={() => setThemeMode('dark')}
                  >
                    <Ionicons name="moon" size={16} color={themeMode === 'dark' ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.segmentedOptionText, themeMode === 'dark' && styles.segmentedOptionTextActive]}>{tl("داكن")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentedOption, themeMode === 'system' && styles.segmentedOptionActive]}
                    onPress={() => setThemeMode('system')}
                  >
                    <Ionicons name="phone-portrait" size={16} color={themeMode === 'system' ? theme.colors.primary : theme.colors.textSecondary} />
                    <Text style={[styles.segmentedOptionText, themeMode === 'system' && styles.segmentedOptionTextActive]}>{tl("تلقائي")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.compactRowDivider} />

            {/* Language Row
            <TouchableOpacity style={styles.compactRow} onPress={() => navigation.navigate('LanguageSelector')}>
              <View style={styles.compactIconContainer}>
                <Ionicons name="globe" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("اللغة")}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.compactRowValue}>{getLanguageNativeName(language)}</Text>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
                </View>
              </View>
            </TouchableOpacity> */}
          </View>
        </View>

        {/* Section: Financial Settings */}
        <Text style={styles.sectionLabel}>{tl("الإعدادات المالية")}</Text>
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.compactRow} onPress={() => setShowCurrencyPicker(true)}>
              <View style={styles.compactIconContainer}>
                <Ionicons name="cash" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("العملة الأساسية")}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.compactRowValue}>{getCurrencyDisplayName(selectedCurrency, language)}</Text>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
                </View>
              </View>
            </TouchableOpacity>

            {selectedCurrency !== 'USD' && (
              <>
                <View style={styles.compactRowDivider} />
                <TouchableOpacity style={styles.compactRow} onPress={() => setShowExchangeRateModal(true)}>
                  <View style={[styles.compactIconContainer, { backgroundColor: theme.colors.warning + '10' }]}>
                    <Ionicons name="swap-horizontal" size={20} color={theme.colors.warning} />
                  </View>
                  <View style={styles.compactRowContent}>
                    <Text style={styles.compactRowText}>{tl("سعر الصرف")}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.compactRowValue}>1 USD = {usdToIqdRate} {selectedCurrency}</Text>
                      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
                    </View>
                  </View>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.compactRowDivider} />

            <TouchableOpacity style={styles.compactRow} onPress={() => setShowExportModal(true)}>
              <View style={[styles.compactIconContainer, { backgroundColor: '#10B98110' }]}>
                <Ionicons name="document-text" size={20} color="#10B981" />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("تصدير البيانات (PDF)")}</Text>
                {exportingPDF ? <ActivityIndicator size="small" color="#10B981" /> : <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Backup & Security */}
        <Text style={styles.sectionLabel}>{tl("النسخ الاحتياطي والأمان")}</Text>
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <TouchableOpacity
              style={styles.compactRow}
              disabled={backupLoading}
              onPress={async () => {
                if (backupLoading) return;
                setBackupLoading(true);
                const result = await createLocalBackup();
                setBackupLoading(false);
                if (result.success) alertService.toastSuccess(tl("تم إنشاء النسخة الاحتياطية بنجاح"));
                else alertService.error(tl("خطأ"), result.error);
              }}
            >
              <View style={[styles.compactIconContainer, { backgroundColor: '#0EA5E910' }]}>
                <Ionicons name="cloud-upload" size={20} color="#0EA5E9" />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("نسخ احتياطي داخلي")}</Text>
                {backupLoading ? <ActivityIndicator size="small" color="#0EA5E9" /> : <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.compactRow}
              disabled={backupLoading}
              onPress={async () => {
                if (backupLoading) return;
                setBackupLoading(true);
                const result = await pickBackupFileAndRestore();
                setBackupLoading(false);
                if (result.success) {
                  alertService.toastSuccess(tl("تم استعادة النسخة الاحتياطية بنجاح"));
                  setSelectedWallet(null);
                  await refreshWallets();
                  loadSettings();
                } else if (result.code === 'BACKUP_OLDER') {
                  setPickedBackupData(result.data);
                  setShowRestoreLocalOldConfirm(true);
                }
              }}
            >
              <View style={[styles.compactIconContainer, { backgroundColor: '#6366F110' }]}>
                <Ionicons name="folder-open" size={20} color="#6366F1" />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("استعادة من ملف")}</Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.compactRowDivider} />
            <TouchableOpacity
              style={styles.compactRow}
              disabled={restoreServerLoading}
              onPress={async () => {
                if (!isAuthenticated) {
                  authModalService.show();
                  return;
                }
                if (restoreServerLoading) return;
                setRestoreServerLoading(true);
                const result = await getFullFromServer();
                setRestoreServerLoading(false);
                if (result.success) {
                  alertService.toastSuccess(tl("تم استعادة البيانات من السيرفر بنجاح"));
                  setSelectedWallet(null);
                  await refreshWallets();
                  loadSettings();
                } else if (result.code === 'BACKUP_OLDER') {
                  setPickedBackupData(result.serverData);
                  setShowRestoreOldConfirm(true);
                } else {
                  alertService.error(tl("خطأ"), result.error || tl("فشل الاستعادة من السيرفر"));
                }
              }}
            >
              <View style={[styles.compactIconContainer, { backgroundColor: '#10B98110' }]}>
                <Ionicons name="cloud-download" size={20} color="#10B981" />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("استعادة من السيرفر")}</Text>
                {restoreServerLoading ? <ActivityIndicator size="small" color="#10B981" /> : <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />}
              </View>
            </TouchableOpacity>

            <View style={styles.compactRowDivider} />



            <View style={styles.compactRowDivider} />

            <TouchableOpacity onPress={() => setShowDeleteChoiceModal(true)} style={styles.compactRow}>
              <View style={[styles.compactIconContainer, { backgroundColor: theme.colors.error + '10' }]}>
                <Ionicons name="trash" size={20} color={theme.colors.error} />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={[styles.compactRowText, { color: theme.colors.error }]}>{tl("مسح جميع البيانات")}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Support & About */}
        <Text style={styles.sectionLabel}>{tl("الدعم والمعلومات")}</Text>
        <View style={styles.sectionCard}>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.compactRow} onPress={handleShareApp}>
              <View style={[styles.compactIconContainer, { backgroundColor: '#8B5CF610' }]}>
                <Ionicons name="share-social" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("مشاركة التطبيق")}</Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.compactRowDivider} />

            <TouchableOpacity style={styles.compactRow} onPress={() => {
              // Rate App logic - standard URL for App Store
              const url = Platform.OS === 'ios' ? APP_LINKS.apple : APP_LINKS.android;
              Linking.openURL(url);
            }}>
              <View style={[styles.compactIconContainer, { backgroundColor: '#FDE04710', borderRadius: 10 }]}>
                <Ionicons name="star" size={18} color="#EAB308" />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("تقييم التطبيق")}</Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.compactRowDivider} />

            <TouchableOpacity style={styles.compactRow} onPress={handleContactEmail}>
              <View style={[styles.compactIconContainer, { backgroundColor: theme.colors.info + '10' }]}>
                <Ionicons name="mail" size={20} color={theme.colors.info} />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("تواصل معنا")}</Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.compactRowDivider} />

            <TouchableOpacity style={styles.compactRow} onPress={() => navigation.navigate('Terms')}>
              <View style={[styles.compactIconContainer, { backgroundColor: '#10B98110' }]}>
                <Ionicons name="document-lock" size={20} color="#10B981" />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("الأحكام والشروط")}</Text>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>

            <View style={styles.compactRowDivider} />

            <View style={styles.compactRow}>
              <View style={styles.compactIconContainer}>
                <Ionicons name="information-circle" size={20} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.compactRowContent}>
                <Text style={styles.compactRowText}>{tl("إصدار التطبيق")}</Text>
                <Text style={styles.compactRowValue}>v.{Constants.expoConfig?.version ?? '1.1.5'}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 30, backgroundColor: theme.colors.primary, borderRadius: 10, padding: 10 }}>
          <Image source={require('../../assets/letters-logo.png')} style={{ width: 80, height: 40, marginBottom: 8 }} resizeMode="contain" />
          <Text style={{ fontFamily: theme.typography.fontFamily, fontSize: 12, color: 'white' }}>{tl("صنع بكل حب في العراق")}</Text>
          <Text style={{ fontFamily: theme.typography.fontFamily, fontSize: 11, color: 'white', marginTop: 4 }}>© 2026 URUX</Text>
        </View>
      </ScrollView>


      {showExchangeRateModal && selectedCurrency !== 'USD' ? (
        <ExchangeRateModal
          visible={showExchangeRateModal}
          rate={usdToIqdRate}
          selectedCurrency={selectedCurrency}
          onRateChange={setUsdToIqdRate}
          onSave={handleSaveExchangeRate}
          onClose={() => setShowExchangeRateModal(false)}
        />
      ) : null}
      <Modal visible={showDailyTimePicker} transparent={true} animationType="slide" onRequestClose={() => setShowDailyTimePicker(false)}>
        <View style={styles.timePickerModalOverlay}>
          <View style={styles.timePickerModalContent}>
            <View style={styles.timePickerModalHeader}>
              <TouchableOpacity onPress={handleDailyTimeConfirm} style={styles.timePickerConfirmButton}>
                <Text style={styles.timePickerConfirmText}>{tl("تأكيد")}</Text>
              </TouchableOpacity>
              <Text style={styles.timePickerModalTitle}>{tl("اختر الوقت")}</Text>
              <TouchableOpacity onPress={() => setShowDailyTimePicker(false)} style={styles.timePickerCancelButton}>
                <Text style={styles.timePickerCancelText}>{tl("إلغاء")}</Text>
              </TouchableOpacity>
            </View>
            {renderTimePickerWheel('daily')}
          </View>
        </View>
      </Modal>
      <Modal visible={showNameModal} transparent={true} animationType="fade" onRequestClose={() => setShowNameModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{tl("تعديل الاسم")}</Text>
                <TouchableOpacity onPress={() => setShowNameModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>{tl("الاسم")}</Text>
                <TextInput
                  style={styles.nameInput}
                  value={editingName}
                  onChangeText={setEditingName}
                  placeholder={tl("أدخل اسمك")}
                  placeholderTextColor={theme.colors.textMuted}
                  autoFocus={true}
                  maxLength={50}
                />
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setShowNameModal(false)} style={[styles.modalButton, styles.cancelButton]}>
                  <Text style={styles.cancelButtonText}>{tl("إلغاء")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (!editingName.trim()) return;
                    try {
                      const currentSettings = await getUserSettings();
                      await upsertUserSettings({
                        name: editingName.trim(),
                        authMethod: currentSettings?.authMethod || 'none',
                        biometricsEnabled: currentSettings?.biometricsEnabled || false
                      });
                      setUserName(editingName.trim());
                      if (isAuthenticated) await authApiService.updateProfile(editingName.trim());
                      setShowNameModal(false);
                      alertService.toastSuccess(tl("تم تحديث الاسم بنجاح"));
                    } catch (error) {
                      alertService.error(tl("خطأ"), tl("فشل تحديث الاسم"));
                    }
                  }}
                  style={[styles.modalButton, styles.saveButton]}
                >
                  <LinearGradient colors={theme.gradients.primary as any} style={styles.saveButtonGradient}>
                    <Text style={styles.saveButtonText}>{tl("حفظ")}</Text>
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
      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selectedCurrency={selectedCurrency}
        onSelect={code => handleCurrencyChange(code)}
        onClose={() => setShowCurrencyPicker(false)}
      />
      {showRestoreLocalOldConfirm ? (
        <ConfirmAlert
          visible={showRestoreLocalOldConfirm}
          title={tl("تحذير: نسخة قديمة")}
          message={tl("هذا الملف يحتوي على نسخة احتياطية أقدم من البيانات الحالية. هل تريد المتابعة؟")}
          confirmText={tl("استعادة")}
          cancelText={tl("إلغاء")}
          onConfirm={async () => {
            setShowRestoreLocalOldConfirm(false);
            if (!pickedBackupData) return;
            try {
              await importFullData(pickedBackupData, true);
              alertService.toastSuccess(tl("تم استعادة البيانات بنجاح"));
              setSelectedWallet(null);
              await refreshWallets();
              loadSettings();
            } catch (err) {
              alertService.error(tl("خطأ"), tl("فشل الاستعادة"));
            }
          }}
          onCancel={() => setShowRestoreLocalOldConfirm(false)}
        />
      ) : null}
      {showRestoreOldConfirm ? (
        <ConfirmAlert
          visible={showRestoreOldConfirm}
          title={tl("تحذير: نسخة قديمة")}
          message={tl("النسخة الموجودة على السيرفر أقدم من البيانات الحالية على جهازك. هل تريد استبدال بيانات الجهاز؟")}
          confirmText={tl("استعادة")}
          cancelText={tl("إلغاء")}
          onConfirm={async () => {
            setShowRestoreOldConfirm(false);
            if (!pickedBackupData) return;
            try {
              await importFullData(pickedBackupData, true);
              alertService.toastSuccess(tl("تم استعادة البيانات من السيرفر بنجاح"));
              setSelectedWallet(null);
              await refreshWallets();
              loadSettings();
            } catch (err) {
              alertService.error(tl("خطأ"), tl("فشل الاستعادة"));
            }
          }}
          onCancel={() => setShowRestoreOldConfirm(false)}
        />
      ) : null}
      {showDeleteChoiceModal ? (
        <Modal transparent animationType="fade" visible={showDeleteChoiceModal} onRequestClose={() => setShowDeleteChoiceModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <View style={{ backgroundColor: theme.colors.surfaceCard, borderRadius: 20, paddingVertical: 24, paddingHorizontal: 20, width: '100%', maxWidth: 340 }}>
              <Text style={{ fontFamily: 'DINNext-Medium', fontSize: 18, color: theme.colors.error, textAlign: 'center', marginBottom: 8 }}>{tl("حذف جميع البيانات")}</Text>
              <Text style={{ fontFamily: 'DINNext-Regular', fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>{tl("اختر نوع الحذف:")}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteChoiceModal(false);
                  setDeleteMode('local');
                  setShowDeleteAllConfirm(true);
                }}
                activeOpacity={0.8}
                style={{ backgroundColor: theme.colors.warning + '15', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.warning + '30' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: theme.colors.warning + '25', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginEnd: 12 }}>
                    <Ionicons name="phone-portrait-outline" size={20} color={theme.colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DINNext-Medium', fontSize: 15, color: theme.colors.textPrimary, textAlign: 'left' }}>{tl("حذف من الجهاز فقط")}</Text>
                    <Text style={{ fontFamily: 'DINNext-Regular', fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, textAlign: 'left' }}>{tl("ستبقى النسخة على السيرفر")}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteChoiceModal(false);
                  setDeleteMode('both');
                  setShowDeleteAllConfirm(true);
                }}
                activeOpacity={0.8}
                style={{ backgroundColor: theme.colors.error + '15', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.error + '30' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: theme.colors.error + '25', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginEnd: 12 }}>
                    <Ionicons name="cloud-offline-outline" size={20} color={theme.colors.error} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DINNext-Medium', fontSize: 15, color: theme.colors.textPrimary, textAlign: 'left' }}>{tl("حذف من الجهاز والسيرفر")}</Text>
                    <Text style={{ fontFamily: 'DINNext-Regular', fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, textAlign: 'left' }}>{tl("سيتم حذف جميع البيانات نهائياً")}</Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteChoiceModal(false)} activeOpacity={0.8} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'DINNext-Medium', fontSize: 15, color: theme.colors.textMuted }}>{tl("إلغاء")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
      {showDeleteAllConfirm ? (
        <ConfirmAlert
          visible={showDeleteAllConfirm}
          title={deleteMode === 'both' ? tl("حذف من الجهاز والسيرفر؟") : tl("حذف من الجهاز فقط؟")}
          message={deleteMode === 'both' ? tl("سيتم حذف كافة البيانات نهائياً من الجهاز والسيرفر. هل أنت متأكد؟") : tl("سيتم حذف كافة البيانات من الجهاز فقط. ستبقى النسخة الاحتياطية على السيرفر.")}
          confirmText={tl("حذف")}
          cancelText={tl("إلغاء")}
          onConfirm={() => {
            setShowDeleteAllConfirm(false);
            handleDeleteAllData(deleteMode);
          }}
          onCancel={() => setShowDeleteAllConfirm(false)}
        />
      ) : null}
    </ScreenContainer>
  );
};
const createStyles = (theme: AppTheme, isRTL: boolean) => StyleSheet.create({
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  sectionCard: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border + '30',
    ...getPlatformShadow('md')
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '20'
  },
  sectionContent: {
    padding: theme.spacing.lg,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
    marginHorizontal: 4,
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  compactRowDivider: {
    height: 1,
    backgroundColor: theme.colors.border + '15',
    marginHorizontal: 4,
  },
  compactIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12
  },
  compactRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  compactRowText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  compactRowValue: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginEnd: 8
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background + '80',
    borderRadius: 12,
    padding: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.border + '20'
  },
  segmentedOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6
  },
  segmentedOptionActive: {
    backgroundColor: theme.colors.surfaceCard,
    ...getPlatformShadow('sm')
  },
  segmentedOptionText: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  segmentedOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('700')
  },
  profileCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('lg'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  profileCardPro: {
    borderColor: 'rgba(212, 175, 55, 0.6)',
    borderWidth: 1.5,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#D4AF37',
      shadowOffset: {
        width: 0,
        height: 4
      },
      shadowOpacity: 0.25,
      shadowRadius: 12
    } : {
      elevation: 8
    })
  },
  proCrownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginBottom: 4,
    alignSelf: isRTL ? 'flex-start' : 'flex-end'
  },
  proCrownBannerText: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('700'),
    color: '#F5E6A3',
    fontFamily: theme.typography.fontFamily
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  avatarWrapper: {
    position: 'relative'
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
    ...(Platform.OS === 'android' ? {
      elevation: 0
    } : {}),
    borderWidth: 2,
    borderColor: theme.colors.border + '40'
  },
  avatarContainerPro: {
    borderColor: 'rgba(212, 175, 55, 0.6)'
  },
  proCrownBadge: {
    position: 'absolute',
    bottom: 0,
    ...(isRTL ? {
      left: 0,
    } : {
      right: 0,
    }),
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#B8860B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F5E6A3'
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    ...(isRTL ? {
      left: 2,
    } : {
      right: 2,
    }),
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: theme.colors.primary
  },
  userInfo: {
    flex: 1,
    gap: 3,
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  userNameText: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  userNameTextPro: {
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: {
      width: 0,
      height: 1
    },
    textShadowRadius: 2
  },
  proSparkIcon: {
    opacity: 0.95
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: theme.typography.fontFamily
  },
  userEmailPro: {
    color: 'rgba(245, 230, 163, 0.95)'
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: isRTL ? 'flex-start' : 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginTop: 4
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  verifiedBadgePro: {
    backgroundColor: 'rgba(212, 175, 55, 0.35)'
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  unauthProfileHeader: {
    paddingVertical: 15,
    alignItems: 'center',
    gap: 20
  },
  unauthTextContainer: {
    alignItems: 'center',
    gap: 8
  },
  unauthTitle: {
    fontSize: 24,
    fontWeight: getPlatformFontWeight('900'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  unauthSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    paddingHorizontal: 30,
    lineHeight: 22
  },
  loginBtnHeader: {
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    ...getPlatformShadow('md')
  },
  loginBtnHeaderText: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('900'),
    fontSize: 17,
    fontFamily: theme.typography.fontFamily
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'space-around'
  },
  statBox: {
    alignItems: 'center',
    gap: 6
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    fontFamily: theme.typography.fontFamily
  },
  statValue: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  statValuePro: {
    color: '#FDE047',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: {
      width: 0,
      height: 1
    },
    textShadowRadius: 2
  },
  copyIdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12
  },
  copyIdLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily
  },
  statDivider: {
    width: 1,
    height: '60%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  proFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 230, 163, 0.2)'
  },
  proFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4
  },
  proFeaturePillText: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('600'),
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: theme.typography.fontFamily
  },
  actionItem: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border + '20'
  },
  actionItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md
  },
  actionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionItemInfo: {
    flex: 1
  },
  actionItemTitleWhite: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left'
  },
  actionItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  // Premium Custom Action Items (no full color, cleaner look)
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border + '15'
  },
  premiumIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : 16,
    marginLeft: isRTL ? 16 : 0
  },
  premiumItemTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  premiumItemSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    textAlign: 'left'
  },
  themeOptionsContainer: {
    flexDirection: 'row',
    gap: 8
  },
  themeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.border + '30',
    alignItems: 'center',
    gap: 6
  },
  themeOptionActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary
  },
  themeOptionText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('600')
  },
  themeOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('700')
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 32,
    overflow: 'hidden',
    ...getPlatformShadow('xl'),
    borderWidth: 1,
    borderColor: theme.colors.border + '20'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '15'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalBody: {
    padding: 24
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 10,
    textAlign: 'left'
  },
  nameInput: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    borderWidth: 1,
    borderColor: theme.colors.border + '40'
  },
  modalActions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '15'
  },
  modalButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden'
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceLight,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  saveButton: {
    overflow: 'hidden'
  },
  saveButtonGradient: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  profileSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    textAlign: 'left'
  },
  accountInfo: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border + '15'
  },
  accountInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  accountIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center'
  },
  accountInfoText: {
    flex: 1
  },
  accountStatusText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4
  },
  accountPhoneText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  loginButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md')
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  loginButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  logoutButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    ...getPlatformShadow('sm')
  },
  logoutButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  logoutButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  listItemTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary
  },
  listItemDescription: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  notificationItem: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  notificationItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  notificationItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16
  },
  notificationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center'
  },
  notificationItemInfo: {
    flex: 1
  },
  notificationItemTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left'
  },
  notificationItemDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceLight,
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border + '20'
  },
  timePickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  testNotificationButton: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm')
  },
  testNotificationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  testNotificationButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily
  },
  exportButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 8,
    ...getPlatformShadow('sm'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily,
    color: '#FFFFFF'
  },
  currencyItem: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
    ...getPlatformShadow('sm')
  },
  currencyItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  currencyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16
  },
  currencyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  currencyItemInfo: {
    flex: 1
  },
  currencyItemTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  currencyItemTitleWhite: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left'
  },
  currencyItemDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  currencyItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  currencyPicker: {
    marginTop: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border + '20'
  },
  debugCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 4
  },
  debugTitle: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('800'),
    color: '#F9FAFB',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  debugText: {
    fontSize: 12,
    color: '#D1D5DB',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'left'
  },
  currencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceCard
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primary + '10',
    borderWidth: 1,
    borderColor: theme.colors.primary + '30'
  },
  currencyOptionText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  languageOptionRtl: {
    flexDirection: 'row-reverse'
  },
  languageOptionLtr: {
    flexDirection: 'row'
  },
  languageOptionTextRtl: {
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  languageOptionTextLtr: {
    textAlign: 'left',
    writingDirection: 'ltr'
  },
  languageOptionLabelWrapRtl: {
    flex: 1,
    alignItems: 'flex-end'
  },
  languageOptionLabelWrapLtr: {
    flex: 1,
    alignItems: 'flex-start'
  },
  languageOptionIconSlot: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  currencyOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('800')
  },
  authItem: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    ...getPlatformShadow('sm')
  },
  authItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  authItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md
  },
  authIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  authItemInfo: {
    flex: 1
  },
  authItemTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  authItemTitleWhite: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  authItemDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  authItemDescriptionWhite: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  exchangeRateItem: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 12,
    ...getPlatformShadow('sm')
  },
  exchangeRateItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  exchangeRateItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16
  },
  exchangeRateIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  exchangeRateItemInfo: {
    flex: 1
  },
  exchangeRateItemTitleWhite: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left'
  },
  exchangeRateItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  contactItem: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 14,
    ...getPlatformShadow('md'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  contactItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20
  },
  contactItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16
  },
  contactIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm')
  },
  contactItemInfo: {
    flex: 1,
    gap: 2
  },
  contactItemTitleWhite: {
    fontSize: 17,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  contactItemDescriptionWhite: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    lineHeight: 18,
    fontWeight: getPlatformFontWeight('500')
  },
  copyrightWrapper: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg
  },
  copyrightCard: {
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    ...getPlatformShadow('md')
  },
  copyrightLogo: {
    width: 140,
    height: 45,
    marginBottom: 8,
    tintColor: '#FFFFFF'
  },
  copyrightText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    marginTop: 4
  },
  exchangeRateModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  exchangeRateModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1
  },
  exchangeRateModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
    zIndex: 2,
    position: 'relative'
  },
  exchangeRateModalGradient: {
    width: '100%',
    minHeight: 300
  },
  exchangeRateModalSafeArea: {
    width: '100%'
  },
  exchangeRateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  exchangeRateModalCloseButton: {
    padding: theme.spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  exchangeRateModalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    flex: 1
  },
  exchangeRateModalContent: {
    padding: theme.spacing.lg
  },
  exchangeRateInfoCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('md')
  },
  exchangeRateInfoCardGradient: {
    padding: theme.spacing.lg
  },
  exchangeRateInfoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md
  },
  exchangeRateInfoCardText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  exchangeRateInputSection: {
    marginBottom: theme.spacing.lg
  },
  exchangeRateInputLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: 'left'
  },
  exchangeRateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    ...getPlatformShadow('sm')
  },
  exchangeRateInput: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    paddingVertical: theme.spacing.xs
  },
  exchangeRateInputUnit: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: theme.spacing.sm
  },
  exchangeRateHint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: 'left',
    opacity: 0.7
  },
  exchangeRateModalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md
  },
  exchangeRateCancelButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border
  },
  exchangeRateCancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  exchangeRateSaveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm')
  },
  exchangeRateSaveButtonGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  exchangeRateSaveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  placeholder: {
    width: 40
  },
  timePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  timePickerModalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    paddingBottom: theme.spacing.xxl,
    maxHeight: '50%',
    ...getPlatformShadow('lg'),
    direction: isRTL ? 'rtl' : 'ltr'
  },
  timePickerModalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  timePickerModalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    textAlign: 'center'
  },
  timePickerCancelButton: {
    padding: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'flex-end'
  },
  timePickerCancelText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600')
  },
  timePickerConfirmButton: {
    padding: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'flex-start'
  },
  timePickerConfirmText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700')
  },
  customTimePickerContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceCard,
    minHeight: 250,
    position: 'relative'
  },
  timePickerWheel: {
    height: 250,
    width: 80,
    overflow: 'hidden',
    position: 'relative'
  },
  timePickerScroll: {
    flex: 1
  },
  timePickerScrollContent: {
    paddingVertical: 100
  },
  timePickerItem: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  timePickerItemText: {
    fontSize: 24,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily
  },
  timePickerItemTextSelected: {
    fontSize: 28,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary
  },
  timePickerSeparator: {
    fontSize: 32,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: theme.spacing.md
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
    pointerEvents: 'none'
  },
  referralCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...getPlatformShadow('sm')
  },
  referralHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20
  },
  referralIconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#F59E0B15',
    justifyContent: 'center',
    alignItems: 'center'
  },
  referralTextContent: {
    flex: 1
  },
  referralTitleText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left'
  },
  referralSubtitleText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 18,
    textAlign: 'left'
  },
  referralCodeBox: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  codeContainer: {
    marginBottom: 16
  },
  codeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
    textAlign: 'center'
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  codeValue: {
    fontSize: 24,
    fontWeight: getPlatformFontWeight('900'),
    color: theme.colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 4
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center'
  },
  referralStatBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  referralStatLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily
  },
  referralStatValue: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  shareCodeButton: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    ...getPlatformShadow('md')
  },
  shareCodeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  },
  referralErrorText: {
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    backgroundColor: '#EF444410',
    padding: 12,
    borderRadius: 12
  },
  exportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  exportModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  exportModalContainer: {
    width: '100%',
    maxHeight: '90%'
  },
  exportModalGradient: {
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl
  },
  exportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg
  },
  exportModalCloseButton: {
    padding: 4
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  exportModalContent: {
    paddingBottom: 8
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12
  },
  modeButtonActive: {
    backgroundColor: theme.colors.surfaceCard,
    ...getPlatformShadow('sm')
  },
  modeButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  modeButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('700')
  },
  periodSelectors: {
    marginBottom: 24
  },
  selectorGroup: {
    marginBottom: 20
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: 'left'
  },
  selectorScroll: {
    paddingHorizontal: 4
  },
  periodOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  periodOptionActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary + '30'
  },
  periodOptionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  periodOptionTextActive: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('600')
  },
  confirmExportButton: {
    marginTop: 8
  },
  confirmExportGradient: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    ...getPlatformShadow('md')
  },
  confirmExportText: {
    fontSize: 17,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  }
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
  onClose
}) => {
  const {
    theme
  } = useAppTheme();
  const {
    language,
    isRTL
  } = useLocalization();
  const styles = useMemo(() => createStyles(theme, isRTL), [theme, isRTL]);
  return <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
    <View style={styles.exchangeRateModalOverlay}>
      <TouchableOpacity style={styles.exchangeRateModalBackdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{
        width: '100%',
        alignItems: 'center'
      }}>
        <View style={styles.exchangeRateModalContainer}>
          <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.exchangeRateModalGradient} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }}>
            <SafeAreaView edges={['top']} style={styles.exchangeRateModalSafeArea}>
              {/* Header */}
              <View style={styles.exchangeRateModalHeader}>
                <TouchableOpacity onPress={onClose} style={styles.exchangeRateModalCloseButton} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.exchangeRateModalTitle}>{tl("تعديل سعر الصرف")}</Text>
                <View style={styles.placeholder} />
              </View>

              {/* Content */}
              <View style={styles.exchangeRateModalContent}>
                <View style={styles.exchangeRateInfoCard}>
                  <LinearGradient colors={theme.gradients.primary as any} style={styles.exchangeRateInfoCardGradient} start={{
                    x: 0,
                    y: 0
                  }} end={{
                    x: 1,
                    y: 1
                  }}>
                    <View style={styles.exchangeRateInfoCardContent}>
                      <Ionicons name="cash" size={32} color="#FFFFFF" />
                      <Text style={styles.exchangeRateInfoCardText}>
                        1 USD = ? IQD
                      </Text>
                    </View>
                  </LinearGradient>
                </View>

                <View style={styles.exchangeRateInputSection}>
                  <Text style={styles.exchangeRateInputLabel}>{tl("سعر الصرف (1 دولار = ?")}{getCurrencyDisplayName(selectedCurrency, language)}
                  </Text>
                  <View style={styles.exchangeRateInputContainer}>
                    <TextInput style={styles.exchangeRateInput} value={rate} onChangeText={val => onRateChange(convertArabicToEnglish(val))} placeholder="1315" placeholderTextColor={theme.colors.textSecondary} keyboardType="decimal-pad" textAlign={'left'} />
                    <Text style={styles.exchangeRateInputUnit}>
                      {selectedCurrency}
                    </Text>
                  </View>
                  <Text style={styles.exchangeRateHint}>{tl("أدخل سعر الصرف الحالي للدولار مقابل")}{getCurrencyDisplayName(selectedCurrency, language)}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.exchangeRateModalActions}>
                  <TouchableOpacity onPress={onClose} style={styles.exchangeRateCancelButton} activeOpacity={0.7}>
                    <Text style={styles.exchangeRateCancelButtonText}>{tl("إلغاء")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onSave} style={styles.exchangeRateSaveButton} activeOpacity={0.7}>
                    <LinearGradient colors={theme.gradients.primary as any} style={styles.exchangeRateSaveButtonGradient} start={{
                      x: 0,
                      y: 0
                    }} end={{
                      x: 1,
                      y: 0
                    }}>
                      <Text style={styles.exchangeRateSaveButtonText}>{tl("حفظ")}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
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
  loading
}) => {
  const {
    theme
  } = useAppTheme();
  const {
    isRTL
  } = useLocalization();
  const styles = useMemo(() => createStyles(theme, isRTL), [theme, isRTL]);
  const months = [tl("يناير"), tl("فبراير"), tl("مارس"), tl("أبريل"), tl("مايو"), tl("يونيو"), tl("يوليو"), tl("أغسطس"), tl("سبتمبر"), tl("أكتوبر"), tl("نوفمبر"), tl("ديسمبر")];
  const years = Array.from({
    length: 5
  }, (_, i) => new Date().getFullYear() - i);
  return <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
    <View style={styles.exportModalOverlay}>
      <TouchableOpacity style={styles.exportModalBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.exportModalContainer}>
        <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} style={styles.exportModalGradient} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }}>
          <View style={styles.exportModalHeader}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.exportModalCloseButton}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.exportModalTitle}>{tl("تصدير البيانات")}</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.exportModalContent}>
            <View style={styles.modeToggle}>
              <TouchableOpacity onPress={() => setExportMode('monthly')} style={[styles.modeButton, exportMode === 'monthly' && styles.modeButtonActive]}>
                <Text style={[styles.modeButtonText, exportMode === 'monthly' && styles.modeButtonTextActive]}>{tl("تقرير شهري")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExportMode('all')} style={[styles.modeButton, exportMode === 'all' && styles.modeButtonActive]}>
                <Text style={[styles.modeButtonText, exportMode === 'all' && styles.modeButtonTextActive]}>{tl("جميع البيانات")}</Text>
              </TouchableOpacity>
            </View>

            {exportMode === 'monthly' && <View style={styles.periodSelectors}>
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>{tl("الشهر")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                  {months.map((m, i) => <TouchableOpacity key={m} onPress={() => setExportMonth(i)} style={[styles.periodOption, exportMonth === i && styles.periodOptionActive]}>
                    <Text style={[styles.periodOptionText, exportMonth === i && styles.periodOptionTextActive]}>{m}</Text>
                  </TouchableOpacity>)}
                </ScrollView>
              </View>
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>{tl("السنة")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorScroll}>
                  {years.map(y => <TouchableOpacity key={y} onPress={() => setExportYear(y)} style={[styles.periodOption, exportYear === y && styles.periodOptionActive]}>
                    <Text style={[styles.periodOptionText, exportYear === y && styles.periodOptionTextActive]}>{y}</Text>
                  </TouchableOpacity>)}
                </ScrollView>
              </View>
            </View>}

            <TouchableOpacity onPress={onConfirm} disabled={loading} style={styles.confirmExportButton}>
              <LinearGradient colors={theme.gradients.primary as any} style={styles.confirmExportGradient} start={{
                x: 0,
                y: 0
              }} end={{
                x: 1,
                y: 0
              }}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmExportText}>{tl("تصدير PDF")}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  </Modal>;
};
