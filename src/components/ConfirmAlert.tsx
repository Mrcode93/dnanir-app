import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { AppButton, AppDialog } from '../design-system';

interface ConfirmAlertProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmAlert: React.FC<ConfirmAlertProps> = ({
  visible,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  onConfirm,
  onCancel,
  type = 'danger',
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const getTypeColors = () => {
    switch (type) {
      case 'danger':
        return { bg: theme.colors.error + '15', icon: theme.colors.error };
      case 'warning':
        return { bg: theme.colors.warning + '15', icon: theme.colors.warning };
      case 'info':
        return { bg: theme.colors.primary + '15', icon: theme.colors.primary };
      default:
        return { bg: theme.colors.error + '15', icon: theme.colors.error };
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'danger': return 'trash-outline';
      case 'warning': return 'alert-outline';
      case 'info': return 'information-circle-outline';
      default: return 'alert-circle-outline';
    }
  };

  const colors = getTypeColors();
  const icon = getTypeIcon();

  const handleConfirmPress = async () => {
    try {
      if (onConfirm) {
        const result = onConfirm();
        if (result instanceof Promise) {
          await result;
        }
      }
    } catch (error) {

    }
  };

  return (
    <AppDialog
      visible={visible}
      onClose={onCancel}
      title={title}
    >
      <View style={styles.alertContent}>
        {/* Icon Section */}
        <View style={[styles.iconContainer, { backgroundColor: colors.bg }]}>
          <Ionicons name={icon as any} size={32} color={colors.icon} />
        </View>

        {/* Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <AppButton
            label={cancelText}
            onPress={onCancel}
            variant="secondary"
            style={styles.actionBtnFlex}
          />
          <AppButton
            label={confirmText}
            onPress={handleConfirmPress}
            variant={type === 'danger' ? 'danger' : type === 'warning' ? 'danger' : 'primary'}
            style={styles.actionBtnFlex}
          />
        </View>
      </View>
    </AppDialog>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  alertContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 24,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    width: '100%',
    gap: 12,
  },
  actionBtnFlex: {
    flex: 1,
  },
});
