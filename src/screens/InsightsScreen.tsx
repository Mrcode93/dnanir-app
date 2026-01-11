import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  I18nManager,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FAB } from 'react-native-paper';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { calculateFinancialSummary, getCurrentMonthData, generateFinancialInsights } from '../services/financialService';
import { useCurrency } from '../hooks/useCurrency';
import { EXPENSE_CATEGORIES } from '../types';
import { getCustomCategories } from '../database/database';

const { width } = Dimensions.get('window');

export const InsightsScreen = ({ navigation }: any) => {
  const { formatCurrency } = useCurrency();
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
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>الرؤى المالية</Text>
            <Text style={styles.headerSubtitle}>تحليل شامل لأدائك المالي</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('AdvancedReports')}
            style={styles.advancedReportsButton}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={theme.gradients.primary as any}
              style={styles.advancedReportsButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="document-text" size={18} color={theme.colors.textInverse} />
              <Text style={styles.advancedReportsButtonText}>تقارير متقدمة</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {/* Financial Health Card */}
        {summary && (
          <View style={styles.healthCardWrapper}>
            <LinearGradient
              colors={getHealthColor(healthScore) as any}
              style={styles.healthCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.healthContent}>
                <View style={styles.healthHeader}>
                  <View style={styles.healthIconContainer}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.15)']}
                      style={styles.healthIconGradient}
                    >
                      <Ionicons 
                        name={healthScore >= 80 ? "checkmark-circle" : healthScore >= 60 ? "warning" : "alert-circle"} 
                        size={32} 
                        color={theme.colors.textInverse} 
                      />
                    </LinearGradient>
                  </View>
                  <View style={styles.healthTextContainer}>
                    <Text style={styles.healthTitle}>صحة مالية</Text>
                    <View style={styles.healthScoreContainer}>
                      <Text style={styles.healthScore}>{healthScore}</Text>
                      <Text style={styles.healthLabel}>/ 100</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.healthProgressBar}>
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.healthProgressFill,
                      { width: `${healthScore}%` },
                    ]}
                  />
                </View>
                <View style={styles.healthStats}>
                  <View style={styles.healthStatItem}>
                    <View style={styles.healthStatIconContainer}>
                      <Ionicons name="arrow-up-circle" size={20} color={theme.colors.textInverse} />
                    </View>
                    <Text style={styles.healthStatLabel}>الدخل</Text>
                    <Text style={styles.healthStatValue}>{formatCurrency(summary.totalIncome)}</Text>
                  </View>
                  <View style={styles.healthStatDivider} />
                  <View style={styles.healthStatItem}>
                    <View style={styles.healthStatIconContainer}>
                      <Ionicons name="arrow-down-circle" size={20} color={theme.colors.textInverse} />
                    </View>
                    <Text style={styles.healthStatLabel}>المصاريف</Text>
                    <Text style={styles.healthStatValue}>{formatCurrency(summary.totalExpenses)}</Text>
                  </View>
                  <View style={styles.healthStatDivider} />
                  <View style={styles.healthStatItem}>
                    <View style={styles.healthStatIconContainer}>
                      <Ionicons 
                        name={summary.balance >= 0 ? "wallet" : "alert-circle"} 
                        size={20} 
                        color={theme.colors.textInverse} 
                      />
                    </View>
                    <Text style={styles.healthStatLabel}>الرصيد</Text>
                    <Text style={[
                      styles.healthStatValue,
                      { color: summary.balance >= 0 ? theme.colors.textInverse : '#FFE5E5' }
                    ]}>
                      {formatCurrency(summary.balance)}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Insights Cards */}
        {insights.length > 0 && (
          <View style={styles.insightsContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <LinearGradient
                  colors={theme.gradients.info as any}
                  style={styles.sectionIconContainer}
                >
                  <Ionicons name="bulb" size={20} color={theme.colors.textInverse} />
                </LinearGradient>
                <Text style={styles.sectionTitle}>رؤى مالية</Text>
              </View>
            </View>
            {insights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <LinearGradient
                  colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                  style={styles.insightCardGradient}
                >
                  <View style={styles.insightIconWrapper}>
                    <LinearGradient
                      colors={theme.gradients.primary as any}
                      style={styles.insightIconContainer}
                    >
                      <Ionicons name="sparkles" size={18} color={theme.colors.textInverse} />
                    </LinearGradient>
                  </View>
                  <Text style={styles.insightText}>{insight}</Text>
                </LinearGradient>
              </View>
            ))}
          </View>
        )}

        {/* Expense Trend Chart */}
        {trendData && (
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.chartCard}
          >
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderLeft}>
                <LinearGradient
                  colors={theme.gradients.error as any}
                  style={styles.chartIconContainer}
                >
                  <Ionicons name="trending-down" size={18} color={theme.colors.textInverse} />
                </LinearGradient>
                <Text style={styles.chartTitle}>اتجاه المصاريف</Text>
              </View>
              <Text style={styles.chartSubtitle}>آخر 7 أيام</Text>
            </View>
            <LineChart
              data={trendData}
              width={width - 64}
              height={240}
              chartConfig={{
                backgroundColor: theme.colors.surfaceCard,
                backgroundGradientFrom: theme.colors.surfaceCard,
                backgroundGradientTo: theme.colors.surfaceCard,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                labelColor: () => theme.colors.textSecondary,
                strokeWidth: 3,
                barPercentage: 0.7,
                propsForDots: {
                  r: '6',
                  strokeWidth: '3',
                  stroke: '#FFFFFF',
                  fill: '#EF4444'
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: theme.colors.border,
                  strokeWidth: 1,
                }
              }}
              bezier
              style={styles.chart}
              withInnerLines={true}
              withOuterLines={false}
              withVerticalLabels={true}
              withHorizontalLabels={true}
            />
          </LinearGradient>
        )}

        {/* Income vs Expenses Bar Chart */}
        {barData && (
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.chartCard}
          >
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderLeft}>
                <LinearGradient
                  colors={theme.gradients.info as any}
                  style={styles.chartIconContainer}
                >
                  <Ionicons name="bar-chart" size={18} color={theme.colors.textInverse} />
                </LinearGradient>
                <Text style={styles.chartTitle}>الدخل مقابل المصاريف</Text>
              </View>
              <Text style={styles.chartSubtitle}>هذا الشهر</Text>
            </View>
            <BarChart
              data={barData}
              width={width - 64}
              height={240}
              chartConfig={{
                backgroundColor: theme.colors.surfaceCard,
                backgroundGradientFrom: theme.colors.surfaceCard,
                backgroundGradientTo: theme.colors.surfaceCard,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                labelColor: () => theme.colors.textSecondary,
                barPercentage: 0.6,
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: theme.colors.border,
                  strokeWidth: 1,
                }
              }}
              style={styles.chart}
              yAxisLabel=""
              yAxisSuffix=""
              withInnerLines={true}
              showValuesOnTopOfBars={true}
            />
          </LinearGradient>
        )}

        {/* Category Pie Chart */}
        {pieData && pieData.length > 0 && (
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.chartCard}
          >
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderLeft}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.chartIconContainer}
                >
                  <Ionicons name="pie-chart" size={18} color={theme.colors.textInverse} />
                </LinearGradient>
                <Text style={styles.chartTitle}>توزيع المصاريف</Text>
              </View>
              <Text style={styles.chartSubtitle}>حسب الفئة</Text>
            </View>
            <PieChart
              data={pieData}
              width={width - 64}
              height={240}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="amount"
              backgroundColor={theme.colors.surfaceCard}
              paddingLeft="15"
              style={styles.chart}
              absolute
            />
          </LinearGradient>
        )}

        {/* Top Categories List */}
        {summary?.topExpenseCategories && summary.topExpenseCategories.length > 0 && (
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.categoriesCard}
          >
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderLeft}>
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  style={styles.chartIconContainer}
                >
                  <Ionicons name="list" size={18} color={theme.colors.textInverse} />
                </LinearGradient>
                <Text style={styles.chartTitle}>أعلى الفئات</Text>
              </View>
            </View>
            {summary.topExpenseCategories.map((item: any, index: number) => {
              const categoryName = EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] || 
                                  customCategories.find(c => c.name === item.category)?.name || 
                                  item.category;
              const categoryColor = pieData?.[index]?.color || '#6B7280';
              return (
                <View key={index} style={styles.categoryItem}>
                  <View style={styles.categoryLeft}>
                    <View style={styles.categoryRank}>
                      <Text style={styles.categoryRankText}>#{index + 1}</Text>
                    </View>
                    <View style={[styles.categoryColor, { backgroundColor: categoryColor }]} />
                    <Text style={styles.categoryName}>{categoryName}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <View style={styles.categoryProgressBar}>
                      <LinearGradient
                        colors={[categoryColor, categoryColor]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.categoryProgressFill,
                          { width: `${item.percentage}%` },
                        ]}
                      />
                    </View>
                    <View style={styles.categoryAmount}>
                      <Text style={styles.categoryAmountText}>{formatCurrency(item.amount)}</Text>
                      <Text style={styles.categoryPercentage}>{item.percentage.toFixed(1)}%</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </LinearGradient>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    direction: 'rtl' as const,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.sm,

  },
  headerContent: {
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  advancedReportsButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  advancedReportsButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  advancedReportsButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    direction: 'ltr' as const,
  },
  healthCardWrapper: {
    marginBottom: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  healthCard: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  healthContent: {
    padding: theme.spacing.xl,
  },
  healthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  healthIconContainer: {
    marginLeft: theme.spacing.md,
  },
  healthIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  healthTextContainer: {
    flex: 1,
  },
  healthTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '600',
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  healthScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  healthScore: {
    fontSize: 56,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    letterSpacing: -1,
  },
  healthLabel: {
    fontSize: theme.typography.sizes.lg,
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    marginRight: theme.spacing.xs,
  },
  healthProgressBar: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  healthProgressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.round,
  },
  healthStats: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  healthStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  healthStatIconContainer: {
    marginBottom: theme.spacing.xs,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthStatLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  healthStatValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  healthStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: theme.spacing.sm,
  },
  insightsContainer: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  insightCard: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  insightCardGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  insightIconWrapper: {
    width: 40,
    height: 40,
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  insightText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    lineHeight: 24,
  },
  chartCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  chartHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  chartHeaderLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  chartIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  chartTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  chartSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  chart: {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    direction: 'rtl' as const,
  },
  categoriesCard: {
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
  categoryLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  categoryRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  categoryRankText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  categoryColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    ...theme.shadows.sm,
  },
  categoryName: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
    flex: 1,
  },
  categoryRight: {
    alignItems: 'flex-end',
    width: 120,
  },
  categoryProgressBar: {
    height: 6,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
    width: '100%',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.round,
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
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
});
