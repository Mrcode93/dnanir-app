import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../utils/theme-context';
import { FONT_SIZE, RADIUS, SPACING } from '../../tokens';
import { useLocalization } from '../../../localization';

interface AppInputProps extends TextInputProps {
  /** Ionicons icon name shown on the leading side */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Content shown on the trailing side (e.g. eye toggle, currency pill) */
  rightAction?: React.ReactNode;
  /** Shown below the input when truthy */
  error?: string;
  containerStyle?: ViewStyle;
}

export const AppInput: React.FC<AppInputProps> = ({
  icon,
  rightAction,
  error,
  containerStyle,
  style,
  placeholder,
  placeholderTextColor,
  ...rest
}) => {
  const { theme } = useAppTheme();
  const { isRTL } = useLocalization();

  return (
    <View style={containerStyle}>
      <View
        style={[
          styles.row,
          {
            flexDirection: 'row', // forced RTL app handles this
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.error : theme.colors.border,
          },
        ]}
      >
        {icon && (
          <View
            style={[
              styles.iconBox,
              { backgroundColor: theme.colors.surfaceLight },
            ]}
          >
            <Ionicons name={icon} size={20} color={theme.colors.textSecondary} />
          </View>
        )}
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? theme.colors.textMuted}
          style={[
            styles.input,
            {
              color: theme.colors.textPrimary,
              fontFamily: theme.typography.fontFamily,
              fontSize: FONT_SIZE.md,
              textAlign: isRTL ? 'right' : 'left',
              writingDirection: isRTL ? 'rtl' : 'ltr',
            },
            style,
          ]}
          {...rest}
        />
        {rightAction}
      </View>
      {error ? (
        <Text
          style={[
            styles.errorText,
            {
              color: theme.colors.error,
              fontFamily: theme.typography.fontFamily,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    minHeight: 52,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: 52,
    paddingVertical: 0,
    padding: 0,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    marginTop: SPACING.xs,
    marginHorizontal: SPACING.xs,
  },
});
