import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';

import { Savings } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { usePrivacy } from '../context/PrivacyContext';

interface SavingsCardProps {
  savings: Savings;
  onPress: (savings: Savings) => void;
  onAddAmount: (savings: Savings) => void;
  onEdit?: (savings: Savings) => void;
  onDelete?: (savings: Savings) => void;
}

export const SavingsCard: React.FC<SavingsCardProps> = ({
  savings,
  onPress,
  onAddAmount,
  onEdit,
  onDelete,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();



  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(savings)}
      activeOpacity={0.9}
    >
      <View style={styles.cardContent}>
        <View style={styles.header}>
          <View style={[styles.iconBg, { backgroundColor: (savings.color || theme.colors.success) + '20' }]}>
            <Ionicons
              name={(savings.icon || 'wallet') as any}
              size={24}
              color={savings.color || theme.colors.success}
            />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>{savings.title}</Text>
            {savings.description ? (
              <Text style={styles.description} numberOfLines={1}>{savings.description}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => onAddAmount(savings)}
            style={styles.addButton}
          >
            <Ionicons name="add-circle" size={32} color={savings.color || theme.colors.success} />
          </TouchableOpacity>
        </View>

        <View style={styles.amountContainer}>
          <View style={styles.amountInfo}>
            <Text style={styles.amountLabel}>المبلغ الحالي</Text>
            <Text style={styles.amountValue}>
              {isPrivacyEnabled ? '****' : formatCurrency(savings.currentAmount)}
            </Text>
          </View>
        </View>



      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    marginBottom: 16,
    ...getPlatformShadow('md'),
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginTop: 2,
  },
  addButton: {
    padding: 4,
  },
  amountContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  amountInfo: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },

});
