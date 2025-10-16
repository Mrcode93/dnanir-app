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
import { Card, Title, Paragraph, useTheme, Chip, FAB } from 'react-native-paper';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { Heart } from 'lucide-react-native';
import RTLText from '../components/RTLText';

import { FinancialSummary } from '../types';
import { calculateFinancialSummary, generateFinancialInsights, formatCurrency, getCurrentMonthData } from '../services/financialService';

const { width } = Dimensions.get('window');

const InsightsScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any>(null);

  const loadData = async () => {
    try {
      const financialSummary = await calculateFinancialSummary();
      setSummary(financialSummary);
      setInsights(generateFinancialInsights(financialSummary));
      
      const currentMonth = await getCurrentMonthData();
      setMonthlyData(currentMonth);
    } catch (error) {
      console.error('Error loading insights data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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
      labels: last7Days.map(date => new Date(date).toLocaleDateString('ar-IQ', { weekday: 'short' })),
      datasets: [{
        data: dailyExpenses,
        color: (opacity = 1) => `rgba(0, 212, 170, ${opacity})`,
        strokeWidth: 2
      }]
    };
  };

  const getCategoryBarData = () => {
    if (!summary?.topExpenseCategories) return null;

    return {
      labels: summary.topExpenseCategories.map(cat => cat.category),
      datasets: [{
        data: summary.topExpenseCategories.map(cat => cat.amount)
      }]
    };
  };

  const getSavingsRecommendation = () => {
    if (!summary) return null;

    const savingsRate = summary.totalIncome > 0 ? (summary.balance / summary.totalIncome) * 100 : 0;
    
    if (savingsRate < 10) {
      return {
        title: '🎯 هدف التوفير',
        message: 'حاول توفر على الأقل 10% من دخلك شهرياً',
        target: summary.totalIncome * 0.1,
        current: summary.balance,
        color: '#FF9800'
      };
    } else if (savingsRate < 20) {
      return {
        title: '💪 ممتاز!',
        message: 'أنت موفر جيد، حاول تصل لـ 20%',
        target: summary.totalIncome * 0.2,
        current: summary.balance,
        color: '#4CAF50'
      };
    } else {
      return {
        title: '🏆 رائع!',
        message: 'أنت موفر ممتاز!',
        target: summary.totalIncome * 0.2,
        current: summary.balance,
        color: '#2E7D32'
      };
    }
  };

  const savingsGoal = getSavingsRecommendation();
  const trendData = getExpenseTrendData();
  const barData = getCategoryBarData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Financial Health Score */}
        {summary && (
          <Card style={styles.healthCard}>
            <Card.Content>
              <View style={styles.healthHeader}>
                <Heart size={32} color="#4CAF50" />
                <RTLText style={styles.healthTitle}>صحة مالية</RTLText>
              </View>
              <View style={styles.healthScore}>
                <RTLText style={styles.scoreNumber}>
                  {/* {Math.max(0, Math.min(100, Math.round((summary.balance / Math.max(summary.totalIncome, 1)) * 100 + 50)))} */}
                  100
                </RTLText>
                <RTLText style={styles.scoreLabel}>من 100</RTLText>
              </View>
              <RTLText style={styles.healthDescription}>
                {summary.balance > 0 ? 'صحتك المالية ممتازة! 🎉' : 'تحتاج لمراجعة ميزانيتك ⚠️'}
              </RTLText>
            </Card.Content>
          </Card>
        )}

        {/* Savings Goal */}
        {savingsGoal && (
          <Card style={styles.goalCard}>
            <Card.Content>
              <RTLText style={styles.goalTitle}>{savingsGoal.title}</RTLText>
              <RTLText style={styles.goalMessage}>{savingsGoal.message}</RTLText>
              <View style={styles.goalProgress}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${Math.min(100, (savingsGoal.current / savingsGoal.target) * 100)}%`,
                        backgroundColor: savingsGoal.color
                      }
                    ]} 
                  />
                </View>
                <RTLText style={styles.progressText}>
                  {formatCurrency(savingsGoal.current)} / {formatCurrency(savingsGoal.target)}
                </RTLText>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Expense Trend Chart */}
        {trendData && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <RTLText style={styles.chartTitle}>اتجاه المصاريف (آخر 7 أيام)</RTLText>
              <LineChart
                data={trendData}
                width={width - 60}
                height={220}
                chartConfig={{
                  backgroundColor: '#2C2C2C',
                  backgroundGradientFrom: '#2C2C2C',
                  backgroundGradientTo: '#2C2C2C',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 212, 170, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#00D4AA'
                  }
                }}
                bezier
                style={styles.chart}
              />
            </Card.Content>
          </Card>
        )}

        {/* Category Distribution */}
        {barData && (
          <Card style={styles.chartCard}>
            <Card.Content>
              <RTLText style={styles.chartTitle}>توزيع المصاريف حسب الفئة</RTLText>
              <BarChart
                data={barData}
                width={width - 60}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: '#2C2C2C',
                  backgroundGradientFrom: '#2C2C2C',
                  backgroundGradientTo: '#2C2C2C',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(0, 212, 170, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: {
                    borderRadius: 16
                  }
                }}
                style={styles.chart}
              />
            </Card.Content>
          </Card>
        )}

        {/* Smart Insights */}
        {insights.length > 0 && (
          <Card style={styles.insightsCard}>
            <Card.Content>
              <RTLText style={styles.insightsTitle}>💡 تحليلات ذكية</RTLText>
              {insights.map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <RTLText style={styles.insightText}>{insight}</RTLText>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Top Categories */}
        {summary?.topExpenseCategories && summary.topExpenseCategories.length > 0 && (
          <Card style={styles.categoriesCard}>
            <Card.Content>
              <RTLText style={styles.categoriesTitle}>أعلى فئات المصاريف</RTLText>
              {summary.topExpenseCategories.map((category, index) => (
                <View key={index} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <Chip style={[styles.categoryChip, { backgroundColor: ['#2E7D32', '#4CAF50', '#8BC34A'][index] || '#CDDC39' }]}>
                      {category.category}
                    </Chip>
                    <RTLText style={styles.categoryPercentage}>
                      {category.percentage.toFixed(1)}%
                    </RTLText>
                  </View>
                  <RTLText style={styles.categoryAmount}>
                    {formatCurrency(category.amount)}
                  </RTLText>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => navigation.navigate('Expenses')}
        size="small"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1A1A1A',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  healthCard: {
    marginBottom: 16,
    elevation: 4,
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
  },
  healthHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthTitle: {
    marginRight: 12,
    color: '#00D4AA',
    fontFamily: 'Cairo-Regular',
  },
  healthScore: {
    alignItems: 'center',
    marginBottom: 12,
    
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  
    paddingTop: 40,
    paddingBottom:10,
    color: '#00D4AA',
    fontFamily: 'Cairo-Regular',
  },
  scoreLabel: {
    fontSize: 16,
    paddingTop: 14,
    paddingBottom: 14,
    color: '#9E9E9E',
    fontFamily: 'Cairo-Regular',

  },
  healthDescription: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Cairo-Regular',
    color: '#FFFFFF',
  },
  goalCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
  },
  goalTitle: {
    color: '#00D4AA',
    marginBottom: 8,
    fontFamily: 'Cairo-Regular',
    textAlign: 'left',
  },
  goalMessage: {
    marginBottom: 16,
    fontFamily: 'Cairo-Regular',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  goalProgress: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#404040',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Cairo-Regular',
    color: '#00D4AA',
  },
  chartCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
  },
  chartTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#00D4AA',
    fontFamily: 'Cairo-Regular',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  insightsCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
  },
  insightsTitle: {
    color: '#00D4AA',
    marginBottom: 12,
    fontFamily: 'Cairo-Regular',
    textAlign: 'left',
  },
  insightItem: {
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Cairo-Regular',
    textAlign: 'left',
    color: '#00D4AA',
  },
  categoriesCard: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: '#2C2C2C',
    borderRadius: 16,
  },
  categoriesTitle: {
    color: '#00D4AA',
    marginBottom: 12,
    fontFamily: 'Cairo-Regular',
    textAlign: 'left',
  },
  categoryItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  categoryChip: {
    marginRight: 8,
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#9E9E9E',
    fontFamily: 'Cairo-Regular',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4AA',
    fontFamily: 'Cairo-Regular',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#00D4AA',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default InsightsScreen;
