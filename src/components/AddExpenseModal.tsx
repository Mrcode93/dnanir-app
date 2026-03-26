import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { CustomDatePicker } from './CustomDatePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import type { AppTheme } from '../utils/theme';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { addExpense, updateExpense, ExpenseShortcut, getCustomCategories, CustomCategory } from '../database/database';
import { ManageShortcutsModal } from './ManageShortcutsModal';
import { CurrencyPickerModal } from './CurrencyPickerModal';
import { alertService } from '../services/alertService';
import { formatDateLocal } from '../utils/date';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { ReceiptScannerModal } from './ReceiptScannerModal';
import { ReceiptData } from '../services/receiptOCRService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { getSmartExpenseShortcuts } from '../services/smartShortcutsService';
import { resolveIoniconName, toOutlineIoniconName } from '../utils/icon-utils';
import { AppBottomSheet, AppButton } from '../design-system';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  expense?: Expense | null;
  onSave?: () => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  visible,
  onClose,
  expense,
  onSave,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, formatCurrency } = useCurrency();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [shortcuts, setShortcuts] = useState<ExpenseShortcut[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [showManageShortcuts, setShowManageShortcuts] = useState(false);
  const [categories, setCategories] = useState<CustomCategory[]>([]);


  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

  // Convert amount when it changes
  useEffect(() => {
    const convertAmount = async () => {
      const cleanAmount = amount.replace(/,/g, '');
      if (cleanAmount && !isNaN(Number(cleanAmount)) && Number(cleanAmount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(cleanAmount), currency, currencyCode);
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
      loadCategories();
    }
  }, [visible]);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(formatNumberWithCommas(expense.amount));
      setCategory(expense.category as ExpenseCategory);
      setDate(new Date(expense.date));
      setDescription(expense.description || '');
      setCurrency(expense.currency || currencyCode);
      setShowShortcuts(false);
    } else {
      resetForm();
      setShowShortcuts(true);
      loadShortcuts();
    }
  }, [expense, visible, currencyCode]);

  const loadShortcuts = async () => {
    try {
      const shortcutsData = await getSmartExpenseShortcuts();
      setShortcuts(shortcutsData);
    } catch (error) {
      // Ignore error
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getCustomCategories('expense');
      setCategories(data);
      // Set default category if no category is selected
      if (!expense && data.length > 0) {
        const defaultCat = data.find(cat => cat.name === 'طعام') || data[0];
        setCategory(defaultCat.name);
      }
    } catch (error) {
      // Ignore error
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('food');
    setDate(new Date());
    setDescription('');
    setCurrency(currencyCode);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال عنوان المصروف');
      return;
    }

    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount.trim() || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);

    try {
      const expenseData = {
        title: title.trim(),
        amount: Number(cleanAmount),
        category: category,
        date: formatDateLocal(date),
        description: description.trim(),
        currency: currency,
      };

      if (expense) {
        await updateExpense(expense.id, expenseData);
      } else {
        await addExpense(expenseData);
      }

      onSave?.();
      onClose();
      resetForm();
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ المصروف');
    } finally {
      setLoading(false);
    }
  };

  const handleShortcutPress = async (shortcut: ExpenseShortcut) => {
    try {
      const expenseData = {
        title: shortcut.title,
        amount: shortcut.amount,
        category: shortcut.category as ExpenseCategory,
        date: formatDateLocal(new Date()),
        description: shortcut.description || '',
        currency: shortcut.currency || currencyCode,
      };

      await addExpense(expenseData);
      onSave?.();
      onClose();
      alertService.toastSuccess('تم إضافة المصروف بنجاح');
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء إضافة المصروف');
    }
  };



  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleReceiptScanned = (receiptData: ReceiptData) => {
    // Populate form with scanned receipt data
    if (receiptData.title) {
      setTitle(receiptData.title);
    }
    if (receiptData.amount) {
      setAmount(receiptData.amount.toString());
    }
    if (receiptData.date) {
      setDate(receiptData.date);
    }
    if (receiptData.category) {
      setCategory(receiptData.category);
    }
    if (receiptData.description) {
      setDescription(receiptData.description);
    }
    setShowReceiptScanner(false);
    alertService.toastSuccess('تم استخراج بيانات الفاتورة بنجاح');
  };

  const categoryIcons: Record<ExpenseCategory, string> = {
    food: 'restaurant',
    transport: 'car',
    shopping: 'bag',
    bills: 'receipt',
    entertainment: 'musical-notes',
    health: 'medical',
    education: 'school',
    other: 'ellipse',
  };

  const categoryColors: Record<ExpenseCategory, string[]> = {
    food: ['#F59E0B', '#D97706'],
    transport: ['#3B82F6', '#2563EB'],
    shopping: ['#EC4899', '#DB2777'],
    bills: ['#EF4444', '#DC2626'],
    entertainment: ['#8B5CF6', '#7C3AED'],
    health: ['#10B981', '#059669'],
    education: ['#06B6D4', '#0891B2'],
    other: ['#6B7280', '#4B5563'],
  };

  // Helper function to get category info from database or fallback to defaults
  const getCategoryInfo = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    if (cat) {
      return {
        icon: resolveIoniconName(cat.icon, 'ellipse'),
        color: cat.color,
        colors: [cat.color, cat.color],
      };
    }
    // Fallback to default categories
    const defaultKey = Object.keys(EXPENSE_CATEGORIES).find(
      key => EXPENSE_CATEGORIES[key as ExpenseCategory] === categoryName
    ) as ExpenseCategory;
    if (defaultKey) {
      return {
        icon: categoryIcons[defaultKey] || 'ellipse',
        color: categoryColors[defaultKey]?.[0] || '#6B7280',
        colors: categoryColors[defaultKey] || ['#6B7280', '#4B5563'],
      };
    }
    return {
      icon: 'ellipse',
      color: '#6B7280',
      colors: ['#6B7280', '#4B5563'],
    };
  };


  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      title={expense ? 'تعديل المصروف' : 'مصروف جديد'}
      maxHeight="98%"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
                  {/* Shortcuts Section - Only show when adding new expense */}
                  {!expense && (
                    <View style={styles.shortcutsSection}>
                      <View style={styles.shortcutsHeader}>
                        <View style={styles.shortcutsHeaderLeft}>
                          <Text style={styles.shortcutsTitle}>الاختصارات السريعة</Text>
                          <Ionicons name="flash" size={18} color={theme.colors.primary} />
                        </View>
                        <TouchableOpacity
                          onPress={() => setShowManageShortcuts(true)}
                          style={styles.manageButton}
                        >
                          <Ionicons name="settings-outline" size={16} color={theme.colors.primary} />
                          <Text style={styles.manageText}>إدارة</Text>
                        </TouchableOpacity>
                      </View>
                      {shortcuts.length > 0 ? (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={[styles.shortcutsScrollView, { transform: [{ scaleX: isRTL ? -1 : 1 }] }]}
                          contentContainerStyle={[styles.shortcutsScroll, { flexDirection: 'row' }]}
                        >
                          {shortcuts.map(shortcut => (
                            <View key={shortcut.id} style={[styles.shortcutCard, { transform: [{ scaleX: isRTL ? -1 : 1 }] }]}>
                              <TouchableOpacity
                                onPress={() => handleShortcutPress(shortcut)}
                                activeOpacity={0.8}
                                style={styles.shortcutCardPressable}
                              >
                                <LinearGradient
                                  colors={getCategoryInfo(shortcut.category).colors as any}
                                  style={styles.shortcutGradient}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                >
                                  <View style={styles.shortcutIconContainer}>
                                    <Ionicons name={getCategoryInfo(shortcut.category).icon as any} size={28} color="#FFFFFF" />
                                  </View>
                                  <Text style={styles.shortcutTitle} numberOfLines={1}>{shortcut.title}</Text>
                                  <Text style={styles.shortcutAmount}>{formatCurrency(shortcut.amount)}</Text>
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity onPress={() => setShowManageShortcuts(true)} style={[styles.addShortcutButton, { transform: [{ scaleX: isRTL ? -1 : 1 }] }]} activeOpacity={0.7}>
                            <View style={styles.addShortcutContent}>
                              <View style={styles.addShortcutIconContainer}>
                                <Ionicons name="add" size={28} color={theme.colors.primary} />
                              </View>
                              <Text style={styles.addShortcutText}>إضافة</Text>
                            </View>
                          </TouchableOpacity>
                        </ScrollView>
                      ) : (
                        <TouchableOpacity onPress={() => setShowManageShortcuts(true)} activeOpacity={0.8}>
                          <LinearGradient
                            colors={['#10B981', '#059669'] as any}
                            style={styles.addFirstShortcutGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            <View style={styles.addFirstShortcutIconContainer}>
                              <Ionicons name="flash" size={24} color="#FFFFFF" />
                            </View>
                            <View style={styles.addFirstShortcutTextContainer}>
                              <Text style={styles.addFirstShortcutTitle}>أنشئ اختصاراً سريعاً</Text>
                              <Text style={styles.addFirstShortcutSubtitle}>احفظ هذا المصروف كاختصار لإضافته بضغطة واحدة</Text>
                            </View>
                            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Receipt Scanner Button - Commented out for now */}
                  {/* {!expense && (
                    <View style={styles.inputGroup}>
                      <TouchableOpacity
                        onPress={() => setShowReceiptScanner(true)}
                        style={styles.receiptButton}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          style={styles.receiptButtonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons name="camera" size={24} color="#FFFFFF" />
                          <Text style={styles.receiptButtonText}>مسح الفاتورة</Text>
                          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  )} */}

                  {/* Title Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>عنوان المصروف</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="مثال: عشاء في المطعم"
                        mode="flat"
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        underlineColor="transparent"
                        activeUnderlineColor={theme.colors.primary}
                      />
                    </View>
                  </View>

                  {/* Amount Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>المبلغ ({CURRENCIES.find(c => c.code === currency)?.symbol})</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={amount}
                        onChangeText={(val) => {
                          const cleaned = convertArabicToEnglish(val);
                          setAmount(formatNumberWithCommas(cleaned));
                        }}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        mode="flat"
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        underlineColor="transparent"
                        activeUnderlineColor={theme.colors.primary}
                        left={
                          <TextInput.Icon
                            icon={() => (
                              <Ionicons name="cash-outline" size={20} color={theme.colors.textSecondary} />
                            )}
                          />
                        }
                      />
                    </View>
                    {convertedAmount !== null && currency !== currencyCode && (
                      <Text style={styles.convertedAmountText}>
                        ≈ {formatCurrency(convertedAmount)}
                      </Text>
                    )}
                  </View>

                  {/* Currency Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>العملة</Text>
                    <AppButton
                      label={`${CURRENCIES.find(c => c.code === currency)?.symbol} ${CURRENCIES.find(c => c.code === currency)?.name}`}
                      onPress={() => setShowCurrencyPicker(true)}
                      variant="primary"
                      leftIcon="cash"
                      rightIcon={isRTL ? "chevron-back" : "chevron-forward"}
                      style={styles.currencyButton}
                      labelStyle={styles.currencyButtonText}
                    />
                  </View>

                  {/* Date Picker */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>التاريخ</Text>
                    <AppButton
                      label={date.toLocaleDateString('ar-IQ-u-nu-latn', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      onPress={() => setShowDatePicker(true)}
                      variant="secondary"
                      leftIcon="calendar-outline"
                      rightIcon="chevron-forward"
                      style={styles.dateButton}
                      labelStyle={styles.dateButtonText}
                    />
                    {showDatePicker && (
                      <CustomDatePicker
                        value={date}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setDate(selectedDate);
                          }
                          if (Platform.OS === 'android') setShowDatePicker(false);
                        }}
                        onClose={() => setShowDatePicker(false)}
                      />
                    )}
                  </View>

                  {/* Category Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>الفئة</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryScroll}
                    >
                      {categories.map((cat) => {
                        const isSelected = category === cat.name;
                        const icon = isSelected ? resolveIoniconName(cat.icon, 'ellipse') : toOutlineIoniconName(cat.icon, 'ellipse-outline');
                        
                        return (
                          <AppButton
                            key={cat.id}
                            label={cat.name}
                            onPress={() => setCategory(cat.name)}
                            variant={isSelected ? 'primary' : 'secondary'}
                            leftIcon={icon as any}
                            style={[
                              styles.categoryOption,
                              isSelected && { backgroundColor: cat.color },
                            ]}
                            labelStyle={[
                              styles.categoryText,
                              isSelected && styles.categoryTextActive
                            ]}
                          />
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Description Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>وصف (اختياري)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="أضف ملاحظات إضافية..."
                        multiline
                        numberOfLines={4}
                        mode="flat"
                        style={styles.input}
                        contentStyle={[styles.inputContent, styles.textAreaContent]}
                        underlineColor="transparent"
                        activeUnderlineColor={theme.colors.primary}
                      />
                    </View>
                  </View>

                  {/* Save Button */}
                  <View style={[styles.actions, { borderTopWidth: 0, marginTop: 20 }]}>
                    <AppButton
                      label="إلغاء"
                      onPress={handleClose}
                      variant="secondary"
                      style={styles.cancelButton}
                    />
                    {!expense && (
                      <TouchableOpacity
                        onPress={() => setShowManageShortcuts(true)}
                        style={styles.addShortcutActionButton}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={[theme.colors.primary + '15', theme.colors.primary + '25'] as any}
                          style={styles.addShortcutActionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        >
                          <Ionicons name="flash" size={20} color={theme.colors.primary} />
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    <AppButton
                      label={expense ? 'تحديث' : 'حفظ'}
                      onPress={handleSave}
                      variant="primary"
                      loading={loading}
                      leftIcon="checkmark-circle"
                      style={styles.saveButton}
                    />
                  </View>
                </ScrollView>

      {/* Currency Picker */}
      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selectedCurrency={currency}
        onSelect={(code) => { setCurrency(code); setShowCurrencyPicker(false); }}
        onClose={() => setShowCurrencyPicker(false)}
      />

      {/* Receipt Scanner Modal */}
      <ReceiptScannerModal
        visible={showReceiptScanner}
        onClose={() => setShowReceiptScanner(false)}
        onReceiptScanned={handleReceiptScanned}
      />

      {/* Manage Shortcuts Modal */}
      <ManageShortcutsModal
        visible={showManageShortcuts}
        type="expense"
        onClose={() => { setShowManageShortcuts(false); loadShortcuts(); }}
        onShortcutUsed={(s) => { handleShortcutPress(s as ExpenseShortcut); }}
      />
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  inputWrapper: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: 'transparent',
    fontSize: theme.typography.sizes.md,
  },
  inputContent: {
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
  },
  textAreaContent: {
    minHeight: 100,
    paddingTop: theme.spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    justifyContent: 'space-between',
  },
  dateButtonText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    marginHorizontal: theme.spacing.sm,
  },
  categoryScroll: {
    paddingVertical: theme.spacing.xs,
  },
  categoryOption: {
    marginRight: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  categoryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  categoryDefault: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  categoryText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('500'),
  },
  categoryTextActive: {
    fontSize: theme.typography.sizes.sm,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
    flexShrink: 0,
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
  },
  addShortcutActionButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  addShortcutActionGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 2,
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
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    overflow: 'hidden',
    zIndex: 1000,
    direction: 'ltr',
  },
  currencyModalGradient: {
    maxHeight: '100%',
  },
  currencyModalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  currencyModalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
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
  currencyPicker: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    maxHeight: 200,
  },
  currencyOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceCard,
    marginBottom: theme.spacing.xs,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  currencyOptionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  currencyOptionTextSelected: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontStyle: 'italic',
  },
  receiptButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  receiptButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  receiptButtonText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
  },
  shortcutsSection: {
    marginBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingHorizontal: 16,


  },
  shortcutsHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  shortcutsHeaderLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  shortcutsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  manageButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
    gap: 4,
  },
  manageText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  shortcutsScrollView: {
    marginHorizontal: -16,
  },
  shortcutsScroll: {
    paddingHorizontal: 16,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  shortcutCard: {
    width: 140,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.border + '40',
    backgroundColor: theme.colors.surface,
    ...getPlatformShadow('md'),
  },
  shortcutCardFirst: {
    marginRight: 0,
  },
  shortcutCardPressable: {
    flex: 1,
  },
  shortcutGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 130,
  },
  shortcutActions: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    zIndex: 10,
  },
  shortcutEditButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  shortcutDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  shortcutIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  shortcutTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: theme.spacing.xs,
  },
  shortcutAmount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: 'rtl',
    opacity: 0.95,
  },
  shortcutBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addShortcutButton: {
    width: 140,
    minHeight: 140,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 2.5,
    borderColor: theme.colors.primary + '40',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.xs,
    ...getPlatformShadow('sm'),
  },
  addShortcutContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  addShortcutIconContainer: {
    width: 56,
    height: 48,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addShortcutText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  addFirstShortcutButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  addFirstShortcutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  addFirstShortcutIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFirstShortcutTextContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  addFirstShortcutTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    marginBottom: theme.spacing.xs,
  },
  addFirstShortcutSubtitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('400'),
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    lineHeight: 18,
  },
  shortcutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  shortcutModalContainer: {
    width: '90%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  shortcutModalGradient: {
    padding: theme.spacing.md,
  },
  shortcutModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  shortcutModalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  shortcutModalCloseButton: {
    padding: theme.spacing.xs,
  },
  shortcutModalContent: {
    marginBottom: theme.spacing.md,
  },
  shortcutModalText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  shortcutModalSubtext: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  shortcutModalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  shortcutModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
  },
  shortcutModalCancelText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  shortcutModalSaveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  shortcutModalSaveGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutModalSaveText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
});
