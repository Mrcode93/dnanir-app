import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { Budget, getCustomCategories, addBudget, updateBudget } from '../database/database';
import { EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish } from '../utils/numbers';

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

interface AddBudgetScreenProps {
  navigation: any;
  route: any;
}

export const AddBudgetScreen: React.FC<AddBudgetScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { currencyCode, formatCurrency } = useCurrency();
  const editingBudget = route?.params?.budget as Budget | undefined;

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomCategories();
    if (editingBudget) {
      setAmount(editingBudget.amount.toString());
      setSelectedCategory(editingBudget.category);
      setCurrency((editingBudget as any).currency || currencyCode);
    } else {
      resetForm();
    }
  }, [editingBudget]);

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

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      console.error('Error loading custom categories:', error);
    }
  };

  const resetForm = () => {
    setAmount('');
    setSelectedCategory('');
    setCurrency(currencyCode);
  };

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

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

    setLoading(true);

    try {
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();

      if (editingBudget) {
        await updateBudget(editingBudget.id, {
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

      handleClose();
    } catch (error) {
      console.error('Error saving budget:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الميزانية');
    } finally {
      setLoading(false);
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.background}
        >
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon={isRTL ? "chevron-right" : "chevron-left"}
              size={28}
              onPress={handleClose}
              iconColor={theme.colors.textPrimary}
            />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                {editingBudget ? 'تعديل الميزانية' : 'إضافة ميزانية جديدة'}
              </Text>
              <Text style={styles.headerSubtitle}>حدد ميزانيتك الشهرية للفئة</Text>
            </View>
            <IconButton
              icon="help-circle-outline"
              size={24}
              iconColor={theme.colors.textSecondary}
              onPress={() => { }}
            />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Amount Card */}
            <View style={styles.amountCard}>
              <View style={styles.amountHeader}>
                <View style={styles.amountIconBg}>
                  <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
                </View>
                <Text style={styles.amountLabel}>المبلغ الشهري</Text>
              </View>
              
              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(val) => setAmount(convertArabicToEnglish(val))}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                  autoFocus
                />
                <Text style={styles.currencyLabel}>
                  {CURRENCIES.find(c => c.code === currency)?.symbol || 'د.ع'}
                </Text>
              </View>

              {convertedAmount !== null && currency !== currencyCode && (
                <Text style={styles.convertedAmountText}>
                  ≈ {formatCurrency(convertedAmount)}
                </Text>
              )}

              {/* Currency Selection */}
              <TouchableOpacity
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
                style={styles.currencySelector}
                activeOpacity={0.7}
              >
                <Ionicons name="cash-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.currencySelectorText}>
                  {CURRENCIES.find(c => c.code === currency)?.name || 'دينار عراقي'}
                </Text>
                <Ionicons 
                  name={showCurrencyPicker ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color={theme.colors.textSecondary} 
                />
              </TouchableOpacity>

              {/* Currency Picker Dropdown */}
              {showCurrencyPicker && (
                <View style={styles.currencyDropdown}>
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
                        <Text style={styles.currencySymbol}>{curr.symbol}</Text>
                        <Text style={[
                          styles.currencyOptionText,
                          isSelected && styles.currencyOptionTextSelected,
                        ]}>
                          {curr.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
                      activeOpacity={0.8}
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
                            name={isSelected 
                              ? getCategoryIcon(category) as any 
                              : `${getCategoryIcon(category)}-outline` as any
                            }
                            size={24}
                            color={isSelected ? '#FFF' : categoryColor}
                          />
                        </View>
                        <Text style={[
                          styles.categoryCardLabel,
                          isSelected && styles.categoryCardLabelActive
                        ]} numberOfLines={1}>
                          {getCategoryName(category)}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Save Button */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveButton}
              activeOpacity={0.8}
              disabled={!amount || !selectedCategory || loading}
            >
              <LinearGradient
                colors={
                  amount && selectedCategory && !loading
                    ? (theme.gradients.primary as any)
                    : ['#9CA3AF', '#6B7280']
                }
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  {loading ? 'جاري الحفظ...' : editingBudget ? 'تحديث الميزانية' : 'حفظ الميزانية'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
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
  scrollContainer: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  amountCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('md'),
  },
  amountHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  amountIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  amountInputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  currencyLabel: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: theme.spacing.sm,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontStyle: 'italic',
  },
  currencySelector: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
  },
  currencySelectorText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  currencyDropdown: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.sm,
    ...getPlatformShadow('sm'),
  },
  currencyOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 10,
    gap: theme.spacing.md,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    width: 36,
    textAlign: 'center',
  },
  currencyOptionText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  currencyOptionTextSelected: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.lg,
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
    minHeight: 100,
    justifyContent: 'center',
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
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
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  saveButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
