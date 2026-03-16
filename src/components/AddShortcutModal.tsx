import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { AppDialog, AppButton } from '../design-system';

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

  const handleExpense = () => {
    onClose();
    onExpense();
  };

  const handleIncome = () => {
    onClose();
    onIncome();
  };

  return (
    <AppDialog
      visible={visible}
      onClose={onClose}
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
          <AppButton
            label="مصروف"
            onPress={handleExpense}
            variant="danger"
            leftIcon="remove-circle"
            style={styles.button}
          />
          <AppButton
            label="دخل"
            onPress={handleIncome}
            variant="success"
            leftIcon="add-circle"
            style={styles.button}
          />
          <AppButton
            label="إلغاء"
            onPress={onClose}
            variant="ghost"
            style={styles.buttonCancel}
          />
        </View>
      </View>
    </AppDialog>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    content: {
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
      flex: 1,
      minWidth: 90,
    },
    buttonCancel: {
      flexBasis: '100%',
    },
  });
