import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiRequest } from './apiService';
import { API_ENDPOINTS } from '../config/api';
import { INTERNAL_INBOX_SAVED_FLAG } from './notificationService';

const isExpoGo =
    Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
const PUSH_TOKEN_STORAGE_KEY = '@dnanir_push_token';
const INSTALLATION_TOKEN_STORAGE_KEY = '@dnanir_installation_token';

const createInstallationToken = () =>
    `DeviceToken[${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}]`;

const getOrCreateInstallationToken = async (): Promise<string> => {
    const existing = await AsyncStorage.getItem(INSTALLATION_TOKEN_STORAGE_KEY);
    if (existing?.trim()) {
        return existing.trim();
    }
    const generated = createInstallationToken();
    await AsyncStorage.setItem(INSTALLATION_TOKEN_STORAGE_KEY, generated);
    return generated;
};

const setStoredPushToken = async (token: string): Promise<void> => {
    if (!token?.trim()) {
        return;
    }
    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token.trim());
};

const getStoredPushToken = async (): Promise<string | null> => {
    const value = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    return value?.trim() ? value.trim() : null;
};

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
        let token: string | null = null;

        // Remote push token generation is not supported in Expo Go (SDK 53+).
        if (isExpoGo) {
            if (__DEV__) {
                
            }
            token = await getOrCreateInstallationToken();
            await setStoredPushToken(token);
            return token;
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
                if (!askPermission) {
                    token = await getOrCreateInstallationToken();
                    await setStoredPushToken(token);
                    return token;
                }
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                if (__DEV__) {
                    
                }
                token = await getOrCreateInstallationToken();
                await setStoredPushToken(token);
                return token;
            }

            try {
                const projectId =
                    Constants.expoConfig?.extra?.eas?.projectId ??
                    Constants.easConfig?.projectId ??
                    '84527916-7a14-4070-bd36-1035bfd146ec';

                token = (await Notifications.getExpoPushTokenAsync({
                    projectId,
                })).data;
                await setStoredPushToken(token);
                // if (__DEV__) {
                //     
                // }
            } catch (e) {
                
                token = await getOrCreateInstallationToken();
                await setStoredPushToken(token);
            }
        } else {
            if (__DEV__) {
                
            }
            token = await getOrCreateInstallationToken();
            await setStoredPushToken(token);
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
                })
            });

            if (!response.error && (response.data as any)?.success !== false) {
                await setStoredPushToken(token);
                return true;
            }
            // Do not show "login" to user — this endpoint is public; failure is e.g. invalid token
            if (response.error && !String(response.error).toLowerCase().includes('login')) {
                
            }
            return false;
        } catch (error) {
            
            return false;
        }
    },

    removeTokenFromServer: async () => {
        try {
            const token = await getStoredPushToken();
            await apiRequest(API_ENDPOINTS.DEVICES.REMOVE, {
                method: 'POST',
                body: JSON.stringify(token ? { token } : {})
            });
            await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
            return true;
        } catch (error) {
            
            return false;
        }
    },

    setupNotificationListeners: () => {
        // Harvesting any notifications that arrived while app was closed
        pushNotificationService.savePresentedNotifications().catch(() => {});

        // Listen for incoming notifications when app is foreground/background
        const receivedSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
            try {
                // If the app is in the background on Android, this might still fire depending on the build.
                // We call savePresentedNotifications periodically or on focus as well.
                await pushNotificationService.processNotification(notification);
            } catch (error) {
                
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

    processNotification: async (notification: Notifications.Notification) => {
        try {
            const { title, body, data } = notification.request.content;
            const { addNotification, getNotifications } = await import('../database/database');
            const parsedData =
                typeof data === 'string'
                    ? (() => {
                        try {
                            return JSON.parse(data) as Record<string, unknown>;
                        } catch {
                            return {};
                        }
                    })()
                    : (data && typeof data === 'object' ? data as Record<string, unknown> : {});

            if (parsedData[INTERNAL_INBOX_SAVED_FLAG]) {
                if (__DEV__) {
                    
                }
                return;
            }

            let notificationDate = notification.date;
            if (!notificationDate) {
                notificationDate = Date.now();
            } else if (notificationDate < 10000000000) {
                notificationDate = notificationDate * 1000;
            }

            // Check for duplicate in DB before adding
            const existing = await getNotifications();
            const type = (parsedData?.type as string) || 'default';
            const isDuplicate = existing.some(n => 
                n.title === title && 
                n.body === body && 
                (n as any).type === type && 
                Math.abs(n.date - notificationDate) < 10000
            );

            if (isDuplicate) return;

            await addNotification({
                title: title || 'No Title',
                body: body || '',
                data: typeof data === 'string' ? data : JSON.stringify(parsedData),
                date: notificationDate,
                type
            });
        } catch (error) {
            
        }
    },

    savePresentedNotifications: async () => {
        try {
            const presented = await Notifications.getPresentedNotificationsAsync();
            if (presented && presented.length > 0) {
                for (const notification of presented) {
                    await pushNotificationService.processNotification(notification);
                }
            }
        } catch (error) {
            
        }
    },

    handleNotificationNavigation: (response: Notifications.NotificationResponse) => {
        // Ensure the notification being clicked is also saved if it wasn't already
        pushNotificationService.processNotification(response.notification).catch(() => {});

        const data = response.notification.request.content.data;
        const type = (data?.type as string) || 'default';

        if (__DEV__) {
            
        }

        // TODO: Implement navigation based on notification type
    }
};
