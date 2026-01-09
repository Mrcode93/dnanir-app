import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { BalanceCard } from '../components/BalanceCard';
import { SummaryCard } from '../components/SummaryCard';
import { TransactionItem } from '../components/TransactionItem';
import { theme } from '../utils/theme';
import { calculateFinancialSummary, formatCurrency } from '../services/financialService';
import { getExpenses, getIncome, getUserSettings, getFinancialGoals } from '../database/database';
import { Expense, Income, FinancialGoal } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { isRTL } from '../utils/rtl';

const { width } = Dimensions.get('window');

export const DashboardScreen = ({ navigation }: any) => {
  const [summary, setSummary] = useState<any>(null);
  const [recentTransactions, setRecentTransactions] = useState<(Expense | Income)[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [activeGoals, setActiveGoals] = useState<FinancialGoal[]>([]);

  const loadData = async () => {
    try {
      const financialSummary = await calculateFinancialSummary();
      setSummary(financialSummary);

      const expenses = await getExpenses();
      const income = await getIncome();
      
      const allTransactions = [
        ...expenses.map(e => ({ ...e, type: 'expense' as const })),
        ...income.map(i => ({ ...i, type: 'income' as const })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setRecentTransactions(allTransactions);

      const userSettings = await getUserSettings();
      if (userSettings?.name) {
        setUserName(userSettings.name);
      }

      const allGoals = await getFinancialGoals();
      const active = allGoals.filter(g => !g.completed).slice(0, 3);
      setActiveGoals(active);
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

  const chartData = summary?.topExpenseCategories.map((cat: any, index: number) => {
    const colors = [
      theme.gradients.primary[1],
      theme.gradients.info[1],
      theme.gradients.success[1],
      theme.colors.warning,
      theme.colors.error,
    ];
    return {
      name: cat.category,
      population: cat.amount,
      color: colors[index % colors.length],
      legendFontColor: theme.colors.textSecondary,
      legendFontSize: 12,
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
          <BalanceCard balance={summary.balance} userName={userName} />
        )}

        {/* Summary Cards */}
        {summary && (
          <View style={styles.summaryGrid}>
            <SummaryCard
              label="إجمالي الدخل"
              value={summary.totalIncome}
              icon="trending-up"
              gradient={theme.gradients.success}
              formatCurrency={formatCurrency}
            />
            <View style={styles.summaryGap} />
            <SummaryCard
              label="إجمالي المصاريف"
              value={summary.totalExpenses}
              icon="trending-down"
              gradient={theme.gradients.error}
              formatCurrency={formatCurrency}
            />
          </View>
        )}

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
                <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
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
                      <Text style={styles.goalPreviewAmount}>
                        {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                      </Text>
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

        {/* Expense Distribution Chart */}
        {chartData.length > 0 && (
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.chartCard}
          >
            <View style={styles.chartContent}>
              <Text style={styles.chartTitle}>توزيع المصاريف</Text>
              <PieChart
                data={chartData}
                width={width - 80}
                height={220}
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
              />
            </View>
          </LinearGradient>
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
              onPress={() => {
                if ((transaction as any).type === 'expense') {
                  navigation.navigate('Expenses');
                } else {
                  navigation.navigate('Income');
                }
              }}
            />
          ))}
        </View>
      </ScrollView>

      {/* FAB */}
      <LinearGradient
        colors={theme.gradients.primary as any}
        style={styles.fabGradient}
      >
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={() => navigation.navigate('Expenses')}
          size="medium"
          color={theme.colors.textInverse}
        />
      </LinearGradient>
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
    paddingBottom: 100,
  },
  summaryGrid: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  summaryGap: {
    width: theme.spacing.md,
  },
  chartCard: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  chartContent: {
    padding: theme.spacing.lg,
  },
  chartTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontFamily: theme.typography.fontFamily,
  },
  section: {
    marginBottom: theme.spacing.lg,
    direction: 'rtl',
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
  fabGradient: {
    position: 'absolute',
    ...(isRTL ? { left: theme.spacing.lg } : { right: theme.spacing.lg }),
    bottom: theme.spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  fab: {
    backgroundColor: 'transparent',
  },
});
