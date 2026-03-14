import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Switch,
    Keyboard,
    Dimensions,
    StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton, Surface } from 'react-native-paper';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { DEBT_TYPES, DEBT_DIRECTIONS, Debt, DebtDirection } from '../types';
import {
    getDebtInstallments,
    deleteDebtInstallment,
    addDebtInstallment,
    updateDebt,
    getFinancialStatsAggregated,
} from '../database/database';
import { createDebt, generateInstallments } from '../services/debtService';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { useCurrency } from '../hooks/useCurrency';

const { width } = Dimensions.get('window');

interface AddDebtScreenProps {
    navigation: any;
    route: any;
}

type DebtType = 'debt' | 'installment' | 'advance';

export const AddDebtScreen: React.FC<AddDebtScreenProps> = ({
    navigation,
    route,
}) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const { formatCurrency } = useCurrency();
    const editingDebt = route?.params?.debt as Debt | undefined;

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

    useEffect(() => {
        loadBalance();
        if (editingDebt) {
            setDebtorName(editingDebt.debtorName);
            setTotalAmount(formatNumberWithCommas(editingDebt.totalAmount));
            setDirection(editingDebt.direction || 'owed_by_me');
            setType(editingDebt.type);
            setStartDate(new Date(editingDebt.startDate));
            setDueDate(editingDebt.dueDate ? new Date(editingDebt.dueDate) : null);
            setHasDueDate(!!editingDebt.dueDate);
            setRemainingAmount(formatNumberWithCommas(editingDebt.remainingAmount));
            setDescription(editingDebt.description || '');

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

    const loadBalance = async () => {
        try {
            const stats = await getFinancialStatsAggregated();
            setCurrentBalance(stats.balance);
        } catch (error) {
            
        }
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
    };

    const handleClose = useCallback(() => {
        Keyboard.dismiss();
        navigation.goBack();
    }, [navigation]);

    const handleSave = async () => {
        const nameLabel = direction === 'owed_to_me' ? 'اسم المدين (من يستحق عليه)' : 'اسم الدائن أو الشخص';
        if (!debtorName.trim()) {
            alertService.warning('تنبيه', `يرجى إدخال ${nameLabel}`);
            return;
        }

        const cleanTotalAmount = totalAmount.replace(/,/g, '');
        if (!cleanTotalAmount.trim() || isNaN(Number(cleanTotalAmount)) || Number(cleanTotalAmount) <= 0) {
            alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
            return;
        }

        setLoading(true);

        try {
            const amount = Number(cleanTotalAmount);
            // When editing, we reset remainingAmount to match totalAmount 
            // because editing is usually used to fix an entry error.
            const finalRemainingAmount = amount;

            const debtData = {
                debtorName: debtorName.trim(),
                totalAmount: amount,
                remainingAmount: finalRemainingAmount,
                startDate: startDate.toISOString().split('T')[0],
                dueDate: hasDueDate && dueDate ? dueDate.toISOString().split('T')[0] : undefined,
                description: description.trim(),
                type: type,
                direction,
                currency: 'IQD',
                isPaid: finalRemainingAmount <= 0,
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
                            installmentNumber: installments.indexOf(inst) + 1,
                        });
                    }
                }
            } else {
                let installments: { amount: number; dueDate: string }[] | undefined;
                if (hasInstallments) {
                    const numInst = parseInt(numberOfInstallments);
                    installments = generateInstallments(amount, numInst, startDate, installmentFrequency);
                }

                await createDebt(
                    debtorName.trim(),
                    amount,
                    startDate.toISOString().split('T')[0],
                    type,
                    hasDueDate && dueDate ? dueDate.toISOString().split('T')[0] : undefined,
                    description.trim(),
                    'IQD',
                    installments,
                    direction
                );
            }

            handleClose();
            alertService.toastSuccess(editingDebt ? 'تم تحديث الدين بنجاح' : 'تم إضافة الدين بنجاح');
        } catch (error) {
            
            alertService.error('خطأ', 'حدث خطأ أثناء حفظ البيانات');
        } finally {
            setLoading(false);
        }
    };

    const typeData: Record<DebtType, { label: string; icon: string; colors: string[] }> = {
        debt: { label: 'دين', icon: 'card', colors: theme.gradients.info },
        installment: { label: 'أقساط', icon: 'calendar', colors: theme.gradients.primary },
        advance: { label: 'سلفة', icon: 'cash', colors: theme.gradients.success },
    };

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
                                {editingDebt ? 'تعديل البيانات' : 'إضافة دين / سلفة'}
                            </Text>
                            <Text style={styles.headerSubtitle}>أدخل تفاصيل الالتزام المالي</Text>
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
                        {/* Balance Summary Card */}
                        <Surface style={styles.balanceCard} elevation={1}>
                            <View style={styles.balanceInfo}>
                                <View style={styles.balanceIconBg}>
                                    <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
                                </View>
                                <View style={styles.balanceTextContainer}>
                                    <Text style={styles.balanceLabel}>رصيدك الحالي</Text>
                                    <Text style={styles.balanceValue}>{formatCurrency(currentBalance)}</Text>
                                </View>
                            </View>
                        </Surface>

                        {/* Direction: دين على / دين لي */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>اتجاه الدين</Text>
                            <View style={styles.directionRow}>
                                <TouchableOpacity
                                    onPress={() => setDirection('owed_by_me')}
                                    activeOpacity={0.8}
                                    style={[styles.directionChip, direction === 'owed_by_me' && styles.directionChipActive]}
                                >
                                    <Ionicons name="arrow-redo" size={20} color={direction === 'owed_by_me' ? '#FFFFFF' : theme.colors.textSecondary} />
                                    <Text style={[styles.directionChipLabel, direction === 'owed_by_me' && styles.directionChipLabelActive]}>
                                        {DEBT_DIRECTIONS.owed_by_me}
                                    </Text>
                                    <Text style={styles.directionChipHint}>أنا مدين (عند الدفع يخصم من الرصيد)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setDirection('owed_to_me')}
                                    activeOpacity={0.8}
                                    style={[styles.directionChip, direction === 'owed_to_me' && styles.directionChipActiveOwedToMe]}
                                >
                                    <Ionicons name="arrow-undo" size={20} color={direction === 'owed_to_me' ? '#FFFFFF' : theme.colors.textSecondary} />
                                    <Text style={[styles.directionChipLabel, direction === 'owed_to_me' && styles.directionChipLabelActive]}>
                                        {DEBT_DIRECTIONS.owed_to_me}
                                    </Text>
                                    <Text style={styles.directionChipHint}>مدين لي (عند التسديد يُضاف للرصيد)</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Type Selection Grid */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>نوع الالتزام</Text>
                            <View style={styles.typeGrid}>
                                {(Object.keys(typeData) as DebtType[]).map((t) => {
                                    const isSelected = type === t;
                                    const data = typeData[t];
                                    return (
                                        <TouchableOpacity
                                            key={t}
                                            onPress={() => setType(t)}
                                            activeOpacity={0.8}
                                            style={[
                                                styles.typeCard,
                                                isSelected && { borderColor: data.colors[0], borderWidth: 2 }
                                            ]}
                                        >
                                            <LinearGradient
                                                colors={isSelected ? data.colors as any : ([theme.colors.surfaceLight, theme.colors.surfaceLight] as any)}
                                                style={styles.typeCardGradient}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                            >
                                                <Ionicons
                                                    name={isSelected ? (data.icon as any) : (`${data.icon}-outline` as any)}
                                                    size={24}
                                                    color={isSelected ? '#FFFFFF' : theme.colors.textSecondary}
                                                />
                                                <Text style={[styles.typeCardLabel, isSelected && styles.typeCardLabelActive]}>
                                                    {data.label}
                                                </Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Amount & Name Card */}
                        <Surface style={styles.mainCard} elevation={2}>
                            {/* Amount Input */}
                            <View style={styles.amountContainer}>
                                <Text style={styles.amountLabel}>المبلغ الإجمالي</Text>
                                <View style={styles.amountInputRow}>
                                    <TextInput
                                        value={totalAmount}
                                        onChangeText={(val) => {
                                            const cleaned = convertArabicToEnglish(val);
                                            setTotalAmount(formatNumberWithCommas(cleaned));
                                        }}
                                        placeholder="0"
                                        keyboardType="decimal-pad"
                                        mode="flat"
                                        style={styles.amountInput}
                                        underlineColor="transparent"
                                        activeUnderlineColor="transparent"
                                        textColor={theme.colors.textPrimary}
                                        placeholderTextColor={theme.colors.textMuted}
                                    />
                                    <Text style={styles.currencyLabel}>د.ع</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            {/* Name Input */}
                            <View style={styles.inputField}>
                                <Ionicons name="person-outline" size={20} color={theme.colors.primary} style={styles.fieldIcon} />
                                <TextInput
                                    value={debtorName}
                                    onChangeText={setDebtorName}
                                    placeholder={direction === 'owed_to_me' ? 'اسم المدين (من عليه الدين)' : 'اسم الدائن أو الشخص'}
                                    mode="flat"
                                    style={styles.nameInput}
                                    underlineColor="transparent"
                                    activeUnderlineColor="transparent"
                                    placeholderTextColor={theme.colors.textMuted}
                                />
                            </View>

                            {editingDebt && (
                                <View style={styles.editInfoContent}>
                                    <Ionicons name="information-circle-outline" size={16} color={theme.colors.info} />
                                    <Text style={styles.editInfoText}>
                                        عند تعديل مبلغ الدين، سيتم تحديث المبلغ المتبقي ليطابق المبلغ الجديد تلقائياً.
                                    </Text>
                                </View>
                            )}
                        </Surface>

                        {/* Date Selection */}
                        <View style={styles.section}>
                            <View style={styles.dateRow}>
                                <View style={styles.dateCol}>
                                    <Text style={styles.sectionLabel}>تاريخ البدء</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowStartDatePicker(true)}
                                        style={styles.dateSelector}
                                    >
                                        <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
                                        <Text style={styles.dateValue}>
                                            {startDate.toLocaleDateString('ar-IQ-u-nu-latn')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.dateCol}>
                                    <View style={styles.labelWithSwitch}>
                                        <Text style={styles.sectionLabel}>موعد السداد</Text>
                                        <Switch
                                            value={hasDueDate}
                                            onValueChange={setHasDueDate}
                                            trackColor={{ false: '#767577', true: theme.colors.primary }}
                                            thumbColor={hasDueDate ? '#FFFFFF' : '#f4f3f4'}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => hasDueDate && setShowDueDatePicker(true)}
                                        style={[styles.dateSelector, !hasDueDate && styles.dateSelectorDisabled]}
                                        disabled={!hasDueDate}
                                    >
                                        <Ionicons
                                            name="alarm-outline"
                                            size={18}
                                            color={hasDueDate ? theme.colors.error : theme.colors.textMuted}
                                        />
                                        <Text style={[styles.dateValue, !hasDueDate && styles.dateValueDisabled]}>
                                            {hasDueDate && dueDate ? dueDate.toLocaleDateString('ar-IQ-u-nu-latn') : 'غير محدد'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Installments Options */}
                        <View style={styles.section}>
                            <Surface style={styles.optionsCard} elevation={0}>
                                <View style={styles.optionRow}>
                                    <View style={styles.optionInfo}>
                                        <View style={styles.optionIconContainer}>
                                            <Ionicons name="repeat" size={18} color={theme.colors.primary} />
                                        </View>
                                        <View>
                                            <Text style={styles.optionTitle}>تقسيط السداد</Text>
                                            <Text style={styles.optionSubtitle}>توزيع المبلغ على دفعات</Text>
                                        </View>
                                    </View>
                                    <Switch
                                        value={hasInstallments}
                                        onValueChange={setHasInstallments}
                                        trackColor={{ false: '#767577', true: theme.colors.primary }}
                                        thumbColor={hasInstallments ? '#FFFFFF' : '#f4f3f4'}
                                    />
                                </View>

                                {hasInstallments && (
                                    <View style={styles.installmentDetails}>
                                        <View style={styles.installmentInputs}>
                                            <View style={styles.instInputGroup}>
                                                <Text style={styles.instLabel}>عدد الأقساط</Text>
                                                <TextInput
                                                    value={numberOfInstallments}
                                                    onChangeText={(val) => {
                                                        const cleaned = convertArabicToEnglish(val);
                                                        setNumberOfInstallments(cleaned); // Assuming this is just a count, no commas needed, but cleaning is good
                                                    }}
                                                    keyboardType="decimal-pad"
                                                    mode="outlined"
                                                    style={styles.instInput}
                                                    outlineColor={theme.colors.border}
                                                    activeOutlineColor={theme.colors.primary}
                                                    dense
                                                />
                                            </View>
                                            <View style={styles.instInputGroup}>
                                                <Text style={styles.instLabel}>التكرار</Text>
                                                <TouchableOpacity
                                                    style={styles.freqToggle}
                                                    onPress={() => setInstallmentFrequency(f => f === 'monthly' ? 'weekly' : 'monthly')}
                                                >
                                                    <Text style={styles.freqText}>
                                                        {installmentFrequency === 'monthly' ? 'شهري' : 'أسبوعي'}
                                                    </Text>
                                                    <Ionicons name="sync" size={14} color={theme.colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </Surface>
                        </View>

                        {/* Description */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>ملاحظات</Text>
                            <TextInput
                                value={description}
                                onChangeText={setDescription}
                                placeholder="اكتب أي ملاحظات هنا..."
                                multiline
                                numberOfLines={3}
                                mode="outlined"
                                style={styles.descInput}
                                outlineColor={theme.colors.border}
                                activeOutlineColor={theme.colors.primary}
                                placeholderTextColor={theme.colors.textMuted}
                            />
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={loading}
                            style={styles.saveBtn}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={typeData[type].colors as any}
                                style={styles.saveBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {loading ? (
                                    <Text style={styles.saveBtnText}>جاري الحفظ...</Text>
                                ) : (
                                    <>
                                        <Text style={styles.saveBtnText}>
                                            {editingDebt ? 'تحديث البيانات' : 'حفظ الالتزام'}
                                        </Text>
                                        <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Date Pickers */}
                    {showStartDatePicker && (
                        <CustomDatePicker
                            value={startDate}
                            onChange={(event, date) => {
                                if (date) setStartDate(date);
                                if (Platform.OS === 'android') setShowStartDatePicker(false);
                            }}
                            onClose={() => setShowStartDatePicker(false)}
                        />
                    )}
                    {showDueDatePicker && (
                        <CustomDatePicker
                            value={dueDate || new Date()}
                            onChange={(event, date) => {
                                if (date) setDueDate(date);
                                if (Platform.OS === 'android') setShowDueDatePicker(false);
                            }}
                            onClose={() => setShowDueDatePicker(false)}
                        />
                    )}
                </LinearGradient>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
        paddingHorizontal: 8,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: theme.typography.fontFamily,
        color: theme.colors.textPrimary,
        fontWeight: getPlatformFontWeight('700'),
        textAlign: isRTL ? 'right' : 'left',
    },
    headerSubtitle: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    scrollView: {
        flex: 1,
    },
    scrollContainer: {
        paddingHorizontal: 12,
        paddingBottom: 28,
    },
    balanceCard: {
        marginTop: 10,
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        padding: 16,
        ...getPlatformShadow('sm'),
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    balanceInfo: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 15,
    },
    balanceIconBg: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: theme.colors.primary + '10',
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceTextContainer: {
        flex: 1,
    },
    balanceLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    balanceValue: {
        fontSize: 20,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
        marginTop: 2,
    },
    section: {
        marginTop: 24,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textSecondary,
        marginBottom: 12,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    directionRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 10,
    },
    directionChip: {
        flex: 1,
        padding: 12,
        borderRadius: 12,
        backgroundColor: theme.colors.surfaceLight,
        borderWidth: 2,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    directionChipActive: {
        borderColor: theme.colors.info,
        backgroundColor: theme.colors.info + '18',
    },
    directionChipActiveOwedToMe: {
        borderColor: theme.colors.success,
        backgroundColor: theme.colors.success + '18',
    },
    directionChipLabel: {
        fontSize: 14,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        marginTop: 4,
    },
    directionChipLabelActive: {
        color: '#FFFFFF',
    },
    directionChipHint: {
        fontSize: 10,
        color: theme.colors.textMuted,
        marginTop: 2,
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily,
    },
    typeGrid: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    typeCard: {
        flex: 1,
        height: 85,
        borderRadius: 20,
        backgroundColor: theme.colors.surfaceLight,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    typeCardGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeCardLabel: {
        fontSize: 14,
        fontFamily: theme.typography.fontFamily,
        marginTop: 6,
        color: theme.colors.textSecondary,
        fontWeight: getPlatformFontWeight('600'),
    },
    typeCardLabelActive: {
        color: '#FFFFFF',
    },
    mainCard: {
        marginTop: 24,
        backgroundColor: theme.colors.surface,
        borderRadius: 18,
        padding: 16,
        ...getPlatformShadow('md'),
    },
    amountContainer: {
        alignItems: 'center',
        marginBottom: 8,
    },
    amountLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 4,
    },
    amountInputRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    amountInput: {
        backgroundColor: 'transparent',
        fontSize: 36,
        fontWeight: getPlatformFontWeight('bold'),
        textAlign: 'center',
        minWidth: 100,
        maxWidth: 220,
        height: 60,
    },
    currencyLabel: {
        fontSize: 20,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.primary,
        marginLeft: isRTL ? 0 : 8,
        marginRight: isRTL ? 8 : 0,
        marginTop: 12,
    },
    labelWithAction: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 4,
    },
    resetBtn: {
        backgroundColor: theme.colors.surfaceLight,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    resetBtnText: {
        fontSize: 10,
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: 20,
        width: '100%',
    },
    editInfoContent: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.info + '10',
        padding: 10,
        borderRadius: 12,
        marginTop: 15,
        gap: 8,
    },
    editInfoText: {
        flex: 1,
        fontSize: 12,
        color: theme.colors.info,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    inputField: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: 16,
        paddingHorizontal: 12,
    },
    fieldIcon: {
        marginHorizontal: 8,
    },
    nameInput: {
        flex: 1,
        backgroundColor: 'transparent',
        height: 52,
        fontSize: 16,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    dateRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 15,
    },
    dateCol: {
        flex: 1,
    },
    labelWithSwitch: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dateSelector: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 10,
    },
    dateSelectorDisabled: {
        backgroundColor: theme.colors.surfaceLight,
        borderColor: 'transparent',
        opacity: 0.6,
    },
    dateValue: {
        fontSize: 15,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
        flex: 1,
        textAlign: isRTL ? 'right' : 'left',
    },
    dateValueDisabled: {
        color: theme.colors.textMuted,
    },
    optionsCard: {
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: 18,
        padding: 18,
    },
    optionRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionInfo: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
    },
    optionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...getPlatformShadow('sm'),
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    optionSubtitle: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    installmentDetails: {
        marginTop: 18,
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    installmentInputs: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 15,
    },
    instInputGroup: {
        flex: 1,
    },
    instLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 8,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    instInput: {
        backgroundColor: theme.colors.surface,
        height: 44,
        fontSize: 15,
        textAlign: 'center',
    },
    freqToggle: {
        height: 44,
        backgroundColor: theme.colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    freqText: {
        fontSize: 14,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.primary,
    },
    descInput: {
        backgroundColor: theme.colors.surface,
        fontSize: 14,
        fontFamily: theme.typography.fontFamily,
        marginTop: 4,
        textAlign: isRTL ? 'right' : 'left',
    },
    saveBtn: {
        marginTop: 32,
        height: 60,
        borderRadius: 20,
        overflow: 'hidden',
        ...getPlatformShadow('md'),
    },
    saveBtnGradient: {
        flex: 1,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    saveBtnText: {
        fontSize: 18,
        fontWeight: getPlatformFontWeight('700'),
        color: '#FFFFFF',
        fontFamily: theme.typography.fontFamily,
    },
});
