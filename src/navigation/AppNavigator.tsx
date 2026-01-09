import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { I18nManager, Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { IncomeScreen } from '../screens/IncomeScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GoalsScreen } from '../screens/GoalsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ExpensesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExpensesList" component={ExpensesScreen} />
  </Stack.Navigator>
);

const IncomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="IncomeList" component={IncomeScreen} />
  </Stack.Navigator>
);

const DashboardStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="DashboardMain" component={DashboardScreen} />
    <Stack.Screen
      name="Goals"
      component={GoalsScreen}
      options={{
        headerShown: true,
        headerTitle: 'الأهداف المالية',
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
        },
        headerTintColor: theme.colors.textPrimary,
      }}
    />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const insets = useSafeAreaInsets();

  // Ensure RTL is always enabled
  React.useEffect(() => {
    I18nManager.forceRTL(true);
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(true);
  }, []);

  return (
    <NavigationContainer 
      direction="ltr"
      onReady={() => {
        console.log('NavigationContainer ready - LTR direction set');
      }}
    >
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          headerShown: false,
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
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceCard,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: 80 + (Platform.OS === 'android' ? insets.bottom : 0),
            paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 20,
            paddingTop: 8,
            elevation: 8,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            flexDirection: 'row',
          },
          tabBarLabelStyle: {
            fontFamily: theme.typography.fontFamily,
            fontSize: theme.typography.sizes.xs,
            marginTop: 4,
            textAlign: 'right',
            writingDirection: 'rtl',
          },
          tabBarIconStyle: {
            marginTop: 4,
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
          component={IncomeStack}
          options={{ title: 'الدخل' }}
        />
        <Tab.Screen
          name="Expenses"
          component={ExpensesStack}
          options={{ title: 'المصاريف' }}
        />
        <Tab.Screen
          name="Dashboard"
          component={DashboardStack}
          options={{ title: 'الرئيسية' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
