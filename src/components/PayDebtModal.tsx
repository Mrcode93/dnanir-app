import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { Debt } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish } from '../utils/numbers';

interface PayDebtModalProps {
  visible: boolean;
  debt: Debt | null;
  onClose: () => void;
  onPay: (amount: number) => Promise<void>;
}

export const PayDebtModal: React.FC<PayDebtModalProps> = ({
  visible,
  debt,
  onClose,
  onPay,
}) => {
  const { formatCurrency, currencyCode } = useCurrency();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'all' | 'partial'>('all');

  useEffect(() => {
    if (visible && debt) {
      if (paymentType === 'all') {
        setAmount(debt.remainingAmount.toString());
      } else {
        setAmount('');
      }
    }
  }, [visible, debt, paymentType]);

  const handlePayAll = () => {
    setPaymentType('all');
    if (debt) {
      setAmount(debt.remainingAmount.toString());
    }
  };

  const handlePayPartial = () => {
    setPaymentType('partial');
    setAmount('');
  };

  const handlePay = async () => {
    if (!debt) return;

    Keyboard.dismiss();

    const paymentAmount = Number(amount);

    if (!amount.trim() || isNaN(paymentAmount) || paymentAmount <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    if (paymentAmount > debt.remainingAmount) {
      alertService.warning('تنبيه', `المبلغ المدخل (${formatCurrency(paymentAmount)}) أكبر من المبلغ المتبقي (${formatCurrency(debt.remainingAmount)})`);
      return;
    }

    setLoading(true);
    try {
      await onPay(paymentAmount);
      setAmount('');
      setPaymentType('all');
      onClose();
    } catch (error) {
      console.error('Error paying debt:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setPaymentType('all');
    onClose();
  };

  if (!debt) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Pressable
          style={styles.overlay}
          onPress={handleClose}
        >
          <Pressable
            style={styles.modalContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.modalGradient}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={[styles.iconBadge, { backgroundColor: '#10B98120' }]}>
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>دفع الدين</Text>
                    <Text style={styles.subtitle}>اختر طريقة الدفع</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Debt Info */}
              <View style={styles.debtInfo}>
                <View style={styles.debtInfoRow}>
                  <Text style={styles.debtInfoLabel}>الدائن:</Text>
                  <Text style={styles.debtInfoValue}>{debt.debtorName}</Text>
                </View>
                <View style={styles.debtInfoRow}>
                  <Text style={styles.debtInfoLabel}>المبلغ المتبقي:</Text>
                  <Text style={[styles.debtInfoValue, styles.remainingAmount]}>
                    {formatCurrency(debt.remainingAmount)}
                  </Text>
                </View>
              </View>

              {/* Payment Type Selection */}
              <View style={styles.paymentTypeContainer}>
                <TouchableOpacity
                  onPress={handlePayAll}
                  style={[
                    styles.paymentTypeButton,
                    paymentType === 'all' && styles.paymentTypeButtonActive,
                  ]}
                  activeOpacity={0.7}
                >
                  {paymentType === 'all' ? (
                    <LinearGradient
                      colors={['#10B981', '#059669'] as any}
                      style={styles.paymentTypeGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.paymentTypeTextActive}>دفع الكامل</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.paymentTypeDefault}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.textSecondary} />
                      <Text style={styles.paymentTypeText}>دفع الكامل</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePayPartial}
                  style={[
                    styles.paymentTypeButton,
                    paymentType === 'partial' && styles.paymentTypeButtonActive,
                  ]}
                  activeOpacity={0.7}
                >
                  {paymentType === 'partial' ? (
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB'] as any}
                      style={styles.paymentTypeGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="cash" size={20} color="#FFFFFF" />
                      <Text style={styles.paymentTypeTextActive}>دفع جزئي</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.paymentTypeDefault}>
                      <Ionicons name="cash-outline" size={20} color={theme.colors.textSecondary} />
                      <Text style={styles.paymentTypeText}>دفع جزئي</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Amount Input - Only show for partial payment */}
              {paymentType === 'partial' && (
                <View style={styles.amountContainer}>
                  <Text style={styles.amountLabel}>المبلغ المدفوع</Text>
                  <View style={styles.amountInputWrapper}>
                    <TextInput
                      value={amount}
                      onChangeText={(val) => setAmount(convertArabicToEnglish(val))}
                      placeholder="0.00"
                      keyboardType="numeric"
                      style={styles.amountInput}
                      placeholderTextColor={theme.colors.textMuted}
                    />
                    <Text style={styles.currencyText}>
                      {debt.currency || currencyCode}
                    </Text>
                  </View>
                  {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                    <View style={styles.amountInfo}>
                      <Text style={styles.amountInfoText}>
                        المبلغ المتبقي بعد الدفع:{' '}
                        <Text style={styles.amountInfoValue}>
                          {formatCurrency(Math.max(0, debt.remainingAmount - Number(amount)))}
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>
              )}

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
                  onPress={handlePay}
                  disabled={loading || (paymentType === 'partial' && (!amount || Number(amount) <= 0))}
                  style={[
                    styles.payButton,
                    (loading || (paymentType === 'partial' && (!amount || Number(amount) <= 0))) && styles.payButtonDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669'] as any}
                    style={styles.payButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <>
                        <Ionicons name="hourglass-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.payButtonText}>جاري الدفع...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.payButtonText}>
                          {paymentType === 'all' ? 'دفع الكامل' : 'دفع'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Pressable>
        </Pressable>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  modalGradient: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  headerLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : theme.spacing.md,
    marginLeft: isRTL ? theme.spacing.md : 0,
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
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  debtInfo: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  debtInfoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtInfoLabel: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  debtInfoValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  remainingAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#EF4444',
  },
  paymentTypeContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  paymentTypeButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  paymentTypeButtonActive: {
    ...getPlatformShadow('md'),
  },
  paymentTypeGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  paymentTypeDefault: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  paymentTypeText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  paymentTypeTextActive: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  amountContainer: {
    marginBottom: theme.spacing.lg,
  },
  amountLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
  },
  amountInputWrapper: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  amountInput: {
    flex: 1,
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    paddingVertical: theme.spacing.md,
    textAlign: 'right',
  },
  currencyText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginLeft: isRTL ? 0 : theme.spacing.sm,
    marginRight: isRTL ? theme.spacing.sm : 0,
  },
  amountInfo: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.sm,
  },
  amountInfoText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  amountInfoValue: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  payButton: {
    flex: 2,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  payButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
