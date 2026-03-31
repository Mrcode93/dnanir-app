import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { type AppTheme, getPlatformFontWeight, getPlatformShadow } from '../utils/theme-constants';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { authStorage } from '../services/authStorage';
import { authModalService } from '../services/authModalService';
import { authApiService } from '../services/authApiService';
import { plansService, type Plan } from '../services/plansService';
import { tl } from '../localization';

const SHARED_FEATURES = [
  'نسخ احتياطي ومزامنة البيانات سحابياً',
  'تحليلات مالية بالذكاء الاصطناعي',
  'إدخال المصاريف عبر الصوت',
  'تقارير مالية متقدمة',
  'بدون إعلانات',
];

const SUCCESS_URL = 'dnanir://payment/success';

const getDurationLabel = (plan: Plan): string => {
  if (plan.durationUnit === 'month') {
    return plan.durationValue === 1 ? 'شهر' : `${plan.durationValue} أشهر`;
  }
  if (plan.durationUnit === 'year') {
    return plan.durationValue === 1 ? 'سنة' : `${plan.durationValue} سنوات`;
  }
  return `${plan.durationValue} يوم`;
};

export const PlansScreen = ({ navigation }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const waitingForPayment = useRef(false);
  const appState = useRef(AppState.currentState);

  // When app returns to foreground after opening the payment browser
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      const wasBackground = appState.current === 'background' || appState.current === 'inactive';
      appState.current = nextState;

      if (nextState === 'active' && wasBackground && waitingForPayment.current) {
        waitingForPayment.current = false;
        setCheckingPayment(true);
        // Small delay to allow the Wayl webhook to reach our server and update the user
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const result = await authApiService.checkAuth();
          if (result.isAuthenticated && result.user?.isPro) {
            alertService.toastSuccess(tl('تم تفعيل اشتراك برو بنجاح! 🎉'));
            navigation.navigate('Main');
          } else {
            alertService.show({
              title: tl('جاري معالجة الدفع'),
              message: tl('إذا اكتملت عملية الدفع، سيُفعَّل اشتراكك خلال لحظات. أغلق التطبيق وأعد فتحه إذا لم يتحدث.'),
              confirmText: tl('حسناً'),
            });
          }
        } catch {
          // silent
        } finally {
          setCheckingPayment(false);
        }
      }
    });
    return () => subscription.remove();
  }, [navigation]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const result = await plansService.getPlans();
    if (result.success && result.data) {
      setPlans(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const monthlyPlan = plans.find((p) => p.durationUnit === 'month' && p.durationValue === 1);
  const annualPlan = plans.find((p) => p.durationUnit === 'year');
  const savingsPercent =
    monthlyPlan && annualPlan
      ? Math.round((1 - annualPlan.price / (monthlyPlan.price * 12)) * 100)
      : null;

  const handleSubscribe = async (planId: string) => {
    const user = await authStorage.getUser();
    if (!user) {
      alertService.show({
        title: tl('تسجيل الدخول مطلوب'),
        message: tl('يرجى تسجيل الدخول أولاً لإتمام عملية الاشتراك'),
        confirmText: tl('تسجيل الدخول'),
        cancelText: tl('إلغاء'),
        showCancel: true,
        onConfirm: () => authModalService.show(),
      });
      return;
    }

    setProcessingPlanId(planId);
    try {
      const result = await plansService.createPaymentSession(planId, SUCCESS_URL);
      if (result.success && result.data?.paymentUrl) {
        waitingForPayment.current = true;
        await Linking.openURL(result.data.paymentUrl);
      } else {
        alertService.error(tl('فشل الدفع'), result.error || tl('فشل بدء عملية الدفع، حاول مرة أخرى'));
      }
    } catch {
      alertService.error(tl('خطأ'), tl('حدث خطأ أثناء معالجة الطلب، حاول مرة أخرى'));
    } finally {
      setProcessingPlanId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      {checkingPayment && (
        <View style={[styles.checkingBanner, { backgroundColor: theme.colors.primary }]}>
          <ActivityIndicator color="#FFFFFF" size="small" />
          <Text style={styles.checkingBannerText}>{tl('جاري التحقق من حالة الدفع...')}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient
          colors={['#001D3D', '#003459', theme.colors.primary] as any}
          style={styles.hero}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <View style={styles.heroIconWrapper}>
            <Ionicons name="diamond" size={40} color="#C9A227" />
          </View>
          <Text style={styles.heroTitle}>{tl('استثمر في راحتك المالية')}</Text>
          <Text style={styles.heroSubtitle}>
            {tl('افتح جميع المميزات المتقدمة بسعر رمزي وبدون عقود')}
          </Text>
        </LinearGradient>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                {tl('جاري تحميل الباقات...')}
              </Text>
            </View>
          ) : plans.length > 0 ? (
            plans.map((plan) => {
              const isFeatured = plan.durationUnit === 'year';
              const isProcessing = processingPlanId === plan._id;

              return (
                <View
                  key={plan._id}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.colors.surfaceCard,
                      borderColor: isFeatured ? theme.colors.primary : theme.colors.border,
                    },
                    isFeatured && styles.planCardFeatured,
                  ]}
                >
                  {isFeatured && (
                    <View style={[styles.featuredBadge, { backgroundColor: theme.colors.primary }]}>
                      <Ionicons name="star" size={11} color="#FFFFFF" />
                      <Text style={styles.featuredBadgeText}>{tl('الأفضل توفيراً')}</Text>
                    </View>
                  )}

                  {/* Plan name & price */}
                  <View style={styles.planHeader}>
                    <Text style={[styles.planName, { color: theme.colors.textPrimary }]}>
                      {plan.name}
                    </Text>
                    <View style={styles.planPriceRow}>
                      <Text style={[styles.planPrice, { color: theme.colors.textPrimary }]}>
                        {plan.price.toLocaleString('ar-IQ')}
                      </Text>
                      <Text style={[styles.planCurrency, { color: theme.colors.textSecondary }]}>
                        {' '}د.ع
                      </Text>
                    </View>
                    <View style={[styles.durationBadge, { backgroundColor: theme.colors.surfaceLight }]}>
                      <Text style={[styles.durationText, { color: theme.colors.textSecondary }]}>
                        {getDurationLabel(plan)}
                      </Text>
                    </View>
                    {isFeatured && savingsPercent && savingsPercent > 0 && (
                      <View style={styles.savingsBadge}>
                        <Ionicons name="refresh-circle" size={13} color="#059669" />
                        <Text style={styles.savingsText}>
                          {tl('وفر')} {savingsPercent}% {tl('مقارنة بالشهري')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Features */}
                  <View style={styles.featuresList}>
                    {SHARED_FEATURES.map((feat, idx) => (
                      <View key={idx} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
                        <Text style={[styles.featureText, { color: theme.colors.textSecondary }]}>
                          {feat}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Subscribe button */}
                  <TouchableOpacity
                    onPress={() => handleSubscribe(plan._id)}
                    disabled={!!processingPlanId}
                    activeOpacity={0.85}
                    style={[
                      styles.subscribeButton,
                      { backgroundColor: isFeatured ? theme.colors.primary : '#0f172a' },
                      !!processingPlanId && styles.subscribeButtonDisabled,
                    ]}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.subscribeButtonText}>{tl('اشترك الآن')}</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Trust badges per card */}
                  <View style={styles.trustRow}>
                    <View style={styles.trustItem}>
                      <Ionicons name="shield-checkmark-outline" size={11} color={theme.colors.primary} />
                      <Text style={[styles.trustText, { color: theme.colors.textMuted }]}>
                        {tl('دفع آمن مشفر')}
                      </Text>
                    </View>
                    <View style={styles.trustItem}>
                      <Ionicons name="refresh-outline" size={11} color={theme.colors.primary} />
                      <Text style={[styles.trustText, { color: theme.colors.textMuted }]}>
                        {tl('ضمان 7 أيام')}
                      </Text>
                    </View>
                    <View style={styles.trustItem}>
                      <Ionicons name="lock-closed-outline" size={11} color={theme.colors.primary} />
                      <Text style={[styles.trustText, { color: theme.colors.textMuted }]}>
                        {tl('SSL محمي')}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="card-outline" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                {tl('تعذر تحميل الباقات. حاول مرة أخرى لاحقاً.')}
              </Text>
              <TouchableOpacity onPress={fetchPlans} style={[styles.retryButton, { borderColor: theme.colors.primary }]}>
                <Text style={[styles.retryButtonText, { color: theme.colors.primary }]}>
                  {tl('إعادة المحاولة')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom global trust line */}
        {!loading && plans.length > 0 && (
          <View style={styles.bottomTrust}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.trustText, { color: theme.colors.textMuted }]}>
                {tl('دفع آمن بتشفير SSL')}
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="refresh-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.trustText, { color: theme.colors.textMuted }]}>
                {tl('ضمان استرداد 7 أيام')}
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="lock-closed-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.trustText, { color: theme.colors.textMuted }]}>
                {tl('لا رسوم مخفية')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 32,
      direction: isRTL ? 'rtl' : 'ltr',
    },

    // Hero Card
    hero: {
      marginHorizontal: 16,
      marginTop: 16,
      paddingVertical: 40,
      paddingHorizontal: 24,
      borderRadius: 28,
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      ...getPlatformShadow('lg'),
    },
    heroIconWrapper: {
      width: 80,
      height: 80,
      borderRadius: 24,
      backgroundColor: 'rgba(201, 162, 39, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderWidth: 1.5,
      borderColor: 'rgba(201, 162, 39, 0.25)',
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: getPlatformFontWeight('900'),
      color: '#FFFFFF',
      fontFamily: theme.typography.fontFamily,
      textAlign: 'center',
      marginBottom: 10,
      letterSpacing: -0.5,
    },
    heroSubtitle: {
      fontSize: 15,
      color: 'rgba(255, 255, 255, 0.85)',
      fontFamily: theme.typography.fontFamily,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 10,
    },

    // Plans
    plansContainer: {
      paddingHorizontal: 16,
      paddingTop: 20,
      gap: 16,
    },
    loadingContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      fontFamily: theme.typography.fontFamily,
    },

    // Plan card
    planCard: {
      borderRadius: 20,
      borderWidth: 1.5,
      padding: 20,
      ...getPlatformShadow('sm'),
    },
    planCardFeatured: {
      ...getPlatformShadow('md'),
    },

    // Featured badge
    featuredBadge: {
      position: 'absolute',
      top: -14,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: 20,
    },
    featuredBadgeText: {
      fontSize: 12,
      fontWeight: getPlatformFontWeight('700'),
      color: '#FFFFFF',
      fontFamily: theme.typography.fontFamily,
    },

    // Plan header
    planHeader: {
      alignItems: 'center',
      marginBottom: 20,
      paddingTop: 8,
    },
    planName: {
      fontSize: 16,
      fontWeight: getPlatformFontWeight('700'),
      fontFamily: theme.typography.fontFamily,
      marginBottom: 8,
    },
    planPriceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      direction: 'ltr', // Keep price numeric format LTR for consistency
    },
    planPrice: {
      fontSize: 32,
      fontWeight: getPlatformFontWeight('900'),
      fontFamily: theme.typography.fontFamily,
    },
    planCurrency: {
      fontSize: 14,
      fontWeight: getPlatformFontWeight('600'),
      fontFamily: theme.typography.fontFamily,
    },
    durationBadge: {
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 4,
      borderRadius: 20,
    },
    durationText: {
      fontSize: 12,
      fontFamily: theme.typography.fontFamily,
    },
    savingsBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      backgroundColor: '#D1FAE5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    savingsText: {
      fontSize: 12,
      fontWeight: getPlatformFontWeight('600'),
      color: '#059669',
      fontFamily: theme.typography.fontFamily,
    },

    // Features
    featuresList: {
      gap: 12,
      marginBottom: 20,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    featureText: {
      fontSize: 14,
      fontFamily: theme.typography.fontFamily,
      flex: 1,
      textAlign: 'left',
    },

    // Subscribe button
    subscribeButton: {
      height: 52,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 12,
    },
    subscribeButtonDisabled: {
      opacity: 0.6,
    },
    subscribeButtonText: {
      fontSize: 16,
      fontWeight: getPlatformFontWeight('700'),
      color: '#FFFFFF',
      fontFamily: theme.typography.fontFamily,
    },

    // Trust badges
    trustRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    trustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    trustText: {
      fontSize: 11,
      fontFamily: theme.typography.fontFamily,
    },

    // Empty state
    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: theme.typography.fontFamily,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 4,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
    },
    retryButtonText: {
      fontSize: 14,
      fontWeight: getPlatformFontWeight('600'),
      fontFamily: theme.typography.fontFamily,
    },

    // Checking payment banner
    checkingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    checkingBannerText: {
      fontSize: 14,
      fontWeight: getPlatformFontWeight('600'),
      color: '#FFFFFF',
      fontFamily: theme.typography.fontFamily,
    },

    // Bottom trust
    bottomTrust: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
  });
