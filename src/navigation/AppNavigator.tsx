import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { I18nManager, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, getPlatformFontWeight } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { IncomeScreen } from '../screens/IncomeScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { RecurringExpensesScreen } from '../screens/RecurringExpensesScreen';
// import { AdvancedReportsScreen } from '../screens/AdvancedReportsScreen'; // Removed
import { CurrencyConverterScreen } from '../screens/CurrencyConverterScreen';
import { DebtsScreen } from '../screens/DebtsScreen';
import { DebtDetailsScreen } from '../screens/DebtDetailsScreen';
import { ChallengesScreen } from '../screens/ChallengesScreen';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { AddIncomeScreen } from '../screens/AddIncomeScreen';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { AddCategoryScreen } from '../screens/AddCategoryScreen';
import { ManageCategoriesScreen } from '../screens/ManageCategoriesScreen';
import { BillsScreen } from '../screens/BillsScreen';
import { AddBillScreen } from '../screens/AddBillScreen';
import { BillDetailsScreen } from '../screens/BillDetailsScreen';
import { AddBudgetScreen } from '../screens/AddBudgetScreen';
import { AddGoalScreen } from '../screens/AddGoalScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const renderHeaderLeft = (navigation: any) => (
  <TouchableOpacity
    onPress={() => navigation.goBack()}
    style={{
      marginLeft: isRTL ? 0 : 16,
      marginRight: isRTL ? 16 : 0,
      padding: 8,
    }}
  >
    <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={28} color={theme.colors.primary} />
  </TouchableOpacity>
);

const ExpensesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ExpensesList" component={ExpensesScreen} />
    <Stack.Screen
      name="RecurringExpenses"
      component={RecurringExpensesScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: 'المصاريف المتكررة',
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
        },
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
        },
        headerTintColor: theme.colors.textPrimary,
      })}
    />
    <Stack.Screen
      name="AddExpense"
      component={AddExpenseScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="AddCategory"
      component={AddCategoryScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="ManageCategories"
      component={ManageCategoriesScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  </Stack.Navigator>
);

const IncomeStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="IncomeList" component={IncomeScreen} />
    <Stack.Screen
      name="AddIncome"
      component={AddIncomeScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="AddCategory"
      component={AddCategoryScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="ManageCategories"
      component={ManageCategoriesScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  </Stack.Navigator>
);

const InsightsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="InsightsMain" component={InsightsScreen} />
    {/* Advanced Reports removed */}
  </Stack.Navigator>
);

import { AddDebtScreen } from '../screens/AddDebtScreen';

const DebtsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="DebtsList"
      component={DebtsScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="document-text" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              الديون والأقساط
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
              navigation.navigate('AddDebt');
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
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
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="document" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              تفاصيل الدين
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
      name="AddDebt"
      component={AddDebtScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
  </Stack.Navigator>
);

const BillsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="BillsList"
      component={BillsScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="receipt" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              الفواتير
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
              navigation.navigate('AddBill');
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
            }}
          >
            <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
      })}
    />
    <Stack.Screen
      name="BillDetails"
      component={BillDetailsScreen}
      options={({ navigation }) => ({
        headerShown: false,
        tabBarStyle: { display: 'none' },
      })}
    />
    <Stack.Screen
      name="AddBill"
      component={AddBillScreen}
      options={({ navigation }) => ({
        headerShown: false,
        presentation: 'card',
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
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flag" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              الأهداف المالية
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
              navigation.navigate('AddGoal');
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
            }}
          >
            <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
      })}
    />
    <Stack.Screen
      name="AddGoal"
      component={AddGoalScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="Budget"
      component={BudgetScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="wallet" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              الميزانية
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
              navigation.navigate('AddBudget');
            }}
            style={{
              marginRight: isRTL ? 0 : 16,
              marginLeft: isRTL ? 16 : 0,
              padding: 8,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
            }}
          >
            <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
          </TouchableOpacity>
        ),
        tabBarStyle: { display: 'none' },
      })}
    />
    <Stack.Screen
      name="AddBudget"
      component={AddBudgetScreen}
      options={{
        headerShown: false,
        presentation: 'card',
      }}
    />
    <Stack.Screen
      name="CurrencyConverter"
      component={CurrencyConverterScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="swap-horizontal" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              محول العملات
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
      name="Achievements"
      component={AchievementsScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="trophy" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              الإنجازات
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
      name="Bills"
      component={BillsStack}
      options={{
        headerShown: false,
      }}
    />
    <Stack.Screen
      name="Challenges"
      component={ChallengesScreen}
      options={({ navigation }) => ({
        headerShown: true,
        headerLeft: () => renderHeaderLeft(navigation),
        headerTitle: () => (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="trophy" size={24} color={theme.colors.primary} />
            <Text style={{
              fontFamily: theme.typography.fontFamily,
              fontSize: theme.typography.sizes.lg,
              fontWeight: getPlatformFontWeight('700'),
              color: theme.colors.textPrimary,
            }}>
              التحديات
            </Text>
          </View>
        ),
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.sizes.lg,
          fontWeight: getPlatformFontWeight('700'),
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
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
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

  // I18nManager setup is handled in App.tsx to avoid reload loops

  return (
    <NavigationContainer
      direction={isRTL ? 'rtl' : 'ltr'}
      onReady={() => {
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
              iconName = focused ? 'grid' : 'grid-outline';
            } else if (route.name === 'Expenses') {
              iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
            } else if (route.name === 'Income') {
              iconName = focused ? 'wallet' : 'wallet-outline';
            } else if (route.name === 'Insights') {
              iconName = focused ? 'pie-chart' : 'pie-chart-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'cog' : 'cog-outline';
            } else {
              iconName = 'help-outline';
            }

            // Pro Active State: Icon inside a soft pill background
            if (focused) {
              return (
                <View style={{
                  backgroundColor: isRTL ? theme.colors.primary + '15' : theme.colors.primary + '15', // Ultra light background
                  width: 48, // Fixed width
                  height: 32, // Fixed height
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4 // Push it up slightly
                }}>
                  <Ionicons name={iconName} size={20} color={theme.colors.primary} />
                </View>
              );
            }

            return <Ionicons name={iconName} size={24} color={'#94A3B8'} />;
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 85 + insets.bottom : 70 + insets.bottom,
            paddingBottom: insets.bottom + 8,
            paddingTop: 12,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            display: 'flex',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
          },
          tabBarLabelStyle: {
            fontFamily: theme.typography.fontFamily,
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
            textAlign: 'center',
          },
          // Hide label for active item if desired, or keep it. Let's keep it for now but make it cleaner.
          tabBarItemStyle: {
            // Add some spacing or style to the touchable area
          },
          tabBarIconStyle: {
            marginTop: 0,
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
