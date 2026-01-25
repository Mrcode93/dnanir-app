import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWidgetBalanceData, getWidgetMonthlySummary, getWidgetQuickAddData, WidgetBalanceData, WidgetMonthlySummary, WidgetQuickAddData } from './widgetService';

const WIDGET_DATA_KEY = '@dnanir_widget_data';
const WIDGET_BALANCE_KEY = '@dnanir_widget_balance';
const WIDGET_MONTHLY_SUMMARY_KEY = '@dnanir_widget_monthly_summary';
const WIDGET_QUICK_ADD_KEY = '@dnanir_widget_quick_add';

/**
 * Save widget data to shared storage (for native widgets to access)
 */
export const saveWidgetData = async (): Promise<void> => {
  try {
    const balanceData = await getWidgetBalanceData();
    const monthlySummary = await getWidgetMonthlySummary();
    const quickAddData = await getWidgetQuickAddData();
    
    // Save to AsyncStorage (will be accessible via native modules)
    await AsyncStorage.setItem(WIDGET_BALANCE_KEY, JSON.stringify(balanceData));
    await AsyncStorage.setItem(WIDGET_MONTHLY_SUMMARY_KEY, JSON.stringify(monthlySummary));
    await AsyncStorage.setItem(WIDGET_QUICK_ADD_KEY, JSON.stringify(quickAddData));
    
    // Also save combined data
    const widgetData = {
      balance: balanceData,
      monthlySummary: monthlySummary,
      quickAdd: quickAddData,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));
    
    // Trigger native widget update
    try {
      const { NativeModules } = require('react-native');
      if (NativeModules.WidgetModule) {
        // Update native widgets with data
        NativeModules.WidgetModule.updateWidgetData({
          balance: balanceData,
          monthlySummary: monthlySummary,
          quickAdd: quickAddData,
        }).then(() => {
          NativeModules.WidgetModule.updateWidgets();
        }).catch((error: any) => {
          console.log('Error updating widget data:', error);
        });
      }
    } catch (error) {
      // Native module not available, continue
      console.log('Widget native module not available');
    }
  } catch (error) {
    console.error('Error saving widget data:', error);
  }
};

/**
 * Get widget balance data from storage
 */
export const getStoredWidgetBalance = async (): Promise<WidgetBalanceData | null> => {
  try {
    const data = await AsyncStorage.getItem(WIDGET_BALANCE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting stored widget balance:', error);
    return null;
  }
};

/**
 * Get widget monthly summary from storage
 */
export const getStoredWidgetMonthlySummary = async (): Promise<WidgetMonthlySummary | null> => {
  try {
    const data = await AsyncStorage.getItem(WIDGET_MONTHLY_SUMMARY_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting stored widget monthly summary:', error);
    return null;
  }
};

/**
 * Get widget quick add data from storage
 */
export const getStoredWidgetQuickAdd = async (): Promise<WidgetQuickAddData | null> => {
  try {
    const data = await AsyncStorage.getItem(WIDGET_QUICK_ADD_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting stored widget quick add data:', error);
    return null;
  }
};

/**
 * Initialize widget data (call this on app start and after data changes)
 */
export const initializeWidgetData = async (): Promise<void> => {
  await saveWidgetData();
};
