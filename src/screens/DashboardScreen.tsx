import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  I18nManager,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { BalanceCard } from '../components/BalanceCard';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionItem } from '../components/TransactionItem';
import { theme, getTheme } from '../utils/theme';
import { calculateFinancialSummary, getCurrentMonthData, getMonthData } from '../services/financialService';
import { getExpenses, getIncome, getUserSettings, getFinancialGoals, getDebts, getChallenges, Challenge } from '../database/database';
import { Expense, Income, FinancialGoal, Debt, EXPENSE_CATEGORIES } from '../types';
import { updateAllChallenges } from '../services/challengeService';
import { getUnlockedAchievementsCount, getTotalAchievementsCount } from '../services/achievementService';
import { calculateBudgetStatus, BudgetStatus } from '../services/budgetService';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { getCustomCategories } from '../database/database';

const { width } = Dimensions.get('window');

export const DashboardScreen = ({ navigation }: any) => {
  const { formatCurrency, currencyCode } = useCurrency();
  
  // Month names in Arabic (consistent with BalanceCard)
  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  
  // Format month name consistently
  const formatMonthName = (date: Date) => {
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };
  
  // Format full date consistently
  const formatFullDate = (date: Date) => {
    const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return `${weekdays[date.getDay()]}، ${date.getDate()} ${monthNames[date.getMonth()]}، ${date.getFullYear()}`;
  };
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<(Expense | Income)[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [activeGoals, setActiveGoals] = useState<FinancialGoal[]>([]);
  const [convertedGoalAmounts, setConvertedGoalAmounts] = useState<Record<number, { current: number; target: number }>>({});
  const [todayData, setTodayData] = useState<{ income: number; expenses: number; balance: number } | null>(null);
  const [debtsSummary, setDebtsSummary] = useState<{ total: number; active: number; paid: number; remaining: number } | null>(null);
  const [budgetsSummary, setBudgetsSummary] = useState<{ total: number; spent: number; remaining: number; exceeded: number } | null>(null);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [achievementsCount, setAchievementsCount] = useState<{ unlocked: number; total: number }>({ unlocked: 0, total: 0 });
  const [currentMonthData, setCurrentMonthData] = useState<{ totalIncome: number; totalExpenses: number; balance: number } | null>(null);
  // Initialize with current month by default
  const [selectedBalanceMonth, setSelectedBalanceMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [filteredBalance, setFilteredBalance] = useState<number | null>(null);
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceCard,
          borderTopColor: theme.colors.primary,
          borderTopWidth: 1,
          height: 70 + (Platform.OS === 'android' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 20,
          paddingTop: 4,
          elevation: 8,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          flexDirection: 'row',
          display: 'flex',
        },
        tabBarShowLabel: true,
      });
    }
  }, [navigation, insets]);

  const loadData = async () => {
    try {
      const financialSummary = await calculateFinancialSummary();
      setSummary(financialSummary);

      const expenses = await getExpenses();
      const income = await getIncome();
      
      // Get available months (months that have expenses or income)
      const monthsSet = new Set<string>();
      // Add months from expenses
      expenses.forEach(expense => {
        const date = new Date(expense.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        monthsSet.add(`${year}-${month}`);
      });
      // Add months from income
      income.forEach(inc => {
        const date = new Date(inc.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        monthsSet.add(`${year}-${month}`);
      });
      
      const months = Array.from(monthsSet).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month };
      });
      setAvailableMonths(months);
      
      // Calculate today's data
      const today = new Date().toISOString().split('T')[0];
      const todayExpenses = expenses
        .filter(e => e.date === today)
        .reduce((sum, e) => sum + e.amount, 0);
      const todayIncome = income
        .filter(i => i.date === today)
        .reduce((sum, i) => sum + i.amount, 0);
      const todayBalance = todayIncome - todayExpenses;
      setTodayData({ income: todayIncome, expenses: todayExpenses, balance: todayBalance });
      
      const allTransactions = [
        ...expenses.map(e => ({ ...e, type: 'expense' as const })),
        ...income.map(i => ({ ...i, type: 'income' as const })),
      ].sort((a, b) => {
        // Sort by date first (newest first)
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) {
          return dateDiff;
        }
        // If dates are equal, sort by ID (higher ID = newer = first)
        return (b.id || 0) - (a.id || 0);
      })
        .slice(0, 5);

      setRecentTransactions(allTransactions);

      const userSettings = await getUserSettings();
      if (userSettings?.name) {
        setUserName(userSettings.name);
      }

      const allGoals = await getFinancialGoals();
      const active = allGoals.filter(g => !g.completed).slice(0, 3);
      setActiveGoals(active);

      // Convert goal amounts
      const converted: Record<number, { current: number; target: number }> = {};
      for (const goal of active) {
        const goalCurrency = goal.currency || currencyCode;
        if (goalCurrency !== currencyCode) {
          try {
            const convertedCurrent = await convertCurrency(goal.currentAmount, goalCurrency, currencyCode);
            const convertedTarget = await convertCurrency(goal.targetAmount, goalCurrency, currencyCode);
            converted[goal.id] = { current: convertedCurrent, target: convertedTarget };
          } catch (error) {
            console.error('Error converting currency:', error);
          }
        }
      }
      setConvertedGoalAmounts(converted);

      // Load debts summary
      const debts = await getDebts();
      const activeDebts = debts.filter(d => !d.isPaid);
      const paidDebts = debts.filter(d => d.isPaid);
      const totalRemaining = activeDebts.reduce((sum, d) => sum + d.remainingAmount, 0);
      setDebtsSummary({
        total: debts.length,
        active: activeDebts.length,
        paid: paidDebts.length,
        remaining: totalRemaining,
      });

      // Load budgets summary
      const budgetStatuses = await calculateBudgetStatus();
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

      // Load challenges
      await updateAllChallenges();
      const allChallenges = await getChallenges();
      const activeChallengesList = allChallenges.filter(c => !c.completed);
      setActiveChallenges(activeChallengesList.slice(0, 3)); // Show only first 3

      // Load achievements count
      const unlocked = await getUnlockedAchievementsCount();
      const total = await getTotalAchievementsCount();
      setAchievementsCount({ unlocked, total });
      
      // Check achievements periodically (async, don't wait)
      try {
        const { checkAllAchievements } = await import('../services/achievementService');
        checkAllAchievements().catch(err => console.error('Error checking achievements in Dashboard:', err));
      } catch (error) {
        // Ignore if achievementService is not available
      }

      // Load current month data
      const monthData = await getCurrentMonthData();
      const monthIncome = monthData.income.reduce((sum, item) => sum + item.amount, 0);
      const monthExpenses = monthData.expenses.reduce((sum, item) => sum + item.amount, 0);
      const monthBalance = monthIncome - monthExpenses;
      setCurrentMonthData({
        totalIncome: monthIncome,
        totalExpenses: monthExpenses,
        balance: monthBalance,
      });

      // Calculate filtered balance if month is selected
      if (selectedBalanceMonth && (selectedBalanceMonth.year !== 0 || selectedBalanceMonth.month !== 0)) {
        const filteredData = await getMonthData(selectedBalanceMonth.year, selectedBalanceMonth.month);
        // Use the month balance (income - expenses for that month only)
        // This should match currentMonthData.balance when the selected month is the current month
        setFilteredBalance(filteredData.balance);
        
        // If selected month is current month, verify it matches currentMonthData
        const now = new Date();
        if (selectedBalanceMonth.year === now.getFullYear() && 
            selectedBalanceMonth.month === now.getMonth() + 1) {
          // They should match, but use filteredData to ensure consistency
          if (Math.abs(filteredData.balance - monthBalance) > 0.01) {
            console.warn('Balance mismatch between getMonthData and currentMonthData:', {
              filtered: filteredData.balance,
              current: monthBalance
            });
          }
        }
      } else {
        // If no month selected, use total cumulative balance
        setFilteredBalance(null);
      }

      // Load custom categories
      const customCats = await getCustomCategories('expense');
      setCustomCategories(customCats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  // Reload data when selectedBalanceMonth changes
  useEffect(() => {
    if (selectedBalanceMonth !== null) {
      loadData();
    }
  }, [selectedBalanceMonth]);

  const getCategoryName = (category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || 
           customCategories.find(c => c.name === category)?.name || 
           category;
  };

  const getCategoryColor = (category: string, index: number) => {
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
  };

  const chartData = summary?.topExpenseCategories.map((cat: any, index: number) => {
    return {
      name: getCategoryName(cat.category),
      population: cat.amount,
      color: getCategoryColor(cat.category, index),
      legendFontColor: theme.colors.textPrimary,
      legendFontSize: 13,
    };
  }) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        {/* Balance Card */}
        {summary && (
          <BalanceCard 
            balance={filteredBalance !== null ? filteredBalance : summary.balance} 
            userName={userName}
            selectedMonth={selectedBalanceMonth || undefined}
            onMonthChange={(year, month) => {
              setSelectedBalanceMonth({ year, month });
              // Reload data to update balance immediately
              loadData();
            }}
            showFilter={true}
            availableMonths={availableMonths}
          />
        )}

        {/* Current Month Summary Card */}
        {currentMonthData && (
          <LinearGradient
            colors={['#10B981', '#059669', '#047857']}
            style={styles.todayCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.todayCardHeader}>
              <View style={styles.todayCardHeaderLeft}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.15)']}
                  style={styles.todayCardIconContainer}
                >
                  <Ionicons name="calendar" size={24} color={theme.colors.textInverse} />
                </LinearGradient>
                <View>
                  <Text style={styles.todayCardTitle}>الشهر الحالي</Text>
                  <Text style={styles.todayCardSubtitle}>
                    {formatMonthName(new Date())}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.todayCardStats}>
              <View style={styles.todayCardStatItem}>
                <View style={styles.todayCardStatHeader}>
                  <Ionicons name="arrow-up-circle" size={18} color="rgba(255, 255, 255, 0.9)" />
                  <Text style={styles.todayCardStatLabel}>الدخل</Text>
                </View>
                <Text style={styles.todayCardStatValue}>{formatCurrency(currentMonthData.totalIncome)}</Text>
              </View>
              <View style={styles.todayCardStatDivider} />
              <View style={styles.todayCardStatItem}>
                <View style={styles.todayCardStatHeader}>
                  <Ionicons name="arrow-down-circle" size={18} color="rgba(255, 255, 255, 0.9)" />
                  <Text style={styles.todayCardStatLabel}>المصاريف</Text>
                </View>
                <Text style={styles.todayCardStatValue}>{formatCurrency(currentMonthData.totalExpenses)}</Text>
              </View>
              <View style={styles.todayCardStatDivider} />
              <View style={styles.todayCardStatItem}>
                <View style={styles.todayCardStatHeader}>
                  <Ionicons 
                    name={currentMonthData.balance >= 0 ? "wallet" : "alert-circle"} 
                    size={18} 
                    color="rgba(255, 255, 255, 0.9)" 
                  />
                  <Text style={styles.todayCardStatLabel}>الرصيد</Text>
                </View>
                <Text style={[
                  styles.todayCardStatValue,
                  { color: currentMonthData.balance >= 0 ? theme.colors.textInverse : '#FFE5E5' }
                ]}>
                  {formatCurrency(currentMonthData.balance)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Today's Summary Card */}
        {todayData && (
          <LinearGradient
            colors={['#6366F1', '#4F46E5', '#4338CA']}
            style={styles.todayCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.todayCardHeader}>
              <View style={styles.todayCardHeaderLeft}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.15)']}
                  style={styles.todayCardIconContainer}
                >
                  <Ionicons name="today" size={24} color={theme.colors.textInverse} />
                </LinearGradient>
                <View>
                  <Text style={styles.todayCardTitle}>اليوم</Text>
                  <Text style={styles.todayCardSubtitle}>
                    {formatFullDate(new Date())}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.todayCardStats}>
              <View style={styles.todayCardStatItem}>
                <View style={styles.todayCardStatHeader}>
                  <Ionicons name="arrow-up-circle" size={18} color="rgba(255, 255, 255, 0.9)" />
                  <Text style={styles.todayCardStatLabel}>الدخل</Text>
                </View>
                <Text style={styles.todayCardStatValue}>{formatCurrency(todayData.income)}</Text>
              </View>
              <View style={styles.todayCardStatDivider} />
              <View style={styles.todayCardStatItem}>
                <View style={styles.todayCardStatHeader}>
                  <Ionicons name="arrow-down-circle" size={18} color="rgba(255, 255, 255, 0.9)" />
                  <Text style={styles.todayCardStatLabel}>المصاريف</Text>
                </View>
                <Text style={styles.todayCardStatValue}>{formatCurrency(todayData.expenses)}</Text>
              </View>
              <View style={styles.todayCardStatDivider} />
              <View style={styles.todayCardStatItem}>
                <View style={styles.todayCardStatHeader}>
                  <Ionicons 
                    name={todayData.balance >= 0 ? "wallet" : "alert-circle"} 
                    size={18} 
                    color="rgba(255, 255, 255, 0.9)" 
                  />
                  <Text style={styles.todayCardStatLabel}>الرصيد</Text>
                </View>
                <Text style={[
                  styles.todayCardStatValue,
                  { color: todayData.balance >= 0 ? theme.colors.textInverse : '#FFE5E5' }
                ]}>
                  {formatCurrency(todayData.balance)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        )}


        {/* Debts Status Card */}
        {debtsSummary && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Debts')}
            activeOpacity={0.8}
            style={styles.statusCard}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED', '#6D28D9'] as any}
              style={styles.statusCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statusCardHeader}>
                <View style={styles.statusCardIconContainer}>
                  <Ionicons name="card" size={24} color={theme.colors.textInverse} />
                </View>
                <View style={styles.statusCardTitleContainer}>
                  <Text style={styles.statusCardTitle}>الديون والأقساط</Text>
                  <Text style={styles.statusCardSubtitle}>
                    {debtsSummary.active} دين نشط
                  </Text>
                </View>
              </View>
              <View style={styles.statusCardStats}>
                <View style={styles.statusCardStatItem}>
                  <Text style={styles.statusCardStatLabel}>المتبقي</Text>
                  <Text style={styles.statusCardStatValue}>
                    {formatCurrency(debtsSummary.remaining)}
                  </Text>
                </View>
                <View style={styles.statusCardStatDivider} />
                <View style={styles.statusCardStatItem}>
                  <Text style={styles.statusCardStatLabel}>مدفوع</Text>
                  <Text style={[styles.statusCardStatValue, { color: '#10B981' }]}>
                    {debtsSummary.paid}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Budgets Status Card */}
        {budgetsSummary && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Budget')}
            activeOpacity={0.8}
            style={styles.statusCard}
          >
            <LinearGradient
              colors={['#6366F1', '#4F46E5', '#4338CA'] as any}
              style={styles.statusCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.statusCardHeader}>
                <View style={styles.statusCardIconContainer}>
                  <Ionicons name="wallet" size={24} color={theme.colors.textInverse} />
                </View>
                <View style={styles.statusCardTitleContainer}>
                  <Text style={styles.statusCardTitle}>الميزانية</Text>
                  <Text style={styles.statusCardSubtitle}>
                    {budgetsSummary.total} ميزانية نشطة
                  </Text>
                </View>
              </View>
              <View style={styles.statusCardStats}>
                <View style={styles.statusCardStatItem}>
                  <Text style={styles.statusCardStatLabel}>المتبقي</Text>
                  <Text style={[
                    styles.statusCardStatValue,
                    { color: budgetsSummary.remaining >= 0 ? '#10B981' : '#EF4444' }
                  ]}>
                    {formatCurrency(budgetsSummary.remaining)}
                  </Text>
                </View>
                <View style={styles.statusCardStatDivider} />
                <View style={styles.statusCardStatItem}>
                  <Text style={styles.statusCardStatLabel}>متجاوز</Text>
                  <Text style={[styles.statusCardStatValue, { color: budgetsSummary.exceeded > 0 ? '#EF4444' : '#10B981' }]}>
                    {budgetsSummary.exceeded}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Debts Quick View */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>الديون والأقساط</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Debts')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>عرض الكل</Text>
              <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Debts')}
            style={styles.budgetQuickCard}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED'] as any}
              style={styles.budgetQuickGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="card" size={32} color={theme.colors.textInverse} />
              <View style={styles.budgetQuickContent}>
                <Text style={styles.budgetQuickTitle}>إدارة الديون والأقساط</Text>
                <Text style={styles.budgetQuickText}>
                  تتبع ديونك المستحقة عليك ومتى يجب الدفع
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Budget Quick View */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>الميزانية</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Budget')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>عرض الكل</Text>
              <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Budget')}
            style={styles.budgetQuickCard}
          >
            <LinearGradient
              colors={theme.gradients.info as any}
              style={styles.budgetQuickGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="wallet" size={32} color={theme.colors.textInverse} />
              <View style={styles.budgetQuickContent}>
                <Text style={styles.budgetQuickTitle}>إدارة الميزانية</Text>
                <Text style={styles.budgetQuickText}>
                  حدد ميزانياتك الشهرية وتابع إنفاقك
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Active Goals Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>أهدافي المالية</Text>
            {activeGoals.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Goals')}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>عرض الكل</Text>
                <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {activeGoals.length > 0 ? (
            activeGoals.map((goal) => {
              const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              
              // Get gradient for category
              const getCategoryGradient = (category: string) => {
                const gradientMap: Record<string, readonly string[]> = {
                  emergency: theme.gradients.goalRose,
                  vacation: theme.gradients.goalBlue,
                  car: theme.gradients.goalOrange,
                  house: theme.gradients.goalIndigo,
                  wedding: theme.gradients.goalPink,
                  education: theme.gradients.goalTeal,
                  business: theme.gradients.goalEmerald,
                  other: theme.gradients.goalPurple,
                };
                return gradientMap[category] || theme.gradients.goalPurple;
              };
              
              const gradientColors = getCategoryGradient(goal.category);
              
              return (
                <TouchableOpacity
                  key={goal.id}
                  onPress={() => navigation.navigate('Goals')}
                  activeOpacity={0.9}
                  style={styles.goalPreviewCardWrapper}
                >
                  <LinearGradient
                    colors={gradientColors as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.goalPreviewCard}
                  >
                    <View style={styles.goalPreviewHeader}>
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.15)']}
                        style={styles.goalPreviewIcon}
                      >
                        <Ionicons name="flag" size={20} color={theme.colors.textInverse} />
                      </LinearGradient>
                    <View style={styles.goalPreviewContent}>
                      <Text style={styles.goalPreviewTitle} numberOfLines={1}>
                        {goal.title}
                      </Text>
                      <View>
                        <Text style={styles.goalPreviewAmount}>
                          {formatCurrencyAmount(goal.currentAmount, goal.currency || currencyCode)} / {formatCurrencyAmount(goal.targetAmount, goal.currency || currencyCode)}
                        </Text>
                        {convertedGoalAmounts[goal.id] && goal.currency !== currencyCode && (
                          <Text style={styles.goalPreviewConvertedAmount}>
                            ≈ {formatCurrency(convertedGoalAmounts[goal.id].current)} / {formatCurrency(convertedGoalAmounts[goal.id].target)}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.goalPreviewPercent}>
                      {Math.round(progress)}%
                    </Text>
                  </View>
                  <View style={styles.goalPreviewProgressBar}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.goalPreviewProgressFill,
                        { width: `${Math.min(progress, 100)}%` },
                      ]}
                    />
                  </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Goals')}
              style={styles.emptyGoalCard}
            >
              <LinearGradient
                colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                style={styles.emptyGoalGradient}
              >
                <Ionicons name="flag-outline" size={32} color={theme.colors.primary} />
                <Text style={styles.emptyGoalTitle}>ابدأ بتحديد هدف مالي</Text>
                <Text style={styles.emptyGoalText}>
                  حدد أهدافك المالية وتابع تقدمك نحو تحقيقها
                </Text>
                <View style={styles.emptyGoalButton}>
                  <Text style={styles.emptyGoalButtonText}>إضافة هدف جديد</Text>
                  <Ionicons name="add-circle" size={20} color={theme.colors.textInverse} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Currency Converter Card */}
        <TouchableOpacity
          onPress={() => navigation.navigate('CurrencyConverter')}
          style={styles.currencyConverterCard}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={theme.gradients.info as any}
            style={styles.currencyConverterGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="swap-horizontal" size={32} color={theme.colors.textInverse} />
            <View style={styles.currencyConverterContent}>
              <Text style={styles.currencyConverterTitle}>محول العملات</Text>
              <Text style={styles.currencyConverterDescription}>
                حول بين العملات المختلفة بسهولة
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Challenges Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>تحدياتي</Text>
            {activeChallenges.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Challenges')}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>عرض الكل</Text>
                <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {activeChallenges.length > 0 ? (
            activeChallenges.map((challenge) => {
              const progress = challenge.targetProgress > 0 
                ? (challenge.currentProgress / challenge.targetProgress) * 100 
                : 0;
              const daysRemaining = () => {
                const today = new Date();
                const endDate = new Date(challenge.endDate);
                const diffTime = endDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return Math.max(0, diffDays);
              };

              return (
                <TouchableOpacity
                  key={challenge.id}
                  onPress={() => navigation.navigate('Challenges')}
                  activeOpacity={0.9}
                  style={styles.challengePreviewCardWrapper}
                >
                  <LinearGradient
                    colors={['#034C3C', '#273C2C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.challengePreviewCard}
                  >
                    <View style={styles.challengePreviewHeader}>
                      <View style={styles.challengePreviewIconContainer}>
                        <Ionicons
                          name={challenge.icon as any}
                          size={24}
                          color={theme.colors.textInverse}
                        />
                      </View>
                      <View style={styles.challengePreviewContent}>
                        <Text style={styles.challengePreviewTitle} numberOfLines={1}>
                          {challenge.title}
                        </Text>
                        <Text style={styles.challengePreviewDescription} numberOfLines={1}>
                          {challenge.description}
                        </Text>
                      </View>
                      <Text style={styles.challengePreviewPercent}>
                        {Math.round(progress)}%
                      </Text>
                    </View>
                    <View style={styles.challengePreviewProgressBar}>
                      <View
                        style={[
                          styles.challengePreviewProgressFill,
                          { width: `${Math.min(progress, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.challengePreviewDays}>
                      {daysRemaining()} يوم متبقي
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Challenges')}
              style={styles.emptyChallengeCard}
            >
              <LinearGradient
                colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                style={styles.emptyChallengeGradient}
              >
                <Ionicons name="trophy-outline" size={32} color={theme.colors.primary} />
                <Text style={styles.emptyChallengeTitle}>ابدأ بتحدي جديد</Text>
                <Text style={styles.emptyChallengeText}>
                  اختبر نفسك مع تحديات مالية ممتعة
                </Text>
                <View style={styles.emptyChallengeButton}>
                  <Text style={styles.emptyChallengeButtonText}>استكشف التحديات</Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textInverse} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Achievements Quick View */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>إنجازاتي</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Achievements')}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>عرض الكل</Text>
              <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Achievements')}
            style={styles.budgetQuickCard}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706'] as any}
              style={styles.budgetQuickGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="trophy" size={32} color={theme.colors.textInverse} />
              <View style={styles.budgetQuickContent}>
                <Text style={styles.budgetQuickTitle}>الإنجازات والشارات</Text>
                <Text style={styles.budgetQuickText}>
                  {achievementsCount.unlocked} من {achievementsCount.total} إنجاز مفتوح
                </Text>
                {achievementsCount.total > 0 && (
                  <View style={styles.achievementProgressBar}>
                    <View
                      style={[
                        styles.achievementProgressFill,
                        {
                          width: `${(achievementsCount.unlocked / achievementsCount.total) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Expense Distribution Chart */}
        {chartData.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderLeft}>
                <Ionicons name="pie-chart" size={24} color={theme.colors.primary} />
                <Text style={styles.chartTitle}>توزيع المصاريف</Text>
              </View>
            </View>
            <View style={styles.chartContent}>
              <View style={styles.chartWrapper}>
                <PieChart
                  data={chartData}
                  width={width - 80}
                  height={200}
                  chartConfig={{
                    color: (opacity = 1) => {
                      const r = parseInt(theme.colors.primary.slice(1, 3), 16);
                      const g = parseInt(theme.colors.primary.slice(3, 5), 16);
                      const b = parseInt(theme.colors.primary.slice(5, 7), 16);
                      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    },
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  center={[10, 0]}
                  absolute
                  hasLegend={false}
                />
              </View>
              <View style={styles.chartLegend}>
                {chartData.map((item: any, index: number) => {
                  const percentage = summary?.topExpenseCategories[index]?.percentage || 0;
                  return (
                    <View key={index} style={styles.legendItem}>
                      <View style={styles.legendItemLeft}>
                        <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>
                      <View style={styles.legendItemRight}>
                        <Text style={styles.legendItemAmount}>
                          {formatCurrency(item.population)}
                        </Text>
                        <Text style={styles.legendItemPercentage}>
                          {percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* Recent Transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>المعاملات الأخيرة</Text>
          {recentTransactions.map((transaction, index) => (
            <TransactionItem
              key={`${(transaction as any).type}-${index}`}
              item={transaction}
              type={(transaction as any).type}
              formatCurrency={formatCurrency}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 120,
  },
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  summaryGap: {
    width: theme.spacing.sm,
  },
   todayCard: {
     marginBottom: theme.spacing.md,
     borderRadius: theme.borderRadius.lg,
     padding: theme.spacing.md,
     ...theme.shadows.md,
     overflow: 'hidden',
   },
   todayCardHeader: {
     marginBottom: theme.spacing.md,
   },
  todayCardHeaderLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
   todayCardIconContainer: {
     width: 40,
     height: 40,
     borderRadius: 20,
     alignItems: 'center',
     justifyContent: 'center',
     ...theme.shadows.sm,
   },
   todayCardTitle: {
     fontSize: theme.typography.sizes.lg,
     fontWeight: '700',
     color: theme.colors.textInverse,
     fontFamily: theme.typography.fontFamily,
     textAlign: 'right',
     marginBottom: theme.spacing.xs / 2,
   },
   todayCardSubtitle: {
     fontSize: theme.typography.sizes.xs,
     color: 'rgba(255, 255, 255, 0.85)',
     fontFamily: theme.typography.fontFamily,
     textAlign: 'right',
   },
   todayCardStats: {
     flexDirection: 'row-reverse',
     justifyContent: 'space-around',
     paddingTop: theme.spacing.md,
     borderTopWidth: 1,
     borderTopColor: 'rgba(255, 255, 255, 0.2)',
   },
  todayCardStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  todayCardStatHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  todayCardStatLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
   todayCardStatValue: {
     fontSize: theme.typography.sizes.sm,
     fontWeight: '700',
     color: theme.colors.textInverse,
     fontFamily: theme.typography.fontFamily,
     textAlign: 'center',
   },
  todayCardStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.sm,
  },
  chartCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chartHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  chartHeaderLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  chartContent: {
    padding: theme.spacing.md,
  },
  chartWrapper: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  chartTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  chartLegend: {
    gap: theme.spacing.sm,
  },
  legendItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  legendItemLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  legendColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendItemName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    textAlign: isRTL ? 'right' : 'left',
  },
  legendItemRight: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  legendItemAmount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  legendItemPercentage: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  section: {
    marginBottom: theme.spacing.lg,
    direction: 'ltr',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    direction: 'rtl',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
  },
  goalPreviewCardWrapper: {
    marginBottom: theme.spacing.sm,
  },
  goalPreviewCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.md,
    overflow: 'hidden',
  },
  goalPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  goalPreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
    ...theme.shadows.sm,
  },
  goalPreviewContent: {
    flex: 1,
  },
  goalPreviewTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  goalPreviewAmount: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  goalPreviewConvertedAmount: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
    fontStyle: 'italic',
  },
  goalPreviewPercent: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  goalPreviewProgressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  goalPreviewProgressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.round,
  },
  emptyGoalCard: {
    marginBottom: theme.spacing.sm,
  },
  emptyGoalGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  emptyGoalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyGoalText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  emptyGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  emptyGoalButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textInverse,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
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
    ...theme.shadows.md,
  },
  budgetQuickContent: {
    flex: 1,
  },
  budgetQuickTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
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
    ...theme.shadows.md,
  },
  currencyConverterContent: {
    flex: 1,
  },
  currencyConverterTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
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
    ...theme.shadows.md,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    ...theme.shadows.sm,
  },
  challengePreviewCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  challengePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  challengePreviewIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  challengePreviewContent: {
    flex: 1,
  },
  challengePreviewTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
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
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    marginRight: theme.spacing.sm,
  },
  challengePreviewProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  challengePreviewProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.textInverse,
    borderRadius: theme.borderRadius.round,
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
    ...theme.shadows.sm,
  },
  emptyChallengeTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  achievementProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    width: '100%',
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.textInverse,
    borderRadius: theme.borderRadius.round,
  },
  emptyChallengeButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textInverse,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    fontFamily: theme.typography.fontFamily,
  },
});
