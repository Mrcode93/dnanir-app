import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';

interface AddShortcutModalProps {
  visible: boolean;
  onClose: () => void;
  onExpense: () => void;
  onIncome: () => void;
}

export const AddShortcutModal: React.FC<AddShortcutModalProps> = ({
  visible,
  onClose,
  onExpense,
  onIncome,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 9,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleExpense = () => {
    onClose();
    onExpense();
  };

  const handleIncome = () => {
    onClose();
    onIncome();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[styles.overlayAnimated, { opacity: opacityAnim }]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.content}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '15' }]}>
              <Ionicons name="flash" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>إضافة اختصار</Text>
            <Text style={styles.description}>
              اختر نوع الاختصار ثم أدخل الاسم والفئة والمبلغ في الشاشة التالية واحفظ الاختصار.
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonExpense]}
                onPress={handleExpense}
                activeOpacity={0.8}
              >
                <Ionicons name="remove-circle" size={20} color={theme.colors.error} />
                <Text style={[styles.buttonText, styles.buttonTextExpense]}>مصروف</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonIncome]}
                onPress={handleIncome}
                activeOpacity={0.8}
              >
                <Ionicons name="add-circle" size={20} color={theme.colors.success} />
                <Text style={[styles.buttonText, styles.buttonTextIncome]}>دخل</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonCancel]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonTextCancel}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: 'transparent',
    },
    overlayAnimated: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    card: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: theme.colors.surface,
      ...getPlatformShadow('xl'),
    },
    content: {
      padding: 24,
      alignItems: 'center',
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontFamily: theme.typography.fontFamily,
      fontWeight: getPlatformFontWeight('700'),
      color: theme.colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    description: {
      fontSize: 16,
      fontFamily: theme.typography.fontFamily,
      color: theme.colors.textSecondary,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: 32,
    },
    actions: {
      width: '100%',
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    button: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      flex: 1,
      minWidth: 90,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
    },
    buttonExpense: {
      backgroundColor: theme.colors.error + '18',
    },
    buttonIncome: {
      backgroundColor: theme.colors.success + '18',
    },
    buttonCancel: {
      backgroundColor: theme.colors.surfaceLight,
      flexBasis: '100%',
    },
    buttonText: {
      fontSize: 16,
      fontFamily: theme.typography.fontFamily,
      fontWeight: getPlatformFontWeight('600'),
    },
    buttonTextExpense: {
      color: theme.colors.error,
    },
    buttonTextIncome: {
      color: theme.colors.success,
    },
    buttonTextCancel: {
      fontSize: 16,
      fontFamily: theme.typography.fontFamily,
      fontWeight: getPlatformFontWeight('600'),
      color: theme.colors.textPrimary,
    },
  });
