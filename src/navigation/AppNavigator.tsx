import React, { useState, useCallback } from 'react';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPlatformFontWeight, type AppTheme } from '../utils/theme-constants';
import { useAppTheme } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { IncomeScreen } from '../screens/IncomeScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { AISmartInsightsScreen } from '../screens/AISmartInsightsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
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
import { GoalPlanScreen } from '../screens/GoalPlanScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { AddDebtScreen } from '../screens/AddDebtScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { usePrivacy } from '../context/PrivacyContext';
import { authStorage } from '../services/authStorage';
import { onboardingStorage } from '../services/onboardingStorage';
import { syncNewToServer } from '../services/syncService';
import { alertService } from '../services/alertService';
import { OnboardingScreen } from '../screens/OnboardingScreen';

const DashboardHeaderRight = ({ navigation }: { navigation: any }) => {
  const { theme } = useAppTheme();
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy();
  const [syncing, setSyncing] = useState(false);
  const [canSync, setCanSync] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      authStorage.getUser<{ isPro?: boolean }>().then((user) => {
        if (!cancelled) setCanSync(!!user?.isPro);
      });
      return () => { cancelled = true; };
    }, [])
  );

  const handleSyncPress = async () => {
    if (syncing) return;
    if (!canSync) {
      alertService.show({
        title: 'اشتراك مميز',
        message: 'مزامنة البيانات متاحة للمشتركين المميزين فقط. يجب أن يكون نوع حسابك أو اشتراكك مميزاً لاستخدام المزامنة.',
        type: 'warning',
        confirmText: 'حسناً',
      });
      return;
    }
    setSyncing(true);
    const result = await syncNewToServer();
    setSyncing(false);
    if (result.success) {
      alertService.success('تمت المزامنة', result.count > 0 ? `تم رفع ${result.count} عنصر` : 'لا توجد بيانات جديدة');
    } else {
      if (result.code !== 'NOT_AUTHENTICATED' && result.code !== 'NOT_PRO') {
        alertService.error('فشل المزامنة', result.error);
      }
    }
  };

  const syncIconColor = canSync ? theme.colors.primary : theme.colors.textMuted;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16 }}>
      <TouchableOpacity
        onPress={handleSyncPress}
        disabled={syncing}
        style={{ padding: 6 }}
        activeOpacity={0.7}
      >
        {syncing ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Ionicons name="cloud-upload-outline" size={22} color={syncIconColor} />
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={togglePrivacy}
        style={{
          padding: 6,
          borderRadius: 10,
          backgroundColor: isPrivacyEnabled ? theme.colors.primary + '15' : 'transparent',
        }}
      >
        <Ionicons
          name={isPrivacyEnabled ? 'eye-off' : 'eye-outline'}
          size={22}
          color={isPrivacyEnabled ? theme.colors.primary : theme.colors.textSecondary}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('Notifications')}
        style={{ padding: 6 }}
      >
        <Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const getCommonStackOptions = (theme: AppTheme) => ({
  headerStyle: {
    backgroundColor: theme.colors.surfaceCard,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleStyle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  headerTitleAlign: 'center' as const,
  headerTintColor: theme.colors.primary,
});

const SettingsScreenStack = () => {
  const { theme } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: 18,
          fontWeight: getPlatformFontWeight('700'),
          color: theme.colors.textPrimary,
        },
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          headerTitle: 'الإعدادات',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={({ navigation }) => ({
          headerTitle: 'الحساب والملف الشخصي',
          headerLeft: () => <HeaderLeft navigation={navigation} />,
        })}
      />
    </Stack.Navigator>
  );
};

const HeaderLeft = ({ navigation }: { navigation: any }) => {
  const { theme } = useAppTheme();
  return (
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
};

const HeaderBackWithLabel = ({ navigation, label }: { navigation: any; label: string }) => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={{
        marginLeft: isRTL ? 0 : 16,
        marginRight: isRTL ? 16 : 0,
        paddingVertical: 8,
        paddingHorizontal: 8,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 4,
      }}
      activeOpacity={0.7}
    >
      <Text
        style={{
          fontFamily: theme.typography.fontFamily,
          fontSize: 16,
          fontWeight: getPlatformFontWeight('600'),
          color: theme.colors.primary,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={28} color={theme.colors.primary} />
    </TouchableOpacity>
  );
};

const ExpensesStack = () => {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={getCommonStackOptions(theme)}
    >
      <Stack.Screen
        name="ExpensesList"
        component={ExpensesScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: 'سجل المصاريف',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('ManageCategories', { type: 'expense' })}
              style={{
                marginLeft: isRTL ? 0 : 16,
                marginRight: isRTL ? 16 : 0,
                padding: 8,
              }}
            >
              <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="ManageCategories"
        component={ManageCategoriesScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: 'إدارة الفئات',
          headerLeft: () => <HeaderBackWithLabel navigation={navigation} label="سجل المصاريف" />,
          headerBackTitleVisible: false,
          headerBackTitle: '',
        })}
      />
      <Stack.Screen
        name="AddCategory"
        component={AddCategoryScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};

const IncomeStack = () => {
  const { theme } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={getCommonStackOptions(theme)}
    >
      <Stack.Screen
        name="IncomeList"
        component={IncomeScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: 'سجل الدخل',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('ManageCategories', { type: 'income' })}
              style={{
                marginLeft: isRTL ? 0 : 16,
                marginRight: isRTL ? 16 : 0,
                padding: 8,
              }}
            >
              <Ionicons name="settings-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="ManageCategories"
        component={ManageCategoriesScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: 'إدارة الفئات',
          headerLeft: () => <HeaderBackWithLabel navigation={navigation} label="سجل الدخل" />,
          headerBackTitleVisible: false,
          headerBackTitle: '',
        })}
      />
      <Stack.Screen
        name="AddCategory"
        component={AddCategoryScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>

  );
};


const InsightsStack = () => {
  const { theme } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={getCommonStackOptions(theme)}
    >
      <Stack.Screen
        name="InsightsMain"
        component={InsightsScreen}
        options={({ navigation }) => ({
          headerTitle: 'التحليل المالي',
          headerRight: () => (
            <TouchableOpacity
              onPress={async () => {
                try {
                  const [token, user] = await Promise.all([
                    authStorage.getAccessToken(),
                    authStorage.getUser(),
                  ]);
                  console.log('[AI Insights] Insights tab button:', { hasToken: !!token, hasUser: !!user });
                  if (!token || !user) {
                    console.log('[AI Insights] No auth -> showing login alert');
                    alertService.show({
                      title: 'تسجيل الدخول',
                      message: 'يجب تسجيل الدخول أو إنشاء حساب لاستخدام التحليل الذكي.',
                      confirmText: 'تسجيل الدخول',
                      cancelText: 'إلغاء',
                      showCancel: true,
                      onConfirm: () => navigation.getParent()?.navigate('Auth'),
                    });
                    return;
                  }
                  navigation.getParent()?.navigate('AISmartInsights');
                } catch (e) {
                  console.error('AI header button error:', e);
                  alertService.error('خطأ', 'حدث خطأ. تأكد من تسجيل الدخول وحاول مرة أخرى.');
                }
              }}
              style={{ marginLeft: 16, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="sparkles" size={22} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontWeight: getPlatformFontWeight('600'), fontSize: 15 }}>رؤى ذكية</Text>
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
};


const DebtsStack = () => {
  const { theme } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="DebtsList"
        component={DebtsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerLeft: () => <HeaderLeft navigation={navigation} />,
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
          headerLeft: () => <HeaderLeft navigation={navigation} />,
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
        })}
      />
      <Stack.Screen
        name="AddDebt"
        component={AddDebtScreen}
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          cardStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack.Navigator>
  );
};

const BillsStack = () => {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="BillsList"
        component={BillsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerLeft: () => <HeaderLeft navigation={navigation} />,
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
          headerShown: true,
          headerLeft: () => <HeaderLeft navigation={navigation} />,
          headerTitle: 'تفاصيل الفاتورة',
          ...getCommonStackOptions(theme),
        })}
      />
      <Stack.Screen
        name="AddBill"
        component={AddBillScreen}
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
    </Stack.Navigator>
  );
};

const DashboardStack = () => {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={getCommonStackOptions(theme)}
    >
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: 'دنانير',
          headerRight: () => <DashboardHeaderRight navigation={navigation} />,
          headerTitleStyle: {
            fontFamily: theme.typography.fontFamily,
            fontSize: 22,
            fontWeight: getPlatformFontWeight('800'),
            color: theme.colors.primary,
          }
        })}
      />
    </Stack.Navigator>
  );
};

const MainTabs = () => {
  const { theme } = useAppTheme(); // Need theme here too
  const insets = useSafeAreaInsets();
  const minBottomInset = Platform.OS === 'android' ? 24 : 20;
  const tabBottomPadding = Math.max(insets.bottom, minBottomInset);
  const tabBaseHeight = Platform.OS === 'android' ? 68 : 70;

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.surfaceCard,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: 20,
          fontWeight: getPlatformFontWeight('700'),
          color: theme.colors.textPrimary,
        },
        headerTitleAlign: 'center',
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
                backgroundColor: theme.colors.primary + '15', // Ultra light background
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
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceCard,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          height: tabBaseHeight + tabBottomPadding,
          paddingBottom: tabBottomPadding,
          paddingTop: Platform.OS === 'android' ? 10 : 12,
          elevation: 20,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          display: 'flex',
        },
        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily,
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          textAlign: 'center',
        },
      })}
    >
      <Tab.Screen
        name="Settings"
        component={SettingsScreenStack}
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
  );
};

export const AppNavigator = () => {
  const { theme } = useAppTheme();
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  React.useEffect(() => {
    onboardingStorage.getHasSeenOnboarding().then((seen) => {
      setHasSeenOnboarding(seen);
      setIsLoadingOnboarding(false);
    });
  }, []);

  if (isLoadingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      direction={isRTL ? 'rtl' : 'ltr'}
      onReady={() => {
      }}
    >
      <Stack.Navigator
        initialRouteName={hasSeenOnboarding ? "Main" : "Onboarding"}
        screenOptions={{ headerShown: false }}
      >
        {!hasSeenOnboarding && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{
            gestureEnabled: true,
            presentation: 'transparentModal',
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="AddExpense"
          component={AddExpenseScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="AddIncome"
          component={AddIncomeScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />

        {/* Moved screens to root to hide tab bar */}
        <Stack.Screen
          name="Goals"
          component={GoalsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'الأهداف المالية',
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('AddGoal')}
                style={{
                  marginRight: isRTL ? 0 : 16,
                  marginLeft: isRTL ? 16 : 0,
                  padding: 8,
                }}
              >
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme),
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
          name="GoalPlan"
          component={GoalPlanScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'خطة الهدف',
            ...getCommonStackOptions(theme),
          })}
        />
        <Stack.Screen
          name="Budget"
          component={BudgetScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'الميزانية',
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('AddBudget')}
                style={{
                  marginRight: isRTL ? 0 : 16,
                  marginLeft: isRTL ? 16 : 0,
                  padding: 8,
                }}
              >
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme),
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
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'محول العملات',
            ...getCommonStackOptions(theme),
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
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'الإنجازات',
            ...getCommonStackOptions(theme),
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
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'التحديات',
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Challenges', { action: 'add' })}
                style={{
                  marginRight: isRTL ? 0 : 16,
                  marginLeft: isRTL ? 16 : 0,
                  padding: 8,
                }}
              >
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme),
          })}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'الإشعارات',
            ...getCommonStackOptions(theme),
          })}
        />
        <Stack.Screen
          name="AISmartInsights"
          component={AISmartInsightsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'التحليلات الذكية',
            ...getCommonStackOptions(theme),
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
