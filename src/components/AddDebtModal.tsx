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
  Switch,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { DEBT_TYPES, Debt } from '../types';
import { 
  addDebt,
  updateDebt,
  getDebtInstallments,
  deleteDebtInstallment,
} from '../database/database';
import { createDebt, generateInstallments } from '../services/debtService';
import { addDebtInstallment } from '../database/database';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';

interface AddDebtModalProps {
  visible: boolean;
  onClose: () => void;
  editingDebt?: Debt | null;
}

export const AddDebtModal: React.FC<AddDebtModalProps> = ({
  visible,
  onClose,
  editingDebt,
}) => {
  const insets = useSafeAreaInsets();
  const [debtorName, setDebtorName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [type, setType] = useState<'debt' | 'installment' | 'advance'>('debt');
  const [startDate, setStartDate] = useState(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [hasDueDate, setHasDueDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [hasInstallments, setHasInstallments] = useState(false);
  const [numberOfInstallments, setNumberOfInstallments] = useState('1');
  const [installmentFrequency, setInstallmentFrequency] = useState<'weekly' | 'monthly'>('monthly');

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
    if (editingDebt) {
      setDebtorName(editingDebt.debtorName);
      setTotalAmount(editingDebt.totalAmount.toString());
      setType(editingDebt.type);
      setStartDate(new Date(editingDebt.startDate));
      setDueDate(editingDebt.dueDate ? new Date(editingDebt.dueDate) : null);
      setHasDueDate(!!editingDebt.dueDate);
      setDescription(editingDebt.description || '');
      
      // Check if debt has installments
      getDebtInstallments(editingDebt.id).then(insts => {
        setHasInstallments(insts.length > 0);
        if (insts.length > 0) {
          setNumberOfInstallments(insts.length.toString());
        }
      });
    } else {
      resetForm();
    }
  }, [editingDebt, visible]);

  const resetForm = () => {
    setDebtorName('');
    setTotalAmount('');
    setType('debt');
    setStartDate(new Date());
    setDueDate(null);
    setHasDueDate(false);
    setDescription('');
    setHasInstallments(false);
    setNumberOfInstallments('1');
    setInstallmentFrequency('monthly');
  };

  const handleSave = async () => {
    if (!debtorName.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال اسم الدائن (من مدين له)');
      return;
    }

    if (!totalAmount.trim() || isNaN(Number(totalAmount)) || Number(totalAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    if (hasDueDate && !dueDate) {
      alertService.warning('تنبيه', 'يرجى تحديد تاريخ الاستحقاق');
      return;
    }

    if (hasInstallments) {
      const numInst = parseInt(numberOfInstallments);
      if (isNaN(numInst) || numInst <= 0) {
        alertService.warning('تنبيه', 'يرجى إدخال عدد أقساط صحيح');
        return;
      }
    }

    setLoading(true);

    try {
      const amount = Number(totalAmount);
      const debtData = {
        debtorName: debtorName.trim(),
        totalAmount: amount,
        remainingAmount: editingDebt ? editingDebt.remainingAmount : amount,
        startDate: startDate.toISOString().split('T')[0],
        dueDate: hasDueDate && dueDate ? dueDate.toISOString().split('T')[0] : undefined,
        description: description.trim(),
        type: type,
        currency: 'IQD',
        isPaid: false,
      };

      if (editingDebt) {
        // Update existing debt
        await updateDebt(editingDebt.id, debtData);
        
        // If installments changed, delete old ones and create new ones
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
        // Create new debt
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
          installments
        );
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving debt:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الدين');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getTypeName = (t: 'debt' | 'installment' | 'advance') => {
    return DEBT_TYPES[t];
  };

  const typeIcons: Record<'debt' | 'installment' | 'advance', string> = {
    debt: 'card',
    installment: 'calendar',
    advance: 'cash',
  };

  const typeColors: Record<'debt' | 'installment' | 'advance', string[]> = {
    debt: ['#8B5CF6', '#7C3AED'],
    installment: ['#3B82F6', '#2563EB'],
    advance: ['#F59E0B', '#D97706'],
  };

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
                    <View style={[styles.iconBadge, { backgroundColor: typeColors[type][0] + '20' }]}>
                      <Ionicons
                        name={typeIcons[type] as any}
                        size={24}
                        color={typeColors[type][0]}
                      />
                    </View>
                    <View style={styles.headerText}>
                      <Text style={styles.title}>
                        {editingDebt ? 'تعديل الدين' : 'دين جديد'}
                      </Text>
                      <Text style={styles.subtitle}>أضف تفاصيل الدين</Text>
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
                  {/* Creditor Name Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>من مدين له</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={debtorName}
                        onChangeText={setDebtorName}
                        placeholder="مثال: أحمد محمد (الدائن)"
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
                    <Text style={styles.label}>المبلغ الإجمالي (د.ع)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={totalAmount}
                        onChangeText={setTotalAmount}
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
                  </View>

                  {/* Type Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>نوع الدين</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryScroll}
                    >
                      {(['debt', 'installment', 'advance'] as const).map((t) => {
                        const isSelected = type === t;
                        return (
                          <TouchableOpacity
                            key={t}
                            onPress={() => setType(t)}
                            style={styles.categoryOption}
                            activeOpacity={0.7}
                          >
                            {isSelected ? (
                              <LinearGradient
                                colors={typeColors[t] as any}
                                style={styles.categoryGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                              >
                                <Ionicons
                                  name={typeIcons[t] as any}
                                  size={20}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.categoryTextActive}>{getTypeName(t)}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.categoryDefault}>
                                <Ionicons
                                  name={`${typeIcons[t]}-outline` as any}
                                  size={20}
                                  color={theme.colors.textSecondary}
                                />
                                <Text style={styles.categoryText}>{getTypeName(t)}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Start Date Picker */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>تاريخ البدء</Text>
                    <TouchableOpacity
                      onPress={() => setShowStartDatePicker(true)}
                      style={styles.dateButton}
                    >
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.dateButtonText}>
                        {startDate.toLocaleDateString('ar-IQ', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    {showStartDatePicker && (
                      <DateTimePicker
                        value={startDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowStartDatePicker(false);
                          if (selectedDate) {
                            setStartDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </View>

                  {/* Due Date Toggle */}
                  <View style={styles.inputGroup}>
                    <View style={styles.switchRow}>
                      <Text style={styles.label}>تاريخ الاستحقاق</Text>
                      <Switch
                        value={hasDueDate}
                        onValueChange={setHasDueDate}
                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        thumbColor={theme.colors.surfaceCard}
                      />
                    </View>
                    {hasDueDate && (
                      <>
                        <TouchableOpacity
                          onPress={() => setShowDueDatePicker(true)}
                          style={styles.dateButton}
                        >
                          <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                          <Text style={styles.dateButtonText}>
                            {dueDate ? dueDate.toLocaleDateString('ar-IQ', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            }) : 'اختر التاريخ'}
                          </Text>
                          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                        {showDueDatePicker && (
                          <DateTimePicker
                            value={dueDate || new Date()}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                              setShowDueDatePicker(false);
                              if (selectedDate) {
                                setDueDate(selectedDate);
                              }
                            }}
                          />
                        )}
                      </>
                    )}
                  </View>

                  {/* Installments Toggle */}
                  <View style={styles.inputGroup}>
                    <View style={styles.switchRow}>
                      <Text style={styles.label}>أقساط</Text>
                      <Switch
                        value={hasInstallments}
                        onValueChange={setHasInstallments}
                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        thumbColor={theme.colors.surfaceCard}
                      />
                    </View>
                    {hasInstallments && (
                      <View style={styles.installmentRow}>
                        <View style={styles.installmentInput}>
                          <Text style={styles.sublabel}>عدد الأقساط</Text>
                          <View style={styles.inputWrapper}>
                            <TextInput
                              value={numberOfInstallments}
                              onChangeText={setNumberOfInstallments}
                              placeholder="1"
                              keyboardType="number-pad"
                              mode="flat"
                              style={styles.input}
                              contentStyle={styles.inputContent}
                              underlineColor="transparent"
                              activeUnderlineColor={theme.colors.primary}
                            />
                          </View>
                        </View>
                        <View style={styles.installmentInput}>
                          <Text style={styles.sublabel}>التكرار</Text>
                          <TouchableOpacity
                            style={styles.frequencyButton}
                            onPress={() => setInstallmentFrequency(installmentFrequency === 'weekly' ? 'monthly' : 'weekly')}
                            activeOpacity={0.7}
                          >
                            <LinearGradient
                              colors={theme.gradients.primary as any}
                              style={styles.frequencyButtonGradient}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                            >
                              <Ionicons name="repeat" size={16} color="#FFFFFF" />
                              <Text style={styles.frequencyButtonText}>
                                {installmentFrequency === 'weekly' ? 'أسبوعي' : 'شهري'}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
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
                      colors={typeColors[type] as any}
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
                            {editingDebt ? 'تحديث' : 'حفظ'}
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
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  sublabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
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
  },
  categoryTextActive: {
    fontSize: theme.typography.sizes.sm,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  installmentRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  installmentInput: {
    flex: 1,
  },
  frequencyButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  frequencyButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  frequencyButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
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
});
