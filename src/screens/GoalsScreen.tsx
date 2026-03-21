import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, I18nManager } from 'react-native';
import { ScreenContainer } from '../design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { GoalCard } from '../components/GoalCard';
import { getFinancialGoals, addFinancialGoal, updateFinancialGoal, deleteFinancialGoal } from '../database/database';
import { FinancialGoal } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { authModalService } from '../services/authModalService';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { CURRENCIES } from '../types';
import { authStorage } from '../services/authStorage';
import { usePrivacy } from '../context/PrivacyContext';
import { calculateAverageMonthlySavings, calculateTimeToReachGoal } from '../services/financialService';
import { GoalDetailsModal } from '../components/GoalDetailsModal';
import { AddGoalAmountModal } from '../components/AddGoalAmountModal';
import { tl, useLocalization } from "../localization";
export const GoalsScreen = ({
  navigation,
  route
}: any) => {
  useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency,
    currencyCode
  } = useCurrency();
  const {
    isPrivacyEnabled
  } = usePrivacy();
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [convertedTotals, setConvertedTotals] = useState<{
    current: number;
    target: number;
  } | null>(null);
  const [currencyBreakdown, setCurrencyBreakdown] = useState<Record<string, {
    current: number;
    target: number;
  }>>({});
  const [averageMonthlySavings, setAverageMonthlySavings] = useState<number | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<FinancialGoal | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddAmount, setShowAddAmount] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<number | null>(null);
  const loadGoals = useCallback(async () => {
    try {
      const allGoals = await getFinancialGoals();
      setGoals(allGoals);
      setAverageMonthlySavings(allGoals.length > 0 ? await calculateAverageMonthlySavings(6) : null);

      // Calculate converted totals and currency breakdown
      const active = allGoals.filter(g => !g.completed);
      if (active.length > 0) {
        const breakdown: Record<string, {
          current: number;
          target: number;
        }> = {};
        const convertedGoals = await Promise.all(active.map(async goal => {
          const goalCurrency = goal.currency || currencyCode;
          if (!breakdown[goalCurrency]) {
            breakdown[goalCurrency] = {
              current: 0,
              target: 0
            };
          }
          breakdown[goalCurrency].current += goal.currentAmount;
          breakdown[goalCurrency].target += goal.targetAmount;
          if (goalCurrency === currencyCode) {
            return {
              current: goal.currentAmount,
              target: goal.targetAmount
            };
          }
          try {
            const [convertedCurrent, convertedTarget] = await Promise.all([convertCurrency(goal.currentAmount, goalCurrency, currencyCode), convertCurrency(goal.targetAmount, goalCurrency, currencyCode)]);
            return {
              current: convertedCurrent,
              target: convertedTarget
            };
          } catch (error) {
            return {
              current: goal.currentAmount,
              target: goal.targetAmount
            };
          }
        }));
        const totalCurrentConverted = convertedGoals.reduce((sum, item) => sum + item.current, 0);
        const totalTargetConverted = convertedGoals.reduce((sum, item) => sum + item.target, 0);
        setConvertedTotals({
          current: totalCurrentConverted,
          target: totalTargetConverted
        });
        setCurrencyBreakdown(breakdown);
      } else {
        setConvertedTotals(null);
        setCurrencyBreakdown({});
      }
    } catch (error) {}
  }, [currencyCode]);
  useEffect(() => {
    loadGoals();
    const unsubscribe = navigation.addListener('focus', loadGoals);
    return unsubscribe;
  }, [navigation]);
  useEffect(() => {
    if (route?.params?.action === 'add') {
      navigation.navigate('AddGoal');
      navigation.setParams({
        action: undefined
      });
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
    navigation.navigate('AddGoal', {
      goal
    });
  };
  const handleDeleteGoal = async (goalId: number) => {
    if (deletingGoalId !== null) return;
    setDeletingGoalId(goalId);
    setShowDetails(false);
    setShowAddAmount(false);
    setSelectedGoal(prev => prev?.id === goalId ? null : prev);
    setGoals(prev => prev.filter(goal => goal.id !== goalId));
    try {
      await deleteFinancialGoal(goalId);
      await loadGoals();
      alertService.toastSuccess(tl("تم حذف الهدف بنجاح"));
    } catch (error) {
      await loadGoals();
      alertService.toastError(tl("حدث خطأ أثناء حذف الهدف"));
    } finally {
      setDeletingGoalId(null);
    }
  };
  const handleAddAmount = async (amount: number) => {
    if (!selectedGoal) return;
    try {
      const updatedGoal = {
        ...selectedGoal,
        currentAmount: selectedGoal.currentAmount + amount,
        completed: selectedGoal.currentAmount + amount >= selectedGoal.targetAmount
      };
      await updateFinancialGoal(selectedGoal.id, updatedGoal);
      await loadGoals();
      alertService.toastSuccess(tl("تمت إضافة المبلغ بنجاح"));
    } catch (error) {
      alertService.toastError(tl("حدث خطأ أثناء إضافة المبلغ"));
    }
  };
  const handlePlanPress = async (goal: FinancialGoal) => {
    try {
      const user = await authStorage.getUser<{
        isPro?: boolean;
      }>();
      if (!user) {
        alertService.show({
          title: tl("تسجيل الدخول"),
          message: tl("يجب تسجيل الدخول أو إنشاء حساب لاستخدام خطة الهدف بالذكاء الاصطناعي."),
          confirmText: tl("تسجيل الدخول"),
          cancelText: tl("إلغاء"),
          showCancel: true,
          onConfirm: () => authModalService.show()
        });
        return;
      }
      if (!user.isPro) {
        alertService.show({
          title: tl("حساب مميز"),
          message: tl("خطة الهدف بالذكاء الاصطناعي متوفرة للحسابات المميزة فقط. يجب أن يكون نوع حسابك أو اشتراكك مميزاً لاستخدامها."),
          confirmText: tl("حسناً")
        });
        return;
      }
      navigation.navigate('GoalPlan', {
        goal
      });
    } catch (e) {
      alertService.error(tl("خطأ"), tl("حدث خطأ. تأكد من تسجيل الدخول وحاول مرة أخرى."));
    }
  };
  const activeGoals = useMemo(() => goals.filter(g => !g.completed), [goals]);
  const completedGoals = useMemo(() => goals.filter(g => g.completed), [goals]);

  // Use converted totals if available, otherwise calculate from active goals
  const totalTarget = useMemo(() => convertedTotals?.target ?? activeGoals.reduce((sum, g) => sum + g.targetAmount, 0), [convertedTotals, activeGoals]);
  const totalCurrent = useMemo(() => convertedTotals?.current ?? activeGoals.reduce((sum, g) => sum + g.currentAmount, 0), [convertedTotals, activeGoals]);
  const overallProgress = totalTarget > 0 ? totalCurrent / totalTarget * 100 : 0;

  // Check if all goals use the same currency
  const hasMultipleCurrencies = useMemo(() => new Set(activeGoals.map(g => g.currency || currencyCode)).size > 1, [activeGoals, currencyCode]);
  return <ScreenContainer scrollable={false} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} showsVerticalScrollIndicator={false}>
        {/* Summary Card */}
        {activeGoals.length > 0 && <LinearGradient colors={theme.gradients.primary as any} style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Ionicons name="trophy-outline" size={32} color="#FFFFFF" />
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>{tl("الأهداف النشطة")}</Text>
                <Text style={styles.summarySubtitle}>
                  {activeGoals.length}{tl("هدف")}</Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {
              width: `${Math.min(overallProgress, 100)}%`
            }]} />
              </View>
              <Text style={styles.progressText}>
                {isPrivacyEnabled ? '***' : tl("{{}}% من إجمالي الأهداف", [Math.round(overallProgress)])}
              </Text>
            </View>

            <View style={styles.summaryAmounts}>
              <View style={styles.summaryAmount}>
                <Text style={styles.summaryAmountLabel}>{tl("المحقق")}</Text>
                <View>
                  <Text style={styles.summaryAmountValue}>
                    {formatCurrency(totalCurrent)}
                  </Text>
                  {hasMultipleCurrencies && Object.keys(currencyBreakdown).length > 0 && <View style={styles.currencyBreakdown}>
                      {Object.entries(currencyBreakdown).map(([curr, amounts]) => {
                  const currencyData = CURRENCIES.find(c => c.code === curr);
                  if (!currencyData || amounts.current === 0) return null;
                  return <Text key={curr} style={styles.currencyBreakdownText}>
                            {isPrivacyEnabled ? '****' : formatCurrencyAmount(amounts.current, curr)}
                          </Text>;
                })}
                    </View>}
                </View>
              </View>
              <View style={styles.summaryAmount}>
                <Text style={styles.summaryAmountLabel}>{tl("المستهدف")}</Text>
                <View>
                  <Text style={styles.summaryAmountValue}>
                    {formatCurrency(totalTarget)}
                  </Text>
                  {hasMultipleCurrencies && Object.keys(currencyBreakdown).length > 0 && <View style={styles.currencyBreakdown}>
                      {Object.entries(currencyBreakdown).map(([curr, amounts]) => {
                  const currencyData = CURRENCIES.find(c => c.code === curr);
                  if (!currencyData || amounts.target === 0) return null;
                  return <Text key={curr} style={styles.currencyBreakdownText}>
                            {isPrivacyEnabled ? '****' : formatCurrencyAmount(amounts.target, curr)}
                          </Text>;
                })}
                    </View>}
                </View>
              </View>
            </View>
          </LinearGradient>}

        {/* Active Goals */}
        {activeGoals.length > 0 && <View style={styles.section}>
            <Text style={styles.sectionTitle}>{tl("الأهداف النشطة")}</Text>
            {activeGoals.map(goal => <GoalCard key={goal.id} goal={goal} onPress={g => {
          setSelectedGoal(g);
          setShowDetails(true);
        }} onEdit={() => handleEditGoal(goal)} onDelete={() => handleDeleteGoal(goal.id)} onPlan={() => handlePlanPress(goal)} averageMonthlySavingsHint={averageMonthlySavings} />)}
          </View>}

        {/* Completed Goals */}
        {completedGoals.length > 0 && <View style={styles.section}>
            <Text style={styles.sectionTitle}>{tl("الأهداف المنجزة")}</Text>
            {completedGoals.map(goal => <GoalCard key={goal.id} goal={goal} onPress={g => {
          setSelectedGoal(g);
          setShowDetails(true);
        }} onEdit={() => handleEditGoal(goal)} onDelete={() => handleDeleteGoal(goal.id)} onPlan={() => handlePlanPress(goal)} averageMonthlySavingsHint={averageMonthlySavings} />)}
          </View>}

        {/* Empty State */}
        {goals.length === 0 && <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyStateTitle}>{tl("لا توجد أهداف بعد")}</Text>
            <Text style={styles.emptyStateText}>{tl("ابدأ بتحديد هدف مالي جديد واتبع تقدمك نحو تحقيقه")}</Text>
          </View>}
      </ScrollView>

      {/* Goal Details Modal */}

      <GoalDetailsModal visible={showDetails} goal={selectedGoal} onClose={() => {
      setShowDetails(false);
    }} onEdit={() => {
      if (selectedGoal) handleEditGoal(selectedGoal);
    }} onDelete={() => {
      if (selectedGoal) handleDeleteGoal(selectedGoal.id);
    }} onPlan={() => {
      if (selectedGoal) handlePlanPress(selectedGoal);
    }} onAddAmount={() => {
      setShowAddAmount(true);
    }} estimatedTime={selectedGoal && !selectedGoal.completed ? calculateTimeToReachGoal(selectedGoal.targetAmount - selectedGoal.currentAmount, averageMonthlySavings || 0).formatted : null} />

      {/* Add Amount Modal */}
      <AddGoalAmountModal visible={showAddAmount} goal={selectedGoal} onClose={() => {
      setShowAddAmount(false);
    }} onAdd={handleAddAmount} />
    </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  summaryCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('md')
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  summaryText: {
    flex: 1,
    ...(isRTL ? {
      marginRight: theme.spacing.md
    } : {
      marginLeft: theme.spacing.md
    })
  },
  summaryTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  summarySubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  progressContainer: {
    marginBottom: theme.spacing.md,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  progressBar: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.round
  },
  progressText: {
    fontSize: theme.typography.sizes.sm,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  summaryAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  summaryAmount: {
    alignItems: 'flex-end'
  },
  summaryAmountLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily
  },
  summaryAmountValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  currencyBreakdown: {
    marginTop: theme.spacing.xs
  },
  currencyBreakdownText: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    fontStyle: 'italic'
  },
  section: {
    marginBottom: theme.spacing.lg,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg
  },
  emptyStateTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    writingDirection: isRTL ? 'rtl' : 'ltr',
    lineHeight: 24
  }
});
