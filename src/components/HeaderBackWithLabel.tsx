import React from 'react';
import { Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight } from '../utils/theme-constants';
import { useAppTheme } from '../utils/theme-context';
import { useLocalization } from '../localization';

interface HeaderBackWithLabelProps {
  onBack: () => void;
  label: string;
}

export const HeaderBackWithLabel = ({ onBack, label }: HeaderBackWithLabelProps) => {
  const { isRTL } = useLocalization();
  const { theme } = useAppTheme();
  
  return (
    <TouchableOpacity
      onPress={onBack}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
      }}
      activeOpacity={0.7}
    >
      <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={theme.colors.primary} />
      <Text
        style={{
          fontFamily: theme.typography.fontFamily,
          fontSize: 18,
          fontWeight: getPlatformFontWeight('600'),
          color: theme.colors.textPrimary,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};
