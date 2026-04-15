import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Platform, Modal, InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getPlatformFontWeight, getPlatformShadow } from '../utils/theme-constants';
import { getCurrentMonthData, getMonthData } from '../services/financialService';
import { getSelectedCurrencyCode } from '../services/financialService';
import { aiApiService, type SmartInsightsData } from '../services/aiApiService';
import { useCurrency } from '../hooks/useCurrency';
import { getAiInsightsCache, saveAiInsightsCache } from '../database/aiInsightsCache';
import { authStorage } from '../services/authStorage';
import { alertService } from '../services/alertService';
import { authApiService } from '../services/authApiService';
import { isRTL } from '../utils/rtl';
import { useWallets } from '../context/WalletContext';
import { tl, useLocalization } from "../localization";
export const AISmartInsightsScreen = ({
  navigation
}: any) => {
  useLocalization();
  const {
    theme,
    isDark
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency,
    currencyCode
  } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<SmartInsightsData | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const { selectedWallet } = useWallets();
  const [usage, setUsage] = useState<{
    insightsUsed: number;
    limit: number;
    remaining: number;
    isPro: boolean;
    hasUnlimitedAi?: boolean;
  } | null>(null);

  // Guard: redirect to Auth if not logged in
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          isAuthenticated,
          user
        } = await authApiService.checkAuth();
        if (cancelled) return;
        if (!isAuthenticated) {
          setNeedsAuth(true);
          setAuthChecked(true);
          navigation.replace('Auth');
          return;
        }
        setAuthChecked(true);
      } catch (error) {
        if (!cancelled) {
          // If network error, still check local storage as fallback for offline
          const token = await authStorage.getAccessToken();
          if (!token) {
            navigation.replace('Auth');
          } else {
            setAuthChecked(true);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);
  const loadInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const [current, previous, currency] = await Promise.all([
        getCurrentMonthData(selectedWallet?.id), 
        getMonthData(prevYear, prevMonth, selectedWallet?.id), 
        getSelectedCurrencyCode()
      ]);
      const lastDay = new Date(year, month, 0).getDate();
      const today = now.getDate();
      const daysLeftInMonth = Math.max(0, lastDay - today);
      const summary = {
        totalIncome: current.totalIncome,
        totalExpenses: current.totalExpenses,
        balance: current.balance,
        byCategory: (current.topExpenseCategories || []).map((c: any) => ({
          category: c.category,
          amount: c.amount,
          percentage: c.percentage
        })),
        currentMonth: {
          totalIncome: current.totalIncome,
          totalExpenses: current.totalExpenses
        },
        previousMonth: {
          totalIncome: previous.totalIncome,
          totalExpenses: previous.totalExpenses
        },
        daysLeftInMonth,
        billsDueThisMonth: (current as any).billsDueTotal ?? 0,
        recurringEstimatedTotal: (current as any).recurringEstimatedTotal ?? 0,
        billsDue: ((current as any).billsDueInPeriod ?? []).slice(0, 15).map((b: {
          title: string;
          amount: number;
          dueDate: string;
        }) => ({
          title: b.title,
          amount: b.amount,
          dueDate: b.dueDate
        }))
      };
      const result = await aiApiService.getSmartInsights({
        summary,
        currency: currencyCode || currency,
        analysisType: 'full',
        walletId: selectedWallet?.id
      });
      if (result.success && result.data) {
        setInsights(result.data);
        setError(null);
        if (result.usage) setUsage(result.usage);

        // Save to local database (always save, even if there's an error)
        try {
          await saveAiInsightsCache(result.data as unknown as Record<string, unknown>, 'full', selectedWallet?.id);
        } catch (cacheError) {

          // Don't fail the whole operation if cache save fails
        }
      } else {
        const message = result.error || tl("فشل في تحميل الرؤى");
        setError(message);
        alertService.show({
          title: tl("التحليل الذكي"),
          message,
          type: 'warning',
          confirmText: tl("حسناً")
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : tl("حدث خطأ"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currencyCode]);
  const loadUsage = useCallback(async () => {
    try {
      const res = await aiApiService.getAiUsage();
      if (res.success && res.data) setUsage(res.data);
    } catch (_) {}
  }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLoading(true);
    loadInsights();
  }, [loadInsights]);
  const runAnalyze = useCallback(() => {
    if (usage?.hasUnlimitedAi) {
      loadInsights();
      loadUsage();
      return;
    }
    alertService.confirm(tl("تأكيد التحليل"), tl("التحليل الذكي يستهلك محاولة من حدك الشهري. هل تريد المتابعة؟"), async () => {
      await loadInsights();
      await loadUsage();
    });
  }, [loadInsights, loadUsage, usage]);
  const onAnalyzePress = useCallback(() => {
    if (usage != null && !usage.hasUnlimitedAi && usage.remaining <= 0) {
      alertService.show({
        title: tl("انتهت المحاولات"),
        message: usage.isPro ? tl("وصلت للحد الشهري للتحليل الذكي (10 مرات). يجدد الحد كل شهر.") : tl("وصلت لحدك الشهري (مرة واحدة للمجاني). ترقية الحساب تمنحك المزيد من التحليلات."),
        type: 'warning',
        confirmText: tl("حسناً")
      });
      return;
    }
    runAnalyze();
  }, [usage, runAnalyze]);
  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setInsights(null); // Clear old insights before loading from cache
      getAiInsightsCache(selectedWallet?.id).then(cached => {
        if (cached?.data) {
          setInsights(cached.data as unknown as SmartInsightsData);
        }
      });
      loadUsage();
    });
    return () => task.cancel();
  }, [loadUsage, selectedWallet?.id]));
  React.useEffect(() => {
    if (authChecked && !needsAuth) {
      loadUsage();
    }
  }, [authChecked, needsAuth, loadUsage]);
  const statusColors = {
    green: {
      primary: theme.colors.success,
      bg: isDark ? '#065F46' : '#DCFCE7',
      icon: 'checkmark-circle' as const
    },
    yellow: {
      primary: theme.colors.warning,
      bg: isDark ? '#92400E' : '#FEF3C7',
      icon: 'warning' as const
    },
    red: {
      primary: theme.colors.error,
      bg: isDark ? '#991B1B' : '#FEE2E2',
      icon: 'alert-circle' as const
    }
  };
  const getStatusColors = (status: string | undefined) => {
    const key = (status || 'green') as keyof typeof statusColors;
    return statusColors[key] || statusColors.green;
  };

  if (!authChecked || needsAuth) {
    return <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>;
  }
  if (loading && !insights) {
    return <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, {
        color: theme.colors.textSecondary
      }]}>{tl("جاري تهيئة الرؤى الذكية...")}</Text>
      </SafeAreaView>;
  }
  const statusStyle = getStatusColors(insights?.status);
  return <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} refreshControl={insights ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} /> : undefined}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, {
            color: theme.colors.textPrimary
          }]}>{tl("تحليلات ذكية")}</Text>
            <Text style={[styles.headerSubtitle, {
            color: theme.colors.textSecondary
          }]}>{tl("مدعوم بالذكاء الاصطناعي")}</Text>
            {usage != null && <View style={[styles.usageBadge, {
            backgroundColor: theme.colors.primary + '18'
          }]}>
                <Ionicons name="sparkles" size={14} color={theme.colors.primary} />
                <Text style={[styles.usageText, {
              color: theme.colors.textPrimary
            }]}>
                  {usage.hasUnlimitedAi ? tl("المحاولات: {{}} (وصول لامحدود ♾️)", [usage.insightsUsed]) : tl("المحاولات: {{}} مستهلكة، {{}} متبقية من {{}}", [usage.insightsUsed, usage.remaining, usage.limit])}
                </Text>
              </View>}
          </View>
          <TouchableOpacity style={styles.refreshBadge} onPress={onAnalyzePress} disabled={loading || (usage != null && !usage.hasUnlimitedAi && usage.remaining <= 0)}>
            <LinearGradient colors={theme.gradients.primary as any} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }} style={styles.refreshBadgeGradient}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={18} color="#fff" />}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {error ? <View style={[styles.inlineError, {
        backgroundColor: theme.colors.error + '18',
        borderColor: theme.colors.error + '50'
      }]}>
            <Ionicons name="alert-circle" size={24} color={theme.colors.error} />
            <Text style={[styles.inlineErrorText, {
          color: theme.colors.textPrimary
        }]}>{error}</Text>
          </View> : null}

        {!insights && !loading && <View style={[styles.emptyState, {
        backgroundColor: theme.colors.surfaceCard,
        borderColor: theme.colors.border
      }]}>
            <View style={styles.emptyStateIconContainer}>
              <Ionicons name="analytics" size={60} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyStateTitle, {
          color: theme.colors.textPrimary
        }]}>{tl("لا توجد تحليلات حالياً")}</Text>
            <Text style={[styles.emptyStateText, {
          color: theme.colors.textSecondary
        }]}>{tl("قم بتحليل بياناتك المالية للحصول على رؤى عميقة وتوقعات دقيقة لميزانيتك.")}</Text>
            <TouchableOpacity onPress={onAnalyzePress} style={styles.largeAnalyzeBtn} disabled={usage != null && !usage.hasUnlimitedAi && usage.remaining <= 0}>
              <LinearGradient colors={theme.gradients.primary as any} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }} style={styles.largeAnalyzeBtnGradient}>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.largeAnalyzeBtnText}>{tl("تحليل البيانات الآن")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>}

        {insights && <>
            {/* Status card */}
            <LinearGradient colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8F9FA']} style={[styles.statusCard, {
          borderColor: statusStyle.primary + '40'
        }]}>
              <View style={[styles.statusIconContainer, {
            backgroundColor: statusStyle.bg
          }]}>
                <Ionicons name={statusStyle.icon} size={28} color={statusStyle.primary} />
              </View>
              <View style={styles.statusContent}>
                <Text style={[styles.statusLabel, {
              color: statusStyle.primary
            }]}>{tl("الوضع المالي")}</Text>
                <Text style={[styles.statusMessage, {
              color: theme.colors.textPrimary
            }]}>{insights.statusMessage}</Text>
              </View>
            </LinearGradient>

            {/* Risks */}
            {Array.isArray(insights.risks) && insights.risks.length > 0 && <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, {
              backgroundColor: theme.colors.error + '20'
            }]}>
                    <Ionicons name="warning" size={18} color={theme.colors.error} />
                  </View>
                  <Text style={[styles.sectionTitle, {
              color: theme.colors.textPrimary
            }]}>{tl("تنبيهات هامة")}</Text>
                </View>
                {insights.risks.map((risk, i) => <View key={i} style={[styles.riskCard, {
            backgroundColor: theme.colors.error + '10'
          }]}>
                    <Ionicons name="alert-circle" size={20} color={theme.colors.error} style={styles.cardIcon} />
                    <Text style={[styles.bulletText, {
              color: theme.colors.textPrimary
            }]}>{risk}</Text>
                  </View>)}
              </View>}

            {/* Month comparison */}
            {insights.monthComparison?.message && <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, {
              backgroundColor: theme.colors.primary + '20'
            }]}>
                    <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, {
              color: theme.colors.textPrimary
            }]}>{tl("مقارنة الأداء")}</Text>
                </View>
                <View style={[styles.glassCard, {
            backgroundColor: theme.colors.surfaceCard
          }]}>
                  <Text style={[styles.bulletText, {
              color: theme.colors.textPrimary,
              marginBottom: 12
            }]}>{insights.monthComparison.message}</Text>
                  {(insights.monthComparison.incomeChangePercent != null || insights.monthComparison.expenseChangePercent != null) && <View style={styles.comparisonRow}>
                      {insights.monthComparison.incomeChangePercent != null && <View style={[styles.statBadge, {
                backgroundColor: theme.colors.primary + '15'
              }]}>
                          <Ionicons name={insights.monthComparison.incomeChangePercent >= 0 ? "trending-up" : "trending-down"} size={14} color={theme.colors.primary} />
                          <Text style={[styles.comparisonBadge, {
                  color: theme.colors.primary
                }]}>{tl("الدخل:")}{insights.monthComparison.incomeChangePercent >= 0 ? '+' : ''}{insights.monthComparison.incomeChangePercent}%
                          </Text>
                        </View>}
                      {insights.monthComparison.expenseChangePercent != null && <View style={[styles.statBadge, {
                backgroundColor: theme.colors.warning + '15'
              }]}>
                          <Ionicons name={insights.monthComparison.expenseChangePercent >= 0 ? "trending-up" : "trending-down"} size={14} color={theme.colors.warning} />
                          <Text style={[styles.comparisonBadge, {
                  color: theme.colors.warning
                }]}>{tl("المصروف:")}{insights.monthComparison.expenseChangePercent >= 0 ? '+' : ''}{insights.monthComparison.expenseChangePercent}%
                          </Text>
                        </View>}
                    </View>}
                </View>
              </View>}

            {/* Analysis */}
            {Array.isArray(insights.analysis) && insights.analysis.length > 0 && <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, {
              backgroundColor: theme.colors.primary + '20'
            }]}>
                    <Ionicons name="analytics-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, {
              color: theme.colors.textPrimary
            }]}>{tl("تحليل المصروفات")}</Text>
                </View>
                {insights.analysis.map((line, i) => <View key={i} style={[styles.bulletCard, {
            backgroundColor: theme.colors.surfaceCard
          }]}>
                    <View style={styles.bulletDot} />
                    <Text style={[styles.bulletText, {
              color: theme.colors.textPrimary
            }]}>{line}</Text>
                  </View>)}
              </View>}

            {/* Category insights */}
            {Array.isArray(insights.categoryInsights) && insights.categoryInsights.length > 0 && <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, {
              backgroundColor: theme.colors.primary + '20'
            }]}>
                    <Ionicons name="pie-chart-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, {
              color: theme.colors.textPrimary
            }]}>{tl("تحليل الفئات")}</Text>
                </View>
                {insights.categoryInsights.map((item, i) => <View key={i} style={[styles.categoryCard, {
            backgroundColor: theme.colors.surfaceCard
          }]}>
                    <View style={styles.categoryCardHeader}>
                      <Text style={[styles.categoryName, {
                color: theme.colors.primary
              }]}>{item.category}</Text>
                      <LinearGradient colors={[theme.colors.primary + '30', 'transparent']} start={{
                x: 0,
                y: 0
              }} end={{
                x: 1,
                y: 0
              }} style={styles.categoryLine} />
                    </View>
                    <Text style={[styles.insightText, {
              color: theme.colors.textPrimary
            }]}>{item.insight}</Text>
                    <View style={[styles.recommendationBox, {
              backgroundColor: theme.colors.background
            }]}>
                      <Ionicons name="bulb-outline" size={16} color={theme.colors.warning} />
                      <Text style={[styles.recommendationText, {
                color: theme.colors.textSecondary
              }]}>{item.recommendation}</Text>
                    </View>
                  </View>)}
              </View>}

            {/* Saving tips */}
            {Array.isArray(insights.savingTips) && insights.savingTips.length > 0 && <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, {
              backgroundColor: theme.colors.warning + '20'
            }]}>
                    <Ionicons name="bulb-outline" size={18} color={theme.colors.warning} />
                  </View>
                  <Text style={[styles.sectionTitle, {
              color: theme.colors.textPrimary
            }]}>{tl("نصائح ذكية للتوفير")}</Text>
                </View>
                {insights.savingTips.map((tip, i) => <View key={i} style={[styles.tipCard, {
            backgroundColor: theme.colors.warning + '08',
            borderColor: theme.colors.warning + '30'
          }]}>
                    <Ionicons name="sparkles-outline" size={18} color={theme.colors.warning} style={styles.cardIcon} />
                    <Text style={[styles.bulletText, {
              color: theme.colors.textPrimary
            }]}>{tip}</Text>
                  </View>)}
              </View>}

            {/* Action items */}
            {Array.isArray(insights.actionItems) && insights.actionItems.length > 0 && <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, {
              backgroundColor: theme.colors.primary + '20'
            }]}>
                    <Ionicons name="list-outline" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.sectionTitle, {
              color: theme.colors.textPrimary
            }]}>{tl("خطوات تحسين مقترحة")}</Text>
                </View>
                {insights.actionItems.slice().sort((a, b) => a.priority - b.priority).map((item, i) => <View key={i} style={[styles.actionItemCard, {
            backgroundColor: theme.colors.surfaceCard
          }]}>
                      <LinearGradient colors={theme.gradients.primary as any} style={styles.priorityBadge}>
                        <Text style={styles.priorityText}>{item.priority}</Text>
                      </LinearGradient>
                      <View style={styles.actionItemContent}>
                        <Text style={[styles.actionItemTitle, {
                color: theme.colors.textPrimary
              }]}>{item.title}</Text>
                        <Text style={[styles.actionItemDescription, {
                color: theme.colors.textSecondary
              }]}>{item.description}</Text>
                      </View>
                    </View>)}
              </View>}

            {/* Prediction */}
            {insights.prediction?.message && <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionIcon, {
              backgroundColor: theme.colors.success + '20'
            }]}>
                    <Ionicons name="trending-up-outline" size={18} color={theme.colors.success} />
                  </View>
                  <Text style={[styles.sectionTitle, {
              color: theme.colors.textPrimary
            }]}>{tl("التوقعات المالية")}</Text>
                </View>
                <LinearGradient colors={isDark ? ['#1E293B', '#0F172A'] : ['#E0F2FE', '#F0F9FF']} style={styles.predictionCard}>
                  <Text style={[styles.predictionText, {
              color: theme.colors.textPrimary
            }]}>{insights.prediction.message}</Text>

                  {insights.prediction.estimatedRemaining != null && <View style={styles.predictionStatRow}>
                      <Text style={[styles.predictionLabel, {
                color: theme.colors.textSecondary
              }]}>{tl("الرصيد المتبقي المتوقع:")}</Text>
                      <Text style={[styles.estimatedRemaining, {
                color: theme.colors.primary
              }]}>
                        {formatCurrency(insights.prediction.estimatedRemaining)}
                      </Text>
                    </View>}

                  {insights.prediction.dailyBudgetSuggested && <View style={[styles.dailyBudgetBox, {
              backgroundColor: theme.colors.primary + '10'
            }]}>
                      <Ionicons name="calculator-outline" size={16} color={theme.colors.primary} />
                      <Text style={[styles.dailyBudgetText, {
                color: theme.colors.textPrimary
              }]}>{insights.prediction.dailyBudgetSuggested}</Text>
                    </View>}
                </LinearGradient>
              </View>}

            {/* Re-analyze Button at bottom */}
            <TouchableOpacity style={styles.bottomAnalyzeBtn} onPress={onAnalyzePress} disabled={loading || (usage != null && !usage.hasUnlimitedAi && usage.remaining <= 0)}>
              <LinearGradient colors={theme.gradients.primary as any} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }} style={styles.bottomAnalyzeBtnGradient}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sparkles" size={20} color="#fff" />}
                <Text style={styles.bottomAnalyzeBtnText}>{tl("إعادة تحليل البيانات")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>}
      </ScrollView>

      {/* Loading Overlay */}
      <Modal visible={loading && !!insights} transparent={true} animationType="fade">
        <View style={styles.overlayContainer}>
          <View style={[styles.loadingBox, {
          backgroundColor: theme.colors.surfaceCard,
          borderColor: theme.colors.border
        }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingBoxText, {
            color: theme.colors.textPrimary
          }]}>{tl("جاري تحليل بياناتك...")}</Text>
            <Text style={[styles.loadingBoxSubtext, {
            color: theme.colors.textSecondary
          }]}>{tl("سيتم تحديث الرؤى فور الانتهاء")}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>;
};
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    direction: isRTL ? 'rtl' : 'ltr'
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingBox: {
    width: '80%',
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    ...getPlatformShadow('xl')
  },
  loadingBoxText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily
  },
  loadingBoxSubtext: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    marginTop: Platform.OS === 'android' ? theme.spacing.md : theme.spacing.sm,
    paddingVertical: Platform.OS === 'android' ? theme.spacing.sm : 0
  },
  headerLeft: {
    flex: 1
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left'
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    marginTop: 2
  },
  usageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start'
  },
  usageText: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600')
  },
  refreshBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    ...getPlatformShadow('sm')
  },
  refreshBadgeGradient: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center'
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md
  },
  analyzeBtnLabel: {
    color: '#fff',
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: theme.spacing.md
  },
  inlineErrorText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  emptyState: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    ...getPlatformShadow('md')
  },
  emptyStateIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  emptyStateTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily
  },
  largeAnalyzeBtn: {
    width: '100%',
    height: 56,
    borderRadius: theme.borderRadius.lg,
    ...getPlatformShadow('md')
  },
  largeAnalyzeBtnGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  largeAnalyzeBtnText: {
    color: '#fff',
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xxl,
    fontFamily: theme.typography.fontFamily
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1.5,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('md')
  },
  statusIconContainer: {
    width: 52,
    height: 52,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusContent: {
    flex: 1
  },
  statusLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('700'),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  statusMessage: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('800'),
    textAlign: 'left',
    lineHeight: 24,
    fontFamily: theme.typography.fontFamily
  },
  section: {
    marginBottom: theme.spacing.xl
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('800'),
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  bulletCard: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    ...getPlatformShadow('sm')
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginTop: 8
  },
  bulletText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 24,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    fontFamily: theme.typography.fontFamily
  },
  riskCard: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
    gap: theme.spacing.md
  },
  tipCard: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    alignItems: 'flex-start',
    borderWidth: 1,
    gap: theme.spacing.md
  },
  cardIcon: {
    marginTop: 2
  },
  glassCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...getPlatformShadow('sm')
  },
  predictionCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    ...getPlatformShadow('md')
  },
  predictionText: {
    fontSize: theme.typography.sizes.md,
    lineHeight: 26,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily
  },
  predictionStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginBottom: theme.spacing.md
  },
  predictionLabel: {
    fontSize: theme.typography.sizes.sm,
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  estimatedRemaining: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('800'),
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  dailyBudgetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md
  },
  dailyBudgetText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  comparisonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm
  },
  comparisonBadge: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  categoryCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('sm')
  },
  categoryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  categoryName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('800'),
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  categoryLine: {
    height: 2,
    flex: 1,
    marginLeft: 10,
    borderRadius: 1
  },
  insightText: {
    fontSize: theme.typography.sizes.sm,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    fontFamily: theme.typography.fontFamily
  },
  recommendationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md
  },
  recommendationText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    fontFamily: theme.typography.fontFamily
  },
  actionItemCard: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    ...getPlatformShadow('sm')
  },
  priorityBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  priorityText: {
    color: '#fff',
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily
  },
  actionItemContent: {
    flex: 1
  },
  actionItemTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('800'),
    marginBottom: 6,
    textAlign: 'left',
    fontFamily: theme.typography.fontFamily
  },
  actionItemDescription: {
    fontSize: theme.typography.sizes.sm,
    lineHeight: 22,
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    fontFamily: theme.typography.fontFamily
  },
  bottomAnalyzeBtn: {
    height: 56,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('md')
  },
  bottomAnalyzeBtnGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  bottomAnalyzeBtnText: {
    color: '#fff',
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  }
});
