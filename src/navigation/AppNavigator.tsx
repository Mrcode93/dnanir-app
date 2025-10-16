import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Text } from 'react-native-paper';
import { I18nManager, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../utils/gradientColors';

import DashboardScreen from '../screens/DashboardScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import IncomeScreen from '../screens/IncomeScreen';
import InsightsScreen from '../screens/InsightsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <NavigationContainer direction={I18nManager.isRTL ? 'rtl' : 'ltr'}>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          headerShown: false, // Remove headers from all screens
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Dashboard') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Expenses') {
              iconName = focused ? 'card' : 'card-outline';
            } else if (route.name === 'Income') {
              iconName = focused ? 'trending-up' : 'trending-up-outline';
            } else if (route.name === 'Insights') {
              iconName = focused ? 'analytics' : 'analytics-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarLabel: ({ focused, children }) => (
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Cairo-Regular',
                color: focused ? colors.primary : colors.textSecondary,
                marginTop: 4,
              }}
            >
              {children}
            </Text>
          ),
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 80 + (Platform.OS === 'android' ? insets.bottom : 0),
            paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 20,
            paddingTop: 8,
          },
          
        })}
      >
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{ title: 'الإعدادات' }}
        />
        <Tab.Screen 
          name="Insights" 
          component={InsightsScreen}
          options={{ title: 'التحليلات' }}
        />
        <Tab.Screen 
          name="Income" 
          component={IncomeScreen}
          options={{ title: 'الدخل' }}
        />
        <Tab.Screen 
          name="Expenses" 
          component={ExpensesScreen}
          options={{ title: 'المصاريف' }}
        />
        <Tab.Screen 
          name="Dashboard" 
          component={DashboardScreen}
          options={{ title: 'الرئيسية' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
