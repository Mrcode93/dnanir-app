import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../../utils/theme-context';
import { getPlatformFontWeight } from '../../../utils/theme-constants';
import { BUTTON, FONT_SIZE } from '../../tokens';

export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type AppButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Pass gradient colors to override solid background */
  gradient?: string[];
  /** Ionicons icon name rendered on the left */
  leftIcon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Ionicons icon name rendered on the right */
  rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
}

const HEIGHT: Record<AppButtonSize, number> = {
  sm: BUTTON.heightSm,
  md: BUTTON.heightMd,
  lg: BUTTON.heightLg,
};
const RADIUS: Record<AppButtonSize, number> = {
  sm: BUTTON.radiusSm,
  md: BUTTON.radiusMd,
  lg: BUTTON.radiusLg,
};
const FONT: Record<AppButtonSize, number> = {
  sm: FONT_SIZE.sm,
  md: FONT_SIZE.md,
  lg: FONT_SIZE.lg,
};

export const AppButton: React.FC<AppButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  labelStyle,
  gradient,
  leftIcon,
  rightIcon,
}) => {
  const { theme } = useAppTheme();

  const bgColor: Record<AppButtonVariant, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    danger: theme.colors.error,
    ghost: 'transparent',
    success: theme.colors.success,
  };

  const textColor: Record<AppButtonVariant, string> = {
    primary: '#FFFFFF',
    secondary: theme.colors.textPrimary,
    danger: '#FFFFFF',
    ghost: theme.colors.primary,
    success: '#FFFFFF',
  };

  const h = HEIGHT[size];
  const r = RADIUS[size];
  const f = FONT[size];
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    height: h,
    borderRadius: r,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: isDisabled ? 0.5 : 1,
    borderWidth: variant === 'ghost' ? 1 : 0,
    borderColor: variant === 'ghost' ? theme.colors.primary : undefined,
  };

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;
  const iconColor = textColor[variant];

  const labelEl = loading ? (
    <ActivityIndicator color={textColor[variant]} size="small" />
  ) : (
    <>
      {leftIcon ? <Ionicons name={leftIcon} size={iconSize} color={iconColor} /> : null}
      <Text
        style={[
          {
            fontSize: f,
            fontWeight: getPlatformFontWeight('700'),
            color: textColor[variant],
            fontFamily: theme.typography.fontFamily,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>
      {rightIcon ? <Ionicons name={rightIcon} size={iconSize} color={iconColor} /> : null}
    </>
  );

  if (gradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.85}
        style={[containerStyle, style]}
      >
        <LinearGradient
          colors={gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: r }]}
        />
        {labelEl}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[containerStyle, { backgroundColor: bgColor[variant] }, style]}
    >
      {labelEl}
    </TouchableOpacity>
  );
};
