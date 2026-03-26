import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer, AppHeader, AppButton, AppInput } from '../design-system';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { useWallets } from '../context/WalletContext';
import { Wallet } from '../types';
import { isRTL } from '../utils/rtl';
import { type AppTheme, getPlatformFontWeight, getPlatformShadow } from '../utils/theme-constants';
import { tl, useLocalization } from "../localization";

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingWallet) {
      setName(editingWallet.name);
      setBalance(editingWallet.balance.toString());
      setSelectedIcon(editingWallet.icon || 'wallet');
      setSelectedColor(editingWallet.color || WALLET_COLORS[0]);
    }
  }, [editingWallet]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(tl("خطأ"), tl("يرجى إدخال اسم المحفظة"));
      return;
    }

    setLoading(true);
    const walletData = {
      name: name.trim(),
      balance: parseFloat(balance) || 0,
      icon: selectedIcon,
      color: selectedColor,
      isDefault: editingWallet?.isDefault || false,
      createdAt: editingWallet?.createdAt || new Date().toISOString(),
    };

    try {
      if (editingWallet) {
        await updateWallet(editingWallet.id, walletData);
        Alert.alert(tl("نجاح"), tl("تم تحديث المحفظة بنجاح"));
      } else {
        await addWallet(walletData);
        Alert.alert(tl("نجاح"), tl("تم إضافة المحفظة بنجاح"));
      }
      navigation.goBack();
    } catch (error: any) {
      Alert.alert(tl("خطأ"), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    navigation.goBack();
  };

  return (
    <ScreenContainer scrollable={false} style={styles.container}>
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

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{tl("الرصيد الحالي")}</Text>
            <AppInput
              value={balance}
              onChangeText={setBalance}
              placeholder="0.00"
              keyboardType="numeric"
              containerStyle={styles.inputContainer}
            />

            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{tl("الأيقونة")}</Text>
            <View style={styles.iconGrid}>
              {WALLET_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconItem,
                    selectedIcon === icon && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' }
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Ionicons 
                    name={icon as any} 
                    size={24} 
                    color={selectedIcon === icon ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                </TouchableOpacity>
              ))}
            </View>

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
  iconGrid: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
    justifyContent: 'center',
  },
  iconItem: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
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
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
});
