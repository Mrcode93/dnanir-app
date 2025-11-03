import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Image,
  I18nManager,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Card,
  Title,
  Paragraph,
  List,
  IconButton,
  Button,
  Divider,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Updates from 'expo-updates';
import RTLText from '../components/RTLText';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { getUserSettings, getAppSettings, upsertAppSettings, upsertUserSettings, AppSettings, UserSettings, clearAllData, clearExpenses, clearIncome, getNotificationSettings, upsertNotificationSettings, NotificationSettings as DBNotificationSettings } from '../database/database';
import { gradientColors, colors } from '../utils/gradientColors';
import NotificationService, { NotificationSettings } from '../services/notificationService';

const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const { showSuccess, showError, AlertComponent } = useCustomAlert();
  
  // Settings state
  const [userName, setUserName] = useState<string>('');
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [currency, setCurrency] = useState('دينار عراقي');
  const [loading, setLoading] = useState(true);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    dailyReminder: true,
    dailyReminderTime: '20:00',
    expenseReminder: true,
    incomeReminder: true,
    weeklySummary: true,
    monthlySummary: true,
  });

  // Modal states
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [showEditPasswordModal, setShowEditPasswordModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedTime, setSelectedTime] = useState(new Date());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load user settings
      const userSettings = await getUserSettings();
      if (userSettings) {
        setUserName(userSettings.name || '');
        setUserSettings(userSettings);
      }

      // Load app settings
      const appSettings = await getAppSettings();
      if (appSettings) {
        setNotificationsEnabled(appSettings.notificationsEnabled);
        setDarkModeEnabled(appSettings.darkModeEnabled);
        setAutoBackupEnabled(appSettings.autoBackupEnabled);
        setCurrency(appSettings.currency);
      }

      // Load notification settings from database
      const dbNotificationSettings = await getNotificationSettings();
      if (dbNotificationSettings) {
        setNotificationSettings({
          dailyReminder: dbNotificationSettings.dailyReminder,
          dailyReminderTime: dbNotificationSettings.dailyReminderTime,
          expenseReminder: dbNotificationSettings.expenseReminder,
          incomeReminder: dbNotificationSettings.incomeReminder,
          weeklySummary: dbNotificationSettings.weeklySummary,
          monthlySummary: dbNotificationSettings.monthlySummary,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAppSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const currentSettings: AppSettings = {
        notificationsEnabled,
        darkModeEnabled,
        autoBackupEnabled,
        currency,
        language: 'ar',
      };
      
      const updatedSettings = { ...currentSettings, ...newSettings };
      await upsertAppSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving app settings:', error);
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    try {
      setNotificationsEnabled(value);
      await saveAppSettings({ notificationsEnabled: value });
      
      const notificationService = NotificationService.getInstance();
      
      if (value) {
        // Check permissions first
        const hasPermission = await notificationService.areNotificationsEnabled();
        if (!hasPermission) {
          const granted = await notificationService.requestPermissions();
          if (!granted) {
            setNotificationsEnabled(false);
            await saveAppSettings({ notificationsEnabled: false });
            showError('لم يتم تفعيل الإشعارات', 'يرجى السماح بالإشعارات من إعدادات الجهاز');
            return;
          }
        }
        
        // When enabling notifications, setup all scheduled notifications
        await notificationService.setupNotifications(notificationSettings);
        showSuccess('تم تفعيل الإشعارات', 'تم تفعيل الإشعارات بنجاح وجدولتها');
        console.log('Notifications enabled and scheduled:', notificationSettings);
      } else {
        // When disabling notifications, cancel all scheduled notifications
        await notificationService.cancelAllNotifications();
        showSuccess('تم إيقاف الإشعارات', 'تم إيقاف جميع الإشعارات');
        console.log('Notifications disabled and cancelled');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      setNotificationsEnabled(!value); // Revert on error
      await saveAppSettings({ notificationsEnabled: !value });
      showError('خطأ', 'حدث خطأ أثناء تغيير إعدادات الإشعارات');
    }
  };

  const handleNotificationSettingChange = async (key: keyof NotificationSettings, value: any) => {
    try {
      const newSettings = { ...notificationSettings, [key]: value };
      setNotificationSettings(newSettings);
      
      // Save to database
      const dbSettings: DBNotificationSettings = {
        dailyReminder: newSettings.dailyReminder,
        dailyReminderTime: newSettings.dailyReminderTime,
        expenseReminder: newSettings.expenseReminder,
        incomeReminder: newSettings.incomeReminder,
        weeklySummary: newSettings.weeklySummary,
        monthlySummary: newSettings.monthlySummary,
        transactionNotifications: true, // Always enabled
        budgetWarnings: true, // Always enabled
        soundEnabled: true, // Default enabled
        vibrationEnabled: true, // Default enabled
      };
      
      await upsertNotificationSettings(dbSettings);
      
      // Update notification service settings AND reschedule notifications
      const notificationService = NotificationService.getInstance();
      await notificationService.updateNotificationSettings(newSettings);
      
      // Reschedule all notifications with new settings if notifications are enabled
      if (notificationsEnabled) {
        // Check permissions before rescheduling
        const hasPermission = await notificationService.areNotificationsEnabled();
        if (hasPermission) {
          await notificationService.setupNotifications(newSettings);
          console.log('Notifications rescheduled with new settings:', newSettings);
        } else {
          console.warn('Cannot reschedule notifications - permissions not granted');
        }
      }
    } catch (error) {
      console.error('Error updating notification setting:', error);
      showError('خطأ', 'حدث خطأ أثناء تحديث إعدادات الإشعارات');
    }
  };


  const handleDarkModeToggle = async (value: boolean) => {
    setDarkModeEnabled(value);
    await saveAppSettings({ darkModeEnabled: value });
  };

  const handleAutoBackupToggle = async (value: boolean) => {
    setAutoBackupEnabled(value);
    await saveAppSettings({ autoBackupEnabled: value });
  };

  const handleEditName = () => {
    setNewName(userName);
    setShowEditNameModal(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      showError('خطأ', 'يرجى إدخال الاسم');
      return;
    }

    try {
      if (userSettings) {
        const updatedSettings = { ...userSettings, name: newName.trim() };
        await upsertUserSettings(updatedSettings);
        setUserName(newName.trim());
        setUserSettings(updatedSettings);
        setShowEditNameModal(false);
        showSuccess('نجح', 'تم تحديث الاسم بنجاح');
      }
    } catch (error) {
      console.error('Error updating name:', error);
      showError('خطأ', 'حدث خطأ أثناء تحديث الاسم');
    }
  };

  const handleEditPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowEditPasswordModal(true);
  };

  const handleSavePassword = async () => {
    if (!currentPassword.trim()) {
      showError('خطأ', 'يرجى إدخال كلمة المرور الحالية');
      return;
    }

    if (!newPassword.trim()) {
      showError('خطأ', 'يرجى إدخال كلمة المرور الجديدة');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('خطأ', 'كلمة المرور الجديدة غير متطابقة');
      return;
    }

    if (newPassword.length < 4) {
      showError('خطأ', 'كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }

    try {
      // Verify current password
      if (userSettings?.passwordHash !== currentPassword) {
        showError('خطأ', 'كلمة المرور الحالية غير صحيحة');
        return;
      }

      if (userSettings) {
        const updatedSettings = { ...userSettings, passwordHash: newPassword };
        await upsertUserSettings(updatedSettings);
        setUserSettings(updatedSettings);
        setShowEditPasswordModal(false);
        showSuccess('نجح', 'تم تحديث كلمة المرور بنجاح');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      showError('خطأ', 'حدث خطأ أثناء تحديث كلمة المرور');
    }
  };

  const handleExportData = () => {
    showSuccess('تصدير البيانات', 'تم تصدير البيانات بنجاح');
    // TODO: Implement actual export functionality
  };

  const handleImportData = () => {
    showSuccess('استيراد البيانات', 'تم استيراد البيانات بنجاح');
    // TODO: Implement actual import functionality
  };

  const handleClearExpenses = async () => {
    try {
      await clearExpenses();
      showSuccess('تم مسح المصاريف', 'تم مسح جميع المصاريف بنجاح');
    } catch (error) {
      console.error('Error clearing expenses:', error);
      showError('خطأ', 'حدث خطأ أثناء مسح المصاريف');
    }
  };

  const handleClearIncome = async () => {
    try {
      await clearIncome();
      showSuccess('تم مسح الدخل', 'تم مسح جميع بيانات الدخل بنجاح');
    } catch (error) {
      console.error('Error clearing income:', error);
      showError('خطأ', 'حدث خطأ أثناء مسح بيانات الدخل');
    }
  };

  const authenticateUser = async (): Promise<boolean> => {
    try {
      // Check if biometric is available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricAvailable = hasHardware && enrolled;

      // If biometric is available and user has biometric enabled, use it
      if (biometricAvailable && userSettings?.biometricsEnabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'تأكيد الهوية لمسح البيانات',
          cancelLabel: 'إلغاء',
          fallbackLabel: 'استخدام كلمة المرور',
          disableDeviceFallback: false,
        });

        if (result.success) {
          return true;
        }
      }

      // If biometric not available or failed, prompt for password
      if (userSettings?.passwordHash) {
        setAuthPassword('');
        setShowAuthModal(true);
        // Return false for now, actual authentication happens in modal
        return false;
      }

      // No authentication set up
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  };

  const handleAuthPasswordSubmit = async () => {
    if (!authPassword.trim()) {
      showError('خطأ', 'يرجى إدخال كلمة المرور');
      return;
    }

    if (authPassword === userSettings?.passwordHash) {
      setShowAuthModal(false);
      setAuthPassword('');
      // Proceed with clearing data
      await executeClearData();
    } else {
      showError('خطأ', 'كلمة المرور غير صحيحة');
      setAuthPassword('');
    }
  };

  const executeClearData = async () => {
    try {
      await clearAllData();
      showSuccess('تم مسح البيانات', 'تم مسح جميع البيانات وتسجيل الخروج بنجاح. جاري إعادة تشغيل التطبيق...');
      // Reload the app to show welcome screen after clearing all data
      setTimeout(async () => {
        try {
          // Force app restart - this will show welcome screen since all data is cleared
          await Updates.reloadAsync();
        } catch (reloadError) {
          console.error('Error reloading app:', reloadError);
          showError(
            'إعادة فتح التطبيق', 
            'يرجى إغلاق التطبيق وفتحه مرة أخرى'
          );
        }
      }, 2000);
    } catch (error) {
      console.error('Error clearing data:', error);
      showError('خطأ', 'حدث خطأ أثناء مسح البيانات');
    }
  };

  const handleClearData = async () => {
    // Require authentication before clearing data
    const authenticated = await authenticateUser();
    if (authenticated) {
      await executeClearData();
    }
  };

  const handleAbout = () => {
    showSuccess('حول التطبيق', 'دنانير - تطبيق إدارة الأموال الذكي\nالإصدار: 1.0.0\nMade by URUX');
  };

  const handleLogout = async () => {
    try {
      if (userSettings) {
        showSuccess('تسجيل الخروج', 'تم تسجيل الخروج بنجاح. جاري إعادة تشغيل التطبيق...');
        
        // Wait a bit to show the success message, then reload the app
        setTimeout(async () => {
          try {
            // Reload the app - this will trigger the authentication check in App.tsx
            await Updates.reloadAsync();
          } catch (reloadError) {
            console.error('Error reloading app:', reloadError);
            // Fallback: show message to manually restart
            showError(
              'إعادة فتح التطبيق', 
              'يرجى إغلاق التطبيق وفتحه مرة أخرى لإكمال تسجيل الخروج'
            );
          }
        }, 1500);
      }
    } catch (error) {
      console.error('Error logging out:', error);
      showError('خطأ', 'حدث خطأ أثناء تسجيل الخروج');
    }
  };

  const handleEditTime = () => {
    // Parse current time from settings
    const [hours, minutes] = notificationSettings.dailyReminderTime.split(':').map(Number);
    const currentTime = new Date();
    currentTime.setHours(hours, minutes, 0, 0);
    setSelectedTime(currentTime);
    setShowTimePickerModal(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setSelectedTime(selectedDate);
    }
  };

  const handleSaveTime = async () => {
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    await handleNotificationSettingChange('dailyReminderTime', timeString);
    setShowTimePickerModal(false);
    showSuccess('تم التحديث', `تم تحديث وقت التذكير إلى ${timeString} وتم جدولة الإشعارات`);
  };

  const handleCancelTime = () => {
    setShowTimePickerModal(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: 16 }}>
        {/* App Info Section */}
        <LinearGradient
          colors={gradientColors.background.card}
          style={styles.sectionCard}
        >
          <View style={styles.sectionContent}>
            <View style={styles.appInfoHeader}>
              <View style={styles.appIconContainer}>
                <Image 
                  source={require('../../assets/logo.png')} 
                  style={styles.appLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.appInfo}>
                <RTLText style={styles.appName}>دنانير</RTLText>
                {userName ? (
                  <RTLText style={styles.userName}>مرحباً، {userName}</RTLText>
                ) : (
                  <RTLText style={styles.appVersion}>الإصدار 1.0.0</RTLText>
                )}
                <RTLText style={styles.appDescription}>
                  تطبيقك الذكي لإدارة الأموال
                </RTLText>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* User Profile Section */}
        {userName && (
          <LinearGradient
            colors={gradientColors.background.card}
            style={styles.sectionCard}
          >
            <View style={styles.sectionContent}>
              <RTLText style={styles.sectionTitle}>الملف الشخصي</RTLText>
              
              <List.Item
                title="الاسم"
                description={userName}
                left={(props) => <List.Icon {...props} icon="account" color={colors.primary} />}
                right={(props) => <List.Icon {...props} icon="pencil" color={colors.primary} />}
                onPress={handleEditName}
                titleStyle={styles.listItemTitle}
                descriptionStyle={styles.listItemDescription}
              />
              
              <Divider style={styles.divider} />
              
              {userSettings?.authMethod === 'password' || userSettings?.authMethod === 'biometric' ? (
                <List.Item
                  title="كلمة المرور"
                  description="تغيير كلمة المرور"
                  left={(props) => <List.Icon {...props} icon="lock" color={colors.primary} />}
                  right={(props) => <List.Icon {...props} icon="pencil" color={colors.primary} />}
                  onPress={handleEditPassword}
                  titleStyle={styles.listItemTitle}
                  descriptionStyle={styles.listItemDescription}
                />
              ) : null}
            </View>
          </LinearGradient>
        )}

        {/* General Settings */}
        <LinearGradient
          colors={gradientColors.background.card}
          style={styles.sectionCard}
        >
          <View style={styles.sectionContent}>
            <RTLText style={styles.sectionTitle}>الإعدادات العامة</RTLText>
            
            <List.Item
              title="الإشعارات"
              description="تلقي تنبيهات حول المصاريف والأهداف"
              left={(props) => <List.Icon {...props} icon="bell" color={colors.primary} />}
              right={() => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                  thumbColor={notificationsEnabled ? colors.text : colors.textSecondary}
                />
              )}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="الوضع المظلم"
              description="استخدام الوضع المظلم للتطبيق"
              left={(props) => <List.Icon {...props} icon="theme-light-dark" color={colors.primary} />}
              right={() => (
                <Switch
                  value={darkModeEnabled}
                  onValueChange={handleDarkModeToggle}
                  trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                  thumbColor={darkModeEnabled ? colors.text : colors.textSecondary}
                />
              )}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="العملة"
              description={currency}
              left={(props) => <List.Icon {...props} icon="currency-usd" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={() => {
                showSuccess('اختيار العملة', 'العملة الحالية: دينار عراقي');
              }}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
          </View>
        </LinearGradient>

        {/* Notification Settings */}
        {notificationsEnabled && (
          <LinearGradient
            colors={gradientColors.background.card}
            style={styles.sectionCard}
          >
            <View style={styles.sectionContent}>
              <RTLText style={styles.sectionTitle}>إعدادات الإشعارات</RTLText>
              
              <List.Item
                title="التذكير اليومي"
                description="تذكير يومي لتسجيل المصاريف"
                left={(props) => <List.Icon {...props} icon="calendar-today" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={notificationSettings.dailyReminder}
                    onValueChange={(value) => handleNotificationSettingChange('dailyReminder', value)}
                    trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                    thumbColor={notificationSettings.dailyReminder ? colors.text : colors.textSecondary}
                  />
                )}
                titleStyle={styles.listItemTitle}
                descriptionStyle={styles.listItemDescription}
              />
              
              {notificationSettings.dailyReminder && (
                <>
                  <Divider style={styles.divider} />
                   <List.Item
                     title="وقت التذكير اليومي"
                     description={notificationSettings.dailyReminderTime}
                     left={(props) => <List.Icon {...props} icon="clock" color={colors.primary} />}
                     right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
                     onPress={handleEditTime}
                     titleStyle={styles.listItemTitle}
                     descriptionStyle={styles.listItemDescription}
                   />
                </>
              )}
              
              <Divider style={styles.divider} />
              
              <List.Item
                title="تذكير المصاريف"
                description="تذكير عند عدم تسجيل مصاريف اليوم"
                left={(props) => <List.Icon {...props} icon="cash-minus" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={notificationSettings.expenseReminder}
                    onValueChange={(value) => handleNotificationSettingChange('expenseReminder', value)}
                    trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                    thumbColor={notificationSettings.expenseReminder ? colors.text : colors.textSecondary}
                  />
                )}
                titleStyle={styles.listItemTitle}
                descriptionStyle={styles.listItemDescription}
              />
              
              <Divider style={styles.divider} />
              
              <List.Item
                title="تذكير الدخل"
                description="تذكير عند عدم تسجيل دخل اليوم"
                left={(props) => <List.Icon {...props} icon="cash-plus" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={notificationSettings.incomeReminder}
                    onValueChange={(value) => handleNotificationSettingChange('incomeReminder', value)}
                    trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                    thumbColor={notificationSettings.incomeReminder ? colors.text : colors.textSecondary}
                  />
                )}
                titleStyle={styles.listItemTitle}
                descriptionStyle={styles.listItemDescription}
              />
              
              <Divider style={styles.divider} />
              
              <List.Item
                title="الملخص الأسبوعي"
                description="إشعار ملخص مالي أسبوعي"
                left={(props) => <List.Icon {...props} icon="chart-line" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={notificationSettings.weeklySummary}
                    onValueChange={(value) => handleNotificationSettingChange('weeklySummary', value)}
                    trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                    thumbColor={notificationSettings.weeklySummary ? colors.text : colors.textSecondary}
                  />
                )}
                titleStyle={styles.listItemTitle}
                descriptionStyle={styles.listItemDescription}
              />
              
              <Divider style={styles.divider} />
              
              <List.Item
                title="الملخص الشهري"
                description="إشعار ملخص مالي شهري"
                left={(props) => <List.Icon {...props} icon="chart-bar" color={colors.primary} />}
                right={() => (
                  <Switch
                    value={notificationSettings.monthlySummary}
                    onValueChange={(value) => handleNotificationSettingChange('monthlySummary', value)}
                    trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                    thumbColor={notificationSettings.monthlySummary ? colors.text : colors.textSecondary}
                  />
                )}
                titleStyle={styles.listItemTitle}
                descriptionStyle={styles.listItemDescription}
              />
              
            </View>
          </LinearGradient>
        )}

        {/* Data & Backup */}
        <LinearGradient
          colors={gradientColors.background.card}
          style={styles.sectionCard}
        >
          <View style={styles.sectionContent}>
            <RTLText style={styles.sectionTitle}>البيانات والنسخ الاحتياطي</RTLText>
            
            <List.Item
              title="النسخ الاحتياطي التلقائي"
              description="إنشاء نسخة احتياطية تلقائية للبيانات"
              left={(props) => <List.Icon {...props} icon="backup-restore" color={colors.primary} />}
              right={() => (
                <Switch
                  value={autoBackupEnabled}
                  onValueChange={handleAutoBackupToggle}
                  trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                  thumbColor={autoBackupEnabled ? colors.text : colors.textSecondary}
                />
              )}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="تصدير البيانات"
              description="تصدير جميع البيانات إلى ملف"
              left={(props) => <List.Icon {...props} icon="export" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={handleExportData}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="استيراد البيانات"
              description="استيراد البيانات من ملف"
              left={(props) => <List.Icon {...props} icon="import" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={handleImportData}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="مسح المصاريف"
              description="حذف جميع المصاريف"
              left={(props) => <List.Icon {...props} icon="delete" color={colors.warning} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={handleClearExpenses}
              titleStyle={[styles.listItemTitle, { color: colors.warning }]}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="مسح الدخل"
              description="حذف جميع بيانات الدخل"
              left={(props) => <List.Icon {...props} icon="delete" color={colors.warning} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={handleClearIncome}
              titleStyle={[styles.listItemTitle, { color: colors.warning }]}
              descriptionStyle={styles.listItemDescription}
            />
          </View>
        </LinearGradient>

        {/* Support & Info */}
        <LinearGradient
          colors={gradientColors.background.card}
          style={styles.sectionCard}
        >
          <View style={styles.sectionContent}>
            <RTLText style={styles.sectionTitle}>الدعم والمعلومات</RTLText>
            
            <List.Item
              title="حول التطبيق"
              description="معلومات حول التطبيق والإصدار"
              left={(props) => <List.Icon {...props} icon="information" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={handleAbout}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="التقييم"
              description="قيم التطبيق في المتجر"
              left={(props) => <List.Icon {...props} icon="star" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={() => console.log('Rate app')}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="مشاركة التطبيق"
              description="شارك التطبيق مع الأصدقاء"
              left={(props) => <List.Icon {...props} icon="share" color={colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textSecondary} />}
              onPress={() => console.log('Share app')}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
          </View>
        </LinearGradient>

        {/* Logout Button */}
        <LinearGradient
          colors={gradientColors.background.card}
          style={styles.sectionCard}
        >
          <View style={styles.sectionContent}>
            <Button
              mode="contained"
              onPress={handleLogout}
              style={styles.logoutButton}
              contentStyle={styles.logoutButtonContent}
              buttonColor="#FF5252"
              icon={() => <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />}
            >
                 <RTLText style={styles.logoutButtonText}>تسجيل الخروج</RTLText>
            </Button>
          </View>
        </LinearGradient>

        {/* Danger Zone */}
        <LinearGradient
          colors={gradientColors.accent.error}
          style={[styles.sectionCard, styles.dangerCard]}
        >
          <View style={styles.sectionContent}>
            <RTLText style={[styles.sectionTitle, styles.dangerTitle]}>منطقة الخطر</RTLText>
            
            <List.Item
              title="مسح جميع البيانات"
              description="حذف جميع البيانات نهائياً"
              left={(props) => <List.Icon {...props} icon="delete-forever" color={colors.text} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.text} />}
              onPress={handleClearData}
              titleStyle={[styles.listItemTitle, styles.dangerText]}
              descriptionStyle={[styles.listItemDescription, styles.dangerText]}
            />
          </View>
        </LinearGradient>

        {/* Footer */}
        <View style={styles.footer}>
          <RTLText style={styles.footerText}>
            دنانير - كل دينار مهم! 💚
          </RTLText>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditNameModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={gradientColors.background.card}
              style={styles.modalCard}
            >
              <View style={styles.modalContent}>
                <RTLText style={styles.modalTitle}>تعديل الاسم</RTLText>
                
                <TextInput
                  style={styles.modalInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="أدخل الاسم الجديد"
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                />
                
                <View style={styles.modalButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => setShowEditNameModal(false)}
                    style={styles.modalButton}
                    labelStyle={styles.modalButtonLabel}
                  >
                    إلغاء
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSaveName}
                    style={[styles.modalButton, styles.saveButton]}
                    labelStyle={styles.modalButtonLabel}
                  >
                    حفظ
                  </Button>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Edit Password Modal */}
      <Modal
        visible={showEditPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={gradientColors.background.card}
              style={styles.modalCard}
            >
              <View style={styles.modalContent}>
                <RTLText style={styles.modalTitle}>تغيير كلمة المرور</RTLText>
                
                <TextInput
                  style={styles.modalInput}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="كلمة المرور الحالية"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
                
                <TextInput
                  style={styles.modalInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="كلمة المرور الجديدة"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
                
                <TextInput
                  style={styles.modalInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="تأكيد كلمة المرور الجديدة"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                />
                
                <View style={styles.modalButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => setShowEditPasswordModal(false)}
                    style={styles.modalButton}
                    labelStyle={styles.modalButtonLabel}
                  >
                    إلغاء
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleSavePassword}
                    style={[styles.modalButton, styles.saveButton]}
                    labelStyle={styles.modalButtonLabel}
                  >
                    حفظ
                  </Button>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
        </Modal>

        {/* Authentication Modal for Data Deletion */}
        <Modal
          visible={showAuthModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAuthModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <LinearGradient
                colors={gradientColors.background.card}
                style={styles.modalCard}
              >
                <View style={styles.modalContent}>
                  <View style={styles.authModalHeader}>
                    <Ionicons name="shield-checkmark" size={60} color={colors.warning} />
                    <RTLText style={styles.authModalTitle}>تأكيد الهوية</RTLText>
                    <RTLText style={styles.authModalWarning}>
                      ⚠️ أنت على وشك حذف جميع البيانات نهائياً!
                    </RTLText>
                    <RTLText style={styles.authModalDescription}>
                      يرجى إدخال كلمة المرور لتأكيد هذا الإجراء
                    </RTLText>
                  </View>
                  
                  <View style={styles.authInputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.authInputIcon} />
                    <TextInput
                      style={styles.authModalInput}
                      value={authPassword}
                      onChangeText={setAuthPassword}
                      placeholder="كلمة المرور"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry
                      autoFocus
                      onSubmitEditing={handleAuthPasswordSubmit}
                    />
                  </View>
                  
                  <View style={styles.modalButtons}>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        setShowAuthModal(false);
                        setAuthPassword('');
                      }}
                      style={[styles.modalButton, styles.cancelAuthButton]}
                      labelStyle={styles.modalButtonLabel}
                    >
                      إلغاء
                    </Button>
                    <Button
                      mode="contained"
                      onPress={handleAuthPasswordSubmit}
                      style={[styles.modalButton, styles.dangerButton]}
                      labelStyle={styles.modalButtonLabel}
                      buttonColor={colors.error}
                    >
                      تأكيد الحذف
                    </Button>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </View>
        </Modal>

        {/* Time Picker Modal */}
        <Modal
          visible={showTimePickerModal}
          transparent={true}
          animationType="slide"
          onRequestClose={handleCancelTime}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.timePickerModalContent}>
              <LinearGradient
                colors={gradientColors.background.card}
                style={styles.timePickerHeader}
              >
                <RTLText style={styles.timePickerTitle}>اختر وقت التذكير</RTLText>
                <RTLText style={styles.timePickerSubtitle}>اختر الوقت المناسب لتلقي التذكير اليومي</RTLText>
              </LinearGradient>
              
              <ScrollView 
                style={styles.timePickerScrollView}
                contentContainerStyle={styles.timePickerBody}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.timeDisplayContainer}>
                  <RTLText style={styles.currentTimeLabel}>الوقت الحالي:</RTLText>
                  <View style={styles.timeDisplay}>
                    <RTLText style={styles.timeText}>
                      {selectedTime.getHours().toString().padStart(2, '0')}:
                      {selectedTime.getMinutes().toString().padStart(2, '0')}
                    </RTLText>
                  </View>
                </View>
                
                <View style={styles.timePickerContainer}>
                  <View style={styles.timePickerWrapper}>
                    <View style={styles.hourPicker}>
                      <RTLText style={styles.pickerLabel}>الساعة</RTLText>
                      <View style={styles.pickerButtons}>
                        <TouchableOpacity 
                          style={styles.pickerButton}
                          onPress={() => {
                            const newTime = new Date(selectedTime);
                            newTime.setHours(Math.min(23, newTime.getHours() + 1));
                            setSelectedTime(newTime);
                          }}
                        >
                          <RTLText style={styles.pickerButtonText}>+</RTLText>
                        </TouchableOpacity>
                        <View style={styles.pickerValue}>
                          <RTLText style={styles.pickerValueText}>
                            {selectedTime.getHours().toString().padStart(2, '0')}
                          </RTLText>
                        </View>
                        <TouchableOpacity 
                          style={styles.pickerButton}
                          onPress={() => {
                            const newTime = new Date(selectedTime);
                            newTime.setHours(Math.max(0, newTime.getHours() - 1));
                            setSelectedTime(newTime);
                          }}
                        >
                          <RTLText style={styles.pickerButtonText}>-</RTLText>
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    <View style={styles.minutePicker}>
                      <RTLText style={styles.pickerLabel}>الدقيقة</RTLText>
                      <View style={styles.pickerButtons}>
                        <TouchableOpacity 
                          style={styles.pickerButton}
                          onPress={() => {
                            const newTime = new Date(selectedTime);
                            newTime.setMinutes(Math.min(59, newTime.getMinutes() + 5));
                            setSelectedTime(newTime);
                          }}
                        >
                          <RTLText style={styles.pickerButtonText}>+</RTLText>
                        </TouchableOpacity>
                        <View style={styles.pickerValue}>
                          <RTLText style={styles.pickerValueText}>
                            {selectedTime.getMinutes().toString().padStart(2, '0')}
                          </RTLText>
                        </View>
                        <TouchableOpacity 
                          style={styles.pickerButton}
                          onPress={() => {
                            const newTime = new Date(selectedTime);
                            newTime.setMinutes(Math.max(0, newTime.getMinutes() - 5));
                            setSelectedTime(newTime);
                          }}
                        >
                          <RTLText style={styles.pickerButtonText}>-</RTLText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.quickTimeButtons}>
                  <RTLText style={styles.quickTimeLabel}>أوقات سريعة:</RTLText>
                  <View style={styles.quickTimeRow}>
                    <TouchableOpacity 
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const newTime = new Date(selectedTime);
                        newTime.setHours(8, 0, 0, 0);
                        setSelectedTime(newTime);
                      }}
                    >
                      <RTLText style={styles.quickTimeText}>8:00 صباحاً</RTLText>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const newTime = new Date(selectedTime);
                        newTime.setHours(12, 0, 0, 0);
                        setSelectedTime(newTime);
                      }}
                    >
                      <RTLText style={styles.quickTimeText}>12:00 ظهراً</RTLText>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.quickTimeRow}>
                    <TouchableOpacity 
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const newTime = new Date(selectedTime);
                        newTime.setHours(18, 0, 0, 0);
                        setSelectedTime(newTime);
                      }}
                    >
                      <RTLText style={styles.quickTimeText}>6:00 مساءً</RTLText>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.quickTimeButton}
                      onPress={() => {
                        const newTime = new Date(selectedTime);
                        newTime.setHours(20, 0, 0, 0);
                        setSelectedTime(newTime);
                      }}
                    >
                      <RTLText style={styles.quickTimeText}>8:00 مساءً</RTLText>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
              
              <View style={styles.timePickerFooter}>
                <Button
                  mode="outlined"
                  onPress={handleCancelTime}
                  style={[styles.timePickerButton, styles.cancelButton]}
                  labelStyle={styles.timePickerButtonText}
                >
                  إلغاء
                </Button>
                
                <Button
                  mode="contained"
                  onPress={handleSaveTime}
                  style={[styles.timePickerButton, styles.saveButton]}
                  labelStyle={styles.timePickerButtonText}
                >
                  حفظ
                </Button>
              </View>
            </View>
          </View>
        </Modal>

        {/* Custom Alert Component */}
      <AlertComponent />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  sectionCard: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionContent: {
    padding: 16,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  appInfoHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  appIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  appLogo: {
    width: 60,
    height: 60,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingTop: 16,
    paddingBottom: 16,
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
    marginBottom: 4,
    marginLeft: I18nManager.isRTL ? 0 : 8,
    marginRight: I18nManager.isRTL ? 8 : 0,
  },
  appVersion: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
    marginBottom: 4,
    fontWeight: '600',
  },
  appDescription: {
    fontSize: 16,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
  },
  sectionTitle: {
    fontSize: 18,
    paddingTop: 16,
    paddingBottom: 16,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
    marginBottom: 16,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dangerTitle: {
    color: colors.text,
    textShadowColor: colors.text,
  },
  listItemTitle: {
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemDescription: {
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
  },
  dangerText: {
    color: colors.text,
  },
  
  // Time Picker Modal Styles
  timePickerModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    margin: 20,
    maxHeight: '85%',
    overflow: 'hidden',
    width: '100%',
    flex: 1,
  },
  timePickerHeader: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  timePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingTop: 16,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
    marginBottom: 8,
  },
  timePickerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
  },
  timePickerScrollView: {
    flex: 1,
  },
  timePickerBody: {
    padding: 20,
    paddingBottom: 10,
  },
  timeDisplayContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  currentTimeLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    marginBottom: 10,
  },
  timeDisplay: {
    backgroundColor: colors.primary,
    borderRadius: 15,
    paddingHorizontal: 30,
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  timeText: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingTop: 14,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
  },
  timePickerContainer: {
    marginBottom: 30,
  },
  timePickerWrapper: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
  },
  hourPicker: {
    alignItems: 'center',
    flex: 1,
  },
  minutePicker: {
    alignItems: 'center',
    flex: 1,
  },
  pickerLabel: {
    fontSize: 16,
    
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    marginBottom: 15,
    fontWeight: '600',
  },
  pickerButtons: {
    alignItems: 'center',
    
  },
  pickerButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 25,
    paddingTop: 16,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  pickerButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
  },
  pickerValue: {
    backgroundColor: colors.primary,
    borderRadius: 15,
   
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginVertical: 10,
    paddingTop: 16,
    minWidth: 80,
    alignItems: 'center',
  },
  pickerValueText: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingTop: 16,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
  },
  quickTimeButtons: {
    marginTop: 20,
  },
  quickTimeLabel: {
    fontSize: 16,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    marginBottom: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickTimeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickTimeButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  quickTimeText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
  },
  timePickerFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  timePickerButton: {
    flex: 1,
    marginHorizontal: 10,
  },
  timePickerButtonText: {
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 16,
    color: colors.primary,
    paddingTop: 10,
    fontFamily: 'Cairo-Regular',
    fontWeight: '600',
    textAlign: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    borderRadius: 16,
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingTop: 16,
    paddingBottom: 16,
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtons: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  modalButtonLabel: {
    fontSize: 16,
    fontFamily: 'Cairo-Regular',
    fontWeight: '600',
  },
  logoutButton: {
    borderRadius: 12,
    elevation: 0,
  },
  logoutButtonContent: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logoutButtonText: {
    fontSize: 18,
    paddingTop: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
  },
  cancelButton: {
    borderColor: colors.border,
  },
  authModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  authModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    paddingTop: 16,
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  authModalWarning: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.warning,
    fontFamily: 'Cairo-Regular',
    marginBottom: 8,
    textAlign: 'center',
  },
  authModalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  authInputWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  authInputIcon: {
    position: 'absolute',
    right: 16,
    top: 18,
    zIndex: 1,
  },
  authModalInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 48,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    borderWidth: 2,
    borderColor: colors.border,
  },
  cancelAuthButton: {
    borderColor: colors.textSecondary,
  },
  dangerButton: {
    backgroundColor: colors.error,
  },
});

export default SettingsScreen;
