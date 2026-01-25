import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import {
  getAchievements,
  Achievement,
} from '../database/database';
import {
  getAchievementsByCategory,
  getUnlockedAchievementsCount,
  getTotalAchievementsCount,
  checkAllAchievements,
  AchievementCategory,
} from '../services/achievementService';
import { shareAchievement, shareAchievements } from '../services/shareService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';

const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  tracking: 'التتبع',
  challenges: 'التحديات',
  saving: 'الادخار',
  goals: 'الأهداف',
  milestones: 'المعالم',
};

export const AchievementsScreen = ({ navigation }: any) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const loadAchievements = async () => {
    try {
      await checkAllAchievements(); // Update progress
      const allAchievements = await getAchievements();
      setAchievements(allAchievements);
      
      const unlocked = await getUnlockedAchievementsCount();
      const total = await getTotalAchievementsCount();
      setUnlockedCount(unlocked);
      setTotalCount(total);
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  };

  useEffect(() => {
    loadAchievements();
    const unsubscribe = navigation.addListener('focus', loadAchievements);
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAchievements();
    setRefreshing(false);
  };

  const handleShareAchievement = async (achievement: Achievement) => {
    try {
      await shareAchievement(achievement);
    } catch (error) {
      console.error('Error sharing achievement:', error);
    }
  };

  const handleShareAll = async () => {
    try {
      await shareAchievements(achievements);
    } catch (error) {
      console.error('Error sharing achievements:', error);
    }
  };

  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory);

  const unlockedAchievements = filteredAchievements.filter(a => a.isUnlocked);
  const lockedAchievements = filteredAchievements.filter(a => !a.isUnlocked);

  const getProgressPercentage = (achievement: Achievement): number => {
    if (achievement.targetProgress === 0) return 0;
    return Math.min(100, (achievement.progress / achievement.targetProgress) * 100);
  };

  const renderAchievementCard = (achievement: Achievement) => {
    const progress = getProgressPercentage(achievement);
    const isUnlocked = achievement.isUnlocked;

    return (
      <View
        key={achievement.id}
        style={[
          styles.achievementCard,
          isUnlocked && styles.achievementCardUnlocked,
        ]}
      >
        <View style={styles.achievementHeader}>
          <View style={[
            styles.achievementIconContainer,
            isUnlocked && styles.achievementIconContainerUnlocked,
          ]}>
            <Ionicons
              name={achievement.icon as any}
              size={32}
              color={isUnlocked ? theme.colors.success : theme.colors.textMuted}
            />
            {isUnlocked && (
              <View style={styles.unlockedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              </View>
            )}
          </View>
          <View style={styles.achievementInfo}>
            <Text style={[
              styles.achievementTitle,
              !isUnlocked && styles.achievementTitleLocked,
            ]}>
              {achievement.title}
            </Text>
            <Text style={[
              styles.achievementDescription,
              !isUnlocked && styles.achievementDescriptionLocked,
            ]}>
              {achievement.description}
            </Text>
            {achievement.unlockedAt && (
              <Text style={styles.achievementDate}>
                تم الفتح: {new Date(achievement.unlockedAt).toLocaleDateString('ar-IQ')}
              </Text>
            )}
          </View>
          {isUnlocked && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShareAchievement(achievement)}
            >
              <Ionicons name="share-social" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <LinearGradient
              colors={
                isUnlocked
                  ? [theme.colors.success, theme.colors.success]
                  : [theme.colors.primary, theme.colors.primary]
              }
              style={[styles.progressFill, { width: `${progress}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress)}% ({achievement.progress.toFixed(0)} / {achievement.targetProgress.toFixed(0)})
          </Text>
        </View>
      </View>
    );
  };

  const progressPercentage = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with Stats */}
      <View style={styles.header}>
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="trophy" size={32} color={theme.colors.textInverse} />
              </View>
              <View>
                <Text style={styles.headerTitle}>الإنجازات</Text>
                <Text style={styles.headerSubtitle}>
                  {unlockedCount} من {totalCount} إنجاز
                </Text>
              </View>
            </View>
            {unlockedCount > 0 && (
              <TouchableOpacity
                style={styles.shareAllButton}
                onPress={handleShareAll}
              >
                <Ionicons name="share-social" size={24} color={theme.colors.textInverse} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.progressContainerHeader}>
            <View style={styles.progressBarHeader}>
              <LinearGradient
                colors={[theme.colors.textInverse, theme.colors.textInverse]}
                style={[styles.progressFillHeader, { width: `${progressPercentage}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={styles.progressTextHeader}>
              {Math.round(progressPercentage)}% مكتمل
            </Text>
          </View>
        </LinearGradient>
      </View>

      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            onPress={() => setSelectedCategory('all')}
            style={styles.filterButton}
          >
            {selectedCategory === 'all' ? (
              <LinearGradient
                colors={theme.gradients.primary as any}
                style={styles.filterButtonGradient}
              >
                <Text style={styles.filterButtonTextActive}>الكل</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.filterButtonText}>الكل</Text>
            )}
          </TouchableOpacity>
          {Object.entries(ACHIEVEMENT_CATEGORY_LABELS).map(([key, label]) => {
            const isSelected = selectedCategory === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSelectedCategory(key as AchievementCategory)}
                style={styles.filterButton}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.filterButtonGradient}
                  >
                    <Text style={styles.filterButtonTextActive}>{label}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.filterButtonText}>{label}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الإنجازات المفتوحة</Text>
            {unlockedAchievements.map((achievement) => renderAchievementCard(achievement))}
          </View>
        )}

        {/* Locked Achievements */}
        {lockedAchievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الإنجازات المقفلة</Text>
            {lockedAchievements.map((achievement) => renderAchievementCard(achievement))}
          </View>
        )}

        {/* Empty State */}
        {filteredAchievements.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyStateTitle}>لا توجد إنجازات بعد</Text>
            <Text style={styles.emptyStateText}>
              استمر في استخدام التطبيق لفتح الإنجازات
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,

  },
  header: {
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    margin: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...getPlatformShadow('lg'),
  },
  headerGradient: {
    padding: theme.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
  },
  shareAllButton: {
    padding: theme.spacing.sm,
  },
  progressContainerHeader: {
    marginTop: theme.spacing.md,
  },
  progressBarHeader: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFillHeader: {
    height: '100%',
    borderRadius: theme.borderRadius.round,
  },
  progressTextHeader: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  filterContainer: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    direction: 'rtl',
  },
  filterRow: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    flexDirection: isRTL ? 'row' : 'row',
  },
  filterButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  filterButtonGradient: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  filterButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
  },
  filterButtonTextActive: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  achievementCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...getPlatformShadow('md'),
    opacity: 0.7,
  },
  achievementCardUnlocked: {
    borderColor: theme.colors.success,
    opacity: 1,
  },
  achievementHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  achievementIconContainer: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    position: 'relative',
  },
  achievementIconContainerUnlocked: {
    backgroundColor: theme.colors.success + '20',
  },
  unlockedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 12,
    ...getPlatformShadow('sm'),
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  achievementTitleLocked: {
    color: theme.colors.textMuted,
  },
  achievementDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  achievementDescriptionLocked: {
    color: theme.colors.textMuted,
  },
  achievementDate: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.success,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
  },
  shareButton: {
    padding: theme.spacing.sm,
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.round,
  },
  progressText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
    lineHeight: 24,
  },
});
