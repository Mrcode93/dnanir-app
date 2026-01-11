import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { I18nManager, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { IncomeScreen } from '../screens/IncomeScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { RecurringExpensesScreen } from '../screens/RecurringExpensesScreen';
import { AdvancedReportsScreen } from '../screens/AdvancedReportsScreen';
import { CurrencyConverterScreen } from '../screens/CurrencyConverterScreen';
import { DebtsScreen } from '../screens/DebtsScreen';
import { DebtDetailsScreen } from '../screens/DebtDetailsScreen';
import { ChallengesScreen } from '../screens/ChallengesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ExpensesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExpensesList" component={ExpensesScreen} />
    <Stack.Screen
      name="RecurringExpenses"
      component={RecurringExpensesScreen}
      options={{
        headerShown: true,
        headerTitle: 'المصاريف المتكررة',
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

const IncomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="IncomeList" component={IncomeScreen} />
  </Stack.Navigator>
);

const InsightsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="InsightsMain" component={InsightsScreen} />
    <Stack.Screen
      name="AdvancedReports"
      component={AdvancedReportsScreen}
      options={{
        headerShown: true,
        headerTitle: 'التقارير المتقدمة',
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

const DebtsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen 
      name="DebtsList" 
      component={DebtsScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="document-text" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: '700',
              color: theme.colors.textPrimary,
            }}>
              الديون والأقساط
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.textPrimary,
        headerBackTitleVisible: false,
        headerBackTitle: '',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('DebtsList', { action: 'add' });
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
            }}
          >
            <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
      })}
    />
    <Stack.Screen
      name="DebtDetails"
      component={DebtDetailsScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="document" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: '700',
              color: theme.colors.textPrimary,
            }}>
              تفاصيل الدين
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.textPrimary,
        headerBackTitleVisible: false,
        headerBackTitle: '',
        tabBarStyle: { display: 'none' },
      })}
    />
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
      options={({ navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flag" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: '700',
              color: theme.colors.textPrimary,
            }}>
              الأهداف المالية
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.textPrimary,
        headerBackTitleVisible: false,
        headerBackTitle: '',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              // Navigate to Goals screen and trigger add
              navigation.navigate('Goals', { action: 'add' });
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
            }}
          >
            <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
      })}
    />
    <Stack.Screen
      name="Budget"
      component={BudgetScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="wallet" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: '700',
              color: theme.colors.textPrimary,
            }}>
              الميزانية
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.textPrimary,
        headerBackTitleVisible: false,
        headerBackTitle: '',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Budget', { action: 'add' });
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
            }}
          >
            <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
        tabBarStyle: { display: 'none' },
      })}
    />
    <Stack.Screen
      name="CurrencyConverter"
      component={CurrencyConverterScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="swap-horizontal" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: '700',
              color: theme.colors.textPrimary,
            }}>
              محول العملات
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.textPrimary,
        headerBackTitleVisible: false,
        headerBackTitle: '',
        tabBarStyle: { display: 'none' },
      })}
    />
    <Stack.Screen
      name="Debts"
      component={DebtsStack}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="Challenges"
      component={ChallengesScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="trophy" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: '700',
              color: theme.colors.textPrimary,
            }}>
              التحديات
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: '700',
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.textPrimary,
        headerBackTitleVisible: false,
        headerBackTitle: '',
        headerRight: () => (
          <TouchableOpacity
            onPress={() => {
              navigation.navigate('Challenges', { action: 'add' });
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
            }}
          >
            <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
        tabBarStyle: { display: 'none' },
      })}
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
          tabBarShowLabel: true,
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
            } else if (route.name === 'RecurringExpenses') {
              iconName = focused ? 'repeat' : 'repeat-outline';
            } else if (route.name === 'AdvancedReports') {
              iconName = focused ? 'document-text' : 'document-text-outline';
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceCard,
            borderTopColor: theme.colors.primary,
            borderTopWidth: 1,
            height: 70 + (Platform.OS === 'android' ? insets.bottom : 0),
            paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 20,
            paddingTop: 4,
            elevation: 8,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            flexDirection: 'row',
            display: 'flex',
          },
          tabBarLabelStyle: {
            fontFamily: theme.typography.fontFamily,
            fontSize: theme.typography.sizes.xs,
            marginTop: 2,
            textAlign: 'right',
            writingDirection: 'rtl',
          },
          tabBarIconStyle: {
            marginTop: 2,
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
          component={InsightsStack}
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
