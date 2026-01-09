import React from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';

interface BalanceCardProps {
  balance: number;
  userName?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ balance, userName }) => {
  const isPositive = balance >= 0;
  
  // Blue gradient for balance card
  const gradientColors = isPositive 
    ? ['#3B82F6', '#2563EB', '#1D4ED8'] as const // Blue gradient (positive)
    : ['#60A5FA', '#3B82F6', '#2563EB'] as const; // Lighter blue gradient (negative)
  
  const formattedBalance = new Intl.NumberFormat('ar-IQ', {
    style: 'currency',
    currency: 'IQD',
    minimumFractionDigits: 0,
  }).format(balance);

  return (
    <LinearGradient
      colors={[...gradientColors]}
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
        {isPositive && (
          <View style={styles.statusBadge}>
            <Ionicons name="trending-up" size={16} color={theme.colors.textInverse} />
          </View>
        )}
      </View>
      
      <View style={styles.body}>
        {userName && (
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>مرحباً، {userName} 👋</Text>
          </View>
        )}
        <Text style={styles.label}>الرصيد الحالي</Text>
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
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    minHeight: 200,
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
    marginBottom: theme.spacing.xl,
    zIndex: 1,
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
    marginBottom: theme.spacing.md,
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
    fontSize: 40,
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
});
