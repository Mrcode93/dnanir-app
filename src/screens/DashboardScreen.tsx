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
import { Card, Title, Paragraph, FAB, useTheme } from 'react-native-paper';
import { PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import RTLText from '../components/RTLText';

import { FinancialSummary } from '../types';
import { calculateFinancialSummary, generateFinancialInsights, formatCurrency } from '../services/financialService';
import { gradientColors, colors } from '../utils/gradientColors';
import { getUserSettings } from '../database/database';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>('');

  const loadData = async () => {
    try {
      const financialSummary = await calculateFinancialSummary();
      setSummary(financialSummary);
      setInsights(generateFinancialInsights(financialSummary));
      
      // Load user settings for name
      const userSettings = await getUserSettings();
      if (userSettings?.name) {
        setUserName(userSettings.name);
      }
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
  }, []);

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return colors.primary;
    if (balance < 0) return colors.error;
    return colors.warning;
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 0) return 'trending-up';
    if (balance < 0) return 'trending-down';
    return 'remove';
  };

  const chartData = summary?.topExpenseCategories.map((category, index) => ({
    name: category.category,
    population: category.amount,
    color: gradientColors.chart.green1[index % 2] || gradientColors.chart.green2[index % 2] || gradientColors.chart.green3[index % 2] || gradientColors.chart.green4[index % 2],
    legendFontColor: colors.textSecondary,
    legendFontSize: 12,
  })) || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Master Card Style Balance */}
        {summary && (
          <LinearGradient
            colors={['#136a8a',  '#267871']}
            style={styles.masterCard}
          >
            <View style={styles.cardContent}>
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.cardLogo}>
                  <RTLText style={styles.cardLogoText} fontFamily="Cairo-Regular">
                    دنانير
                  </RTLText>
                </View>
                <View style={styles.cardChip}>
                  <View style={styles.chip} />
                </View>
              </View>
              
             
              
              {/* Card Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.cardHolderInfo}>
                  <RTLText style={styles.cardHolderLabel} fontFamily="Cairo-Regular">
                   مرحباً
                  </RTLText>
                  <RTLText style={styles.cardHolderName} fontFamily="Cairo-Regular">
                    {userName || 'المستخدم'}
                  </RTLText>
                </View>
                <View style={styles.cardBalanceInfo}>
                  <RTLText style={styles.cardBalanceLabel} fontFamily="Cairo-Regular">
                    الرصيد
                  </RTLText>
                  <RTLText style={styles.cardBalanceAmount} fontFamily="Cairo-Regular">
                    {formatCurrency(summary.balance)}
                  </RTLText>
                </View>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Summary Cards */}
        {summary && (
          <View style={styles.summaryContainer}>
            <LinearGradient
              colors={gradientColors.accent.info}
              style={styles.summaryCard}
            >
              <View style={styles.summaryContent}>
                <View style={styles.summaryItem}>
                  <Ionicons name="arrow-up-circle" size={24} color={colors.text} />
                  <View style={styles.summaryText}>
                    <Text style={styles.summaryLabel}>إجمالي الدخل</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(summary.totalIncome)}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            <LinearGradient
              colors={gradientColors.accent.error}
              style={styles.summaryCard}
            >
              <View style={styles.summaryContent}>
                <View style={styles.summaryItem}>
                  <Ionicons name="arrow-down-circle" size={24} color={colors.text} />
                  <View style={styles.summaryText}>
                    <Text style={styles.summaryLabel}>إجمالي المصاريف</Text>
                    <Text style={styles.summaryValue}>
                      {formatCurrency(summary.totalExpenses)}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Expense Distribution Chart */}
        {chartData.length > 0 && (
          <LinearGradient
            colors={gradientColors.background.card}
            style={styles.chartCard}
          >
            <View style={styles.chartContent}>
              <RTLText style={styles.chartTitle}>توزيع المصاريف</RTLText>
              <PieChart
                data={chartData}
                width={width - 60}
                height={220}
                chartConfig={{
                  color: (opacity = 1) => `rgba(0, 212, 170, ${opacity})`,
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

        {/* Insights */}
        {insights.length > 0 && (
          <LinearGradient
            colors={gradientColors.background.card}
            style={styles.insightsCard}
          >
            <View style={styles.insightsContent}>
              <RTLText style={styles.insightsTitle}>💡 نصائح ذكية</RTLText>
              {insights.map((insight, index) => (
                <View key={index} style={styles.insightItem}>
                  <Text style={styles.insightText}>{insight}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        )}
      </ScrollView>

       {/* Floating Action Button */}
       <LinearGradient
         colors={gradientColors.button.primary}
         style={styles.fabGradient}
       >
         <FAB
           style={styles.fab}
           icon="plus"
           onPress={() => navigation.navigate('Expenses')}
           size="small"
           color={colors.text}
         />
       </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  masterCard: {
    marginBottom: 16,
    elevation: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardContent: {
    padding: 24,
    minHeight: 200,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  cardLogo: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardLogoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  cardChip: {
    alignItems: 'flex-end',
  },
  chip: {
    width: 40,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardNumberContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  cardNumberDots: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardHolderInfo: {
    flex: 1,
    alignItems: 'flex-start',
  },
  cardHolderLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'right',
  },
  cardHolderName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  cardBalanceInfo: {
    alignItems: 'flex-end',
  },
  cardBalanceLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'right',
  },
  cardBalanceAmount: {
    color: '#FFFFFF',
    paddingTop: 10,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  summaryContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    marginHorizontal: 4,
    elevation: 2,
    borderRadius: 16,
  },
  summaryContent: {
    padding: 16,
  },
  summaryItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  summaryText: {
    marginRight: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    opacity: 0.8,
    textAlign: 'right',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Cairo-Regular',
    color: colors.text,
    textAlign: 'right',
  },
  chartCard: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 16,
  },
  chartContent: {
    padding: 16,
  },
  chartTitle: {
    textAlign: 'center',
    marginBottom: 16,
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
  },
  insightsCard: {
    marginBottom: 16,
    elevation: 2,
    borderRadius: 16,
  },
  insightsContent: {
    padding: 16,
  },
  insightsTitle: {
    color: colors.primary,
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
    textAlign: 'right',
    color: colors.primary,
  },
  fabGradient: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    backgroundColor: 'transparent',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DashboardScreen;
