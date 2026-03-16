/**
 * AppDialog — unified centered modal (OTP, confirmations, alerts).
 *
 * Usage:
 *   <AppDialog visible={show} onClose={handleClose}
 *     title="رمز التحقق" subtitle="أدخل الرمز المرسل">
 *     <OtpInput ... />
 *     <AppButton label="تحقق" onPress={verify} />
 *   </AppDialog>
 */
import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Text,
  Dimensions,
} from 'react-native';
import { useAppTheme } from '../../../utils/theme-context';
import { getPlatformFontWeight, getPlatformShadow } from '../../../utils/theme-constants';
import { FONT_SIZE, MODAL, SPACING } from '../../tokens';

const { width } = Dimensions.get('window');

interface AppDialogProps {
  visible: boolean;
  /** Called when backdrop is tapped — set to undefined to disable dismiss-on-tap */
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Width as fraction of screen width. Default: 0.88 */
  widthFraction?: number;
}

export const AppDialog: React.FC<AppDialogProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  widthFraction = 0.88,
}) => {
  const { theme } = useAppTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.kavWrapper}
      >
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: theme.colors.overlay },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Dialog Card */}
        <View
          style={[
            styles.card,
            {
              width: width * widthFraction,
              backgroundColor: theme.colors.surfaceCard,
              ...getPlatformShadow('xl', theme),
            },
          ]}
        >
          {title ? (
            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.textPrimary,
                  fontFamily: theme.typography.fontFamily,
                },
              ]}
            >
              {title}
            </Text>
          ) : null}

          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                {
                  color: theme.colors.textSecondary,
                  fontFamily: theme.typography.fontFamily,
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}

          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  kavWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: MODAL.dialogRadius,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
});
