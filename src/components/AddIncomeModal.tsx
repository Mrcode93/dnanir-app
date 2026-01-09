import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { Income, IncomeSource, INCOME_SOURCES } from '../types';
import { addIncome, updateIncome } from '../database/database';

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
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState<IncomeSource>('salary');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));

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
    if (income) {
      setSource(income.source);
      setAmount(income.amount.toString());
      setDate(new Date(income.date));
      setDescription(income.description || '');
    } else {
      resetForm();
    }
  }, [income, visible]);

  const resetForm = () => {
    setSource('');
    setAmount('');
    setIncomeSource('salary');
    setDate(new Date());
    setDescription('');
  };

  const handleSave = async () => {
    if (!source.trim()) {
      Alert.alert('⚠️ تنبيه', 'يرجى إدخال مصدر الدخل');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('⚠️ تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);

    try {
      const incomeData = {
        source: source.trim(),
        amount: Number(amount),
        date: date.toISOString().split('T')[0],
        description: description.trim(),
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
      console.error('Error saving income:', error);
      Alert.alert('❌ خطأ', 'حدث خطأ أثناء حفظ الدخل');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const sourceIcons: Record<IncomeSource, string> = {
    salary: 'cash',
    business: 'briefcase',
    investment: 'trending-up',
    gift: 'gift',
    other: 'ellipse',
  };

  const sourceColors: Record<IncomeSource, string[]> = {
    salary: ['#10B981', '#059669'],
    business: ['#3B82F6', '#2563EB'],
    investment: ['#8B5CF6', '#7C3AED'],
    gift: ['#EC4899', '#DB2777'],
    other: ['#6B7280', '#4B5563'],
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
                    <View style={[styles.iconBadge, { backgroundColor: sourceColors[incomeSource][0] + '20' }]}>
                      <Ionicons
                        name={sourceIcons[incomeSource] as any}
                        size={24}
                        color={sourceColors[incomeSource][0]}
                      />
                    </View>
                    <View style={styles.headerText}>
                      <Text style={styles.title}>
                        {income ? 'تعديل الدخل' : 'دخل جديد'}
                      </Text>
                      <Text style={styles.subtitle}>أضف تفاصيل الدخل</Text>
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
                    <Text style={styles.label}>المبلغ (دينار)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={amount}
                        onChangeText={setAmount}
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

                  {/* Date Picker */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>التاريخ</Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(true)}
                      style={styles.dateButton}
                    >
                      <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                      <Text style={styles.dateButtonText}>
                        {date.toLocaleDateString('ar-IQ', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            setDate(selectedDate);
                          }
                        }}
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
                      {Object.entries(INCOME_SOURCES).map(([key, label]) => {
                        const isSelected = incomeSource === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() => setIncomeSource(key as IncomeSource)}
                            style={styles.categoryOption}
                            activeOpacity={0.7}
                          >
                            {isSelected ? (
                              <LinearGradient
                                colors={sourceColors[key as IncomeSource]}
                                style={styles.categoryGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                              >
                                <Ionicons
                                  name={sourceIcons[key as IncomeSource] as any}
                                  size={20}
                                  color="#FFFFFF"
                                />
                                <Text style={styles.categoryTextActive}>{label}</Text>
                              </LinearGradient>
                            ) : (
                              <View style={styles.categoryDefault}>
                                <Ionicons
                                  name={`${sourceIcons[key as IncomeSource]}-outline` as any}
                                  size={20}
                                  color={theme.colors.textSecondary}
                                />
                                <Text style={styles.categoryText}>{label}</Text>
                              </View>
                            )}
                          </TouchableOpacity>
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
                      colors={sourceColors[incomeSource]}
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
                            {income ? 'تحديث' : 'حفظ'}
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    ...theme.shadows.sm,
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
    fontWeight: '500',
    writingDirection: 'rtl',
  },
  categoryTextActive: {
    fontSize: theme.typography.sizes.sm,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  saveButton: {
    flex: 2,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
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
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
});
