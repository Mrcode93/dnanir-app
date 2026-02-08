import React, { useState, useEffect, useLayoutEffect } from 'react';
import { formatDateLocal, getMonthRange } from '../utils/date';
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
import { theme, getTheme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
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

const { width } = Dimensions.get('window');

export const DashboardScreen = ({ navigation }: any) => {
  const { formatCurrency, currencyCode } = useCurrency();
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy();

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
  const [showSmartAdd, setShowSmartAdd] = useState(false); // New state for modal
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
  // Initialize with current month by default
  const [selectedBalanceMonth, setSelectedBalanceMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [filteredBalance, setFilteredBalance] = useState<number | null>(null);
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  // useLayoutEffect removed to allow AppNavigator to control tab bar styles globally with safe area insets

  const loadData = async () => {
    try {
      const financialSummary = await calculateFinancialSummary();
      setSummary(financialSummary);

      // FAST: Get available months using a SQL query instead of fetching all transactions
      const months = await getAvailableMonths();
      setAvailableMonths(months);

      // Calculate today's data using optimized aggregated query
      const today = formatDateLocal(new Date());
      const { getFinancialStatsAggregated } = await import('../database/database');
      const todayStats = await getFinancialStatsAggregated(today, today);

      setTodayData({
        income: todayStats.totalIncome,
        expenses: todayStats.totalExpenses,
        balance: todayStats.balance
      });

      // FAST: Fetch only the last 5 transactions from the DB
      const recent = await getRecentTransactions(5);
      setRecentTransactions(recent);

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

      // Load month data based on selection or defaulting to current
      const targetYear = selectedBalanceMonth?.year || new Date().getFullYear();
      const targetMonth = selectedBalanceMonth?.month || new Date().getMonth() + 1;
      const isAllTime = selectedBalanceMonth?.year === 0 && selectedBalanceMonth?.month === 0;

      let monthIncome, monthExpenses, monthBalance;

      if (!isAllTime) {
        // Fetch specific month data
        const monthData = await getMonthData(targetYear, targetMonth);
        monthIncome = monthData.totalIncome;
        monthExpenses = monthData.totalExpenses;
        monthBalance = monthData.balance;

        // Update Pulse Section with selected month data
        setCurrentMonthData({
          totalIncome: monthIncome,
          totalExpenses: monthExpenses,
          balance: monthBalance,
        });

        // Update filtered balance to show this month's net
        setFilteredBalance(monthBalance);
      } else {
        // "All Time" selected - Show cumulative totals
        const { getFinancialStatsAggregated } = await import('../database/database');
        // Explicitly pass undefined to ensure no date filtering
        const stats = await getFinancialStatsAggregated(undefined, undefined);

        const allTimeData = {
          totalIncome: stats?.totalIncome || 0,
          totalExpenses: stats?.totalExpenses || 0,
          balance: stats?.balance || 0
        };

        setCurrentMonthData(allTimeData);

        // Force update filtered balance
        setFilteredBalance(allTimeData.balance);
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

  // Reload data when selectedBalanceMonth changes
  useEffect(() => {
    loadData();
  }, [navigation, selectedBalanceMonth]); // Add selectedBalanceMonth dependency

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
      {/* Header Section */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingText}>مرحباً، {userName || 'مستخدم دنايّر'}</Text>
            <Text style={styles.dateText}>{formatFullDate(new Date())}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={togglePrivacy}
            >
              <Ionicons
                name={isPrivacyEnabled ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
          {summary && (
            <BalanceCard
              balance={filteredBalance !== null ? filteredBalance : summary.balance}
              selectedMonth={selectedBalanceMonth || undefined}
              onMonthChange={(year, month) => {
                setSelectedBalanceMonth({ year, month });
                loadData();
              }}
              showFilter={true}
              availableMonths={availableMonths}
            />
          )}

          {/* Today's Quick Look (Horizontal Tiles) */}
          {todayData && (
            <View style={styles.todayQuickLook}>
              <View style={[styles.quickLookItem, { backgroundColor: '#E0F2F1' }]}>
                <Ionicons name="trending-up" size={16} color="#00695C" />
                <Text style={styles.quickLookLabel}>دخل اليوم</Text>
                <Text style={[styles.quickLookValue, { color: '#00695C' }]}>
                  {isPrivacyEnabled ? '****' : formatCurrency(todayData.income)}
                </Text>
              </View>
              <View style={[styles.quickLookItem, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="trending-down" size={16} color="#C62828" />
                <Text style={styles.quickLookLabel}>صرف اليوم</Text>
                <Text style={[styles.quickLookValue, { color: '#C62828' }]}>
                  {isPrivacyEnabled ? '****' : formatCurrency(todayData.expenses)}
                </Text>
              </View>
              <View style={[styles.quickLookItem, { backgroundColor: '#E8EAF6' }]}>
                <Ionicons name="wallet-outline" size={16} color="#283593" />
                <Text style={styles.quickLookLabel}>الصافي</Text>
                <Text style={[styles.quickLookValue, { color: '#283593' }]}>
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
                    : `الميزانية لشهر ${monthNames[(selectedBalanceMonth?.month || new Date().getMonth() + 1) - 1]}`}
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

        {/* Goals Progress Carousel */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>أهدافي المالية</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Goals')}>
                <Text style={styles.sectionLink}>الكل</Text>
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
                  >
                    <View style={styles.goalCardHeader}>
                      <Ionicons name="flag" size={18} color={theme.colors.primary} />
                      <Text style={styles.goalCardTitle} numberOfLines={1}>{goal.title}</Text>
                    </View>
                    <Text style={styles.goalCardAmount}>{formatCurrency(goalAmounts.current)}</Text>
                    <View style={styles.goalProgressBar}>
                      <View style={[styles.goalProgressFill, { width: `${percent}%` }]} />
                    </View>
                    <Text style={styles.goalPercentText}>{Math.round(percent)}%</Text>
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  greetingText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#0F172A',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  dateText: {
    fontSize: theme.typography.sizes.sm,
    color: '#64748B',
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    textAlign: isRTL ? 'right' : 'left',
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
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...getPlatformShadow('sm'),
  },
  quickLookLabel: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('600'),
    marginTop: 4,
    fontFamily: theme.typography.fontFamily,
  },
  quickLookValue: {
    fontSize: 12,
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
  goalsCarousel: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  goalCard: {
    width: width * 0.45,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: theme.spacing.md,
    ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 } : { elevation: 2 }),
  },
  goalCardHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: 8,
  },
  goalCardTitle: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('700'),
    color: '#334155',
    flex: 1,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  goalCardAmount: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  goalProgressBar: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  goalPercentText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: getPlatformFontWeight('600'),
    textAlign: isRTL ? 'left' : 'right',
    fontFamily: theme.typography.fontFamily,
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
});
