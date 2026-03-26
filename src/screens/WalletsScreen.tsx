import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '../design-system';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { useWallets } from '../context/WalletContext';
import { Wallet } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { getPlatformShadow, getPlatformFontWeight, type AppTheme } from '../utils/theme-constants';
import { tl, useLocalization } from "../localization";

export const WalletsScreen = ({ navigation }: any) => {
  useLocalization();
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { wallets, deleteWallet, setDefaultWallet } = useWallets();
  const { formatCurrency } = useCurrency();

  const handleEditWallet = (wallet: Wallet) => {
    navigation.navigate('AddWallet', { wallet });
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      tl("حذف المحفظة"),
      tl("هل أنت متأكد من حذف هذه المحفظة؟ سيتم نقل جميع العمليات المرتبطة بها إلى المحفظة الرئيسية."),
      [
        { text: tl("إلغاء"), style: 'cancel' },
        { 
          text: tl("حذف"), 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(id);
            } catch (error: any) {
              Alert.alert(tl("خطأ"), error.message);
            }
          }
        }
      ]
    );
  };

  const renderWalletItem = ({ item }: { item: Wallet }) => {
    const isDefault = Boolean(item.isDefault);

    return (
      <TouchableOpacity
        style={styles.walletCard}
        onPress={() => handleEditWallet(item)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[item.color || theme.colors.primary, (item.color || theme.colors.primary) + 'DD']}
          style={styles.walletGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.walletHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name={(item.icon as any) || 'wallet-outline'} size={24} color="#FFF" />
            </View>
            {isDefault ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>{tl("الأساسية")}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.walletInfo}>
            <Text style={styles.walletTitle} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.walletBalance}>{formatCurrency(item.balance)}</Text>
          </View>
          <View style={styles.walletActions}>
            {isDefault ? null : (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setDefaultWallet(item.id)}
              >
                <Ionicons name="star" size={18} color="#FFF" />
              </TouchableOpacity>
            )}
            {isDefault ? null : (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDelete(item.id)}
              >
                <Ionicons name="trash" size={18} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer scrollable={false} edges={['left', 'right']} style={styles.container}>
      <FlatList
        data={wallets}
        renderItem={renderWalletItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={80} color={theme.colors.textSecondary + '40'} />
            <Text style={styles.emptyText}>{tl("لا توجد محافظ إضافية")}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: 24,
    paddingTop: 12,
  },
  walletCard: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  walletGradient: {
    padding: 20,
    minHeight: 180,
    justifyContent: 'space-between',
  },
  walletHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  defaultText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: getPlatformFontWeight('700'),
  },
  walletInfo: {
    marginTop: 12,
  },
  walletTitle: {
    color: '#FFF',
    fontSize: 18,
    opacity: 0.9,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('400'),
    textAlign: isRTL ? 'right' : 'left',
  },
  walletBalance: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    textAlign: isRTL ? 'right' : 'left',
  },
  walletActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    opacity: 0.6,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});
