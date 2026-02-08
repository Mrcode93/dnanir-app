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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow } from '../utils/theme';
import { Income, IncomeSource, INCOME_SOURCES, CURRENCIES } from '../types';
import {
  addIncome,
  updateIncome,
  getIncomeShortcuts,
  addIncomeShortcut,
  deleteIncomeShortcut,
  updateIncomeShortcut,
  IncomeShortcut,
  getCustomCategories,
  CustomCategory
} from '../database/database';
import { alertService } from '../services/alertService';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { convertArabicToEnglish } from '../utils/numbers';
import { formatDateLocal } from '../utils/date';

interface AddIncomeScreenProps {
  navigation: any;
  route: any;
}

export const AddIncomeScreen: React.FC<AddIncomeScreenProps> = ({
  navigation,
  route,
}) => {
  const { currencyCode, formatCurrency } = useCurrency();
  const income = route?.params?.income as Income | undefined;

  // State
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState<IncomeSource>('salary'); // Default
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>(currencyCode);

  // UI State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  // Data State
  const [shortcuts, setShortcuts] = useState<IncomeShortcut[]>([]);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  // Shortcut Modal State
  const [showAddShortcutModal, setShowAddShortcutModal] = useState(false);
  const [showEditShortcutModal, setShowEditShortcutModal] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<IncomeShortcut | null>(null);

  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

  useEffect(() => {
    const convert = async () => {
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
    convert();
  }, [amount, currency, currencyCode]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (income) {
      setSource(income.source);
      setAmount(income.amount.toString());
      setDate(new Date(income.date));
      setDescription(income.description || '');
      setCurrency(income.currency || currencyCode);

      // Match category/source
      const match = categories.find(c => c.name === income.source);
      if (match) {
        setIncomeSource(match.name);
      } else if (income.category) {
        setIncomeSource(income.category as IncomeSource);
      } else {
        // fallback
        setIncomeSource(income.source);
      }
    } else {
      resetForm();
      loadShortcuts();
    }
  }, [income, currencyCode, categories]); // Added categories dep to re-match if loaded later

  const loadShortcuts = async () => {
    try {
      const data = await getIncomeShortcuts();
      setShortcuts(data);
    } catch (e) { /* ignore */ }
  };

  const loadCategories = async () => {
    try {
      const data = await getCustomCategories('income');
      setCategories(data);
      if (!income && data.length > 0) {
        const defaultCat = data.find(c => c.name === 'راتب') || data[0];
        setIncomeSource(defaultCat.name);
      }
    } catch (e) { /* ignore */ }
  };

  const resetForm = () => {
    setSource('');
    setAmount('');
    setIncomeSource('salary');
    setDate(new Date());
    setDescription('');
    setCurrency(currencyCode);
  };

  const handleSave = async () => {
    const finalSource = source.trim() || incomeSource || 'أخرى';
    if (!finalSource) {
      alertService.warning('تنبيه', 'يرجى إدخال المصدر');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);
    try {
      const data = {
        source: finalSource,
        amount: Number(amount),
        date: formatDateLocal(date),
        description: description.trim(),
        currency: currency,
        category: incomeSource,
      };

      if (income) {
        await updateIncome(income.id, data);
        alertService.success('تم', 'تم تحديث الدخل');
      } else {
        await addIncome(data);
        alertService.success('تم', 'تم إضافة الدخل');
      }
      navigation.goBack();
      resetForm();
    } catch (e: any) {
      alertService.error('خطأ', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShortcutPress = async (s: IncomeShortcut) => {
    try {
      await addIncome({
        source: s.source,
        amount: s.amount,
        category: s.incomeSource,
        currency: s.currency || currencyCode,
        date: new Date().toISOString().split('T')[0],
        description: s.description || '',
      });
      navigation.goBack();
      alertService.success('تم', 'أضيف من الاختصار');
    } catch (e: any) {
      alertService.error('خطأ', e.message);
    }
  };

  const handleAddShortcut = async () => {
    if (!source.trim() || !amount.trim()) return;
    try {
      await addIncomeShortcut({
        source: source.trim(),
        amount: Number(amount),
        incomeSource,
        currency,
        description: description.trim() || undefined
      });
      await loadShortcuts();
      setShowAddShortcutModal(false);
      alertService.success('تم', 'تم حفظ الاختصار');
    } catch (e) {
      alertService.error('خطأ', 'فشل حفظ الاختصار');
    }
  };

  const handleDeleteShortcut = async (id: number) => {
    try {
      await deleteIncomeShortcut(id);
      await loadShortcuts();
    } catch (e) { /* ignore */ }
  };

  const handleUpdateShortcut = async () => {
    if (!editingShortcut) return;
    try {
      await updateIncomeShortcut(editingShortcut.id, {
        source: source.trim(),
        amount: Number(amount),
        incomeSource,
        currency,
        description: description.trim() || undefined
      });
      await loadShortcuts();
      setShowEditShortcutModal(false);
      setEditingShortcut(null);
      alertService.success('تم', 'تم تحديث الاختصار');
    } catch (e) {
      alertService.error('خطأ', 'فشل التحديث');
    }
  };

  const handleEditShortcutPress = (s: IncomeShortcut) => {
    setSource(s.source);
    setAmount(s.amount.toString());
    setIncomeSource(s.incomeSource);
    setCurrency(s.currency || currencyCode);
    setDescription(s.description || '');
    setEditingShortcut(s);
    setShowEditShortcutModal(true);
  };

  const handleCancelEditShortcut = () => {
    if (editingShortcut) {
      // Reset form
      if (income) {
        setSource(income.source);
        setAmount(income.amount.toString());
        // ... restore others
      } else {
        resetForm();
      }
    }
    setShowEditShortcutModal(false);
    setEditingShortcut(null);
  }

  const getSourceInfo = (name: string) => {
    const cat = categories.find(c => c.name === name);
    if (cat) return { icon: cat.icon, color: cat.color };
    return { icon: 'wallet-outline', color: theme.colors.primary };
  };

  const currentSourceInfo = getSourceInfo(incomeSource);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.flex1}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{income ? 'تعديل دخل' : 'دخل جديد'}</Text>
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
                autoFocus={!income}
                selectionColor={theme.colors.success}
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
            {!income && shortcuts.length > 0 && (
              <View style={styles.shortcutsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsContent}>
                  <TouchableOpacity style={styles.addShortcutMini} onPress={() => setShowAddShortcutModal(true)}>
                    <Ionicons name="add" size={20} color={theme.colors.success} />
                  </TouchableOpacity>
                  {shortcuts.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.shortcutChip, { backgroundColor: theme.colors.surface }]}
                      onPress={() => handleShortcutPress(s)}
                      onLongPress={() => handleEditShortcutPress(s)}
                    >
                      <Text style={styles.shortcutChipText}>{s.source}</Text>
                      <Text style={styles.shortcutChipAmount}>{s.amount}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Form Card */}
            <View style={styles.card}>
              {/* Source Categories */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>المصدر</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
                  {categories.map(cat => {
                    const isSelected = incomeSource === cat.name;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.catItem, isSelected && { borderColor: cat.color }]}
                        onPress={() => {
                          setIncomeSource(cat.name);
                          if (!source) setSource(cat.name);
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

              {/* Source Name Input */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Ionicons name="wallet-outline" size={20} color={theme.colors.textSecondary} />
                </View>
                <TextInput
                  placeholder="مصدر الدخل (مثال: مكافأة)"
                  value={source}
                  onChangeText={setSource}
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

          {/* Footer containing Button - NOT absolute */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: currentSourceInfo.color || theme.colors.success }]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? <Text style={styles.saveBtnText}>...</Text> : <Text style={styles.saveBtnText}>حفظ الدخل</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
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
                  <Text style={[styles.modalItemText, currency === c.code && { color: theme.colors.success, fontWeight: 'bold' }]}>{c.name} ({c.symbol})</Text>
                  {currency === c.code && <Ionicons name="checkmark" size={20} color={theme.colors.success} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Add Shortcut Modal */}
      <Modal visible={showAddShortcutModal} transparent animationType="fade" onRequestClose={() => setShowAddShortcutModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddShortcutModal(false)}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>إضافة اختصار</Text>
            <Text style={styles.alertMsg}>هل تريد حفظ هذا الدخل كاختصار؟</Text>
            <View style={styles.alertActions}>
              <TouchableOpacity style={styles.alertBtn} onPress={() => setShowAddShortcutModal(false)}><Text style={styles.alertBtnText}>إلغاء</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.alertBtn, { backgroundColor: theme.colors.success }]} onPress={handleAddShortcut}><Text style={[styles.alertBtnText, { color: '#FFF' }]}>حفظ</Text></TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Shortcut Modal */}
      <Modal visible={showEditShortcutModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={handleCancelEditShortcut}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>تعديل الاختصار</Text>
            <Text style={styles.alertMsg}>اضغط تحديث لحفظ التغييرات</Text>
            <View style={styles.alertActions}>
              <TouchableOpacity style={styles.alertBtn} onPress={handleCancelEditShortcut}><Text style={styles.alertBtnText}>إلغاء</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.alertBtn, { backgroundColor: theme.colors.success }]} onPress={handleUpdateShortcut}><Text style={[styles.alertBtnText, { color: '#FFF' }]}>تحديث</Text></TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    paddingBottom: 20,
  },
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
    marginBottom: 30,
    ...getPlatformShadow('sm'),
  },
  currencyPillText: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
  },
  shortcutsRow: {
    marginBottom: 20,
  },
  shortcutsContent: {
    paddingHorizontal: 20,
    gap: 12,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  addShortcutMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.success,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutChip: {
    paddingHorizontal: 16,
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
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    ...getPlatformShadow('sm'),
  },
  section: {
    marginBottom: 24,
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
    gap: 16,
  },
  catItem: {
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    padding: 4,
    borderColor: 'transparent',
    borderRadius: 24,
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
    gap: 12,
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
    marginLeft: 48,
  },
  footerContainer: {
    padding: 20,
    backgroundColor: theme.colors.background,
    // No absolute positioning prevents keyboard overlap
  },
  saveBtn: {
    height: 56,
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
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
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
    borderRadius: 24,
    padding: 24,
    alignSelf: 'center',
    top: '30%',
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
    marginBottom: 24,
    fontFamily: theme.typography.fontFamily,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 12,
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
