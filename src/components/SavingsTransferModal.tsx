import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';

import { Savings, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { AppBottomSheet, AppButton, AppInput } from '../design-system';

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
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title="تحويل بين الحصالات"
      avoidKeyboard
    >
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
        <AppInput
          value={amount}
          onChangeText={(val) => {
            const cleaned = convertArabicToEnglish(val);
            setAmount(formatNumberWithCommas(cleaned));
          }}
          placeholder="0"
          keyboardType="decimal-pad"
          rightAction={
            <Text style={styles.currency}>
              {CURRENCIES.find(c => c.code === (fromSavings.currency || 'IQD'))?.symbol}
            </Text>
          }
        />
      </View>

      <View style={styles.confirmBtnContainer}>
        <AppButton
          label={loading ? 'جاري التحويل...' : 'تأكيد التحويل'}
          onPress={handleConfirm}
          variant="primary"
          loading={loading}
          disabled={!amount || !targetId || loading}
        />
      </View>
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  transferFlow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 12,
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  currency: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  confirmBtnContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
