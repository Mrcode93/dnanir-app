import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, useAppTheme, useThemedStyles } from '../utils/theme';
import { CURRENCIES } from '../types';

interface CurrencyPickerModalProps {
  visible: boolean;
  selectedCurrency: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export const CurrencyPickerModal: React.FC<CurrencyPickerModalProps> = ({
  visible,
  selectedCurrency,
  onSelect,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
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
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    flexDirection: 'row-reverse',
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
