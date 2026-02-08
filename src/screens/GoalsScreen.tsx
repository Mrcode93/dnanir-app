import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { GoalCard } from '../components/GoalCard';
import {
  getFinancialGoals,
  addFinancialGoal,
  updateFinancialGoal,
  deleteFinancialGoal,
} from '../database/database';
import { FinancialGoal } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { CURRENCIES } from '../types';

export const GoalsScreen = ({ navigation, route }: any) => {
  const { formatCurrency, currencyCode } = useCurrency();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [convertedTotals, setConvertedTotals] = useState<{ current: number; target: number } | null>(null);
  const [currencyBreakdown, setCurrencyBreakdown] = useState<Record<string, { current: number; target: number }>>({});

  const loadGoals = async () => {
    try {
      const allGoals = await getFinancialGoals();
      setGoals(allGoals);

      // Calculate converted totals and currency breakdown
      const active = allGoals.filter(g => !g.completed);
      if (active.length > 0) {
        let totalCurrentConverted = 0;
        let totalTargetConverted = 0;
        const breakdown: Record<string, { current: number; target: number }> = {};

        for (const goal of active) {
          const goalCurrency = goal.currency || currencyCode;
          
          // Add to breakdown by currency
          if (!breakdown[goalCurrency]) {
            breakdown[goalCurrency] = { current: 0, target: 0 };
          }
          breakdown[goalCurrency].current += goal.currentAmount;
          breakdown[goalCurrency].target += goal.targetAmount;

          // Convert to primary currency and add to totals
          if (goalCurrency !== currencyCode) {
            try {
              const convertedCurrent = await convertCurrency(goal.currentAmount, goalCurrency, currencyCode);
              const convertedTarget = await convertCurrency(goal.targetAmount, goalCurrency, currencyCode);
              totalCurrentConverted += convertedCurrent;
              totalTargetConverted += convertedTarget;
            } catch (error) {
              console.error('Error converting currency:', error);
              // If conversion fails, add original amount
              totalCurrentConverted += goal.currentAmount;
              totalTargetConverted += goal.targetAmount;
            }
          } else {
            totalCurrentConverted += goal.currentAmount;
            totalTargetConverted += goal.targetAmount;
          }
        }

        setConvertedTotals({ current: totalCurrentConverted, target: totalTargetConverted });
        setCurrencyBreakdown(breakdown);
      } else {
        setConvertedTotals(null);
        setCurrencyBreakdown({});
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  useEffect(() => {
    loadGoals();
    const unsubscribe = navigation.addListener('focus', loadGoals);
    return unsubscribe;
  }, [navigation]);

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      });
    }
    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceCard,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
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
    };
  }, [navigation]);

  useEffect(() => {
    if (route?.params?.action === 'add') {
      navigation.navigate('AddGoal');
      navigation.setParams({ action: undefined });
    }
  }, [route?.params]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGoals();
    setRefreshing(false);
  };

  const handleAddGoal = () => {
    navigation.navigate('AddGoal');
  };

  const handleEditGoal = (goal: FinancialGoal) => {
    navigation.navigate('AddGoal', { goal });
  };

  const handleDeleteGoal = async (goalId: number) => {
    try {
      await deleteFinancialGoal(goalId);
      await loadGoals();
      alertService.success('نجح', 'تم حذف الهدف بنجاح');
    } catch (error) {
      console.error('Error deleting goal:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حذف الهدف');
    }
  };

  const activeGoals = goals.filter(g => !g.completed);
  const completedGoals = goals.filter(g => g.completed);
  
  // Use converted totals if available, otherwise calculate from active goals
  const totalTarget = convertedTotals?.target ?? activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrent = convertedTotals?.current ?? activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  // Check if all goals use the same currency
  const uniqueCurrencies = new Set(activeGoals.map(g => g.currency || currencyCode));
  const hasMultipleCurrencies = uniqueCurrencies.size > 1;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
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
        {/* Summary Card */}
        {activeGoals.length > 0 && (
          <LinearGradient
            colors={theme.gradients.primary as any}
            style={styles.summaryCard}
          >
            <View style={styles.summaryHeader}>
              <Ionicons name="trophy-outline" size={32} color={theme.colors.textInverse} />
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>الأهداف النشطة</Text>
                <Text style={styles.summarySubtitle}>
                  {activeGoals.length} هدف
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(overallProgress, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(overallProgress)}% من إجمالي الأهداف
              </Text>
            </View>

            <View style={styles.summaryAmounts}>
              <View style={styles.summaryAmount}>
                <Text style={styles.summaryAmountLabel}>المحقق</Text>
                <View>
                  <Text style={styles.summaryAmountValue}>
                    {formatCurrency(totalCurrent)}
                  </Text>
                  {hasMultipleCurrencies && Object.keys(currencyBreakdown).length > 0 && (
                    <View style={styles.currencyBreakdown}>
                      {Object.entries(currencyBreakdown).map(([curr, amounts]) => {
                        const currencyData = CURRENCIES.find(c => c.code === curr);
                        if (!currencyData || amounts.current === 0) return null;
                        return (
                          <Text key={curr} style={styles.currencyBreakdownText}>
                            {formatCurrencyAmount(amounts.current, curr)}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.summaryAmount}>
                <Text style={styles.summaryAmountLabel}>المستهدف</Text>
                <View>
                  <Text style={styles.summaryAmountValue}>
                    {formatCurrency(totalTarget)}
                  </Text>
                  {hasMultipleCurrencies && Object.keys(currencyBreakdown).length > 0 && (
                    <View style={styles.currencyBreakdown}>
                      {Object.entries(currencyBreakdown).map(([curr, amounts]) => {
                        const currencyData = CURRENCIES.find(c => c.code === curr);
                        if (!currencyData || amounts.target === 0) return null;
                        return (
                          <Text key={curr} style={styles.currencyBreakdownText}>
                            {formatCurrencyAmount(amounts.target, curr)}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </LinearGradient>
        )}

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأهداف النشطة</Text>
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => handleEditGoal(goal)}
                onDelete={() => handleDeleteGoal(goal.id)}
              />
            ))}
          </View>
        )}

        {/* Completed Goals */}
        {completedGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأهداف المنجزة</Text>
            {completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => handleEditGoal(goal)}
                onDelete={() => handleDeleteGoal(goal.id)}
              />
            ))}
          </View>
        )}

        {/* Empty State */}
        {goals.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyStateTitle}>لا توجد أهداف بعد</Text>
            <Text style={styles.emptyStateText}>
              ابدأ بتحديد هدف مالي جديد واتبع تقدمك نحو تحقيقه
            </Text>
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
    paddingBottom: 100,
    direction: 'ltr' as const,
  },
  summaryCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('md'),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  summaryText: {
    flex: 1,
    ...(isRTL ? { marginRight: theme.spacing.md } : { marginLeft: theme.spacing.md }),
  },
  summaryTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summarySubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  progressContainer: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.textInverse,
    borderRadius: theme.borderRadius.round,
  },
  progressText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summaryAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryAmount: {
    alignItems: 'flex-end',
  },
  summaryAmountLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  summaryAmountValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  currencyBreakdown: {
    marginTop: theme.spacing.xs,
  },
  currencyBreakdownText: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: theme.spacing.lg,
    direction: 'rtl',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    lineHeight: 24,
  },
});
