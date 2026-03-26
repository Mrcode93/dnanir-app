/**
 * AppHeader — unified in-screen header with back/close button + title + optional action.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../../utils/theme-context';
import { getPlatformFontWeight } from '../../../utils/theme-constants';
import { SPACING } from '../../tokens';

interface AppHeaderProps {
  title: string;
  onBack: () => void;
  backIcon?: React.ComponentProps<typeof Ionicons>['name'];
  action?: React.ReactNode;
  style?: ViewStyle;
}

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
    <>
      <StatusBar barStyle="light-content" backgroundColor="#001D3D" translucent />
      <View
        style={[
          styles.row,
          {
            backgroundColor: '#001D3D',
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
        <TouchableOpacity
          onPress={onBack}
          style={styles.btn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={displayIcon} size={26} color="#FFFFFF" />
        </TouchableOpacity>

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

        <View style={styles.trailing}>{action ?? null}</View>
      </View>
    </>
  );
};
