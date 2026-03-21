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
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Income, IncomeSource, INCOME_SOURCES, CURRENCIES } from '../types';
import {
  addIncome,
  updateIncome,
  IncomeShortcut,
  getCustomCategories,
  CustomCategory
} from '../database/database';
import { ManageShortcutsModal } from './ManageShortcutsModal';
import { CurrencyPickerModal } from './CurrencyPickerModal';
import { alertService } from '../services/alertService';
import { formatDateLocal } from '../utils/date';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { getSmartIncomeShortcuts } from '../services/smartShortcutsService';
import { resolveIoniconName, toOutlineIoniconName } from '../utils/icon-utils';
import { AppBottomSheet, AppButton } from '../design-system';

interface AddIncomeModalProps {
  visible: boolean;
  onClose: () => void;
  income?: Income | null;
  onSave?: () => void;
}

export const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  visible,
  onClose,
  income,
  onSave,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, formatCurrency } = useCurrency();
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState<IncomeSource>('salary');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [shortcuts, setShortcuts] = useState<IncomeShortcut[]>([]);
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
    if (income) {
      setSource(income.source);
      setAmount(formatNumberWithCommas(income.amount));
      setDate(new Date(income.date));
      setDescription(income.description || '');
      setCurrency(income.currency || currencyCode);

      // Set income source (category)
      if (income.category) {
        setIncomeSource(income.category as IncomeSource);
      } else {
        // Try to infer from source name for legacy data
        const normalizedSource = income.source.toLowerCase().trim();
        // Check custom categories
        const customCat = categories.find(c =>
          c.name.toLowerCase() === normalizedSource ||
          c.name === income.source
        );
        if (customCat) {
          setIncomeSource(customCat.name);
        } else {
          // Check default sources
          const defaultSrc = Object.keys(INCOME_SOURCES).find(key =>
            INCOME_SOURCES[key as IncomeSource] === income.source
          );
          if (defaultSrc) {
            setIncomeSource(defaultSrc as IncomeSource);
          }
        }
      }
      setShowShortcuts(false);
    } else {
      resetForm();
      setShowShortcuts(true);
      loadShortcuts();
    }
  }, [income, visible, currencyCode]);

  const loadShortcuts = async () => {
    try {
      const shortcutsData = await getSmartIncomeShortcuts();
      setShortcuts(shortcutsData);
    } catch (error) {
      // Ignore error
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getCustomCategories('income');
      setCategories(data);
      // Set default source if no source is selected
      if (!income && data.length > 0) {
        const defaultCat = data.find(cat => cat.name === 'راتب') || data[0];
        setIncomeSource(defaultCat.name);
      }
    } catch (error) {
      // Ignore error
    }
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
    if (!source.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال مصدر الدخل');
      return;
    }

    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount.trim() || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);

    try {
      const incomeData = {
        source: source.trim(),
        amount: Number(cleanAmount),
        date: formatDateLocal(date),
        description: description.trim(),
        currency: currency,
        category: incomeSource,
      };

      if (income) {
        await updateIncome(income.id, incomeData);
      } else {
        await addIncome(incomeData);
      }

      onSave?.();
      onClose();
      resetForm();
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الدخل');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleShortcutPress = async (shortcut: IncomeShortcut) => {
    try {
      const incomeData = {
        source: shortcut.source,
        amount: shortcut.amount,
        date: formatDateLocal(new Date()),
        description: shortcut.description || '',
        currency: shortcut.currency || currencyCode,
      };

      await addIncome(incomeData);
      onSave?.();
      onClose();
      alertService.toastSuccess('تم إضافة الدخل بنجاح');
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء إضافة الدخل');
    }
  };



  const sourceIcons: Record<IncomeSource, string> = {
    salary: 'cash',
    business: 'briefcase',
    investment: 'trending-up',
    gift: 'gift',
    other: 'ellipse',
  };

  const sourceColors: Record<IncomeSource, string[]> = {
    salary: [theme.colors.success, theme.colors.success],
    business: [theme.colors.info, theme.colors.info],
    investment: [theme.colors.primary, theme.colors.primary],
    gift: [theme.colors.error, theme.colors.error],
    other: [theme.colors.textSecondary, theme.colors.textMuted],
  };

  // Helper function to get source info from database or fallback to defaults
  const getSourceInfo = (sourceName: string) => {
    const cat = categories.find(c => c.name === sourceName);
    if (cat) {
      return {
        icon: resolveIoniconName(cat.icon, 'ellipse'),
        color: cat.color,
        colors: [cat.color, cat.color],
      };
    }
    // Fallback to default sources
    const defaultKey = Object.keys(INCOME_SOURCES).find(
      key => INCOME_SOURCES[key as IncomeSource] === sourceName
    ) as IncomeSource;
    if (defaultKey) {
      return {
        icon: sourceIcons[defaultKey] || 'ellipse',
        color: sourceColors[defaultKey]?.[0] || theme.colors.textSecondary,
        colors: sourceColors[defaultKey] || [theme.colors.textSecondary, theme.colors.textMuted],
      };
    }
    return {
      icon: 'ellipse',
      color: theme.colors.textSecondary,
      colors: [theme.colors.textSecondary, theme.colors.textMuted],
    };
  };


  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      title={income ? 'تعديل الدخل' : 'دخل جديد'}
      maxHeight="98%"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
                  {/* Shortcuts Section - Only show when adding new income */}
                  {!income && (
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
                                style={styles.shortcutCardPressable}
                                activeOpacity={0.8}
                              >
                                <LinearGradient
                                  colors={getSourceInfo(shortcut.incomeSource).colors as any}
                                  style={styles.shortcutGradient}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                >
                                  <View style={styles.shortcutIconContainer}>
                                    <Ionicons name={getSourceInfo(shortcut.incomeSource).icon as any} size={28} color={theme.colors.background} />
                                  </View>
                                  <Text style={styles.shortcutTitle} numberOfLines={1}>{shortcut.source}</Text>
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
                            colors={theme.gradients.success as any}
                            style={styles.addFirstShortcutGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            <View style={styles.addFirstShortcutIconContainer}>
                              <Ionicons name="flash" size={24} color={theme.colors.background} />
                            </View>
                            <View style={styles.addFirstShortcutTextContainer}>
                              <Text style={styles.addFirstShortcutTitle}>أنشئ اختصاراً سريعاً</Text>
                              <Text style={styles.addFirstShortcutSubtitle}>احفظ هذا الدخل كاختصار لإضافته بضغطة واحدة</Text>
                            </View>
                            <Ionicons name="chevron-back" size={20} color={theme.colors.background} />
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Source Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>مصدر الدخل</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={source}
                        onChangeText={setSource}
                        placeholder="مثال: راتب شهري"
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

                  {/* Source Type Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>نوع المصدر</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryScroll}
                    >
                      {categories.map((cat) => {
                        const isSelected = incomeSource === cat.name;
                        const icon = isSelected ? resolveIoniconName(cat.icon, 'ellipse') : toOutlineIoniconName(cat.icon, 'ellipse-outline');

                        return (
                          <AppButton
                            key={cat.id}
                            label={cat.name}
                            onPress={() => setIncomeSource(cat.name)}
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
                    {!income && (
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
                      label={income ? 'تحديث' : 'حفظ'}
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

      {/* Manage Shortcuts Modal */}
      <ManageShortcutsModal
        visible={showManageShortcuts}
        type="income"
        onClose={() => { setShowManageShortcuts(false); loadShortcuts(); }}
        onShortcutUsed={(s) => { handleShortcutPress(s as IncomeShortcut); }}
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
    writingDirection: 'rtl',
  },
  categoryTextActive: {
    fontSize: theme.typography.sizes.sm,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    writingDirection: 'rtl',
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
    direction: 'rtl',
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
    flexDirection: isRTL ? 'row' : 'row-reverse',
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
    backgroundColor: 'transparent',
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
  toggleButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceLight,
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
    width: '100%',
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
    paddingVertical: theme.spacing.md,
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
    paddingVertical: theme.spacing.md,
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
