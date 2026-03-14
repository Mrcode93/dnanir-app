import { Share } from 'react-native';
import { Achievement } from '../database/database';

/**
 * Share an achievement
 */
export const shareAchievement = async (achievement: Achievement): Promise<void> => {
  try {
    const shareText = `🏆 حصلت على إنجاز جديد في دنانير!\n\n${achievement.title}\n${achievement.description}\n\n#دنانير #إدارة_مالية`;
    
    await Share.share({
      message: shareText,
      title: 'إنجاز جديد في دنانير',
    });
  } catch (error: any) {
    // User cancelled or error
    if (error.message !== 'User did not share') {
      
    }
  }
};

/**
 * Share multiple achievements
 */
export const shareAchievements = async (achievements: Achievement[]): Promise<void> => {
  try {
    const unlockedCount = achievements.filter(a => a.isUnlocked).length;
    const totalCount = achievements.length;
    
    const shareText = `🏆 إنجازاتي في دنانير\n\nحصلت على ${unlockedCount} من ${totalCount} إنجاز!\n\n#دنانير #إدارة_مالية`;
    
    await Share.share({
      message: shareText,
      title: 'إنجازاتي في دنانير',
    });
  } catch (error: any) {
    // User cancelled or error
    if (error.message !== 'User did not share') {
      
    }
  }
};

/**
 * Share challenge completion
 */
export const shareChallengeCompletion = async (challengeTitle: string): Promise<void> => {
  try {
    const shareText = `🎉 أكملت تحدياً في دنانير!\n\n${challengeTitle}\n\n#دنانير #تحديات_مالية`;
    
    await Share.share({
      message: shareText,
      title: 'إكمال تحدٍ في دنانير',
    });
  } catch (error: any) {
    // User cancelled or error
    if (error.message !== 'User did not share') {
      
    }
  }
};
