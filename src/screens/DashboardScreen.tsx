import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formatDateLocal } from '../utils/date';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, Platform, InteractionManager, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '../design-system';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { BalanceCard } from '../components/BalanceCard';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionItem } from '../components/TransactionItem';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { calculateFinancialSummary, getCurrentMonthData, getMonthData } from '../services/financialService';
import { Modal } from 'react-native';
import { getExpenses, getIncome, getFinancialGoals, getUserSettings, getDebts, getChallenges, getCustomCategories, getAchievements, getRecentTransactions, getAvailableMonths, addExpense, addIncome, getAppSettings, upsertAppSettings, recalculateAllBaseAmounts } from '../database/database';
import { CURRENCIES, Expense, Income, FinancialGoal, Debt, EXPENSE_CATEGORIES, Challenge, ExpenseShortcut, IncomeShortcut } from '../types';
import { notifyCurrencyChanged } from '../services/currencyEvents';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';
import { updateAllChallenges } from '../services/challengeService';
import { getUnlockedAchievementsCount, getTotalAchievementsCount } from '../services/achievementService';
import { calculateBudgetStatus, BudgetStatus } from '../services/budgetService';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { WalletSelector } from '../components/WalletSelector';
import { usePrivacy } from '../context/PrivacyContext';
import { useWallets } from '../context/WalletContext';
import { SmartAddModal } from '../components/SmartAddModal';
import { CircularProgress } from '../components/CircularProgress';
import { ManageShortcutsModal } from '../components/ManageShortcutsModal';
import { authStorage } from '../services/authStorage';
import { authApiService } from '../services/authApiService';
import { authEventService } from '../services/authEventService';
import { alertService } from '../services/alertService';
import { authModalService } from '../services/authModalService';
import { ReferralModal } from '../components/ReferralModal';
import { referralService } from '../services/referralService';
import { TransactionDetailsModal } from '../components/TransactionDetailsModal';
import { getSmartExpenseShortcuts, getSmartIncomeShortcuts } from '../services/smartShortcutsService';
import { syncNewToServer } from '../services/syncService';
import { tl, useLocalization } from "../localization";
const {
  width
} = Dimensions.get('window');
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const CHALLENGE_REFRESH_MS = 3 * 60 * 60 * 1000;
const DashboardScreenComponent = ({
  navigation
}: any) => {
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency,
    currencyCode
  } = useCurrency();
  const {
    isPrivacyEnabled,
    togglePrivacy
  } = usePrivacy();
  const {
    wallets,
    selectedWallet,
    setSelectedWallet
  } = useWallets();

  // Format full date consistently
  const formatFullDate = useCallback((date: Date) => {
    return tl("{{}}، {{}}{{}}، {{}}", [tl(WEEKDAY_NAMES[date.getDay()]), date.getDate(), tl(MONTH_NAMES[date.getMonth()]), date.getFullYear()]);
  }, []);
  const insets = useSafeAreaInsets();
  const [dashboardData, setDashboardData] = useState<{
    summary: any;
    recentTransactions: (Expense | Income)[];
    todayData: {
      income: number;
      expenses: number;
      balance: number;
    } | null;
    currentMonthData: {
      totalIncome: number;
      totalExpenses: number;
      balance: number;
    } | null;
    availableMonths: Array<{
      year: number;
      month: number;
    }>;
    filteredBalance: number | null;
  }>({
    summary: null,
    recentTransactions: [],
    todayData: null,
    currentMonthData: null,
    availableMonths: [],
    filteredBalance: null
  });
  const [secondaryData, setSecondaryData] = useState<{
    userName: string;
    activeGoals: FinancialGoal[];
    convertedGoalAmounts: Record<number, {
      current: number;
      target: number;
    }>;
    debtsSummary: {
      total: number;
      active: number;
      paid: number;
      remaining: number;
    } | null;
    budgetsSummary: {
      total: number;
      spent: number;
      remaining: number;
      exceeded: number;
    } | null;
    activeChallenges: Challenge[];
    customCategories: any[];
    achievementsCount: {
      unlocked: number;
      total: number;
    };
    expenseShortcuts: ExpenseShortcut[];
    incomeShortcuts: IncomeShortcut[];
  }>({
    userName: '',
    activeGoals: [],
    convertedGoalAmounts: {},
    debtsSummary: null,
    budgetsSummary: null,
    activeChallenges: [],
    customCategories: [],
    achievementsCount: {
      unlocked: 0,
      total: 0
    },
    expenseShortcuts: [],
    incomeShortcuts: []
  });
  const [showSmartAdd, setShowSmartAdd] = useState(false);
  const [showManageShortcuts, setShowManageShortcuts] = useState(false);
  const [manageShortcutsType, setManageShortcutsType] = useState<'expense' | 'income'>('expense');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Initialize with current month by default
  const [selectedBalanceMonth, setSelectedBalanceMonth] = useState<{
    year: number;
    month: number;
  }>(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  });
  const [syncing, setSyncing] = useState(false);
  const [canSync, setCanSync] = useState(false);
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    authStorage.getUser<{
      isPro?: boolean;
    }>().then(user => {
      if (!cancelled) setCanSync(!!user?.isPro);
    });
    return () => {
      cancelled = true;
    };
  }, []));
  const handleSyncPress = async () => {
    if (syncing) return;
    if (!canSync) {
      alertService.show({
        title: tl("اشتراك مميز"),
        message: tl("مزامنة البيانات متاحة للمشتركين المميزين فقط. يجب أن يكون نوع حسابك أو اشتراكك مميزاً لاستخدام المزامنة."),
        type: 'warning',
        confirmText: tl("حسناً")
      });
      return;
    }
    setSyncing(true);
    const result = await syncNewToServer();
    setSyncing(false);
    if (result.success) {
      alertService.toastSuccess(result.count > 0 ? tl("تم رفع {{}} عنصر", [result.count]) : tl("لا توجد بيانات جديدة"));
      onRefresh();
    } else {
      if (result.code !== 'NOT_AUTHENTICATED' && result.code !== 'NOT_PRO') {
        alertService.error(tl("فشل المزامنة"), result.error);
      }
    }
  };
  const [filteredBalance, setFilteredBalance] = useState<number | null>(null);
  const [availableMonths, setAvailableMonths] = useState<Array<{
    year: number;
    month: number;
  }>>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<(Expense | Income) | null>(null);
  const [selectedTransactionType, setSelectedTransactionType] = useState<'expense' | 'income'>('expense');
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [showCurrencyPickerModal, setShowCurrencyPickerModal] = useState(false);

  // useLayoutEffect removed to allow AppNavigator to control tab bar styles globally with safe area insets

  const deferredLoadRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const lastChallengeRefreshRef = useRef(0);
  const isLoadingDataRef = useRef(false);
  const referralTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const todayModalAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (showTodayModal) {
      Animated.spring(todayModalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8
      }).start();
    } else {
      todayModalAnim.setValue(0);
    }
  }, [showTodayModal]);
  const loadMonthData = useCallback(async () => {
    const targetYear = selectedBalanceMonth?.year || new Date().getFullYear();
    const targetMonth = selectedBalanceMonth?.month || new Date().getMonth() + 1;
    const isAllTime = selectedBalanceMonth?.year === 0 && selectedBalanceMonth?.month === 0;
    if (!isAllTime) {
      const monthData = await getMonthData(targetYear, targetMonth, selectedWallet?.id);
      setDashboardData(prev => ({
        ...prev,
        currentMonthData: {
          totalIncome: monthData.totalIncome,
          totalExpenses: monthData.totalExpenses,
          balance: monthData.balance
        },
        filteredBalance: monthData.balance
      }));
      return;
    }
    const {
      getFinancialStatsAggregated
    } = await import('../database/database');
    const stats = await getFinancialStatsAggregated(undefined, undefined, selectedWallet?.id);
    const allTimeData = {
      totalIncome: stats?.totalIncome || 0,
      totalExpenses: stats?.totalExpenses || 0,
      balance: stats?.balance || 0
    };
    setDashboardData(prev => ({
      ...prev,
      currentMonthData: allTimeData,
      filteredBalance: allTimeData.balance
    }));
  }, [selectedBalanceMonth, selectedWallet?.id]);
  const loadEssentialData = useCallback(async () => {
    try {
      const today = formatDateLocal(new Date());
      const {
        getFinancialStatsAggregated
      } = await import('../database/database');

      // Run ALL essential queries in parallel
      const [financialSummary, months, todayStats, recent] = await Promise.all([
        calculateFinancialSummary(selectedWallet?.id), 
        getAvailableMonths(selectedWallet?.id), 
        getFinancialStatsAggregated(today, today, selectedWallet?.id), 
        getRecentTransactions(5, selectedWallet?.id)
      ]);
      setDashboardData(prev => ({
        ...prev,
        summary: financialSummary,
        availableMonths: months,
        todayData: {
          income: todayStats.totalIncome,
          expenses: todayStats.totalExpenses,
          balance: todayStats.balance
        },
        recentTransactions: recent
      }));

      // Month data can load slightly after
      await loadMonthData();
    } catch (error) {}
  }, [loadMonthData, selectedWallet?.id]);
  const loadSecondaryData = useCallback(async () => {
    try {
      const now = Date.now();
      const shouldRefreshChallenges = now - lastChallengeRefreshRef.current >= CHALLENGE_REFRESH_MS;
      const [userSettings, allGoals, debts, budgetStatuses, customCats, achievements, challenges, shortcutsExp, shortcutsInc] = await Promise.all([getUserSettings(), getFinancialGoals(), getDebts(), calculateBudgetStatus(), getCustomCategories('expense'), Promise.all([getUnlockedAchievementsCount(), getTotalAchievementsCount()]), (async () => {
        if (shouldRefreshChallenges) {
          await updateAllChallenges();
          lastChallengeRefreshRef.current = now;
        }
        return getChallenges();
      })(), getSmartExpenseShortcuts(), getSmartIncomeShortcuts()]);
      const authUser = await authStorage.getUser();
      const active = allGoals.filter(g => !g.completed).slice(0, 3);

      // Convert goal amounts in parallel
      const convertedEntries = await Promise.all(active.map(async goal => {
        const goalCurrency = goal.currency || currencyCode;
        if (goalCurrency === currencyCode) {
          return [goal.id, {
            current: goal.currentAmount,
            target: goal.targetAmount
          }] as const;
        }
        try {
          const [convertedCurrent, convertedTarget] = await Promise.all([convertCurrency(goal.currentAmount, goalCurrency, currencyCode), convertCurrency(goal.targetAmount, goalCurrency, currencyCode)]);
          return [goal.id, {
            current: convertedCurrent,
            target: convertedTarget
          }] as const;
        } catch (error) {
          return [goal.id, {
            current: goal.currentAmount,
            target: goal.targetAmount
          }] as const;
        }
      }));
      const activeDebts = debts.filter(d => !d.isPaid);
      const paidDebts = debts.filter(d => d.isPaid);
      const totalRemaining = activeDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
      const totalBudget = budgetStatuses.reduce((sum, b) => sum + b.budget.amount, 0);
      const totalSpent = budgetStatuses.reduce((sum, b) => sum + b.spent, 0);
      const totalRemainingBudget = totalBudget - totalSpent;
      const exceededBudgets = budgetStatuses.filter(b => b.isExceeded).length;
      setSecondaryData({
        userName: authUser?.name || userSettings?.name || '',
        activeGoals: active,
        convertedGoalAmounts: Object.fromEntries(convertedEntries),
        debtsSummary: {
          total: debts.length,
          active: activeDebts.length,
          paid: paidDebts.length,
          remaining: totalRemaining
        },
        budgetsSummary: {
          total: budgetStatuses.length,
          spent: totalSpent,
          remaining: totalRemainingBudget,
          exceeded: exceededBudgets
        },
        activeChallenges: challenges.filter(c => !c.completed).slice(0, 3),
        customCategories: customCats,
        achievementsCount: {
          unlocked: achievements[0],
          total: achievements[1]
        },
        expenseShortcuts: shortcutsExp,
        incomeShortcuts: shortcutsInc
      });
    } catch (error) {}
  }, [currencyCode]);
  const scheduleSecondaryLoad = useCallback(() => {
    deferredLoadRef.current?.cancel?.();
    deferredLoadRef.current = InteractionManager.runAfterInteractions(() => {
      loadSecondaryData();
    });
  }, [loadSecondaryData]);
  const loadData = useCallback(async () => {
    await loadEssentialData();
    scheduleSecondaryLoad();

    // Check if we should show referral modal
    try {
      const user = await authStorage.getUser();
      if (user && !user.referredBy) {
        const isDismissed = await referralService.isDismissed();
        if (!isDismissed) {
          // Show modal after a short delay
          if (referralTimeoutRef.current) clearTimeout(referralTimeoutRef.current);
          referralTimeoutRef.current = setTimeout(() => setShowReferralModal(true), 2000);
        }
      }
    } catch (error) {}
  }, [loadEssentialData, scheduleSecondaryLoad]);
  const loadDataSafe = useCallback(async () => {
    if (isLoadingDataRef.current) {
      return;
    }
    isLoadingDataRef.current = true;
    try {
      await loadData();
    } finally {
      isLoadingDataRef.current = false;
    }
  }, [loadData]);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDataSafe();
    setRefreshing(false);
  };
  useEffect(() => {
    loadDataSafe();
    const unsubscribe = navigation.addListener('focus', () => {
      loadDataSafe();
    });
    return () => {
      unsubscribe();
      deferredLoadRef.current?.cancel?.();
      if (referralTimeoutRef.current) clearTimeout(referralTimeoutRef.current);
    };
  }, [navigation, loadDataSafe]);
  useEffect(() => {
    const unsubscribeAuth = authEventService.subscribe(() => {
      setSecondaryData(prev => ({
        ...prev,
        userName: ''
      }));
    });
    return unsubscribeAuth;
  }, []);
  const getCategoryName = useCallback((category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || secondaryData.customCategories.find(c => c.name === category)?.name || category;
  }, [secondaryData.customCategories]);
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    const isValidName = secondaryData.userName && secondaryData.userName !== tl("المستخدم");
    const firstWord = isValidName ? secondaryData.userName.split(' ')[0] : '';
    let greeting = '';
    if (hour >= 5 && hour < 12) greeting = tl("صباح الخير");else if (hour >= 12 && hour < 18) greeting = tl("أهلاً");else greeting = tl("مساء الخير");
    return isValidName ? tl("{{}}، {{}}", [greeting, firstWord]) : greeting;
  }, [secondaryData.userName]);
  const getCategoryColor = useCallback((category: string, index: number) => {
    const categoryColors: Record<string, string> = {
      food: '#F59E0B',
      transport: '#3B82F6',
      shopping: '#EC4899',
      bills: '#EF4444',
      entertainment: '#8B5CF6',
      health: '#10B981',
      education: '#06B6D4',
      other: '#6B7280'
    };
    const customColor = secondaryData.customCategories.find(c => c.name === category)?.color;
    if (customColor) return customColor;
    return categoryColors[category] || [theme.gradients.primary[1], theme.gradients.info[1], theme.gradients.success[1], theme.colors.warning, theme.colors.error][index % 5];
  }, [secondaryData.customCategories, theme]);
  const chartData = useMemo(() => {
    const categories = dashboardData.summary?.topExpenseCategories || [];
    return categories.map((cat: any, index: number) => ({
      name: tl(getCategoryName(cat.category)),
      population: cat.amount,
      color: getCategoryColor(cat.category, index),
      legendFontColor: theme.colors.textPrimary,
      legendFontSize: 13
    }));
  }, [dashboardData.summary?.topExpenseCategories, getCategoryName, getCategoryColor, theme.colors.textPrimary]);
  const handleCurrencyChange = async (newCurrencyCode: string) => {
    const currency = CURRENCIES.find(c => c.code === newCurrencyCode);
    if (currency) {
      if (newCurrencyCode === currencyCode) {
        setShowCurrencyPickerModal(false);
        return;
      }
      try {
        const appSettings = await getAppSettings();
        const settingsToSave = appSettings || {
          notificationsEnabled: true,
          darkModeEnabled: false,
          themeMode: 'light',
          autoBackupEnabled: false,
          autoSyncEnabled: false,
          currency: 'دينار عراقي',
          language: 'ar'
        };
        await upsertAppSettings({
          ...settingsToSave,
          currency: currency.name,
          themeMode: settingsToSave.themeMode
        });

        // Recalculate historical base amounts
        await recalculateAllBaseAmounts(newCurrencyCode, convertCurrency);
        notifyCurrencyChanged();
        setShowCurrencyPickerModal(false);
        alertService.toastSuccess(tl("تم تغيير العملة إلى {{}}", [currency.name]));

        // Refresh data
        onRefresh();
      } catch (error) {
        alertService.toastError(tl("حدث خطأ أثناء تغيير العملة"));
      }
    }
  };
  return <ScreenContainer scrollable={false} edges={['left', 'right']}>
      <StatusBar style="light" animated={true} />
      {/* Modern Pro Header - Sticky outside ScrollView */}
      <View style={styles.headerContainer}>
        <View style={[styles.headerRoundedBackground, {
        paddingTop: insets.top + 4
      }]}>

          <View style={styles.headerContent}>
            {/* Title / Greeting */}
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {greetingText}
            </Text>

            {/* Actions */}
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleSyncPress} disabled={syncing} style={styles.headerButton} activeOpacity={0.7}>
                {syncing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={22} color={canSync ? "#FFFFFF" : "rgba(255, 255, 255, 0.4)"} />}
              </TouchableOpacity>

              <TouchableOpacity onPress={togglePrivacy} style={[styles.headerButton, isPrivacyEnabled && {
              backgroundColor: 'rgba(255, 255, 255, 0.25)'
            }]}>
                <Ionicons name={isPrivacyEnabled ? 'eye-off' : 'eye-outline'} size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.headerButton}>
                <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} showsVerticalScrollIndicator={false}>

        {/* Main Balance Hero */}
        <View style={styles.heroSection}>
          {dashboardData.summary ? <BalanceCard balance={dashboardData.filteredBalance !== null ? dashboardData.filteredBalance : dashboardData.summary.balance} selectedMonth={selectedBalanceMonth || undefined} onMonthChange={(year, month) => {
          setSelectedBalanceMonth({
            year,
            month
          });
        }} showFilter={true} availableMonths={dashboardData.availableMonths} onCurrencyPress={() => setShowCurrencyPickerModal(true)} /> : <LinearGradient colors={theme.gradients.primary as any} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }} style={styles.balanceSkeleton}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, {
            width: '50%',
            height: 32,
            marginTop: 20
          }]} />
              <View style={[styles.skeletonLine, {
            width: '30%',
            height: 12,
            marginTop: 12
          }]} />
            </LinearGradient>}
        </View>

        <View style={styles.sectionDivider} />

        {/* Unified Tool Grid - All items in the circle button style */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('AddExpense')}>
            <View style={[styles.actionIconBg, {
            backgroundColor: theme.colors.error + '18'
          }]}>
              <Ionicons name="remove-circle" size={28} color={theme.colors.error} />
            </View>
            <Text style={styles.actionLabel}>{tl("إضافة مصروف")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('AddIncome')}>
            <View style={[styles.actionIconBg, {
            backgroundColor: theme.colors.success + '18'
          }]}>
              <Ionicons name="add-circle" size={28} color={theme.colors.success} />
            </View>
            <Text style={styles.actionLabel}>{tl("إضافة دخل")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Goals')}>
            <View style={[styles.actionIconBg, {
            backgroundColor: theme.colors.warning + '18'
          }]}>
              <Ionicons name="flag" size={28} color={theme.colors.warning} />
            </View>
            <Text style={styles.actionLabel}>{tl("الأهداف")}</Text>
          </TouchableOpacity>

          {secondaryData.budgetsSummary && <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Budget')}>
              <View style={[styles.actionIconBg, {
            backgroundColor: theme.colors.error + '18'
          }]}>
                <Ionicons name="bar-chart" size={24} color={theme.colors.error} />
              </View>
              <Text style={styles.actionLabel}>{tl("الميزانية")}</Text>
            </TouchableOpacity>}

          {secondaryData.debtsSummary && <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Debts')}>
              <View style={[styles.actionIconBg, {
            backgroundColor: theme.colors.info + '18'
          }]}>
                <Ionicons name="card" size={24} color={theme.colors.info} />
              </View>
              <Text style={styles.actionLabel}>{tl("الديون")}</Text>
            </TouchableOpacity>}

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Bills')}>
            <View style={[styles.actionIconBg, {
            backgroundColor: theme.colors.primary + '18'
          }]}>
              <Ionicons name="receipt" size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionLabel}>{tl("الفواتير")}</Text>
          </TouchableOpacity>



          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Savings')}>
            <View style={[styles.actionIconBg, {
            backgroundColor: '#10B981' + '18'
          }]}>
              <Ionicons name="wallet" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionLabel}>{tl("الحصالة")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => setShowTodayModal(true)}>

            <View style={[styles.actionIconBg, {
            backgroundColor: theme.colors.primary + '18'
          }]}>
              <Ionicons name="list" size={24} color={theme.colors.primary} />
            </View>
            <Text style={styles.actionLabel}>{tl("ملخص اليوم")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Calendar')}>
            <View style={[styles.actionIconBg, {
            backgroundColor: '#8B5CF6' + '18'
          }]}>
              <Ionicons name="calendar" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.actionLabel}>{tl("التقويم")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDivider} />

        {/* اختصارات سريعة - إضافة مصروف/دخل بضغطة دون فتح النموذج */}
        <View style={styles.shortcutsSection}>
          <View style={styles.shortcutsSectionHeader}>
            <Text style={styles.shortcutsSectionTitle}>{tl("اختصارات ذكية")}</Text>
            <TouchableOpacity onPress={() => setShowManageShortcuts(true)} style={styles.shortcutsHeaderButtonNew}>
              <Ionicons name="add" size={18} color={theme.colors.primary} />
              <Text style={styles.shortcutsHeaderButtonTextNew}>{tl("إضافة")}</Text>
            </TouchableOpacity>
          </View>
          {secondaryData.expenseShortcuts.length > 0 || secondaryData.incomeShortcuts.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsScrollContent} style={styles.shortcutsScroll}>
              {secondaryData.incomeShortcuts.map(s => <TouchableOpacity key={`inc-${s.id}`} style={[styles.shortcutChip, styles.shortcutChipIncome]} onPress={() => {
            alertService.confirm(tl("تأكيد إضافة دخل"), tl("{{}} {{}} هل تريد إضافة هذا الدخل؟", [s.source, formatCurrency(s.amount)]), async () => {
              try {
                const dateStr = formatDateLocal(new Date());
                await addIncome({
                  source: s.source,
                  amount: s.amount,
                  date: dateStr,
                  category: (s.incomeSource || s.source) as any,
                  currency: s.currency || currencyCode,
                  description: s.description || ''
                });
                loadDataSafe();
                alertService.toastSuccess(tl("تمت إضافة الدخل: {{}}", [s.source]));
              } catch (err: any) {
                alertService.toastError(err?.message || tl("فشل الإضافة"));
              }
            });
          }} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={20} color="#10B981" />
                  <Text style={styles.shortcutChipLabel} numberOfLines={1}>{s.source}</Text>
                  <Text style={styles.shortcutChipAmount}>{formatCurrency(s.amount)}</Text>
                </TouchableOpacity>)}
              {secondaryData.expenseShortcuts.map(s => <TouchableOpacity key={`exp-${s.id}`} style={[styles.shortcutChip, styles.shortcutChipExpense]} onPress={() => {
            alertService.confirm(tl("تأكيد إضافة مصروف"), tl("{{}} {{}} هل تريد إضافة هذا المصروف؟", [s.title, formatCurrency(s.amount)]), async () => {
              try {
                const dateStr = formatDateLocal(new Date());
                await addExpense({
                  title: s.title,
                  amount: s.amount,
                  category: s.category as any,
                  date: dateStr,
                  description: s.description || '',
                  currency: s.currency || currencyCode
                });
                loadDataSafe();
                alertService.toastSuccess(tl("تمت إضافة المصروف: {{}}", [s.title]));
              } catch (err: any) {
                alertService.toastError(err?.message || tl("فشل الإضافة"));
              }
            });
          }} activeOpacity={0.8}>
                  <Ionicons name="remove-circle-outline" size={20} color="#EF4444" />
                  <Text style={styles.shortcutChipLabel} numberOfLines={1}>{s.title}</Text>
                  <Text style={styles.shortcutChipAmount}>{formatCurrency(s.amount)}</Text>
                </TouchableOpacity>)}
            </ScrollView> : <TouchableOpacity style={styles.shortcutsEmptyHint} onPress={() => setShowManageShortcuts(true)}>
              <Ionicons name="flash-outline" size={36} color="#64748b" style={{
            transform: [{
              rotate: '15deg'
            }]
          }} />
              <Text style={styles.shortcutsEmptyHintText}>{tl("لا توجد اختصارات. اضغط لإضافة اسم، فئة ومبلغ ثم استخدمها من هنا دون فتح النموذج.")}</Text>
            </TouchableOpacity>}
        </View>

        <View style={styles.sectionDivider} />

        <TouchableOpacity style={styles.smartInsightsRow} onPress={async () => {
        try {
          const {
            isAuthenticated,
            user
          } = await authApiService.checkAuth();
          if (!isAuthenticated) {
            alertService.show({
              title: tl("تسجيل الدخول"),
              message: tl("يجب تسجيل الدخول لاستخدام التحليل الذكي بمساعدة الذكاء الاصطناعي."),
              confirmText: tl("تسجيل الدخول"),
              cancelText: tl("إلغاء"),
              showCancel: true,
              onConfirm: () => authModalService.show()
            });
            return;
          }
          navigation.navigate('AISmartInsights');
        } catch (e) {
          const token = await authStorage.getAccessToken();
          if (token) navigation.navigate('AISmartInsights');else authModalService.show();
        }
      }} activeOpacity={0.9}>
          <LinearGradient colors={['#4f46e5', '#3b82f6', '#0ea5e9']} style={styles.smartInsightsGradient} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }}>
            {/* Background glowing shape */}
            <View style={styles.smartInsightsGlow} />

            <View style={styles.smartInsightsHeader}>
              <View style={styles.smartInsightsIconContainer}>
                <Ionicons name="sparkles" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.smartInsightsBadge}>
                <Text style={styles.smartInsightsBadgeText}>{tl("مُدعم بالذكاء الاصطناعي")}</Text>
              </View>
            </View>

            <View style={styles.smartInsightsTextContainer}>
              <Text style={styles.smartInsightsLabel}>{tl("التحليل الذكي والتقارير")}</Text>
              <Text style={styles.smartInsightsDesc}>{tl("اكتشف أنماط إنفاقك واحصل على توجيهات استراتيجية لنموك المالي.")}</Text>
            </View>

            <View style={styles.smartInsightsAction}>
              <Text style={styles.smartInsightsActionText}>{tl("ابدأ التحليل الآن")}</Text>
              <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.sectionDivider} />

        <ManageShortcutsModal visible={showManageShortcuts} onClose={() => {
        setShowManageShortcuts(false);
        loadDataSafe();
      }} onShortcutUsed={s => {
        // When a shortcut is used from the modal, add the transaction directly
        // The modal now passes the shortcut directly, and we infer its type
        if ('title' in s) {
          // It's an ExpenseShortcut
          const es = s as ExpenseShortcut;
          alertService.confirm(tl("تأكيد إضافة مصروف"), tl("{{}} {{}} هل تريد إضافة هذا المصروف؟", [es.title, formatCurrency(es.amount)]), async () => {
            try {
              const dateStr = formatDateLocal(new Date());
              await addExpense({
                title: es.title,
                amount: es.amount,
                category: es.category as any,
                date: dateStr,
                description: es.description || '',
                currency: es.currency || currencyCode
              });
              loadDataSafe();
              alertService.toastSuccess(tl("تمت إضافة المصروف: {{}}", [es.title]));
            } catch (err: any) {
              alertService.toastError(err?.message || tl("فشل الإضافة"));
            }
          });
        } else {
          const is = s as IncomeShortcut;
          alertService.confirm(tl("تأكيد إضافة دخل"), tl("{{}} {{}} هل تريد إضافة هذا الدخل؟", [is.source, formatCurrency(is.amount)]), async () => {
            try {
              const dateStr = formatDateLocal(new Date());
              await addIncome({
                source: is.source,
                amount: is.amount,
                date: dateStr,
                category: (is.incomeSource || is.source) as any,
                currency: is.currency || currencyCode,
                description: is.description || ''
              });
              loadDataSafe();
              alertService.toastSuccess(tl("تمت إضافة الدخل: {{}}", [is.source]));
            } catch (err: any) {
              alertService.toastError(err?.message || tl("فشل الإضافة"));
            }
          });
        }
      }} />
        <SmartAddModal visible={showSmartAdd} onClose={() => setShowSmartAdd(false)} onSuccess={() => {
        loadDataSafe();
        // Maybe show a toast
      }} navigation={navigation} />
        <ReferralModal visible={showReferralModal} onClose={() => setShowReferralModal(false)} onSuccess={rewardDays => {
        loadDataSafe(); // To refresh Pro status if updated
      }} />

        {/* Today's Statement Modal - Slide from Bottom Implementation */}
        <Modal visible={showTodayModal} transparent={true} animationType="fade" onRequestClose={() => setShowTodayModal(false)} statusBarTranslucent>
          <Pressable style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end'
        }} onPress={() => setShowTodayModal(false)}>
            <Animated.View style={{
            width: '100%',
            backgroundColor: theme.colors.surfaceCard,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: theme.spacing.lg,
            paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            transform: [{
              translateY: todayModalAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [500, 0]
              })
            }],
            ...getPlatformShadow('xl')
          }}>
              <Pressable onPress={e => e.stopPropagation()}>
                {/* Drag Handle */}
                <View style={{
                width: 40,
                height: 4,
                backgroundColor: theme.colors.border + '80',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 20,
                opacity: 0.5
              }} />

                <Text style={[styles.sectionTitle, {
                textAlign: 'center',
                fontSize: 20,
                marginBottom: 25
              }]}>{tl("ملخص اليوم")}</Text>

                {dashboardData.todayData ? <>
                    <View style={styles.modalStatRow}>
                      <View style={[styles.modalStatIcon, {
                    backgroundColor: theme.colors.success + '15'
                  }]}>
                        <Ionicons name="trending-up" size={24} color={theme.colors.success} />
                      </View>
                      <View style={{
                    flex: 1
                  }}>
                        <Text style={styles.modalStatLabel}>{tl("إجمالي الدخل")}</Text>
                        <Text style={[styles.modalStatValue, {
                      color: theme.colors.success
                    }]}>
                          {isPrivacyEnabled ? '****' : formatCurrency(dashboardData.todayData.income)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalStatRow}>
                      <View style={[styles.modalStatIcon, {
                    backgroundColor: theme.colors.error + '15'
                  }]}>
                        <Ionicons name="trending-down" size={24} color={theme.colors.error} />
                      </View>
                      <View style={{
                    flex: 1
                  }}>
                        <Text style={styles.modalStatLabel}>{tl("إجمالي المصاريف")}</Text>
                        <Text style={[styles.modalStatValue, {
                      color: theme.colors.error
                    }]}>
                          {isPrivacyEnabled ? '****' : formatCurrency(dashboardData.todayData.expenses)}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.modalStatRow, {
                  borderBottomWidth: 0,
                  marginTop: 10
                }]}>
                      <View style={[styles.modalStatIcon, {
                    backgroundColor: theme.colors.info + '15'
                  }]}>
                        <Ionicons name="wallet-outline" size={24} color={theme.colors.info} />
                      </View>
                      <View style={{
                    flex: 1
                  }}>
                        <Text style={styles.modalStatLabel}>{tl("الصافي")}</Text>
                        <Text style={[styles.modalStatValue, {
                      color: theme.colors.info
                    }]}>
                          {isPrivacyEnabled ? '****' : formatCurrency(dashboardData.todayData.balance)}
                        </Text>
                      </View>
                    </View>
                  </> : <ActivityIndicator size="large" color={theme.colors.primary} />}

                <TouchableOpacity style={[styles.modalCloseButton, {
                marginTop: 30,
                backgroundColor: theme.colors.surface
              }]} onPress={() => setShowTodayModal(false)}>
                  <Text style={[styles.modalCloseButtonText, {
                  color: theme.colors.textPrimary
                }]}>{tl("إغلاق")}</Text>
                </TouchableOpacity>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>









        {/* Status & Achievements Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.statusCard} onPress={() => navigation.navigate('Achievements')}>
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.statusCardGradient} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }}>
              <View style={styles.statusCardHeader}>
                <View style={styles.statusCardIconContainer}>
                  <Ionicons name="medal" size={28} color="#FFD700" />
                </View>
                <View style={styles.statusCardTitleContainer}>
                  <Text style={styles.statusCardTitle}>{tl("سجل إنجازاتك")}</Text>
                  <Text style={styles.statusCardSubtitle}>{tl("خطواتك نحو النجاح المالي")}</Text>
                </View>
                <View style={styles.statusProgressWrapper}>
                  <View style={styles.statusProgressBadge}>
                    <Text style={styles.statusProgressText}>
                      {secondaryData.achievementsCount.unlocked}/{secondaryData.achievementsCount.total}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Custom abstract background shape */}
              <View style={styles.statusCardAbstractShape} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDivider} />

        {/* Challenges Section */}
        {secondaryData.activeChallenges.length > 0 && <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{tl("تحديات نشطة")}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Challenges')}>
                  <Text style={styles.sectionLink}>{tl("الكل")}</Text>
                </TouchableOpacity>
              </View>

              {secondaryData.activeChallenges.map(challenge => <TouchableOpacity key={challenge.id} style={styles.challengePreviewCardWrapper} onPress={() => navigation.navigate('Challenges')} activeOpacity={0.8}>
                  <LinearGradient colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 1
            }} style={[styles.challengePreviewCard]}>
                    <View style={styles.challengePreviewHeader}>
                      <View style={styles.challengePreviewContent}>
                        <View style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: theme.spacing.sm
                  }}>
                          <View style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm
                    }}>
                            <View style={[styles.challengePreviewIconContainer, {
                        backgroundColor: theme.colors.primary + '15'
                      }]}>
                              <Ionicons name={challenge.icon as any || 'star'} size={24} color={theme.colors.primary} />
                            </View>
                            <View>
                              <Text style={styles.challengePreviewTitle}>{challenge.title}</Text>
                              <Text style={styles.challengePreviewDescription} numberOfLines={1}>
                                {`${challenge.currentProgress} / ${challenge.targetProgress}`}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.challengePreviewProgressContainer}>
                          <View style={[styles.challengePreviewProgressBar, {
                      backgroundColor: theme.colors.primary + '20'
                    }]}>
                            <View style={[styles.challengePreviewProgressFill, {
                        width: `${challenge.currentProgress / (challenge.targetProgress || 1) * 100}%`,
                        backgroundColor: theme.colors.primary
                      }]} />
                          </View>
                          <Text style={styles.challengePreviewPercentText}>
                            {isPrivacyEnabled ? '**%' : `${Math.round(challenge.currentProgress / (challenge.targetProgress || 1) * 100)}%`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>)}
            </View>

            <View style={styles.sectionDivider} />
          </>}




        {/* Recent Transactions Section */}
        <View style={[styles.section, {
        marginTop: theme.spacing.lg
      }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{tl("أحدث العمليات")}</Text>

          </View>

          <View style={styles.transactionList}>
            {dashboardData.recentTransactions.map((item, index) => <TransactionItem key={`${(item as any).type}-${item.id}`} item={item} type={(item as any).type} showOptions={false} onPress={() => {
            setSelectedTransaction(item);
            setSelectedTransactionType((item as any).type);
            setShowTransactionDetails(true);
          }} />)}
            {dashboardData.recentTransactions.length === 0 && <Text style={styles.emptyText}>{tl("لا توجد عمليات مضافة مؤخراً")}</Text>}
          </View>
        </View>

        <View style={{
        height: 40
      }} />
      </ScrollView>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal visible={showTransactionDetails} item={selectedTransaction} type={selectedTransactionType} customCategories={secondaryData.customCategories} onClose={() => {
      setShowTransactionDetails(false);
      setSelectedTransaction(null);
    }} onEdit={() => {
      if (selectedTransaction) {
        if (selectedTransactionType === 'expense') {
          navigation.navigate('AddExpense', {
            expense: selectedTransaction
          });
        } else {
          navigation.navigate('AddIncome', {
            income: selectedTransaction
          });
        }
      }
    }} />


      <CurrencyPickerModal visible={showCurrencyPickerModal} selectedCurrency={currencyCode} onSelect={handleCurrencyChange} onClose={() => setShowCurrencyPickerModal(false)} />
    </ScreenContainer>;
};
export const DashboardScreen = React.memo(DashboardScreenComponent);
const createStyles = (theme: AppTheme) => StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 30,
    // Slightly higher
    left: isRTL ? 24 : undefined,
    right: isRTL ? undefined : 24,
    width: 68,
    // Slightly larger
    height: 68,
    borderRadius: 34,
    ...getPlatformShadow('lg'),
    zIndex: 1000
  },
  fabGradient: {
    flex: 1,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerLeft: {
    flex: 1
  },
  headerButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  topInfo: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm
  },
  greetingRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  greetingContent: {
    flex: 1
  },
  greetingAvatarContainer: {
    ...(isRTL ? {
      marginRight: theme.spacing.md
    } : {
      marginLeft: theme.spacing.md
    })
  },
  greetingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('md')
  },
  greetingText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    letterSpacing: -0.3
  },
  dateText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: isRTL ? 'right' : 'left',
    letterSpacing: 0.2
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: theme.colors.surfaceLight
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 110,
    paddingTop: theme.spacing.md
  },
  headerContainer: {
    backgroundColor: theme.colors.background,
    zIndex: 10
  },
  headerRoundedBackground: {
    backgroundColor: '#003459',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,

    paddingBottom: 6,
    ...getPlatformShadow('xl')
  },

  headerContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.screenH
  },
  headerTitle: {
    flex: 1,
    maxWidth: '55%',
    fontSize: 18,

    fontWeight: getPlatformFontWeight('400'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    letterSpacing: 0.5,
    textAlign: isRTL ? 'right' : 'left'
  },
  headerActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  headerButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)'
  },

  heroSection: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg
  },
  todayQuickLook: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm
  },
  quickLookItem: {
    flex: 1,
    padding: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    ...getPlatformShadow('md')
  },
  quickLookIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  quickLookLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('400'),
    marginTop: 2,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textMuted
  },
  quickLookValue: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('600'),
    marginTop: 2,
    fontFamily: theme.typography.fontFamily
  },
  actionGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    // Center items
    marginBottom: theme.spacing.md
  },
  actionItem: {
    alignItems: 'center',
    width: (width - theme.spacing.lg * 2) / 4,
    marginBottom: theme.spacing.md
  },
  actionIconBg: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
    ...getPlatformShadow('sm'),
    ...(Platform.OS === 'android' ? {
      elevation: 0
    } : {})
  },
  actionLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('300'),
    color: theme.colors.textPrimary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    marginTop: 2
  },
  shortcutsSection: {
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.sm
  },
  shortcutsSectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  shortcutsSectionTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  shortcutsHeaderButtonNew: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  shortcutsHeaderButtonTextNew: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('400'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  shortcutsHeaderButtonText: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('400'),
    fontFamily: theme.typography.fontFamily
  },
  shortcutsScroll: {
    marginHorizontal: -theme.spacing.xs,
    transform: [{
      scaleX: isRTL ? -1 : 1
    }]
  },
  shortcutsScrollContent: {
    paddingHorizontal: theme.spacing.xs,
    gap: theme.spacing.sm,
    flexDirection: 'row'
  },
  shortcutChip: {
    minWidth: 120,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: 20,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{
      scaleX: isRTL ? -1 : 1
    }]
  },
  shortcutChipExpense: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.2)'
  },
  shortcutChipIncome: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: 'rgba(16, 185, 129, 0.2)'
  },
  shortcutChipLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('500'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.sm
  },
  shortcutChipAmount: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('400'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs
  },
  shortcutsEmptyHint: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    backgroundColor: 'transparent',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    borderStyle: 'dashed',
    gap: theme.spacing.md
  },
  shortcutsEmptyHintText: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('400'),
    color: '#64748b',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: theme.spacing.screenH
  },
  smartInsightsRow: {
    marginHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...getPlatformShadow('lg')
  },
  smartInsightsGradient: {
    padding: theme.spacing.xl,
    position: 'relative',
    overflow: 'hidden'
  },
  smartInsightsGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    top: -50,
    left: -50,
    zIndex: 0
  },
  smartInsightsHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    zIndex: 1
  },
  smartInsightsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  smartInsightsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  smartInsightsBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily
  },
  smartInsightsTextContainer: {
    marginBottom: theme.spacing.lg,
    zIndex: 1
  },
  smartInsightsLabel: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4
  },
  smartInsightsDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    lineHeight: 20,
    fontWeight: getPlatformFontWeight('400')
  },
  smartInsightsAction: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    zIndex: 1
  },
  smartInsightsActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily
  },
  modalStatRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '50',
    gap: theme.spacing.md
  },
  modalStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalStatLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  modalStatValue: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginTop: 2
  },
  modalCloseButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: 16,
    alignItems: 'center'
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily
  },
  pulseSection: {
    marginBottom: theme.spacing.xl
  },
  pulseCard: {
    borderRadius: 24,
    padding: theme.spacing.lg,
    ...getPlatformShadow('lg')
  },
  pulseHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  pulseTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('500'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  pulseLink: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: getPlatformFontWeight('400'),
    fontFamily: theme.typography.fontFamily
  },
  pulseStats: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg
  },
  pulseStatItem: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  pulseStatNum: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  pulseStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
    fontFamily: theme.typography.fontFamily
  },
  pulseDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.md
  },
  progressContainer: {
    marginTop: theme.spacing.sm
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 4
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily
  },
  section: {
    marginBottom: theme.spacing.xl,
    marginHorizontal: theme.spacing.xs
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  sectionLink: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily
  },
  transactionList: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 32,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...getPlatformShadow('md'),
    shadowOpacity: 0.05
  },
  emptyText: {
    textAlign: 'center',
    padding: theme.spacing.screenH,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    fontFamily: theme.typography.fontFamily
  },
  goalsSection: {
    marginBottom: theme.spacing.xl
  },
  goalsSectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  goalsSectionTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  goalsSectionFilter: {
    fontSize: 15,
    color: theme.colors.textMuted,
    fontWeight: getPlatformFontWeight('400'),
    fontFamily: theme.typography.fontFamily
  },
  goalsCarousel: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
    flexDirection: isRTL ? 'row' : 'row-reverse'
  },
  goalCard: {
    width: width * 0.75,
    // Much wider for a premium feel
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: theme.colors.border + '50',
    padding: theme.spacing.lg,
    marginRight: 0,
    ...getPlatformShadow('md')
  },
  goalCardHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm
  },
  goalCardTitle: {
    fontSize: 17,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'left' : 'right'
  },
  goalCardAmount: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  goalPercentText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  summaryGrid: {
    width: '100%',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xs
  },
  summaryGridItem: {
    width: '48%',
    minHeight: Platform.OS === 'android' ? 90 : 100,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xl,
    padding: Platform.OS === 'android' ? theme.spacing.sm : theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4
      },
      shadowOpacity: 0.05,
      shadowRadius: 10
    } : {
      elevation: 2
    })
  },
  summaryIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  summaryValue: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('400'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  budgetQuickCard: {
    marginBottom: theme.spacing.sm
  },
  budgetQuickGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.1,
      shadowRadius: 4
    } : {
      elevation: 2
    })
  },
  budgetQuickContent: {
    flex: 1
  },
  budgetQuickTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('500'),
    color: '#FFFFFF',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right'
  },
  budgetQuickText: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right'
  },
  currencyConverterCard: {
    marginBottom: theme.spacing.sm
  },
  currencyConverterGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.1,
      shadowRadius: 4
    } : {
      elevation: 2
    })
  },
  currencyConverterContent: {
    flex: 1
  },
  currencyConverterTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('500'),
    color: '#FFFFFF',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right'
  },
  currencyConverterDescription: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right'
  },
  statusCard: {
    borderRadius: 32,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...getPlatformShadow('lg')
  },
  statusCardGradient: {
    padding: theme.spacing.xl,
    paddingVertical: theme.spacing.lg
  },
  statusCardHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    zIndex: 2
  },
  statusCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)'
  },
  statusCardTitleContainer: {
    flex: 1
  },
  statusCardTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('600'),
    color: '#F8FAFC',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4
  },
  statusCardSubtitle: {
    fontSize: 14,
    color: 'rgba(248, 250, 252, 0.7)',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    fontWeight: getPlatformFontWeight('400')
  },
  statusProgressWrapper: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusProgressBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  statusProgressText: {
    color: '#FFD700',
    fontWeight: getPlatformFontWeight('600'),
    fontSize: 16,
    fontFamily: theme.typography.fontFamily
  },
  statusCardAbstractShape: {
    position: 'absolute',
    right: -40,
    bottom: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    zIndex: 1
  },
  statusCardStats: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)'
  },
  statusCardStatItem: {
    alignItems: 'center',
    flex: 1
  },
  statusCardStatLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'center'
  },
  statusCardStatValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('400'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  statusCardStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.sm
  },
  challengePreviewCardWrapper: {
    marginBottom: theme.spacing.lg
  },
  challengePreviewCard: {
    borderRadius: 28,
    padding: theme.spacing.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    ...getPlatformShadow('md')
  },
  challengePreviewHeader: {
    flexDirection: 'column'
  },
  challengePreviewIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  challengePreviewContent: {
    flex: 1
  },
  challengePreviewTitle: {
    fontSize: 19,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  challengePreviewDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginTop: 2
  },
  challengePreviewProgressContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm
  },
  challengePreviewProgressBar: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden'
  },
  challengePreviewProgressFill: {
    height: '100%',
    borderRadius: 5
  },
  challengePreviewPercentText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'left' : 'right'
  },
  challengePreviewDays: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  emptyChallengeCard: {
    marginBottom: theme.spacing.sm
  },
  emptyChallengeGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1
      },
      shadowOpacity: 0.1,
      shadowRadius: 2
    } : {
      elevation: 1
    })
  },
  sectionDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
    opacity: 1,
    marginBottom: theme.spacing.lg,
    width: '100%',
    alignSelf: 'center'
  },
  emptyChallengeTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('500'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  emptyChallengeText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily,
    writingDirection: isRTL ? 'rtl' : 'ltr',
    lineHeight: 20
  },
  emptyChallengeButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1
      },
      shadowOpacity: 0.1,
      shadowRadius: 2
    } : {
      elevation: 1
    })
  },
  achievementProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    width: '100%',
    direction: isRTL ? 'rtl' : 'ltr',
    textAlign: 'right',
    flexDirection: isRTL ? 'row' : 'row-reverse'
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8
  },
  emptyChallengeButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('400'),
    color: theme.colors.textInverse,
    ...(isRTL ? {
      marginRight: theme.spacing.sm
    } : {
      marginLeft: theme.spacing.sm
    }),
    fontFamily: theme.typography.fontFamily
  },
  balanceSkeleton: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    minHeight: 180,
    ...getPlatformShadow('xl'),
    overflow: 'hidden',
    justifyContent: 'center'
  },
  skeletonLine: {
    height: 16,
    width: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8
  }
});
