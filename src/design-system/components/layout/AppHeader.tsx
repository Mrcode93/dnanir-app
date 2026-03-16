/**
 * AppHeader — unified in-screen header with back/close button + title + optional action.
 *
 * Usage:
 *   <AppHeader
 *     title="مصروف جديد"
 *     onBack={navigation.goBack}
 *     backIcon="close"
 *   />
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../utils/theme-context';
import { getPlatformFontWeight } from '../../../utils/theme-constants';
import { FONT_SIZE, RADIUS, SPACING } from '../../tokens';
import { isRTL } from '../../../utils/rtl';

interface AppHeaderProps {
  title: string;
  /** Called when back/close button is pressed */
  onBack: () => void;
  /** Icon for the leading button. Default: 'close' */
  backIcon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Optional element rendered on the trailing side */
  action?: React.ReactNode;
  style?: ViewStyle;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  onBack,
  backIcon = 'close',
  action,
  style,
}) => {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.row,
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          borderBottomColor: theme.colors.border,
        },
        style,
      ]}
    >
      {/* Leading button */}
      <TouchableOpacity
        onPress={onBack}
        style={[styles.btn, { backgroundColor: theme.colors.surface }]}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name={backIcon} size={22} color={theme.colors.textPrimary} />
      </TouchableOpacity>

      {/* Title */}
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.textPrimary,
            fontFamily: theme.typography.fontFamily,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>

      {/* Trailing action — invisible spacer when absent to keep title centered */}
      <View style={styles.trailing}>{action ?? null}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  trailing: {
    width: 40,
    alignItems: 'center',
  },
});
