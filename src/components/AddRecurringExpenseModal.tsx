import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { TextInput, IconButton } from 'react-native-paper';
import { CustomDatePicker } from './CustomDatePicker';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, useAppTheme, useThemedStyles } from '../utils/theme';
import { alertService } from '../services/alertService';
import { ExpenseCategory, EXPENSE_CATEGORIES, RECURRENCE_TYPES } from '../types';
import {
  addRecurringExpense,
  updateRecurringExpense,
  RecurringExpense
} from '../database/database';
import { getCustomCategories } from '../database/database';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { AppBottomSheet, AppButton, AppInput } from '../design-system';
import { Platform } from 'react-native';
import { useWallets } from '../context/WalletContext';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency } from '../services/currencyService';
import { getAppSettings } from '../database/database';
import { CURRENCIES } from '../types';
import { CurrencyPickerModal } from './CurrencyPickerModal';

interface AddRecurringExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  editingExpense?: RecurringExpense | null;
}

export const AddRecurringExpenseModal: React.FC<AddRecurringExpenseModalProps> = ({
  visible,
  onClose,
  editingExpense,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurrenceValue, setRecurrenceValue] = useState('1');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const { wallets } = useWallets();
  const [walletId, setWalletId] = useState<number | undefined>(undefined);
  const { currencyCode } = useCurrency();
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  useEffect(() => {
    loadCustomCategories();
    if (editingExpense) {
      setTitle(editingExpense.title);
      setAmount(formatNumberWithCommas(editingExpense.amount));
      setCategory(editingExpense.category as ExpenseCategory);
      setRecurrenceType(editingExpense.recurrenceType);
      setRecurrenceValue(editingExpense.recurrenceValue.toString());
      setStartDate(new Date(editingExpense.startDate));
      setEndDate(editingExpense.endDate ? new Date(editingExpense.endDate) : null);
      setHasEndDate(!!editingExpense.endDate);
      setDescription(editingExpense.description || '');
      setWalletId(editingExpense.walletId);
      setCurrency(editingExpense.currency || currencyCode);
    } else {
      resetForm();
      const defaultW = wallets.find(w => w.isDefault) || wallets[0];
      setWalletId(defaultW?.id);
      setCurrency(currencyCode);
    }
  }, [editingExpense, visible, wallets, currencyCode]);

  useEffect(() => {
    const calcBase = async () => {
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
    calcBase();
  }, [amount, currency, currencyCode]);

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {

    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('food');
    setRecurrenceType('monthly');
    setRecurrenceValue('1');
    setStartDate(new Date());
    setEndDate(null);
    setHasEndDate(false);
    setDescription('');
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

    const recValue = parseInt(recurrenceValue);
    if (isNaN(recValue) || recValue <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال قيمة تكرار صحيحة');
      return;
    }

    if (hasEndDate && endDate && endDate <= startDate) {
      alertService.warning('تنبيه', 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
      return;
    }

    setLoading(true);

    try {
      const expenseData = {
        title: title.trim(),
        amount: Number(cleanAmount),
        category: category,
        recurrenceType: recurrenceType,
        recurrenceValue: recValue,
        startDate: startDate.toISOString().split('T')[0],
        endDate: hasEndDate && endDate ? endDate.toISOString().split('T')[0] : undefined,
        description: description.trim(),
        isActive: true,
        walletId: walletId,
        currency: currency,
        base_amount: convertedAmount !== null ? convertedAmount : Number(cleanAmount),
      };

      if (editingExpense) {
        await updateRecurringExpense(editingExpense.id, expenseData);
      } else {
        await addRecurringExpense(expenseData);
      }

      onClose();
      resetForm();
    } catch (error) {

      alertService.error('خطأ', 'حدث خطأ أثناء حفظ المصروف المتكرر');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getCategoryName = (cat: ExpenseCategory) => {
    return EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES] ||
      customCategories.find(c => c.name === cat)?.name ||
      cat;
  };

  const allCategories = [
    ...Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[],
    ...customCategories.map(c => c.name as ExpenseCategory),
  ];

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      title={editingExpense ? 'تعديل مصروف متكرر' : 'إضافة مصروف متكرر'}
      maxHeight="90%"
      avoidKeyboard
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>العنوان</Text>
          <AppInput
            value={title}
            onChangeText={setTitle}
            placeholder="أدخل عنوان المصروف"
            style={styles.input}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>المبلغ</Text>
          <AppInput
            value={amount}
            onChangeText={(val) => {
              const cleaned = convertArabicToEnglish(val);
              setAmount(formatNumberWithCommas(cleaned));
            }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            icon="cash-outline"
            style={styles.input}
          />
          {convertedAmount !== null && (
            <Text style={styles.convertedText}>≈ {convertedAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} {currencyCode}</Text>
          )}
          <TouchableOpacity 
            style={styles.currencyToggle}
            onPress={() => setShowCurrencyPicker(true)}
          >
            <Text style={styles.currencyToggleText}>{currency}</Text>
            <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>الفئة</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={styles.pickerText}>{getCategoryName(category)}</Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={styles.pickerOptions}>
              {allCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.pickerOption,
                    category === cat && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      category === cat && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {getCategoryName(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>نوع التكرار</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowRecurrencePicker(!showRecurrencePicker)}
          >
            <Text style={styles.pickerText}>{RECURRENCE_TYPES[recurrenceType]}</Text>
            <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {showRecurrencePicker && (
            <View style={styles.pickerOptions}>
              {Object.entries(RECURRENCE_TYPES).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.pickerOption,
                    recurrenceType === key && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setRecurrenceType(key as any);
                    setShowRecurrencePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      recurrenceType === key && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>قيمة التكرار</Text>
          <AppInput
            value={recurrenceValue}
            onChangeText={(val) => setRecurrenceValue(convertArabicToEnglish(val))}
            placeholder="1"
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={styles.hint}>
            مثال: إذا كان التكرار شهري والقيمة 2، فسيكون كل شهرين
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>تاريخ البداية</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowStartDatePicker(true)}
          >
            <Text style={styles.pickerText}>
              {startDate.toLocaleDateString('ar-IQ-u-nu-latn')}
            </Text>
            <Ionicons name="calendar" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          {showStartDatePicker && (
            <CustomDatePicker
              value={startDate}
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setStartDate(selectedDate);
                }
                if (Platform.OS === 'android') setShowStartDatePicker(false);
              }}
              onClose={() => setShowStartDatePicker(false)}
            />
          )}
        </View>

        <View style={styles.formGroup}>
          <View style={styles.switchRow}>
            <Text style={styles.label}>تاريخ انتهاء (اختياري)</Text>
            <TouchableOpacity
              style={[styles.switch, hasEndDate && styles.switchActive]}
              onPress={() => {
                setHasEndDate(!hasEndDate);
                if (hasEndDate) {
                  setEndDate(null);
                }
              }}
            >
              <View style={[styles.switchThumb, hasEndDate && styles.switchThumbActive]} />
            </TouchableOpacity>
          </View>
          {hasEndDate && (
            <>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.pickerText}>
                  {endDate ? endDate.toLocaleDateString('ar-IQ-u-nu-latn') : 'اختر التاريخ'}
                </Text>
                <Ionicons name="calendar" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              {showEndDatePicker && (
                <CustomDatePicker
                  value={endDate || new Date()}
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setEndDate(selectedDate);
                    }
                    if (Platform.OS === 'android') setShowEndDatePicker(false);
                  }}
                  onClose={() => setShowEndDatePicker(false)}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>الوصف (اختياري)</Text>
          <AppInput
            value={description}
            onChangeText={setDescription}
            placeholder="أدخل وصفاً للمصروف"
            style={styles.input}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>المحفظة المستخدمة</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.walletsContainer}
            style={{ marginBottom: 16 }}
          >
            {wallets.map(wallet => (
              <TouchableOpacity
                key={wallet.id}
                style={[
                  styles.walletChip,
                  walletId === wallet.id && {
                    borderColor: wallet.color || theme.colors.primary,
                    backgroundColor: (wallet.color || theme.colors.primary) + '10',
                    borderWidth: 2
                  }
                ]}
                onPress={() => setWalletId(wallet.id)}
              >
                <Ionicons
                  name={wallet.icon as any || 'wallet'}
                  size={18}
                  color={walletId === wallet.id ? (wallet.color || theme.colors.primary) : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.walletChipText,
                  walletId === wallet.id && {
                    color: wallet.color || theme.colors.primary,
                    fontWeight: '700'
                  }
                ]}>{wallet.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        {/* Save Button */}
        <View style={[styles.actions, { borderTopWidth: 0, marginTop: 20 }]}>
          <AppButton
            label="إلغاء"
            onPress={handleClose}
            variant="secondary"
            style={styles.actionButton}
          />
          <AppButton
            label={loading ? 'جاري الحفظ...' : editingExpense ? 'تحديث' : 'حفظ'}
            onPress={handleSave}
            variant="primary"
            loading={loading}
            disabled={loading}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>

      {/* Currency Picker Modal */}
      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selectedCurrency={currency}
        onSelect={(code) => {
          setCurrency(code);
          setShowCurrencyPicker(false);
        }}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  formGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
  },
  pickerButton: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  pickerOptions: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 200,
  },
  pickerOption: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.primary + '20',
  },
  pickerOptionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  pickerOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('700'),
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  switchRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: theme.colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
  },
  convertedText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  currencyToggle: {
    position: 'absolute',
    right: isRTL ? undefined : 12,
    left: isRTL ? 12 : undefined,
    top: 40,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currencyToggleText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: 'bold',
  },
  walletsContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
    paddingBottom: 4,
  },
  walletChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  walletChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});
