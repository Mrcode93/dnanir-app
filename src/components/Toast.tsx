import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { isRTL } from '../utils/rtl';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Auto-hide timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current);

      // Animate In
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide
      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    } else {
      // If visible becomes false externally
      hideToast();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return { icon: 'checkmark-circle' as const, color: theme.colors.success };
      case 'error':
        return { icon: 'alert-circle' as const, color: theme.colors.error };
      case 'warning':
        return { icon: 'warning' as const, color: theme.colors.warning };
      case 'info':
      default:
        return { icon: 'information-circle' as const, color: theme.colors.primary };
    }
  };

  const config = getToastConfig();

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: Platform.OS === 'ios' ? insets.top + 10 : insets.top + 20,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={hideToast}
        style={styles.touchable}
      >
        <View style={styles.toastCard}>
          {/* Icon Box */}
          <View style={[styles.iconContainer, { backgroundColor: config.color + '15' }]}>
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>

          {/* Message */}
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>

          {/* Close Icon (Optional, subtle) */}
          <Ionicons name="close" size={18} color={theme.colors.textMuted} style={{ opacity: 0.5 }} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const { width } = Dimensions.get('window');

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10002,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  touchable: {
    width: '100%',
    maxWidth: 400, // Tablet friendly
  },
  toastCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface, // Clean white/dark surface
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30, // Pill shape
    ...getPlatformShadow('lg'),
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
});
