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
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';

import { Savings, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';

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
      console.error('Error in modal confirm:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.container}
            >
              <View style={styles.modalContent}>
                <View style={styles.header}>
                  <Text style={styles.title}>{type === 'deposit' ? 'إضافة مبلغ' : 'سحب مبلغ'}</Text>
                  <Text style={styles.subtitle}>{savings.title}</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

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

                <TouchableOpacity
                  style={[styles.confirmBtn, (!amount || loading) && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={!amount || loading}
                >
                  <LinearGradient
                    colors={type === 'deposit' ? theme.gradients.success as any : theme.gradients.error as any}
                    style={styles.confirmGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.confirmText}>{loading ? 'جاري الحفظ...' : 'تأكيد'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    ...getPlatformShadow('xl'),
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
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
    backgroundColor: theme.colors.success, // Default, will be overridden for withdrawal
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
  confirmBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
