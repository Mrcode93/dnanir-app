/**
 * AppHeader — unified in-screen header with back/close button + title + optional action.
 *
 * Usage:
 *   <AppHeader
 *     title="مصروف جديد"
 *     onBack={navigation.goBack}
 *     backIcon="close"
 *   />
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../../utils/theme-context';
import { getPlatformFontWeight } from '../../../utils/theme-constants';
import { RADIUS, SPACING } from '../../tokens';
import { useLocalization } from '../../../localization';

interface AppHeaderProps {
  title: string;
  /** Called when back/close button is pressed */
  onBack: () => void;
  /** Icon for the leading button. Default: 'close' */
  backIcon?: React.ComponentProps<typeof Ionicons>['name'];
  /** Optional element rendered on the trailing side */
  action?: React.ReactNode;
  style?: ViewStyle;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  onBack,
  backIcon = 'close',
  action,
  style,
}) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const safeTop = insets.top;

  const displayIcon = backIcon === 'close' ? 'chevron-back' : backIcon;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: '#003459',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          paddingTop: safeTop + 8,
          paddingBottom: 12,

        },
        style,
      ]}
    >
      {/* Leading button */}
      <TouchableOpacity
        onPress={onBack}
        style={styles.btn}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name={displayIcon} size={26} color="#FFFFFF" />
      </TouchableOpacity>


      {/* Title */}
      <Text
        style={[
          styles.title,
          {
            color: '#FFFFFF',
            fontFamily: theme.typography.fontFamily,
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>

      {/* Trailing action — invisible spacer when absent to keep title centered */}
      <View style={styles.trailing}>{action ?? null}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderBottomWidth: 0,
  },
  btn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  trailing: {
    width: 40,
    alignItems: 'center',
  },
});
