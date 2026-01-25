import { NativeModules, Platform } from 'react-native';
import { saveWidgetData } from '../services/widgetDataService';

/**
 * Bridge to update widgets from React Native
 */
export const updateWidgets = async (): Promise<void> => {
  try {
    // Save widget data first
    await saveWidgetData();
    
    // Then trigger native widget update
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const { WidgetModule } = NativeModules;
      if (WidgetModule) {
        WidgetModule.updateWidgets();
      }
    }
  } catch (error) {
    console.error('Error updating widgets:', error);
  }
};

/**
 * Initialize widgets (call on app start)
 */
export const initializeWidgets = async (): Promise<void> => {
  await updateWidgets();
};
