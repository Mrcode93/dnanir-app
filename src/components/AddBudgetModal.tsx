import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Budget, getCustomCategories, addBudget, updateBudget } from '../database/database';
import { EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish } from '../utils/numbers';

interface AddBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  budget?: Budget | null;
}

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant',
  transport: 'car',
  shopping: 'cart',
  bills: 'receipt',
  health: 'medical',
  education: 'school',
  entertainment: 'game-controller',
  other: 'ellipsis-horizontal',
};

export const AddBudgetModal: React.FC<AddBudgetModalProps> = ({
  visible,
  onClose,
  onSave,
  budget,
}) => {
  const { currencyCode, formatCurrency } = useCurrency();
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadCustomCategories();
  }, []);

  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

  // Convert amount when it changes
  useEffect(() => {
    const convertAmount = async () => {
      if (amount && !isNaN(Number(amount)) && Number(amount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(amount), currency, currencyCode);
          setConvertedAmount(converted);
        } else {
          setConvertedAmount(null);
        }
      } else {
        setConvertedAmount(null);
      }
    };

    convertAmount();
  }, [amount, currency, currencyCode]);

  useEffect(() => {
    if (visible) {
      if (budget) {
        setAmount(budget.amount.toString());
        setSelectedCategory(budget.category);
        setCurrency((budget as any).currency || currencyCode);
      } else {
        setAmount('');
        setSelectedCategory('');
        setCurrency(currencyCode);
      }
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, budget, currencyCode]);

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      console.error('Error loading custom categories:', error);
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();

    if (!amount.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ الميزانية');
      return;
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    if (!selectedCategory) {
      alertService.warning('تنبيه', 'يرجى اختيار فئة للميزانية');
      return;
    }

    try {
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();

      if (budget) {
        await updateBudget(budget.id, {
          category: selectedCategory,
          amount: parseFloat(amount),
          month,
          year,
          currency: currency,
        });
        alertService.success('نجح', 'تم تحديث الميزانية بنجاح');
      } else {
        await addBudget({
          category: selectedCategory,
          amount: parseFloat(amount),
          month,
          year,
          currency: currency,
        });
        alertService.success('نجح', 'تم إضافة الميزانية بنجاح');
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving budget:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الميزانية');
    }
  };

  const getCategoryName = (category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] ||
      customCategories.find(c => c.name === category)?.name ||
      category;
  };

  const getCategoryIcon = (category: string) => {
    const customCat = customCategories.find(c => c.name === category);
    if (customCat?.icon) return customCat.icon;
    return CATEGORY_ICONS[category] || 'wallet';
  };

  const allCategories = [
    ...Object.keys(EXPENSE_CATEGORIES),
    ...customCategories.map(c => c.name),
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                paddingBottom: insets.bottom,
                opacity: slideAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [100, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>
                  {budget ? 'تعديل الميزانية' : 'إضافة ميزانية جديدة'}
                </Text>
                <Text style={styles.headerSubtitle}>حدد ميزانيتك الشهرية</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Amount Card */}
              <View style={styles.amountCard}>
                <Text style={styles.amountLabel}>المبلغ الشهري</Text>
                <View style={styles.amountInputRow}>
                  <TextInput
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(val) => setAmount(convertArabicToEnglish(val))}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                    autoFocus
                  />
                  <TouchableOpacity 
                    onPress={() => setShowCurrencyPicker(true)}
                    style={styles.currencyButton}
                  >
                    <Text style={styles.currencyText}>
                      {CURRENCIES.find(c => c.code === currency)?.symbol}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
                {convertedAmount !== null && currency !== currencyCode && (
                  <Text style={styles.convertedAmountText}>
                    ≈ {formatCurrency(convertedAmount)}
                  </Text>
                )}
              </View>

              {/* Category Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>اختر الفئة</Text>
                <View style={styles.categoriesGrid}>
                  {allCategories.map((category) => {
                    const isSelected = selectedCategory === category;
                    const customCat = customCategories.find(c => c.name === category);
                    const categoryColor = customCat?.color || theme.colors.primary;
                    
                    return (
                      <TouchableOpacity
                        key={category}
                        onPress={() => setSelectedCategory(category)}
                        activeOpacity={0.7}
                        style={[
                          styles.categoryCard,
                          isSelected && { borderColor: categoryColor, borderWidth: 2 }
                        ]}
                      >
                        <LinearGradient
                          colors={isSelected 
                            ? [categoryColor, categoryColor + 'DD'] as any
                            : [theme.colors.surfaceLight, theme.colors.surfaceLight] as any
                          }
                          style={styles.categoryCardGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <View style={[
                            styles.categoryIconContainer,
                            { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : theme.colors.surface }
                          ]}>
                            <Ionicons
                              name={getCategoryIcon(category) as any}
                              size={22}
                              color={isSelected ? '#FFF' : categoryColor}
                            />
                          </View>
                          <Text style={[
                            styles.categoryCardLabel,
                            isSelected && styles.categoryCardLabelActive
                          ]} numberOfLines={1}>
                            {getCategoryName(category)}
                          </Text>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={18} color="#FFF" style={styles.checkIcon} />
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.cancelButton}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={styles.saveButton}
                activeOpacity={0.7}
                disabled={!amount || !selectedCategory}
              >
                <LinearGradient
                  colors={
                    amount && selectedCategory
                      ? (theme.gradients.primary as any)
                      : ['#9CA3AF', '#6B7280']
                  }
                  style={styles.saveButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>
                    {budget ? 'تحديث' : 'حفظ الميزانية'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <Pressable
          style={styles.currencyModalOverlay}
          onPress={() => setShowCurrencyPicker(false)}
        >
          <Pressable
            style={styles.currencyModalContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.currencyModalHeader}>
              <Text style={styles.currencyModalTitle}>اختر العملة</Text>
              <TouchableOpacity
                onPress={() => setShowCurrencyPicker(false)}
                style={styles.currencyModalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.currencyModalScrollView}
              contentContainerStyle={styles.currencyModalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              {CURRENCIES.map((curr) => {
                const isSelected = currency === curr.code;
                return (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyOption,
                      isSelected && styles.currencyOptionSelected,
                    ]}
                    onPress={() => {
                      setCurrency(curr.code);
                      setShowCurrencyPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.currencyOptionContent}>
                      <Text style={styles.currencySymbol}>{curr.symbol}</Text>
                      <Text style={[
                        styles.currencyOptionText,
                        isSelected && styles.currencyOptionTextSelected,
                      ]}>
                        {curr.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    ...getPlatformShadow('lg'),
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  amountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('sm'),
  },
  amountLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  amountInputRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    minWidth: 120,
  },
  currencyButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 12,
    gap: 4,
  },
  currencyText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    textAlign: isRTL ? 'right' : 'left',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryCard: {
    width: '31%',
    borderRadius: 16,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  categoryCardGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    minHeight: 90,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryCardLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  categoryCardLabelActive: {
    color: '#FFFFFF',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    flex: 2,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },

  // Currency Modal Styles
  currencyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  currencyModalContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    ...getPlatformShadow('lg'),
  },
  currencyModalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  currencyModalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  currencyModalCloseButton: {
    padding: theme.spacing.xs,
  },
  currencyModalScrollView: {
    maxHeight: 400,
  },
  currencyModalScrollContent: {
    padding: theme.spacing.md,
  },
  currencyOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  currencyOptionContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    width: 40,
    textAlign: 'center',
  },
  currencyOptionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  currencyOptionTextSelected: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
});
