import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.modalGradient}
          >
            <SafeAreaView edges={['top']} style={styles.safeArea}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>محول العملات</Text>
                <View style={styles.placeholder} />
              </View>

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

                  <View style={styles.amountInputContainer}>
                    <TextInput
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={(val) => {
                        const cleaned = convertArabicToEnglish(val);
                        setAmount(formatNumberWithCommas(cleaned));
                      }}
                      placeholder="0.00"
                      placeholderTextColor={theme.colors.textSecondary}
                      keyboardType="decimal-pad"
                      textAlign="right"
                    />
                    <Text style={styles.currencySymbol}>{fromCurrencyData?.symbol}</Text>
                  </View>
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
            </SafeAreaView>
          </LinearGradient>
        </View>

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
      </KeyboardAvoidingView>
    </Modal>
  );
};


const createStyles = (theme: AppTheme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    width: '100%',
    minHeight: 500,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  amountInput: {
    flex: 1,
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    paddingVertical: theme.spacing.sm,
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
  pickerBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    maxHeight: '70%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  pickerGradient: {
    maxHeight: '100%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  pickerCloseButton: {
    padding: theme.spacing.xs,
  },
  pickerScrollView: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.surfaceLight,
  },
  pickerItemContent: {
    flex: 1,
  },
  pickerItemCode: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  pickerItemName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});
