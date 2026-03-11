import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  InteractionManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
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
import { EXPENSE_CATEGORIES, INCOME_SOURCES, FinancialInsight } from '../types';
import { getCustomCategories, getAvailableMonths } from '../database/database';
import { MonthFilter } from '../components/MonthFilter';
import { BalanceCard } from '../components/BalanceCard';
import { formatDateLocal } from '../utils/date';

const { width } = Dimensions.get('window');

const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant',
  transport: 'car',
  shopping: 'cart',
  bills: 'receipt',
  health: 'medical',
  education: 'school',
  entertainment: 'game-controller',
  other: 'ellipsis-horizontal',
  salary: 'cash',
  business: 'briefcase',
  gift: 'gift',
  investment: 'trending-up',
  // Arabic keys support
  'طعام': 'restaurant',
  'مواصلات': 'car',
  'تسوق': 'bag',
  'فواتير': 'receipt',
  'ترفيه': 'musical-notes',
  'صحة': 'medical',
  'تعليم': 'school',
  'أخرى': 'ellipse',
  'راتب': 'cash',
  'تجارة': 'briefcase',
  'استثمار': 'trending-up',
  'هدية': 'gift',
};

const INCOME_SOURCES_LIST = INCOME_SOURCES;

export const InsightsScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const [summary, setSummary] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [predictionData, setPredictionData] = useState<any>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'expenses' | 'income'>('expenses');

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
      // Query available months directly from SQLite instead of loading all rows.
      const months = await getAvailableMonths();
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

      // Calculate expense categories manually for consistency
      const expenseCategoryMap = new Map<string, number>();
      (monthData.expenses || []).forEach((item: any) => {
        const current = expenseCategoryMap.get(item.category) || 0;
        expenseCategoryMap.set(item.category, current + item.amount);
      });

      const topExpenseCategories = Array.from(expenseCategoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: monthExpenses > 0 ? (amount / monthExpenses) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      // Calculate income categories
      const incomeCategoryMap = new Map<string, number>();
      (monthData.income || []).forEach((item: any) => {
        const current = incomeCategoryMap.get(item.category) || 0;
        incomeCategoryMap.set(item.category, current + item.amount);
      });

      const topIncomeCategories = Array.from(incomeCategoryMap.entries())
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: monthIncome > 0 ? (amount / monthIncome) * 100 : 0
        }))
        .sort((a, b) => b.amount - a.amount);

      const financialSummary: any = {
        totalIncome: monthIncome,
        totalExpenses: monthExpenses,
        balance: monthBalance,
        topExpenseCategories,
        topIncomeCategories,
        billsDueTotal: monthData.billsDueTotal ?? 0,
        recurringEstimatedTotal: monthData.recurringEstimatedTotal ?? 0,
        totalObligations: monthData.totalObligations ?? monthExpenses,
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

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadData();
      });
      return () => task.cancel();
    }, [selectedMonth, showComparison])
  );

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
    (monthlyData.expenses || []).forEach((e: any) => {
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
        color: (opacity = 1) => theme.colors.error,
        strokeWidth: 3
      }]
    };
  };

  const CATEGORY_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // green
    '#EF4444', // red
    '#F59E0B', // amber
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#84CC16', // lime
  ];

  const getCategoryPieData = () => {
    if (!summary) return [];

    const categories = activeTab === 'expenses' ? summary.topExpenseCategories : summary.topIncomeCategories;
    const total = activeTab === 'expenses' ? summary.totalExpenses : summary.totalIncome;

    if (!categories || categories.length === 0 || total === 0) return [];

    return categories
      .filter((c: any) => c.amount > 0)
      .slice(0, 5)
      .map((c: any, index: number) => ({
        name: EXPENSE_CATEGORIES[c.category as keyof typeof EXPENSE_CATEGORIES] ||
          INCOME_SOURCES_LIST[c.category as keyof typeof INCOME_SOURCES_LIST] ||
          c.category,
        amount: c.amount,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        legendFontColor: '#FFFFFF',
        legendFontSize: 12,
      }));
  };

  // --- Chart Config ---
  const chartConfig = {
    backgroundColor: theme.colors.surfaceCard,
    backgroundGradientFrom: theme.colors.surfaceCard,
    backgroundGradientTo: theme.colors.surfaceCard,
    decimalPlaces: 0,
    color: (opacity = 1) => theme.colors.primary,
    labelColor: (opacity = 1) => '#FFFFFF',
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
    <SafeAreaView style={styles.container} edges={['left', 'right']}>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Filter Section */}
        <View style={{ marginBottom: 20 }}>
          <MonthFilter
            selectedMonth={selectedMonth}
            onMonthChange={(year, month) => setSelectedMonth({ year, month })}
            availableMonths={availableMonths}
          />
        </View>

        {/* 0. Financial Health & Actions */}
        <View style={styles.healthActionContainer}>
          <View style={styles.healthScoreRow}>
            <LinearGradient
              colors={healthColors as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.healthScoreCard}
            >
              <View style={styles.healthScoreInfo}>
                <Text style={styles.healthScoreLabel}>مؤشر الصحة المالية</Text>
                <Text style={styles.healthScoreValue}>{healthScore}%</Text>
                <Text style={styles.healthScoreStatus}>{getHealthLabel(healthScore)}</Text>
              </View>
              <View style={styles.healthScoreGauge}>
                <View style={styles.gaugeBackground}>
                  <View style={[styles.gaugeFill, { height: `${healthScore}%`, backgroundColor: '#FFF' }]} />
                </View>
              </View>
            </LinearGradient>

            <View style={styles.savingsRateMiniCard}>
              <View style={[styles.actionIconCircle, { backgroundColor: theme.colors.success + '15', marginBottom: 4, width: 32, height: 32 }]}>
                <Ionicons name="leaf" size={16} color={theme.colors.success} />
              </View>
              <Text style={styles.savingsLabel}>معدل الادخار</Text>
              <Text style={[styles.savingsValue, { color: theme.colors.success }]}>
                {summary?.totalIncome > 0 ? Math.round((summary.balance / summary.totalIncome) * 100) : 0}%
              </Text>
              <Text style={styles.savingsSubtext}>من إجمالي الدخل</Text>
            </View>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => {
                // Implementation for PDF export
                console.log('Exporting PDF');
              }}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.colors.info + '15' }]}>
                <Ionicons name="document-text" size={20} color={theme.colors.info} />
              </View>
              <Text style={styles.actionBtnLabel}>تصدير PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate('AISmartInsights')}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.colors.primary + '15' }]}>
                <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.actionBtnLabel}>استشارة AI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => {
                // Future implementation for CSV
                console.log('Exporting CSV');
              }}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.colors.success + '15' }]}>
                <Ionicons name="share-social" size={20} color={theme.colors.success} />
              </View>
              <Text style={styles.actionBtnLabel}>مشاركة</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. Summary Card with Donut Chart */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summarySubtitle}>{activeTab === 'expenses' ? 'إجمالي المصاريف' : 'إجمالي الدخل'}</Text>
              <Text style={[styles.summaryTitle, { color: activeTab === 'expenses' ? theme.colors.error : theme.colors.success }]}>
                {formatCurrency(activeTab === 'expenses' ? summary?.totalExpenses || 0 : summary?.totalIncome || 0)}
              </Text>
            </View>
            <View style={styles.monthBadge}>
              <Text style={styles.monthBadgeText}>
                {selectedMonth.month}/{selectedMonth.year}
              </Text>
            </View>
          </View>

          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'expenses' && styles.activeTabExpenses]}
              onPress={() => setActiveTab('expenses')}
            >
              <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>المصاريف</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'income' && styles.activeTabIncome]}
              onPress={() => setActiveTab('income')}
            >
              <Text style={[styles.tabText, activeTab === 'income' && styles.activeTabText]}>الدخل</Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const pieData = getCategoryPieData();
            if (pieData.length === 0) return (
              <View style={styles.noDataContainer}>
                <Ionicons name="stats-chart-outline" size={48} color={theme.colors.textMuted} />
                <Text style={styles.noDataText}>لا توجد بيانات لهذا الشهر</Text>
              </View>
            );

            const total = activeTab === 'expenses' ? summary?.totalExpenses : summary?.totalIncome;

            return (
              <View style={styles.donutContainer}>
                <View style={styles.pieWrapper}>
                  <PieChart
                    data={pieData}
                    width={width * 0.8}
                    height={200}
                    chartConfig={chartConfig}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft={(width * 0.2).toString()}
                    hasLegend={false}
                    absolute
                  />
                  <View style={styles.donutCenter}>
                    <Text style={styles.donutCenterLabel}>المجموع</Text>
                    <Text style={styles.donutCenterValue}>{formatCurrency(total || 0)}</Text>
                  </View>
                </View>

                <View style={styles.legendContainer}>
                  {pieData.map((item: any, index: number) => (
                    <View key={index} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendText}>{item.name}</Text>
                      <Text style={styles.legendValue}>{Math.round((item.amount / total) * 100)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>

        {/* 2. Insights Recommendations */}
        {insights && insights.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={[styles.sectionHeader, { marginBottom: 12 }]}>
              <Text style={styles.sectionTitle}>رؤى وتوصيات مالية</Text>
              <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScroll}>
              {insights.map((insight, index) => {
                const getInsightStyle = () => {
                  switch (insight.type) {
                    case 'warning': return { bg: theme.colors.error + '10', icon: 'warning', color: theme.colors.error };
                    case 'success': return { bg: theme.colors.success + '10', icon: 'checkmark-circle', color: theme.colors.success };
                    case 'tip': return { bg: theme.colors.info + '10', icon: 'bulb', color: theme.colors.info };
                    case 'goal': return { bg: theme.colors.primary + '10', icon: 'flag', color: theme.colors.primary };
                    default: return { bg: theme.colors.warning + '10', icon: 'information-circle', color: theme.colors.warning };
                  }
                };
                const style = getInsightStyle();

                return (
                  <View key={index} style={[styles.insightProCard, { borderLeftColor: style.color }]}>
                    <View style={styles.insightProHeader}>
                      <View style={[styles.insightIconSmall, { backgroundColor: style.bg }]}>
                        <Ionicons name={style.icon as any} size={14} color={style.color} />
                      </View>
                      <Text style={[styles.insightProTitle, { color: style.color }]}>{insight.title}</Text>
                    </View>
                    <Text style={styles.insightProContent}>{insight.content}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 3. Detailed Category List */}
        <View style={styles.sectionContainer}>
          {/* <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{activeTab === 'expenses' ? 'تفاصيل المصاريف' : 'تفاصيل الدخل'}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AdvancedReports')}>
              <Text style={styles.seeAllText}>عرض الكل</Text>
            </TouchableOpacity>
          </View> */}

          {(activeTab === 'expenses' ? summary?.topExpenseCategories : summary?.topIncomeCategories)?.filter((item: any) => item.amount > 0).map((item: any, index: number) => {
            const categoryName = activeTab === 'expenses'
              ? (EXPENSE_CATEGORIES[item.category as keyof typeof EXPENSE_CATEGORIES] || customCategories.find((c: any) => c.name === item.category)?.name || item.category)
              : (INCOME_SOURCES_LIST[item.category as keyof typeof INCOME_SOURCES_LIST] || item.category);

            const iconName = CATEGORY_ICONS[item.category] || (activeTab === 'expenses' ? 'wallet-outline' : 'cash-outline');
            const total = activeTab === 'expenses' ? summary.totalExpenses : summary.totalIncome;
            const percentage = total > 0 ? (item.amount / total) : 0;
            const catColor = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

            return (
              <TouchableOpacity key={index} style={styles.premiumCategoryCard}>
                <View style={[styles.premiumIconBox, { backgroundColor: catColor + '15' }]}>
                  <Ionicons name={iconName as any} size={22} color={catColor} />
                </View>
                <View style={styles.premiumCategoryInfo}>
                  <View style={styles.premiumCategoryHeader}>
                    <Text style={styles.premiumCategoryName}>{categoryName}</Text>
                    <Text style={styles.premiumCategoryAmount}>{formatCurrency(item.amount)}</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${percentage * 100}%`, backgroundColor: catColor }]} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. Comparison Activity Chart */}
        {monthlyTrend && monthlyTrend.length > 0 && (
          <View style={styles.chartCardPremium}>
            <View style={styles.chartHeaderAction}>
              <Text style={styles.chartTitlePremium}>مقارنة النشاط</Text>
              <View style={styles.chartLegendRow}>
                <View style={[styles.chartLegendDot, { backgroundColor: theme.colors.success }]} />
                <Text style={styles.chartLegendText}>الدخل</Text>
                <View style={[styles.chartLegendDot, { backgroundColor: theme.colors.error, marginLeft: 12 }]} />
                <Text style={styles.chartLegendText}>المصاريف</Text>
              </View>
            </View>
            <LineChart
              data={{
                labels: monthlyTrend.map(t => t.month),
                datasets: [
                  {
                    data: monthlyTrend.map(t => t.totalIncome),
                    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                    strokeWidth: 3
                  },
                  {
                    data: monthlyTrend.map(t => t.totalExpenses),
                    color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                    strokeWidth: 3
                  }
                ]
              }}
              width={width - 64} // 32 for screen + 32 for card padding
              height={220}
              chartConfig={{
                ...chartConfig,
                backgroundGradientFrom: theme.colors.surfaceCard,
                backgroundGradientTo: theme.colors.surfaceCard,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => theme.colors.textSecondary,
                style: { borderRadius: 16 },
                propsForDots: { r: "5", strokeWidth: "2", stroke: theme.colors.surfaceCard }
              }}
              bezier={monthlyTrend.length >= 3}
              fromZero
              style={styles.chartStylePremium}
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
                  backgroundColor: predictionData.confidence === 'high' ? theme.colors.success + '20' : theme.colors.warning + '20'
                }]}>
                  <Text style={[styles.confidenceText, {
                    color: predictionData.confidence === 'high' ? theme.colors.success : theme.colors.warning
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
          <Ionicons name={showComparison ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.background} />
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
    </SafeAreaView >
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  // Health & Actions
  healthActionContainer: {
    marginBottom: 24,
  },
  healthScoreCard: {
    flex: 1.8,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...getPlatformShadow('md'),
  },
  healthScoreRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  savingsRateMiniCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  savingsLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    textAlign: 'center',
  },
  savingsValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily,
  },
  savingsSubtext: {
    fontSize: 9,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    textAlign: 'center',
  },
  healthScoreInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  healthScoreLabel: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  healthScoreValue: {
    fontSize: theme.typography.sizes.display,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  healthScoreStatus: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  healthScoreGauge: {
    width: 60,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeBackground: {
    width: 8,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  gaugeFill: {
    width: '100%',
    borderRadius: 4,
  },
  quickActionsGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: theme.colors.surfaceCard,
    padding: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  // Summary Card
  summaryCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  summaryHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  summarySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily,
  },
  monthBadge: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  monthBadgeText: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  // Tab Switcher
  tabSwitcher: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTabExpenses: {
    backgroundColor: theme.colors.error,
  },
  activeTabIncome: {
    backgroundColor: theme.colors.success,
  },
  tabText: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  // Donut Chart
  donutContainer: {
    alignItems: 'center',
  },
  pieWrapper: {
    width: width * 0.8,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  donutCenterValue: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  legendContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  legendRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  // Insights
  insightsScroll: {
    marginBottom: 24,
    direction: isRTL ? 'rtl' : 'ltr',
  },
  insightProCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    marginLeft: isRTL ? 0 : 4,
    marginVertical: 4,
    width: 240,
    borderLeftWidth: 4,
    ...getPlatformShadow('sm'),
  },
  insightProHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  insightIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightProTitle: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  insightProContent: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  // Premium Category List
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  seeAllText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  premiumCategoryCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
    ...getPlatformShadow('sm'),
  },
  premiumIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCategoryInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  premiumCategoryHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  premiumCategoryName: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  premiumCategoryAmount: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Charts Premium
  chartCardPremium: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  chartHeaderAction: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  chartTitlePremium: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  chartLegendRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: isRTL ? 0 : 6,
    marginLeft: isRTL ? 6 : 0,
  },
  chartLegendText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  chartStylePremium: {
    marginVertical: 8,
    borderRadius: 16,
  },
  // Prediction & Comparison
  predictionContainer: {
    padding: 16,
    borderRadius: 20,
  },
  predictionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    marginBottom: 12,
  },
  predictionTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  predictionSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  predictionValueParams: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceLight,
    padding: 12,
    borderRadius: 14,
  },
  predictionValue: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  comparisonButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  comparisonButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  comparisonCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  comparisonHeader: {
    marginBottom: 20,
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  comparisonRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  comparisonLabelBox: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 10,
  },
  comparisonLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  comparisonValueBox: {
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  comparisonValueMain: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  comparisonPercent: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  chartCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
});
