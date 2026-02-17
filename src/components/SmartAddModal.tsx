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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, useAppTheme, useThemedStyles } from '../utils/theme';
import { parseTransactionText, ParsedTransaction, CATEGORY_DISPLAY_NAMES, EXPENSE_CATEGORY_LIST, INCOME_CATEGORY_LIST } from '../utils/smartParser';
import { addExpense, addIncome } from '../database/database';
import { ConfirmAlert } from './ConfirmAlert';
import { LinearGradient } from 'expo-linear-gradient';

interface SmartAddModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const SmartAddModal: React.FC<SmartAddModalProps> = ({ visible, onClose, onSuccess }) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [parsedResult, setParsedResult] = useState<ParsedTransaction | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedType, setSelectedType] = useState<'expense' | 'income'>('expense');
    const [editedTitle, setEditedTitle] = useState<string>('');
    const inputRef = useRef<TextInput>(null);

    // Animation for the "mic" pulse effect (visual only)
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (visible) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setText('');
            setParsedResult(null);
            setSelectedCategory('');
            setSelectedType('expense');
            setEditedTitle('');
            startPulse();
        }
    }, [visible]);

    const startPulse = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const handleProcess = async () => {
        if (!text.trim()) return;

        setIsProcessing(true);

        // Simulate a small delay for "AI" feel
        setTimeout(() => {
            const result = parseTransactionText(text);
            setParsedResult(result);
            setSelectedCategory(result.category);
            setSelectedType(result.type);
            setEditedTitle(result.title);
            setIsProcessing(false);
        }, 600);
    };

    const handleConfirm = async () => {
        if (!parsedResult || !parsedResult.amount) {
            alert('يرجى التأكد من وجود مبلغ في النص');
            return;
        }

        try {
            const now = new Date();
            // Format YYYY-MM-DD manually to avoid timezone issues with ISOString
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Use selected category, type, and title (which user may have changed)
            const finalTitle = editedTitle.trim() || CATEGORY_DISPLAY_NAMES[selectedCategory] || 'معاملة';

            if (selectedType === 'expense') {
                await addExpense({
                    title: finalTitle,
                    amount: parsedResult.amount,
                    category: selectedCategory as any,
                    date: dateStr,
                    description: '',
                    currency: 'IQD',
                });
            } else {
                await addIncome({
                    source: finalTitle,
                    amount: parsedResult.amount,
                    date: dateStr,
                    category: selectedCategory,
                    description: '',
                    currency: 'IQD',
                });
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving smart transaction:', error);
            alert('حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.');
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="slide"
            onRequestClose={onClose}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                >
                    <LinearGradient
                        colors={['#ffffff', '#f8fafc']}
                        style={styles.fullBackground}
                    >
                        <View style={styles.header}>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                            <Text style={styles.title}>إضافة ذكية</Text>
                            <View style={styles.headerRight}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="mic" size={20} color={theme.colors.primary} />
                                </View>
                            </View>
                        </View>

                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >

                            {!parsedResult ? (
                                <>
                                    <Text style={styles.subtitle}>
                                        اكتب أو تحدث عن المعاملة المالية وسيتم تحليلها تلقائياً
                                    </Text>

                                    {/* How to use section */}
                                    <View style={styles.howToUseContainer}>
                                        <View style={styles.howToUseHeader}>
                                            <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
                                            <Text style={styles.howToUseTitle}>كيفية الاستخدام</Text>
                                        </View>
                                        <View style={styles.howToUseStep}>
                                            <View style={styles.stepNumber}>
                                                <Text style={styles.stepNumberText}>1</Text>
                                            </View>
                                            <Text style={styles.stepText}>اضغط على أيقونة 🎤 في لوحة المفاتيح للتحدث</Text>
                                        </View>
                                        <View style={styles.howToUseStep}>
                                            <View style={styles.stepNumber}>
                                                <Text style={styles.stepNumberText}>2</Text>
                                            </View>
                                            <Text style={styles.stepText}>قل اسم المعاملة والمبلغ (مثال: "غداء خمسة آلاف")</Text>
                                        </View>
                                        <View style={styles.howToUseStep}>
                                            <View style={styles.stepNumber}>
                                                <Text style={styles.stepNumberText}>3</Text>
                                            </View>
                                            <Text style={styles.stepText}>راجع النتيجة وعدّل التصنيف إذا لزم الأمر</Text>
                                        </View>
                                    </View>

                                    <View style={styles.inputContainer}>
                                        <TextInput
                                            ref={inputRef}
                                            style={styles.input}
                                            placeholder="اكتب أو تحدث هنا..."
                                            placeholderTextColor="#94A3B8"
                                            value={text}
                                            onChangeText={setText}
                                            onSubmitEditing={handleProcess}
                                            returnKeyType="done"
                                            textAlign="right"
                                        />
                                        {text.length > 0 && (
                                            <TouchableOpacity onPress={handleProcess} style={styles.sendButton}>
                                                <Ionicons name="arrow-up" size={20} color="#fff" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Examples section */}
                                    <View style={styles.examplesContainer}>
                                        <Text style={styles.examplesTitle}>أمثلة باللهجة العراقية:</Text>
                                        <View style={styles.examplesGrid}>
                                            <TouchableOpacity onPress={() => setText('تكسي بربع')} style={styles.exampleChip}>
                                                <Ionicons name="remove-circle" size={14} color="#EF4444" />
                                                <Text style={styles.exampleText}>تكسي بربع</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setText('غدا بخمسة')} style={styles.exampleChip}>
                                                <Ionicons name="remove-circle" size={14} color="#EF4444" />
                                                <Text style={styles.exampleText}>غدا بخمسة</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setText('بانزين ب١٠')} style={styles.exampleChip}>
                                                <Ionicons name="remove-circle" size={14} color="#EF4444" />
                                                <Text style={styles.exampleText}>بانزين ب١٠</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setText('مسواك ب٢٥ الف')} style={styles.exampleChip}>
                                                <Ionicons name="remove-circle" size={14} color="#EF4444" />
                                                <Text style={styles.exampleText}>مسواك ب٢٥ الف</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setText('راتب مليون ونص')} style={styles.exampleChip}>
                                                <Ionicons name="add-circle" size={14} color="#10B981" />
                                                <Text style={styles.exampleText}>راتب مليون ونص</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setText('كارت رصيد ب٥')} style={styles.exampleChip}>
                                                <Ionicons name="remove-circle" size={14} color="#EF4444" />
                                                <Text style={styles.exampleText}>كارت رصيد ب٥</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <View style={styles.resultContainer}>
                                    <Text style={styles.resultTitle}>هل تقصد هذا؟</Text>

                                    <View style={styles.resultCard}>
                                        {/* Title Input */}
                                        <View style={styles.titleInputContainer}>
                                            <Text style={styles.resultLabel}>العنوان</Text>
                                            <TextInput
                                                style={styles.titleInput}
                                                value={editedTitle}
                                                onChangeText={setEditedTitle}
                                                placeholder="أدخل اسم المعاملة"
                                                placeholderTextColor="#94A3B8"
                                                textAlign="right"
                                            />
                                        </View>

                                        <View style={[styles.resultRow, { marginBottom: 16 }]}>
                                            <Text style={styles.resultLabel}>المبلغ</Text>
                                            <Text style={styles.resultValueAmount}>
                                                {parsedResult.amount?.toLocaleString()} د.ع
                                            </Text>
                                        </View>

                                        {/* Type Toggle */}
                                        <View style={styles.resultRow}>
                                            <Text style={styles.resultLabel}>النوع</Text>
                                            <View style={styles.typeToggle}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.typeOption,
                                                        selectedType === 'expense' && styles.typeOptionActiveExpense
                                                    ]}
                                                    onPress={() => {
                                                        setSelectedType('expense');
                                                        setSelectedCategory(EXPENSE_CATEGORY_LIST[0]);
                                                    }}
                                                >
                                                    <Text style={[
                                                        styles.typeOptionText,
                                                        selectedType === 'expense' && styles.typeOptionTextActive
                                                    ]}>مصروف</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.typeOption,
                                                        selectedType === 'income' && styles.typeOptionActiveIncome
                                                    ]}
                                                    onPress={() => {
                                                        setSelectedType('income');
                                                        setSelectedCategory(INCOME_CATEGORY_LIST[0]);
                                                    }}
                                                >
                                                    <Text style={[
                                                        styles.typeOptionText,
                                                        selectedType === 'income' && styles.typeOptionTextActive
                                                    ]}>دخل</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Category Selector */}
                                        <View style={styles.categorySection}>
                                            <Text style={styles.resultLabel}>التصنيف</Text>
                                            <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                contentContainerStyle={styles.categoryScroll}
                                            >
                                                {(selectedType === 'expense' ? EXPENSE_CATEGORY_LIST : INCOME_CATEGORY_LIST).map((cat) => (
                                                    <TouchableOpacity
                                                        key={cat}
                                                        style={[
                                                            styles.categoryChip,
                                                            selectedCategory === cat && (selectedType === 'expense'
                                                                ? styles.categoryChipActiveExpense
                                                                : styles.categoryChipActiveIncome)
                                                        ]}
                                                        onPress={() => setSelectedCategory(cat)}
                                                    >
                                                        <Text style={[
                                                            styles.categoryChipText,
                                                            selectedCategory === cat && styles.categoryChipTextActive
                                                        ]}>
                                                            {CATEGORY_DISPLAY_NAMES[cat] || cat}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    </View>

                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.cancelAction]}
                                            onPress={() => {
                                                setParsedResult(null);
                                                setText('');
                                            }}
                                        >
                                            <Text style={styles.cancelActionText}>تعديل</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.confirmAction]}
                                            onPress={handleConfirm}
                                        >
                                            <Text style={styles.confirmActionText}>تأكيد وإضافة</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </LinearGradient>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    fullBackground: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#ffffff',
    },
    headerRight: {
        width: 40,
        alignItems: 'flex-end',
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eff6ff', // blue-50
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        fontFamily: theme.typography.fontFamily,
    },
    closeBtn: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'right',
        marginBottom: 16,
        fontFamily: theme.typography.fontFamily,
        lineHeight: 20,
    },
    inputContainer: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    input: {
        flex: 1,
        height: 50,
        fontSize: 18,
        fontFamily: theme.typography.fontFamily,
        color: '#0F172A',
        textAlign: 'right',
    },
    sendButton: {
        width: 36,
        height: 36,
        backgroundColor: theme.colors.primary,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    // How to use section styles
    howToUseContainer: {
        backgroundColor: '#EFF6FF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    howToUseHeader: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    howToUseTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E40AF',
        fontFamily: theme.typography.fontFamily,
    },
    howToUseStep: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    stepNumber: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumberText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: theme.typography.fontFamily,
    },
    stepText: {
        flex: 1,
        fontSize: 13,
        color: '#1E3A8A',
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
        lineHeight: 20,
    },

    // Examples section styles
    examplesContainer: {
        marginTop: 12,
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    examplesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
        marginBottom: 12,
    },
    examplesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'flex-end',
    },
    exampleChip: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    exampleText: {
        fontSize: 12,
        color: '#334155',
        fontFamily: theme.typography.fontFamily,
    },

    // Result Styles
    resultContainer: {
        width: '100%',
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'center',
        marginBottom: 16,
        fontFamily: theme.typography.fontFamily,
    },
    resultCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    titleInputContainer: {
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    titleInput: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
    },
    resultRow: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    resultLabel: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: theme.typography.fontFamily,
    },
    resultValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        fontFamily: theme.typography.fontFamily,
    },
    resultValueAmount: {
        fontSize: 24,
        fontWeight: '800',
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
    },
    actions: {
        flexDirection: 'row-reverse',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelAction: {
        backgroundColor: '#F1F5F9',
    },
    cancelActionText: {
        color: '#64748B',
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
    },
    confirmAction: {
        backgroundColor: theme.colors.primary,
    },
    confirmActionText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
    },

    // Type Toggle Styles
    typeToggle: {
        flexDirection: 'row-reverse',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 4,
        gap: 4,
    },
    typeOption: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    typeOptionActiveExpense: {
        backgroundColor: '#FEE2E2',
    },
    typeOptionActiveIncome: {
        backgroundColor: '#D1FAE5',
    },
    typeOptionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        fontFamily: theme.typography.fontFamily,
    },
    typeOptionTextActive: {
        color: '#1E293B',
        fontWeight: '700',
    },

    // Category Selector Styles
    categorySection: {
        marginTop: 16,
    },
    categoryScroll: {
        flexDirection: 'row-reverse',
        gap: 8,
        paddingTop: 12,
        paddingBottom: 4,
    },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    categoryChipActiveExpense: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    categoryChipActiveIncome: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
    },
    categoryChipText: {
        fontSize: 13,
        color: '#64748B',
        fontFamily: theme.typography.fontFamily,
        fontWeight: '500',
    },
    categoryChipTextActive: {
        color: '#1E293B',
        fontWeight: '700',
    },
});
