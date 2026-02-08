import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import {
  generateFinancialInsights,
  comparePeriods,
  predictNextMonthExpenses,
  getMonthlyTrendData,
  getMonthData,
  getCurrentMonthData,
} from '../services/financialService';
import { useCurrency } from '../hooks/useCurrency';
import { EXPENSE_CATEGORIES } from '../types';
import { getCustomCategories } from '../database/database';
import { MonthFilter } from '../components/MonthFilter';
import { formatDateLocal } from '../utils/date';

const { width } = Dimensions.get('window');

export const InsightsScreen = ({ navigation }: any) => {
  const { formatCurrency } = useCurrency();
  const [summary, setSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [predictionData, setPredictionData] = useState<any>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);

  // Period for comparison (Current vs Previous Month by default)
  const [selectedPeriod1, setSelectedPeriod1] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedPeriod2, setSelectedPeriod2] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return { year: prevYear, month: prevMonth };
  });

  // Main month filter - default to current month
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  const loadData = async () => {
    try {
      // Get available months
      const { getExpenses, getIncome } = await import('../database/database');
      const allExpenses = await getExpenses();
      const allIncome = await getIncome();

      const monthsSet = new Set<string>();
      [...allExpenses, ...allIncome].forEach(item => {
        const [year, month] = item.date.split('-');
        if (year && month) {
          monthsSet.add(`${year}-${parseInt(month)}`);
        }
      });

      const months = Array.from(monthsSet).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month };
      });
      setAvailableMonths(months);

      // Load Month Data
      let monthData;
      if (selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0)) {
        monthData = await getMonthData(selectedMonth.year, selectedMonth.month);
      } else {
        monthData = await getCurrentMonthData();
      }

      // Calculate summary
      const monthIncome = monthData.totalIncome;
      const monthExpenses = monthData.totalExpenses;
      const monthBalance = monthData.balance;

      const financialSummary: any = {
        totalIncome: monthIncome,
        totalExpenses: monthExpenses,
        balance: monthBalance,
        topExpenseCategories: monthData.topExpenseCategories,
      };

      setSummary(financialSummary);
      setMonthlyData(monthData);

      // Insights
      const financialInsights = generateFinancialInsights(financialSummary);
      setInsights(financialInsights);

      // Categories
      const customCats = await getCustomCategories('expense');
      setCustomCategories(customCats);

      // Prediction
      const prediction = await predictNextMonthExpenses(3);
      setPredictionData(prediction);

      // Trend
      const trend = await getMonthlyTrendData(6);
      setMonthlyTrend(trend);

      // Comparison
      if (showComparison) {
        const comparison = await comparePeriods(selectedPeriod1, selectedPeriod2);
        setComparisonData(comparison);
      }
    } catch (error) {
      console.error('Error loading insights data:', error);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, selectedMonth, showComparison]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const calculateHealthScore = () => {
    if (!summary) return 0;
    if (summary.totalIncome === 0) return 0;

    const expenseRatio = summary.totalExpenses / summary.totalIncome;
    const balanceRatio = summary.balance / summary.totalIncome;

    let score = 100;
    // Basic scoring logic
    if (expenseRatio > 0.9) score -= 40;
    else if (expenseRatio > 0.8) score -= 30;
    else if (expenseRatio > 0.7) score -= 20;
    else if (expenseRatio > 0.6) score -= 10;
    else if (expenseRatio <= 0.5) score += 5;

    if (balanceRatio > 0.3) score += 20;
    else if (balanceRatio > 0.2) score += 15;
    else if (balanceRatio > 0.1) score += 10;
    else if (balanceRatio > 0) score += 5;

    if (summary.balance < 0) score -= 30;

    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return ['#10B981', '#059669']; // Emerald
    if (score >= 60) return ['#F59E0B', '#D97706']; // Amber
    return ['#EF4444', '#DC2626']; // Red
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'ممتاز';
    if (score >= 60) return 'جيد';
    if (score >= 40) return 'متوسط';
    return 'يحتاج تحسين';
  };

  const healthScore = calculateHealthScore();
  const healthColors = getHealthColor(healthScore);

  // --- Charts Data Helpers ---
  const getExpenseTrendData = () => {
    if (!monthlyData?.expenses) return null;
    // Logic to show last 7 days of SELECTED MONTH or relative if current
    // Simplification: showing aggregate by day for the selected month data loaded
    // But monthlyData loaded assumes range. Let's filter distinct dates from loaded expenses.

    // Group by date
    const dailyMap = new Map<string, number>();
    monthlyData.expenses.forEach((e: any) => {
      const current = dailyMap.get(e.date) || 0;
      dailyMap.set(e.date, current + e.amount);
    });

    // Sort dates
    const sortedDates = Array.from(dailyMap.keys()).sort().slice(-7); // Last 7 active days or just limit

    if (sortedDates.length === 0) return null;

    return {
      labels: sortedDates.map(d => {
        const dateObj = new Date(d);
        return `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      }),
      datasets: [{
        data: sortedDates.map(d => dailyMap.get(d) || 0),
        color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
        strokeWidth: 3
      }]
    };
  };

  const getCategoryPieData = () => {
    if (!summary?.topExpenseCategories || summary.topExpenseCategories.length === 0) return null;
    const palette = [
      '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#10B981', '#06B6D4', '#6B7280'
    ];
    return summary.topExpenseCategories.map((item: any, index: number) => {
      const categoryName = EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] ||
        customCategories.find(c => c.name === item.category)?.name || item.category;

      return {
        name: categoryName,
        amount: item.amount,
        color: palette[index % palette.length],
        legendFontColor: theme.colors.textPrimary,
        legendFontSize: 12,
      };
    }).filter((i: any) => i.amount > 0);
  };

  // --- Chart Config ---
  const chartConfig = {
    backgroundColor: theme.colors.surfaceCard,
    backgroundGradientFrom: theme.colors.surfaceCard,
    backgroundGradientTo: theme.colors.surfaceCard,
    decimalPlaces: 0,
    color: (opacity = 1) => theme.colors.primary,
    labelColor: (opacity = 1) => theme.colors.textSecondary,
    style: { borderRadius: 16 },
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: theme.colors.surfaceCard
    },
    propsForBackgroundLines: {
      strokeDasharray: "4", // Dashed lines
      stroke: theme.colors.border + '80'
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Area */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>التحليل المالي</Text>
          <Text style={styles.headerSubtitle}>نظرة شاملة على أدائك المالي</Text>
        </View>
        <MonthFilter
          selectedMonth={selectedMonth}
          onMonthChange={(year, month) => setSelectedMonth({ year, month })}
          availableMonths={availableMonths}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Health Score Card */}
        {summary && (
          <LinearGradient
            colors={healthColors as any}
            style={styles.healthCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.healthHeader}>
              <View>
                <Text style={styles.healthLabelText}>مؤشر الصحة المالية</Text>
                <Text style={styles.healthValueText}>{getHealthLabel(healthScore)}</Text>
              </View>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreText}>{healthScore}</Text>
                <Text style={styles.scoreSubText}>/100</Text>
              </View>
            </View>

            <View style={styles.healthStatsContainer}>
              <View style={styles.healthStat}>
                <Text style={styles.healthStatLabel}>الدخل</Text>
                <Text style={styles.healthStatValue}>{formatCurrency(summary.totalIncome)}</Text>
              </View>
              <View style={styles.healthDivider} />
              <View style={styles.healthStat}>
                <Text style={styles.healthStatLabel}>المصاريف</Text>
                <Text style={styles.healthStatValue}>{formatCurrency(summary.totalExpenses)}</Text>
              </View>
              <View style={styles.healthDivider} />
              <View style={styles.healthStat}>
                <Text style={styles.healthStatLabel}>الفائض</Text>
                <Text style={styles.healthStatValue}>{formatCurrency(summary.balance)}</Text>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* 2. Insights Messages */}
        {insights.length > 0 && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bulb" size={20} color={theme.colors.warning} />
              <Text style={styles.sectionTitle}>رؤى وتوصيات</Text>
            </View>
            {insights.map((msg, index) => (
              <View key={index} style={styles.insightCard}>
                <View style={styles.insightIconBar} />
                <Text style={styles.insightText}>{msg}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 3. Expense Trend Chart */}
        {getExpenseTrendData() && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>نشاط المصاريف</Text>
              <Ionicons name="trending-down-outline" size={20} color={theme.colors.error} />
            </View>
            <LineChart
              data={getExpenseTrendData()!}
              width={width - 48} // Padding adjustments
              height={220}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
              }}
              bezier
              style={styles.chartStyle}
              withDots={true}
              withInnerLines={true}
            />
          </View>
        )}

        {/* 4. Category Breakdown */}
        {getCategoryPieData() && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>توزيع الإنفاق</Text>
              <Ionicons name="pie-chart-outline" size={20} color={theme.colors.primary} />
            </View>
            <PieChart
              data={getCategoryPieData()!}
              width={width - 48}
              height={200}
              chartConfig={chartConfig}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute
              hasLegend={true}
            />
          </View>
        )}

        {/* 5. Prediction Card */}
        {predictionData && (
          <View style={styles.chartCard}>
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.predictionContainer}
            >
              <View style={styles.predictionHeader}>
                <Ionicons name="analytics-outline" size={24} color={theme.colors.primary} />
                <View>
                  <Text style={styles.predictionTitle}>توقعات الشهر القادم</Text>
                  <Text style={styles.predictionSubtitle}>بناءً على عاداتك الشرائية</Text>
                </View>
              </View>
              <View style={styles.predictionValueParams}>
                <Text style={styles.predictionValue}>{formatCurrency(predictionData.predictedTotal)}</Text>
                <View style={[styles.confidenceBadge, {
                  backgroundColor: predictionData.confidence === 'high' ? '#D1FAE5' : '#FEF3C7'
                }]}>
                  <Text style={[styles.confidenceText, {
                    color: predictionData.confidence === 'high' ? '#065F46' : '#92400E'
                  }]}>
                    {predictionData.confidence === 'high' ? 'دقة عالية' : 'دقة متوسطة'}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* 6. Comparison Toggle */}
        <TouchableOpacity
          style={styles.comparisonButton}
          activeOpacity={0.8}
          onPress={() => {
            setShowComparison(!showComparison);
            if (!showComparison) loadData(); // Load comparisons if opening
          }}
        >
          <Text style={styles.comparisonButtonText}>
            {showComparison ? 'إخفاء المقارنة' : 'مقارنة مع الشهر السابق'}
          </Text>
          <Ionicons name={showComparison ? "chevron-up" : "chevron-down"} size={20} color="#FFF" />
        </TouchableOpacity>

        {showComparison && comparisonData && (
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonHeader}>
              <Text style={styles.comparisonTitle}>مقارنة الأداء</Text>
            </View>

            {/* Income Change */}
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonLabelBox}>
                <Ionicons name="arrow-up-circle-outline" size={18} color={theme.colors.success} />
                <Text style={styles.comparisonLabel}>الدخل</Text>
              </View>
              <View style={styles.comparisonValueBox}>
                <Text style={styles.comparisonValueMain}>
                  {comparisonData.incomeChange > 0 ? '+' : ''}{formatCurrency(comparisonData.incomeChange)}
                </Text>
                <Text style={[styles.comparisonPercent, { color: Number(comparisonData.incomeChangePercent) >= 0 ? theme.colors.success : theme.colors.error }]}>
                  {comparisonData.incomeChangePercent}%
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Expense Change */}
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonLabelBox}>
                <Ionicons name="arrow-down-circle-outline" size={18} color={theme.colors.error} />
                <Text style={styles.comparisonLabel}>المصاريف</Text>
              </View>
              <View style={styles.comparisonValueBox}>
                <Text style={styles.comparisonValueMain}>
                  {comparisonData.expensesChange > 0 ? '+' : ''}{formatCurrency(comparisonData.expensesChange)}
                </Text>
                <Text style={[styles.comparisonPercent, { color: Number(comparisonData.expensesChangePercent) <= 0 ? theme.colors.success : theme.colors.error }]}>
                  {comparisonData.expensesChangePercent}%
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 10,
    backgroundColor: theme.colors.background,
    // Using default flex direction, then reversing in children based on language if needed
  },
  headerTitleContainer: {
    marginBottom: 15,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Health Card
  healthCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  healthHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  healthLabelText: {
    fontFamily: theme.typography.fontFamily,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: isRTL ? 'right' : 'left',
  },
  healthValueText: {
    fontFamily: theme.typography.fontFamily,
    color: '#FFF',
    fontSize: 24,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: isRTL ? 'right' : 'left',
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  scoreText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  scoreSubText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontFamily: theme.typography.fontFamily,
  },
  healthStatsContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
  },
  healthStat: {
    alignItems: 'center',
    flex: 1,
  },
  healthStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily,
  },
  healthStatValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  healthDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
  },
  // Insights Section
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  insightCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    ...getPlatformShadow('sm'),
    borderLeftWidth: isRTL ? 0 : 4,
    borderRightWidth: isRTL ? 4 : 0,
    borderLeftColor: theme.colors.primary,
    borderRightColor: theme.colors.primary,
  },
  insightIconBar: {
    // Replaced by border
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
    lineHeight: 20,
    textAlign: isRTL ? 'right' : 'left',
  },
  // Charts
  chartCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    ...getPlatformShadow('sm'),
  },
  chartHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
  // Prediction
  predictionContainer: {
    borderRadius: 16,
  },
  predictionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    marginBottom: 12,
  },
  predictionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
  },
  predictionSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    textAlign: isRTL ? 'right' : 'left',
  },
  predictionValueParams: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 12,
  },
  predictionValue: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  // Comparison
  comparisonButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 8,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  comparisonButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  comparisonCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    padding: 20,
    ...getPlatformShadow('md'),
  },
  comparisonHeader: {
    marginBottom: 16,
  },
  comparisonTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: isRTL ? 'right' : 'left',
    color: theme.colors.textPrimary,
  },
  comparisonRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  comparisonLabelBox: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
  },
  comparisonValueBox: {
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  comparisonValueMain: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  comparisonPercent: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 8,
  },
});
