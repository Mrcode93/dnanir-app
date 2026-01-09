import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../utils/theme';
import { Expense, Income } from '../types';
import { isRTL } from '../utils/rtl';
import { ConfirmAlert } from './ConfirmAlert';

interface TransactionItemProps {
  item: Expense | Income;
  type: 'expense' | 'income';
  onPress?: () => void;
  onDelete?: () => void;
  formatCurrency: (amount: number) => string;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  item,
  type,
  onPress,
  onDelete,
  formatCurrency,
}) => {
  const [swipeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);

  const isExpense = type === 'expense';
  const expense = isExpense ? (item as Expense) : null;
  const income = !isExpense ? (item as Income) : null;

  const getCategoryIcon = (category?: string): keyof typeof Ionicons.glyphMap => {
    if (!category) return 'wallet-outline';
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      food: 'restaurant',
      transport: 'car',
      shopping: 'bag',
      bills: 'receipt',
      entertainment: 'musical-notes',
      health: 'medical',
      education: 'school',
      other: 'ellipse',
    };
    return iconMap[category] || 'wallet-outline';
  };

  const getCategoryColor = (category?: string): string[] => {
    if (!category) return ['#6B7280', '#4B5563'];
    const colorMap: Record<string, string[]> = {
      food: ['#F59E0B', '#D97706'],
      transport: ['#3B82F6', '#2563EB'],
      shopping: ['#EC4899', '#DB2777'],
      bills: ['#EF4444', '#DC2626'],
      entertainment: ['#8B5CF6', '#7C3AED'],
      health: ['#10B981', '#059669'],
      education: ['#06B6D4', '#0891B2'],
      other: ['#6B7280', '#4B5563'],
    };
    return colorMap[category] || ['#6B7280', '#4B5563'];
  };

  const getCategoryLabel = (category?: string): string => {
    if (!category) return 'أخرى';
    const labelMap: Record<string, string> = {
      food: 'طعام',
      transport: 'مواصلات',
      shopping: 'تسوق',
      bills: 'فواتير',
      entertainment: 'ترفيه',
      health: 'صحة',
      education: 'تعليم',
      other: 'أخرى',
    };
    return labelMap[category] || 'أخرى';
  };

  const icon = isExpense ? getCategoryIcon(expense?.category) : 'trending-up';
  const title = isExpense ? expense!.title : income!.source;
  const amount = item.amount;
  const date = new Date(item.date);
  const formattedDate = date.toLocaleDateString('ar-IQ', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const colors = isExpense ? getCategoryColor(expense?.category) : ['#10B981', '#059669'];
  const categoryLabel = isExpense ? getCategoryLabel(expense?.category) : '';

  const handleDelete = () => {
    setShowConfirmAlert(true);
  };

  const handleConfirmDelete = () => {
    setShowConfirmAlert(false);
    Animated.parallel([
      Animated.timing(swipeAnim, {
        toValue: isRTL ? 400 : -400,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDelete?.();
    });
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateX: swipeAnim },
              { scale: scaleAnim },
            ],
            opacity: swipeAnim.interpolate({
              inputRange: isRTL ? [0, 400] : [-400, 0],
              outputRange: isRTL ? [1, 0] : [0, 1],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={onPress}
          onLongPress={handleDelete}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[colors[0] + '15', colors[1] + '08']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            {/* Icon Section */}
            <View style={styles.iconSection}>
              <View style={[styles.iconWrapper, { borderColor: colors[0] + '30' }]}>
                <LinearGradient
                  colors={colors}
                  style={styles.iconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={icon} size={24} color="#FFFFFF" />
                </LinearGradient>
              </View>
            </View>

            {/* Content Section */}
            <View style={styles.contentSection}>
              <View style={styles.headerRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <View style={styles.amountWrapper}>
                  <LinearGradient
                    colors={isExpense ? ['#EF4444', '#DC2626'] : ['#10B981', '#059669']}
                    style={styles.amountBadge}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.amount}>
                      {isExpense ? '-' : '+'}{formatCurrency(amount)}
                    </Text>
                  </LinearGradient>
                </View>
              </View>

              <View style={styles.footerRow}>
                <View style={styles.metaInfo}>
                  <View style={styles.dateInfo}>
                    <Ionicons name="calendar" size={14} color={theme.colors.textMuted} />
                    <Text style={styles.dateText}>{formattedDate}</Text>
                  </View>
                  <View style={styles.timeInfo}>
                    <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={styles.timeText}>{formattedTime}</Text>
                  </View>
                </View>
                {categoryLabel && (
                  <View style={[styles.categoryTag, { backgroundColor: colors[0] + '20' }]}>
                    <Text style={[styles.categoryText, { color: colors[0] }]}>
                      {categoryLabel}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Arrow Icon */}
            <View style={styles.arrowSection}>
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={20}
                color={theme.colors.textMuted}
              />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Delete Button */}
      {onDelete && (
        <Animated.View
          style={[
            styles.deleteContainer,
            {
              opacity: swipeAnim.interpolate({
                inputRange: isRTL ? [0, 100, 400] : [-400, -100, 0],
                outputRange: isRTL ? [0, 1, 1] : [1, 1, 0],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.deleteGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="trash" size={22} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ConfirmAlert
        visible={showConfirmAlert}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف ${isExpense ? 'هذا المصروف' : 'هذا الدخل'}؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirmAlert(false)}
        type="danger"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
  },
  container: {
    width: '100%',
  },
  card: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  cardGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    minHeight: 80,
  },
  iconSection: {
    ...(isRTL ? { marginLeft: theme.spacing.md } : { marginRight: theme.spacing.md }),
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    ...theme.shadows.sm,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentSection: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
  },
  amountWrapper: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  amountBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  amount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaInfo: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  dateInfo: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  timeInfo: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  categoryTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  categoryText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
  },
  arrowSection: {
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    justifyContent: 'center',
  },
  deleteContainer: {
    position: 'absolute',
    ...(isRTL ? { left: 0 } : { right: 0 }),
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  deleteGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
