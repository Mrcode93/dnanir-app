import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Animated,
    ScrollView,
    Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useAppTheme, useThemedStyles } from '../utils/theme';
import { parseTransactionText, parseMultipleTransactions, ParsedTransaction, CATEGORY_DISPLAY_NAMES, EXPENSE_CATEGORY_LIST, INCOME_CATEGORY_LIST } from '../utils/smartParser';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { parseWithGemini } from '../services/geminiService';
import { getSmartAddUsageInfo, incrementSmartAddUsage, SmartAddUsageInfo } from '../services/smartAddUsage';
import { addExpense, addIncome } from '../database/database';
import { LinearGradient } from 'expo-linear-gradient';
import { usePrivacy } from '../context/PrivacyContext';
import { alertService } from '../services/alertService';
import { CONTACT_INFO } from '../constants/contactConstants';

interface SmartAddModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    mode?: 'expense' | 'income';
    navigation?: any;
}

export const SmartAddModal: React.FC<SmartAddModalProps> = ({ visible, onClose, onSuccess, mode = 'expense', navigation }) => {
    const { theme } = useAppTheme();
    const insets = useSafeAreaInsets();
    const styles = useThemedStyles(createStyles);
    const { isPrivacyEnabled } = usePrivacy();
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [parsedResults, setParsedResults] = useState<ParsedTransaction[]>([]);
    const [usageInfo, setUsageInfo] = useState<SmartAddUsageInfo | null>(null);
    const inputRef = useRef<TextInput>(null);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isProcessing) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isProcessing]);

    useEffect(() => {
        if (visible) {
            setTimeout(() => inputRef.current?.focus(), 300);
            setText('');
            setParsedResults([]);
            // Load usage info
            getSmartAddUsageInfo().then(setUsageInfo);
            // Entrance animation
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]).start();
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(30);
        }
    }, [visible]);

    const handleProcess = async () => {
        if (!text.trim()) return;

        // Check usage limits
        const currentUsage = await getSmartAddUsageInfo();
        setUsageInfo(currentUsage);

        if (!currentUsage.isLoggedIn) {
            onClose();
            setTimeout(() => {
                alertService.show({
                    title: 'تسجيل الدخول مطلوب',
                    message: 'يجب تسجيل الدخول لاستخدام ميزة الإضافة الذكية بالذكاء الاصطناعي.',
                    type: 'warning',
                    confirmText: 'تسجيل دخول',
                    cancelText: 'إلغاء',
                    showCancel: true,
                    onConfirm: () => {
                        if (navigation) navigation.navigate('Auth');
                    },
                });
            }, 300);
            return;
        }

        if (!currentUsage.canUse) {
            onClose();
            setTimeout(() => {
                alertService.show({
                    title: 'انتهت المحاولات',
                    message: currentUsage.isPro
                        ? `وصلت للحد اليومي (${currentUsage.limit} محاولة). يتجدد غداً.`
                        : 'انتهت تجربتك المجانية للإضافة الذكية. ترقية للحساب المميز تمنحك 10 محاولات يومياً!',
                    type: 'warning',
                    confirmText: currentUsage.isPro ? 'حسناً' : 'تواصل معنا',
                    cancelText: 'إلغاء',
                    showCancel: !currentUsage.isPro,
                    onConfirm: currentUsage.isPro ? undefined : async () => {
                        const msg = encodeURIComponent('مرحباً، أريد الترقية للحساب المميز في تطبيق دنانير');
                        const whatsappUrl = `https://wa.me/${CONTACT_INFO.whatsappNumber}?text=${msg}`;
                        try {
                            const canOpen = await Linking.canOpenURL(whatsappUrl);
                            if (canOpen) {
                                await Linking.openURL(whatsappUrl);
                            } else {
                                const appUrl = `whatsapp://send?phone=${CONTACT_INFO.whatsappNumber}&text=${msg}`;
                                await Linking.openURL(appUrl);
                            }
                        } catch {
                            alertService.warning('تنبيه', 'يرجى تثبيت تطبيق WhatsApp');
                        }
                    },
                });
            }, 300);
            return;
        }

        setIsProcessing(true);

        try {
            // Try Gemini AI first
            console.log('=== SMART PARSER (Gemini) ===');
            const geminiResults = await parseWithGemini(text);

            if (geminiResults && geminiResults.length > 0) {
                // Increment usage counter on successful AI parse
                await incrementSmartAddUsage();
                const updatedUsage = await getSmartAddUsageInfo();
                setUsageInfo(updatedUsage);

                const results: ParsedTransaction[] = geminiResults.map(g => ({
                    amount: g.amount,
                    category: g.category,
                    type: g.type,
                    title: g.title,
                    confidence: 0.95,
                }));
                setParsedResults(results);
                setIsProcessing(false);
                return;
            }
        } catch (error) {
            console.log('Gemini failed, falling back to local parser:', error);
        }

        // Fallback: local regex parser
        console.log('=== SMART PARSER (Local Fallback) ===');
        let results = parseMultipleTransactions(text);
        if (results.length === 0) {
            results = [parseTransactionText(text)];
        }
        setParsedResults(results);
        setIsProcessing(false);
    };

    const updateTransaction = (index: number, field: keyof ParsedTransaction, value: any) => {
        const updated = [...parsedResults];
        updated[index] = { ...updated[index], [field]: value };

        if (field === 'type') {
            updated[index].category = value === 'expense' ? EXPENSE_CATEGORY_LIST[0] : INCOME_CATEGORY_LIST[0];
        }

        setParsedResults(updated);
    };

    const handleConfirm = async () => {
        if (parsedResults.length === 0) return;

        setIsProcessing(true);
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            for (const item of parsedResults) {
                if (!item.amount) continue;

                const finalTitle = item.title.trim() || CATEGORY_DISPLAY_NAMES[item.category] || 'معاملة';

                if (item.type === 'expense') {
                    await addExpense({
                        title: finalTitle,
                        amount: item.amount,
                        category: item.category as any,
                        date: dateStr,
                        description: '',
                        currency: 'IQD',
                    });
                } else {
                    await addIncome({
                        source: finalTitle,
                        amount: item.amount,
                        date: dateStr,
                        category: item.category,
                        description: '',
                        currency: 'IQD',
                    });
                }
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving smart transactions:', error);
            alert('حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsProcessing(false);
        }
    };

    const exampleText = 'صرفت ٣٠ الف على الغدا وشربت شاي ب٣ الاف واستلمت ٤٠٠ الف من بيع مادة';

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    {/* Header */}
                    <LinearGradient
                        colors={theme.gradients.primary as any}
                        style={[styles.header, { paddingTop: (insets.top || 12) + 8 }]}
                    >
                        <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.headerCenter}>
                            <Ionicons name="sparkles" size={20} color="#FFD700" />
                            <Text style={styles.headerTitle}>الإضافة الذكية</Text>
                        </View>
                        <View style={styles.headerBtn} />
                    </LinearGradient>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {parsedResults.length === 0 ? (
                            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                                {/* AI Badge */}
                                <View style={styles.aiBadge}>
                                    <Ionicons name="flash" size={16} color={theme.colors.primary} />
                                    <Text style={styles.aiBadgeText}>مدعوم بالذكاء الاصطناعي</Text>
                                </View>

                                {/* Usage Badge */}
                                {usageInfo && (
                                    <View style={[styles.usageBadge, {
                                        backgroundColor: !usageInfo.isLoggedIn
                                            ? '#FEF3C7'
                                            : usageInfo.remaining > 0
                                                ? (usageInfo.isPro ? '#FEF3C7' : theme.colors.primary + '12')
                                                : '#FEE2E2'
                                    }]}>
                                        <Ionicons
                                            name={!usageInfo.isLoggedIn ? 'lock-closed' : usageInfo.isPro ? 'diamond' : 'sparkles-outline'}
                                            size={14}
                                            color={!usageInfo.isLoggedIn
                                                ? '#B45309'
                                                : usageInfo.remaining > 0
                                                    ? (usageInfo.isPro ? '#B45309' : theme.colors.primary)
                                                    : '#DC2626'
                                            }
                                        />
                                        <Text style={[styles.usageBadgeText, {
                                            color: !usageInfo.isLoggedIn
                                                ? '#92400E'
                                                : usageInfo.remaining > 0
                                                    ? (usageInfo.isPro ? '#92400E' : theme.colors.primary)
                                                    : '#DC2626'
                                        }]}>
                                            {!usageInfo.isLoggedIn
                                                ? 'سجل دخول لاستخدام الميزة'
                                                : usageInfo.isPro ? 'حساب مميز' : 'حساب مجاني'
                                            }
                                            {usageInfo.isLoggedIn && (
                                                <>
                                                    {' · '}
                                                    {usageInfo.isPro
                                                        ? (usageInfo.remaining > 0
                                                            ? `${usageInfo.remaining} محاولة متبقية اليوم`
                                                            : 'انتهت المحاولات اليومية')
                                                        : (usageInfo.remaining > 0
                                                            ? 'تجربة مجانية متاحة'
                                                            : 'انتهت التجربة المجانية')
                                                    }
                                                </>
                                            )}
                                        </Text>
                                    </View>
                                )}

                                {/* Instruction */}
                                <Text style={styles.instruction}>
                                    تحدث أو اكتب معاملاتك المالية وسيتم تحليلها تلقائياً
                                </Text>

                                {/* Steps */}
                                <View style={[styles.stepsCard, { backgroundColor: theme.colors.surface }]}>
                                    <View style={styles.stepRow}>
                                        <View style={[styles.stepIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <Ionicons name="mic-outline" size={18} color={theme.colors.primary} />
                                        </View>
                                        <Text style={[styles.stepText, { color: theme.colors.text }]}>اضغط المايكروفون في الكيبورد</Text>
                                    </View>
                                    <View style={styles.stepDivider} />
                                    <View style={styles.stepRow}>
                                        <View style={[styles.stepIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <Ionicons name="chatbubble-outline" size={18} color={theme.colors.primary} />
                                        </View>
                                        <Text style={[styles.stepText, { color: theme.colors.text }]}>اذكر المعاملات مع المبالغ</Text>
                                    </View>
                                    <View style={styles.stepDivider} />
                                    <View style={styles.stepRow}>
                                        <View style={[styles.stepIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.primary} />
                                        </View>
                                        <Text style={[styles.stepText, { color: theme.colors.text }]}>راجع النتائج وأكّد الحفظ</Text>
                                    </View>
                                </View>

                                {/* Input */}
                                <View style={[styles.inputWrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                                    <TextInput
                                        ref={inputRef}
                                        style={[styles.input, { color: theme.colors.text }]}
                                        placeholder="اكتب أو تحدث هنا..."
                                        placeholderTextColor={theme.colors.textMuted}
                                        value={text}
                                        onChangeText={setText}
                                        onSubmitEditing={handleProcess}
                                        returnKeyType="done"
                                        textAlign="right"
                                        multiline
                                    />
                                    {text.length > 0 && (
                                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                            <TouchableOpacity
                                                onPress={handleProcess}
                                                style={[
                                                    styles.sendBtn,
                                                    { backgroundColor: theme.colors.primary },
                                                    isProcessing && { opacity: 0.8 }
                                                ]}
                                                disabled={isProcessing}
                                                activeOpacity={0.7}
                                            >
                                                {isProcessing ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Ionicons name="arrow-up" size={24} color="#fff" />
                                                )}
                                            </TouchableOpacity>
                                        </Animated.View>
                                    )}
                                </View>

                                {/* Example */}
                                <TouchableOpacity
                                    style={[styles.exampleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                                    onPress={() => setText(exampleText)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.exampleHeader}>
                                        <Ionicons name="bulb-outline" size={16} color={theme.colors.warning} />
                                        <Text style={[styles.exampleLabel, { color: theme.colors.textSecondary }]}>جرب هذا المثال</Text>
                                    </View>
                                    <Text style={[styles.exampleText, { color: theme.colors.text }]}>
                                        {exampleText}
                                    </Text>
                                </TouchableOpacity>

                                {/* Processing Indicator */}
                                {isProcessing && (
                                    <View style={styles.processingContainer}>
                                        <ActivityIndicator size="large" color={theme.colors.primary} />
                                        <Text style={[styles.processingText, { color: theme.colors.textSecondary }]}>جاري التحليل بالذكاء الاصطناعي...</Text>
                                    </View>
                                )}
                            </Animated.View>
                        ) : (
                            /* Results */
                            <View>
                                <View style={styles.resultsHeader}>
                                    <View style={styles.resultsHeaderLeft}>
                                        <Ionicons name="checkmark-done" size={20} color={theme.colors.success} />
                                        <Text style={[styles.resultsTitle, { color: theme.colors.text }]}>
                                            تم استخراج {parsedResults.length} {parsedResults.length === 1 ? 'معاملة' : 'معاملات'}
                                        </Text>
                                    </View>
                                </View>

                                {parsedResults.map((item, index) => (
                                    <View key={index} style={[styles.resultCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                                        {/* Card Header */}
                                        <View style={styles.cardHeader}>
                                            <View style={[
                                                styles.typeBadge,
                                                { backgroundColor: item.type === 'expense' ? '#FEE2E2' : '#D1FAE5' }
                                            ]}>
                                                <Ionicons
                                                    name={item.type === 'expense' ? 'arrow-down' : 'arrow-up'}
                                                    size={12}
                                                    color={item.type === 'expense' ? '#EF4444' : '#10B981'}
                                                />
                                                <Text style={[
                                                    styles.typeBadgeText,
                                                    { color: item.type === 'expense' ? '#DC2626' : '#059669' }
                                                ]}>
                                                    {item.type === 'expense' ? 'مصروف' : 'دخل'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.deleteBtn}
                                                onPress={() => {
                                                    const updated = [...parsedResults];
                                                    updated.splice(index, 1);
                                                    setParsedResults(updated);
                                                    if (updated.length === 0) setText('');
                                                }}
                                            >
                                                <Ionicons name="close-circle" size={22} color={theme.colors.textMuted} />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Title */}
                                        <View style={styles.fieldRow}>
                                            <Ionicons name="pricetag-outline" size={16} color={theme.colors.textSecondary} />
                                            <TextInput
                                                style={[styles.fieldInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                                                value={item.title}
                                                onChangeText={(val) => updateTransaction(index, 'title', val)}
                                                placeholder="اسم المعاملة"
                                                placeholderTextColor={theme.colors.textMuted}
                                                textAlign="right"
                                            />
                                        </View>

                                        {/* Amount */}
                                        <View style={styles.fieldRow}>
                                            <Ionicons name="cash-outline" size={16} color={theme.colors.textSecondary} />
                                            <TextInput
                                                style={[styles.fieldInput, styles.amountInput, {
                                                    color: item.type === 'expense' ? '#EF4444' : '#10B981',
                                                    borderColor: theme.colors.border,
                                                }]}
                                                value={item.amount ? formatNumberWithCommas(item.amount) : ''}
                                                onChangeText={(val) => {
                                                    const cleaned = convertArabicToEnglish(val);
                                                    const amountStr = cleaned.replace(/,/g, '');
                                                    updateTransaction(index, 'amount', parseFloat(amountStr) || 0);
                                                }}
                                                placeholder="المبلغ"
                                                keyboardType="numeric"
                                                placeholderTextColor={theme.colors.textMuted}
                                                textAlign="right"
                                            />
                                            <Text style={[styles.currencyLabel, { color: theme.colors.textMuted }]}>د.ع</Text>
                                        </View>

                                        {/* Type Toggle */}
                                        <View style={styles.toggleRow}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.toggleBtn,
                                                    item.type === 'expense' && styles.toggleBtnActiveExpense
                                                ]}
                                                onPress={() => updateTransaction(index, 'type', 'expense')}
                                            >
                                                <Ionicons name="arrow-down-circle-outline" size={16} color={item.type === 'expense' ? '#DC2626' : theme.colors.textMuted} />
                                                <Text style={[styles.toggleText, item.type === 'expense' && { color: '#DC2626', fontWeight: '700' }]}>مصروف</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[
                                                    styles.toggleBtn,
                                                    item.type === 'income' && styles.toggleBtnActiveIncome
                                                ]}
                                                onPress={() => updateTransaction(index, 'type', 'income')}
                                            >
                                                <Ionicons name="arrow-up-circle-outline" size={16} color={item.type === 'income' ? '#059669' : theme.colors.textMuted} />
                                                <Text style={[styles.toggleText, item.type === 'income' && { color: '#059669', fontWeight: '700' }]}>دخل</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Category */}
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={styles.categoryScroll}
                                        >
                                            {(item.type === 'expense' ? EXPENSE_CATEGORY_LIST : INCOME_CATEGORY_LIST).map((cat) => (
                                                <TouchableOpacity
                                                    key={cat}
                                                    style={[
                                                        styles.categoryChip,
                                                        { borderColor: theme.colors.border },
                                                        item.category === cat && (item.type === 'expense'
                                                            ? styles.categoryChipActiveExpense
                                                            : styles.categoryChipActiveIncome)
                                                    ]}
                                                    onPress={() => updateTransaction(index, 'category', cat)}
                                                >
                                                    <Text style={[
                                                        styles.categoryChipText,
                                                        { color: theme.colors.textSecondary },
                                                        item.category === cat && styles.categoryChipTextActive
                                                    ]}>
                                                        {CATEGORY_DISPLAY_NAMES[cat] || cat}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                ))}

                                {/* Add More */}
                                <TouchableOpacity
                                    style={[styles.addMoreBtn, { borderColor: theme.colors.border }]}
                                    onPress={() => { setParsedResults([]); setText(''); setTimeout(() => inputRef.current?.focus(), 100); }}
                                >
                                    <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
                                    <Text style={[styles.addMoreText, { color: theme.colors.primary }]}>إضافة معاملات أخرى</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    {/* Bottom Actions */}
                    {parsedResults.length > 0 && (
                        <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.cancelBtn, { borderColor: theme.colors.border }]}
                                onPress={() => {
                                    setParsedResults([]);
                                    setText('');
                                    setTimeout(() => inputRef.current?.focus(), 100);
                                }}
                            >
                                <Ionicons name="refresh-outline" size={18} color={theme.colors.textSecondary} />
                                <Text style={[styles.cancelBtnText, { color: theme.colors.textSecondary }]}>إعادة</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionBtn, styles.confirmBtn]}
                                onPress={handleConfirm}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                        <Text style={styles.confirmBtnText}>
                                            حفظ {parsedResults.length > 1 ? `الكل (${parsedResults.length})` : ''}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    container: {
        flex: 1,
    },
    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    headerBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: theme.typography.fontFamily,
    },
    // Scroll
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    // AI Badge
    aiBadge: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 6,
        backgroundColor: theme.colors.primary + '10',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    aiBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
    },
    // Usage Badge
    usageBadge: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 16,
        marginBottom: 12,
    },
    usageBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
    },
    // Instruction
    instruction: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
        fontFamily: theme.typography.fontFamily,
        lineHeight: 22,
    },
    // Steps
    stepsCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        ...theme.shadows.sm,
    },
    stepRow: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
    },
    stepIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepText: {
        flex: 1,
        fontSize: 13,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
    },
    stepDivider: {
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical: 4,
        marginHorizontal: 46,
    },
    // Input
    inputWrapper: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1.5,
        marginBottom: 16,
        minHeight: 68,
    },
    input: {
        flex: 1,
        fontSize: 16,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
        maxHeight: 100,
        paddingVertical: 6,
    },
    sendBtn: {
        width: 48,
        height: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
        ...theme.shadows.sm,
    },
    // Example
    exampleCard: {
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginBottom: 16,
    },
    exampleHeader: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    exampleLabel: {
        fontSize: 12,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
    },
    exampleText: {
        fontSize: 13,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
        lineHeight: 20,
    },
    // Processing
    processingContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    processingText: {
        fontSize: 14,
        fontFamily: theme.typography.fontFamily,
    },
    // Results Header
    resultsHeader: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    resultsHeaderLeft: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
    },
    resultsTitle: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
    },
    // Result Card
    resultCard: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        ...theme.shadows.xs,
    },
    cardHeader: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    typeBadge: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
    },
    deleteBtn: {
        padding: 2,
    },
    // Fields
    fieldRow: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    fieldInput: {
        flex: 1,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
        borderBottomWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    amountInput: {
        fontSize: 18,
        fontWeight: '700',
    },
    currencyLabel: {
        fontSize: 12,
        fontFamily: theme.typography.fontFamily,
    },
    // Toggle
    toggleRow: {
        flexDirection: 'row-reverse',
        gap: 8,
        marginBottom: 12,
        marginTop: 4,
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: theme.colors.surfaceLight,
    },
    toggleBtnActiveExpense: {
        backgroundColor: '#FEF2F2',
    },
    toggleBtnActiveIncome: {
        backgroundColor: '#ECFDF5',
    },
    toggleText: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamily,
    },
    // Category
    categoryScroll: {
        flexDirection: 'row-reverse',
        gap: 6,
        paddingVertical: 4,
    },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    categoryChipActiveExpense: {
        backgroundColor: '#FEE2E2',
        borderColor: '#FECACA',
    },
    categoryChipActiveIncome: {
        backgroundColor: '#D1FAE5',
        borderColor: '#A7F3D0',
    },
    categoryChipText: {
        fontSize: 12,
        fontFamily: theme.typography.fontFamily,
        fontWeight: '500',
    },
    categoryChipTextActive: {
        color: '#1E293B',
        fontWeight: '700',
    },
    // Add More
    addMoreBtn: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        marginTop: 4,
    },
    addMoreText: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
    },
    // Bottom Actions
    bottomActions: {
        flexDirection: 'row-reverse',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        borderTopWidth: 1,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row-reverse',
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    cancelBtn: {
        borderWidth: 1,
        flex: 0.4,
    },
    cancelBtnText: {
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
    },
    confirmBtn: {
        backgroundColor: theme.colors.primary,
        flex: 0.6,
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
    },
});
