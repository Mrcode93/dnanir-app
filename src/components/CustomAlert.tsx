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

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  confirmText = 'حسناً',
  cancelText = 'إلغاء',
  onConfirm,
  onCancel,
  showCancel = false,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  const getTypeStyle = () => {
    switch (type) {
      case 'success':
        return { bg: theme.colors.success + '15', icon: theme.colors.success, name: 'checkmark-circle' };
      case 'error':
        return { bg: theme.colors.error + '15', icon: theme.colors.error, name: 'close-circle' };
      case 'warning':
        return { bg: theme.colors.warning + '15', icon: theme.colors.warning, name: 'warning' };
      case 'info':
      default:
        return { bg: theme.colors.primary + '15', icon: theme.colors.primary, name: 'information-circle' };
    }
  };

  const typeStyle = getTypeStyle();

  const handleConfirm = async () => {
    if (onConfirm) {
      try {
        await onConfirm();
      } catch (error) {
        // Ignore error
      }
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  if (!visible) return null;

  const confirmVariant = type === 'error' || type === 'warning' ? 'danger' : type === 'success' ? 'success' : 'primary';

  return (
    <AppDialog
      visible={visible}
      onClose={handleCancel}
      title={title}
    >
      <View style={styles.alertContent}>
        {/* Icon Section */}
        <View style={[styles.iconContainer, { backgroundColor: typeStyle.bg }]}>
          <Ionicons name={typeStyle.name as any} size={32} color={typeStyle.icon} />
        </View>

        {/* Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          {showCancel && (
            <AppButton
              label={cancelText}
              onPress={handleCancel}
              variant="secondary"
              style={styles.actionBtnFlex}
            />
          )}
          <AppButton
            label={confirmText}
            onPress={handleConfirm}
            variant={confirmVariant}
            style={showCancel ? styles.actionBtnFlex : styles.actionBtnFull}
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
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
  },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    width: '100%',
    gap: 12,
  },
  actionBtnFlex: {
    flex: 1,
  },
  actionBtnFull: {
    width: '100%',
  },
});
