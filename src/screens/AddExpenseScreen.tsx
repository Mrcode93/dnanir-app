import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { addExpense, updateExpense, ExpenseShortcut, getCustomCategories, CustomCategory } from '../database/database';
import { ManageShortcutsModal } from '../components/ManageShortcutsModal';
import { alertService } from '../services/alertService';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { convertArabicToEnglish } from '../utils/numbers';
import { formatDateLocal } from '../utils/date';
import { getSmartExpenseShortcuts } from '../services/smartShortcutsService';

interface AddExpenseScreenProps {
  navigation: any;
  route: any;
}

export const AddExpenseScreen: React.FC<AddExpenseScreenProps> = ({
  navigation,
  route,
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, formatCurrency } = useCurrency();
  const expense = route?.params?.expense as Expense | undefined;

  // State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>(currencyCode);

  // UI State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  // Data State
  const [shortcuts, setShortcuts] = useState<ExpenseShortcut[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  // Shortcut Modal State
  const [showManageShortcuts, setShowManageShortcuts] = useState(false);

  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

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
    loadCategories();
  }, []);

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
  }, [expense, currencyCode]);

  const loadShortcuts = async () => {
    try {
      const shortcutsData = await getSmartExpenseShortcuts();
      setShortcuts(shortcutsData);
    } catch (error) {
      // Ignore
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getCustomCategories('expense');
      setCategories(data);
      if (!expense && data.length > 0) {
        const defaultCat = data.find(cat => cat.name === 'طعام') || data[0];
        setCategory(defaultCat.name);
      }
    } catch (error) {
      // Ignore
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
    const finalTitle = title.trim() || category || 'مصروف';
    if (!finalTitle) {
      alertService.warning('تنبيه', 'يرجى إدخال العنوان أو الفئة');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);
    try {
      const expenseData = {
        title: finalTitle,
        amount: Number(amount),
        base_amount: convertedAmount !== null ? convertedAmount : Number(amount),
        category: category,
        date: formatDateLocal(date),
        description: description.trim(),
        currency: currency,
      };

      if (expense) {
        await updateExpense(expense.id, expenseData);
        alertService.toastSuccess('تم التحديث بنجاح');
      } else {
        await addExpense(expenseData);
        alertService.toastSuccess('تمت الإضافة بنجاح');
      }
      navigation.goBack();
      resetForm();
    } catch (error: any) {
      alertService.error('خطأ', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShortcutUsed = async (shortcut: any) => {
    const s = shortcut as ExpenseShortcut;
    try {
      await addExpense({
        title: s.title,
        amount: s.amount,
        category: s.category as ExpenseCategory,
        date: new Date().toISOString().split('T')[0],
        description: s.description || '',
        currency: s.currency || currencyCode,
      });
      navigation.goBack();
      alertService.toastSuccess('أضيف من الاختصار');
    } catch (error: any) {
      alertService.error('خطأ', error.message);
    }
  };


  const getCategoryInfo = (categoryName: string) => {
    const cat = categories.find(c => c.name === categoryName);
    if (cat) return { icon: cat.icon, color: cat.color };

    // Fallback defaults
    const defaultInfo = { icon: 'ellipse', color: '#6B7280' };
    // ... mapping logic can be simplified or copied if strictly needed, 
    // but since we rely on customCategories which includes defaults now, this is safer.
    return defaultInfo;
  };

  const currentCategoryInfo = getCategoryInfo(category);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{expense ? 'تعديل مصروف' : 'مصروف جديد'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Amount Section */}
          <View style={styles.amountSection}>
            <Text style={styles.currencySymbol}>{CURRENCIES.find(c => c.code === currency)?.symbol}</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(convertArabicToEnglish(v))}
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted + '80'}
              style={styles.amountInput}
              keyboardType="numeric"
              autoFocus={!expense}
              selectionColor={theme.colors.primary}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
            />
          </View>
          {convertedAmount !== null && (
            <Text style={styles.convertedText}>≈ {formatCurrency(convertedAmount)}</Text>
          )}

          <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={styles.currencyPill}>
            <Text style={styles.currencyPillText}>{currency}</Text>
            <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>


          {/* Shortcuts (Mini) */}
          {!expense && (
            <View style={styles.shortcutsRow}>
              <View style={styles.shortcutsSectionHeader}>
                <Text style={styles.shortcutsSectionTitle}>اختصارات سريعة</Text>
                <TouchableOpacity style={styles.addShortcutButton} onPress={() => setShowManageShortcuts(true)}>
                  <Ionicons name="settings-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.addShortcutButtonText}>إدارة</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsContent}>
                <TouchableOpacity style={styles.addShortcutMini} onPress={() => setShowManageShortcuts(true)}>
                  <Ionicons name="add" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                {shortcuts.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.shortcutChip, { backgroundColor: theme.colors.surface }]}
                    onPress={() => handleShortcutUsed(s)}
                  >
                    <Text style={styles.shortcutChipText}>{s.title}</Text>
                    <Text style={styles.shortcutChipAmount}>{s.amount}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}


          {/* Details Card */}
          <View style={styles.card}>

            {/* Categories */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>الفئة</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
                {categories.map(cat => {
                  const isSelected = category === cat.name;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catItem, isSelected && styles.catItemActive, { borderColor: isSelected ? cat.color : 'transparent' }]}
                      onPress={() => {
                        setCategory(cat.name);
                        if (!title) setTitle(cat.name);
                      }}
                    >
                      <View style={[styles.catIcon, { backgroundColor: isSelected ? cat.color : theme.colors.surfaceLight }]}>
                        <Ionicons name={cat.icon as any} size={20} color={isSelected ? '#FFF' : theme.colors.textSecondary} />
                      </View>
                      <Text style={[styles.catName, isSelected && { color: cat.color, fontWeight: '700' }]} numberOfLines={1}>{cat.name}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </View>

            {/* Title Input */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <Ionicons name="text-outline" size={20} color={theme.colors.textSecondary} />
              </View>
              <TextInput
                placeholder="عنوان المصروف (مثال: عشاء)"
                value={title}
                onChangeText={setTitle}
                style={styles.fieldInput}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                placeholderTextColor={theme.colors.textMuted}
              />
            </View>

            <View style={styles.divider} />

            {/* Date Picker */}
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
              </View>
              <Text style={styles.fieldText}>
                {date.toLocaleDateString('ar-IQ', {
                  weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Description */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
              </View>
              <TextInput
                placeholder="ملاحظات إضافية..."
                value={description}
                onChangeText={setDescription}
                style={[styles.fieldInput]}
                underlineColor="transparent"
                activeUnderlineColor="transparent"
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
            </View>

          </View>
        </ScrollView>

        {/* Floating Save Button */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: currentCategoryInfo.color || theme.colors.primary }]} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>حفظ المصروف</Text>}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* Modals reused logic but simpler render? keeping standard modals for picker is fine */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          onChange={(_, d) => {
            setShowDatePicker(false);
            if (d) setDate(d);
          }}
        />
      )}

      {/* Currency Modal */}
      <Modal visible={showCurrencyPicker} transparent animationType="slide" onRequestClose={() => setShowCurrencyPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCurrencyPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>اختر العملة</Text>
            <ScrollView>
              {CURRENCIES.map(c => (
                <TouchableOpacity key={c.code} style={styles.modalItem} onPress={() => { setCurrency(c.code); setShowCurrencyPicker(false); }}>
                  <Text style={[styles.modalItemText, currency === c.code && { color: theme.colors.primary, fontWeight: 'bold' }]}>{c.name} ({c.symbol})</Text>
                  {currency === c.code && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Manage Shortcuts Modal */}
      <ManageShortcutsModal
        visible={showManageShortcuts}
        type="expense"
        onClose={() => { setShowManageShortcuts(false); loadShortcuts(); }}
        onShortcutUsed={handleShortcutUsed}
      />

    </SafeAreaView>
  );
};

// ActivityIndicator placeholder if not imported
const ActivityIndicator = ({ color }: { color: string }) => <Text style={{ color }}>...</Text>;

const createStyles = (theme: AppTheme) => StyleSheet.create({
  flex1: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  currencySymbol: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    marginHorizontal: 8,
    fontFamily: theme.typography.fontFamily,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    textAlign: 'center',
    minWidth: 100,
    padding: 0,
    height: 60,
  },
  convertedText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  currencyPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    marginBottom: 20,
    ...getPlatformShadow('sm'),
  },
  currencyPillText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
  },
  shortcutsRow: {
    marginBottom: 12,
  },
  shortcutsSectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shortcutsSectionTitle: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  addShortcutButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '18',
  },
  addShortcutButtonText: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  shortcutsContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  addShortcutMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  shortcutChipText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  shortcutChipAmount: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    ...getPlatformShadow('sm'),
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
  },
  categoriesList: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
  },
  catItem: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    padding: 4,
    borderRadius: 18,
  },
  catItemActive: {
    // styles handled inline for color
  },
  catIcon: {
    width: 48,
    height: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    width: 60,
    textAlign: 'center',
  },
  fieldRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    height: 40,
    padding: 0,
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
    marginLeft: 48, // Indent to align with text
  },
  footer: {
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  saveBtn: {
    height: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('md'),
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: theme.typography.fontFamily,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayCentered: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalItemText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  alertBox: {
    backgroundColor: theme.colors.surface,
    width: '85%',
    borderRadius: 18,
    padding: 16,
    ...getPlatformShadow('lg'),
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  alertMsg: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginBottom: 16,
    fontFamily: theme.typography.fontFamily,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  alertBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
  },
  alertBtnText: {
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  }
});
