import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Expense, Income, IncomeSource, INCOME_SOURCES, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { isRTL } from '../utils/rtl';
import { ConfirmAlert } from './ConfirmAlert';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { CustomCategory } from '../database/database';
import { usePrivacy } from '../context/PrivacyContext';

interface TransactionItemProps {
  item: Expense | Income;
  type?: 'expense' | 'income';
  onEdit?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
  formatCurrency?: (amount: number) => string;
  customCategories?: CustomCategory[];
  showOptions?: boolean;
}

const TransactionItemComponent: React.FC<TransactionItemProps> = ({
  item,
  type,
  onEdit,
  onDelete,
  onPress,
  formatCurrency: propFormatCurrency,
  customCategories = [],
  showOptions = true,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency: hookFormatCurrency, currencyCode } = useCurrency();
  const formatCurrency = propFormatCurrency || hookFormatCurrency;
  const { isPrivacyEnabled } = usePrivacy();
  const [swipeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const isExpense = type === 'expense';
  const expense = isExpense ? (item as Expense) : null;
  const income = !isExpense ? (item as Income) : null;

  // Helper function to get expense category info
  const getExpenseCategoryInfo = (category?: string) => {
    if (!category) return { icon: 'ellipse', colors: ['#6B7280', '#4B5563'], label: 'أخرى' };

    // Check custom categories first
    const customCat = customCategories.find(c => c.name === category);
    if (customCat) {
      return {
        icon: customCat.icon,
        colors: [customCat.color, customCat.color],
        label: customCat.name,
      };
    }

    // Check default categories
    const defaultKey = Object.keys(EXPENSE_CATEGORIES).find(
      key => EXPENSE_CATEGORIES[key as ExpenseCategory] === category || key === category
    ) as ExpenseCategory;

    if (defaultKey) {
      const iconMap: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
        food: 'restaurant',
        transport: 'car',
        shopping: 'bag',
        bills: 'receipt',
        entertainment: 'musical-notes',
        health: 'medical',
        education: 'school',
        other: 'ellipse',
      };
      const colorMap: Record<ExpenseCategory, string[]> = {
        food: ['#F59E0B', '#D97706'],
        transport: ['#3B82F6', '#2563EB'],
        shopping: ['#EC4899', '#DB2777'],
        bills: ['#EF4444', '#DC2626'],
        entertainment: ['#8B5CF6', '#7C3AED'],
        health: ['#10B981', '#059669'],
        education: ['#06B6D4', '#0891B2'],
        other: ['#6B7280', '#4B5563'],
      };
      return {
        icon: iconMap[defaultKey] || 'ellipse',
        colors: colorMap[defaultKey] || ['#6B7280', '#4B5563'],
        label: EXPENSE_CATEGORIES[defaultKey] || category,
      };
    }

    return { icon: 'ellipse', colors: ['#6B7280', '#4B5563'], label: category };
  };

  // Helper function to get income source info
  const getIncomeSourceInfo = (source?: string) => {
    if (!source) {
      return { icon: 'trending-up', colors: ['#10B981', '#059669'], label: '' };
    }

    if (income?.category) {
      const categorySrc = income.category;
      const customCat = customCategories.find(c => c.name === categorySrc);
      if (customCat) {
        return {
          icon: customCat.icon,
          colors: [customCat.color, customCat.color],
          label: customCat.name,
        };
      }

      const sourceIcons: Record<IncomeSource, keyof typeof Ionicons.glyphMap> = {
        salary: 'cash',
        business: 'briefcase',
        investment: 'trending-up',
        gift: 'gift',
        other: 'ellipse',
      };
      const sourceColors: Record<IncomeSource, string[]> = {
        salary: ['#10B981', '#059669'],
        business: ['#3B82F6', '#2563EB'],
        investment: ['#8B5CF6', '#7C3AED'],
        gift: ['#EC4899', '#DB2777'],
        other: ['#6B7280', '#4B5563'],
      };

      if (INCOME_SOURCES[categorySrc as IncomeSource]) {
        const defaultKey = categorySrc as IncomeSource;
        return {
          icon: sourceIcons[defaultKey] || 'trending-up',
          colors: sourceColors[defaultKey] || ['#10B981', '#059669'],
          label: INCOME_SOURCES[defaultKey] || source || '',
        };
      }

      // Check reverse
      const defaultKeyByName = Object.keys(INCOME_SOURCES).find(
        key => INCOME_SOURCES[key as IncomeSource] === categorySrc
      ) as IncomeSource | undefined;

      if (defaultKeyByName) {
        return {
          icon: sourceIcons[defaultKeyByName] || 'trending-up',
          colors: sourceColors[defaultKeyByName] || ['#10B981', '#059669'],
          label: categorySrc,
        };
      }
    }

    const normalizedSource = source.toLowerCase().trim();
    const englishToKeyMap: Record<string, IncomeSource> = {
      'salary': 'salary', 'income': 'salary', 'business': 'business', 'investment': 'investment', 'gift': 'gift', 'other': 'other'
    };

    // Simplification for brevity in this rewrite
    const customCat = customCategories.find(c => c.name === source);
    if (customCat) {
      return { icon: customCat.icon, colors: [customCat.color, customCat.color], label: customCat.name };
    }

    return { icon: 'trending-up', colors: ['#10B981', '#059669'], label: source };
  };

  const getCategoryInfo = () => {
    if (isExpense) return getExpenseCategoryInfo(expense?.category);
    return getIncomeSourceInfo(income?.source);
  };

  const categoryInfo = getCategoryInfo();
  const icon = categoryInfo.icon as keyof typeof Ionicons.glyphMap;
  const colors = categoryInfo.colors as [string, string, ...string[]];

  const title = isExpense
    ? (expense?.title || '')
    : (income?.description || income?.source || '');
  const amount = item.amount;
  const itemCurrency = (item as Expense | Income).currency || currencyCode;
  const date = new Date(item.date);
  const formattedDate = date.toLocaleDateString('ar-IQ', {
    month: 'short',
    day: 'numeric',
  });

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

  const handleDelete = () => setShowConfirmAlert(true);

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
    ]).start(() => onDelete?.());
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: swipeAnim }],
            opacity: swipeAnim.interpolate({
              inputRange: isRTL ? [0, 400] : [-400, 0],
              outputRange: isRTL ? [1, 0] : [0, 1],
            }),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.9}
          onPress={onPress ? onPress : undefined}
          onLongPress={() => setShowMenu(true)}
        >
          <View style={styles.cardContent}>

            {/* Icon Column */}
            <View style={styles.iconColumn}>
              <View style={[styles.iconContainer, { backgroundColor: colors[0] + '15' }]}>
                <Ionicons name={icon} size={24} color={colors[0]} />
              </View>
            </View>

            {/* Main Info Column */}
            <View style={styles.infoColumn}>
              <View style={styles.titleRow}>
                <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.dateText}>{formattedDate}</Text>
                <View style={styles.dateDot} />
                <Text style={[styles.categoryText, { color: colors[0] }]}>
                  {categoryInfo.label}
                </Text>
              </View>
            </View>

            {/* Amount Column */}
            <View style={styles.amountColumn}>
              <Text style={[
                styles.amountText,
                { color: isExpense ? theme.colors.error : theme.colors.success }
              ]}>
                {isPrivacyEnabled ? '****' : (isExpense ? '-' : '+') + formatCurrencyAmount(amount, itemCurrency)}
              </Text>
              {convertedAmount !== null && itemCurrency !== currencyCode && (
                <Text style={styles.subAmountText}>
                  ≈ {isPrivacyEnabled ? '****' : formatCurrency(convertedAmount)}
                </Text>
              )}
            </View>

            {/* Menu Trigger */}
            {showOptions && (
              <TouchableOpacity
                style={styles.menuTrigger}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowMenu(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}

          </View>
        </TouchableOpacity>
      </Animated.View>

      <ConfirmAlert
        visible={showConfirmAlert}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف ${isExpense ? 'هذا المصروف' : 'هذا الدخل'}؟`}
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
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View style={styles.bottomSheetContainer}>
            <View style={styles.dragHandle} />
            <Text style={styles.menuHeaderTitle}>خيارات المعاملة</Text>

            <View style={styles.menuOptionsList}>
              {onEdit && (
                <TouchableOpacity
                  style={styles.menuOption}
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
                    <Text style={styles.menuOptionSubtitle}>حذف هذه المعاملة نهائياً</Text>
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

export const TransactionItem = React.memo(TransactionItemComponent);
TransactionItem.displayName = 'TransactionItem';

const createStyles = (theme: AppTheme) => StyleSheet.create({
  wrapper: {
    marginBottom: 8,
    marginHorizontal: 1, // Prevent shadow clipping
  },
  container: {
    width: '100%',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    ...getPlatformShadow('sm'),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    marginHorizontal: 2, // Slight margin safely
  },
  cardContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconColumn: {
    // Fixed width icon
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  titleRow: {
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  metaRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  dateDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.border,
    marginHorizontal: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily,
  },
  amountColumn: {
    alignItems: isRTL ? 'flex-start' : 'flex-end', // Opposite to text
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily,
  },
  subAmountText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  menuTrigger: {
    padding: 4,
    marginLeft: isRTL ? 0 : 4,
    marginRight: isRTL ? 4 : 0,
  },

  // Menu Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    ...getPlatformShadow('xl'),
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.5,
  },
  menuHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: 24,
  },
  menuOptionsList: {
    marginBottom: 24,
  },
  menuOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  menuIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 16 : 0,
    marginRight: isRTL ? 0 : 16,
  },
  menuOptionTextContainer: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  menuOptionSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceLight,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  }
});
