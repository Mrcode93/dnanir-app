import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formatDateLocal } from '../utils/date';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { BalanceCard } from '../components/BalanceCard';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionItem } from '../components/TransactionItem';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { calculateFinancialSummary, getCurrentMonthData, getMonthData } from '../services/financialService';
import {
  getExpenses,
  getIncome,
  getFinancialGoals,
  getUserSettings,
  getDebts,
  getChallenges,
  getCustomCategories,
  getAchievements,
  getRecentTransactions,
  getAvailableMonths,
  getExpenseShortcuts,
  getIncomeShortcuts,
  addExpense,
  addIncome,
  type ExpenseShortcut,
  type IncomeShortcut,
} from '../database/database';
import { Expense, Income, FinancialGoal, Debt, EXPENSE_CATEGORIES, Challenge } from '../types';
import { updateAllChallenges } from '../services/challengeService';
import { getUnlockedAchievementsCount, getTotalAchievementsCount } from '../services/achievementService';
import { calculateBudgetStatus, BudgetStatus } from '../services/budgetService';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';

import { usePrivacy } from '../context/PrivacyContext';
import { SmartAddModal } from '../components/SmartAddModal';
import { AddShortcutModal } from '../components/AddShortcutModal';
import { authStorage } from '../services/authStorage';
import { authApiService } from '../services/authApiService';
import { alertService } from '../services/alertService';

const { width } = Dimensions.get('window');
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export const DashboardScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency, currencyCode } = useCurrency();
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy();

  // Format full date consistently
  const formatFullDate = useCallback((date: Date) => {
    return `${WEEKDAY_NAMES[date.getDay()]}، ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}، ${date.getFullYear()}`;
  }, []);
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<any>(null);
  const [showSmartAdd, setShowSmartAdd] = useState(false);
  const [showAddShortcutModal, setShowAddShortcutModal] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<(Expense | Income)[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [activeGoals, setActiveGoals] = useState<FinancialGoal[]>([]);
  const [convertedGoalAmounts, setConvertedGoalAmounts] = useState<Record<number, { current: number; target: number }>>({});
  const [todayData, setTodayData] = useState<{ income: number; expenses: number; balance: number } | null>(null);
  const [debtsSummary, setDebtsSummary] = useState<{ total: number; active: number; paid: number; remaining: number } | null>(null);
  const [billsSummary, setBillsSummary] = useState<{ total: number; unpaid: number; paid: number; dueSoon: number } | null>(null);
  const [budgetsSummary, setBudgetsSummary] = useState<{ total: number; spent: number; remaining: number; exceeded: number } | null>(null);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [achievementsCount, setAchievementsCount] = useState<{ unlocked: number; total: number }>({ unlocked: 0, total: 0 });
  const [currentMonthData, setCurrentMonthData] = useState<{ totalIncome: number; totalExpenses: number; balance: number } | null>(null);
  const [expenseShortcuts, setExpenseShortcuts] = useState<ExpenseShortcut[]>([]);
  const [incomeShortcuts, setIncomeShortcuts] = useState<IncomeShortcut[]>([]);
  // Initialize with current month by default
  const [selectedBalanceMonth, setSelectedBalanceMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [filteredBalance, setFilteredBalance] = useState<number | null>(null);
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  // useLayoutEffect removed to allow AppNavigator to control tab bar styles globally with safe area insets

  const deferredLoadRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  const loadMonthData = useCallback(async () => {
    const targetYear = selectedBalanceMonth?.year || new Date().getFullYear();
    const targetMonth = selectedBalanceMonth?.month || new Date().getMonth() + 1;
    const isAllTime = selectedBalanceMonth?.year === 0 && selectedBalanceMonth?.month === 0;

    if (!isAllTime) {
      const monthData = await getMonthData(targetYear, targetMonth);
      setCurrentMonthData({
        totalIncome: monthData.totalIncome,
        totalExpenses: monthData.totalExpenses,
        balance: monthData.balance,
      });
      setFilteredBalance(monthData.balance);
      return;
    }

    const { getFinancialStatsAggregated } = await import('../database/database');
    const stats = await getFinancialStatsAggregated(undefined, undefined);
    const allTimeData = {
      totalIncome: stats?.totalIncome || 0,
      totalExpenses: stats?.totalExpenses || 0,
      balance: stats?.balance || 0,
    };
    setCurrentMonthData(allTimeData);
    setFilteredBalance(allTimeData.balance);
  }, [selectedBalanceMonth]);

  const loadEssentialData = useCallback(async () => {
    try {
      const today = formatDateLocal(new Date());
      const { getFinancialStatsAggregated } = await import('../database/database');

      // Run ALL essential queries in parallel
      const [financialSummary, months, todayStats, recent] = await Promise.all([
        calculateFinancialSummary(),
        getAvailableMonths(),
        getFinancialStatsAggregated(today, today),
        getRecentTransactions(5),
      ]);

      setSummary(financialSummary);
      setAvailableMonths(months);
      setTodayData({
        income: todayStats.totalIncome,
        expenses: todayStats.totalExpenses,
        balance: todayStats.balance,
      });
      setRecentTransactions(recent);

      // Month data can load slightly after
      await loadMonthData();
    } catch (error) {
      console.error('Error loading dashboard essential data:', error);
    }
  }, [loadMonthData]);

  const loadSecondaryData = useCallback(async () => {
    try {
      const [
        userSettings,
        allGoals,
        debts,
        budgetStatuses,
        customCats,
        achievements,
        challenges,
        shortcutsExp,
        shortcutsInc,
      ] = await Promise.all([
        getUserSettings(),
        getFinancialGoals(),
        getDebts(),
        calculateBudgetStatus(),
        getCustomCategories('expense'),
        Promise.all([getUnlockedAchievementsCount(), getTotalAchievementsCount()]),
        (async () => {
          await updateAllChallenges();
          return getChallenges();
        })(),
        getExpenseShortcuts(),
        getIncomeShortcuts(),
      ]);

      if (userSettings?.name) {
        setUserName(userSettings.name);
      }

      const active = allGoals.filter(g => !g.completed).slice(0, 3);
      setActiveGoals(active);

      // Convert goal amounts in parallel
      const convertedEntries = await Promise.all(
        active.map(async goal => {
          const goalCurrency = goal.currency || currencyCode;
          if (goalCurrency === currencyCode) {
            return [goal.id, { current: goal.currentAmount, target: goal.targetAmount }] as const;
          }
          try {
            const [convertedCurrent, convertedTarget] = await Promise.all([
              convertCurrency(goal.currentAmount, goalCurrency, currencyCode),
              convertCurrency(goal.targetAmount, goalCurrency, currencyCode),
            ]);
            return [goal.id, { current: convertedCurrent, target: convertedTarget }] as const;
          } catch (error) {
            console.error('Error converting currency:', error);
            return [goal.id, { current: goal.currentAmount, target: goal.targetAmount }] as const;
          }
        })
      );
      setConvertedGoalAmounts(Object.fromEntries(convertedEntries));

      const activeDebts = debts.filter(d => !d.isPaid);
      const paidDebts = debts.filter(d => d.isPaid);
      const totalRemaining = activeDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
      setDebtsSummary({
        total: debts.length,
        active: activeDebts.length,
        paid: paidDebts.length,
        remaining: totalRemaining,
      });

      const totalBudget = budgetStatuses.reduce((sum, b) => sum + b.budget.amount, 0);
      const totalSpent = budgetStatuses.reduce((sum, b) => sum + b.spent, 0);
      const totalRemainingBudget = totalBudget - totalSpent;
      const exceededBudgets = budgetStatuses.filter(b => b.isExceeded).length;
      setBudgetsSummary({
        total: budgetStatuses.length,
        spent: totalSpent,
        remaining: totalRemainingBudget,
        exceeded: exceededBudgets,
      });

      const activeChallengesList = challenges.filter(c => !c.completed);
      setActiveChallenges(activeChallengesList.slice(0, 3));

      const [unlocked, total] = achievements;
      setAchievementsCount({ unlocked, total });
      setExpenseShortcuts(shortcutsExp);
      setIncomeShortcuts(shortcutsInc);

      setCustomCategories(customCats);

      // Check achievements periodically (async, don't wait)
      try {
        const { checkAllAchievements } = await import('../services/achievementService');
        checkAllAchievements().catch(err => console.error('Error checking achievements in Dashboard:', err));
      } catch (error) {
        // Ignore if achievementService is not available
      }
    } catch (error) {
      console.error('Error loading dashboard secondary data:', error);
    }
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
  }, [loadEssentialData, scheduleSecondaryLoad]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return () => {
      unsubscribe();
      deferredLoadRef.current?.cancel?.();
    };
  }, [navigation, loadData]);

  const getCategoryName = useCallback((category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] ||
      customCategories.find(c => c.name === category)?.name ||
      category;
  }, [customCategories]);

  const getCategoryColor = useCallback((category: string, index: number) => {
    const categoryColors: Record<string, string> = {
      food: '#F59E0B',
      transport: '#3B82F6',
      shopping: '#EC4899',
      bills: '#EF4444',
      entertainment: '#8B5CF6',
      health: '#10B981',
      education: '#06B6D4',
      other: '#6B7280',
    };

    const customColor = customCategories.find(c => c.name === category)?.color;
    if (customColor) return customColor;

    return categoryColors[category] || [
      theme.gradients.primary[1],
      theme.gradients.info[1],
      theme.gradients.success[1],
      theme.colors.warning,
      theme.colors.error,
    ][index % 5];
  }, [customCategories, theme]);

  const chartData = useMemo(() => {
    const categories = summary?.topExpenseCategories || [];
    return categories.map((cat: any, index: number) => ({
      name: getCategoryName(cat.category),
      population: cat.amount,
      color: getCategoryColor(cat.category, index),
      legendFontColor: theme.colors.textPrimary,
      legendFontSize: 13,
    }));
  }, [summary?.topExpenseCategories, getCategoryName, getCategoryColor, theme.colors.textPrimary]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >

        {/* Main Balance Hero */}
        <View style={styles.heroSection}>
          {summary ? (
            <BalanceCard
              balance={filteredBalance !== null ? filteredBalance : summary.balance}
              selectedMonth={selectedBalanceMonth || undefined}
              onMonthChange={(year, month) => {
                setSelectedBalanceMonth({ year, month });
              }}
              showFilter={true}
              availableMonths={availableMonths}
            />
          ) : (
            <LinearGradient
              colors={['#001D33', '#003459', '#00527A', '#006A9E'] as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceSkeleton}
            >
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: '50%', height: 32, marginTop: 20 }]} />
              <View style={[styles.skeletonLine, { width: '30%', height: 12, marginTop: 12 }]} />
            </LinearGradient>
          )}

          {/* Today's Quick Look (Horizontal Tiles) */}
          {todayData && (
            <View style={styles.todayQuickLook}>
              <View style={[styles.quickLookItem, { backgroundColor: '#FFF', borderColor: '#D1FAE5' }]}>
                <View style={[styles.quickLookIconBg, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="trending-up" size={16} color="#059669" />
                </View>
                <Text style={styles.quickLookLabel}>دخل اليوم</Text>
                <Text style={[styles.quickLookValue, { color: '#059669' }]}>
                  {isPrivacyEnabled ? '****' : formatCurrency(todayData.income)}
                </Text>
              </View>
              <View style={[styles.quickLookItem, { backgroundColor: '#FFF', borderColor: '#FECDD3' }]}>
                <View style={[styles.quickLookIconBg, { backgroundColor: '#FFF1F2' }]}>
                  <Ionicons name="trending-down" size={16} color="#DC2626" />
                </View>
                <Text style={styles.quickLookLabel}>صرف اليوم</Text>
                <Text style={[styles.quickLookValue, { color: '#DC2626' }]}>
                  {isPrivacyEnabled ? '****' : formatCurrency(todayData.expenses)}
                </Text>
              </View>
              <View style={[styles.quickLookItem, { backgroundColor: '#FFF', borderColor: '#C7D2FE' }]}>
                <View style={[styles.quickLookIconBg, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="wallet-outline" size={16} color="#4338CA" />
                </View>
                <Text style={styles.quickLookLabel}>الصافي</Text>
                <Text style={[styles.quickLookValue, { color: '#4338CA' }]}>
                  {isPrivacyEnabled ? '****' : formatCurrency(todayData.balance)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Shortcuts Grid */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('Expenses', { screen: 'AddExpense' })}
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="remove-circle" size={28} color="#EF4444" />
            </View>
            <Text style={styles.actionLabel}>إضافة مصروف</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('Income', { screen: 'AddIncome' })}
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="add-circle" size={28} color="#10B981" />
            </View>
            <Text style={styles.actionLabel}>إضافة دخل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('Goals')}
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="flag" size={28} color="#F59E0B" />
            </View>
            <Text style={styles.actionLabel}>الأهداف</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => setShowSmartAdd(true)}
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#8B5CF620', borderColor: '#8B5CF6', borderWidth: 1 }]}>
              <Ionicons name="mic" size={26} color="#8B5CF6" />
            </View>
            <Text style={styles.actionLabel}>إضافة ذكية</Text>
          </TouchableOpacity>
        </View>

        {/* اختصارات سريعة - إضافة مصروف/دخل بضغطة دون فتح النموذج */}
        <View style={styles.shortcutsSection}>
          <View style={styles.shortcutsSectionHeader}>
            <Text style={styles.shortcutsSectionTitle}>اختصارات سريعة</Text>
            <TouchableOpacity
              onPress={() => setShowAddShortcutModal(true)}
            >
              <Text style={styles.shortcutsSectionLink}>+ إضافة اختصار</Text>
            </TouchableOpacity>
          </View>
          {(expenseShortcuts.length > 0 || incomeShortcuts.length > 0) ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutsScrollContent}
              style={styles.shortcutsScroll}
            >
              {expenseShortcuts.map((s) => (
                <TouchableOpacity
                  key={`exp-${s.id}`}
                  style={[styles.shortcutChip, styles.shortcutChipExpense]}
                  onPress={() => {
                    alertService.confirm(
                      'تأكيد إضافة مصروف',
                      `${s.title}\n${formatCurrency(s.amount)}\n\nهل تريد إضافة هذا المصروف؟`,
                      async () => {
                        try {
                          const dateStr = formatDateLocal(new Date());
                          await addExpense({
                            title: s.title,
                            amount: s.amount,
                            category: s.category as any,
                            date: dateStr,
                            description: s.description || '',
                            currency: s.currency || currencyCode,
                          });
                          loadData();
                          alertService.toastSuccess(`تمت إضافة المصروف: ${s.title}`);
                        } catch (err: any) {
                          alertService.toastError(err?.message || 'فشل الإضافة');
                        }
                      }
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove-circle-outline" size={18} color="#B91C1C" />
                  <Text style={styles.shortcutChipLabel} numberOfLines={1}>{s.title}</Text>
                  <Text style={styles.shortcutChipAmount}>{formatCurrency(s.amount)}</Text>
                </TouchableOpacity>
              ))}
              {incomeShortcuts.map((s) => (
                <TouchableOpacity
                  key={`inc-${s.id}`}
                  style={[styles.shortcutChip, styles.shortcutChipIncome]}
                  onPress={() => {
                    alertService.confirm(
                      'تأكيد إضافة دخل',
                      `${s.source}\n${formatCurrency(s.amount)}\n\nهل تريد إضافة هذا الدخل؟`,
                      async () => {
                        try {
                          const dateStr = formatDateLocal(new Date());
                          await addIncome({
                            source: s.source,
                            amount: s.amount,
                            date: dateStr,
                            category: (s.incomeSource || s.source) as any,
                            currency: s.currency || currencyCode,
                            description: s.description || '',
                          });
                          loadData();
                          alertService.toastSuccess(`تمت إضافة الدخل: ${s.source}`);
                        } catch (err: any) {
                          alertService.toastError(err?.message || 'فشل الإضافة');
                        }
                      }
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#047857" />
                  <Text style={styles.shortcutChipLabel} numberOfLines={1}>{s.source}</Text>
                  <Text style={styles.shortcutChipAmount}>{formatCurrency(s.amount)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.shortcutsEmptyHint}
              onPress={() => setShowAddShortcutModal(true)}
            >
              <Ionicons name="flash-outline" size={24} color={theme.colors.textSecondary} />
              <Text style={styles.shortcutsEmptyHintText}>لا توجد اختصارات. اضغط لإضافة اسم، فئة ومبلغ ثم استخدمها من هنا دون فتح النموذج.</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.smartInsightsRow}
          onPress={async () => {
            try {
              // Perform a real auth check with the server
              const { isAuthenticated, user } = await authApiService.checkAuth();

              console.log('[AI Insights] Dashboard button pressed check:', {
                isAuthenticated,
                userId: user?.id ?? null,
              });

              if (!isAuthenticated) {
                console.log('[AI Insights] Not authenticated -> showing login alert');
                alertService.show({
                  title: 'تسجيل الدخول',
                  message: 'يجب تسجيل الدخول أو إنشاء حساب لاستخدام التحليل الذكي بمساعدة الذكاء الاصطناعي.',
                  confirmText: 'تسجيل الدخول',
                  cancelText: 'إلغاء',
                  showCancel: true,
                  onConfirm: () => navigation.navigate('Auth')
                });
                return;
              }

              console.log('[AI Insights] Auth OK -> navigating to AISmartInsights');
              navigation.navigate('AISmartInsights');
            } catch (e) {
              console.error('AI button auth check error:', e);
              // Fallback to local check if offline
              const token = await authStorage.getAccessToken();
              if (token) {
                navigation.navigate('AISmartInsights');
              } else {
                navigation.navigate('Auth');
              }
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.smartInsightsIconBg}>
            <Ionicons name="sparkles" size={28} color="#06B6D4" />
          </View>
          <Text style={styles.smartInsightsLabel}>التحليل الذكي</Text>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={22} color="#06B6D4" />
        </TouchableOpacity>

        <AddShortcutModal
          visible={showAddShortcutModal}
          onClose={() => setShowAddShortcutModal(false)}
          onExpense={() => navigation.navigate('Expenses', { screen: 'AddExpense' })}
          onIncome={() => navigation.navigate('Income', { screen: 'AddIncome' })}
        />
        <SmartAddModal
          visible={showSmartAdd}
          onClose={() => setShowSmartAdd(false)}
          onSuccess={() => {
            loadData();
            // Maybe show a toast
          }}
        />

        {/* Monthly Financial Pulse */}
        {currentMonthData && (
          <View style={styles.pulseSection}>
            <LinearGradient
              colors={theme.gradients.primary as any}
              style={styles.pulseCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.pulseHeader}>
                <Text style={styles.pulseTitle}>
                  {selectedBalanceMonth?.year === 0 && selectedBalanceMonth?.month === 0
                    ? 'ملخص كلي للميزانية'
                    : `الميزانية لشهر ${MONTH_NAMES[(selectedBalanceMonth?.month || new Date().getMonth() + 1) - 1]}`}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Budget')}>
                  <Text style={styles.pulseLink}>التفاصيل</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.pulseStats}>
                <View style={styles.pulseStatItem}>
                  <Text style={styles.pulseStatNum}>
                    {isPrivacyEnabled ? '****' : formatCurrency(currentMonthData.totalIncome)}
                  </Text>
                  <Text style={styles.pulseStatLabel}>إجمالي الوارد</Text>
                </View>
                <View style={styles.pulseDivider} />
                <View style={styles.pulseStatItem}>
                  <Text style={styles.pulseStatNum}>
                    {isPrivacyEnabled ? '****' : formatCurrency(currentMonthData.totalExpenses)}
                  </Text>
                  <Text style={styles.pulseStatLabel}>إجمالي الصرف</Text>
                </View>
              </View>

              {/* Progress visual */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min((currentMonthData.totalExpenses / (currentMonthData.totalIncome || 1)) * 100, 100)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round((currentMonthData.totalExpenses / (currentMonthData.totalIncome || 1)) * 100) > 100
                    ? '⚠️ تجاوزت حد دخلك لهذا الشهر!'
                    : `استهلكت ${Math.round((currentMonthData.totalExpenses / (currentMonthData.totalIncome || 1)) * 100)}% من دخلك`}
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}



        {/* Goals Progress Carousel - أهدافي المالية */}
        {activeGoals.length > 0 && (
          <View style={styles.goalsSection}>
            <View style={styles.goalsSectionHeader}>
              <Text style={styles.goalsSectionTitle}>أهدافي المالية</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Goals')} activeOpacity={0.7}>
                <Text style={styles.goalsSectionFilter}>الكل</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goalsCarousel}>
              {activeGoals.map((goal) => {
                const goalAmounts = convertedGoalAmounts[goal.id] || { current: goal.currentAmount, target: goal.targetAmount };
                const percent = Math.min((goalAmounts.current / (goalAmounts.target || 1)) * 100, 100);

                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={styles.goalCard}
                    onPress={() => navigation.navigate('Goals', { screen: 'GoalDetails', params: { goalId: goal.id } })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.goalCardHeader}>
                      <Ionicons name="flag" size={20} color="#1E3A5F" />
                      <Text style={styles.goalCardTitle} numberOfLines={1}>{goal.title}</Text>
                    </View>
                    <Text style={styles.goalCardAmount}>{formatCurrency(goalAmounts.current)}</Text>
                    <View style={styles.goalCardProgressRow}>
                      <Text style={styles.goalPercentText}>{Math.round(percent)}%</Text>
                      <View style={styles.goalProgressBar}>
                        <View style={[styles.goalProgressFill, { width: `${percent}%` }]} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Status & Achievements Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.statusCard}
            onPress={() => navigation.navigate('Achievements')}
          >
            <LinearGradient
              colors={['#4F46E5', '#7C3AED']}
              style={styles.statusCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statusCardHeader}>
                <View style={styles.statusCardIconContainer}>
                  <Ionicons name="trophy" size={24} color="#FFF" />
                </View>
                <View style={styles.statusCardTitleContainer}>
                  <Text style={styles.statusCardTitle}>مستوى الإنجاز</Text>
                  <Text style={styles.statusCardSubtitle}>أنت تحرز تقدماً رائعاً!</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{
                    color: '#FFF',
                    fontWeight: getPlatformFontWeight('800'),
                    fontSize: 18,
                    fontFamily: theme.typography.fontFamily
                  }}>
                    {achievementsCount.unlocked}/{achievementsCount.total}
                  </Text>
                  <View style={styles.achievementProgressBar}>
                    <View style={[styles.achievementProgressFill, { width: `${(achievementsCount.unlocked / (achievementsCount.total || 1)) * 100}%` }]} />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Challenges Section */}
        {activeChallenges.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>تحديات نشطة</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Challenges')}>
                <Text style={styles.sectionLink}>الكل</Text>
              </TouchableOpacity>
            </View>

            {activeChallenges.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                style={styles.challengePreviewCardWrapper}
                onPress={() => navigation.navigate('Challenges')}
              >
                <LinearGradient
                  colors={['#FFF', '#F8FAFC']}
                  style={styles.challengePreviewCard}
                >
                  <View style={styles.challengePreviewHeader}>
                    <View style={[styles.challengePreviewIconContainer, { backgroundColor: '#F1F5F9' }]}>
                      <Ionicons name={challenge.icon as any || 'star'} size={24} color={theme.colors.primary} />
                    </View>
                    <View style={styles.challengePreviewContent}>
                      <Text style={styles.challengePreviewTitle}>{challenge.title}</Text>
                      <View style={styles.challengePreviewProgressBar}>
                        <View
                          style={[
                            styles.challengePreviewProgressFill,
                            {
                              width: `${(challenge.currentProgress / (challenge.targetProgress || 1)) * 100}%`,
                              backgroundColor: theme.colors.primary
                            }
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.challengePreviewPercentBadge}>
                      <Text style={styles.challengePreviewPercentText}>
                        {Math.round((challenge.currentProgress / (challenge.targetProgress || 1)) * 100)}%
                      </Text>
                    </View>

                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Other Summaries (Debts, Bills) - Compact Grid */}
        <View style={styles.summaryGrid}>
          {debtsSummary && (
            <TouchableOpacity
              style={styles.summaryGridItem}
              onPress={() => navigation.navigate('Debts')}
            >
              <View style={[styles.summaryIconBg, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="card" size={20} color="#FFF" />
              </View>
              <Text style={styles.summaryLabel}>الديون</Text>
              <Text style={styles.summaryValue}>{formatCurrency(debtsSummary.remaining)}</Text>
            </TouchableOpacity>
          )}

          {budgetsSummary && (
            <TouchableOpacity
              style={styles.summaryGridItem}
              onPress={() => navigation.navigate('Budget')}
            >
              <View style={[styles.summaryIconBg, { backgroundColor: '#EF4444' }]}>
                <Ionicons name="bar-chart" size={20} color="#FFF" />
              </View>
              <Text style={styles.summaryLabel}>الميزانية</Text>
              <Text style={styles.summaryValue}>{budgetsSummary.exceeded} متجاوز</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.summaryGridItem}
            onPress={() => navigation.navigate('Bills')}
          >
            <View style={[styles.summaryIconBg, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="receipt" size={20} color="#FFF" />
            </View>
            <Text style={styles.summaryLabel}>الفواتير</Text>
            <Text style={styles.summaryValue}>عرض الكل</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>أحدث العمليات</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Income')}>
              <Text style={styles.sectionLink}>الكل</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionList}>
            {recentTransactions.map((item, index) => (
              <TransactionItem
                key={`${(item as any).type}-${item.id}`}
                item={item}
                type={(item as any).type}
                showOptions={false}
                onPress={() => {
                  if ((item as any).type === 'expense') {
                    navigation.navigate('Expenses', { screen: 'AddExpense', params: { editExpense: item } });
                  } else {
                    navigation.navigate('Income', { screen: 'AddIncome', params: { editIncome: item } });
                  }
                }}
              />
            ))}
            {recentTransactions.length === 0 && (
              <Text style={styles.emptyText}>لا توجد عمليات مضافة مؤخراً</Text>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  headerContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...getPlatformShadow('sm'),
  },
  headerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  topInfo: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  greetingRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingContent: {
    flex: 1,
  },
  greetingAvatarContainer: {
    ...(isRTL ? { marginRight: theme.spacing.md } : { marginLeft: theme.spacing.md }),
  },
  greetingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('md'),
  },
  greetingText: {
    fontSize: 22,
    fontWeight: getPlatformFontWeight('800'),
    color: '#0F172A',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    letterSpacing: -0.3,
  },
  dateText: {
    fontSize: 13,
    color: '#94A3B8',
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    textAlign: isRTL ? 'right' : 'left',
    letterSpacing: 0.2,
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
    borderColor: '#F1F5F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 110, // Increased to clear TabBar height
  },
  heroSection: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  todayQuickLook: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  quickLookItem: {
    flex: 1,
    padding: theme.spacing.sm,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    ...getPlatformShadow('sm'),
  },
  quickLookIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickLookLabel: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('600'),
    marginTop: 2,
    fontFamily: theme.typography.fontFamily,
    color: '#64748B',
  },
  quickLookValue: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('800'),
    marginTop: 2,
    fontFamily: theme.typography.fontFamily,
  },
  actionGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xs,
  },
  actionItem: {
    alignItems: 'center',
    width: (width - theme.spacing.lg * 2) / 4 - 8,
  },
  actionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: getPlatformFontWeight('600'),
    color: '#334155',
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
  },
  shortcutsSection: {
    marginBottom: theme.spacing.lg,
    direction: 'rtl' as const,
  },
  shortcutsSectionHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  shortcutsSectionTitle: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  shortcutsSectionLink: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  shortcutsScroll: {
    marginHorizontal: -theme.spacing.xs,
  },
  shortcutsScrollContent: {
    paddingHorizontal: theme.spacing.xs,
    gap: 10,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  shortcutChip: {
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutChipExpense: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  shortcutChipIncome: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  shortcutChipLabel: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
  },
  shortcutChipAmount: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  shortcutsEmptyHint: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  shortcutsEmptyHintText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  smartInsightsRow: {
    width: '100%',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    backgroundColor: '#06B6D412',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#06B6D440',
  },
  smartInsightsIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#06B6D420',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartInsightsLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    ...(isRTL ? { marginRight: theme.spacing.md } : { marginLeft: theme.spacing.md }),
  },
  pulseSection: {
    marginBottom: theme.spacing.xl,
  },
  pulseCard: {
    borderRadius: 24,
    padding: theme.spacing.lg,
    ...getPlatformShadow('lg'),
  },
  pulseHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  pulseTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFF',
    fontFamily: theme.typography.fontFamily,
  },
  pulseLink: {
    fontSize: theme.typography.sizes.sm,
    color: '#BDF4FF',
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  pulseStats: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  pulseStatItem: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  pulseStatNum: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFF',
    fontFamily: theme.typography.fontFamily,
  },
  pulseStatLabel: {
    fontSize: 11,
    color: '#A5F3FC',
    marginTop: 2,
    fontFamily: theme.typography.fontFamily,
  },
  pulseDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: theme.spacing.md,
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('800'),
    color: '#1E293B',
    fontFamily: theme.typography.fontFamily,
  },
  sectionLink: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  transactionList: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: theme.spacing.sm,
    ...getPlatformShadow('sm'),
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: '#94A3B8',
    fontStyle: 'italic',
    fontFamily: theme.typography.fontFamily,
  },
  goalsSection: {
    marginBottom: theme.spacing.xl,

  },
  goalsSectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  goalsSectionTitle: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('800'),
    color: '#1E293B',
    fontFamily: theme.typography.fontFamily,
  },
  goalsSectionFilter: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  goalsCarousel: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
    flexDirection: isRTL ? 'row' : 'row-reverse',
  },
  goalCard: {
    width: width * 0.48,
    backgroundColor: '#FFF',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: theme.spacing.md,
    minWidth: '100%',
    direction: 'rtl' as const,
  },
  goalCardHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  goalCardTitle: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: '#334155',
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'left' : 'right',
  },
  goalCardAmount: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: '#1E293B',
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  goalCardProgressRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#1E3A5F',
    borderRadius: 3,
  },
  goalPercentText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    minWidth: 28,
  },
  summaryGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  summaryGridItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 } : { elevation: 2 }),
  },
  summaryIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('600'),
    color: '#64748B',
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('800'),
    color: '#1E293B',
    fontFamily: theme.typography.fontFamily,
  },
  budgetQuickCard: {
    marginBottom: theme.spacing.sm,
  },
  budgetQuickGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 } : { elevation: 2 }),
  },
  budgetQuickContent: {
    flex: 1,
  },
  budgetQuickTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  budgetQuickText: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  currencyConverterCard: {
    marginBottom: theme.spacing.sm,
  },
  currencyConverterGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 } : { elevation: 2 }),
  },
  currencyConverterContent: {
    flex: 1,
  },
  currencyConverterTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  currencyConverterDescription: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  statusCard: {
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 } : { elevation: 2 }),
  },
  statusCardGradient: {
    padding: theme.spacing.md,
  },
  statusCardHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statusCardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
  },
  statusCardTitleContainer: {
    flex: 1,
  },
  statusCardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusCardSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusCardStats: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusCardStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusCardStatLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  statusCardStatValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  statusCardStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.sm,
  },
  challengePreviewCardWrapper: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : { elevation: 1 }),
  },
  challengePreviewCard: {
    borderRadius: 24,
    padding: theme.spacing.lg,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 } : { elevation: 2 }),
  },
  challengePreviewHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  challengePreviewIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    ...(isRTL ? { marginLeft: theme.spacing.md } : { marginRight: theme.spacing.md }),
  },
  challengePreviewContent: {
    flex: 1,
  },
  challengePreviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  challengePreviewPercentBadge: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  challengePreviewPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
    fontFamily: theme.typography.fontFamily,
  },
  challengePreviewDescription: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  challengePreviewPercent: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
    textAlign: 'right',
  },
  challengePreviewProgressBar: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 0,
  },
  challengePreviewProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  challengePreviewDays: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptyChallengeCard: {
    marginBottom: theme.spacing.sm,
  },
  emptyChallengeGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : { elevation: 1 }),
  },
  emptyChallengeTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyChallengeText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  emptyChallengeButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 } : { elevation: 1 }),
  },
  achievementProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    width: '100%',
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.textInverse,
    borderRadius: 8,
  },
  emptyChallengeButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textInverse,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    fontFamily: theme.typography.fontFamily,
  },
  balanceSkeleton: {
    borderRadius: 24,
    padding: 20,
    minHeight: 180,
    ...getPlatformShadow('xl'),
    overflow: 'hidden',
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 16,
    width: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
  },
});
