/**
 * ScreenContainer — unified screen wrapper.
 *
 * Combines SafeAreaView + KeyboardAvoidingView + ScrollView + a sticky footer
 * slot that always stays above the keyboard and the home-indicator.
 *
 * Usage:
 *   <ScreenContainer
 *     footer={<AppButton label="حفظ" onPress={save} />}
 *   >
 *     {formContent}
 *   </ScreenContainer>
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../utils/theme-context';
import { SPACING } from '../../tokens';

type SafeEdge = 'top' | 'bottom' | 'left' | 'right';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Element rendered below the scroll area — always visible above keyboard */
  footer?: React.ReactNode;
  /** Whether to wrap children in a ScrollView. Default: true */
  scrollable?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** SafeAreaView edges. Default: ['top', 'left', 'right'] */
  edges?: SafeEdge[];
  /** Extra bottom padding inside scroll content. Default: 16 */
  scrollPadBottom?: number;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  footer,
  scrollable = true,
  style,
  contentStyle,
  edges = ['top', 'left', 'right'],
  scrollPadBottom = 16,
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }, style]}
      edges={edges}
    >
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scrollable ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: scrollPadBottom },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, contentStyle]}>{children}</View>
        )}

        {footer ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: theme.colors.background,
                paddingBottom: Math.max(insets.bottom, SPACING.md),
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {},
  footer: {
    paddingHorizontal: SPACING.screenH,
    paddingTop: SPACING.sm,
  },
});
