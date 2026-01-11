import { 
  getRecurringExpenses, 
  updateRecurringExpense, 
  RecurringExpense 
} from '../database/database';
import { addExpense } from '../database/database';

/**
 * Process recurring expenses and create actual expenses
 */
export const processRecurringExpenses = async (): Promise<number> => {
  const activeRecurring = await getRecurringExpenses(true);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let processedCount = 0;

  for (const recurring of activeRecurring) {
    const startDate = new Date(recurring.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Check if end date has passed
    if (recurring.endDate) {
      const endDate = new Date(recurring.endDate);
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) {
        await updateRecurringExpense(recurring.id, { isActive: false });
        continue;
      }
    }

    // Check if we should process this expense today
    const lastProcessed = recurring.lastProcessedDate 
      ? new Date(recurring.lastProcessedDate)
      : null;

    if (shouldProcessRecurringExpense(recurring, today, lastProcessed)) {
      // Create the expense
      const expenseDate = today.toISOString().split('T')[0];
      await addExpense({
        title: recurring.title,
        amount: recurring.amount,
        category: recurring.category,
        date: expenseDate,
        description: recurring.description || `مصروف متكرر: ${recurring.title}`,
      });

      // Update last processed date
      await updateRecurringExpense(recurring.id, {
        lastProcessedDate: expenseDate,
      });

      processedCount++;
    }
  }

  return processedCount;
};

/**
 * Check if a recurring expense should be processed today
 */
const shouldProcessRecurringExpense = (
  recurring: RecurringExpense,
  today: Date,
  lastProcessed: Date | null
): boolean => {
  const startDate = new Date(recurring.startDate);
  startDate.setHours(0, 0, 0, 0);

  // If we haven't started yet
  if (today < startDate) {
    return false;
  }

  // If we've already processed today
  if (lastProcessed && lastProcessed.getTime() === today.getTime()) {
    return false;
  }

  const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  switch (recurring.recurrenceType) {
    case 'daily':
      return daysSinceStart % recurring.recurrenceValue === 0;
    
    case 'weekly':
      const weeksSinceStart = Math.floor(daysSinceStart / 7);
      return weeksSinceStart % recurring.recurrenceValue === 0 && today.getDay() === startDate.getDay();
    
    case 'monthly':
      if (today.getDate() !== startDate.getDate()) {
        return false;
      }
      const monthsSinceStart = 
        (today.getFullYear() - startDate.getFullYear()) * 12 + 
        (today.getMonth() - startDate.getMonth());
      return monthsSinceStart % recurring.recurrenceValue === 0;
    
    case 'yearly':
      if (today.getMonth() !== startDate.getMonth() || today.getDate() !== startDate.getDate()) {
        return false;
      }
      const yearsSinceStart = today.getFullYear() - startDate.getFullYear();
      return yearsSinceStart % recurring.recurrenceValue === 0;
    
    default:
      return false;
  }
};

/**
 * Get next occurrence date for a recurring expense
 */
export const getNextOccurrenceDate = (recurring: RecurringExpense): Date | null => {
  const startDate = new Date(recurring.startDate);
  startDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < startDate) {
    return startDate;
  }

  const lastProcessed = recurring.lastProcessedDate 
    ? new Date(recurring.lastProcessedDate)
    : startDate;
  lastProcessed.setHours(0, 0, 0, 0);

  let nextDate = new Date(lastProcessed);

  switch (recurring.recurrenceType) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + recurring.recurrenceValue);
      break;
    
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (7 * recurring.recurrenceValue));
      break;
    
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + recurring.recurrenceValue);
      break;
    
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + recurring.recurrenceValue);
      break;
  }

  if (recurring.endDate) {
    const endDate = new Date(recurring.endDate);
    if (nextDate > endDate) {
      return null;
    }
  }

  return nextDate;
};
