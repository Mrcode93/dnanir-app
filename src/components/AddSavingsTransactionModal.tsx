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
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { AppDialog, AppButton } from '../design-system';
import { CurrencyPickerModal } from './CurrencyPickerModal';
import { Savings, CURRENCIES } from '../types';

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
  const { currencyCode } = useCurrency();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [loading, setLoading] = useState(false);

  const savingsCurrency = savings?.currency || currencyCode;
  const [selectedCurrency, setSelectedCurrency] = useState(savingsCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  useEffect(() => {
    if (visible && savings) {
      setAmount('');
      setType('deposit');
      setLoading(false);
      setSelectedCurrency(savings.currency || currencyCode);
    }
  }, [visible, savings, currencyCode]);

  useEffect(() => {
    const calculateConverted = async () => {
      const cleanAmount = amount.replace(/,/g, '');
      const numAmount = Number(cleanAmount);
      if (numAmount > 0 && selectedCurrency !== savingsCurrency) {
        try {
          const converted = await convertCurrency(numAmount, selectedCurrency, savingsCurrency);
          setConvertedAmount(converted);
        } catch (error) {
          setConvertedAmount(null);
        }
      } else {
        setConvertedAmount(null);
      }
    };
    calculateConverted();
  }, [amount, selectedCurrency, savingsCurrency]);

  if (!savings) return null;

  const handleConfirm = async () => {
    const cleanAmount = amount.replace(/,/g, '');
    const numAmount = Number(cleanAmount);
    if (!cleanAmount || isNaN(numAmount) || numAmount <= 0) {
      return;
    }
    
    const finalAmount = convertedAmount !== null ? convertedAmount : numAmount;

    setLoading(true);
    try {
      await onConfirm(finalAmount, type);
      onClose();
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const currencyInfo = CURRENCIES.find(c => c.code === selectedCurrency);

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
        <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={styles.currencyButton}>
          <Text style={styles.currency}>
            {currencyInfo?.symbol || selectedCurrency}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.success} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {convertedAmount !== null && selectedCurrency !== savingsCurrency && (
        <Text style={styles.convertedText}>
          ≈ {formatCurrencyAmount(convertedAmount, savingsCurrency)}
        </Text>
      )}

      <AppButton
        label={loading ? 'جاري الحفظ...' : 'تأكيد'}
        onPress={handleConfirm}
        variant={type === 'deposit' ? 'success' : 'danger'}
        loading={loading}
        disabled={!amount || loading}
        size="lg"
        style={{ alignSelf: 'stretch', marginTop: 12 }}
      />
      
      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selectedCurrency={selectedCurrency}
        onSelect={(code) => {
          setSelectedCurrency(code);
          setShowCurrencyPicker(false);
        }}
        onClose={() => setShowCurrencyPicker(false)}
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
  currencyButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.success + '15',
    borderRadius: theme.borderRadius.sm,
  },
  currency: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  convertedText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginTop: -8,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});
