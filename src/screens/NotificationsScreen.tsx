import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ScreenContainer } from '../design-system';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { format } from 'date-fns';
import { tl, useLocalization } from "../localization";
interface NotificationItem {
  id: string;
  title: string;
  body: string;
  date: number; // timestamp
  data?: any;
  type?: string;
  read: boolean;
}
export const NotificationsScreen = ({
  navigation
}: any) => {
  useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const loadNotifications = async () => {
    try {
      const { pushNotificationService } = await import('../services/pushNotificationService');
      // Harvest visible notifications first
      await pushNotificationService.savePresentedNotifications();

      const {
        getNotifications,
        markAllNotificationsRead
      } = await import('../database/database');
      const data = await getNotifications();
      const mapped = data.map(n => ({
        id: n.id.toString(),
        title: n.title,
        body: n.body,
        date: n.date,
        data: n.data ? typeof n.data === 'string' ? JSON.parse(n.data) : n.data : null,
        type: (n as any).type,
        read: n.read
      }));

      // Hide duplicated rows (same content arriving twice within a few seconds).
      const deduped: NotificationItem[] = [];
      for (const item of mapped) {
        const itemType = item.type || item.data?.type || 'default';
        const hasDuplicate = deduped.some(existing => {
          const existingType = existing.type || existing.data?.type || 'default';
          return existing.title === item.title && existing.body === item.body && existingType === itemType && Math.abs(existing.date - item.date) <= 5000;
        });
        if (!hasDuplicate) {
          deduped.push(item);
        }
      }
      setNotifications(deduped);

      // Mark all as read after loading (or maybe on focus?)
      await markAllNotificationsRead();
    } catch (error) {}
  };
  useEffect(() => {
    loadNotifications();
  }, []);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };
  const clearAll = async () => {
    try {
      const {
        clearNotifications
      } = await import('../database/database');
      await clearNotifications();
      setNotifications([]);
    } catch (error) {}
  };
  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => notifications.length > 0 ? <TouchableOpacity onPress={clearAll} style={{
        marginRight: 16
      }}>
                        <Text style={styles.clearText}>{tl("مسح الكل")}</Text>
                    </TouchableOpacity> : null
    });
  }, [navigation, notifications]);
  const getIconConfig = (type: string) => {
    switch (type) {
      case 'budget-alerts':
        return {
          name: 'warning',
          color: theme.colors.error
        };
      case 'bill-alerts':
        return {
          name: 'receipt',
          color: theme.colors.warning
        };
      case 'debt-reminders':
        return {
          name: 'calendar',
          color: '#8B5CF6'
        };
      // Keep indigo or use a theme token if available
      case 'spending-alerts':
      case 'insights':
        return {
          name: 'analytics',
          color: theme.colors.info
        };
      case 'daily-reminder':
      case 'expense-reminder':
        return {
          name: 'time',
          color: theme.colors.primary
        };
      case 'achievements':
      case 'achievement-unlocked':
        return {
          name: 'trophy',
          color: theme.colors.warning
        };
      case 'test':
        return {
          name: 'notifications',
          color: theme.colors.primary
        };
      default:
        return {
          name: 'notifications',
          color: theme.colors.primary
        };
    }
  };
  const renderItem = ({
    item
  }: {
    item: NotificationItem;
  }) => {
    const iconConfig = getIconConfig(item.type || item.data?.type || '');
    return <View style={[styles.notificationCard, !item.read && styles.unreadCard]}>
                <View style={styles.iconContainer}>
                    <View style={[styles.iconCircle, {
          backgroundColor: iconConfig.color + '20'
        }]}>
                        <Ionicons name={iconConfig.name as any} size={20} color={iconConfig.color} />
                    </View>
                </View>
                <View style={styles.contentContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.time}>{format(new Date(item.date), 'dd/MM/yyyy HH:mm')}</Text>
                    </View>
                    <Text style={styles.body}>{item.body}</Text>
                </View>
            </View>;
  };
  return <ScreenContainer scrollable={false} edges={['bottom']}>
            <FlashList data={notifications} renderItem={renderItem} keyExtractor={item => item.id} estimatedItemSize={100} contentContainerStyle={styles.listContent} initialNumToRender={10} maxToRenderPerBatch={8} windowSize={7} updateCellsBatchingPeriod={50} removeClippedSubviews={Platform.OS === 'android'} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} ListFooterComponent={<View style={{
      height: 20
    }} />} />
        </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  headerLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  clearText: {
    fontSize: 14,
    color: theme.colors.error,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily
  },
  listContent: {
    padding: 16
  },
  notificationCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: theme.colors.surfaceCard,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    ...getPlatformShadow('sm'),
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  unreadCard: {
    borderColor: theme.colors.primary + '40',
    backgroundColor: theme.colors.primary + '05'
  },
  iconContainer: {
    marginLeft: isRTL ? 12 : 0,
    marginRight: isRTL ? 0 : 12
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  contentContainer: {
    flex: 1
  },
  headerRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  title: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    textAlign: isRTL ? 'right' : 'left'
  },
  time: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    marginLeft: isRTL ? 0 : 8,
    marginRight: isRTL ? 8 : 0
  },
  body: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 20,
    textAlign: isRTL ? 'right' : 'left'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily
  }
});
