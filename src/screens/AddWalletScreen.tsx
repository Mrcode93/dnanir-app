import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { alertService } from '../services/alertService';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, AppHeader, AppButton, AppInput } from '../design-system';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { useWallets } from '../context/WalletContext';
import { Wallet, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { type AppTheme, getPlatformFontWeight, getPlatformShadow } from '../utils/theme-constants';
import { authStorage } from '../services/authStorage';
import { tl, useLocalization } from "../localization";
import { IconPickerModal } from '../components/IconPickerModal';

const WALLET_ICONS = ['wallet', 'card', 'cash', 'briefcase', 'gift', 'cart', 'home', 'car'];
const WALLET_COLORS = ['#0B5A7A', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#6366F1'];

export const AddWalletScreen = ({ navigation, route }: any) => {
  useLocalization();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { addWallet, updateWallet } = useWallets();
  const editingWallet = route.params?.wallet as Wallet | undefined;

  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('wallet');
  const [selectedColor, setSelectedColor] = useState(WALLET_COLORS[0]);
  const [isIconPickerVisible, setIsIconPickerVisible] = useState(false);
  const [currency, setCurrency] = useState('IQD');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingWallet) {
      setName(editingWallet.name);
      setBalance(editingWallet.balance.toString());
      setSelectedIcon(editingWallet.icon || 'wallet');
      setSelectedColor(editingWallet.color || WALLET_COLORS[0]);
      setCurrency(editingWallet.currency || 'IQD');
    }
  }, [editingWallet]);

  // Pro gate — adding wallets is restricted to Pro subscribers
  useEffect(() => {
    if (editingWallet) return; // Editing an existing wallet is allowed for all
    let cancelled = false;
    authStorage.getUser<{ isPro?: boolean }>().then(user => {
      if (cancelled) return;
      const isPro = !!user?.isPro;
      if (!isPro) {
        alertService.show({
          title: tl("اشتراك مميز"),
          message: tl("إضافة محافظ جديدة متاحة للمشتركين المميزين فقط. قم بترقية حسابك للاستفادة من هذه الميزة."),
          type: 'warning',
          confirmText: tl("حسناً"),
          onConfirm: () => navigation.goBack(),
        });
        navigation.goBack();
      }
    });
    return () => { cancelled = true; };
  }, [editingWallet, navigation]);

  const handleSave = async () => {
    if (!name.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال اسم المحفظة"));
      return;
    }

    setLoading(true);
    const walletData = {
      name: name.trim(),
      balance: parseFloat(balance) || 0,
      icon: selectedIcon,
      currency: currency,
      color: selectedColor,
      isDefault: editingWallet?.isDefault || false,
      createdAt: editingWallet?.createdAt || new Date().toISOString(),
    };

    try {
      if (editingWallet) {
        await updateWallet(editingWallet.id, walletData);
        alertService.toastSuccess(tl("تم تحديث المحفظة بنجاح"));
      } else {
        await addWallet(walletData);
        alertService.toastSuccess(tl("تم إضافة المحفظة بنجاح"));
      }
      navigation.goBack();
    } catch (error: any) {
      alertService.error(tl("خطأ"), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    navigation.goBack();
  };

  return (
    <ScreenContainer scrollable={false} edges={[]} style={styles.container}>
      <AppHeader 
        title={editingWallet ? tl("تعديل المحفظة") : tl("إضافة محفظة جديدة")} 
        onBack={handleBack}
        backIcon="close"
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.formSection}>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{tl("اسم المحفظة")}</Text>
            <AppInput
              value={name}
              onChangeText={setName}
              placeholder={tl("أدخل اسم المحفظة")}
              containerStyle={styles.inputContainer}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{tl("الأيقونة")}</Text>
            <TouchableOpacity 
              onPress={() => setIsIconPickerVisible(true)}
              style={[styles.pickerButton, { borderColor: selectedColor + '40', backgroundColor: selectedColor + '05' }]}
              activeOpacity={0.7}
            >
              <View style={[styles.pickerIconCircle, { backgroundColor: selectedColor }]}>
                <Ionicons name={selectedIcon as any} size={28} color="#FFF" />
              </View>
              <View style={styles.pickerTextContainer}>
                <Text style={styles.pickerLabel}>{tl("تغيير الأيقونة")}</Text>
                <Text style={styles.pickerSub}>{tl("أكثر من 50 أيقونة متاحة")}</Text>
              </View>
              <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{tl("اللون")}</Text>
            <View style={styles.colorGrid}>
              {WALLET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorItem,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorItemSelected
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Ionicons name="checkmark" size={24} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginTop: 12 }]}>{tl("العملة")}</Text>
            <View style={styles.currencyGrid}>
              {CURRENCIES.slice(0, 8).map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.currencyItem,
                    { borderColor: theme.colors.border },
                    currency === c.code && { ...styles.currencyItemSelected, borderColor: selectedColor, backgroundColor: selectedColor + '10' }
                  ]}
                  onPress={() => setCurrency(c.code)}
                >
                  <Text style={[styles.currencySymbol, currency === c.code && { color: selectedColor }]}>{c.symbol}</Text>
                  <Text style={[styles.currencyCode, currency === c.code && { color: selectedColor }]}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            label={editingWallet ? tl("تعديل") : tl("إضافة")}
            onPress={handleSave}
            loading={loading}
            disabled={loading}
          />
        </View>
      </KeyboardAvoidingView>

      <IconPickerModal
        visible={isIconPickerVisible}
        selectedIcon={selectedIcon}
        onSelect={setSelectedIcon}
        onClose={() => setIsIconPickerVisible(false)}
      />
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  formSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    marginBottom: 8,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  inputContainer: {
    marginBottom: 20,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 24,
    gap: 16,
  },
  pickerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('sm'),
  },
  pickerTextContainer: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  pickerSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  colorGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
    justifyContent: 'center',
  },
  colorItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorItemSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
    ...getPlatformShadow('md'),
  },
  currencyGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  currencyItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 65,
  },
  currencyItemSelected: {
    borderWidth: 2,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#6B7280',
  },
  currencyCode: {
    fontSize: 10,
    fontWeight: getPlatformFontWeight('600'),
    color: '#9CA3AF',
    marginTop: 2,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
});
