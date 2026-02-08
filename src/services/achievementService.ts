import {
  getAchievements,
  getAchievement,
  addAchievement,
  updateAchievement,
  unlockAchievement,
  Achievement,
} from '../database/database';
import { getChallenges } from '../database/database';
import { getExpenses, getIncome } from '../database/database';
import { sendAchievementUnlockedNotification } from './notificationService';

// Flag to prevent concurrent achievement checks
let isCheckingAchievements = false;
let pendingCheck = false;

export type AchievementType =
  | 'first_expense'
  | 'first_income'
  | 'first_challenge'
  | 'challenge_master'
  | 'saver'
  | 'budget_keeper'
  | 'debt_free'
  | 'expense_tracker'
  | 'goal_achiever'
  | 'monthly_hero';

export type AchievementCategory = 'tracking' | 'challenges' | 'saving' | 'goals' | 'milestones';

export interface AchievementDefinition {
  type: AchievementType;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  targetProgress: number;
  checkCondition: () => Promise<number>;
}

export const ACHIEVEMENT_DEFINITIONS: Record<AchievementType, AchievementDefinition> = {
  first_expense: {
    type: 'first_expense',
    title: 'أول مصروف',
    description: 'سجل أول مصروف لك',
    icon: 'receipt-outline',
    category: 'tracking',
    targetProgress: 1,
    checkCondition: async () => {
      const { getExpensesCount } = await import('../database/database');
      const count = await getExpensesCount();
      return count > 0 ? 1 : 0;
    },
  },
  first_income: {
    type: 'first_income',
    title: 'أول دخل',
    description: 'سجل أول دخل لك',
    icon: 'cash-outline',
    category: 'tracking',
    targetProgress: 1,
    checkCondition: async () => {
      const { getIncomeCount } = await import('../database/database');
      const count = await getIncomeCount();
      return count > 0 ? 1 : 0;
    },
  },
  first_challenge: {
    type: 'first_challenge',
    title: 'تحدي أول',
    description: 'أكمل أول تحدٍ لك',
    icon: 'flag-outline',
    category: 'challenges',
    targetProgress: 1,
    checkCondition: async () => {
      const challenges = await getChallenges();
      const completed = challenges.filter(c => c.completed);
      return completed.length > 0 ? 1 : 0;
    },
  },
  challenge_master: {
    type: 'challenge_master',
    title: 'سيد التحديات',
    description: 'أكمل 10 تحديات',
    icon: 'trophy-outline',
    category: 'challenges',
    targetProgress: 10,
    checkCondition: async () => {
      const challenges = await getChallenges();
      const completed = challenges.filter(c => c.completed);
      return completed.length;
    },
  },
  saver: {
    type: 'saver',
    title: 'مدخر',
    description: 'ادخر 100,000 دينار',
    icon: 'wallet-outline',
    category: 'saving',
    targetProgress: 100000,
    checkCondition: async () => {
      const { getFinancialStatsAggregated } = await import('../database/database');
      const stats = await getFinancialStatsAggregated();
      return Math.max(0, stats.balance);
    },
  },
  budget_keeper: {
    type: 'budget_keeper',
    title: 'حافظ الميزانية',
    description: 'حافظ على ميزانيتك لمدة 30 يوم',
    icon: 'shield-outline',
    category: 'saving',
    targetProgress: 30,
    checkCondition: async () => {
      // This would need to check budget compliance over time
      // For now, return a placeholder
      return 0;
    },
  },
  debt_free: {
    type: 'debt_free',
    title: 'خالي من الديون',
    description: 'سدد جميع ديونك',
    icon: 'checkmark-circle-outline',
    category: 'milestones',
    targetProgress: 1,
    checkCondition: async () => {
      // This would need to check if all debts are paid
      // For now, return a placeholder
      return 0;
    },
  },
  expense_tracker: {
    type: 'expense_tracker',
    title: 'متتبع المصاريف',
    description: 'سجل 100 مصروف',
    icon: 'list-outline',
    category: 'tracking',
    targetProgress: 100,
    checkCondition: async () => {
      const { getExpensesCount } = await import('../database/database');
      return await getExpensesCount();
    },
  },
  goal_achiever: {
    type: 'goal_achiever',
    title: 'محقق الأهداف',
    description: 'حقق 3 أهداف مالية',
    icon: 'star-outline',
    category: 'goals',
    targetProgress: 3,
    checkCondition: async () => {
      // This would need to check completed goals
      // For now, return a placeholder
      return 0;
    },
  },
  monthly_hero: {
    type: 'monthly_hero',
    title: 'بطل الشهر',
    description: 'سجل مصاريفك كل يوم لمدة شهر',
    icon: 'calendar-outline',
    category: 'tracking',
    targetProgress: 30,
    checkCondition: async () => {
      const expenses = await getExpenses();
      const uniqueDays = new Set(expenses.map(e => e.date));
      return uniqueDays.size;
    },
  },
};

/**
 * Initialize achievements in database
 */
export const initializeAchievements = async (): Promise<void> => {
  try {
    const existingAchievements = await getAchievements();
    const existingTypes = new Set(existingAchievements.map(a => a.type));

    for (const [type, definition] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
      if (!existingTypes.has(type)) {
        await addAchievement({
          type: definition.type,
          title: definition.title,
          description: definition.description,
          icon: definition.icon,
          category: definition.category,
          progress: 0,
          targetProgress: definition.targetProgress,
          isUnlocked: false,
        });
      }
    }
  } catch (error) {
    console.error('Error initializing achievements:', error);
  }
};

/**
 * Check and update all achievements
 * Uses a lock mechanism to prevent concurrent checks
 */
export const checkAllAchievements = async (): Promise<void> => {
  // If already checking, mark that we need to check again after current check completes
  if (isCheckingAchievements) {
    pendingCheck = true;
    return;
  }

  // Set lock
  isCheckingAchievements = true;
  pendingCheck = false;

  try {
    const achievements = await getAchievements();

    for (const achievement of achievements) {
      if (achievement.isUnlocked) {
        continue; // Skip already unlocked achievements
      }

      const definition = ACHIEVEMENT_DEFINITIONS[achievement.type as AchievementType];
      if (!definition) {
        continue;
      }

      const currentProgress = await definition.checkCondition();
      const wasUnlocked = achievement.isUnlocked;
      const isNowUnlocked = currentProgress >= achievement.targetProgress;

      await updateAchievement(achievement.type, {
        progress: currentProgress,
        isUnlocked: isNowUnlocked,
        unlockedAt: isNowUnlocked ? new Date().toISOString() : undefined,
      });

      // Send notification if just unlocked
      if (isNowUnlocked && !wasUnlocked) {
        // Get updated achievement data for notification
        const updatedAchievement = await getAchievement(achievement.type);
        if (updatedAchievement) {
          await sendAchievementUnlockedNotification(updatedAchievement);
        } else {
          // Fallback to original achievement data
          await sendAchievementUnlockedNotification({
            ...achievement,
            isUnlocked: true,
            unlockedAt: new Date().toISOString(),
            progress: currentProgress,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error);
  } finally {
    // Release lock
    isCheckingAchievements = false;

    // If there was a pending check, run it now
    if (pendingCheck) {
      // Use setTimeout to avoid immediate recursion
      setTimeout(() => {
        checkAllAchievements().catch(err => console.error('Error in pending achievement check:', err));
      }, 100);
    }
  }
};

/**
 * Get achievements grouped by category
 */
export const getAchievementsByCategory = async (): Promise<Record<string, Achievement[]>> => {
  const achievements = await getAchievements();
  const grouped: Record<string, Achievement[]> = {};

  achievements.forEach(achievement => {
    if (!grouped[achievement.category]) {
      grouped[achievement.category] = [];
    }
    grouped[achievement.category].push(achievement);
  });

  return grouped;
};

/**
 * Get unlocked achievements count
 */
export const getUnlockedAchievementsCount = async (): Promise<number> => {
  const achievements = await getAchievements();
  return achievements.filter(a => a.isUnlocked).length;
};

/**
 * Get total achievements count
 */
export const getTotalAchievementsCount = async (): Promise<number> => {
  const achievements = await getAchievements();
  return achievements.length;
};
