import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { pushNotificationService } from '../services/pushNotificationService';
import { getCurrentUser } from '../services/serverAuthService';
import { authEventService } from '../services/authEventService';

const PushNotificationManager = () => {
    useEffect(() => {
        const registerPush = async () => {
            try {
                // Get current user if logged in
                const user = await getCurrentUser();

                // Register for push token
                const pushToken = await pushNotificationService.registerForPushNotificationsAsync(true);

                if (pushToken) {
                    // Send token to server, optionally with user ID
                    await pushNotificationService.sendTokenToServer(pushToken, user?.id);
                }
            } catch (error) {
                // 
            }
        };

        // Initial registration
        registerPush();

        // Listen for auth changes to re-register/update user link
        const unsubscribeAuth = authEventService.subscribe(() => {
            // 
            registerPush();
        });

        // Setup centralized listeners for notifications (receiving and interaction)
        const cleanupListeners = pushNotificationService.setupNotificationListeners();

        // Check for initial notification if app was opened from one
        Notifications.getLastNotificationResponseAsync().then(response => {
            if (response) {
                // Ensure it's saved to the DB
                pushNotificationService.processNotification(response.notification).catch(() => {});
                pushNotificationService.handleNotificationNavigation(response);
            }
        });

        return () => {
            cleanupListeners(); // Remove both received and response listeners
            unsubscribeAuth();
        };
    }, []);

    return null;
};

export default PushNotificationManager;
