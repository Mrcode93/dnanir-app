import React from 'react';
import {
  Platform,
  TouchableOpacity,
  TouchableNativeFeedback,
  View,
  TouchableOpacityProps,
  TouchableNativeFeedbackProps,
} from 'react-native';

type PlatformTouchableProps = TouchableOpacityProps & {
  /**
   * Android ripple color. Defaults to a subtle dark ripple.
   * Pass `null` to disable ripple on Android and fall back to opacity.
   */
  rippleColor?: string | null;
  children: React.ReactNode;
};

/**
 * Cross-platform touchable:
 * - Android: renders TouchableNativeFeedback with a Material ripple effect.
 * - iOS:     renders TouchableOpacity with the standard opacity fade.
 *
 * Usage:
 *   <PlatformTouchable onPress={handlePress} style={styles.button}>
 *     <Text>Press me</Text>
 *   </PlatformTouchable>
 */
export const PlatformTouchable: React.FC<PlatformTouchableProps> = ({
  children,
  rippleColor = 'rgba(0, 0, 0, 0.12)',
  style,
  ...props
}) => {
  if (Platform.OS === 'android' && rippleColor !== null) {
    return (
      <TouchableNativeFeedback
        {...(props as TouchableNativeFeedbackProps)}
        background={TouchableNativeFeedback.Ripple(rippleColor, false)}
      >
        <View style={style}>{children}</View>
      </TouchableNativeFeedback>
    );
  }

  return (
    <TouchableOpacity style={style} {...props}>
      {children}
    </TouchableOpacity>
  );
};
