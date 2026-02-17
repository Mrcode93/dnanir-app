import React from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { usePrivacy } from '../context/PrivacyContext';
import { MonthFilter } from './MonthFilter';

interface BalanceCardProps {
  balance: number;
  userName?: string;
  selectedMonth?: { year: number; month: number };
  onMonthChange?: (year: number, month: number) => void;
  showFilter?: boolean;
  availableMonths?: Array<{ year: number; month: number }>;
}

const BalanceCardComponent: React.FC<BalanceCardProps> = ({
  balance,
  userName,
  selectedMonth,
  onMonthChange,
  showFilter = true,
  availableMonths,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const isPositive = balance >= 0;

  // Richer 4-stop gradient for a more premium feel
  const gradientColors = isPositive
    ? ['#001D33', '#003459', '#00527A', '#006A9E'] as const
    : ['#001D33', '#002640', '#003459', '#004060'] as const;

  const formattedBalance = formatCurrency(balance);

  // Get month label
  const getMonthLabel = () => {
    if (!selectedMonth || (selectedMonth.year === 0 && selectedMonth.month === 0)) {
      return 'الكل';
    }
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${monthNames[selectedMonth.month - 1]} ${selectedMonth.year}`;
  };

  return (
    <>
      <LinearGradient
        colors={gradientColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Decorative geometric elements */}
        <View style={styles.decorCircleTopRight} />
        <View style={styles.decorCircleBottomLeft} />
        <View style={styles.decorRectTopLeft} />
        <View style={styles.decorDotPattern}>
          <View style={styles.decorDot} />
          <View style={styles.decorDot} />
          <View style={styles.decorDot} />
        </View>

        {/* Glassmorphic top bar */}
        <View style={styles.topBar}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.08)']}
            style={styles.brandBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.brandIconContainer}>
              <Ionicons name="wallet" size={16} color="#FFF" />
            </View>
            <Text style={styles.brandText}>دنانير</Text>
          </LinearGradient>

          <View style={styles.topBarRight}>
            {isPositive && (
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.2)']}
                style={styles.trendBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="trending-up" size={14} color="#34D399" />
              </LinearGradient>
            )}
            {/* Month Filter */}
            {showFilter && onMonthChange && (
              <View style={styles.filterContainer}>
                <MonthFilter
                  selectedMonth={selectedMonth || null}
                  onMonthChange={onMonthChange}
                  showAllOption={true}
                  availableMonths={availableMonths}
                  style={styles.filterButton}
                />
              </View>
            )}
          </View>
        </View>

        {/* Balance section */}
        <View style={styles.balanceSection}>
          {userName && (
            <Text style={styles.greeting}>مرحباً، {userName}</Text>
          )}

          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>
              {isPrivacyEnabled ? '****' : formattedBalance}
            </Text>
            {!isPositive && (
              <View style={styles.warningBadge}>
                <Ionicons name="alert-circle" size={18} color="#FCA5A5" />
              </View>
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

        {/* Subtle bottom accent line */}
        <View style={styles.accentLine}>
          <LinearGradient
            colors={['transparent', 'rgba(96, 165, 250, 0.5)', 'rgba(59, 130, 246, 0.4)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentLineGradient}
          />
        </View>
      </LinearGradient>
    </>
  );
};

export const BalanceCard = React.memo(BalanceCardComponent);
BalanceCard.displayName = 'BalanceCard';

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    paddingBottom: 16,
    minHeight: 180,
    ...getPlatformShadow('xl'),
    overflow: 'hidden',
    position: 'relative',
    direction: isRTL ? 'ltr' : 'rtl',
  },

  // Decorative elements
  decorCircleTopRight: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    top: -60,
    ...(isRTL ? { left: -40 } : { right: -40 }),
  },
  decorCircleBottomLeft: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    bottom: -30,
    ...(isRTL ? { right: -20 } : { left: -20 }),
  },
  decorRectTopLeft: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    top: 20,
    ...(isRTL ? { right: 60 } : { left: 60 }),
    transform: [{ rotate: '25deg' }],
  },
  decorDotPattern: {
    position: 'absolute',
    bottom: 40,
    ...(isRTL ? { left: 20 } : { right: 20 }),
    flexDirection: 'column',
    gap: 6,
  },
  decorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Top bar
  topBar: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 1,
  },
  brandBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(isRTL ? { marginLeft: 8 } : { marginRight: 8 }),
  },
  brandText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    letterSpacing: 0.8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  topBarRight: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  filterContainer: {
    // Container for MonthFilter
  },
  filterButton: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 120,
    maxWidth: 160,
    ...getPlatformShadow('md'),
  },

  // Balance section
  balanceSection: {
    zIndex: 1,
    paddingLeft: isRTL ? 0 : 4,
    paddingRight: isRTL ? 4 : 0,
  },
  greeting: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily,
    marginBottom: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  balanceRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    letterSpacing: -1,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  warningBadge: {
    ...(isRTL ? { marginRight: 10 } : { marginLeft: 10 }),
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  periodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
    ...(isRTL ? { marginLeft: 8 } : { marginRight: 8 }),
  },
  periodLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    letterSpacing: 0.3,
  },

  // Accent line
  accentLine: {
    marginTop: 16,
    marginHorizontal: -20,
    height: 1,
  },
  accentLineGradient: {
    flex: 1,
    height: 1,
  },
});
