import React, { useState, useCallback } from 'react';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Platform, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
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
import { AdvancedReportsScreen } from '../screens/AdvancedReportsScreen';
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
import { authModalService } from '../services/authModalService';
import { AddDebtScreen } from '../screens/AddDebtScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { usePrivacy } from '../context/PrivacyContext';
import { authStorage } from '../services/authStorage';
import { onboardingStorage } from '../services/onboardingStorage';
import { syncNewToServer } from '../services/syncService';
import { alertService } from '../services/alertService';
import { OnboardingScreen } from '../screens/OnboardingScreen';

import { CalendarScreen } from '../screens/CalendarScreen';
import { SavingsScreen } from '../screens/SavingsScreen';
import { AddSavingsScreen } from '../screens/AddSavingsScreen';



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
      alertService.toastSuccess(result.count > 0 ? `تم رفع ${result.count} عنصر` : 'لا توجد بيانات جديدة');
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
          color={isPrivacyEnabled ? "#FFFFFF" : "rgba(255, 255, 255, 0.7)"}
        />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('Notifications')}
        style={{ padding: 6 }}
      >
        <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const getCommonStackOptions = (theme: AppTheme, topInset: number = Platform.OS === 'ios' ? 44 : 24) => ({
  ...TransitionPresets.SlideFromRightIOS,
  headerStyle: {
    backgroundColor: theme.colors.background,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
    height: topInset + 70,
  },
  headerBackground: () => (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{
        flex: 1,
        backgroundColor: '#003459',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        ...(Platform.OS === 'ios' ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        } : {
          elevation: 10,
        })
      }} />
    </View>
  ),
  headerTitleStyle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    marginBottom: 0,
  },
  headerTitleAlign: 'center' as const,
  headerTintColor: '#FFFFFF',
  headerLeftContainerStyle: {
    paddingBottom: 0,
  },
  headerRightContainerStyle: {
    paddingBottom: 0,
  },
});


const SettingsScreenStack = () => {
  const { theme } = useAppTheme();
  const { top } = useSafeAreaInsets();
  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonStackOptions(theme, top),
        headerTitleStyle: {
          ...getCommonStackOptions(theme, top).headerTitleStyle,
          fontSize: 18,
        }
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          headerTitle: 'الإعدادات',
        }}
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
        marginLeft: 16,
        marginRight: isRTL ? 16 : 0,
        padding: 8,
      }}
    >
      <Ionicons name="close" size={28} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const HeaderBackWithLabel = ({ navigation, label }: { navigation: any; label: string }) => {
  const { theme } = useAppTheme();
  return (
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={{
        marginLeft: 16,
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

const TopTab = createMaterialTopTabNavigator();

const TransactionsTabs = () => {
  const { theme } = useAppTheme();
  return (
    <TopTab.Navigator
      initialRouteName="IncomeList"
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarIndicatorStyle: { backgroundColor: theme.colors.primary, height: 3 },
        tabBarStyle: { backgroundColor: theme.colors.surface },
        tabBarLabelStyle: { fontFamily: theme.typography.fontFamily, fontWeight: getPlatformFontWeight('700'), fontSize: 14 },
      }}
    >
      <TopTab.Screen name="ExpensesList" component={ExpensesScreen} options={{ title: 'المصاريف' }} />
      <TopTab.Screen name="IncomeList" component={IncomeScreen} options={{ title: 'الدخل' }} />
    </TopTab.Navigator>
  );
};

const TransactionsStack = () => {
  const { theme } = useAppTheme();
  const { top } = useSafeAreaInsets();
  return (
    <Stack.Navigator screenOptions={getCommonStackOptions(theme, top)}>
      <Stack.Screen
        name="TransactionsTabs"
        component={TransactionsTabs}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: 'المعاملات المالية',
          ...getCommonStackOptions(theme, top),
        })}
      />
    </Stack.Navigator>
  );
};


const InsightsStack = () => {
  const { theme } = useAppTheme();
  const { top } = useSafeAreaInsets();
  return (
    <Stack.Navigator
      screenOptions={getCommonStackOptions(theme, top)}
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
                  
                  if (!token || !user) {
                    
                    alertService.show({
                      title: 'تسجيل الدخول',
                      message: 'يجب تسجيل الدخول أو إنشاء حساب لاستخدام التحليل الذكي.',
                      confirmText: 'تسجيل الدخول',
                      cancelText: 'إلغاء',
                      showCancel: true,
                      onConfirm: () => authModalService.show(),
                    });
                    return;
                  }
                  navigation.getParent()?.navigate('AISmartInsights');
                } catch (e) {
                  
                  alertService.error('خطأ', 'حدث خطأ. تأكد من تسجيل الدخول وحاول مرة أخرى.');
                }
              }}
              style={{ marginLeft: 16, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="sparkles" size={22} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: getPlatformFontWeight('600'), fontSize: 15, fontFamily: theme.typography.fontFamily }}>رؤى ذكية</Text>
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
};


const DebtsStack = () => {
  const { theme } = useAppTheme();
  const { top } = useSafeAreaInsets();
  return (
    <Stack.Navigator screenOptions={{ ...getCommonStackOptions(theme, top) }}>
      <Stack.Screen
        name="DebtsList"
        component={DebtsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerLeft: () => <HeaderLeft navigation={navigation} />,
          headerTitle: () => (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            
              <Text style={{
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.sizes.lg,
                fontWeight: getPlatformFontWeight('700'),
                color: '#FFFFFF',
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
            backgroundColor: '#003459',
            borderBottomWidth: 0,
            height: top + 70,
          },
          headerTintColor: '#FFFFFF',
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
              <Ionicons name="add-circle" size={28} color="#FFFFFF" />
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
              <Ionicons name="document" size={24} color="#FFFFFF" />
              <Text style={{
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.sizes.lg,
                fontWeight: getPlatformFontWeight('700'),
                color: '#FFFFFF',
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
            backgroundColor: '#003459',
            borderBottomWidth: 0,
            height: top + 70,
          },
          headerTintColor: '#FFFFFF',
          headerBackTitleVisible: false,
          headerBackTitle: '',
        })}
      />
    </Stack.Navigator>
  );
};

const BillsStack = () => {
  const { theme } = useAppTheme();
  const { top } = useSafeAreaInsets();
  return (
    <Stack.Navigator screenOptions={{ ...getCommonStackOptions(theme, top) }}>
      <Stack.Screen
        name="BillsList"
        component={BillsScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerLeft: () => <HeaderLeft navigation={navigation} />,
          headerTitle: () => (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
             
              <Text style={{
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.sizes.lg,
                fontWeight: getPlatformFontWeight('700'),
                color: '#FFFFFF',
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
            backgroundColor: '#003459',
            borderBottomWidth: 0,
            height: top + 70,
          },
          headerTintColor: '#FFFFFF',
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
              <Ionicons name="add-circle" size={28} color="#FFFFFF" />
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
          ...getCommonStackOptions(theme, top),
        })}
      />
    </Stack.Navigator>
  );
};

const DashboardStack = () => {
  const { theme } = useAppTheme();
  const { top } = useSafeAreaInsets();
  return (
    <Stack.Navigator
      screenOptions={getCommonStackOptions(theme, top)}
    >
      <Stack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

const EmptyComponent = () => null;

const MainTabs = () => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const minBottomInset = 10;
  const tabBottomPadding = Math.max(insets.bottom, minBottomInset);
  const tabBaseHeight = 68;

  return (
    <>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarShowLabel: true,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceCard,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            height: tabBaseHeight + tabBottomPadding,
            paddingBottom: tabBottomPadding,
            paddingTop: 12,
            elevation: 20,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            flexDirection: isRTL ? 'row' : 'row-reverse',
          },
          tabBarLabelStyle: {
            fontFamily: theme.typography.fontFamily,
            fontSize: 12,
            fontWeight: getPlatformFontWeight('500'),
            marginTop: 4,
            textAlign: 'center',
          },
        })}
      >
        <Tab.Screen
          name="Settings"
          component={SettingsScreenStack}
          options={{
            title: 'الإعدادات',
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'cog' : 'cog-outline'} size={24} color={focused ? theme.colors.primary : '#94A3B8'} />
            ),
          }}
        />
        <Tab.Screen
          name="Insights"
          component={InsightsStack}
          options={{
            title: 'التحليلات',
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={24} color={focused ? theme.colors.primary : '#94A3B8'} />
            ),
          }}
        />
        <Tab.Screen
          name="SmartAdd"
          component={EmptyComponent}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              navigation.navigate('SmartAddAction');
            },
          })}
          options={{
            title: '', // No title
            tabBarIcon: () => (
              <View style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: theme.colors.surfaceCard,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -30,
                ...getPlatformShadow('lg'),
                padding: 4,
              }}>
                <LinearGradient
                  colors={['#003459', '#0077B6', '#00A8E8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Ionicons name="mic" size={32} color="#FFFFFF" />

                  {/* Inner Glow effect overlay */}
                  <View style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: 30,
                    borderWidth: 1.5,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }} />
                </LinearGradient>
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Transactions"
          component={TransactionsStack}
          options={{
            title: 'المعاملات',
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'swap-horizontal' : 'swap-horizontal-outline'} size={24} color={focused ? theme.colors.primary : '#94A3B8'} />
            ),
          }}
        />
        <Tab.Screen
          name="Dashboard"
          component={DashboardStack}
          options={{
            title: 'الرئيسية',
            tabBarIcon: ({ focused }) => (
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={focused ? theme.colors.primary : '#94A3B8'} />
            ),
          }}
        />
      </Tab.Navigator>
    </>
  );
};

import { SmartAddActionScreen } from '../screens/SmartAddActionScreen';

const linking = {
  prefixes: ['dnanir://', 'exp://', 'https://dnanir.app'],
  config: {
    screens: {
      Main: {
        path: '',
        screens: {
          Dashboard: 'dashboard',
          Transactions: 'transactions',
          Insights: 'insights',
          Settings: 'settings',
        },
      },
      AddExpense: 'add-expense',
      AddIncome: 'add-income',
      SmartAddAction: 'smart-add',
    },
  },
};

export const AppNavigator = () => {
  const { theme } = useAppTheme();
  const { top } = useSafeAreaInsets();
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
      linking={linking}
      direction={isRTL ? 'ltr' : 'rtl'}
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
          name="AddExpense"
          component={AddExpenseScreen}
          options={{
            headerShown: false,
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="AddIncome"
          component={AddIncomeScreen}
          options={{
            headerShown: false,
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="SmartAddAction"
          component={SmartAddActionScreen}
          options={{
            headerShown: false,
            presentation: 'transparentModal' as const,
            cardStyle: { backgroundColor: 'transparent' },
          }}
        />

        <Stack.Screen
          name="ManageCategories"
          component={ManageCategoriesScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="AddCategory"
          component={AddCategoryScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="AdvancedReports"
          component={AdvancedReportsScreen}
          options={({ navigation }) => ({
            headerTitle: 'التقارير المتطورة',
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            ...getCommonStackOptions(theme, top),
          })}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={({ navigation }) => ({
            headerTitle: 'الملف الشخصي',
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            ...getCommonStackOptions(theme, top),
          })}
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
                <Ionicons name="add-circle" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme, top),
          })}
        />

        <Stack.Screen
          name="Savings"
          component={SavingsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'الحصالة - توفير مالي',
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('AddSavings')}
                style={{
                  marginRight: isRTL ? 0 : 16,
                  marginLeft: isRTL ? 16 : 0,
                  padding: 8,
                }}
              >
                <Ionicons name="add-circle" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme, top),
          })}
        />

        <Stack.Screen
          name="AddSavings"
          component={AddSavingsScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="AddBill"
          component={AddBillScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="AddDebt"
          component={AddDebtScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />

        <Stack.Screen
          name="AddGoal"
          component={AddGoalScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="GoalPlan"
          component={GoalPlanScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'خطة الهدف',
            ...getCommonStackOptions(theme, top),
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
                  marginRight: 16,
                  padding: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="add-circle" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme, top),
          })}
        />
        <Stack.Screen
          name="AddBudget"
          component={AddBudgetScreen}
          options={{
            headerShown: false,
            presentation: 'modal',
            ...TransitionPresets.ModalSlideFromBottomIOS,
          }}
        />
        <Stack.Screen
          name="CurrencyConverter"
          component={CurrencyConverterScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'محول العملات',
            ...getCommonStackOptions(theme, top),
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
            ...getCommonStackOptions(theme, top),
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
                <Ionicons name="add-circle" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme, top),
          })}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'الإشعارات',
            ...getCommonStackOptions(theme, top),
          })}
        />
        <Stack.Screen
          name="AISmartInsights"
          component={AISmartInsightsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerTitle: 'التحليلات الذكية',
            ...getCommonStackOptions(theme, top),
          })}
        />

        <Stack.Screen
          name="Calendar"
          component={CalendarScreen}
          options={({ navigation }) => ({
            headerShown: true,
            headerTitle: 'التقويم المالي',
            headerLeft: () => <HeaderLeft navigation={navigation} />,
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.setParams({ action: 'today' })}
                style={{
                  marginRight: isRTL ? 0 : 16,
                  marginLeft: isRTL ? 16 : 0,
                  padding: 8,
                }}
              >
                <Ionicons name="calendar-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            ),
            ...getCommonStackOptions(theme, top),
          })}
        />
      </Stack.Navigator>

    </NavigationContainer>
  );
};
