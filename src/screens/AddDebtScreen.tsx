import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Keyboard, Dimensions, StatusBar, ScrollView, Platform } from 'react-native';
import { TextInput, IconButton, Surface } from 'react-native-paper';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { DEBT_TYPES, DEBT_DIRECTIONS, Debt, DebtDirection } from '../types';
import { getDebtInstallments, deleteDebtInstallment, addDebtInstallment, updateDebt, getFinancialStatsAggregated, getDebtors, addDebtor, Debtor } from '../database/database';
import { createDebt, generateInstallments } from '../services/debtService';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { useCurrency } from '../hooks/useCurrency';
import { ScreenContainer, AppHeader, AppButton, AppBottomSheet } from '../design-system';
import { tl, useLocalization } from "../localization";
const {
  width
} = Dimensions.get('window');
interface AddDebtScreenProps {
  navigation: any;
  route: any;
}
type DebtType = 'debt' | 'installment' | 'advance';
export const AddDebtScreen: React.FC<AddDebtScreenProps> = ({
  navigation,
  route
}) => {
  const {
    language
  } = useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency,
    currencyCode
  } = useCurrency();
  const editingDebt = route?.params?.debt as Debt | undefined;
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [selectedDebtorId, setSelectedDebtorId] = useState<number | null>(editingDebt?.debtorId || null);
  const [debtorName, setDebtorName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('owed_by_me');
  const [type, setType] = useState<DebtType>('debt');
  const [startDate, setStartDate] = useState(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [hasDueDate, setHasDueDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasInstallments, setHasInstallments] = useState(false);
  const [numberOfInstallments, setNumberOfInstallments] = useState('1');
  const [installmentFrequency, setInstallmentFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [currentBalance, setCurrentBalance] = useState(0);
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // New Debtor Modal
  const [showAddDebtorModal, setShowAddDebtorModal] = useState(false);
  const [newDebtorName, setNewDebtorName] = useState('');
  const [newDebtorPhone, setNewDebtorPhone] = useState('');

  useEffect(() => {
    loadBalance();
    loadDebtors();
    if (editingDebt) {
      setSelectedDebtorId(editingDebt.debtorId || null);
      setDebtorName(editingDebt.debtorName);
      setTotalAmount(formatNumberWithCommas(editingDebt.totalAmount));
      setDirection(editingDebt.direction || 'owed_by_me');
      setType(editingDebt.type);
      setStartDate(new Date(editingDebt.startDate));
      setDueDate(editingDebt.dueDate ? new Date(editingDebt.dueDate) : null);
      setHasDueDate(!!editingDebt.dueDate);
      setRemainingAmount(formatNumberWithCommas(editingDebt.remainingAmount));
      setDescription(editingDebt.description || '');
      setCurrency(editingDebt.currency || currencyCode);
      getDebtInstallments(editingDebt.id).then(insts => {
        setHasInstallments(insts.length > 0);
        if (insts.length > 0) {
          setNumberOfInstallments(insts.length.toString());
        }
      });
    } else {
      resetForm();
    }
  }, [editingDebt]);
  const loadDebtors = async () => {
    try {
      const list = await getDebtors();
      setDebtors(list);
    } catch (e) { }
  };
  const loadBalance = async () => {
    try {
      const stats = await getFinancialStatsAggregated();
      setCurrentBalance(stats.balance);
    } catch (error) { }
  };
  const resetForm = () => {
    setDebtorName('');
    setTotalAmount('');
    setDirection('owed_by_me');
    setType('debt');
    setStartDate(new Date());
    setDueDate(null);
    setHasDueDate(false);
    setDescription('');
    setHasInstallments(false);
    setNumberOfInstallments('1');
    setInstallmentFrequency('monthly');
    setRemainingAmount('');
    setCurrency(currencyCode);
  };
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const handleAddNewDebtor = async () => {
    if (!newDebtorName.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال اسم الشخص"));
      return;
    }
    try {
      const id = await addDebtor({
        name: newDebtorName.trim(),
        phone: newDebtorPhone.trim() || undefined
      });
      await loadDebtors();
      setSelectedDebtorId(id);
      setDebtorName(newDebtorName.trim());
      setShowAddDebtorModal(false);
      setNewDebtorName('');
      setNewDebtorPhone('');
      alertService.toastSuccess(tl("تم إضافة الشخص بنجاح"));
    } catch (e) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء إضافة الشخص"));
    }
  };
  const handleSave = async () => {
    const nameLabel = direction === 'owed_to_me' ? tl("اسم المدين (من يستحق عليه)") : tl("اسم الدائن أو الشخص");
    if (!debtorName.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال {{}}", [nameLabel]));
      return;
    }
    const cleanTotalAmount = totalAmount.replace(/,/g, '');
    if (!cleanTotalAmount.trim() || isNaN(Number(cleanTotalAmount)) || Number(cleanTotalAmount) <= 0) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مبلغ صحيح"));
      return;
    }
    setLoading(true);
    try {
      let debtorId = selectedDebtorId;
      if (!debtorId) {
        const existing = debtors.find(d => d.name === debtorName.trim());
        if (existing) {
          debtorId = existing.id;
        } else {
          debtorId = await addDebtor({
            name: debtorName.trim()
          });
        }
      }
      const amount = Number(cleanTotalAmount);
      // When editing, we reset remainingAmount to match totalAmount
      // because editing is usually used to fix an entry error.
      const finalRemainingAmount = amount;
      const debtData = {
        debtorName: debtorName.trim(),
        debtorId: debtorId || undefined,
        totalAmount: amount,
        remainingAmount: finalRemainingAmount,
        startDate: startDate.toISOString().split('T')[0],
        dueDate: hasDueDate && dueDate ? dueDate.toISOString().split('T')[0] : undefined,
        description: description.trim(),
        type: type,
        direction,
        currency: currency,
        isPaid: finalRemainingAmount <= 0
      };
      if (editingDebt) {
        await updateDebt(editingDebt.id, debtData);
        if (hasInstallments) {
          const existingInsts = await getDebtInstallments(editingDebt.id);
          for (const inst of existingInsts) {
            await deleteDebtInstallment(inst.id);
          }
          const numInst = parseInt(numberOfInstallments);
          const installments = generateInstallments(amount, numInst, startDate, installmentFrequency);
          for (const inst of installments) {
            await addDebtInstallment({
              debtId: editingDebt.id,
              amount: inst.amount,
              dueDate: inst.dueDate,
              isPaid: false,
              installmentNumber: installments.indexOf(inst) + 1
            });
          }
        }
      } else {
        let installments: {
          amount: number;
          dueDate: string;
        }[] | undefined;
        if (hasInstallments) {
          const numInst = parseInt(numberOfInstallments);
          installments = generateInstallments(amount, numInst, startDate, installmentFrequency);
        }
        await createDebt(debtorName.trim(), amount, startDate.toISOString().split('T')[0], type, hasDueDate && dueDate ? dueDate.toISOString().split('T')[0] : undefined, description.trim(), currency, installments, direction, debtorId || undefined);
      }
      handleClose();
      alertService.toastSuccess(editingDebt ? tl("تم تحديث الدين بنجاح") : tl("تم إضافة الدين بنجاح"));
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حفظ البيانات"));
    } finally {
      setLoading(false);
    }
  };
  const typeData: Record<DebtType, {
    label: string;
    icon: string;
    colors: string[];
  }> = {
    debt: {
      label: tl("دين"),
      icon: 'card',
      colors: theme.gradients.info
    },
    installment: {
      label: tl("أقساط"),
      icon: 'calendar',
      colors: theme.gradients.primary
    },
    advance: {
      label: tl("سلفة"),
      icon: 'cash',
      colors: theme.gradients.success
    }
  };
  const saveFooter = <AppButton label={loading ? tl("جاري الحفظ...") : editingDebt ? tl("تحديث البيانات") : tl("حفظ الالتزام")} onPress={handleSave} variant="primary" size="lg" loading={loading} disabled={loading} rightIcon="checkmark-circle" style={{
    backgroundColor: typeData[type].colors[0]
  }} />;
  return <ScreenContainer scrollable edges={[]} scrollPadBottom={32} style={{
    backgroundColor: theme.colors.background
  }}>
    {/* Header */}
    <AppHeader title={editingDebt ? tl("تعديل التزام") : tl("إضافة التزام جديد")} backIcon="close" onBack={handleClose} />

    {/* Amount Section - Premium Style */}
    <View style={styles.amountSection}>
      <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
        <Text style={styles.currencySymbol}>{currency}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>
      <TextInput value={totalAmount} onChangeText={v => {
        const cleaned = convertArabicToEnglish(v);
        setTotalAmount(formatNumberWithCommas(cleaned));
      }} placeholder="0" placeholderTextColor={theme.colors.textMuted + '80'} style={styles.amountInput} keyboardType="decimal-pad" selectionColor={typeData[type].colors[0]} underlineColor="transparent" activeUnderlineColor="transparent" />
    </View>

    {/* Balance Context */}
    <View style={styles.balanceContext}>
      <Ionicons name="wallet-outline" size={14} color={theme.colors.textSecondary} />
      <Text style={styles.balanceContextText}>{tl("رصيدك الحالي:")}{formatCurrency(currentBalance)}</Text>
    </View>

    {/* Main Form Fields */}
    <View style={styles.card}>
      {/* Direction Toggle - Clean Chips */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{tl("اتجاه الدين")}</Text>
        <View style={styles.directionToggleContainer}>
          <TouchableOpacity onPress={() => setDirection('owed_by_me')} style={[styles.directionToggleBtn, direction === 'owed_by_me' && {
            backgroundColor: theme.colors.error + '10',
            borderColor: theme.colors.error
          }]}>
            <Ionicons name={direction === 'owed_by_me' ? 'arrow-redo' : 'arrow-redo-outline'} size={20} color={direction === 'owed_by_me' ? theme.colors.error : theme.colors.textSecondary} />
            <Text style={[styles.directionToggleText, direction === 'owed_by_me' && {
              color: theme.colors.error,
              fontWeight: '700'
            }]}>
              {DEBT_DIRECTIONS.owed_by_me}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setDirection('owed_to_me')} style={[styles.directionToggleBtn, direction === 'owed_to_me' && {
            backgroundColor: theme.colors.success + '10',
            borderColor: theme.colors.success
          }]}>
            <Ionicons name={direction === 'owed_to_me' ? 'arrow-undo' : 'arrow-undo-outline'} size={20} color={direction === 'owed_to_me' ? theme.colors.success : theme.colors.textSecondary} />
            <Text style={[styles.directionToggleText, direction === 'owed_to_me' && {
              color: theme.colors.success,
              fontWeight: '700'
            }]}>
              {DEBT_DIRECTIONS.owed_to_me}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Debt Type Selection */}
      <View style={[styles.section, {
        marginTop: 8
      }]}>
        <Text style={styles.sectionLabel}>{tl("نوع الالتزام")}</Text>
        <View style={styles.typeSelectorRow}>
          {(Object.keys(typeData) as DebtType[]).map(t => {
            const isSelected = type === t;
            const data = typeData[t];
            return <TouchableOpacity key={t} onPress={() => setType(t)} style={[styles.typeSelectorItem, isSelected && {
              borderColor: data.colors[0],
              backgroundColor: data.colors[0] + '10'
            }]}>
              <View style={[styles.typeIconBox, {
                backgroundColor: isSelected ? data.colors[0] : theme.colors.surfaceLight
              }]}>
                <Ionicons name={(isSelected ? data.icon : `${data.icon}-outline`) as any} size={20} color={isSelected ? '#FFFFFF' : theme.colors.textSecondary} />
              </View>
              <Text style={[styles.typeNameText, isSelected && {
                color: data.colors[0],
                fontWeight: '700'
              }]}>
                {data.label}
              </Text>
            </TouchableOpacity>;
          })}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.divider} />

      {/* Debtor Suggestions */}
      {debtors.length > 0 && !selectedDebtorId && <View style={styles.debtorSuggestions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
          gap: 10
        }}>
          {debtors.filter(d => d.name.includes(debtorName)).map(d => <TouchableOpacity key={d.id} style={styles.debtorSuggestionChip} onPress={() => {
            setDebtorName(d.name);
            setSelectedDebtorId(d.id);
          }}>
            <View style={styles.debtorSuggestionAvatar}>
              <Text style={styles.debtorSuggestionAvatarText}>{d.name.charAt(0)}</Text>
            </View>
            <Text style={styles.debtorSuggestionName}>{d.name}</Text>
          </TouchableOpacity>)}
        </ScrollView>
      </View>}

      {/* Debtor/Person Name */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldIcon}>
          <Ionicons name="person-outline" size={20} color={selectedDebtorId ? theme.colors.primary : theme.colors.textSecondary} />
        </View>
        <TextInput placeholder={direction === 'owed_to_me' ? tl("اسم المدين") : tl("اسم الدائن")} value={debtorName} onChangeText={t => {
          setDebtorName(t);
          if (selectedDebtorId) setSelectedDebtorId(null);
        }} style={styles.fieldInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} />

        {!selectedDebtorId && <TouchableOpacity style={styles.addDebtorBtn} onPress={() => {
          setNewDebtorName(debtorName);
          setShowAddDebtorModal(true);
        }}>
          <Ionicons name="person-add-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>}

        {selectedDebtorId && <TouchableOpacity onPress={() => {
          setSelectedDebtorId(null);
          setDebtorName('');
        }}>
          <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>}
      </View>

      <View style={styles.divider} />

      {/* Date Row */}
      <TouchableOpacity onPress={() => setShowStartDatePicker(true)} style={styles.fieldRow}>
        <View style={styles.fieldIcon}>
          <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
        </View>
        <Text style={styles.fieldText}>{tl("بداية الالتزام:")}{startDate.toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
        </Text>
      </TouchableOpacity>

      {/* Due Date Row (Optional) */}
      {!hasInstallments && <>
        <View style={styles.divider} />
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="timer-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <View style={styles.dueDateControl}>
            <Text style={styles.fieldText}>{tl("موعد الاستحقاق (اختياري)")}</Text>
            <Switch value={hasDueDate} onValueChange={setHasDueDate} trackColor={{
              false: theme.colors.border,
              true: typeData[type].colors[0] + '80'
            }} thumbColor={hasDueDate ? typeData[type].colors[0] : theme.colors.surfaceCard} />
          </View>
        </View>

        {hasDueDate && <TouchableOpacity onPress={() => setShowDueDatePicker(true)} style={[styles.fieldRow, {
          paddingRight: 52
        }]}>
          <Text style={[styles.fieldText, {
            color: theme.colors.primary,
            paddingHorizontal: 44
          }]}>
            {dueDate ? dueDate.toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US') : tl("اختر التاريخ")}
          </Text>
        </TouchableOpacity>}
      </>}

      <View style={styles.divider} />

      {/* Installments Logic - Simplified UI */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldIcon}>
          <Ionicons name="repeat-outline" size={20} color={theme.colors.textSecondary} />
        </View>
        <View style={styles.dueDateControl}>
          <Text style={styles.fieldText}>{tl("دفع على شكل أقساط؟")}</Text>
          <Switch value={hasInstallments} onValueChange={setHasInstallments} trackColor={{
            false: theme.colors.border,
            true: typeData[type].colors[0] + '80'
          }} thumbColor={hasInstallments ? typeData[type].colors[0] : theme.colors.surfaceCard} />
        </View>
      </View>

      {hasInstallments && <View style={styles.installmentOptions}>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>{tl("عدد الأقساط")}</Text>
          <TextInput value={numberOfInstallments} onChangeText={v => {
            const cleaned = convertArabicToEnglish(v);
            if (cleaned === '' || /^\d+$/.test(cleaned)) {
              setNumberOfInstallments(cleaned);
            }
          }} keyboardType="number-pad" style={styles.miniInput} placeholder="1" underlineColor="transparent" activeUnderlineColor="transparent" />
        </View>
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>{tl("تكرار القسط")}</Text>
          <View style={styles.frequencyChips}>
            <TouchableOpacity onPress={() => setInstallmentFrequency('monthly')} style={[styles.freqChip, installmentFrequency === 'monthly' && {
              backgroundColor: typeData[type].colors[0]
            }]}>
              <Text style={[styles.freqChipText, installmentFrequency === 'monthly' && {
                color: '#FFFFFF'
              }]}>{tl("شهرياً")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setInstallmentFrequency('weekly')} style={[styles.freqChip, installmentFrequency === 'weekly' && {
              backgroundColor: typeData[type].colors[0]
            }]}>
              <Text style={[styles.freqChipText, installmentFrequency === 'weekly' && {
                color: '#FFFFFF'
              }]}>{tl("أسبوعياً")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>}

      <View style={styles.divider} />

      {/* Notes */}
      <View style={styles.fieldRow}>
        <View style={styles.fieldIcon}>
          <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
        </View>
        <TextInput placeholder={tl("ملاحظات...")} value={description} onChangeText={setDescription} style={styles.fieldInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} multiline />
      </View>
    </View>

    {/* Save Button */}
    <View style={{
      paddingHorizontal: 20,
      marginTop: 12,
      marginBottom: 24
    }}>
      {saveFooter}
    </View>

    {/* Date Pickers */}
    {showStartDatePicker && <CustomDatePicker value={startDate} onChange={(_, d) => {
      if (d) setStartDate(d);
      if (Platform.OS === 'android') setShowStartDatePicker(false);
    }} onClose={() => setShowStartDatePicker(false)} />}

    {showDueDatePicker && <CustomDatePicker value={dueDate || new Date()} onChange={(_, d) => {
      if (d) setDueDate(d);
      if (Platform.OS === 'android') setShowDueDatePicker(false);
    }} onClose={() => setShowDueDatePicker(false)} />}

    {/* Currency Picker */}
    <CurrencyPickerModal visible={showCurrencyPicker} selectedCurrency={currency} onSelect={code => {
      setCurrency(code);
      setShowCurrencyPicker(false);
    }} onClose={() => setShowCurrencyPicker(false)} />

    {/* Add Debtor Modal */}
    <AppBottomSheet visible={showAddDebtorModal} onClose={() => setShowAddDebtorModal(false)} title={tl("إضافة شخص جديد")}>
      <View style={styles.modalContent}>
        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>{tl("الاسم")}</Text>
          <TextInput value={newDebtorName} onChangeText={setNewDebtorName} placeholder={tl("أدخل الاسم")} style={styles.modalInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} />
        </View>
        <View style={styles.modalField}>
          <Text style={styles.modalLabel}>{tl("رقم الهاتف (اختياري)")}</Text>
          <TextInput value={newDebtorPhone} onChangeText={setNewDebtorPhone} placeholder="07xxxxxxxx" keyboardType="phone-pad" style={styles.modalInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} />
        </View>
        <AppButton label={tl("حفظ الشخص")} onPress={handleAddNewDebtor} variant="primary" style={{
          marginTop: 10
        }} />
      </View>
    </AppBottomSheet>
  </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  amountSection: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8
  },
  currencySymbol: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    marginHorizontal: 8,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600')
  },
  amountInput: {
    fontSize: 48,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
    height: 70
  },
  balanceContext: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24
  },
  balanceContextText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    marginBottom: 40,
    ...getPlatformShadow('md')
  },
  section: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
    fontWeight: getPlatformFontWeight('600')
  },
  directionToggleContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12
  },
  directionToggleBtn: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    gap: 8
  },
  directionToggleText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary
  },
  typeSelectorRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10
  },
  typeSelectorItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 8
  },
  typeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('xs')
  },
  typeNameText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
    opacity: 0.5
  },
  fieldRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    height: 50,
    padding: 0
  },
  fieldText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily
  },
  dueDateControl: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  installmentOptions: {
    marginTop: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: 16,
    gap: 16
  },
  optionRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  optionLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  miniInput: {
    width: 60,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    padding: 0
  },
  frequencyChips: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: theme.colors.surface,
    padding: 4,
    borderRadius: 12
  },
  freqChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10
  },
  freqChipText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('600')
  },
  debtorSuggestions: {
    marginBottom: 12
  },
  debtorSuggestionChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  debtorSuggestionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center'
  },
  debtorSuggestionAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary
  },
  debtorSuggestionName: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  addDebtorBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContent: {
    paddingBottom: 20
  },
  modalField: {
    marginBottom: 16
  },
  modalLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
    textAlign: isRTL ? 'right' : 'left'
  },
  modalInput: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily
  }
});
