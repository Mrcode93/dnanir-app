/**
 * SectionCard — unified card container used throughout the app.
 *
 * Usage:
 *   <SectionCard title="الميزانية">
 *     <BudgetContent />
 *   </SectionCard>
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useAppTheme } from '../../../utils/theme-context';
import { getPlatformFontWeight, getPlatformShadow } from '../../../utils/theme-constants';
import { FONT_SIZE, RADIUS, SPACING } from '../../tokens';
import { useLocalization } from '../../../localization';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Remove horizontal screen margin (e.g. full-width cards). Default: false */
  flush?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  children,
  style,
  flush = false,
}) => {
  const { theme } = useAppTheme();
  const { isRTL } = useLocalization();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          marginHorizontal: flush ? 0 : SPACING.screenH,
          ...getPlatformShadow('sm', theme),
        },
        style,
      ]}
    >
      {title ? (
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.fontFamily,
              textAlign: isRTL ? 'right' : 'left',
            },
          ]}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: getPlatformFontWeight('700'),
    marginBottom: SPACING.sm,
  },
});
