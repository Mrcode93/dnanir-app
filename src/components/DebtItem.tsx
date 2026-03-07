import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Debt, DEBT_TYPES } from '../types';
import { isRTL } from '../utils/rtl';
import { ConfirmAlert } from './ConfirmAlert';
import { useCurrency } from '../hooks/useCurrency';

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

const DebtItemComponent: React.FC<DebtItemProps> = ({
  item,
  onPress,
  onEdit,
  onDelete,
  onPay,
  formatCurrency: propFormatCurrency,
  unpaidInstallmentsCount = 0,
  totalInstallmentsCount = 0,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
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
  const isOwedToMe = item.direction === 'owed_to_me';
  const colors = item.isPaid ? ['#10B981', '#059669'] : (isOwedToMe ? ['#10B981', '#059669'] : typeColors[item.type]);
  const title = isOwedToMe ? `مدين لي: ${item.debtorName}` : `مدين لـ: ${item.debtorName}`;
  const typeLabel = DEBT_TYPES[item.type];
  const date = new Date(item.startDate);
  const formattedDate = date.toLocaleDateString('ar-IQ-u-nu-latn', {
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
                  colors={colors as any}
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
                      <View style={[styles.categoryTag, { backgroundColor: theme.colors.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={12} color={theme.colors.success} />
                        <Text style={[styles.categoryText, { color: theme.colors.success }]}>
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
                            ? theme.colors.error + '15'
                            : isDueSoon
                              ? theme.colors.warning + '15'
                              : theme.colors.surfaceLight
                        }
                      ]}>
                        <Ionicons
                          name={isOverdue ? 'warning' : 'time-outline'}
                          size={12}
                          color={isOverdue ? theme.colors.error : isDueSoon ? theme.colors.warning : theme.colors.textSecondary}
                        />
                        <Text style={[
                          styles.categoryText,
                          {
                            color: isOverdue
                              ? theme.colors.error
                              : isDueSoon
                                ? theme.colors.warning
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

      {/* Pro Bottom Sheet Menu */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
        statusBarTranslucent={true}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.dragHandle} />
            <Text style={styles.menuHeaderTitle}>خيارات الدين</Text>

            <View style={styles.menuOptionsList}>
              {onPress && (
                <TouchableOpacity
                  style={styles.menuOption}
                  onPress={() => {
                    setShowMenu(false);
                    onPress();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: theme.colors.info + '15' }]}>
                    <Ionicons name="eye-outline" size={22} color={theme.colors.info} />
                  </View>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={styles.menuOptionTitle}>عرض التفاصيل</Text>
                    <Text style={styles.menuOptionSubtitle}>عرض كل تفاصيل الدين والأقساط</Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}

              {onEdit && (
                <TouchableOpacity
                  style={[styles.menuOption, { marginTop: 8 }]}
                  onPress={() => {
                    setShowMenu(false);
                    onEdit();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
                  </View>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={styles.menuOptionTitle}>تعديل</Text>
                    <Text style={styles.menuOptionSubtitle}>تغيير التفاصيل أو المبلغ</Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}

              {onPay && !item.isPaid && (
                <TouchableOpacity
                  style={[styles.menuOption, { marginTop: 8 }]}
                  onPress={() => {
                    setShowMenu(false);
                    onPay();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: '#10B981' + '15' }]}>
                    <Ionicons name="checkmark-circle-outline" size={22} color="#10B981" />
                  </View>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={[styles.menuOptionTitle, { color: '#10B981' }]}>{isOwedToMe ? 'تسديد' : 'دفع'}</Text>
                    <Text style={styles.menuOptionSubtitle}>{isOwedToMe ? 'تسجيل تسديد مبلغ من الدين' : 'دفع مبلغ من الدين'}</Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}

              {onDelete && (
                <TouchableOpacity
                  style={[styles.menuOption, { marginTop: 8 }]}
                  onPress={() => {
                    setShowMenu(false);
                    setShowConfirmAlert(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: theme.colors.error + '15' }]}>
                    <Ionicons name="trash-outline" size={22} color={theme.colors.error} />
                  </View>
                  <View style={styles.menuOptionTextContainer}>
                    <Text style={[styles.menuOptionTitle, { color: theme.colors.error }]}>حذف</Text>
                    <Text style={styles.menuOptionSubtitle}>حذف هذا الدين نهائياً</Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.closeButtonText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export const DebtItem = React.memo(DebtItemComponent);
DebtItem.displayName = 'DebtItem';

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    backgroundColor: theme.colors.surfaceCard, // Required for Android elevation
    ...getPlatformShadow('md'),
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
    backgroundColor: theme.colors.surfaceCard, // Background for Android elevation
    ...getPlatformShadow('sm'),
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
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
    justifyContent: isRTL ? 'flex-start' : 'flex-start',
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
    fontWeight: getPlatformFontWeight('500'),
    textAlign: isRTL ? 'right' : 'left',
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
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  rightContent: {
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  amountWrapper: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  amountBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  amount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  remainingAmount: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('500'),
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
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
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 12,
    ...getPlatformShadow('lg'),
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  menuHeaderTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  menuOptionsList: {
    paddingHorizontal: theme.spacing.lg,
  },
  menuOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    ...getPlatformShadow('xs'),
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? theme.spacing.md : 0,
    marginRight: isRTL ? 0 : theme.spacing.md,
  },
  menuOptionTextContainer: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 2,
  },
  menuOptionSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  closeButton: {
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    ...getPlatformShadow('xs'),
  },
  closeButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
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
    ...getPlatformShadow('md'),
  },
  deleteGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
