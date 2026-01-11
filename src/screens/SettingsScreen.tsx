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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { List, Switch, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { getUserSettings, getAppSettings, upsertAppSettings, getNotificationSettings, upsertNotificationSettings, upsertUserSettings } from '../database/database';
import { initializeNotifications, requestPermissions, scheduleDailyReminder, sendExpenseReminder, cancelNotification, rescheduleAllNotifications, sendTestNotification, verifyScheduledNotifications } from '../services/notificationService';
import { generateMonthlyReport, sharePDF } from '../services/pdfService';
import { AuthSettingsModal } from '../components/AuthSettingsModal';
import { CURRENCIES, Currency } from '../types';
import { alertService } from '../services/alertService';
import { getExchangeRate, upsertExchangeRate } from '../database/database';

export const SettingsScreen = ({ navigation }: any) => {
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
  const [selectedCurrency, setSelectedCurrency] = useState<string>('IQD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showAuthSettings, setShowAuthSettings] = useState(false);
  const [showExchangeRateModal, setShowExchangeRateModal] = useState(false);
  const [usdToIqdRate, setUsdToIqdRate] = useState<string>('1315');
  const [showCurrencyConverter, setShowCurrencyConverter] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [editingName, setEditingName] = useState<string>('');
  const [tempHour, setTempHour] = useState<number>(20);
  const [tempMinute, setTempMinute] = useState<number>(0);
  const dailyHourScrollRef = useRef<ScrollView>(null);
  const dailyMinuteScrollRef = useRef<ScrollView>(null);
  const expenseHourScrollRef = useRef<ScrollView>(null);
  const expenseMinuteScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadSettings();
    // Reload settings when screen comes into focus (to reflect currency changes)
    const unsubscribe = navigation?.addListener?.('focus', loadSettings);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [navigation]);

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      if (userSettings?.name) {
        setUserName(userSettings.name);
      }

      const appSettings = await getAppSettings();
      if (appSettings) {
        setNotificationsEnabled(appSettings.notificationsEnabled);
        // Extract currency code from currency string (e.g., "دينار عراقي" -> "IQD")
        const currency = CURRENCIES.find(c => c.name === appSettings.currency);
        if (currency) {
          setSelectedCurrency(currency.code);
        }
      }

      const notificationSettings = await getNotificationSettings();
      if (notificationSettings) {
        setDailyReminder(notificationSettings.dailyReminder === 1);
        setExpenseReminder(notificationSettings.expenseReminder === 1);
        
        // Parse daily reminder time
        if (notificationSettings.dailyReminderTime) {
          const [hours, minutes] = notificationSettings.dailyReminderTime.split(':').map(Number);
          const dailyTime = new Date();
          dailyTime.setHours(hours, minutes, 0, 0);
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
      console.error('Error loading settings:', error);
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
      const { cancelAllScheduledNotificationsAsync } = await import('expo-notifications');
      await cancelAllScheduledNotificationsAsync();
    }
  };

  const handleDailyReminderToggle = async (value: boolean) => {
    console.log('[SettingsScreen] handleDailyReminderToggle:', value);
    setDailyReminder(value);
    let notificationSettings = await getNotificationSettings();
    
    // Create default settings if they don't exist
    if (!notificationSettings) {
      console.log('[SettingsScreen] No notification settings found, creating default...');
      notificationSettings = {
        dailyReminder: 0,
        dailyReminderTime: '20:00',
        expenseReminder: 0,
        expenseReminderTime: '20:00',
        incomeReminder: 1,
        weeklySummary: 1,
        monthlySummary: 1,
      };
    }
    
    await upsertNotificationSettings({
      ...notificationSettings,
      dailyReminder: value ? 1 : 0,
    });
    
    if (value) {
      console.log('[SettingsScreen] Enabling daily reminder, calling scheduleDailyReminder...');
      try {
        await scheduleDailyReminder();
        console.log('[SettingsScreen] scheduleDailyReminder completed');
      } catch (error) {
        console.error('[SettingsScreen] Error in scheduleDailyReminder:', error);
        alertService.error('خطأ', 'فشل جدولة التذكير اليومي');
      }
    } else {
      // Cancel the notification if disabled
      console.log('[SettingsScreen] Disabling daily reminder, canceling notifications...');
      await cancelNotification('daily-reminder');
      await cancelNotification('daily-reminder-repeat');
    }
  };

  const handleExpenseReminderToggle = async (value: boolean) => {
    console.log('[SettingsScreen] handleExpenseReminderToggle:', value);
    setExpenseReminder(value);
    let notificationSettings = await getNotificationSettings();
    
    // Create default settings if they don't exist
    if (!notificationSettings) {
      console.log('[SettingsScreen] No notification settings found, creating default...');
      notificationSettings = {
        dailyReminder: 0,
        dailyReminderTime: '20:00',
        expenseReminder: 0,
        expenseReminderTime: '20:00',
        incomeReminder: 1,
        weeklySummary: 1,
        monthlySummary: 1,
      };
    }
    
    await upsertNotificationSettings({
      ...notificationSettings,
      expenseReminder: value ? 1 : 0,
    });
    
    if (value) {
      console.log('[SettingsScreen] Enabling expense reminder, calling sendExpenseReminder...');
      try {
        await sendExpenseReminder();
        console.log('[SettingsScreen] sendExpenseReminder completed');
      } catch (error) {
        console.error('[SettingsScreen] Error in sendExpenseReminder:', error);
        alertService.error('خطأ', 'فشل جدولة تذكير المصاريف');
      }
    } else {
      // Cancel the notification if disabled
      console.log('[SettingsScreen] Disabling expense reminder, canceling notifications...');
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
    const hour = dailyReminderTime.getHours();
    const minute = dailyReminderTime.getMinutes();
    setTempHour(hour);
    setTempMinute(minute);
    setShowDailyTimePicker(true);
    setTimeout(() => {
      dailyHourScrollRef.current?.scrollTo({ y: hour * 50, animated: false });
      dailyMinuteScrollRef.current?.scrollTo({ y: minute * 50, animated: false });
    }, 100);
  };

  const handleOpenExpenseTimePicker = () => {
    const hour = expenseReminderTime.getHours();
    const minute = expenseReminderTime.getMinutes();
    setTempHour(hour);
    setTempMinute(minute);
    setShowExpenseTimePicker(true);
    setTimeout(() => {
      expenseHourScrollRef.current?.scrollTo({ y: hour * 50, animated: false });
      expenseMinuteScrollRef.current?.scrollTo({ y: minute * 50, animated: false });
    }, 100);
  };

  const handleDailyTimeConfirm = async () => {
    setShowDailyTimePicker(false);
    const newTime = new Date();
    newTime.setHours(tempHour, tempMinute, 0, 0);
    setDailyReminderTime(newTime);
    
    const timeString = `${tempHour.toString().padStart(2, '0')}:${tempMinute.toString().padStart(2, '0')}`;
    console.log(`[SettingsScreen] Daily reminder time changed to: ${timeString}`);
    
    let notificationSettings = await getNotificationSettings();
    
    // Create default settings if they don't exist
    if (!notificationSettings) {
      console.log('[SettingsScreen] No notification settings found, creating default...');
      notificationSettings = {
        dailyReminder: dailyReminder ? 1 : 0,
        dailyReminderTime: timeString,
        expenseReminder: expenseReminder ? 1 : 0,
        expenseReminderTime: formatTime(expenseReminderTime),
        incomeReminder: 1,
        weeklySummary: 1,
        monthlySummary: 1,
      };
    }
    
    await upsertNotificationSettings({
      ...notificationSettings,
      dailyReminderTime: timeString,
    });
    
    if (dailyReminder) {
      console.log('[SettingsScreen] Daily reminder is enabled, calling scheduleDailyReminder after time change...');
      try {
        await scheduleDailyReminder();
        console.log('[SettingsScreen] scheduleDailyReminder completed after time change');
        alertService.success('نجح', `تم تعيين وقت التذكير اليومي إلى ${timeString}`);
      } catch (error) {
        console.error('[SettingsScreen] Error in scheduleDailyReminder after time change:', error);
        alertService.error('خطأ', 'فشل جدولة التذكير اليومي');
      }
    }
  };

  const handleExpenseTimeConfirm = async () => {
    setShowExpenseTimePicker(false);
    const newTime = new Date();
    newTime.setHours(tempHour, tempMinute, 0, 0);
    setExpenseReminderTime(newTime);
    
    const timeString = `${tempHour.toString().padStart(2, '0')}:${tempMinute.toString().padStart(2, '0')}`;
    console.log(`[SettingsScreen] Expense reminder time changed to: ${timeString}`);
    
    let notificationSettings = await getNotificationSettings();
    
    // Create default settings if they don't exist
    if (!notificationSettings) {
      console.log('[SettingsScreen] No notification settings found, creating default...');
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
      console.log('[SettingsScreen] Expense reminder is enabled, calling sendExpenseReminder after time change...');
      try {
        await sendExpenseReminder();
        console.log('[SettingsScreen] sendExpenseReminder completed after time change');
        alertService.success('نجح', `تم تعيين وقت تذكير المصاريف إلى ${timeString}`);
      } catch (error) {
        console.error('[SettingsScreen] Error in sendExpenseReminder after time change:', error);
        alertService.error('خطأ', 'فشل جدولة تذكير المصاريف');
      }
    }
  };

  const renderTimePickerWheel = (type: 'daily' | 'expense') => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);
    const itemHeight = 50;

    const hourRef = type === 'daily' ? dailyHourScrollRef : expenseHourScrollRef;
    const minuteRef = type === 'daily' ? dailyMinuteScrollRef : expenseMinuteScrollRef;

    const handleHourScroll = (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / itemHeight);
      const hour = Math.max(0, Math.min(23, index));
      setTempHour(hour);
    };

    const handleMinuteScroll = (event: any) => {
      const y = event.nativeEvent.contentOffset.y;
      const index = Math.round(y / itemHeight);
      const minute = Math.max(0, Math.min(59, index));
      setTempMinute(minute);
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
      </View>
    );
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
        currency: 'دينار عراقي',
        language: 'ar',
      };
      await upsertAppSettings({ ...settingsToSave, currency: currency.name });
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
      console.error('Error exporting PDF:', error);
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
      console.error('Error saving exchange rate:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ سعر الصرف');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Info */}
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.appInfoCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* App Name Section */}
          <View style={styles.appNameSection}>
            <View style={styles.appIconWrapper}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                style={styles.appIconContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="wallet" size={32} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={styles.appNameInfo}>
              <Text style={styles.appName}>دنانير</Text>
              <Text style={styles.appDescription}>تطبيقك الذكي لإدارة الأموال</Text>
            </View>
          </View>

          {/* User Name Section */}
          <View style={styles.userNameSection}>
            <View style={styles.userNameHeader}>
              <Ionicons name="person-circle-outline" size={20} color="rgba(255, 255, 255, 0.9)" />
              <Text style={styles.userNameLabel}>اسم المستخدم</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingName(userName);
                setShowNameModal(true);
              }}
              activeOpacity={0.7}
              style={styles.userNameButton}
            >
              {userName ? (
                <View style={styles.userNameContent}>
                  <Text style={styles.userNameText} numberOfLines={1}>
                    {userName}
                  </Text>
                  <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.addNameContent}>
                  <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.addNameText}>أضف اسمك</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* General Settings */}
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.sectionCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>الإعدادات العامة</Text>
            
            <List.Item
              title="الإشعارات"
              description="تلقي تنبيهات حول المصاريف والأهداف"
              left={(props) => <List.Icon {...props} icon="bell" color={theme.colors.primary} />}
              right={() => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              )}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />

            <TouchableOpacity
              onPress={() => setShowAuthSettings(true)}
              style={styles.authItem}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.authItemGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.authItemLeft}>
                  <View style={styles.authIconContainer}>
                    <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.authItemInfo}>
                    <Text style={styles.authItemTitleWhite}>الأمان والقفل</Text>
                    <Text style={styles.authItemDescriptionWhite}>
                      كلمة مرور، Face ID، أو البصمة
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

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
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
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
                  <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Notification Settings */}
        {notificationsEnabled && (
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.sectionCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.sectionTitle}>إعدادات الإشعارات</Text>
              
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
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  />
                </View>
                {dailyReminder && (
                    <TouchableOpacity
                      onPress={handleOpenDailyTimePicker}
                      style={styles.timePickerButton}
                      activeOpacity={0.7}
                    >
                    <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.timePickerText}>اختر الوقت: {formatTime(dailyReminderTime)}</Text>
                    <Ionicons name="chevron-back" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Expense Reminder */}
              <View style={styles.notificationItem}>
                <View style={styles.notificationItemHeader}>
                  <View style={styles.notificationItemLeft}>
                    <View style={styles.notificationIconContainer}>
                      <Ionicons name="cash" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={styles.notificationItemInfo}>
                      <Text style={styles.notificationItemTitle}>تذكير المصاريف</Text>
                      <Text style={styles.notificationItemDescription}>تذكير لتسجيل المصاريف اليومية</Text>
                    </View>
                  </View>
                  <Switch
                    value={expenseReminder}
                    onValueChange={handleExpenseReminderToggle}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  />
                </View>
                {expenseReminder && (
                  <TouchableOpacity
                    onPress={handleOpenExpenseTimePicker}
                    style={styles.timePickerButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                    <Text style={styles.timePickerText}>اختر الوقت: {formatTime(expenseReminderTime)}</Text>
                    <Ionicons name="chevron-back" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

            
            </View>
          </LinearGradient>
        )}

        {/* Export */}
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.sectionCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>التصدير</Text>
            
            <TouchableOpacity
              onPress={handleExportPDF}
              disabled={exportingPDF}
              style={styles.exportButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={theme.gradients.primary as any}
                style={styles.exportButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {exportingPDF ? (
                  <ActivityIndicator color={theme.colors.textInverse} />
                ) : (
                  <>
                    <Ionicons name="document-text" size={20} color={theme.colors.textInverse} />
                    <Text style={styles.exportButtonText}>
                      تصدير تقرير شهري PDF
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Copyright Section */}
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
          </LinearGradient>
        </View>
      </ScrollView>

      <AuthSettingsModal
        visible={showAuthSettings}
        onClose={() => setShowAuthSettings(false)}
        onAuthChanged={() => {
          // Reload settings if needed
        }}
      />

      {/* Exchange Rate Modal */}
      {showExchangeRateModal && selectedCurrency !== 'USD' && (
        <ExchangeRateModal
          visible={showExchangeRateModal}
          rate={usdToIqdRate}
          selectedCurrency={selectedCurrency}
          onRateChange={setUsdToIqdRate}
          onSave={handleSaveExchangeRate}
          onClose={() => setShowExchangeRateModal(false)}
        />
      )}

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
                    try {
                      const currentSettings = await getUserSettings();
                      await upsertUserSettings({
                        name: editingName.trim() || undefined,
                        authMethod: currentSettings?.authMethod || 'none',
                        passwordHash: currentSettings?.passwordHash,
                        biometricsEnabled: currentSettings?.biometricsEnabled || false,
                      });
                      setUserName(editingName.trim() || '');
                      setShowNameModal(false);
                      alertService.success('نجح', 'تم حفظ الاسم بنجاح');
                    } catch (error) {
                      console.error('Error saving name:', error);
                      alertService.error('خطأ', 'فشل حفظ الاسم');
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  sectionContent: {
    padding: theme.spacing.lg,
    direction: 'rtl' as const,
  },
  appInfoCard: {
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  appNameSection: {
    flexDirection:  'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  appIconWrapper: {
    marginRight: isRTL ? 0 : theme.spacing.md,
    marginLeft: isRTL ? theme.spacing.md : 0,
  },
  appIconContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  appNameInfo: {
    flex: 1,
  },
  appName: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign:'left',
  },
  appDescription: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign:  'left',
  },
  userNameSection: {
    padding: theme.spacing.lg,
  },
  userNameHeader: {
    flexDirection: isRTL ? 'row' : 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  userNameLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign:  'left',
  },
  userNameButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  userNameContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  userNameText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  addNameContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addNameText: {
    fontSize: theme.typography.sizes.md,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: 'right',
  },
  nameInput: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalActions: {
    flexDirection: 'row-reverse',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  modalButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  listItemTitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  listItemDescription: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  notificationItem: {
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    direction: 'ltr' as const,
  },
  notificationItemHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  notificationItemLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationItemInfo: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  notificationItemDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  timePickerButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  timePickerText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  testNotificationButton: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
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
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  exportButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  exportButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  exportButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textInverse,
  },
  currencyItem: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  currencyItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    direction: 'rtl' as const,
  },
  currencyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  currencyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyItemInfo: {
    flex: 1,
  },
  currencyItemTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  currencyItemTitleWhite: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  currencyItemDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  currencyItemDescriptionWhite: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  currencyPicker: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  currencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceCard,
    marginBottom: theme.spacing.xs,
  },
  currencyOptionSelected: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  currencyOptionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  currencyOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  authItem: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
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
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  authItemTitleWhite: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
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
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  exchangeRateItemGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    direction: 'rtl' as const,
  },
  exchangeRateItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  exchangeRateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeRateItemInfo: {
    flex: 1,
  },
  exchangeRateItemTitleWhite: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  exchangeRateItemDescriptionWhite: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
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
    ...theme.shadows.lg,
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
    fontWeight: '700',
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
    ...theme.shadows.md,
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
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  exchangeRateInputSection: {
    marginBottom: theme.spacing.lg,
  },
  exchangeRateInputLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
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
    ...theme.shadows.sm,
  },
  exchangeRateInput: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    paddingVertical: theme.spacing.xs,
  },
  exchangeRateInputUnit: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  exchangeRateSaveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  exchangeRateSaveButtonGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exchangeRateSaveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
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
    ...theme.shadows.lg,
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
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    textAlign: 'center',
  },
  timePickerCancelButton: {
    padding: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'flex-start',
  },
  timePickerCancelText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
  },
  timePickerConfirmButton: {
    padding: theme.spacing.sm,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  timePickerConfirmText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '700',
  },
  customTimePickerContainer: {
    flexDirection: 'row',
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
    fontWeight: '600',
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
  },
  timePickerItemTextSelected: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  timePickerSeparator: {
    fontSize: 32,
    fontWeight: '700',
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
  copyrightWrapper: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  copyrightCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copyrightLogo: {
    width: 120,
    height: 40,
    marginBottom: theme.spacing.md,
  },
  copyrightText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    opacity: 0.9,
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
                      onChangeText={onRateChange}
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
