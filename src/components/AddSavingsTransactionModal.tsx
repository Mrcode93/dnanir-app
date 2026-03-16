import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';

import { Savings, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { AppDialog, AppButton } from '../design-system';

interface AddSavingsTransactionModalProps {
  visible: boolean;
  savings: Savings | null;
  onClose: () => void;
  onConfirm: (amount: number, type: 'deposit' | 'withdrawal') => Promise<void>;
}

export const AddSavingsTransactionModal: React.FC<AddSavingsTransactionModalProps> = ({
  visible,
  savings,
  onClose,
  onConfirm,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setType('deposit');
      setLoading(false);
    }
  }, [visible]);

  if (!savings) return null;

  const handleConfirm = async () => {
    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      return;
    }

    setLoading(true);
    try {
      await onConfirm(Number(cleanAmount), type);
      onClose();
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      onClose={onClose}
      title={type === 'deposit' ? 'إضافة مبلغ' : 'سحب مبلغ'}
      subtitle={savings.title}
    >
      <View style={styles.typeSelector}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'deposit' && styles.typeBtnActive, { borderColor: theme.colors.success }]}
          onPress={() => setType('deposit')}
        >
          <Ionicons name="arrow-down-circle" size={20} color={type === 'deposit' ? '#FFFFFF' : theme.colors.success} />
          <Text style={[styles.typeText, type === 'deposit' && styles.typeTextActive, { color: type === 'deposit' ? '#FFFFFF' : theme.colors.success }]}>إيداع</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'withdrawal' && styles.typeBtnActive, { borderColor: theme.colors.error, backgroundColor: type === 'withdrawal' ? theme.colors.error : 'transparent' }]}
          onPress={() => setType('withdrawal')}
        >
          <Ionicons name="arrow-up-circle" size={20} color={type === 'withdrawal' ? '#FFFFFF' : theme.colors.error} />
          <Text style={[styles.typeText, type === 'withdrawal' && styles.typeTextActive, { color: type === 'withdrawal' ? '#FFFFFF' : theme.colors.error }]}>سحب</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={(val) => {
            const cleaned = convertArabicToEnglish(val);
            setAmount(formatNumberWithCommas(cleaned));
          }}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          autoFocus
        />
        <Text style={styles.currency}>
          {CURRENCIES.find(c => c.code === (savings.currency || 'IQD'))?.symbol}
        </Text>
      </View>

      <AppButton
        label={loading ? 'جاري الحفظ...' : 'تأكيد'}
        onPress={handleConfirm}
        variant={type === 'deposit' ? 'success' : 'danger'}
        loading={loading}
        disabled={!amount || loading}
        size="lg"
        style={{ alignSelf: 'stretch' }}
      />
    </AppDialog>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  typeSelector: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  typeBtnActive: {
    backgroundColor: theme.colors.success,
  },
  typeText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  typeTextActive: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    paddingVertical: 16,
    textAlign: 'center',
  },
  currency: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
});
