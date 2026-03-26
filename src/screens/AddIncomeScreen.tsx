import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Pressable, StatusBar, Keyboard, FlatList } from 'react-native';
import { TextInput } from 'react-native-paper';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Income, IncomeSource, INCOME_SOURCES, CURRENCIES } from '../types';
import { addIncome, updateIncome, IncomeShortcut, getCustomCategories, CustomCategory } from '../database/database';
import { ManageShortcutsModal } from '../components/ManageShortcutsModal';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';
import { alertService } from '../services/alertService';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { formatDateLocal } from '../utils/date';
import { getSmartIncomeShortcuts } from '../services/smartShortcutsService';
import { resolveIoniconName, toOutlineIoniconName } from '../utils/icon-utils';
import { ScreenContainer, AppHeader, AppButton, AppBottomSheet } from '../design-system';
import { tl, useLocalization } from "../localization";
import { useWallets } from '../context/WalletContext';
interface AddIncomeScreenProps {
  navigation: any;
  route: any;
}
export const AddIncomeScreen: React.FC<AddIncomeScreenProps> = ({
  navigation,
  route
}) => {
  const {
    language
  } = useLocalization();
  const {
    theme,
    isDark
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    currencyCode,
    formatCurrency,
    loading: currencyLoading
  } = useCurrency();
  const income = route?.params?.income as Income | undefined;
  const isInitialized = React.useRef(false);
  const amountInputRef = React.useRef<any>(null);
  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{
          name: 'Main'
        }]
      });
    }
  };

  // State
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState<IncomeSource>('salary'); // Default
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>(currencyCode);
  const { wallets, selectedWallet } = useWallets();
  const [walletId, setWalletId] = useState<number | undefined>(undefined);

  // UI State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  // Data State
  const [shortcuts, setShortcuts] = useState<IncomeShortcut[]>([]);
  const [categories, setCategories] = useState<CustomCategory[]>([]);

  // Shortcut Modal State
  const [showManageShortcuts, setShowManageShortcuts] = useState(false);
  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);
  useEffect(() => {
    const convert = async () => {
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
    convert();
  }, [amount, currency, currencyCode]);
  useEffect(() => {
    loadCategories();
  }, []);
  useEffect(() => {
    if (currencyLoading) return;
    if (income) {
      if (!isInitialized.current) {
        setSource(income.source);
        setAmount(formatNumberWithCommas(income.amount));
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
        setWalletId(income.walletId);
        isInitialized.current = true;
      }
    } else {
      if (!isInitialized.current) {
        resetForm(route?.params?.initialDate ? new Date(route.params.initialDate) : undefined);
        setWalletId(selectedWallet?.id || wallets.find(w => w.isDefault)?.id || wallets[0]?.id);
        loadShortcuts();
        isInitialized.current = true;
        // Small delay for focus on Android is often more stable
        setTimeout(() => {
          amountInputRef.current?.focus();
        }, 300);
      }
    }
  }, [income, currencyCode, categories, currencyLoading]);
  const loadShortcuts = async () => {
    try {
      const data = await getSmartIncomeShortcuts();
      setShortcuts(data);
    } catch (e) {/* ignore */}
  };
  const loadCategories = async () => {
    try {
      const data = await getCustomCategories('income');
      setCategories(data);
      if (!income && data.length > 0) {
        const defaultCat = data.find(c => c.name === 'راتب') || data[0];
        setIncomeSource(defaultCat.name);
      }
    } catch (e) {/* ignore */}
  };
  const resetForm = (customDate?: Date) => {
    setSource('');
    setAmount('');
    setIncomeSource('salary');
    setDate(customDate || new Date());
    setDescription('');
    setCurrency(currencyCode);
  };
  const handleSave = async () => {
    const finalSource = source.trim();
    if (!finalSource) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مصدر الدخل"));
      return;
    }
    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount.trim() || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مبلغ صحيح"));
      return;
    }
    setLoading(true);
    try {
      const data = {
        source: finalSource,
        amount: Number(cleanAmount),
        base_amount: convertedAmount !== null ? convertedAmount : Number(cleanAmount),
        date: formatDateLocal(date),
        description: description.trim(),
        currency: currency,
        category: incomeSource,
        walletId: walletId
      };
      if (income) {
        await updateIncome(income.id, data);
        alertService.toastSuccess(tl("تم تحديث الدخل"));
      } else {
        await addIncome(data);
        alertService.toastSuccess(tl("تم إضافة الدخل"));
      }
      handleClose();
      resetForm();
    } catch (e: any) {
      alertService.error(tl("خطأ"), e.message);
    } finally {
      setLoading(false);
    }
  };
  const handleShortcutUsed = async (shortcut: any) => {
    const s = shortcut as IncomeShortcut;
    try {
      await addIncome({
        source: s.source,
        amount: s.amount,
        category: s.incomeSource,
        currency: s.currency || currencyCode,
        date: new Date().toISOString().split('T')[0],
        description: s.description || ''
      });
      handleClose();
      alertService.toastSuccess(tl("أضيف من الاختصار"));
    } catch (e: any) {
      alertService.error(tl("خطأ"), e.message);
    }
  };
  const getSourceInfo = (name: string) => {
    const cat = categories.find(c => c.name === name);
    if (cat) {
      return {
        icon: resolveIoniconName(cat.icon, 'wallet-outline'),
        color: cat.color || theme.colors.primary
      };
    }
    return {
      icon: 'wallet-outline',
      color: theme.colors.primary
    };
  };
  const currentSourceInfo = getSourceInfo(incomeSource);
  const saveFooter = <AppButton label={income ? tl("تحديث الدخل") : tl("حفظ الدخل")} onPress={handleSave} variant="primary" size="lg" loading={loading} disabled={loading} style={{
    backgroundColor: currentSourceInfo.color || theme.colors.success
  }} />;
  return <ScreenContainer scrollable edges={[]} scrollPadBottom={24}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <AppHeader title={income ? tl("تعديل دخل") : tl("دخل جديد")} backIcon="close" onBack={handleClose} />

      {/* Amount Section */}
      <View style={styles.amountSection}>
        <Text style={styles.currencySymbol}>{CURRENCIES.find(c => c.code === currency)?.symbol}</Text>
        <TextInput ref={amountInputRef} value={amount} onChangeText={v => {
        const cleaned = convertArabicToEnglish(v);
        setAmount(formatNumberWithCommas(cleaned));
      }} placeholder="0" placeholderTextColor={theme.colors.textMuted + '80'} style={styles.amountInput} keyboardType="decimal-pad" selectionColor={theme.colors.success} underlineColor="transparent" activeUnderlineColor="transparent" />
      </View>
      <View style={{
      height: 24,
      justifyContent: 'center'
    }}>
        {convertedAmount !== null && <Text style={styles.convertedText}>≈ {formatCurrency(convertedAmount)}</Text>}
      </View>

      <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={styles.currencyPill}>
        <Text style={styles.currencyPillText}>{currency}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {/* Shortcuts (Mini) */}
      {!income && <View style={styles.shortcutsRow}>
          <View style={styles.shortcutsSectionHeader}>
            <Text style={styles.shortcutsSectionTitle}>{tl("اختصارات سريعة")}</Text>
            <TouchableOpacity style={styles.addShortcutButton} onPress={() => setShowManageShortcuts(true)}>
              <Ionicons name="settings-outline" size={16} color={theme.colors.success} />
              <Text style={styles.addShortcutButtonText}>{tl("إدارة")}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcutsContent}>
            <TouchableOpacity style={styles.addShortcutMini} onPress={() => setShowManageShortcuts(true)}>
              <Ionicons name="add" size={24} color="#10B981" />
            </TouchableOpacity>
            {shortcuts.map(s => <TouchableOpacity key={s.id} style={styles.shortcutChip} onPress={() => handleShortcutUsed(s)}>
                <View style={styles.shortcutChipIconContainer}>
                  <Ionicons name="add" size={18} color="#10B981" />
                </View>
                <Text style={styles.shortcutChipText}>{s.source}</Text>
                <Text style={styles.shortcutChipAmount}>{s.amount}{tl("د.ع")}</Text>
              </TouchableOpacity>)}
          </ScrollView>
        </View>}

      {/* Form Card */}
      <View style={styles.card}>
        {/* Source Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tl("المصدر")}</Text>
          <FlatList data={categories} horizontal inverted={isRTL} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList} keyExtractor={item => item.id.toString()} renderItem={({
          item: cat
        }) => {
          const isSelected = incomeSource === cat.name;
          const iconName = isSelected ? resolveIoniconName(cat.icon, 'wallet-outline') : toOutlineIoniconName(cat.icon, 'wallet-outline');
          return <TouchableOpacity key={cat.id} style={[styles.catItem, isSelected && {
            borderColor: cat.color
          }]} onPress={() => {
            setIncomeSource(cat.name);
          }}>
                  <View style={[styles.catIcon, {
              backgroundColor: isSelected ? cat.color : theme.colors.surfaceLight
            }]}>
                    <Ionicons name={iconName} size={20} color={isSelected ? theme.colors.background : theme.colors.textSecondary} />
                  </View>
                  <Text style={[styles.catName, isSelected && {
              color: cat.color,
              fontWeight: '700'
            }]} numberOfLines={1}>{cat.name}</Text>
                </TouchableOpacity>;
        }} />
        </View>

        {/* Source Name Input */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="wallet-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput placeholder={tl("مصدر الدخل (مثال: مكافأة)")} value={source} onChangeText={setSource} style={styles.fieldInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} />
        </View>

        <View style={styles.divider} />

        {/* Date Picker */}
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.fieldText}>
            {date.toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Wallet Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{tl("المحفظة")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {wallets.map(w => {
              const isSelected = walletId === w.id;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.walletChip,
                    isSelected && { borderColor: w.color || theme.colors.primary, backgroundColor: (w.color || theme.colors.primary) + '15' }
                  ]}
                  onPress={() => setWalletId(w.id)}
                >
                  <Ionicons 
                    name={(w.icon as any) || 'wallet'} 
                    size={16} 
                    color={isSelected ? (w.color || theme.colors.primary) : theme.colors.textSecondary} 
                  />
                  <Text style={[
                    styles.walletChipText,
                    isSelected && { color: w.color || theme.colors.primary, fontWeight: 'bold' }
                  ]}>
                    {w.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {/* Description */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput placeholder={tl("ملاحظات إضافية...")} value={description} onChangeText={setDescription} style={[styles.fieldInput]} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} multiline />
        </View>
      </View>

      {/* Save Button moved inside scroll view */}
      <View style={{
      paddingHorizontal: 16,
      marginTop: 24,
      marginBottom: 20
    }}>
        {saveFooter}
      </View>

      {/* Modals */}
      {showDatePicker && <CustomDatePicker value={date} onChange={(_, d) => {
      if (d) setDate(d);
      if (Platform.OS === 'android') setShowDatePicker(false);
    }} onClose={() => setShowDatePicker(false)} />}

      {/* Currency Picker */}
      <CurrencyPickerModal visible={showCurrencyPicker} selectedCurrency={currency} onSelect={code => {
      setCurrency(code);
      setShowCurrencyPicker(false);
    }} onClose={() => setShowCurrencyPicker(false)} />

      {/* Manage Shortcuts Modal */}
      <ManageShortcutsModal visible={showManageShortcuts} onClose={() => {
      setShowManageShortcuts(false);
      loadShortcuts();
    }} onShortcutUsed={handleShortcutUsed} />

    </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily
  },
  amountInput: {
    fontSize: theme.typography.sizes.display,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    textAlign: 'center',
    minWidth: 100,
    padding: 0,
    height: 60
  },
  convertedText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.sm
  },
  currencyPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
    gap: 4,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('sm')
  },
  currencyPillText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600')
  },
  shortcutsRow: {
    marginBottom: 12,
    paddingHorizontal: theme.spacing.md
  },
  shortcutsSectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  shortcutsSectionTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  addShortcutButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#10B98115' // light green transluscent
  },
  addShortcutButtonText: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('700'),
    color: '#10B981',
    fontFamily: theme.typography.fontFamily
  },
  shortcutsContent: {
    paddingHorizontal: 0,
    gap: 12,
    flexDirection: isRTL ? 'row-reverse' : 'row' // Matches exact layout requested
  },
  addShortcutMini: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#10B981',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  shortcutChip: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10B98130',
    backgroundColor: '#10B98105',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120
  },
  shortcutChipIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  shortcutChipText: {
    fontSize: 16,
    color: '#10B981',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    marginBottom: 4
  },
  shortcutChipAmount: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...getPlatformShadow('sm')
  },
  section: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    textAlign: isRTL ? 'right' : 'left'
  },
  categoriesList: {
    paddingHorizontal: 0,
    gap: 10
    // Note: flexDirection row-reverse was causing issues with ScrollView offset, FlatList inverted handles it better
  },
  catItem: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderWidth: 2,
    padding: 4,
    borderColor: 'transparent',
    borderRadius: theme.borderRadius.lg,
    marginLeft: 10
  },
  catIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  catName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    width: 80,
    textAlign: 'center',
    fontWeight: getPlatformFontWeight('600')
  },
  fieldRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    height: 50,
    padding: 0
  },
  fieldText: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
    marginLeft: 44
  },
  // Modal Styles
  modalItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  modalItemText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    gap: 6,
  },
  walletChipText: {
    fontSize: 14,
    color: '#666',
  }
});
