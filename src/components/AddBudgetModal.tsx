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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getTheme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Budget, getCustomCategories, addBudget, updateBudget } from '../database/database';
import { EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { alertService } from '../services/alertService';

interface AddBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  budget?: Budget | null;
}

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
  const currentTheme = getTheme();

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

  const allCategories = [
    ...Object.keys(EXPENSE_CATEGORIES),
    ...customCategories.map(c => c.name),
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: slideAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={theme.gradients.primary as any}
                style={[styles.modalGradient, { paddingBottom: insets.bottom + theme.spacing.xl }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={[styles.modalContent, { backgroundColor: currentTheme.colors.surfaceCard }]}>
                  <View style={styles.header}>
                    <Text style={[styles.title, { color: currentTheme.colors.textPrimary }]}>
                      {budget ? 'تعديل الميزانية' : 'إضافة ميزانية جديدة'}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color={currentTheme.colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: currentTheme.colors.textPrimary }]}>
                      المبلغ ({CURRENCIES.find(c => c.code === currency)?.symbol})
                    </Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: currentTheme.colors.surfaceLight,
                        color: currentTheme.colors.textPrimary,
                        borderColor: currentTheme.colors.border,
                      }]}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="أدخل المبلغ"
                      placeholderTextColor={currentTheme.colors.textMuted}
                      keyboardType="numeric"
                      autoFocus
                    />
                    {convertedAmount !== null && currency !== currencyCode && (
                      <Text style={[styles.convertedAmountText, { color: currentTheme.colors.textSecondary }]}>
                        ≈ {formatCurrency(convertedAmount)}
                      </Text>
                    )}
                  </View>

                  {/* Currency Selection */}
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, { color: currentTheme.colors.textPrimary }]}>العملة</Text>
                    <TouchableOpacity
                      onPress={() => setShowCurrencyPicker(true)}
                      style={styles.currencyButton}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={theme.gradients.primary as any}
                        style={styles.currencyButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons name="cash" size={20} color="#FFFFFF" />
                        <Text style={styles.currencyButtonText}>
                          {CURRENCIES.find(c => c.code === currency)?.symbol} {CURRENCIES.find(c => c.code === currency)?.name}
                        </Text>
                        <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color="#FFFFFF" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.section}>
                    <Text style={[styles.label, { color: currentTheme.colors.textPrimary }]}>الفئة</Text>
                    <ScrollView
                      style={styles.categoriesScroll}
                      showsVerticalScrollIndicator={true}
                    >
                      {allCategories.map((category) => {
                        const isSelected = selectedCategory === category;
                        return (
                          <TouchableOpacity
                            key={category}
                            onPress={() => setSelectedCategory(category)}
                            style={[
                              styles.categoryButton,
                              { 
                                backgroundColor: isSelected 
                                  ? currentTheme.colors.primary 
                                  : currentTheme.colors.surfaceLight,
                                borderColor: currentTheme.colors.border,
                              },
                            ]}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.categoryButtonText,
                                {
                                  color: isSelected
                                    ? currentTheme.colors.textInverse
                                    : currentTheme.colors.textPrimary,
                                },
                              ]}
                            >
                              {getCategoryName(category)}
                            </Text>
                            {isSelected && (
                              <Ionicons
                                name="checkmark-circle"
                                size={20}
                                color={currentTheme.colors.textInverse}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={onClose}
                      style={[
                        styles.cancelButton,
                        {
                          backgroundColor: currentTheme.colors.surfaceLight,
                          borderColor: currentTheme.colors.border,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cancelButtonText, { color: currentTheme.colors.textSecondary }]}>
                        إلغاء
                      </Text>
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
                        <Text style={styles.saveButtonText}>
                          {budget ? 'تحديث' : 'حفظ'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>

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
            <LinearGradient
              colors={[currentTheme.colors.surfaceCard, currentTheme.colors.surfaceLight]}
              style={styles.currencyModalGradient}
            >
              <View style={styles.currencyModalHeader}>
                <Text style={[styles.currencyModalTitle, { color: currentTheme.colors.textPrimary }]}>اختر العملة</Text>
                <TouchableOpacity
                  onPress={() => setShowCurrencyPicker(false)}
                  style={styles.currencyModalCloseButton}
                >
                  <Ionicons name="close" size={24} color={currentTheme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.currencyModalScrollView}
                contentContainerStyle={styles.currencyModalScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {CURRENCIES.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyOption,
                      { 
                        backgroundColor: currency === curr.code 
                          ? currentTheme.colors.primaryLight 
                          : currentTheme.colors.surfaceCard,
                      },
                    ]}
                    onPress={() => {
                      setCurrency(curr.code);
                      setShowCurrencyPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.currencyOptionText,
                      { 
                        color: currency === curr.code 
                          ? currentTheme.colors.primary 
                          : currentTheme.colors.textPrimary,
                        fontWeight: currency === curr.code ? '700' : '400',
                      },
                    ]}>
                      {curr.symbol} {curr.name}
                    </Text>
                    {currency === curr.code && (
                      <Ionicons name="checkmark-circle" size={20} color={currentTheme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalGradient: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  modalContent: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: 'right',
  },
  input: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    borderWidth: 1,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  categoriesScroll: {
    maxHeight: 200,
    marginTop: theme.spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
  },
  categoryButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontStyle: 'italic',
  },
  currencyButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  currencyButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  currencyButtonText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
  },
  currencyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  currencyModalContainer: {
    maxHeight: '70%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    zIndex: 1000,
  },
  currencyModalGradient: {
    maxHeight: '100%',
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
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
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
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  currencyOptionText: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
});
