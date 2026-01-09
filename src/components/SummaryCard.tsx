import React from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';

interface SummaryCardProps {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: string[];
  formatCurrency: (amount: number) => string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  icon,
  gradient,
  formatCurrency,
}) => {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={28} color={theme.colors.textInverse} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{formatCurrency(value)}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  content: {
    padding: theme.spacing.md,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    minHeight: 100,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(I18nManager.isRTL ? { marginRight: theme.spacing.md } : { marginLeft: theme.spacing.md }),
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  value: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
