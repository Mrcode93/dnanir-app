/**
 * Background notification task
 *
 * This module MUST be imported at the top level of App.tsx (or index.ts) so that
 * TaskManager.defineTask() runs when the JS bundle is first evaluated — before any
 * React component mounts.  expo-task-manager requires the task to be defined at
 * module load time, not inside a component lifecycle.
 *
 * What it does:
 *  - Runs runSmartFinancialAlerts() in the background every ~15 minutes
 *  - Fires budget / bill-due-soon / spending-anomaly / debt-due-today notifications
 *    even when the user hasn't opened the app
 *  - Reschedules all daily/date-based notifications after a device reboot
 *    (requires RECEIVE_BOOT_COMPLETED permission — see app.json)
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

export const BACKGROUND_NOTIFICATION_TASK = 'dnanir-background-notifications';

// Minimum interval between background executions (15 minutes is the OS minimum)
const BACKGROUND_INTERVAL_SECONDS = 15 * 60;

// ─── Task definition ──────────────────────────────────────────────────────────
// Must be at module level — do NOT move this inside a component or function.
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    // Dynamically import to avoid circular dependency issues
    const { runSmartFinancialAlerts, initializeNotifications } = await import(
      '../services/notificationService'
    );

    // Re-schedule daily/date triggers in case they were wiped by a reboot,
    // then run the smart real-time checks (budget, bills, spending, debts).
    await initializeNotifications();
    await runSmartFinancialAlerts({ force: true });

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Registration helper ──────────────────────────────────────────────────────
/**
 * Call this once after the app is ready (e.g. in the deferred startup block).
 * Safe to call multiple times — skips registration if already registered.
 */
export const registerBackgroundNotificationTask = async (): Promise<void> => {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      // Background execution not allowed on this device / OS settings
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_NOTIFICATION_TASK
    );
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
        minimumInterval: BACKGROUND_INTERVAL_SECONDS,
        stopOnTerminate: false, // Keep running after the app is killed (Android)
        startOnBoot: true,      // Re-register on device reboot (Android)
      });
    }
  } catch {
    // Background fetch unavailable — gracefully ignore
  }
};
