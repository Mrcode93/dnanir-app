import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  I18nManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, List, Switch, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../utils/theme';
import { getUserSettings, getAppSettings, upsertAppSettings } from '../database/database';

export const SettingsScreen = () => {
  const [userName, setUserName] = useState<string>('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings();
      if (userSettings?.name) {
        setUserName(userSettings.name);
      }

      const appSettings = await getAppSettings();
      if (appSettings) {
        setNotificationsEnabled(appSettings.notificationsEnabled);
        setDarkModeEnabled(appSettings.darkModeEnabled);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    const appSettings = await getAppSettings();
    if (appSettings) {
      await upsertAppSettings({ ...appSettings, notificationsEnabled: value });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* App Info */}
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.sectionCard}
        >
          <View style={styles.sectionContent}>
            <View style={styles.appInfoHeader}>
              <View style={styles.appIconContainer} />
              <View style={styles.appInfo}>
                <Text style={styles.appName}>دنانير</Text>
                {userName && <Text style={styles.userName}>مرحباً، {userName}</Text>}
                <Text style={styles.appDescription}>تطبيقك الذكي لإدارة الأموال</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Settings */}
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.sectionCard}
        >
          <View style={styles.sectionContent}>
            <Text style={styles.sectionTitle}>الإعدادات العامة</Text>
            
            <List.Item
              title="الإشعارات"
              description="تلقي تنبيهات حول المصاريف والأهداف"
              left={(props) => <List.Icon {...props} icon="bell" color={theme.colors.primary} />}
              right={() => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              )}
              titleStyle={styles.listItemTitle}
              descriptionStyle={styles.listItemDescription}
            />
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  sectionCard: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  sectionContent: {
    padding: theme.spacing.lg,
  },
  appInfoHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  appIconContainer: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary,
    ...(I18nManager.isRTL ? { marginLeft: theme.spacing.md } : { marginRight: theme.spacing.md }),
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  userName: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  appDescription: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  listItemTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
  },
  listItemDescription: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.sm,
  },
});
