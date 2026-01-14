import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, I18nManager, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../utils/theme';
import { Expense, Income } from '../types';
import { isRTL } from '../utils/rtl';
import { ConfirmAlert } from './ConfirmAlert';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';

interface TransactionItemProps {
  item: Expense | Income;
  type: 'expense' | 'income';
  onEdit?: () => void;
  onDelete?: () => void;
  formatCurrency?: (amount: number) => string;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  item,
  type,
  onEdit,
  onDelete,
  formatCurrency: propFormatCurrency,
}) => {
  const { formatCurrency: hookFormatCurrency, currencyCode } = useCurrency();
  const formatCurrency = propFormatCurrency || hookFormatCurrency;
  const [swipeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);

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
  const itemCurrency = (item as Expense | Income).currency || currencyCode;
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

  // Convert amount if currency is different
  useEffect(() => {
    const convertAmount = async () => {
      if (itemCurrency && itemCurrency !== currencyCode) {
        try {
          const converted = await convertCurrency(amount, itemCurrency, currencyCode);
          setConvertedAmount(converted);
        } catch (error) {
          console.error('Error converting currency:', error);
          setConvertedAmount(null);
        }
      } else {
        setConvertedAmount(null);
      }
    };

    convertAmount();
  }, [amount, itemCurrency, currencyCode]);

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
    <View
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
                  <Ionicons name={icon} size={20} color="#FFFFFF" />
                </LinearGradient>
              </View>
            </View>

            {/* Content Section - Single Row */}
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
                    {categoryLabel && (
                      <View style={[styles.categoryTag, { backgroundColor: colors[0] + '20' }]}>
                        <Text style={[styles.categoryText, { color: colors[0] }]}>
                          {categoryLabel}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.rightContent}>
                  <View style={styles.amountWrapper}>
                    <LinearGradient
                      colors={isExpense ? ['#EF4444', '#DC2626'] : ['#10B981', '#059669']}
                      style={styles.amountBadge}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.amount}>
                        {isExpense ? '-' : '+'}{formatCurrencyAmount(amount, itemCurrency)}
                      </Text>
                      {convertedAmount !== null && itemCurrency !== currencyCode && (
                        <Text style={styles.convertedAmount}>
                          ≈ {formatCurrency(convertedAmount)}
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
        </View>
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

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
    direction: 'rtl',
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
    textAlign: 'left',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
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
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  categoryTag: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
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
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  convertedAmount: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
    marginTop: 2,
    fontStyle: 'italic',
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
    textAlign: 'left',
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
