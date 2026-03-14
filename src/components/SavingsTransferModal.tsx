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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';

import { Savings, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';

interface SavingsTransferModalProps {
  visible: boolean;
  fromSavings: Savings | null;
  allSavings: Savings[];
  onClose: () => void;
  onTransfer: (fromId: number, toId: number, amount: number) => Promise<void>;
}

export const SavingsTransferModal: React.FC<SavingsTransferModalProps> = ({
  visible,
  fromSavings,
  allSavings,
  onClose,
  onTransfer,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [amount, setAmount] = useState('');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setLoading(false);
      // Select first available target that is not the source
      const otherSavings = allSavings.filter(s => s.id !== fromSavings?.id);
      if (otherSavings.length > 0) {
        setTargetId(otherSavings[0].id);
      } else {
        setTargetId(null);
      }
    }
  }, [visible, fromSavings, allSavings]);

  if (!fromSavings) return null;

  const handleConfirm = async () => {
    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0 || !targetId) {
      return;
    }

    setLoading(true);
    try {
      await onTransfer(fromSavings.id, targetId, Number(cleanAmount));
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const otherSavings = allSavings.filter(s => s.id !== fromSavings.id);

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
                  <Text style={styles.title}>تحويل بين الحصالات</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.transferFlow}>
                  <View style={styles.node}>
                    <View style={[styles.iconBox, { backgroundColor: fromSavings.color + '20' }]}>
                      <Ionicons name={(fromSavings.icon || 'wallet') as any} size={24} color={fromSavings.color} />
                    </View>
                    <Text style={styles.nodeTitle} numberOfLines={1}>{fromSavings.title}</Text>
                    <Text style={styles.nodeLabel}>من</Text>
                  </View>

                  <View style={styles.arrowContainer}>
                    <Ionicons name={isRTL ? "arrow-back" : "arrow-forward"} size={24} color={theme.colors.textMuted} />
                  </View>

                  <View style={styles.node}>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.targetList}
                    >
                      {otherSavings.length > 0 ? (
                        otherSavings.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={[
                              styles.targetItem,
                              targetId === s.id && styles.targetItemActive,
                              { borderColor: targetId === s.id ? s.color : theme.colors.border }
                            ]}
                            onPress={() => setTargetId(s.id)}
                          >
                            <View style={[styles.iconBoxSmall, { backgroundColor: s.color + '20' }]}>
                              <Ionicons name={(s.icon || 'wallet') as any} size={18} color={s.color} />
                            </View>
                            <Text style={[styles.targetName, targetId === s.id && { color: s.color }]} numberOfLines={1}>{s.title}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <Text style={styles.noSavingsText}>لا توجد حصالات أخرى</Text>
                      )}
                    </ScrollView>
                    <Text style={styles.nodeLabel}>إلى</Text>
                  </View>
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
                    {CURRENCIES.find(c => c.code === (fromSavings.currency || 'IQD'))?.symbol}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmBtn, (!amount || !targetId || loading) && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={!amount || !targetId || loading}
                >
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.confirmGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.confirmText}>{loading ? 'جاري التحويل...' : 'تأكيد التحويل'}</Text>
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
    maxWidth: 450,
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    ...getPlatformShadow('xl'),
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  title: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  closeBtn: {
    position: 'absolute',
    right: isRTL ? undefined : 0,
    left: isRTL ? 0 : undefined,
    padding: 4,
  },
  transferFlow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
  },
  node: {
    flex: 1,
    alignItems: 'center',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  nodeTitle: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  nodeLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
  },
  arrowContainer: {
    paddingTop: 10,
  },
  targetList: {
    alignItems: 'center',
    gap: 12,
  },
  targetItem: {
    width: 90,
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: theme.colors.surface,
  },
  targetItemActive: {
    backgroundColor: theme.colors.surfaceLight,
  },
  iconBoxSmall: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  targetName: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  noSavingsText: {
    fontSize: 12,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
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
