import {
  getChallenges,
  getChallenge,
  addChallenge,
  updateChallenge,
  deleteChallenge,
  Challenge,
} from '../database/database';
import {
  getExpenses,
  getIncome,
  getDebts,
  getBudgets,
} from '../database/database';
import {
  ChallengeType,
  CHALLENGE_TYPES,
  Challenge as ChallengeTypeDef,
} from '../types';
import { getCurrentMonthData } from './financialService';

/**
 * Create a new challenge
 */
export const createChallenge = async (
  type: ChallengeType,
  customTarget?: number,
  customDuration?: number
): Promise<number> => {
  if (type === 'custom') {
    throw new Error('Use createCustomChallenge for custom challenges');
  }

  const challengeDef = CHALLENGE_TYPES[type];
  const duration = customDuration || challengeDef.defaultDuration || 7;
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + duration);

  const targetValue = customTarget || challengeDef.defaultTarget;
  const targetProgress = getTargetProgressForType(type, duration);

  const challenge: Omit<Challenge, 'id' | 'createdAt'> = {
    type,
    title: challengeDef.title,
    description: challengeDef.description,
    category: challengeDef.category,
    icon: challengeDef.icon,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    targetValue,
    currentProgress: 0,
    targetProgress,
    completed: false,
    isCustom: false,
  };

  return await addChallenge(challenge);
};

/**
 * Create a custom challenge
 */
export const createCustomChallenge = async (
  title: string,
  description: string,
  category: import('../types').ChallengeCategory,
  icon: string,
  duration: number,
  targetProgress: number,
  targetValue?: number
): Promise<number> => {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + duration);

  const challenge: Omit<Challenge, 'id' | 'createdAt'> = {
    type: 'custom',
    title,
    description,
    category,
    icon,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    targetValue,
    currentProgress: 0,
    targetProgress,
    completed: false,
    isCustom: true,
  };

  return await addChallenge(challenge);
};

/**
 * Get target progress value based on challenge type
 */
const getTargetProgressForType = (type: ChallengeType, duration: number): number => {
  switch (type) {
    case 'no_coffee':
    case 'no_delivery':
    case 'log_all_expenses':
    case 'no_missed_days':
      return duration; // Number of days
    case 'daily_budget':
    case 'save_amount':
    case 'emergency_fund':
      return 1; // Binary completion (0 or 1)
    case 'save_percentage':
    case 'reduce_debts':
      return 100; // Percentage
    case 'stay_in_budget':
      return duration; // Number of days
    case 'pay_first_debt':
    case 'complete_loan':
      return 1; // Binary completion
    default:
      return 1;
  }
};

/**
 * Update challenge progress based on current data
 */
export const updateChallengeProgress = async (challengeId: number): Promise<void> => {
  const challenge = await getChallenge(challengeId);
  if (!challenge || challenge.completed) {
    return;
  }

  const progress = await calculateChallengeProgress(challenge);
  const isCompleted = progress >= challenge.targetProgress;
  const wasCompleted = challenge.completed;

  await updateChallenge(challengeId, {
    currentProgress: progress,
    completed: isCompleted,
    completedAt: isCompleted ? new Date().toISOString() : undefined,
  });

  // Send notification if challenge was just completed
  if (isCompleted && !wasCompleted) {
    try {
      const { sendChallengeCompletionNotification } = await import('./notificationService');
      await sendChallengeCompletionNotification(challenge);
      
      // Check achievements after completing challenge (async, don't wait)
      try {
        const { checkAllAchievements } = await import('./achievementService');
        checkAllAchievements().catch(err => console.error('Error checking achievements after challenge completion:', err));
      } catch (error) {
        // Ignore if achievementService is not available
      }
    } catch (error) {
      console.error('Error sending challenge completion notification:', error);
    }
  }
};

/**
 * Calculate current progress for a challenge
 */
const calculateChallengeProgress = async (challenge: Challenge): Promise<number> => {
  const today = new Date();
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);

  // Check if challenge is expired
  if (today > endDate && !challenge.completed) {
    return challenge.currentProgress; // Don't update expired challenges
  }

  // Custom challenges don't auto-calculate progress
  if (challenge.type === 'custom' || challenge.isCustom) {
    return challenge.currentProgress; // User manually updates custom challenges
  }

  switch (challenge.type as ChallengeType) {
    case 'no_coffee':
      return await calculateNoCoffeeProgress(challenge);
    
    case 'no_delivery':
      return await calculateNoDeliveryProgress(challenge);
    
    case 'daily_budget':
      return await calculateDailyBudgetProgress(challenge);
    
    case 'save_amount':
      return await calculateSaveAmountProgress(challenge);
    
    case 'save_percentage':
      return await calculateSavePercentageProgress(challenge);
    
    case 'emergency_fund':
      return await calculateEmergencyFundProgress(challenge);
    
    case 'log_all_expenses':
      return await calculateLogAllExpensesProgress(challenge);
    
    case 'no_missed_days':
      return await calculateNoMissedDaysProgress(challenge);
    
    case 'stay_in_budget':
      return await calculateStayInBudgetProgress(challenge);
    
    case 'pay_first_debt':
      return await calculatePayFirstDebtProgress(challenge);
    
    case 'reduce_debts':
      return await calculateReduceDebtsProgress(challenge);
    
    case 'complete_loan':
      return await calculateCompleteLoanProgress(challenge);
    
    default:
      return 0;
  }
};

/**
 * Calculate progress for "no coffee" challenge
 */
const calculateNoCoffeeProgress = async (challenge: Challenge): Promise<number> => {
  const expenses = await getExpenses();
  const startDate = new Date(challenge.startDate);
  const today = new Date();
  
  // Get unique days without coffee expenses
  const coffeeKeywords = ['قهوة', 'كوفي', 'coffee', 'cafe', 'كافيه'];
  const daysWithCoffee = new Set<string>();
  
  expenses.forEach(expense => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= startDate && expenseDate <= today) {
      const title = expense.title.toLowerCase();
      const category = expense.category.toLowerCase();
      const isCoffee = coffeeKeywords.some(keyword => 
        title.includes(keyword) || category.includes(keyword)
      );
      
      if (isCoffee) {
        daysWithCoffee.add(expense.date);
      }
    }
  });
  
  // Count days since start
  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysWithoutCoffee = daysSinceStart - daysWithCoffee.size;
  
  return Math.max(0, daysWithoutCoffee);
};

/**
 * Calculate progress for "no delivery" challenge
 */
const calculateNoDeliveryProgress = async (challenge: Challenge): Promise<number> => {
  const expenses = await getExpenses();
  const startDate = new Date(challenge.startDate);
  const today = new Date();
  
  const deliveryKeywords = ['دليفري', 'توصيل', 'delivery', 'طلب', 'مطعم', 'restaurant'];
  const daysWithDelivery = new Set<string>();
  
  expenses.forEach(expense => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= startDate && expenseDate <= today) {
      const title = expense.title.toLowerCase();
      const category = expense.category.toLowerCase();
      const isDelivery = deliveryKeywords.some(keyword => 
        title.includes(keyword) || category.includes(keyword)
      );
      
      if (isDelivery) {
        daysWithDelivery.add(expense.date);
      }
    }
  });
  
  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysWithoutDelivery = daysSinceStart - daysWithDelivery.size;
  
  return Math.max(0, daysWithoutDelivery);
};

/**
 * Calculate progress for "daily budget" challenge
 */
const calculateDailyBudgetProgress = async (challenge: Challenge): Promise<number> => {
  const expenses = await getExpenses();
  const startDate = new Date(challenge.startDate);
  const today = new Date();
  const targetAmount = challenge.targetValue || 10000;
  
  // Group expenses by date
  const dailySpending: Record<string, number> = {};
  expenses.forEach(expense => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= startDate && expenseDate <= today) {
      if (!dailySpending[expense.date]) {
        dailySpending[expense.date] = 0;
      }
      dailySpending[expense.date] += expense.amount;
    }
  });
  
  // Count days within budget
  let daysWithinBudget = 0;
  Object.values(dailySpending).forEach(amount => {
    if (amount <= targetAmount) {
      daysWithinBudget++;
    }
  });
  
  return daysWithinBudget;
};

/**
 * Calculate progress for "save amount" challenge
 */
const calculateSaveAmountProgress = async (challenge: Challenge): Promise<number> => {
  const targetAmount = challenge.targetValue || 50000;
  const startDate = new Date(challenge.startDate);
  
  // Get income and expenses in the period
  const income = await getIncome();
  const expenses = await getExpenses();
  
  let totalIncome = 0;
  let totalExpenses = 0;
  
  income.forEach(inc => {
    const incDate = new Date(inc.date);
    if (incDate >= startDate) {
      totalIncome += inc.amount;
    }
  });
  
  expenses.forEach(exp => {
    const expDate = new Date(exp.date);
    if (expDate >= startDate) {
      totalExpenses += exp.amount;
    }
  });
  
  const saved = totalIncome - totalExpenses;
  return saved >= targetAmount ? 1 : 0;
};

/**
 * Calculate progress for "save percentage" challenge
 */
const calculateSavePercentageProgress = async (challenge: Challenge): Promise<number> => {
  const targetPercentage = challenge.targetValue || 10;
  const startDate = new Date(challenge.startDate);
  
  const income = await getIncome();
  const expenses = await getExpenses();
  
  let totalIncome = 0;
  let totalExpenses = 0;
  
  income.forEach(inc => {
    const incDate = new Date(inc.date);
    if (incDate >= startDate) {
      totalIncome += inc.amount;
    }
  });
  
  expenses.forEach(exp => {
    const expDate = new Date(exp.date);
    if (expDate >= startDate) {
      totalExpenses += exp.amount;
    }
  });
  
  if (totalIncome === 0) return 0;
  
  const saved = totalIncome - totalExpenses;
  const actualPercentage = (saved / totalIncome) * 100;
  
  return Math.min(100, Math.max(0, actualPercentage));
};

/**
 * Calculate progress for "emergency fund" challenge
 */
const calculateEmergencyFundProgress = async (challenge: Challenge): Promise<number> => {
  const targetAmount = challenge.targetValue || 100000;
  const startDate = new Date(challenge.startDate);
  
  const income = await getIncome();
  const expenses = await getExpenses();
  
  let totalIncome = 0;
  let totalExpenses = 0;
  
  income.forEach(inc => {
    const incDate = new Date(inc.date);
    if (incDate >= startDate) {
      totalIncome += inc.amount;
    }
  });
  
  expenses.forEach(exp => {
    const expDate = new Date(exp.date);
    if (expDate >= startDate) {
      totalExpenses += exp.amount;
    }
  });
  
  const saved = totalIncome - totalExpenses;
  return saved >= targetAmount ? 1 : 0;
};

/**
 * Calculate progress for "log all expenses" challenge
 */
const calculateLogAllExpensesProgress = async (challenge: Challenge): Promise<number> => {
  const expenses = await getExpenses();
  const startDate = new Date(challenge.startDate);
  const today = new Date();
  
  // Get unique days with expenses
  const daysWithExpenses = new Set<string>();
  expenses.forEach(expense => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= startDate && expenseDate <= today) {
      daysWithExpenses.add(expense.date);
    }
  });
  
  return daysWithExpenses.size;
};

/**
 * Calculate progress for "no missed days" challenge
 */
const calculateNoMissedDaysProgress = async (challenge: Challenge): Promise<number> => {
  const expenses = await getExpenses();
  const startDate = new Date(challenge.startDate);
  const today = new Date();
  
  // Get unique days with expenses
  const daysWithExpenses = new Set<string>();
  expenses.forEach(expense => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= startDate && expenseDate <= today) {
      daysWithExpenses.add(expense.date);
    }
  });
  
  return daysWithExpenses.size;
};

/**
 * Calculate progress for "stay in budget" challenge
 */
const calculateStayInBudgetProgress = async (challenge: Challenge): Promise<number> => {
  const budgets = await getBudgets();
  const expenses = await getExpenses();
  const startDate = new Date(challenge.startDate);
  const today = new Date();
  
  if (budgets.length === 0) return 0;
  
  // Group expenses by date and category
  const dailyCategorySpending: Record<string, Record<string, number>> = {};
  expenses.forEach(expense => {
    const expenseDate = new Date(expense.date);
    if (expenseDate >= startDate && expenseDate <= today) {
      if (!dailyCategorySpending[expense.date]) {
        dailyCategorySpending[expense.date] = {};
      }
      if (!dailyCategorySpending[expense.date][expense.category]) {
        dailyCategorySpending[expense.date][expense.category] = 0;
      }
      dailyCategorySpending[expense.date][expense.category] += expense.amount;
    }
  });
  
  // Check each day if all categories are within budget
  let daysWithinBudget = 0;
  Object.keys(dailyCategorySpending).forEach(date => {
    let allWithinBudget = true;
    Object.keys(dailyCategorySpending[date]).forEach(category => {
      const budget = budgets.find(b => b.category === category);
      if (budget && dailyCategorySpending[date][category] > budget.amount) {
        allWithinBudget = false;
      }
    });
    if (allWithinBudget) {
      daysWithinBudget++;
    }
  });
  
  return daysWithinBudget;
};

/**
 * Calculate progress for "pay first debt" challenge
 */
const calculatePayFirstDebtProgress = async (challenge: Challenge): Promise<number> => {
  const debts = await getDebts();
  const startDate = new Date(challenge.startDate);
  
  // Find first unpaid debt before challenge start
  const unpaidDebts = debts.filter(d => !d.isPaid && new Date(d.createdAt) < startDate);
  if (unpaidDebts.length === 0) return 0;
  
  // Check if first debt is now paid
  const firstDebt = unpaidDebts.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )[0];
  
  // Reload to get updated status
  const updatedDebts = await getDebts();
  const updatedDebt = updatedDebts.find(d => d.id === firstDebt.id);
  
  return updatedDebt?.isPaid ? 1 : 0;
};

/**
 * Calculate progress for "reduce debts" challenge
 */
const calculateReduceDebtsProgress = async (challenge: Challenge): Promise<number> => {
  const targetPercentage = challenge.targetValue || 10;
  const startDate = new Date(challenge.startDate);
  
  // Get total debt at start
  const debtsAtStart = await getDebts();
  const totalDebtAtStart = debtsAtStart
    .filter(d => !d.isPaid && new Date(d.createdAt) < startDate)
    .reduce((sum, d) => sum + d.remainingAmount, 0);
  
  if (totalDebtAtStart === 0) return 100;
  
  // Get current total debt
  const currentDebts = await getDebts();
  const totalCurrentDebt = currentDebts
    .filter(d => !d.isPaid)
    .reduce((sum, d) => sum + d.remainingAmount, 0);
  
  const reduction = totalDebtAtStart - totalCurrentDebt;
  const reductionPercentage = (reduction / totalDebtAtStart) * 100;
  
  return Math.min(100, Math.max(0, reductionPercentage));
};

/**
 * Calculate progress for "complete loan" challenge
 */
const calculateCompleteLoanProgress = async (challenge: Challenge): Promise<number> => {
  const debts = await getDebts();
  const startDate = new Date(challenge.startDate);
  
  // Find first unpaid debt/loan before challenge start
  const unpaidDebts = debts.filter(d => !d.isPaid && new Date(d.createdAt) < startDate);
  if (unpaidDebts.length === 0) return 0;
  
  const firstDebt = unpaidDebts.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )[0];
  
  // Reload to get updated status
  const updatedDebts = await getDebts();
  const updatedDebt = updatedDebts.find(d => d.id === firstDebt.id);
  
  return updatedDebt?.isPaid ? 1 : 0;
};

/**
 * Update all active challenges
 */
export const updateAllChallenges = async (): Promise<void> => {
  const challenges = await getChallenges();
  const activeChallenges = challenges.filter(c => !c.completed);
  
  for (const challenge of activeChallenges) {
    await updateChallengeProgress(challenge.id);
  }
};

/**
 * Get challenges grouped by category
 */
export const getChallengesByCategory = async (): Promise<Record<string, Challenge[]>> => {
  const challenges = await getChallenges();
  const grouped: Record<string, Challenge[]> = {};
  
  challenges.forEach(challenge => {
    if (!grouped[challenge.category]) {
      grouped[challenge.category] = [];
    }
    grouped[challenge.category].push(challenge);
  });
  
  return grouped;
};
