import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Debt } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { AppBottomSheet, AppButton, AppInput } from '../design-system';
import { formatCurrencyAmount } from '../services/currencyService';
import { useWallets } from '../context/WalletContext';
import { ScrollView } from 'react-native-gesture-handler';

interface PayDebtModalProps {
  visible: boolean;
  debt: Debt | null;
  onClose: () => void;
  onPay: (amount: number, walletId?: number) => Promise<void>;
}

export const PayDebtModal: React.FC<PayDebtModalProps> = ({
  visible,
  debt,
  onClose,
  onPay,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode } = useCurrency();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'all' | 'partial'>('all');
  const { wallets } = useWallets();
  const [selectedWalletId, setSelectedWalletId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (visible && debt) {
      if (paymentType === 'all') {
        setAmount(formatNumberWithCommas(debt.remainingAmount));
      } else {
        setAmount('');
      }
      
      if (wallets.length > 0 && selectedWalletId === undefined) {
        const defaultW = wallets.find(w => w.isDefault) || wallets[0];
        setSelectedWalletId(defaultW?.id);
      }
    }
  }, [visible, debt, paymentType, wallets]);

  const handlePayAll = () => {
    setPaymentType('all');
    if (debt) {
      setAmount(formatNumberWithCommas(debt.remainingAmount));
    }
  };

  const handlePayPartial = () => {
    setPaymentType('partial');
    setAmount('');
  };

  const handlePay = async () => {
    if (!debt) return;

    Keyboard.dismiss();

    const cleanAmount = amount.replace(/,/g, '');
    const paymentAmount = Number(cleanAmount);

    if (!cleanAmount.trim() || isNaN(paymentAmount) || paymentAmount <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    if (paymentAmount > debt.remainingAmount) {
      alertService.warning('تنبيه', `المبلغ المدخل (${formatCurrencyAmount(paymentAmount, debt.currency || 'IQD')}) أكبر من المبلغ المتبقي (${formatCurrencyAmount(debt.remainingAmount, debt.currency || 'IQD')})`);
      return;
    }

    setLoading(true);
    try {
      await onPay(paymentAmount, selectedWalletId);
      setAmount('');
      setPaymentType('all');
      onClose();
    } catch (error) {

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

  const isOwedToMe = debt.direction === 'owed_to_me';
  const modalTitle = isOwedToMe ? 'تسديد (استلام مبلغ)' : 'دفع الدين';
  const debtLabel = isOwedToMe ? 'المدين' : 'الدائن';
  const amountLabel = isOwedToMe ? 'المبلغ المستلم' : 'المبلغ المدفوع';
  const confirmButtonLabel = isOwedToMe
    ? 'تأكيد التسديد'
    : paymentType === 'all'
      ? 'تأكيد الدفع'
      : 'دفع';

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      title={modalTitle}
      avoidKeyboard
    >
      {/* Debt Info */}
      <View style={styles.debtInfo}>
        <View style={styles.debtInfoRow}>
          <Text style={styles.debtInfoLabel}>{debtLabel}</Text>
          <Text style={styles.debtInfoValue} numberOfLines={1}>{debt.debtorName}</Text>
        </View>
        <View style={styles.debtInfoRow}>
          <Text style={styles.debtInfoLabel}>المبلغ المتبقي</Text>
          <Text style={[styles.debtInfoValue, styles.remainingAmount]}>
            {formatCurrencyAmount(debt.remainingAmount, debt.currency || 'IQD')}
          </Text>
        </View>
      </View>

      {/* Payment method section label */}
      <Text style={styles.sectionLabel}>طريقة الدفع</Text>
      <View style={styles.paymentTypeContainer}>
        <AppButton
          label="دفع الكامل"
          onPress={handlePayAll}
          variant={paymentType === 'all' ? 'success' : 'secondary'}
          leftIcon={paymentType === 'all' ? 'checkmark-circle' : 'checkmark-circle-outline'}
          style={styles.paymentTypeButton}
        />

        <AppButton
          label="دفع جزئي"
          onPress={handlePayPartial}
          variant={paymentType === 'partial' ? 'primary' : 'secondary'}
          leftIcon={paymentType === 'partial' ? 'cash' : 'cash-outline'}
          style={styles.paymentTypeButton}
        />
      </View>

      {/* Wallet Selection */}
      {wallets.length > 1 && (
        <>
          <Text style={styles.sectionLabel}>المحفظة المستخدمة</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.walletsContainer}
            style={{ marginBottom: 16 }}
          >
            {wallets.map(wallet => (
              <TouchableOpacity
                key={wallet.id}
                style={[
                  styles.walletChip,
                   selectedWalletId === wallet.id && {
                     borderColor: wallet.color || theme.colors.primary,
                     backgroundColor: (wallet.color || theme.colors.primary) + '10',
                     borderWidth: 2
                   }
                ]}
                onPress={() => setSelectedWalletId(wallet.id)}
              >
                <Ionicons
                  name={wallet.icon as any || 'wallet'}
                  size={18}
                  color={selectedWalletId === wallet.id ? (wallet.color || theme.colors.primary) : theme.colors.textSecondary}
                />
                <Text style={[
                  styles.walletChipText,
                  selectedWalletId === wallet.id && {
                    color: wallet.color || theme.colors.primary,
                    fontWeight: '700'
                  }
                ]}>{wallet.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Amount Input - Only show for partial payment */}
      {paymentType === 'partial' && (
        <View style={styles.amountContainer}>
          <Text style={styles.amountLabel}>{amountLabel}</Text>
          <AppInput
            value={amount}
            onChangeText={(val) => {
              const cleaned = convertArabicToEnglish(val);
              setAmount(formatNumberWithCommas(cleaned));
            }}
            placeholder="0.00"
            keyboardType="numeric"
            rightAction={
              <Text style={styles.currencyText}>
                {debt.currency || currencyCode}
              </Text>
            }
          />
          {amount && !isNaN(Number(amount.replace(/,/g, ''))) && Number(amount.replace(/,/g, '')) > 0 && (
            <View style={styles.amountInfo}>
              <Text style={styles.amountInfoText}>
                المتبقي بعد الدفع:{' '}
                <Text style={styles.amountInfoValue}>
                  {formatCurrencyAmount(Math.max(0, debt.remainingAmount - Number(amount.replace(/,/g, ''))), debt.currency || 'IQD')}
                </Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <AppButton
          label="إلغاء"
          onPress={handleClose}
          variant="secondary"
          style={styles.actionBtnFlex}
        />
        <AppButton
          label={confirmButtonLabel}
          onPress={handlePay}
          variant="success"
          loading={loading}
          disabled={loading || (paymentType === 'partial' && (!amount || Number(amount) <= 0))}
          style={styles.actionBtnConfirm}
        />
      </View>
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  debtInfo: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    gap: 6,
    marginHorizontal: 16,
  },
  debtInfoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  debtInfoLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    minWidth: 90,
  },
  debtInfoValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    textAlign: isRTL ? 'right' : 'left',
  },
  remainingAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.error,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: isRTL ? 'right' : 'left',
    marginHorizontal: 16,
  },
  paymentTypeContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    marginHorizontal: 16,
  },
  paymentTypeButton: {
    flex: 1,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  paymentTypeButtonActive: {
    ...getPlatformShadow('sm'),
  },
  paymentTypeGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  paymentTypeDefault: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  paymentTypeText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  paymentTypeTextActive: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  amountContainer: {
    marginBottom: theme.spacing.sm,
    marginHorizontal: 16,
  },
  amountLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: isRTL ? 'right' : 'left',
  },
  currencyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  amountInfo: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.xs,
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
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingBottom: theme.spacing.sm,
  },
  actionBtnFlex: {
    flex: 1,
  },
  actionBtnConfirm: {
    flex: 1.4,
  },
  walletsContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 4,
  },
  walletChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  walletChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});
