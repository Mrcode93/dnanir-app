import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, AppTheme, getPlatformFontWeight, getPlatformShadow } from '../utils/theme';
import { AppBottomSheet, AppButton } from '../design-system';
import { useWallets } from '../context/WalletContext';
import { useCurrency } from '../hooks/useCurrency';
import { RecurringExpense, Bill } from '../database/database';
import { tl } from '../localization';

interface PayBillModalProps {
  visible: boolean;
  onClose: () => void;
  bill: RecurringExpense | Bill | null;
  onPay: (walletId: number) => void;
  loading?: boolean;
}

export const PayBillModal: React.FC<PayBillModalProps> = ({
  visible,
  onClose,
  bill,
  onPay,
  loading = false,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { wallets } = useWallets();
  const { formatCurrency } = useCurrency();
  const [selectedWalletId, setSelectedWalletId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (visible && wallets.length > 0 && bill) {
      // Prefer the bill's assigned wallet, fallback to default
      const walletId = (bill as any).walletId;
      const initialWallet = wallets.find(w => w.id === walletId) || wallets.find(w => w.isDefault) || wallets[0];
      setSelectedWalletId(initialWallet?.id);
    }
  }, [visible, bill, wallets]);

  if (!bill) return null;

  const handlePay = () => {
    if (selectedWalletId !== undefined) {
      onPay(selectedWalletId);
    }
  };

  const selectedWallet = wallets.find(w => w.id === selectedWalletId);

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={tl("دفع فاتورة")}
    >
      <View style={styles.container}>
        <View style={styles.billContent}>
          <Text style={styles.billTitle}>{bill.title}</Text>
          <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
        </View>

        <View style={styles.walletSection}>
          <Text style={styles.sectionLabel}>{tl("اختر المحفظة للدفع")}</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.walletList}
          >
            {wallets.map(wallet => {
              const isSelected = selectedWalletId === wallet.id;
              return (
                <TouchableOpacity
                  key={wallet.id}
                  style={[
                    styles.walletChip,
                    isSelected && { borderColor: wallet.color || theme.colors.primary, backgroundColor: (wallet.color || theme.colors.primary) + '10' }
                  ]}
                  onPress={() => setSelectedWalletId(wallet.id)}
                >
                  <Ionicons 
                    name={wallet.icon as any || 'wallet'} 
                    size={18} 
                    color={isSelected ? (wallet.color || theme.colors.primary) : theme.colors.textSecondary} 
                  />
                  <Text style={[
                    styles.walletName,
                    isSelected && { color: wallet.color || theme.colors.primary, fontWeight: 'bold' }
                  ]}>{wallet.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedWallet && (
            <View style={[styles.balanceInfo, { backgroundColor: (selectedWallet.color || theme.colors.primary) + '05', borderColor: (selectedWallet.color || theme.colors.primary) + '20' }]}>
              <View style={[styles.walletIndicator, { backgroundColor: selectedWallet.color || theme.colors.primary }]} />
              <Text style={styles.balanceText}>
                {tl("الرصيد الحالي:")} {formatCurrency(selectedWallet.balance || 0)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <AppButton 
            label={tl("تأكيد الدفع")} 
            onPress={handlePay} 
            variant="primary" 
            loading={loading}
            disabled={!selectedWalletId || loading}
          />
          <AppButton 
            label={tl("إلغاء")} 
            onPress={onClose} 
            variant="ghost" 
          />
        </View>
      </View>
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    padding: theme.spacing.md,
  },
  billContent: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.lg,
  },
  billTitle: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  billAmount: {
    fontSize: theme.typography.sizes.display,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  walletSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'right',
  },
  walletList: {
    flexDirection: 'row-reverse',
    gap: 12,
    paddingBottom: 4,
  },
  walletChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 8,
    minWidth: 100,
  },
  walletName: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  balanceInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  walletIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  balanceText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  actions: {
    gap: 12,
  },
});
