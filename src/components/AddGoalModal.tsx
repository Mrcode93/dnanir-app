import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { FinancialGoal, GoalCategory, GOAL_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';

interface AddGoalModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (goal: Omit<FinancialGoal, 'id' | 'createdAt'>) => Promise<void>;
  editingGoal?: FinancialGoal | null;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  visible,
  onDismiss,
  onSave,
  editingGoal,
}) => {
  const insets = useSafeAreaInsets();
  const { currencyCode, formatCurrency } = useCurrency();
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [category, setCategory] = useState<GoalCategory>('other');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [convertedTargetAmount, setConvertedTargetAmount] = useState<number | null>(null);
  const [convertedCurrentAmount, setConvertedCurrentAmount] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

  // Convert amounts when they change
  useEffect(() => {
    const convertAmounts = async () => {
      if (targetAmount && !isNaN(Number(targetAmount)) && Number(targetAmount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(targetAmount), currency, currencyCode);
          setConvertedTargetAmount(converted);
        } else {
          setConvertedTargetAmount(null);
        }
      } else {
        setConvertedTargetAmount(null);
      }

      if (currentAmount && !isNaN(Number(currentAmount)) && Number(currentAmount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(currentAmount), currency, currencyCode);
          setConvertedCurrentAmount(converted);
        } else {
          setConvertedCurrentAmount(null);
        }
      } else {
        setConvertedCurrentAmount(null);
      }
    };

    convertAmounts();
  }, [targetAmount, currentAmount, currency, currencyCode]);

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setTargetAmount(editingGoal.targetAmount.toString());
      setCurrentAmount(editingGoal.currentAmount.toString());
      setCategory(editingGoal.category);
      setDescription(editingGoal.description || '');
      setTargetDate(editingGoal.targetDate ? new Date(editingGoal.targetDate) : null);
      setCompleted(editingGoal.completed);
      setCurrency(editingGoal.currency || currencyCode);
    } else {
      resetForm();
    }
  }, [editingGoal, visible, currencyCode]);

  const resetForm = () => {
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('0');
    setCategory('other');
    setDescription('');
    setTargetDate(null);
    setCompleted(false);
    setCurrency(currencyCode);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال عنوان الهدف');
      return;
    }

    if (!targetAmount.trim() || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ مستهدف صحيح');
      return;
    }

    const targetAmountNum = parseFloat(targetAmount);
    const currentAmountNum = parseFloat(currentAmount) || 0;

    if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ مستهدف صحيح');
      return;
    }

    setLoading(true);

    try {
      await onSave({
        title: title.trim(),
        targetAmount: targetAmountNum,
        currentAmount: currentAmountNum,
        targetDate: targetDate ? targetDate.toISOString().split('T')[0] : undefined,
        category,
        description: description.trim() || undefined,
        completed,
        currency: currency,
      });

      resetForm();
      onDismiss();
    } catch (error) {
      console.error('Error saving goal:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الهدف');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onDismiss();
  };

  const categories = Object.entries(GOAL_CATEGORIES) as [GoalCategory, { label: string; icon: string }][];

  const categoryIcons: Record<GoalCategory, string> = {
    emergency: 'shield',
    vacation: 'airplane',
    car: 'car',
    house: 'home',
    wedding: 'heart',
    education: 'school',
    business: 'briefcase',
    other: 'star',
  };

  const categoryColors: Record<GoalCategory, string[]> = {
    emergency: ['#EF4444', '#DC2626'],
    vacation: ['#8B5CF6', '#7C3AED'],
    car: ['#10B981', '#059669'],
    house: ['#3B82F6', '#2563EB'],
    wedding: ['#EC4899', '#DB2777'],
    education: ['#06B6D4', '#0891B2'],
    business: ['#F59E0B', '#D97706'],
    other: ['#6B7280', '#4B5563'],
  };

  const selectedCurrencyData = CURRENCIES.find(c => c.code === currency);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                style={[styles.modalGradient, { paddingBottom: insets.bottom }]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <View style={[styles.iconBadge, { backgroundColor: categoryColors[category][0] + '20' }]}>
                      <Ionicons
                        name={categoryIcons[category] as any}
                        size={24}
                        color={categoryColors[category][0]}
                      />
                    </View>
                    <View style={styles.headerText}>
                      <Text style={styles.title}>
                        {editingGoal ? 'تعديل الهدف' : 'هدف جديد'}
                      </Text>
                      <Text style={styles.subtitle}>أضف تفاصيل هدفك المالي</Text>
                    </View>
                  </View>
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={handleClose}
                    iconColor={theme.colors.textSecondary}
                    style={styles.closeButton}
                  />
                </View>

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Title Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>عنوان الهدف</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="مثال: توفير لسيارة"
                        mode="flat"
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        underlineColor="transparent"
                        activeUnderlineColor={theme.colors.primary}
                      />
                    </View>
                  </View>

                  {/* Amount Inputs */}
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: theme.spacing.md }]}>
                      <Text style={styles.label}>المبلغ المستهدف ({selectedCurrencyData?.symbol})</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          value={targetAmount}
                          onChangeText={setTargetAmount}
                          placeholder="0.00"
                          keyboardType="numeric"
                          mode="flat"
                          style={styles.input}
                          contentStyle={styles.inputContent}
                          underlineColor="transparent"
                          activeUnderlineColor={theme.colors.primary}
                          left={
                            <TextInput.Icon
                              icon={() => (
                                <Ionicons name="flag-outline" size={20} color={theme.colors.textSecondary} />
                              )}
                            />
                          }
                        />
                      </View>
                      {convertedTargetAmount !== null && currency !== currencyCode && (
                        <Text style={styles.convertedAmountText}>
                          ≈ {formatCurrency(convertedTargetAmount)}
                        </Text>
                      )}
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>المبلغ الحالي ({selectedCurrencyData?.symbol})</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          value={currentAmount}
                          onChangeText={setCurrentAmount}
                          placeholder="0.00"
                          keyboardType="numeric"
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
                      {convertedCurrentAmount !== null && currency !== currencyCode && (
                        <Text style={styles.convertedAmountText}>
                          ≈ {formatCurrency(convertedCurrentAmount)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Currency Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>العملة</Text>
                    <TouchableOpacity
                      onPress={() => setShowCurrencyPicker(true)}
                      style={styles.currencyButton}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={theme.gradients.primary as any}
                        style={styles.currencyButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons name="cash" size={20} color="#FFFFFF" />
                        <Text style={styles.currencyButtonText}>
                          {selectedCurrencyData?.symbol} {selectedCurrencyData?.name}
                        </Text>
                        <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color="#FFFFFF" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Category Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>الفئة</Text>
                    <View style={styles.categoryGrid}>
                      {categories.map(([catKey, catInfo]) => {
                        const isSelected = category === catKey;
                        return (
                          <TouchableOpacity
                            key={catKey}
                            onPress={() => setCategory(catKey)}
                            style={styles.categoryOption}
                            activeOpacity={0.8}
                          >
                            {isSelected ? (
                              <LinearGradient
                                colors={categoryColors[catKey] as any}
                                style={styles.categoryGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                              >
                                <Ionicons
                                  name={categoryIcons[catKey] as any}
                                  size={28}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.categoryTextActive}>{catInfo.label}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.categoryDefault}>
                                <Ionicons
                                  name={`${categoryIcons[catKey]}-outline` as any}
                                  size={28}
                                  color={theme.colors.textSecondary}
                                />
                                <Text style={styles.categoryText}>{catInfo.label}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Date Picker */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>تاريخ الهدف (اختياري)</Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(true)}
                      style={styles.dateButton}
                    >
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.dateButtonText}>
                        {targetDate
                          ? targetDate.toLocaleDateString('ar-IQ', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'اختر التاريخ'}
                      </Text>
                      {targetDate ? (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            setTargetDate(null);
                          }}
                          style={styles.removeDateButton}
                        >
                          <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={targetDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            setTargetDate(selectedDate);
                          }
                        }}
                        minimumDate={new Date()}
                      />
                    )}
                  </View>

                  {/* Description Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>وصف (اختياري)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="أضف ملاحظات حول هدفك..."
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

                  {/* Completed Checkbox */}
                  {editingGoal && (
                    <View style={styles.inputGroup}>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => setCompleted(!completed)}
                        activeOpacity={0.7}
                      >
                        {completed ? (
                          <Ionicons name="checkbox" size={24} color={theme.colors.success} />
                        ) : (
                          <Ionicons name="checkbox-outline" size={24} color={theme.colors.textSecondary} />
                        )}
                        <Text style={styles.checkboxLabel}>تم إنجاز الهدف</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.cancelButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>إلغاء</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={styles.saveButton}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={categoryColors[category] as any}
                      style={styles.saveButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                        <Text style={styles.saveButtonText}>جاري الحفظ...</Text>
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                          <Text style={styles.saveButtonText}>
                            {editingGoal ? 'تحديث' : 'حفظ'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <Pressable
          style={styles.currencyModalOverlay}
          onPress={() => setShowCurrencyPicker(false)}
        >
          <Pressable
            style={styles.currencyModalContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.currencyModalGradient}
            >
              <View style={styles.currencyModalHeader}>
                <Text style={styles.currencyModalTitle}>اختر العملة</Text>
                <TouchableOpacity
                  onPress={() => setShowCurrencyPicker(false)}
                  style={styles.currencyModalCloseButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.currencyModalScrollView}
                contentContainerStyle={styles.currencyModalScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {CURRENCIES.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyOption,
                      currency === curr.code && styles.currencyOptionSelected,
                    ]}
                    onPress={() => {
                      setCurrency(curr.code);
                      setShowCurrencyPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.currencyOptionText,
                      currency === curr.code && styles.currencyOptionTextSelected,
                    ]}>
                      {curr.symbol} {curr.name}
                    </Text>
                    {currency === curr.code && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '98%',
    width: '100%',
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    direction: 'rtl',
  },
  modalGradient: {
    width: '100%',
    minHeight: 600,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexShrink: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  closeButton: {
    margin: 0,
  },
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
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
  removeDateButton: {
    padding: theme.spacing.xs,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  categoryOption: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
    marginBottom: theme.spacing.sm,
  },
  categoryGradient: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
    minHeight: 90,
  },
  categoryDefault: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
    minHeight: 90,
  },
  categoryText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('500'),
  },
  categoryTextActive: {
    fontSize: theme.typography.sizes.md,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  checkboxLabel: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginLeft: theme.spacing.sm,
    writingDirection: 'rtl',
  },
  actions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexShrink: 0,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    flex: 2,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
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
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    zIndex: 1000,
  },
  currencyModalGradient: {
    maxHeight: '100%',
  },
  currencyModalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
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
  currencyOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
});
