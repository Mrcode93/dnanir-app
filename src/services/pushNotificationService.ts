import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiRequest } from './apiService';
import { API_ENDPOINTS } from '../config/api';

const isExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

// Ensure notification handler is set
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export const pushNotificationService = {
    registerForPushNotificationsAsync: async (askPermission = true) => {
        let token;

        // Remote push token generation is not supported in Expo Go (SDK 53+).
        if (isExpoGo) {
            if (__DEV__) {
                console.log('[PushService] Skipping push token registration in Expo Go. Use a development build.');
            }
            return null;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                if (!askPermission) return null;
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                if (__DEV__) {
                    console.log('Permission not granted for push notifications');
                }
                return null;
            }

            try {
                const projectId =
                    Constants.expoConfig?.extra?.eas?.projectId ??
                    Constants.easConfig?.projectId ??
                    '84527916-7a14-4070-bd36-1035bfd146ec';

                token = (await Notifications.getExpoPushTokenAsync({
                    projectId,
                })).data;
                // if (__DEV__) {
                //     console.log('Push token received');
                // }
            } catch (e) {
                console.error('[PushService] Token generation error:', e);
            }
        } else {
            if (__DEV__) {
                console.log('Must use physical device for Push Notifications');
            }
        }

        return token;
    },

    // Public endpoint: no login required. Server accepts token with or without userId.
    sendTokenToServer: async (token: string, userId?: string) => {
        try {
            const platform = Platform.OS;
            const response = await apiRequest(API_ENDPOINTS.DEVICES.REGISTER, {
                method: 'POST',
                body: JSON.stringify({
                    token,
                    userId,
                    platform,
                    appId: '69892d29f246fee6edf11f35'
                })
            });

            if (!response.error && (response.data as any)?.success !== false) {
                return true;
            }
            // Do not show "login" to user — this endpoint is public; failure is e.g. invalid token
            if (response.error && !String(response.error).toLowerCase().includes('login')) {
                console.error('[PushService] Server rejected token:', response.error);
            }
            return false;
        } catch (error) {
            console.error('[PushService] Error sending push token to server:', error);
            return false;
        }
    },

    removeTokenFromServer: async () => {
        try {
            await apiRequest(API_ENDPOINTS.DEVICES.REMOVE, {
                method: 'POST',
                body: JSON.stringify({})
            });
            return true;
        } catch (error) {
            console.error('[PushService] Error removing token:', error);
            return false;
        }
    },

    setupNotificationListeners: () => {
        // Listen for incoming notifications when app is foreground/background
        const receivedSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
            try {
                const { title, body, data } = notification.request.content;
                const { addNotification } = await import('../database/database');

                let notificationDate = notification.date;

                // Fix for 1970 date issue:
                // If date is missing or 0, use current time
                if (!notificationDate) {
                    notificationDate = Date.now();
                }
                // If date is in seconds (e.g., < 10 billion), convert to milliseconds
                // 10 billion seconds is year 2286, so this checks if it's likely seconds vs ms
                else if (notificationDate < 10000000000) {
                    notificationDate = notificationDate * 1000;
                }

                await addNotification({
                    title: title || 'No Title',
                    body: body || '',
                    data: typeof data === 'string' ? data : JSON.stringify(data),
                    date: notificationDate,
                    type: (data?.type as string) || 'default'
                });
                if (__DEV__) {
                    console.log('[PushService] Notification saved to database');
                }
            } catch (error) {
                console.error('[PushService] Error saving notification:', error);
            }
        });

        // Listen for user interaction with notification
        const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
            pushNotificationService.handleNotificationNavigation(response);
        });

        return () => {
            receivedSubscription.remove();
            responseSubscription.remove();
        };
    },

    handleNotificationNavigation: (response: Notifications.NotificationResponse) => {
        // Placeholder for navigation logic
        const data = response.notification.request.content.data;
        const type = (data?.type as string) || 'default';

        if (__DEV__) {
            console.log('[PushService] Handling notification click:', type, data);
        }

        // TODO: Implement navigation based on notification type
        // For now, just logging. Screen navigation is handled by global navigation ref or similar if needed.
    }
};
