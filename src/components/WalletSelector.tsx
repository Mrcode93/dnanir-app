import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Wallet } from '../types';
import { useAppTheme } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { useWallets } from '../context/WalletContext';

interface WalletSelectorProps {
  onManageWallets?: () => void;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ onManageWallets }) => {
  const { theme } = useAppTheme();
  const { wallets, selectedWallet, setSelectedWallet } = useWallets();

  if (wallets.length <= 1 && !onManageWallets) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
            styles.scrollContent,
            { flexDirection: isRTL ? 'row-reverse' : 'row' }
        ]}
      >
        <TouchableOpacity
            style={[
                styles.walletItem,
                !selectedWallet ? [styles.selectedWallet, { borderColor: theme.colors.primary }] : { borderColor: 'transparent' }
            ]}
            onPress={() => setSelectedWallet(null)}
        >
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons name="apps" size={18} color={theme.colors.primary} />
            </View>
            <Text style={[styles.walletName, !selectedWallet && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                الكل
            </Text>
        </TouchableOpacity>

        {wallets.map((wallet) => (
          <TouchableOpacity
            key={wallet.id}
            style={[
              styles.walletItem,
              selectedWallet?.id === wallet.id ? [styles.selectedWallet, { borderColor: wallet.color || theme.colors.primary }] : { borderColor: 'transparent' }
            ]}
            onPress={() => setSelectedWallet(wallet)}
          >
            <View style={[styles.iconContainer, { backgroundColor: (wallet.color || theme.colors.primary) + '20' }]}>
              <Ionicons name={(wallet.icon as any) || 'wallet'} size={18} color={wallet.color || theme.colors.primary} />
            </View>
            <Text style={[
                styles.walletName, 
                selectedWallet?.id === wallet.id && { color: wallet.color || theme.colors.primary, fontWeight: 'bold' }
            ]}>
              {wallet.name}
            </Text>
          </TouchableOpacity>
        ))}

        {onManageWallets && (
            <TouchableOpacity
                style={styles.manageButton}
                onPress={onManageWallets}
            >
                <Ionicons name="add" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  walletItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: 'rgba(150, 150, 150, 0.05)',
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedWallet: {
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  walletName: {
    fontSize: 14,
    color: '#666',
  },
  manageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  }
});
