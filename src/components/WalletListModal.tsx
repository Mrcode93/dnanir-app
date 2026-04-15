import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { useWallets } from '../context/WalletContext';
import { Wallet } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { getPlatformShadow, getPlatformFontWeight, AppTheme } from '../utils/theme-constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface WalletListModalProps {
  visible: boolean;
  onClose: () => void;
  onManageWallets?: () => void;
}

export const WalletListModal: React.FC<WalletListModalProps> = ({ visible, onClose, onManageWallets }) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { wallets, selectedWallet, setSelectedWallet } = useWallets();
  const { formatCurrency, currencyCode } = useCurrency();

  const renderWalletItem = ({ item }: { item: Wallet | null }) => {
    const isSelected = (!item && !selectedWallet) || (item?.id === selectedWallet?.id);
    const color = item?.color || theme.colors.primary;
    
    return (
      <TouchableOpacity
        style={[
          styles.walletItem,
          isSelected && { backgroundColor: color + '15', borderColor: color }
        ]}
        onPress={() => {
          setSelectedWallet(item);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Ionicons name={(item?.icon as any) || 'apps'} size={24} color={color} />
        </View>
        <View style={styles.walletInfo}>
          <Text style={[styles.walletName, isSelected && { color: color, fontWeight: 'bold' }]}>
            {item ? item.name : 'الكل'}
          </Text>
          {item && (
            <View>
              <Text style={styles.walletBalance}>
                {formatCurrency(item.balance)}
              </Text>
              {item.currency !== currencyCode && item.native_balance !== undefined && (
                <Text style={styles.walletNativeBalance}>
                  ({formatCurrency(item.native_balance, { currencyCode: item.currency })})
                </Text>
              )}
            </View>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={color} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.title}>اختر المحفظة</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={[null, ...wallets] as (Wallet | null)[]}
            renderItem={renderWalletItem}
            keyExtractor={(item) => item ? item.id.toString() : 'all'}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {onManageWallets && (
            <TouchableOpacity 
              style={styles.manageButton}
              onPress={() => {
                onManageWallets();
                onClose();
              }}
            >
              <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.manageButtonText}>إدارة المحافظ</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.7,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '20',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  listContent: {
    padding: 16,
  },
  walletItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border + '30',
    backgroundColor: theme.colors.surfaceCard,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  walletInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  walletName: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  walletBalance: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  walletNativeBalance: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    opacity: 0.7,
    fontFamily: theme.typography.fontFamily,
  },
  manageButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '10',
    gap: 8,
  },
  manageButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
});
