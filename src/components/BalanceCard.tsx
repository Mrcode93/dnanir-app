import React from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { MonthFilter } from './MonthFilter';

interface BalanceCardProps {
  balance: number;
  userName?: string;
  selectedMonth?: { year: number; month: number };
  onMonthChange?: (year: number, month: number) => void;
  showFilter?: boolean;
  availableMonths?: Array<{ year: number; month: number }>;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ 
  balance, 
  userName, 
  selectedMonth,
  onMonthChange,
  showFilter = true,
  availableMonths,
}) => {
  const { formatCurrency } = useCurrency();
  const isPositive = balance >= 0;
  
  // Use theme gradients based on #003459
  const gradientColors = isPositive 
    ? theme.gradients.primary // Primary gradient (positive)
    : ['#004D73', '#003459', '#002640'] as const; // Darker gradient (negative)
  
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
        {/* Decorative circles */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        
        <View style={styles.header}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.15)']}
            style={styles.badge}
          >
            <Ionicons name="wallet" size={18} color={theme.colors.textInverse} />
            <Text style={styles.badgeText}>دنانير</Text>
          </LinearGradient>
          <View style={styles.headerRight}>
            {isPositive && (
              <View style={styles.statusBadge}>
                <Ionicons name="trending-up" size={16} color={theme.colors.textInverse} />
              </View>
            )}
            {/* Month Filter Button in Header */}
            {showFilter && onMonthChange && (
              <View style={styles.headerFilterButtonContainer}>
                <MonthFilter
                  selectedMonth={selectedMonth || null}
                  onMonthChange={onMonthChange}
                  showAllOption={true}
                  availableMonths={availableMonths}
                  style={styles.headerFilterButton}
                />
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.body}>
          {userName && (
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>مرحباً، {userName}</Text>
            </View>
          )}
          
          <View style={styles.balanceContainer}>
            <Text style={styles.balance}>
              {formattedBalance}
            </Text>
            {!isPositive && (
              <View style={styles.warningIcon}>
                <Ionicons name="alert-circle" size={20} color={theme.colors.textInverse} />
              </View>
            )}
          </View>
          {selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0) && (
            <Text style={styles.periodLabel}>
              رصيد {getMonthLabel()}
            </Text>
          )}
        </View>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    minHeight: 140,
    ...theme.shadows.lg,
    overflow: 'hidden',
    position: 'relative',
    direction: 'rtl',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -40,
    ...(isRTL ? { left: -40 } : { right: -40 }),
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    bottom: -20,
    ...(isRTL ? { right: -20 } : { left: -20 }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    zIndex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerFilterButtonContainer: {
    // Container for MonthFilter component
  },
  headerFilterButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    minWidth: 120,
    maxWidth: 160,
    ...theme.shadows.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  badgeText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily,
    letterSpacing: 1,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.sm,
  },
  body: {
    alignItems: isRTL ? 'flex-start' : 'flex-start',
    zIndex: 1,
  },
  greetingContainer: {
    marginBottom: theme.spacing.sm,
  },
  greeting: {
    fontSize: theme.typography.sizes.lg,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: theme.spacing.sm,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    letterSpacing: 0.5,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balance: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.textInverse,
    letterSpacing: -1.5,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  warningIcon: {
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    opacity: 0.9,
  },
  filterButton: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  filterButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  filterButtonText: {
    flex: 1,
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  periodLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
