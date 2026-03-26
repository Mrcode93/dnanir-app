import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Keyboard, ActivityIndicator, FlatList } from 'react-native';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TextInput } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { CURRENCIES } from '../types';
import { transferBetweenWallets } from '../database/database';
import { alertService } from '../services/alertService';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { ScreenContainer, AppHeader, AppButton } from '../design-system';
import { tl, useLocalization } from "../localization";
import { useWallets } from '../context/WalletContext';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';

interface TransferAmountScreenProps {
  navigation: any;
  route: any;
}

export const TransferAmountScreen: React.FC<TransferAmountScreenProps> = ({ navigation, route }) => {
  const { language } = useLocalization();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, formatCurrency } = useCurrency();
  const { wallets, refreshWallets } = useWallets();

  const amountInputRef = useRef<any>(null);

  // State
  const [amount, setAmount] = useState('');
  const [fromWalletId, setFromWalletId] = useState<number | null>(route.params?.fromWalletId || null);
  const [toWalletId, setToWalletId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<string>(currencyCode);

  // UI State
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    if (!fromWalletId && wallets.length > 0) {
      setFromWalletId(wallets[0].id);
    }
    if (wallets.length > 1 && !toWalletId) {
      const secondWallet = wallets.find(w => w.id !== fromWalletId) || wallets[1];
      setToWalletId(secondWallet.id);
    }
  }, [wallets]);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleSave = async () => {
    if (!fromWalletId || !toWalletId) {
      alertService.warning(tl("تنبيه"), tl("يرجى اختيار المحافظ"));
      return;
    }

    if (fromWalletId === toWalletId) {
      alertService.warning(tl("تنبيه"), tl("لا يمكن التحويل لنفس المحفظة"));
      return;
    }

    const cleanAmount = amount.replace(/,/g, '');
    const numAmount = Number(cleanAmount);
    if (!cleanAmount.trim() || isNaN(numAmount) || numAmount <= 0) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مبلغ صحيح"));
      return;
    }

    const fromWallet = wallets.find(w => w.id === fromWalletId);
    if (!fromWallet) {
      alertService.error(tl("خطأ"), tl("المحفظة غير موجودة"));
      return;
    }

    setLoading(true);
    try {
      // Validate balance
      const fromWalletCurrency = fromWallet.currency || currencyCode;
      const convertedAmount = currency === fromWalletCurrency
        ? numAmount
        : await convertCurrency(numAmount, currency, fromWalletCurrency);

      if (convertedAmount > fromWallet.balance) {
        alertService.warning(
          tl("الرصيد غير كافٍ"),
          tl("لا يمكنك تحويل مبلغ أكبر من رصيد المحفظة الحالي ({{}})", [formatCurrencyAmount(fromWallet.balance, fromWalletCurrency)])
        );
        setLoading(false);
        return;
      }

      await transferBetweenWallets({
        fromWalletId,
        toWalletId,
        amount: numAmount,
        date: date.toISOString().split('T')[0],
        description: description.trim(),
        currency: currency
      });

      alertService.toastSuccess(tl("تم التحويل بنجاح"));
      await refreshWallets();
      handleClose();
    } catch (e: any) {
      alertService.error(tl("خطأ"), e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderWalletSelector = (label: string, selectedId: number | null, onSelect: (id: number) => void) => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <FlatList
        data={wallets}
        horizontal
        inverted={isRTL}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item: w }) => {
          const isSelected = selectedId === w.id;
          return (
            <TouchableOpacity
              style={[
                styles.walletChip,
                isSelected && { borderColor: w.color || theme.colors.primary, backgroundColor: (w.color || theme.colors.primary) + '15' }
              ]}
              onPress={() => onSelect(w.id)}
            >
              <Ionicons
                name={(w.icon as any) || 'wallet'}
                size={16}
                color={isSelected ? (w.color || theme.colors.primary) : theme.colors.textSecondary}
              />
              <View>
                <Text style={[
                  styles.walletChipText,
                  isSelected && { color: w.color || theme.colors.primary, fontWeight: 'bold' }
                ]}>
                  {w.name}
                </Text>
                <Text style={[
                  styles.walletChipBalance,
                  isSelected && { color: (w.color || theme.colors.primary) + '90' }
                ]}>
                  {formatCurrencyAmount(w.balance, w.currency || currencyCode)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        keyExtractor={w => w.id.toString()}
      />
    </View>
  );

  return (
    <ScreenContainer scrollable edges={[]}>
      <AppHeader title={tl("تحويل مالي")} backIcon="close" onBack={handleClose} />

      {/* Amount Section */}
      <View style={styles.amountSection}>
        <Text style={styles.currencySymbol}>{CURRENCIES.find(c => c.code === currency)?.symbol}</Text>
        <TextInput
          ref={amountInputRef}
          value={amount}
          onChangeText={v => {
            const cleaned = convertArabicToEnglish(v);
            setAmount(formatNumberWithCommas(cleaned));
          }}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted + '80'}
          style={styles.amountInput}
          keyboardType="decimal-pad"
          selectionColor={theme.colors.primary}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
        />
      </View>

      <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={styles.currencyPill}>
        <Text style={styles.currencyPillText}>{currency}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.card}>
        {renderWalletSelector(tl("من محفظة"), fromWalletId, setFromWalletId)}
        <View style={styles.transferIconRow}>
          <View style={styles.transferDivider} />
          <View style={styles.transferIconBadge}>
            <Ionicons name="arrow-down" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.transferDivider} />
        </View>
        {renderWalletSelector(tl("إلى محفظة"), toWalletId, setToWalletId)}

        <View style={styles.divider} />

        {/* Date */}
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.fieldText}>
            {date.toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Description */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput
            placeholder={tl("ملاحظات (اختياري)...")}
            value={description}
            onChangeText={setDescription}
            style={[styles.fieldInput]}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 20 }}>
        <AppButton
          label={tl("تأكيد التحويل")}
          onPress={handleSave}
          variant="primary"
          size="lg"
          loading={loading}
          disabled={loading}
        />
      </View>

      {/* Modals */}
      {showDatePicker && (
        <CustomDatePicker
          value={date}
          onChange={(_, d) => {
            if (d) setDate(d);
            if (Platform.OS === 'android') setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selectedCurrency={currency}
        onSelect={code => {
          setCurrency(code);
          setShowCurrencyPicker(false);
        }}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  amountSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textSecondary,
    marginHorizontal: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily
  },
  amountInput: {
    fontSize: theme.typography.sizes.display,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    textAlign: 'center',
    minWidth: 100,
    padding: 0,
    height: 60
  },
  currencyPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
    gap: 4,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('sm')
  },
  currencyPillText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600')
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...getPlatformShadow('sm')
  },
  section: {
    marginBottom: 16
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    textAlign: isRTL ? 'right' : 'left'
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    gap: 8,
  },
  walletChipText: {
    fontSize: 14,
    color: '#666',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  walletChipBalance: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  transferIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 10
  },
  transferDivider: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.5
  },
  transferIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15
  },
  fieldRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    height: 50,
    padding: 0
  },
  fieldText: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
    marginLeft: 44
  }
});
