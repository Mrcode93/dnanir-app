import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, I18nManager, Modal, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles, type AppTheme } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { FinancialGoal, GOAL_CATEGORIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { calculateAverageMonthlySavings, calculateTimeToReachGoal } from '../services/financialService';
import { ConfirmAlert } from './ConfirmAlert';
import { usePrivacy } from '../context/PrivacyContext';

interface GoalCardProps {
  goal: FinancialGoal;
  onEdit?: () => void;
  onDelete?: () => void;
  onPlan?: () => void;
}

// Get gradient colors based on category
const getCategoryGradient = (category: string, isCompleted: boolean, theme: AppTheme): readonly string[] => {
  if (isCompleted) {
    return theme.gradients.success;
  }

  const gradientMap: Record<string, readonly string[]> = {
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

const GoalCardComponent: React.FC<GoalCardProps> = ({ goal, onEdit, onDelete, onPlan }) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { formatCurrency, currencyCode } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const goalCurrency = goal.currency || currencyCode;
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const categoryInfo = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.other;
  const remaining = goal.targetAmount - goal.currentAmount;
  const isCompleted = goal.completed || progress >= 100;
  const gradientColors = getCategoryGradient(goal.category, isCompleted, theme);
  const [convertedTargetAmount, setConvertedTargetAmount] = useState<number | null>(null);
  const [convertedCurrentAmount, setConvertedCurrentAmount] = useState<number | null>(null);
  const [convertedRemaining, setConvertedRemaining] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<{ months: number | null; days: number | null; formatted: string } | null>(null);
  const [averageMonthlySavings, setAverageMonthlySavings] = useState<number | null>(null);

  // Convert amounts if currency is different
  useEffect(() => {
    const convertAmounts = async () => {
      if (goalCurrency !== currencyCode) {
        try {
          const convertedTarget = await convertCurrency(goal.targetAmount, goalCurrency, currencyCode);
          const convertedCurrent = await convertCurrency(goal.currentAmount, goalCurrency, currencyCode);
          const convertedRem = await convertCurrency(remaining, goalCurrency, currencyCode);
          setConvertedTargetAmount(convertedTarget);
          setConvertedCurrentAmount(convertedCurrent);
          setConvertedRemaining(convertedRem);
        } catch (error) {
          console.error('Error converting currency:', error);
          setConvertedTargetAmount(null);
          setConvertedCurrentAmount(null);
          setConvertedRemaining(null);
        }
      } else {
        setConvertedTargetAmount(null);
        setConvertedCurrentAmount(null);
        setConvertedRemaining(null);
      }
    };

    convertAmounts();
  }, [goal.targetAmount, goal.currentAmount, remaining, goalCurrency, currencyCode]);

  // Calculate estimated time to reach goal
  useEffect(() => {
    const calculateTime = async () => {
      if (isCompleted || remaining <= 0) {
        setEstimatedTime({ months: 0, days: 0, formatted: 'مكتمل' });
        setAverageMonthlySavings(null);
        return;
      }

      try {
        // Get average monthly savings
        const avgSavings = await calculateAverageMonthlySavings(6);
        setAverageMonthlySavings(avgSavings);

        // Convert remaining amount to primary currency if needed
        let remainingInPrimaryCurrency = remaining;
        if (goalCurrency !== currencyCode) {
          try {
            remainingInPrimaryCurrency = await convertCurrency(remaining, goalCurrency, currencyCode);
          } catch (error) {
            console.error('Error converting remaining amount for time calculation:', error);
          }
        }

        const timeEstimate = calculateTimeToReachGoal(remainingInPrimaryCurrency, avgSavings);
        setEstimatedTime(timeEstimate);
      } catch (error) {
        console.error('Error calculating estimated time:', error);
        setEstimatedTime(null);
        setAverageMonthlySavings(null);
      }
    };

    calculateTime();
  }, [goal.id, remaining, isCompleted, goalCurrency, currencyCode]);

  // Calculate days remaining if target date exists
  let daysRemaining: number | null = null;
  if (goal.targetDate && !isCompleted) {
    const target = new Date(goal.targetDate);
    const now = new Date();
    const diff = target.getTime() - now.getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const handleConfirmDelete = () => {
    setShowConfirmAlert(false);
    onDelete?.();
  };

  return (
    <View
      style={styles.cardWrapper}
    >
      <LinearGradient
        colors={gradientColors as any}
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
          <View style={styles.headerRight}>
            {isCompleted && (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              </View>
            )}
            <TouchableOpacity
              style={styles.menuButton}
              onPress={(e) => {
                e.stopPropagation();
                setShowMenu(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textInverse} />
            </TouchableOpacity>
          </View>
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
              {isPrivacyEnabled ? '**%' : `${Math.round(progress)}%`}
            </Text>
          </View>
        </View>

        <View style={styles.amountContainer}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>المحقق</Text>
            <View>
              <Text style={styles.amountValue}>
                {isPrivacyEnabled ? '****' : formatCurrencyAmount(goal.currentAmount, goalCurrency)}
              </Text>
              {convertedCurrentAmount !== null && goalCurrency !== currencyCode && (
                <Text style={styles.convertedAmount}>
                  ≈ {formatCurrency(convertedCurrentAmount)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>المستهدف</Text>
            <View>
              <Text style={styles.amountValue}>
                {isPrivacyEnabled ? '****' : formatCurrencyAmount(goal.targetAmount, goalCurrency)}
              </Text>
              {convertedTargetAmount !== null && goalCurrency !== currencyCode && (
                <Text style={styles.convertedAmount}>
                  ≈ {formatCurrency(convertedTargetAmount)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {!isCompleted && remaining > 0 && (
          <View style={styles.remainingContainer}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textInverse} />
            <View style={styles.remainingInfo}>
              <Text style={styles.remainingText}>
                متبقي: {isPrivacyEnabled ? '****' : formatCurrencyAmount(remaining, goalCurrency)}
                {!isPrivacyEnabled && daysRemaining !== null && daysRemaining > 0 && (
                  <Text> • {daysRemaining} يوم</Text>
                )}
              </Text>
              {convertedRemaining !== null && goalCurrency !== currencyCode && (
                <Text style={styles.convertedRemainingText}>
                  ≈ {formatCurrency(convertedRemaining)}
                </Text>
              )}
              {estimatedTime && estimatedTime.formatted !== 'مكتمل' && (
                <View style={styles.estimatedTimeContainer}>
                  <Ionicons name="hourglass-outline" size={12} color={theme.colors.textInverse} />
                  <View style={styles.estimatedTimeContent}>
                    <Text style={styles.estimatedTimeText}>
                      الوقت المتوقع: {isPrivacyEnabled ? '****' : estimatedTime.formatted}
                    </Text>
                    {averageMonthlySavings !== null && averageMonthlySavings > 0 && (
                      <Text style={styles.estimatedTimeExplanation}>
                        (بناءً على متوسط ادخار شهري: {formatCurrency(averageMonthlySavings)})
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {isCompleted && (
          <View style={styles.completedContainer}>
            <Ionicons name="trophy" size={16} color={theme.colors.textInverse} />
            <Text style={styles.completedText}>تم إنجاز الهدف!</Text>
          </View>
        )}
      </LinearGradient>

      <ConfirmAlert
        visible={showConfirmAlert}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذا الهدف؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirmAlert(false)}
        type="danger"
      />

      {/* Options Menu */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            {onPlan && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  onPlan();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
                <Text style={styles.menuItemText}>خطة بالذكاء الاصطناعي</Text>
              </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  onEdit();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.menuItemText}>تعديل</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDanger]}
                onPress={() => {
                  setShowMenu(false);
                  setShowConfirmAlert(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>حذف</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export const GoalCard = React.memo(GoalCardComponent);
GoalCard.displayName = 'GoalCard';

const createStyles = (theme: AppTheme) => StyleSheet.create({
  cardWrapper: {
    marginBottom: theme.spacing.md,
  },
  card: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...getPlatformShadow('lg'),
    overflow: 'hidden',
    direction: 'ltr',
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
    ...getPlatformShadow('sm'),
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  completedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.round,
    padding: theme.spacing.xs,
  },
  menuButton: {
    padding: theme.spacing.xs,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    minWidth: 150,
    ...getPlatformShadow('lg'),
  },
  menuItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  menuItemDanger: {
    marginTop: theme.spacing.xs,
  },
  menuItemText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  menuItemTextDanger: {
    color: theme.colors.error,
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
    ...getPlatformShadow('sm'),
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
    fontWeight: getPlatformFontWeight('600'),
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
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  convertedAmount: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('500'),
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    fontStyle: 'italic',
  },
  convertedRemainingText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('500'),
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    fontStyle: 'italic',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  remainingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  remainingInfo: {
    flex: 1,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
  },
  remainingText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: theme.spacing.xs,
  },
  estimatedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    width: '100%',
  },
  estimatedTimeContent: {
    flex: 1,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
  },
  estimatedTimeText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  estimatedTimeExplanation: {
    fontSize: theme.typography.sizes.xs - 1,
    color: 'rgba(255, 255, 255, 0.75)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontStyle: 'italic',
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
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
