import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlatformFontWeight, getPlatformShadow } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { useCurrency } from '../hooks/useCurrency';
import { FinancialGoal } from '../types';
import { aiApiService, type GoalPlanData } from '../services/aiApiService';
import { getGoalPlanCache, saveGoalPlanCache } from '../database/goalPlanCache';
import { getCurrentMonthData, getMonthData } from '../services/financialService';
import { usePrivacy } from '../context/PrivacyContext';

export const GoalPlanScreen = ({ route, navigation }: any) => {
  const goal = route?.params?.goal as FinancialGoal | undefined;
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency, currencyCode } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<GoalPlanData | null>(null);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCached = useCallback(async () => {
    if (!goal?.id) return;
    const cached = await getGoalPlanCache(goal.id);
    if (cached?.data) {
      // Only show cached data if it's less than 7 days old
      const cacheAge = Date.now() - cached.createdAt;
      const maxCacheAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (cacheAge < maxCacheAge) {
        setPlan(cached.data);
        setCachedAt(cached.createdAt);
      }
    }
  }, [goal?.id]);

  useEffect(() => {
    loadCached();
  }, [loadCached]);

  const fetchPlan = useCallback(async () => {
    if (!goal) return;
    setLoading(true);
    setError(null);
    // Clear old plan immediately to show loading state
    setPlan(null);
    setCachedAt(null);
    
    try {
      // Get user's actual financial data
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      const [currentMonthData, previousMonthData] = await Promise.all([
        getCurrentMonthData(),
        getMonthData(prevYear, prevMonth),
      ]);

      // Prepare user financial summary
      const userFinancialData = {
        currentMonth: {
          totalIncome: currentMonthData.totalIncome,
          totalExpenses: currentMonthData.totalExpenses,
          balance: currentMonthData.balance,
          expenses: currentMonthData.expenses || [],
          income: currentMonthData.income || [],
          byCategory: (currentMonthData.topExpenseCategories || []).map((c: any) => ({
            category: c.category,
            amount: c.amount,
            percentage: c.percentage,
          })),
          billsDueTotal: (currentMonthData as any).billsDueTotal ?? 0,
          recurringEstimatedTotal: (currentMonthData as any).recurringEstimatedTotal ?? 0,
        },
        previousMonth: {
          totalIncome: previousMonthData.totalIncome,
          totalExpenses: previousMonthData.totalExpenses,
          balance: previousMonthData.balance,
        },
      };

      const result = await aiApiService.getGoalPlan({
        goal: {
          title: goal.title,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          targetDate: goal.targetDate ?? undefined,
          category: goal.category || 'other',
        },
        currency: goal.currency || currencyCode,
        userFinancialData, // Add user's actual financial data
      });
      
      if (result.success && result.data) {
        // Update state with new data
        setPlan(result.data);
        setCachedAt(Date.now());
        
        // Save to local database (always save, even if there's an error)
        try {
          await saveGoalPlanCache(goal.id, result.data);
        } catch (cacheError) {
          console.error('Error saving goal plan cache:', cacheError);
          // Don't fail the whole operation if cache save fails
        }
      } else {
        setError(result.error || 'فشل في إنشاء الخطة');
        // Reload cached data if available as fallback
        const cached = await getGoalPlanCache(goal.id);
        if (cached?.data) {
          setPlan(cached.data);
          setCachedAt(cached.createdAt);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
      // Reload cached data if available as fallback
      const cached = await getGoalPlanCache(goal.id);
      if (cached?.data) {
        setPlan(cached.data);
        setCachedAt(cached.createdAt);
      }
    } finally {
      setLoading(false);
    }
  }, [goal, currencyCode]);

  if (!goal) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>لم يتم اختيار هدف</Text>
      </SafeAreaView>
    );
  }

  const goalCurrency = goal.currency || currencyCode;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header - same as AISmartInsights */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>{goal.title}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
              {isPrivacyEnabled
                ? `**** / **** ${goalCurrency}`
                : `${goal.currentAmount.toLocaleString('ar-IQ')} / ${goal.targetAmount.toLocaleString('ar-IQ')} ${goalCurrency}`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBadge}
            onPress={fetchPlan}
            disabled={loading}
          >
            <LinearGradient
              colors={theme.gradients.primary as string[]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.refreshBadgeGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sparkles" size={18} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.inlineError, { backgroundColor: theme.colors.error + '18', borderColor: theme.colors.error + '50' }]}>
            <Ionicons name="alert-circle" size={24} color={theme.colors.error} />
            <Text style={[styles.inlineErrorText, { color: theme.colors.textPrimary }]}>{error}</Text>
          </View>
        )}

        {!plan && !loading && (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.border }]}>
            <View style={styles.emptyStateIconContainer}>
              <Ionicons name="flag-outline" size={60} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: theme.colors.textPrimary }]}>لا توجد خطة حالياً</Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              اضغط الزر أعلاه للحصول على خطة ونصائح لتحقيق هذا الهدف بالذكاء الاصطناعي.
            </Text>
            <TouchableOpacity onPress={fetchPlan} style={styles.largeAnalyzeBtn}>
              <LinearGradient
                colors={theme.gradients.primary as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.largeAnalyzeBtnGradient}
              >
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.largeAnalyzeBtnText}>إنشاء الخطة الآن</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {plan && (
          <>
            {cachedAt != null && (
              <Text style={[styles.cachedLabel, { color: theme.colors.textMuted }]}>
                آخر تحديث: {new Date(cachedAt).toLocaleDateString('ar-IQ')}
              </Text>
            )}

            {plan.message ? (
              <LinearGradient
                colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8F9FA']}
                style={[styles.statusCard, { borderColor: theme.colors.primary + '40' }]}
              >
                <View style={[styles.statusIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons name="chatbubble-ellipses" size={28} color={theme.colors.primary} />
                </View>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusLabel, { color: theme.colors.primary }]}>رسالة الخطة</Text>
                  <Text style={[styles.statusMessage, { color: theme.colors.textPrimary }]}>{plan.message}</Text>
                </View>
              </LinearGradient>
            ) : null}

            {plan.suggestedMonthlySaving != null && plan.suggestedMonthlySaving > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons name="wallet-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>الادخار الشهري المقترح</Text>
                </View>
                <View style={[styles.glassCard, { backgroundColor: theme.colors.surfaceCard }]}>
                  <Text style={[styles.estimatedRemaining, { color: theme.colors.primary }]}>
                    {formatCurrency(plan.suggestedMonthlySaving)}
                  </Text>
                </View>
              </View>
            )}

            {plan.planSteps.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons name="list-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>خطوات الخطة</Text>
                </View>
                {plan.planSteps.map((step, i) => (
                  <View key={i} style={[styles.actionItemCard, { backgroundColor: theme.colors.surfaceCard }]}>
                    <LinearGradient
                      colors={theme.gradients.primary as string[]}
                      style={styles.priorityBadge}
                    >
                      <Text style={styles.priorityText}>{i + 1}</Text>
                    </LinearGradient>
                    <View style={styles.actionItemContent}>
                      <Text style={[styles.bulletText, { color: theme.colors.textPrimary }]}>{step}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {plan.tips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, { backgroundColor: theme.colors.warning + '20' }]}>
                    <Ionicons name="bulb-outline" size={18} color={theme.colors.warning} />
                  </View>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>نصائح ذكية</Text>
                </View>
                {plan.tips.map((tip, i) => (
                  <View key={i} style={[styles.tipCard, { backgroundColor: theme.colors.warning + '08', borderColor: theme.colors.warning + '30' }]}>
                    <Ionicons name="sparkles-outline" size={18} color={theme.colors.warning} style={styles.cardIcon} />
                    <Text style={[styles.bulletText, { color: theme.colors.textPrimary }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.bottomAnalyzeBtn} onPress={fetchPlan} disabled={loading}>
              <LinearGradient
                colors={theme.gradients.primary as string[]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bottomAnalyzeBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="sparkles" size={20} color="#fff" />
                )}
                <Text style={styles.bottomAnalyzeBtnText}>إعادة إنشاء الخطة</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      direction: 'rtl' as const,
    },
    centered: { justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
      marginTop: 10,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: getPlatformFontWeight('800'),
      fontFamily: theme.typography?.fontFamily,
      textAlign: 'left',
    },
    headerSubtitle: {
      fontSize: 14,
      fontFamily: theme.typography?.fontFamily,
      textAlign: 'left',
      marginTop: 2,
    },
    refreshBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      ...getPlatformShadow('sm'),
    },
    refreshBadgeGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineError: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
    },
    inlineErrorText: {
      flex: 1,
      fontSize: 14,
      textAlign: 'left',
      fontFamily: theme.typography?.fontFamily,
    },
    errorText: { flex: 1, fontSize: 14 },
    emptyState: {
      padding: 30,
      borderRadius: 24,
      borderWidth: 1,
      alignItems: 'center',
      marginTop: 20,
      ...getPlatformShadow('md'),
    },
    emptyStateIconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: getPlatformFontWeight('700'),
      marginBottom: 10,
      textAlign: 'center',
      fontFamily: theme.typography?.fontFamily,
    },
    emptyStateText: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
      fontFamily: theme.typography?.fontFamily,
    },
    largeAnalyzeBtn: {
      width: '100%',
      height: 56,
      borderRadius: 16,
      ...getPlatformShadow('md'),
    },
    largeAnalyzeBtnGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    largeAnalyzeBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: getPlatformFontWeight('700'),
      fontFamily: theme.typography?.fontFamily,
    },
    cachedLabel: { fontSize: 12, marginBottom: 8, fontFamily: theme.typography?.fontFamily },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      padding: 20,
      borderRadius: 24,
      borderWidth: 1.5,
      marginBottom: 24,
      ...getPlatformShadow('md'),
    },
    statusIconContainer: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusContent: { flex: 1 },
    statusLabel: {
      fontSize: 12,
      fontWeight: getPlatformFontWeight('700'),
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
      textAlign: 'left',
      fontFamily: theme.typography?.fontFamily,
    },
    statusMessage: {
      fontSize: 18,
      fontWeight: getPlatformFontWeight('800'),
      textAlign: 'left',
      lineHeight: 24,
      fontFamily: theme.typography?.fontFamily,
    },
    section: { marginBottom: 30 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    sectionIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 19,
      fontWeight: getPlatformFontWeight('800'),
      textAlign: 'left',
      fontFamily: theme.typography?.fontFamily,
    },
    glassCard: {
      padding: 18,
      borderRadius: 20,
      ...getPlatformShadow('sm'),
    },
    estimatedRemaining: {
      fontSize: 20,
      fontWeight: getPlatformFontWeight('800'),
      textAlign: 'left',
      fontFamily: theme.typography?.fontFamily,
    },
    actionItemCard: {
      flexDirection: 'row',
      padding: 18,
      borderRadius: 22,
      marginBottom: 12,
      alignItems: 'flex-start',
      gap: 16,
      ...getPlatformShadow('sm'),
    },
    priorityBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priorityText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: getPlatformFontWeight('800'),
      fontFamily: theme.typography?.fontFamily,
    },
    actionItemContent: { flex: 1 },
    bulletText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'left',
      writingDirection: 'rtl' as const,
      fontFamily: theme.typography?.fontFamily,
    },
    tipCard: {
      flexDirection: 'row',
      padding: 16,
      borderRadius: 18,
      marginBottom: 10,
      alignItems: 'flex-start',
      borderWidth: 1,
      gap: 12,
    },
    cardIcon: { marginTop: 2 },
    bottomAnalyzeBtn: {
      height: 56,
      borderRadius: 16,
      marginTop: 10,
      marginBottom: 20,
      ...getPlatformShadow('md'),
    },
    bottomAnalyzeBtnGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    bottomAnalyzeBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: getPlatformFontWeight('700'),
      fontFamily: theme.typography?.fontFamily,
    },
  });
