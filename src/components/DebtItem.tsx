import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../utils/theme';
import { Debt } from '../types';
import { isRTL } from '../utils/rtl';
import { ConfirmAlert } from './ConfirmAlert';
import { useCurrency } from '../hooks/useCurrency';
import { DEBT_TYPES } from '../types';

interface DebtItemProps {
  item: Debt;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPay?: () => void;
  formatCurrency?: (amount: number) => string;
  unpaidInstallmentsCount?: number;
  totalInstallmentsCount?: number;
}

export const DebtItem: React.FC<DebtItemProps> = ({
  item,
  onPress,
  onEdit,
  onDelete,
  onPay,
  formatCurrency: propFormatCurrency,
  unpaidInstallmentsCount = 0,
  totalInstallmentsCount = 0,
}) => {
  const { formatCurrency: hookFormatCurrency } = useCurrency();
  const formatCurrency = propFormatCurrency || hookFormatCurrency;
  const [swipeAnim] = useState(new Animated.Value(0));
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const typeIcons: Record<'debt' | 'installment' | 'advance', string> = {
    debt: 'card',
    installment: 'calendar',
    advance: 'cash',
  };

  const typeColors: Record<'debt' | 'installment' | 'advance', string[]> = {
    debt: ['#8B5CF6', '#7C3AED'],
    installment: ['#3B82F6', '#2563EB'],
    advance: ['#F59E0B', '#D97706'],
  };

  const icon = typeIcons[item.type];
  const colors = item.isPaid ? ['#10B981', '#059669'] : typeColors[item.type];
  const title = `مدين لـ: ${item.debtorName}`;
  const typeLabel = DEBT_TYPES[item.type];
  const date = new Date(item.startDate);
  const formattedDate = date.toLocaleDateString('ar-IQ', {
    month: 'short',
    day: 'numeric',
  });

  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysUntilDue = getDaysUntilDue(item.dueDate);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;

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
    ]).start(() => {
      onDelete?.();
    });
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateX: swipeAnim },
            ],
            opacity: swipeAnim.interpolate({
              inputRange: isRTL ? [0, 400] : [-400, 0],
              outputRange: isRTL ? [1, 0] : [0, 1],
            }),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          style={styles.card}
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
                  <Ionicons name={icon as any} size={20} color="#FFFFFF" />
                </LinearGradient>
              </View>
            </View>

            {/* Content Section */}
            <View style={styles.contentSection}>
              <View style={styles.mainRow}>
                <View style={styles.leftContent}>
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={styles.dateInfo}>
                      <Ionicons name="calendar-outline" size={12} color={theme.colors.textMuted} />
                      <Text style={styles.dateText}>{formattedDate}</Text>
                    </View>
                    <View style={[styles.categoryTag, { backgroundColor: colors[0] + '20' }]}>
                      <Text style={[styles.categoryText, { color: colors[0] }]}>
                        {typeLabel}
                      </Text>
                    </View>
                    {item.isPaid && (
                      <View style={[styles.categoryTag, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="checkmark-circle" size={12} color="#059669" />
                        <Text style={[styles.categoryText, { color: '#059669' }]}>
                          مدفوع
                        </Text>
                      </View>
                    )}
                    {totalInstallmentsCount > 0 && (
                      <View style={[styles.categoryTag, { backgroundColor: theme.colors.surfaceLight }]}>
                        <Ionicons name="list" size={12} color={theme.colors.textSecondary} />
                        <Text style={[styles.categoryText, { color: theme.colors.textSecondary }]}>
                          {unpaidInstallmentsCount}/{totalInstallmentsCount}
                        </Text>
                      </View>
                    )}
                    {item.dueDate && !item.isPaid && (
                      <View style={[
                        styles.categoryTag,
                        {
                          backgroundColor: isOverdue
                            ? '#FEE2E2'
                            : isDueSoon
                              ? '#FEF3C7'
                              : theme.colors.surfaceLight
                        }
                      ]}>
                        <Ionicons
                          name={isOverdue ? 'warning' : 'time-outline'}
                          size={12}
                          color={isOverdue ? '#DC2626' : isDueSoon ? '#F59E0B' : theme.colors.textSecondary}
                        />
                        <Text style={[
                          styles.categoryText,
                          {
                            color: isOverdue
                              ? '#DC2626'
                              : isDueSoon
                                ? '#F59E0B'
                                : theme.colors.textSecondary
                          }
                        ]}>
                          {isOverdue
                            ? `متأخر ${Math.abs(daysUntilDue!)} يوم`
                            : isDueSoon && daysUntilDue === 0
                              ? 'اليوم!'
                              : isDueSoon
                                ? `بعد ${daysUntilDue} يوم`
                                : formattedDate}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.rightContent}>
                  <View style={styles.amountWrapper}>
                    <LinearGradient
                      colors={item.isPaid ? ['#10B981', '#059669'] : ['#EF4444', '#DC2626']}
                      style={styles.amountBadge}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.amount}>
                        {formatCurrency(item.totalAmount)}
                      </Text>
                      {!item.isPaid && item.remainingAmount < item.totalAmount && (
                        <Text style={styles.remainingAmount}>
                          متبقي: {formatCurrency(item.remainingAmount)}
                        </Text>
                      )}
                    </LinearGradient>
                  </View>
                </View>
              </View>
            </View>

            {/* Menu Icon */}
            <TouchableOpacity
              style={styles.menuSection}
              onPress={(e) => {
                e.stopPropagation();
                setShowMenu(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={18}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
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
        message="هل أنت متأكد من حذف هذا الدين؟ لا يمكن التراجع عن هذا الإجراء."
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
            {onPress && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  onPress();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="eye-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.menuItemText}>عرض التفاصيل</Text>
              </TouchableOpacity>
            )}
            {onEdit && !item.isPaid && (
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
            {onPay && !item.isPaid && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  onPay();
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                <Text style={[styles.menuItemText, { color: '#10B981' }]}>دفع</Text>
              </TouchableOpacity>
            )}
            {onDelete && !item.isPaid && (
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
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 64,
  },
  iconSection: {
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
  },
  iconWrapper: {
    width: 44,
    height: 44,
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
  },
  mainRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContent: {
    flex: 1,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
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
  categoryTag: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  categoryText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  amountWrapper: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  amountBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  amount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  remainingAmount: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  menuSection: {
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
    justifyContent: 'center',
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
    ...theme.shadows.lg,
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
