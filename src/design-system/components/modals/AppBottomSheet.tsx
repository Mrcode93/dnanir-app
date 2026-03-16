/**
 * AppBottomSheet — unified base for all slide-up modals.
 *
 * Usage:
 *   <AppBottomSheet visible={show} onClose={handleClose} title="عنوان">
 *     {children}
 *     <AppButton label="حفظ" onPress={save} />
 *   </AppBottomSheet>
 */
import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../utils/theme-context';
import { getPlatformFontWeight, getPlatformShadow } from '../../../utils/theme-constants';
import { FONT_SIZE, MODAL, SPACING } from '../../tokens';

interface AppBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height as a percentage string, e.g. '90%'. Default: '92%' */
  maxHeight?: `${number}%`;
  /** Set false to disable keyboard-avoidance (e.g. no inputs inside). Default: true */
  avoidKeyboard?: boolean;
  /** Extra bottom padding (added on top of safe-area inset). Default: 8 */
  bottomPad?: number;
}

export const AppBottomSheet: React.FC<AppBottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  maxHeight = '92%',
  avoidKeyboard = true,
  bottomPad = 8,
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pb = Math.max(insets.bottom, 12) + bottomPad;

  const sheet = (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: theme.colors.surfaceCard,
          paddingBottom: pb,
          maxHeight,
          ...getPlatformShadow('xl', theme),
        },
      ]}
    >
      {/* Drag Handle */}
      <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

      {/* Header */}
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

      {children}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]} />
      </TouchableWithoutFeedback>

      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.kav}
          pointerEvents="box-none"
        >
          {sheet}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.kav} pointerEvents="box-none">
          {sheet}
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: MODAL.sheetRadius,
    borderTopRightRadius: MODAL.sheetRadius,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.screenH,
    overflow: 'hidden',
  },
  handle: {
    width: MODAL.handleWidth,
    height: MODAL.handleHeight,
    borderRadius: MODAL.handleRadius,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
});
