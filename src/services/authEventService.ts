/**
 * Authentication State Management Service
 * Manages communication between components and App.tsx for authentication state changes
 */

type AuthStateChangeCallback = () => void | Promise<void>;

class AuthEventService {
  private listeners: Set<AuthStateChangeCallback> = new Set();
  private keepUnlockedUntil: number = 0;

  /**
   * Subscribe to authentication state change events
   * @returns Unsubscribe function
   */
  subscribe(callback: AuthStateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all subscribers that authentication state has changed
   */
  notifyAuthChanged(): void {
    this.listeners.forEach(callback => {
      try {
        const result = callback();
        if (result instanceof Promise) {
          result.catch(error => {
            console.error('Error in auth state change callback:', error);
          });
        }
      } catch (error) {
        console.error('Error in auth state change callback:', error);
      }
    });
  }

  /**
   * Request to keep the app unlocked for a specified duration
   * Used during operations like disabling authentication
   * @param durationMs Duration in milliseconds (default: 30 seconds)
   */
  requestKeepUnlocked(durationMs: number = 30000): void {
    this.keepUnlockedUntil = Date.now() + durationMs;
  }

  /**
   * Check if the app should remain unlocked
   */
  shouldKeepUnlocked(): boolean {
    if (this.keepUnlockedUntil === 0) {
      return false;
    }
    
    if (Date.now() > this.keepUnlockedUntil) {
      this.keepUnlockedUntil = 0;
      return false;
    }
    
    return true;
  }

  /**
   * Clear the keep unlocked request
   */
  clearKeepUnlocked(): void {
    this.keepUnlockedUntil = 0;
  }
}

export const authEventService = new AuthEventService();
