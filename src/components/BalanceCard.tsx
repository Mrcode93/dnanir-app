import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { usePrivacy } from '../context/PrivacyContext';
import { MonthFilter } from './MonthFilter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BalanceCardProps {
  balance: number;
  userName?: string;
  selectedMonth?: { year: number; month: number };
  onMonthChange?: (year: number, month: number) => void;
  showFilter?: boolean;
  availableMonths?: Array<{ year: number; month: number }>;
  onCurrencyPress?: () => void;
}

const BalanceCardComponent: React.FC<BalanceCardProps> = ({
  balance,
  userName,
  selectedMonth,
  onMonthChange,
  showFilter = true,
  availableMonths,
  onCurrencyPress,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency, currencyCode } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const isPositive = balance >= 0;

  const formattedBalance = formatCurrency(balance);

  // Get month label (keeping original Arabic logic)
  const getMonthLabel = () => {
    if (!selectedMonth || (selectedMonth.year === 0 && selectedMonth.month === 0)) {
      return 'الكل';
    }
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${monthNames[selectedMonth.month - 1]} ${selectedMonth.year}`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2563EB', '#3B82F6', '#60A5FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Decorative waves */}
        <View style={styles.wave1} />
        <View style={styles.wave2} />

        {/* Top Section: Brand and Filter */}
        <View style={styles.topSection}>
          <View style={styles.brandBadge}>
            <View style={styles.brandIconContainer}>
              <Ionicons name="wallet" size={14} color="#FFF" />
            </View>
            <Text style={styles.brandText}>دنانير</Text>
          </View>

          <View style={styles.topRight}>
            {isPositive && (
              <View style={styles.trendBadge}>
                <Ionicons name="trending-up" size={14} color="#FFFFFF" />
              </View>
            )}
            {showFilter && onMonthChange && (
              <View style={styles.filterWrapper}>
                <MonthFilter
                  selectedMonth={selectedMonth || null}
                  onMonthChange={onMonthChange}
                  showAllOption={true}
                  availableMonths={availableMonths}
                  style={styles.filterButton}
                  textColor="#FFFFFF"
                  iconColor="#FFFFFF"
                  arrowColor="rgba(255, 255, 255, 0.7)"
                />
              </View>
            )}
          </View>
        </View>

        {/* Dashed Line with Ticket Cutouts */}
        <View style={styles.dividerContainer}>
          <View style={styles.cutoutLeft} />
          <View style={styles.dashedLine} />
          <View style={styles.cutoutRight} />
        </View>

        {/* Bottom Section: Greeting, Balance and Label */}
        <View style={styles.bottomSection}>
          {userName && (
            <Text style={styles.greeting}>مرحباً، {userName}</Text>
          )}

          <View style={styles.balanceContentRow}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>الرصيد الكلي</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.balanceAmount}>
                  {isPrivacyEnabled ? '****' : formattedBalance}
                </Text>
                {!isPositive && (
                  <Ionicons name="alert-circle" size={20} color="#FCA5A5" style={styles.warningIcon} />
                )}
              </View>
            </View>

            {onCurrencyPress && (
              <TouchableOpacity
                onPress={onCurrencyPress}
                style={styles.currencyButtonWrapper}
                activeOpacity={0.7}
              >
                <View style={[styles.currencyProfileBtn, { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' }]}>
                  <Text style={[styles.currencyBtnText, { color: '#FFFFFF', fontWeight: 'bold' }]}>
                    {currencyCode}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0) && (
            <View style={styles.periodRow}>
              <View style={styles.periodDot} />
              <Text style={styles.periodLabel}>
                رصيد {getMonthLabel()}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

export const BalanceCard = React.memo(BalanceCardComponent);
BalanceCard.displayName = 'BalanceCard';

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  card: {
    borderRadius: theme.borderRadius.xl,
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
    direction: isRTL ? 'ltr' : 'rtl',
  },
  wave1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -100,
    right: -50,
  },
  wave2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -40,
    left: -30,
  },

  // Top Section
  topSection: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    zIndex: 1,
  },
  brandBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  brandIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(isRTL ? { marginLeft: 6 } : { marginRight: 6 }),
  },
  brandText: {
    color: '#FFF',
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily,
  },
  topRight: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  trendBadge: {
    width: 28,
    height: 28,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterWrapper: {
    // Spacer
  },
  filterButton: {
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minHeight: 32,
  },

  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
    height: 20,
    width: '100%',
    position: 'relative',
    zIndex: 2,
  },
  cutoutLeft: {
    width: 12,
    height: 20,
    backgroundColor: theme.colors.background,
    borderTopRightRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
    position: 'absolute',
    left: 0,
  },
  cutoutRight: {
    width: 12,
    height: 20,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderBottomLeftRadius: theme.borderRadius.xl,
    position: 'absolute',
    right: 0,
  },
  dashedLine: {
    flex: 1,
    height: 0,
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 16,
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    zIndex: 1,
  },
  greeting: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: getPlatformFontWeight('400'),
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: isRTL ? 'right' : 'left',
  },
  balanceContentRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceRow: {
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  balanceLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  currencyButtonWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyProfileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currencyBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
  },
  amountContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  warningIcon: {
    ...(isRTL ? { marginRight: 8 } : { marginLeft: 8 }),
  },
  periodRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  periodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    opacity: 0.6,
    ...(isRTL ? { marginLeft: 8 } : { marginRight: 8 }),
  },
  periodLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    letterSpacing: 0.2,
  },
});
