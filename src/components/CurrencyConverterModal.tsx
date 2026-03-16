import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { CURRENCIES, Currency } from '../types';
import { convertCurrency, getOrFetchExchangeRate, formatCurrencyAmount } from '../services/currencyService';
import { useCurrency } from '../hooks/useCurrency';
import { CurrencyPickerModal } from './CurrencyPickerModal';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { usePrivacy } from '../context/PrivacyContext';
import { AppBottomSheet, AppInput } from '../design-system';

interface CurrencyConverterModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CurrencyConverterModal: React.FC<CurrencyConverterModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { selectedCurrency, formatCurrency } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const [fromCurrency, setFromCurrency] = useState<string>(selectedCurrency);
  const [toCurrency, setToCurrency] = useState<string>('USD');
  const [amount, setAmount] = useState<string>('');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setFromCurrency(selectedCurrency);
      setAmount('');
      setConvertedAmount(null);
      setExchangeRate(null);
    }
  }, [visible, selectedCurrency]);

  useEffect(() => {
    const cleanAmount = amount.replace(/,/g, '');
    if (cleanAmount && fromCurrency && toCurrency && parseFloat(cleanAmount) > 0) {
      handleConvert();
    } else {
      setConvertedAmount(null);
      setExchangeRate(null);
    }
  }, [amount, fromCurrency, toCurrency]);

  const handleConvert = async () => {
    const cleanAmount = amount.replace(/,/g, '');
    const numAmount = parseFloat(cleanAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setConvertedAmount(null);
      setExchangeRate(null);
      return;
    }

    if (fromCurrency === toCurrency) {
      setConvertedAmount(numAmount);
      setExchangeRate(1);
      return;
    }

    setLoading(true);
    try {
      const rate = await getOrFetchExchangeRate(fromCurrency, toCurrency);
      const converted = await convertCurrency(numAmount, fromCurrency, toCurrency);

      setExchangeRate(rate);
      setConvertedAmount(converted);
    } catch (error) {

      alertService.error('خطأ', 'حدث خطأ أثناء تحويل العملة');
    } finally {
      setLoading(false);
    }
  };

  const swapCurrencies = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    if (convertedAmount && amount) {
      setAmount(formatNumberWithCommas(convertedAmount));
      setConvertedAmount(parseFloat(amount.replace(/,/g, '')));
    }
  };

  const selectCurrency = (currencyCode: string, type: 'from' | 'to') => {
    if (type === 'from') {
      setFromCurrency(currencyCode);
      setShowFromPicker(false);
    } else {
      setToCurrency(currencyCode);
      setShowToPicker(false);
    }
  };

  const fromCurrencyData = CURRENCIES.find(c => c.code === fromCurrency);
  const toCurrencyData = CURRENCIES.find(c => c.code === toCurrency);

  return (
    <>
      <AppBottomSheet
        visible={visible}
        onClose={onClose}
        title="محول العملات"
        maxHeight="90%"
        avoidKeyboard
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* From Currency */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>من</Text>
            <TouchableOpacity
              onPress={() => setShowFromPicker(true)}
              style={styles.currencySelector}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={theme.gradients.primary as any}
                style={styles.currencySelectorGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyCode}>{fromCurrency}</Text>
                  <Text style={styles.currencyName}>{fromCurrencyData?.name}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            <AppInput
              value={amount}
              onChangeText={(val) => {
                const cleaned = convertArabicToEnglish(val);
                setAmount(formatNumberWithCommas(cleaned));
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              rightAction={
                <Text style={styles.currencySymbol}>{fromCurrencyData?.symbol}</Text>
              }
            />
          </View>

          {/* Swap Button */}
          <TouchableOpacity
            onPress={swapCurrencies}
            style={styles.swapButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={theme.gradients.goalPurple as any}
              style={styles.swapButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="swap-vertical" size={24} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {/* To Currency */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>إلى</Text>
            <TouchableOpacity
              onPress={() => setShowToPicker(true)}
              style={styles.currencySelector}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={theme.gradients.success as any}
                style={styles.currencySelectorGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyCode}>{toCurrency}</Text>
                  <Text style={styles.currencyName}>{toCurrencyData?.name}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.resultContainer}>
              {loading ? (
                <ActivityIndicator size="large" color={theme.colors.primary} />
              ) : convertedAmount !== null ? (
                <>
                  <Text style={styles.convertedAmount}>
                    {isPrivacyEnabled ? '****' : formatCurrencyAmount(convertedAmount, toCurrency)}
                  </Text>
                  {!isPrivacyEnabled && exchangeRate !== null && exchangeRate !== 1 && (
                    <Text style={styles.exchangeRateText}>
                      1 {fromCurrency} = {exchangeRate.toFixed(6)} {toCurrency}
                    </Text>
                  )}
                </>
              ) : (
                <Text style={styles.placeholderText}>0.00</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </AppBottomSheet>

      {/* Currency Picker Modals */}
      {showFromPicker && (
        <CurrencyPickerModal
          visible={showFromPicker}
          selectedCurrency={fromCurrency}
          onSelect={(code) => selectCurrency(code, 'from')}
          onClose={() => setShowFromPicker(false)}
        />
      )}

      {showToPicker && (
        <CurrencyPickerModal
          visible={showToPicker}
          selectedCurrency={toCurrency}
          onSelect={(code) => selectCurrency(code, 'to')}
          onClose={() => setShowToPicker(false)}
        />
      )}
    </>
  );
};


const createStyles = (theme: AppTheme) => StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily,
  },
  currencySelector: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  currencySelectorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  currencyName: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
  },
  swapButton: {
    alignSelf: 'center',
    marginVertical: theme.spacing.md,
    borderRadius: 30,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  swapButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convertedAmount: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  exchangeRateText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    opacity: 0.3,
  },
});
