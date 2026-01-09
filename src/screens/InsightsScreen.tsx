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
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { calculateFinancialSummary, formatCurrency, getCurrentMonthData, generateFinancialInsights } from '../services/financialService';
import { EXPENSE_CATEGORIES } from '../types';
import { getCustomCategories } from '../database/database';

const { width } = Dimensions.get('window');

export const InsightsScreen = ({ navigation }: any) => {
  const [summary, setSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const financialSummary = await calculateFinancialSummary();
      setSummary(financialSummary);
      
      const currentMonth = await getCurrentMonthData();
      setMonthlyData(currentMonth);

      const financialInsights = generateFinancialInsights(financialSummary);
      setInsights(financialInsights);

      const customCats = await getCustomCategories('expense');
      setCustomCategories(customCats);
    } catch (error) {
      console.error('Error loading insights data:', error);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getExpenseTrendData = () => {
    if (!monthlyData?.expenses) return null;

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const dailyExpenses = last7Days.map(date => {
      const dayExpenses = monthlyData.expenses.filter((expense: any) => 
        expense.date === date
      );
      return dayExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);
    });

    return {
      labels: last7Days.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('ar-IQ', { weekday: 'short' });
      }),
      datasets: [{
        data: dailyExpenses,
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        strokeWidth: 2
      }]
    };
  };

  const getCategoryPieData = () => {
    if (!summary?.topExpenseCategories || summary.topExpenseCategories.length === 0) return null;

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

    return summary.topExpenseCategories.map((item: any) => {
      const categoryName = EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] || 
                          customCategories.find(c => c.name === item.category)?.name || 
                          item.category;
      return {
        name: categoryName,
        amount: item.amount,
        color: categoryColors[item.category] || customCategories.find(c => c.name === item.category)?.color || '#6B7280',
        legendFontColor: theme.colors.textPrimary,
        legendFontSize: 12,
      };
    });
  };

  const getIncomeVsExpensesData = () => {
    if (!monthlyData) return null;

    const totalIncome = monthlyData.income?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;
    const totalExpenses = monthlyData.expenses?.reduce((sum: number, item: any) => sum + item.amount, 0) || 0;

    return {
      labels: ['الدخل', 'المصاريف'],
      datasets: [{
        data: [totalIncome, totalExpenses],
      }],
    };
  };

  const calculateHealthScore = () => {
    if (!summary) return 0;
    if (summary.totalIncome === 0) return 0;

    const expenseRatio = summary.totalExpenses / summary.totalIncome;
    const balanceRatio = summary.balance / summary.totalIncome;

    let score = 100;
    
    // Penalize high expense ratio
    if (expenseRatio > 0.9) score -= 40;
    else if (expenseRatio > 0.8) score -= 30;
    else if (expenseRatio > 0.7) score -= 20;
    else if (expenseRatio > 0.6) score -= 10;

    // Reward savings
    if (balanceRatio > 0.3) score += 20;
    else if (balanceRatio > 0.2) score += 15;
    else if (balanceRatio > 0.1) score += 10;
    else if (balanceRatio > 0) score += 5;

    // Penalize negative balance
    if (summary.balance < 0) score -= 30;

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const trendData = getExpenseTrendData();
  const pieData = getCategoryPieData();
  const barData = getIncomeVsExpensesData();
  const healthScore = calculateHealthScore();

  const getHealthColor = (score: number) => {
    if (score >= 80) return ['#10B981', '#059669'];
    if (score >= 60) return ['#F59E0B', '#D97706'];
    return ['#EF4444', '#DC2626'];
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Financial Health Card */}
        {summary && (
          <LinearGradient
            colors={getHealthColor(healthScore) as any}
            style={styles.healthCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.healthContent}>
              <View style={styles.healthHeader}>
                <View style={styles.healthIconContainer}>
                  <Ionicons name="trending-up" size={32} color={theme.colors.textInverse} />
                </View>
                <View style={styles.healthTextContainer}>
                  <Text style={styles.healthTitle}>صحة مالية</Text>
                  <Text style={styles.healthScore}>{healthScore}</Text>
                  <Text style={styles.healthLabel}>من 100</Text>
                </View>
              </View>
              <View style={styles.healthStats}>
                <View style={styles.healthStatItem}>
                  <Text style={styles.healthStatLabel}>الدخل</Text>
                  <Text style={styles.healthStatValue}>{formatCurrency(summary.totalIncome)}</Text>
                </View>
                <View style={styles.healthStatDivider} />
                <View style={styles.healthStatItem}>
                  <Text style={styles.healthStatLabel}>المصاريف</Text>
                  <Text style={styles.healthStatValue}>{formatCurrency(summary.totalExpenses)}</Text>
                </View>
                <View style={styles.healthStatDivider} />
                <View style={styles.healthStatItem}>
                  <Text style={styles.healthStatLabel}>الرصيد</Text>
                  <Text style={[
                    styles.healthStatValue,
                    { color: summary.balance >= 0 ? '#10B981' : '#EF4444' }
                  ]}>
                    {formatCurrency(summary.balance)}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Insights Cards */}
        {insights.length > 0 && (
          <View style={styles.insightsContainer}>
            <Text style={styles.sectionTitle}>رؤى مالية</Text>
            {insights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <Ionicons name="bulb" size={20} color={theme.colors.primary} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Expense Trend Chart */}
        {trendData && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>اتجاه المصاريف (آخر 7 أيام)</Text>
            <LineChart
              data={trendData}
              width={width - 48}
              height={220}
              chartConfig={{
                backgroundColor: theme.colors.surfaceCard,
                backgroundGradientFrom: theme.colors.surfaceCard,
                backgroundGradientTo: theme.colors.surfaceCard,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                labelColor: () => theme.colors.textSecondary,
                style: {
                  borderRadius: theme.borderRadius.lg
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#EF4444'
                }
              }}
              bezier
              style={styles.chart}
            />
          </View>
        )}

        {/* Income vs Expenses Bar Chart */}
        {barData && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>الدخل مقابل المصاريف (هذا الشهر)</Text>
            <BarChart
              data={barData}
              width={width - 48}
              height={220}
              chartConfig={{
                backgroundColor: theme.colors.surfaceCard,
                backgroundGradientFrom: theme.colors.surfaceCard,
                backgroundGradientTo: theme.colors.surfaceCard,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                labelColor: () => theme.colors.textSecondary,
                style: {
                  borderRadius: theme.borderRadius.lg
                },
              }}
              style={styles.chart}
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        )}

        {/* Category Pie Chart */}
        {pieData && pieData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>توزيع المصاريف حسب الفئة</Text>
            <PieChart
              data={pieData}
              width={width - 48}
              height={220}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              style={styles.chart}
            />
          </View>
        )}

        {/* Top Categories List */}
        {summary?.topExpenseCategories && summary.topExpenseCategories.length > 0 && (
          <View style={styles.categoriesCard}>
            <Text style={styles.chartTitle}>أعلى الفئات</Text>
            {summary.topExpenseCategories.map((item: any, index: number) => {
              const categoryName = EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] || 
                                  customCategories.find(c => c.name === item.category)?.name || 
                                  item.category;
              return (
                <View key={index} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <View style={[styles.categoryColor, { backgroundColor: pieData?.[index]?.color || '#6B7280' }]} />
                    <Text style={styles.categoryName}>{categoryName}</Text>
                  </View>
                  <View style={styles.categoryAmount}>
                    <Text style={styles.categoryAmountText}>{formatCurrency(item.amount)}</Text>
                    <Text style={styles.categoryPercentage}>{item.percentage.toFixed(1)}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
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
    paddingBottom: theme.spacing.xxl,
    direction: 'rtl',
  },
  healthCard: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  healthContent: {
    padding: theme.spacing.lg,
  },
  healthHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  healthIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  healthTextContainer: {
    flex: 1,
  },
  healthTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '600',
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  healthScore: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  healthLabel: {
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  healthStats: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  healthStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  healthStatLabel: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  healthStatValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  healthStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.sm,
  },
  insightsContainer: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  insightCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  insightText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  chartCard: {
    backgroundColor: theme.colors.surfaceCard,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  chartTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily,
  },
  chart: {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  categoriesCard: {
    backgroundColor: theme.colors.surfaceCard,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  categoryItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  categoryColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
  },
  categoryAmount: {
    alignItems: 'flex-end',
  },
  categoryAmountText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '700',
  },
  categoryPercentage: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
  },
});
