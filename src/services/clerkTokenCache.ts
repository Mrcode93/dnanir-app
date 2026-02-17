import * as SecureStore from 'expo-secure-store';

/**
 * Token cache for Clerk using expo-secure-store
 * This stores Clerk's session tokens securely on the device
 */
export const clerkTokenCache = {
    async getToken(key: string): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.error('ClerkTokenCache: Error getting token:', error);
            return null;
        }
    },
    async saveToken(key: string, value: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.error('ClerkTokenCache: Error saving token:', error);
        }
    },
    async clearToken(key: string): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error('ClerkTokenCache: Error clearing token:', error);
        }
    },
};
