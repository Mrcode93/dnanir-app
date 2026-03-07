import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import {
    addSubscription as dbAddSubscription,
    getSubscriptions as dbGetSubscriptions,
    updateSubscription as dbUpdateSubscription,
    deleteSubscription as dbDeleteSubscription
} from '../database/database';
import { Subscription } from '../types';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, NOTIFICATION_MESSAGES } from '../constants/notificationConstants';

const getNotificationId = (id: number) => `sub-rem-${id}`;

export const scheduleSubscriptionReminder = async (sub: Subscription) => {
    if (!sub.reminderEnabled) {
        await cancelSubscriptionReminder(sub.id);
        return;
    }

    // Cancel existing if any
    await cancelSubscriptionReminder(sub.id);

    const nextBilling = new Date(sub.nextBillingDate);
    // User wants reminder 24 hours before
    const triggerDate = new Date(nextBilling.getTime() - (sub.reminderDaysBefore * 24 * 60 * 60 * 1000));

    // Set to 9 AM on that day
    triggerDate.setHours(9, 0, 0, 0);

    // If trigger date is in the past, don't schedule
    if (triggerDate.getTime() <= Date.now()) {
        return;
    }

    try {
        const title = NOTIFICATION_MESSAGES.SUBSCRIPTION_DUE_SOON.title;
        const body = NOTIFICATION_MESSAGES.SUBSCRIPTION_DUE_SOON.body(sub.name, sub.amount, sub.currency || 'IQD');

        await Notifications.scheduleNotificationAsync({
            identifier: getNotificationId(sub.id),
            content: {
                title,
                body,
                sound: true,
                data: {
                    type: NOTIFICATION_CATEGORIES.SUBSCRIPTION_ALERTS,
                    subscriptionId: sub.id
                },
                ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.FINANCIAL }),
            },
            trigger: triggerDate as any,
        } as Notifications.NotificationRequestInput);
    } catch (error) {
        console.error('Error scheduling subscription reminder:', error);
    }
};

export const cancelSubscriptionReminder = async (id: number) => {
    try {
        await Notifications.cancelScheduledNotificationAsync(getNotificationId(id));
    } catch (error) {
        // Ignore
    }
};

export const addSubscription = async (sub: Omit<Subscription, 'id'>) => {
    const id = await dbAddSubscription(sub);
    const newSub = { ...sub, id };
    await scheduleSubscriptionReminder(newSub);
    return id;
};

export const getSubscriptions = async (activeOnly: boolean = false) => {
    return await dbGetSubscriptions(activeOnly);
};

export const updateSubscription = async (id: number, sub: Partial<Subscription>) => {
    await dbUpdateSubscription(id, sub);

    // Refresh reminder if relevant fields changed
    if (sub.nextBillingDate !== undefined || sub.reminderEnabled !== undefined || sub.name !== undefined || sub.amount !== undefined) {
        const all = await dbGetSubscriptions();
        const updated = all.find(s => s.id === id);
        if (updated) {
            await scheduleSubscriptionReminder(updated);
        }
    }
};

export const deleteSubscription = async (id: number) => {
    await cancelSubscriptionReminder(id);
    await dbDeleteSubscription(id);
};

export const processSubscriptionPayment = async (sub: Subscription) => {
    const { addExpense } = await import('../database/database');

    // 1. Add as expense
    await addExpense({
        title: `اشتراك: ${sub.name}`,
        amount: sub.amount,
        currency: sub.currency || 'IQD',
        category: 'bills', // Categorize as bills
        date: sub.nextBillingDate,
        description: sub.description || `دفع تلقائي لاشتراك ${sub.name}`,
    });

    // 2. Calculate next billing date
    const nextDate = new Date(sub.nextBillingDate);
    if (sub.billingCycle === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (sub.billingCycle === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else if (sub.billingCycle === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
    }

    const nextDateStr = nextDate.toISOString().split('T')[0];

    // 3. Update subscription
    await updateSubscription(sub.id, {
        nextBillingDate: nextDateStr
    });
};

export const checkAndProcessSubscriptions = async () => {
    try {
        const activeSubs = await dbGetSubscriptions(true);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const sub of activeSubs) {
            const nextBilling = new Date(sub.nextBillingDate);
            nextBilling.setHours(0, 0, 0, 0);

            if (nextBilling.getTime() <= today.getTime()) {
                console.log(`Processing subscription: ${sub.name}`);
                await processSubscriptionPayment(sub);
            }
        }
    } catch (error) {
        console.error('Error checking and processing subscriptions:', error);
    }
};
