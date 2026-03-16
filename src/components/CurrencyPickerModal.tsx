import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, useAppTheme, useThemedStyles } from '../utils/theme';
import { CURRENCIES } from '../types';
import { AppBottomSheet } from '../design-system';

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
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title="اختر العملة"
      maxHeight="70%"
    >
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
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    alignItems: 'flex-end',
  },
  pickerItemCode: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'right',
  },
  pickerItemName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
});
