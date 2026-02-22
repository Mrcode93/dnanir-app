import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import type { AppTheme } from '../utils/theme';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { addExpense, updateExpense, ExpenseShortcut, getCustomCategories, CustomCategory } from '../database/database';
import { ManageShortcutsModal } from './ManageShortcutsModal';
import { alertService } from '../services/alertService';
import { formatDateLocal } from '../utils/date';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { ReceiptScannerModal } from './ReceiptScannerModal';
import { ReceiptData } from '../services/receiptOCRService';
import { convertArabicToEnglish } from '../utils/numbers';
import { getSmartExpenseShortcuts } from '../services/smartShortcutsService';

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
  const insets = useSafeAreaInsets();
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
  const [slideAnim] = useState(new Animated.Value(0));
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [shortcuts, setShortcuts] = useState<ExpenseShortcut[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [showManageShortcuts, setShowManageShortcuts] = useState(false);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

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
      loadCategories();
    }
  }, [visible]);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toString());
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

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);

    try {
      const expenseData = {
        title: title.trim(),
        amount: Number(amount),
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
        icon: cat.icon,
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

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -500}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                style={[styles.modalGradient, { paddingBottom: insets.bottom }]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <View style={[styles.iconBadge, { backgroundColor: getCategoryInfo(category).color + '20' }]}>
                      <Ionicons
                        name={getCategoryInfo(category).icon as any}
                        size={24}
                        color={getCategoryInfo(category).color}
                      />
                    </View>
                    <View style={styles.headerText}>
                      <Text style={styles.title}>
                        {expense ? 'تعديل المصروف' : 'مصروف جديد'}
                      </Text>
                      <Text style={styles.subtitle}>أضف تفاصيل المصروف</Text>
                    </View>
                  </View>
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={handleClose}
                    iconColor={theme.colors.textSecondary}
                    style={styles.closeButton}
                  />
                </View>

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
                          <Ionicons name="flash" size={18} color={theme.colors.primary} />
                          <Text style={styles.shortcutsTitle}>الاختصارات السريعة</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowManageShortcuts(true)}>
                          <Text style={{ color: theme.colors.primary, fontSize: 13, fontFamily: theme.typography.fontFamily }}>إدارة</Text>
                        </TouchableOpacity>
                      </View>
                      {shortcuts.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsScroll}>
                          {shortcuts.map(shortcut => (
                            <TouchableOpacity
                              key={shortcut.id}
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
                          ))}
                          <TouchableOpacity onPress={() => setShowManageShortcuts(true)} style={styles.addShortcutButton} activeOpacity={0.7}>
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
                        onChangeText={(val) => setAmount(convertArabicToEnglish(val))}
                        placeholder="0.00"
                        keyboardType="numeric"
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

                  {/* Date Picker */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>التاريخ</Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(true)}
                      style={styles.dateButton}
                    >
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.dateButtonText}>
                        {date.toLocaleDateString('ar-IQ', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            setDate(selectedDate);
                          }
                        }}
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
                        // Parse color gradient from hex color
                        const color1 = cat.color;
                        const color2 = cat.color; // Use same color or create darker shade
                        const colors = [color1, color2];

                        return (
                          <TouchableOpacity
                            key={cat.id}
                            onPress={() => setCategory(cat.name)}
                            style={styles.categoryOption}
                            activeOpacity={0.7}
                          >
                            {isSelected ? (
                              <LinearGradient
                                colors={colors as any}
                                style={styles.categoryGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                              >
                                <Ionicons
                                  name={cat.icon as any}
                                  size={20}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.categoryTextActive}>{cat.name}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.categoryDefault}>
                                <Ionicons
                                  name={`${cat.icon}-outline` as any}
                                  size={20}
                                  color={theme.colors.textSecondary}
                                />
                                <Text style={styles.categoryText}>{cat.name}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
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
                </ScrollView>

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.cancelButton}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cancelButtonContent}>
                      <Ionicons name="close-outline" size={18} color={theme.colors.textSecondary} />
                      <Text style={styles.cancelButtonText}>إلغاء</Text>
                    </View>
                  </TouchableOpacity>
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
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={styles.saveButton}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={getCategoryInfo(category).colors as any}
                      style={styles.saveButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                        <>
                          <Ionicons name="hourglass-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.saveButtonText}>جاري الحفظ...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.saveButtonText}>
                            {expense ? 'تحديث' : 'حفظ'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>

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
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.currencyModalGradient}
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
                nestedScrollEnabled={true}
              >
                {CURRENCIES.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyOption,
                      currency === curr.code && styles.currencyOptionSelected,
                    ]}
                    onPress={() => {
                      setCurrency(curr.code);
                      setShowCurrencyPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.currencyOptionText,
                      currency === curr.code && styles.currencyOptionTextSelected,
                    ]}>
                      {curr.symbol} {curr.name}
                    </Text>
                    {currency === curr.code && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>

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
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '98%',
    width: '100%',
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    direction: 'rtl',
  },
  modalGradient: {
    width: '100%',
    minHeight: 600,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexShrink: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  closeButton: {
    margin: 0,
  },
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
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  cancelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
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
    height: 44,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  saveButtonIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
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
  },
  shortcutsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  shortcutsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  shortcutsIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  toggleButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceLight,
  },
  shortcutsScrollView: {
    marginHorizontal: -theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  shortcutsScroll: {
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  shortcutCard: {
    width: 140,
    borderRadius: theme.borderRadius.lg,
    overflow: 'visible',
    marginRight: theme.spacing.xs,
    position: 'relative',
  },
  shortcutCardFirst: {
    marginRight: 0,
  },
  shortcutCardPressable: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  shortcutGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 140,
    position: 'relative',
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
    width: 56,
    height: 48,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
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
