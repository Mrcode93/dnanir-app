import DefaultPreference from 'react-native-default-preference';
import WidgetCenter from 'react-native-widget-center';
import { getWidgetBalanceData } from './widgetService';
import { getCustomCategories, addExpense, addIncome } from '../database/database';
import { processSmartText } from './smartTransactionService';
import { ExpenseCategory, IncomeSource } from '../types';

const APP_GROUP = 'group.com.mrcodeiq.dinar';

/**
 * Save widget data to shared storage (for native widgets to access)
 */
export const saveWidgetData = async (): Promise<void> => {
  try {
    const balanceData = await getWidgetBalanceData();
    
    // Set the App Group for shared UserDefaults
    // This allows the iOS Widget to read the data
    await DefaultPreference.setName(APP_GROUP);
    
    // Save to shared UserDefaults (as strings for simplicity)
    await DefaultPreference.set('widget_balance', `${balanceData.balance.toLocaleString()}`);
    await DefaultPreference.set('widget_income', `${balanceData.totalIncome.toLocaleString()}`);
    await DefaultPreference.set('widget_expenses', `${balanceData.totalExpenses.toLocaleString()}`);
    
    // Save raw values for math/formatting in Swift
    await DefaultPreference.set('widget_balance_raw', `${balanceData.balance}`);
    await DefaultPreference.set('widget_income_raw', `${balanceData.totalIncome}`);
    await DefaultPreference.set('widget_expenses_raw', `${balanceData.totalExpenses}`);
    
    await DefaultPreference.set('widget_currency', balanceData.currency);
    const themeJson = await DefaultPreference.get('widget_theme_mode'); // Just to check if we can read
    try {
      const { getAppSettings } = await import('../database/database');
      const settings = await getAppSettings();
      await DefaultPreference.set('widget_theme_mode', settings?.themeMode || 'system');
    } catch (e) {}

    const privacyMode = await import('@react-native-async-storage/async-storage').then(m => m.default.getItem('privacy_mode'));
    await DefaultPreference.set('privacy_mode', privacyMode || 'false');
    await DefaultPreference.set('widget_updated_at', new Date().toISOString());

    // Save Categories
    try {
      const expenseCategories = await getCustomCategories('expense');
      const incomeCategories = await getCustomCategories('income');
      
      // We only need names and icons for the widget picker
      const expCats = expenseCategories.map(c => ({ name: c.name, icon: c.icon }));
      const incCats = incomeCategories.map(c => ({ name: c.name, icon: c.icon }));
      
      await DefaultPreference.set('widget_expense_categories', JSON.stringify(expCats));
      await DefaultPreference.set('widget_income_categories', JSON.stringify(incCats));
    } catch (e) {
      
    }
    
    // Trigger native widget refresh for iOS
    try {
       WidgetCenter.reloadAllTimelines();
       
    } catch (e) {
       
    }
  } catch (error) {
    
  }
};

/**
 * Initialize widget data (call this on app start and after data changes)
 */
export const initializeWidgetData = async (): Promise<void> => {
  await processPendingTransactions();
  await saveWidgetData();
};

/**
 * Process transactions added from the widget while the app was closed
 */
export const processPendingTransactions = async (): Promise<void> => {
  try {
    await DefaultPreference.setName(APP_GROUP);
    const pendingJson = await DefaultPreference.get('widget_pending_transactions');
    if (!pendingJson) return;

    const pending = JSON.parse(pendingJson) as string[];
    if (pending.length === 0) return;

    

    for (const item of pending) {
      const parts = item.split('|');
      
      if (parts[0] === 'v') {
        // Voice/Smart entry: v|text|smart|timestamp
        const text = parts[1];
        try {
          await processSmartText(text);
        } catch (e) {
          
        }
      } else {
        // Quick entry: amount|categoryName|type|timestamp
        const amount = parseFloat(parts[0]);
        const categoryName = parts[1];
        const type = parts[2];
        const date = parts[3].split('T')[0];

        if (type === 'expense') {
          await addExpense({
            title: categoryName, // Use category as title if direct
            amount: amount,
            base_amount: amount,
            category: categoryName as ExpenseCategory,
            date: date,
            description: 'أضيف من الوجت',
            currency: 'IQD'
          });
        } else {
          await addIncome({
            source: categoryName,
            amount: amount,
            base_amount: amount,
            category: categoryName as IncomeSource,
            date: date,
            description: 'أضيف من الوجت',
            currency: 'IQD'
          });
        }
      }
    }

    // Clear the list
    await DefaultPreference.set('widget_pending_transactions', '[]');
  } catch (error) {
    
  }
};
