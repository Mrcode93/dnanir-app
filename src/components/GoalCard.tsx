import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { FinancialGoal, GOAL_CATEGORIES } from '../types';
import { formatCurrency } from '../services/financialService';

interface GoalCardProps {
  goal: FinancialGoal;
  onPress: () => void;
}

// Get gradient colors based on category
const getCategoryGradient = (category: string, isCompleted: boolean): string[] => {
  if (isCompleted) {
    return theme.gradients.success;
  }
  
  const gradientMap: Record<string, string[]> = {
    emergency: theme.gradients.goalRose,
    vacation: theme.gradients.goalBlue,
    car: theme.gradients.goalOrange,
    house: theme.gradients.goalIndigo,
    wedding: theme.gradients.goalPink,
    education: theme.gradients.goalTeal,
    business: theme.gradients.goalEmerald,
    other: theme.gradients.goalPurple,
  };
  
  return gradientMap[category] || theme.gradients.goalPurple;
};

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onPress }) => {
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const categoryInfo = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.other;
  const remaining = goal.targetAmount - goal.currentAmount;
  const isCompleted = goal.completed || progress >= 100;
  const gradientColors = getCategoryGradient(goal.category, isCompleted);

  // Calculate days remaining if target date exists
  let daysRemaining: number | null = null;
  if (goal.targetDate && !isCompleted) {
    const target = new Date(goal.targetDate);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.cardWrapper}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.15)']}
            style={styles.iconContainer}
          >
            <Ionicons name={categoryInfo.icon as any} size={24} color={theme.colors.textInverse} />
          </LinearGradient>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {goal.title}
            </Text>
            <Text style={styles.category}>{categoryInfo.label}</Text>
          </View>
          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
            </View>
          )}
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressFill,
                { width: `${Math.min(progress, 100)}%` },
              ]}
            />
          </View>
          <View style={styles.progressText}>
            <Text style={styles.progressPercent}>
              {Math.round(progress)}%
            </Text>
          </View>
        </View>

        <View style={styles.amountContainer}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>المحقق</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(goal.currentAmount)}
            </Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>المستهدف</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(goal.targetAmount)}
            </Text>
          </View>
        </View>

        {!isCompleted && remaining > 0 && (
          <View style={styles.remainingContainer}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textInverse} />
            <Text style={styles.remainingText}>
              متبقي: {formatCurrency(remaining)}
              {daysRemaining !== null && daysRemaining > 0 && (
                <Text> • {daysRemaining} يوم</Text>
              )}
            </Text>
          </View>
        )}

        {isCompleted && (
          <View style={styles.completedContainer}>
            <Ionicons name="trophy" size={16} color={theme.colors.textInverse} />
            <Text style={styles.completedText}>تم إنجاز الهدف! 🎉</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: theme.spacing.md,
  },
  card: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.lg,
    overflow: 'hidden',
    direction: 'rtl',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...(isRTL ? { marginLeft: theme.spacing.md } : { marginRight: theme.spacing.md }),
    ...theme.shadows.sm,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  category: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  completedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.round,
    padding: theme.spacing.xs,
  },
  progressContainer: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.round,
  },
  progressText: {
    alignItems: 'flex-end',
  },
  progressPercent: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  amountRow: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  amountValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  remainingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  remainingText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  completedText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
