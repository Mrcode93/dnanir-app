import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { useCurrency } from '../hooks/useCurrency';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import {
    ExpenseShortcut,
    IncomeShortcut,
    getExpenseShortcuts,
    addExpenseShortcut,
    deleteExpenseShortcut,
    updateExpenseShortcut,
    getIncomeShortcuts,
    addIncomeShortcut,
    deleteIncomeShortcut,
    updateIncomeShortcut,
    CustomCategory,
    getCustomCategories,
} from '../database/database';

type ShortcutType = 'expense' | 'income';

interface ManageShortcutsModalProps {
    visible: boolean;
    type?: ShortcutType;
    onClose: () => void;
    onShortcutUsed?: (shortcut: ExpenseShortcut | IncomeShortcut, type: ShortcutType) => void;
}

export const ManageShortcutsModal: React.FC<ManageShortcutsModalProps> = ({
    visible,
    type = 'expense',
    onClose,
    onShortcutUsed,
}) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const { currencyCode, formatCurrency } = useCurrency();

    // Data
    const [shortcuts, setShortcuts] = useState<(ExpenseShortcut | IncomeShortcut)[]>([]);
    const [categories, setCategories] = useState<CustomCategory[]>([]);

    // Form mode
    const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form fields
    const [formType, setFormType] = useState<ShortcutType>('expense');
    const [formTitle, setFormTitle] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const [formCurrency, setFormCurrency] = useState(currencyCode);
    const [formDescription, setFormDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Filter categories based on formType
    const filteredCategories = categories.filter(c => c.type === formType);


    // Load data

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [exp, inc, allCats] = await Promise.all([
                getExpenseShortcuts(),
                getIncomeShortcuts(),
                getCustomCategories('expense').then(expCats =>
                    getCustomCategories('income').then(incCats => [...expCats, ...incCats])
                )
            ]);

            // Tag them so we know which is which in the list
            const taggedExp = exp.map(s => ({ ...s, _type: 'expense' as ShortcutType }));
            const taggedInc = inc.map(s => ({ ...s, _type: 'income' as ShortcutType }));

            setShortcuts([...taggedExp, ...taggedInc].sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ));
            setCategories(allCats);
        } catch (error) {
            
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            loadData();
            setMode('list');
            resetForm(type);
        }
    }, [visible, loadData, type]);

    const resetForm = (preferredType: ShortcutType = type) => {
        setFormType(preferredType);
        setFormTitle('');
        setFormAmount('');
        setFormCategory('');
        setFormCurrency(currencyCode);
        setFormDescription('');
        setEditingId(null);
    };

    const openAddForm = () => {
        resetForm(formType);
        const availableCats = categories.filter(c => c.type === formType);
        if (availableCats.length > 0) {
            setFormCategory(availableCats[0].name);
        }
        setMode('add');
    };

    const openEditForm = (shortcut: any) => {
        setEditingId(shortcut.id);
        const sType = shortcut._type || 'expense';
        setFormType(sType);

        if (sType === 'expense') {
            const s = shortcut as ExpenseShortcut;
            setFormTitle(s.title);
            setFormAmount(formatNumberWithCommas(s.amount));
            setFormCategory(s.category);
            setFormCurrency(s.currency || currencyCode);
            setFormDescription(s.description || '');
        } else {
            const s = shortcut as IncomeShortcut;
            setFormTitle(s.source);
            setFormAmount(formatNumberWithCommas(s.amount));
            setFormCategory(s.incomeSource);
            setFormCurrency(s.currency || currencyCode);
            setFormDescription(s.description || '');
        }
        setMode('edit');
    };

    const handleSave = async () => {
        if (!formTitle.trim()) {
            alertService.toastError(formType === 'expense' ? 'يرجى إدخال عنوان المصروف' : 'يرجى إدخال مصدر الدخل');
            return;
        }
        const cleanAmount = formAmount.replace(/,/g, '');
        const parsedAmount = Number(convertArabicToEnglish(cleanAmount));
        if (!cleanAmount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
            alertService.toastError('يرجى إدخال مبلغ صحيح');
            return;
        }

        try {
            if (mode === 'add') {
                if (formType === 'expense') {
                    await addExpenseShortcut({
                        title: formTitle.trim(),
                        amount: parsedAmount,
                        category: formCategory,
                        currency: formCurrency,
                        description: formDescription.trim() || undefined,
                    });
                } else {
                    await addIncomeShortcut({
                        source: formTitle.trim(),
                        amount: parsedAmount,
                        incomeSource: formCategory,
                        currency: formCurrency,
                        description: formDescription.trim() || undefined,
                    });
                }
                alertService.toastSuccess('تم إضافة الاختصار');
            } else if (mode === 'edit' && editingId) {
                if (formType === 'expense') {
                    await updateExpenseShortcut(editingId, {
                        title: formTitle.trim(),
                        amount: parsedAmount,
                        category: formCategory,
                        currency: formCurrency,
                        description: formDescription.trim() || undefined,
                    });
                } else {
                    await updateIncomeShortcut(editingId, {
                        source: formTitle.trim(),
                        amount: parsedAmount,
                        incomeSource: formCategory,
                        currency: formCurrency,
                        description: formDescription.trim() || undefined,
                    });
                }
                alertService.toastSuccess('تم تحديث الاختصار');
            }
            await loadData();
            setMode('list');
            resetForm();
        } catch (error) {
            alertService.toastError('حدث خطأ أثناء الحفظ');
        }
    };

    const handleDelete = async (id: number, type: ShortcutType) => {
        try {
            if (type === 'expense') {
                await deleteExpenseShortcut(id);
            } else {
                await deleteIncomeShortcut(id);
            }
            alertService.toastSuccess('تم حذف الاختصار');
            await loadData();
        } catch (error) {
            alertService.toastError('حدث خطأ أثناء الحذف');
        }
    };

    const handleUseShortcut = (shortcut: any) => {
        onShortcutUsed?.(shortcut, shortcut._type || 'expense');
        onClose();
    };

    const getShortcutTitle = (shortcut: any) => {
        return (shortcut._type === 'expense') ? (shortcut as ExpenseShortcut).title : (shortcut as IncomeShortcut).source;
    };

    const getShortcutCategory = (shortcut: any) => {
        return (shortcut._type === 'expense') ? (shortcut as ExpenseShortcut).category : (shortcut as IncomeShortcut).incomeSource;
    };

    const getCategoryIcon = (catName: string, type: ShortcutType) => {
        const cat = categories.find(c => c.name === catName && c.type === type);
        return cat?.icon || (type === 'expense' ? 'pricetag' : 'wallet');
    };

    const getCategoryColor = (catName: string, type: ShortcutType) => {
        const cat = categories.find(c => c.name === catName && c.type === type);
        return cat?.color || theme.colors.primary;
    };

    // ─────────── Render ───────────

    const renderList = () => (
        <>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerCloseBtn}>
                    <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>إدارة الاختصارات</Text>
                <TouchableOpacity onPress={openAddForm} style={styles.headerAddBtn}>
                    <Ionicons name="add-circle" size={26} color={theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                {shortcuts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="flash-outline" size={56} color={theme.colors.textMuted} />
                        <Text style={styles.emptyTitle}>لا توجد اختصارات</Text>
                        <Text style={styles.emptySubtitle}>
                            أضف اختصارات لإضافة المصاريف أو الدخل المتكرر بضغطة واحدة
                        </Text>
                        <TouchableOpacity style={styles.emptyAddBtn} onPress={openAddForm}>
                            <Ionicons name="add" size={20} color="#FFF" />
                            <Text style={styles.emptyAddBtnText}>إضافة اختصار</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    shortcuts.map((shortcut: any) => {
                        const sType = shortcut._type || 'expense';
                        const catColor = getCategoryColor(getShortcutCategory(shortcut), sType);
                        return (
                            <View key={`${sType}-${shortcut.id}`} style={styles.shortcutItem}>
                                {/* Use button (tap the main area to use) */}
                                <TouchableOpacity
                                    style={styles.shortcutMain}
                                    onPress={() => handleUseShortcut(shortcut)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.shortcutIcon, { backgroundColor: catColor + '20' }]}>
                                        <Ionicons name={getCategoryIcon(getShortcutCategory(shortcut), sType) as any} size={22} color={catColor} />
                                    </View>
                                    <View style={styles.shortcutInfo}>
                                        <Text style={styles.shortcutName} numberOfLines={1}>
                                            {getShortcutTitle(shortcut)}
                                        </Text>
                                        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
                                            <View style={{
                                                paddingHorizontal: 6,
                                                paddingVertical: 1,
                                                borderRadius: 4,
                                                backgroundColor: sType === 'expense' ? theme.colors.error + '15' : theme.colors.success + '15'
                                            }}>
                                                <Text style={{ fontSize: 9, color: sType === 'expense' ? theme.colors.error : theme.colors.success, fontWeight: '700' }}>
                                                    {sType === 'expense' ? 'مصروف' : 'دخل'}
                                                </Text>
                                            </View>
                                            <Text style={styles.shortcutCat} numberOfLines={1}>
                                                {getShortcutCategory(shortcut)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.shortcutAmountBox}>
                                        <Text style={[styles.shortcutAmount, { color: sType === 'expense' ? theme.colors.error : theme.colors.success }]}>
                                            {formatCurrency(shortcut.amount)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Action buttons */}
                                <View style={styles.shortcutActions}>
                                    <TouchableOpacity onPress={() => openEditForm(shortcut)} style={styles.actionBtn}>
                                        <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(shortcut.id, sType)} style={styles.actionBtn}>
                                        <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
                <View style={{ height: 32 }} />
            </ScrollView>
        </>
    );

    const renderForm = () => (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 20}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => { setMode('list'); resetForm(); }} style={styles.headerCloseBtn}>
                    <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {mode === 'add' ? 'إضافة اختصار' : 'تعديل الاختصار'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                {/* Type Selection */}
                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>نوع المعاملة</Text>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
                        <TouchableOpacity
                            style={[{
                                flex: 1,
                                padding: 12,
                                borderRadius: 12,
                                alignItems: 'center',
                                borderWidth: 1.5,
                                borderColor: formType === 'expense' ? theme.colors.error : theme.colors.border,
                                backgroundColor: formType === 'expense' ? theme.colors.error + '10' : theme.colors.surface
                            }]}
                            onPress={() => {
                                setFormType('expense');
                                const expCats = categories.filter(c => c.type === 'expense');
                                if (expCats.length > 0) setFormCategory(expCats[0].name);
                            }}
                        >
                            <Ionicons name="arrow-down-circle" size={20} color={formType === 'expense' ? theme.colors.error : theme.colors.textMuted} />
                            <Text style={{ marginTop: 4, fontSize: 13, fontWeight: '700', color: formType === 'expense' ? theme.colors.error : theme.colors.textMuted }}>مصروف</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[{
                                flex: 1,
                                padding: 12,
                                borderRadius: 12,
                                alignItems: 'center',
                                borderWidth: 1.5,
                                borderColor: formType === 'income' ? theme.colors.success : theme.colors.border,
                                backgroundColor: formType === 'income' ? theme.colors.success + '10' : theme.colors.surface
                            }]}
                            onPress={() => {
                                setFormType('income');
                                const incCats = categories.filter(c => c.type === 'income');
                                if (incCats.length > 0) setFormCategory(incCats[0].name);
                            }}
                        >
                            <Ionicons name="arrow-up-circle" size={20} color={formType === 'income' ? theme.colors.success : theme.colors.textMuted} />
                            <Text style={{ marginTop: 4, fontSize: 13, fontWeight: '700', color: formType === 'income' ? theme.colors.success : theme.colors.textMuted }}>دخل</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Title/Source */}
                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>
                        {formType === 'expense' ? 'عنوان المصروف' : 'مصدر الدخل'}
                    </Text>
                    <View style={styles.formInputRow}>
                        <Ionicons name="text-outline" size={20} color={theme.colors.textMuted} />
                        <TextInput
                            style={styles.formInput}
                            value={formTitle}
                            onChangeText={setFormTitle}
                            placeholder={formType === 'expense' ? 'مثال: قهوة يومية' : 'مثال: راتب شهري'}
                            placeholderTextColor={theme.colors.textMuted}
                        />
                    </View>
                </View>

                {/* Amount */}
                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>المبلغ</Text>
                    <View style={styles.formInputRow}>
                        <Ionicons name="cash-outline" size={20} color={theme.colors.textMuted} />
                        <TextInput
                            style={styles.formInput}
                            value={formAmount}
                            onChangeText={(t) => {
                                const cleaned = convertArabicToEnglish(t);
                                setFormAmount(formatNumberWithCommas(cleaned));
                            }}
                            placeholder="0"
                            placeholderTextColor={theme.colors.textMuted}
                            keyboardType="decimal-pad"
                        />
                    </View>
                </View>

                {/* Category */}
                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>الفئة</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catList}>
                        {filteredCategories.map(cat => {
                            const isSelected = formCategory === cat.name;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.catChip,
                                        isSelected && { backgroundColor: cat.color + '20', borderColor: cat.color },
                                    ]}
                                    onPress={() => setFormCategory(cat.name)}
                                >
                                    <Ionicons name={cat.icon as any} size={16} color={isSelected ? cat.color : theme.colors.textSecondary} />
                                    <Text style={[styles.catChipText, isSelected && { color: cat.color, fontWeight: '700' }]}>
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Description */}
                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>ملاحظات (اختياري)</Text>
                    <View style={styles.formInputRow}>
                        <Ionicons name="document-text-outline" size={20} color={theme.colors.textMuted} />
                        <TextInput
                            style={styles.formInput}
                            value={formDescription}
                            onChangeText={setFormDescription}
                            placeholder="ملاحظات إضافية..."
                            placeholderTextColor={theme.colors.textMuted}
                            multiline
                        />
                    </View>
                </View>
            </ScrollView>

            {/* Save Button */}
            <View style={[styles.formFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                    <Text style={styles.saveBtnText}>
                        {mode === 'add' ? 'إضافة الاختصار' : 'حفظ التغييرات'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} statusBarTranslucent={true}>
            <View style={styles.container}>
                {mode === 'list' ? renderList() : renderForm()}
            </View>
        </Modal>
    );
};

const { width } = Dimensions.get('window');

const createStyles = (theme: AppTheme) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },

        // ─── Header ───
        header: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        headerCloseBtn: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textPrimary,
        },
        headerAddBtn: {
            width: 40,
            alignItems: 'center',
        },

        // ─── List ───
        listContainer: {
            flex: 1,
            paddingHorizontal: 16,
            paddingTop: 12,
        },
        shortcutItem: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 14,
            marginBottom: 10,
            ...getPlatformShadow('sm'),
        },
        shortcutMain: {
            flex: 1,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 12,
        },
        shortcutIcon: {
            width: 44,
            height: 44,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        shortcutInfo: {
            flex: 1,
        },
        shortcutName: {
            fontSize: 15,
            fontWeight: '600',
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
        },
        shortcutCat: {
            fontSize: 12,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textSecondary,
            marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
        },
        shortcutAmountBox: {
            paddingHorizontal: 10,
        },
        shortcutAmount: {
            fontSize: 15,
            fontWeight: '700',
            fontFamily: theme.typography.fontFamily,
        },
        shortcutActions: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: 4,
            marginLeft: isRTL ? 0 : 8,
            marginRight: isRTL ? 8 : 0,
        },
        actionBtn: {
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: theme.colors.surfaceLight,
            alignItems: 'center',
            justifyContent: 'center',
        },

        // ─── Empty State ───
        emptyState: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 60,
            paddingHorizontal: 40,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '700',
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textPrimary,
            marginTop: 16,
        },
        emptySubtitle: {
            fontSize: 14,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 22,
        },
        emptyAddBtn: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 14,
            marginTop: 24,
        },
        emptyAddBtnText: {
            fontSize: 15,
            fontWeight: '600',
            fontFamily: theme.typography.fontFamily,
            color: '#FFF',
        },

        // ─── Form ───
        formContainer: {
            flex: 1,
            paddingHorizontal: 20,
            paddingTop: 16,
        },
        formGroup: {
            marginBottom: 20,
        },
        formLabel: {
            fontSize: 14,
            fontWeight: '600',
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textSecondary,
            marginBottom: 8,
            textAlign: isRTL ? 'right' : 'left',
        },
        formInputRow: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: Platform.OS === 'ios' ? 14 : 6,
            gap: 10,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        formInput: {
            flex: 1,
            fontSize: 15,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        catList: {
            gap: 8,
            paddingVertical: 4,
        },
        catChip: {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
            borderWidth: 1.5,
            borderColor: 'transparent',
        },
        catChipText: {
            fontSize: 13,
            fontFamily: theme.typography.fontFamily,
            color: theme.colors.textSecondary,
        },
        formFooter: {
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
        },
        saveBtn: {
            backgroundColor: theme.colors.primary,
            paddingVertical: 16,
            borderRadius: 16,
            alignItems: 'center',
        },
        saveBtnText: {
            fontSize: 16,
            fontWeight: '700',
            fontFamily: theme.typography.fontFamily,
            color: '#FFF',
        },
    });
