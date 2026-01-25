import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { CURRENCIES, Currency } from '../types';
import { convertCurrency, getOrFetchExchangeRate, formatCurrencyAmount } from '../services/currencyService';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';

export const CurrencyConverterScreen = ({ navigation }: any) => {
  const { currencyCode, formatCurrency } = useCurrency();
  const [fromCurrency, setFromCurrency] = useState<string>(currencyCode);
  const [toCurrency, setToCurrency] = useState<string>('USD');
  const [amount, setAmount] = useState<string>('');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  useEffect(() => {
    setFromCurrency(currencyCode);
    setAmount('');
    setConvertedAmount(null);
    setExchangeRate(null);
  }, [currencyCode]);

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      });
    }
    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceCard,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
            elevation: 8,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            flexDirection: 'row',
            display: 'flex',
          },
          tabBarShowLabel: true,
        });
      }
    };
  }, [navigation]);

  useEffect(() => {
    if (amount && fromCurrency && toCurrency && parseFloat(amount) > 0) {
      handleConvert();
    } else {
      setConvertedAmount(null);
      setExchangeRate(null);
    }
  }, [amount, fromCurrency, toCurrency]);

  const handleConvert = async () => {
    const numAmount = parseFloat(amount);
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
      console.error('Error converting currency:', error);
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
      setAmount(convertedAmount.toString());
      setConvertedAmount(parseFloat(amount));
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* From Currency Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>من</Text>
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
                <View style={styles.currencySelectorContent}>
                  <View style={styles.currencyIconContainer}>
                    <Ionicons name="cash" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencyCode}>{fromCurrency}</Text>
                    <Text style={styles.currencyName} numberOfLines={1}>{fromCurrencyData?.name}</Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>{fromCurrencyData?.symbol}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="decimal-pad"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
          </View>

          {/* Swap Button */}
          <View style={styles.swapButtonContainer}>
            <TouchableOpacity
              onPress={swapCurrencies}
              style={styles.swapButton}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.swapButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="swap-vertical" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* To Currency Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>إلى</Text>
            <TouchableOpacity
              onPress={() => setShowToPicker(true)}
              style={styles.currencySelector}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.currencySelectorGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.currencySelectorContent}>
                  <View style={styles.currencyIconContainer}>
                    <Ionicons name="cash" size={16} color="#FFFFFF" />
                  </View>
                  <View style={styles.currencyInfo}>
                    <Text style={styles.currencyCode}>{toCurrency}</Text>
                    <Text style={styles.currencyName} numberOfLines={1}>{toCurrencyData?.name}</Text>
                  </View>
                  <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={18} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.resultContainer}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>جاري التحويل...</Text>
                </View>
              ) : convertedAmount !== null ? (
                <>
                  <Text style={styles.convertedAmount}>
                    {formatCurrencyAmount(convertedAmount, toCurrency)}
                  </Text>
                  {exchangeRate !== null && exchangeRate !== 1 && (
                    <View style={styles.rateInfo}>
                      <View style={styles.rateInfoContainer}>
                        <Ionicons name="trending-up" size={16} color={theme.colors.primary} />
                        <Text style={styles.exchangeRateText}>
                          1 {fromCurrency} = {exchangeRate.toFixed(4)} {toCurrency}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.placeholderText}>0.00</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
    </SafeAreaView>
  );
};

interface CurrencyPickerModalProps {
  visible: boolean;
  selectedCurrency: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

const CurrencyPickerModal: React.FC<CurrencyPickerModalProps> = ({
  visible,
  selectedCurrency,
  onSelect,
  onClose,
}) => {
  return (
    <View style={styles.pickerModalContainer} pointerEvents={visible ? 'auto' : 'none'}>
      {visible && (
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.pickerContainer}>
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.pickerGradient}
            >
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>اختر العملة</Text>
                <TouchableOpacity onPress={onClose} style={styles.pickerCloseButton}>
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerScrollView}>
                {CURRENCIES.map((currency) => (
                  <TouchableOpacity
                    key={currency.code}
                    onPress={() => onSelect(currency.code)}
                    style={[
                      styles.pickerItem,
                      selectedCurrency === currency.code && styles.pickerItemSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerItemContent}>
                      <Text style={styles.pickerItemCode}>{currency.code}</Text>
                      <Text style={styles.pickerItemName}>{currency.name}</Text>
                    </View>
                    {selectedCurrency === currency.code && (
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </LinearGradient>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('sm'),
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: isRTL ? 'right' : 'left',
  },
  currencySelector: {
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
    ...getPlatformShadow('sm'),
  },
  currencySelectorGradient: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  currencySelectorContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(isRTL ? { marginLeft: theme.spacing.xs } : { marginRight: theme.spacing.xs }),
  },
  currencyInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  currencyCode: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 1,
  },
  currencyName: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
  },
  amountInputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  amountInput: {
    flex: 1,
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    paddingVertical: 0,
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
    fontFamily: theme.typography.fontFamily,
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
  },
  swapButton: {
    borderRadius: 25,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  swapButtonGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContainer: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  convertedAmount: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  rateInfo: {
    width: '100%',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  rateInfoContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    ...(isRTL ? { marginRight: 0 } : { marginLeft: 0 }),
  },
  exchangeRateText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
  },
  placeholderText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    opacity: 0.3,
  },
  pickerModalContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    maxHeight: '60%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  pickerGradient: {
    maxHeight: '100%',
  },
  pickerHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  pickerCloseButton: {
    padding: theme.spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerScrollView: {
    maxHeight: 350,
  },
  pickerItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.surfaceLight,
  },
  pickerItemContent: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  pickerItemCode: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  pickerItemName: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
});
