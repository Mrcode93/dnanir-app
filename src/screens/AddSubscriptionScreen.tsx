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
    Switch,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { SUBSCRIPTION_CATEGORIES, Subscription, SubscriptionCategory } from '../types';
import { addSubscription, updateSubscription } from '../services/subscriptionService';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';

export const AddSubscriptionScreen = ({ navigation, route }: any) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const { currencyCode, currency } = useCurrency();
    const existingSub = route?.params?.subscription as Subscription | undefined;

    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<SubscriptionCategory>('streaming');
    const [nextBillingDate, setNextBillingDate] = useState(new Date());
    const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
    const [description, setDescription] = useState('');
    const [reminderEnabled, setReminderEnabled] = useState(true);
    const [reminderDaysBefore, setReminderDaysBefore] = useState('1');
    const [isActive, setIsActive] = useState(true);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (existingSub) {
            setName(existingSub.name);
            setAmount(formatNumberWithCommas(existingSub.amount));
            setCategory(existingSub.category);
            setNextBillingDate(new Date(existingSub.nextBillingDate));
            setBillingCycle(existingSub.billingCycle);
            setDescription(existingSub.description || '');
            setReminderEnabled(existingSub.reminderEnabled);
            setReminderDaysBefore(existingSub.reminderDaysBefore.toString());
            setIsActive(existingSub.isActive);
        }
    }, [existingSub]);

    const handleSave = async () => {
        if (!name.trim()) {
            alertService.warning('تنبيه', 'يرجى إدخال اسم الاشتراك');
            return;
        }

        const cleanAmount = amount.replace(/,/g, '');
        if (!cleanAmount.trim() || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
            alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
            return;
        }

        setLoading(true);
        try {
            const subData = {
                name: name.trim(),
                amount: Number(cleanAmount),
                currency: currencyCode,
                category,
                nextBillingDate: nextBillingDate.toISOString().split('T')[0],
                billingCycle,
                description: description.trim() || undefined,
                reminderEnabled,
                reminderDaysBefore: Number(reminderDaysBefore),
                isActive,
                createdAt: existingSub?.createdAt || new Date().toISOString(),
            };

            if (existingSub) {
                await updateSubscription(existingSub.id, subData);
                alertService.toastSuccess('تم تحديث الاشتراك');
            } else {
                await addSubscription(subData);
                alertService.toastSuccess('تم إضافة الاشتراك بنجاح');
            }
            navigation.goBack();
        } catch (error) {
            console.error('Error saving subscription:', error);
            alertService.error('خطأ', 'حدث خطأ أثناء حفظ الاشتراك');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                        <Ionicons name={isRTL ? "close" : "close"} size={24} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{existingSub ? 'تعديل اشتراك' : 'إضافة اشتراك دوري'}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>اسم الخدمة / الاشتراك *</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="مثال: نيتفلكس، إنترنت البيت، جيم"
                            mode="outlined"
                            style={styles.input}
                            outlineColor={theme.colors.border}
                            activeOutlineColor={theme.colors.primary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>المبلغ المستقطع *</Text>
                        <TextInput
                            value={amount}
                            onChangeText={(val) => {
                                const cleaned = convertArabicToEnglish(val);
                                setAmount(formatNumberWithCommas(cleaned));
                            }}
                            placeholder="0"
                            mode="outlined"
                            keyboardType="numeric"
                            style={styles.input}
                            outlineColor={theme.colors.border}
                            activeOutlineColor={theme.colors.primary}
                            right={<TextInput.Affix text={currency?.symbol || currencyCode} />}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>الفئة</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            {Object.keys(SUBSCRIPTION_CATEGORIES).map((cat) => {
                                const isSelected = category === cat;
                                const info = SUBSCRIPTION_CATEGORIES[cat as SubscriptionCategory];
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setCategory(cat as SubscriptionCategory)}
                                        style={[styles.catChip, isSelected && { backgroundColor: info.color, borderColor: info.color }]}
                                    >
                                        <Ionicons name={info.icon as any} size={18} color={isSelected ? '#FFF' : info.color} />
                                        <Text style={[styles.catChipText, isSelected && { color: '#FFF' }]}>{info.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    <View style={styles.twoColumn}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>دورة الفوترة</Text>
                            <View style={styles.cycleContainer}>
                                {(['weekly', 'monthly', 'yearly'] as const).map((cycle) => (
                                    <TouchableOpacity
                                        key={cycle}
                                        onPress={() => setBillingCycle(cycle)}
                                        style={[styles.cycleBtn, billingCycle === cycle && styles.cycleBtnActive]}
                                    >
                                        <Text style={[styles.cycleBtnText, billingCycle === cycle && styles.cycleBtnTextActive]}>
                                            {cycle === 'weekly' ? 'أسبوعي' : cycle === 'monthly' ? 'شهري' : 'سنوي'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>موعد السحب القادم *</Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateSelector}>
                            <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                            <Text style={styles.dateText}>
                                {nextBillingDate.toLocaleDateString('ar-IQ-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </Text>
                        </TouchableOpacity>
                        {showDatePicker && (
                            <CustomDatePicker
                                value={nextBillingDate}
                                onChange={(event, date) => {
                                    if (date) setNextBillingDate(date);
                                    if (Platform.OS === 'android') setShowDatePicker(false);
                                }}
                                onClose={() => setShowDatePicker(false)}
                            />
                        )}
                    </View>

                    <View style={styles.switchGroup}>
                        <View style={styles.switchRow}>
                            <View>
                                <Text style={styles.switchLabel}>تنبيه قبل السحب</Text>
                                <Text style={styles.switchSub}>سنقوم بتذكيرك قبل {reminderDaysBefore} أيام</Text>
                            </View>
                            <Switch
                                value={reminderEnabled}
                                onValueChange={setReminderEnabled}
                                trackColor={{ false: '#767577', true: theme.colors.primary }}
                            />
                        </View>

                        {reminderEnabled && (
                            <View style={styles.reminderDays}>
                                <Text style={styles.labelSmall}>قبل كم يوم؟</Text>
                                <View style={styles.daysRow}>
                                    {['1', '2', '3', '7'].map(d => (
                                        <TouchableOpacity
                                            key={d}
                                            onPress={() => setReminderDaysBefore(d)}
                                            style={[styles.dayChip, reminderDaysBefore === d && styles.dayChipActive]}
                                        >
                                            <Text style={[styles.dayChipText, reminderDaysBefore === d && styles.dayChipTextActive]}>{d}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>ملاحظات</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="مثال: رقم الحساب، موعد الإلغاء..."
                            mode="outlined"
                            multiline
                            numberOfLines={3}
                            style={styles.input}
                            outlineColor={theme.colors.border}
                            activeOutlineColor={theme.colors.primary}
                        />
                    </View>

                    <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
                        <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.saveBtnGradient}>
                            <Text style={styles.saveBtnText}>{loading ? 'جاري الحفظ...' : (existingSub ? 'تحديث الاشتراك' : 'حفظ الاشتراك')}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
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
    header: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    closeBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textPrimary,
        marginBottom: 8,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    twoColumn: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 12,
    },
    input: {
        backgroundColor: theme.colors.surfaceCard,
        textAlign: isRTL ? 'right' : 'left',
        fontFamily: theme.typography.fontFamily,
    },
    catScroll: {
        marginTop: 4,
        direction: 'rtl',
    },
    catChip: {
        flexDirection: isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: theme.colors.surfaceCard,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginRight: 8,
        gap: 8,
    },
    catChipText: {
        fontSize: 13,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
    },
    cycleContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cycleBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    cycleBtnActive: {
        backgroundColor: theme.colors.primary,
    },
    cycleBtnText: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: 'bold',
    },
    cycleBtnTextActive: {
        color: '#FFF',
    },
    dateSelector: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: 14,
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: 12,
    },
    dateText: {
        fontSize: 15,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
    },
    switchGroup: {
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    switchRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    switchSub: {
        fontSize: 12,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    reminderDays: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border + '40',
    },
    labelSmall: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 8,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    daysRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 8,
    },
    dayChip: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    dayChipActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    dayChipText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
    },
    dayChipTextActive: {
        color: '#FFF',
    },
    saveBtn: {
        marginTop: 20,
        borderRadius: 16,
        overflow: 'hidden',
        ...getPlatformShadow('md'),
    },
    saveBtnGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: theme.typography.fontFamily,
    },
});
