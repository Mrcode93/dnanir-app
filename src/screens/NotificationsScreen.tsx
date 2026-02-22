import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';

import { format } from 'date-fns';

interface NotificationItem {
    id: string;
    title: string;
    body: string;
    date: number; // timestamp
    data?: any;
    type?: string;
    read: boolean;
}

export const NotificationsScreen = ({ navigation }: any) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadNotifications = async () => {
        try {
            const { getNotifications, markAllNotificationsRead } = await import('../database/database');
            const data = await getNotifications();
            setNotifications(data.map(n => ({
                id: n.id.toString(),
                title: n.title,
                body: n.body,
                date: n.date,
                data: n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : null,
                type: (n as any).type,
                read: n.read
            })));

            // Mark all as read after loading (or maybe on focus?)
            await markAllNotificationsRead();
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
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
            const { clearNotifications } = await import('../database/database');
            await clearNotifications();
            setNotifications([]);
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    React.useEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                notifications.length > 0 ? (
                    <TouchableOpacity onPress={clearAll} style={{ marginRight: 16 }}>
                        <Text style={styles.clearText}>مسح الكل</Text>
                    </TouchableOpacity>
                ) : null
            ),
        });
    }, [navigation, notifications]);

    const getIconConfig = (type: string) => {
        switch (type) {
            case 'budget-alerts':
                return { name: 'warning', color: theme.colors.error };
            case 'bill-alerts':
                return { name: 'receipt', color: '#F59E0B' };
            case 'debt-reminders':
                return { name: 'calendar', color: '#8B5CF6' };
            case 'spending-alerts':
            case 'insights':
                return { name: 'analytics', color: '#0EA5E9' };
            case 'daily-reminder':
            case 'expense-reminder':
                return { name: 'time', color: theme.colors.primary };
            case 'achievements':
            case 'achievement-unlocked':
                return { name: 'trophy', color: '#F59E0B' };
            case 'test':
                return { name: 'notifications', color: theme.colors.primary };
            default:
                return { name: 'notifications', color: theme.colors.primary };
        }
    };

    const renderItem = ({ item }: { item: NotificationItem }) => {
        const iconConfig = getIconConfig(item.type || item.data?.type || '');

        return (
            <View style={[styles.notificationCard, !item.read && styles.unreadCard]}>
                <View style={styles.iconContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: iconConfig.color + '20' }]}>
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
            </View>
        );
    };


    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
                initialNumToRender={10}
                maxToRenderPerBatch={8}
                windowSize={7}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews={Platform.OS === 'android'}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>لا توجد إشعارات حالياً</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerLeft: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: getPlatformFontWeight('700'),
        color: '#0F172A',
        fontFamily: theme.typography.fontFamily,
    },
    clearText: {
        fontSize: 14,
        color: theme.colors.error,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
    },
    listContent: {
        padding: 16,
    },
    notificationCard: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        ...getPlatformShadow('sm'),
        borderWidth: 1,
        borderColor: 'transparent',
    },
    unreadCard: {
        borderColor: theme.colors.primary + '40',
        backgroundColor: theme.colors.primary + '05',
    },
    iconContainer: {
        marginLeft: isRTL ? 12 : 0,
        marginRight: isRTL ? 0 : 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        flex: 1,
    },
    headerRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: getPlatformFontWeight('700'),
        color: '#0F172A',
        fontFamily: theme.typography.fontFamily,
        flex: 1,
        textAlign: isRTL ? 'right' : 'left',
    },
    time: {
        fontSize: 11,
        color: '#94A3B8',
        fontFamily: theme.typography.fontFamily,
        marginLeft: isRTL ? 0 : 8,
        marginRight: isRTL ? 8 : 0,
    },
    body: {
        fontSize: 13,
        color: '#64748B',
        fontFamily: theme.typography.fontFamily,
        lineHeight: 20,
        textAlign: isRTL ? 'right' : 'left',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#94A3B8',
        fontFamily: theme.typography.fontFamily,
    },
});
