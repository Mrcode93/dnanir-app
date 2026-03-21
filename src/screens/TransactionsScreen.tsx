import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { ExpensesScreen } from './ExpensesScreen';
import { IncomeScreen } from './IncomeScreen';
import { ManageCategoriesScreen } from './ManageCategoriesScreen';
import { AddCategoryScreen } from './AddCategoryScreen';
import { useAppTheme } from '../utils/theme-context';
import { getPlatformFontWeight, getCommonStackOptions } from '../utils/theme-constants';
import { isRTL } from '../utils/rtl';
import { HeaderBackWithLabel } from '../navigation/AppNavigator'; // Needs export? Will just duplicate or rely on AppNavigator's implementation.
import { tl, useLocalization } from "../localization";
const TopTab = createMaterialTopTabNavigator();
export const TransactionsTabs = () => {
  const {
    theme
  } = useAppTheme();
  return <TopTab.Navigator initialRouteName="Income" screenOptions={{
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: theme.colors.textMuted,
    tabBarIndicatorStyle: {
      backgroundColor: theme.colors.primary,
      height: 3
    },
    tabBarStyle: {
      backgroundColor: theme.colors.surface
    },
    tabBarLabelStyle: {
      fontFamily: theme.typography.fontFamily,
      fontWeight: '700',
      fontSize: 14
    }
  }}>
      <TopTab.Screen name="Expenses" component={ExpensesScreen} options={{
      title: tl("المصاريف")
    }} />
      <TopTab.Screen name="Income" component={IncomeScreen} options={{
      title: tl("الدخل")
    }} />
    </TopTab.Navigator>;
};
