import { addExpense, addIncome, clearExpenses, clearIncome } from '../database/database';
import { ExpenseCategory, IncomeSource } from '../types';

/**
 * Clear all data and add mockup data for testing
 * Months: November 2025, December 2025, January 2026 (until day 12)
 */
export const generateMockData = async (): Promise<void> => {
  try {
    
    await clearExpenses();
    await clearIncome();
    

    

    // November 2025 data
    await generateNovember2025Data();
    
    // December 2025 data
    await generateDecember2025Data();
    
    // January 2026 data (until day 12)
    await generateJanuary2026Data();

    
  } catch (error) {
    
    throw error;
  }
};

const generateNovember2025Data = async () => {
  const expenses: Array<{ title: string; amount: number; category: ExpenseCategory; date: string }> = [
    // Food expenses
    { title: 'سوق أسبوعي', amount: 45000, category: 'food', date: '2025-11-01' },
    { title: 'مطعم', amount: 15000, category: 'food', date: '2025-11-03' },
    { title: 'قهوة', amount: 5000, category: 'food', date: '2025-11-05' },
    { title: 'سوق', amount: 35000, category: 'food', date: '2025-11-08' },
    { title: 'دليفري', amount: 12000, category: 'food', date: '2025-11-10' },
    { title: 'مطعم', amount: 18000, category: 'food', date: '2025-11-12' },
    { title: 'سوق', amount: 40000, category: 'food', date: '2025-11-15' },
    { title: 'قهوة', amount: 6000, category: 'food', date: '2025-11-18' },
    { title: 'دليفري', amount: 14000, category: 'food', date: '2025-11-20' },
    { title: 'سوق', amount: 38000, category: 'food', date: '2025-11-22' },
    { title: 'مطعم', amount: 20000, category: 'food', date: '2025-11-25' },
    { title: 'سوق أسبوعي', amount: 42000, category: 'food', date: '2025-11-28' },

    // Transport expenses
    { title: 'بنزين', amount: 25000, category: 'transport', date: '2025-11-02' },
    { title: 'تاكسي', amount: 8000, category: 'transport', date: '2025-11-07' },
    { title: 'بنزين', amount: 30000, category: 'transport', date: '2025-11-14' },
    { title: 'تاكسي', amount: 10000, category: 'transport', date: '2025-11-19' },
    { title: 'بنزين', amount: 28000, category: 'transport', date: '2025-11-26' },

    // Bills
    { title: 'فاتورة كهرباء', amount: 45000, category: 'bills', date: '2025-11-05' },
    { title: 'فاتورة ماء', amount: 15000, category: 'bills', date: '2025-11-05' },
    { title: 'إنترنت', amount: 25000, category: 'bills', date: '2025-11-10' },
    { title: 'هاتف', amount: 20000, category: 'bills', date: '2025-11-15' },

    // Shopping
    { title: 'ملابس', amount: 80000, category: 'shopping', date: '2025-11-06' },
    { title: 'أدوات منزلية', amount: 35000, category: 'shopping', date: '2025-11-13' },
    { title: 'إلكترونيات', amount: 150000, category: 'shopping', date: '2025-11-20' },

    // Entertainment
    { title: 'سينما', amount: 15000, category: 'entertainment', date: '2025-11-04' },
    { title: 'مقهى', amount: 8000, category: 'entertainment', date: '2025-11-11' },
    { title: 'رحلة', amount: 50000, category: 'entertainment', date: '2025-11-17' },

    // Health
    { title: 'صيدلية', amount: 25000, category: 'health', date: '2025-11-09' },
    { title: 'عيادة', amount: 40000, category: 'health', date: '2025-11-16' },

    // Other
    { title: 'مصروفات متنوعة', amount: 15000, category: 'other', date: '2025-11-23' },
  ];

  const income: Array<{ source: string; amount: number; date: string }> = [
    { source: 'راتب', amount: 500000, date: '2025-11-01' },
    { source: 'عمل حر', amount: 150000, date: '2025-11-10' },
    { source: 'عمل حر', amount: 120000, date: '2025-11-20' },
  ];

  for (const expense of expenses) {
    await addExpense(expense);
  }

  for (const inc of income) {
    await addIncome({ ...inc, source: inc.source as IncomeSource });
  }

  
};

const generateDecember2025Data = async () => {
  const expenses: Array<{ title: string; amount: number; category: ExpenseCategory; date: string }> = [
    // Food expenses
    { title: 'سوق أسبوعي', amount: 48000, category: 'food', date: '2025-12-01' },
    { title: 'مطعم', amount: 20000, category: 'food', date: '2025-12-03' },
    { title: 'قهوة', amount: 5000, category: 'food', date: '2025-12-05' },
    { title: 'سوق', amount: 40000, category: 'food', date: '2025-12-08' },
    { title: 'دليفري', amount: 15000, category: 'food', date: '2025-12-10' },
    { title: 'مطعم', amount: 22000, category: 'food', date: '2025-12-12' },
    { title: 'سوق', amount: 45000, category: 'food', date: '2025-12-15' },
    { title: 'دليفري', amount: 18000, category: 'food', date: '2025-12-18' },
    { title: 'سوق', amount: 42000, category: 'food', date: '2025-12-20' },
    { title: 'مطعم', amount: 25000, category: 'food', date: '2025-12-22' },
    { title: 'سوق أسبوعي', amount: 50000, category: 'food', date: '2025-12-25' },
    { title: 'مطعم', amount: 30000, category: 'food', date: '2025-12-28' },
    { title: 'سوق', amount: 38000, category: 'food', date: '2025-12-30' },

    // Transport expenses
    { title: 'بنزين', amount: 30000, category: 'transport', date: '2025-12-02' },
    { title: 'تاكسي', amount: 10000, category: 'transport', date: '2025-12-07' },
    { title: 'بنزين', amount: 32000, category: 'transport', date: '2025-12-14' },
    { title: 'تاكسي', amount: 12000, category: 'transport', date: '2025-12-19' },
    { title: 'بنزين', amount: 28000, category: 'transport', date: '2025-12-26' },

    // Bills
    { title: 'فاتورة كهرباء', amount: 50000, category: 'bills', date: '2025-12-05' },
    { title: 'فاتورة ماء', amount: 18000, category: 'bills', date: '2025-12-05' },
    { title: 'إنترنت', amount: 25000, category: 'bills', date: '2025-12-10' },
    { title: 'هاتف', amount: 20000, category: 'bills', date: '2025-12-15' },

    // Shopping (more in December due to holidays)
    { title: 'هدايا', amount: 120000, category: 'shopping', date: '2025-12-06' },
    { title: 'ملابس', amount: 90000, category: 'shopping', date: '2025-12-13' },
    { title: 'ديكور', amount: 60000, category: 'shopping', date: '2025-12-20' },
    { title: 'إلكترونيات', amount: 180000, category: 'shopping', date: '2025-12-27' },

    // Entertainment
    { title: 'سينما', amount: 20000, category: 'entertainment', date: '2025-12-04' },
    { title: 'مقهى', amount: 10000, category: 'entertainment', date: '2025-12-11' },
    { title: 'حفلة', amount: 80000, category: 'entertainment', date: '2025-12-24' },
    { title: 'رحلة', amount: 60000, category: 'entertainment', date: '2025-12-29' },

    // Health
    { title: 'صيدلية', amount: 30000, category: 'health', date: '2025-12-09' },
    { title: 'عيادة', amount: 45000, category: 'health', date: '2025-12-16' },

    // Other
    { title: 'مصروفات متنوعة', amount: 20000, category: 'other', date: '2025-12-23' },
  ];

  const income: Array<{ source: string; amount: number; date: string }> = [
    { source: 'راتب', amount: 500000, date: '2025-12-01' },
    { source: 'مكافأة', amount: 200000, date: '2025-12-15' },
    { source: 'عمل حر', amount: 180000, date: '2025-12-20' },
  ];

  for (const expense of expenses) {
    await addExpense(expense);
  }

  for (const inc of income) {
    await addIncome({ ...inc, source: inc.source as IncomeSource });
  }

  
};

const generateJanuary2026Data = async () => {
  // Only until day 12
  const expenses: Array<{ title: string; amount: number; category: ExpenseCategory; date: string }> = [
    // Food expenses
    { title: 'سوق أسبوعي', amount: 45000, category: 'food', date: '2026-01-01' },
    { title: 'مطعم', amount: 18000, category: 'food', date: '2026-01-03' },
    { title: 'قهوة', amount: 5000, category: 'food', date: '2026-01-05' },
    { title: 'سوق', amount: 38000, category: 'food', date: '2026-01-08' },
    { title: 'دليفري', amount: 14000, category: 'food', date: '2026-01-10' },
    { title: 'مطعم', amount: 20000, category: 'food', date: '2026-01-12' },

    // Transport expenses
    { title: 'بنزين', amount: 28000, category: 'transport', date: '2026-01-02' },
    { title: 'تاكسي', amount: 9000, category: 'transport', date: '2026-01-07' },
    { title: 'بنزين', amount: 30000, category: 'transport', date: '2026-01-11' },

    // Bills
    { title: 'فاتورة كهرباء', amount: 48000, category: 'bills', date: '2026-01-05' },
    { title: 'فاتورة ماء', amount: 16000, category: 'bills', date: '2026-01-05' },
    { title: 'إنترنت', amount: 25000, category: 'bills', date: '2026-01-10' },

    // Shopping
    { title: 'ملابس', amount: 85000, category: 'shopping', date: '2026-01-06' },
    { title: 'أدوات منزلية', amount: 40000, category: 'shopping', date: '2026-01-09' },

    // Entertainment
    { title: 'سينما', amount: 18000, category: 'entertainment', date: '2026-01-04' },
    { title: 'مقهى', amount: 9000, category: 'entertainment', date: '2026-01-11' },

    // Health
    { title: 'صيدلية', amount: 28000, category: 'health', date: '2026-01-08' },

    // Other
    { title: 'مصروفات متنوعة', amount: 12000, category: 'other', date: '2026-01-12' },
  ];

  const income: Array<{ source: string; amount: number; date: string }> = [
    { source: 'راتب', amount: 500000, date: '2026-01-01' },
    { source: 'عمل حر', amount: 140000, date: '2026-01-08' },
  ];

  for (const expense of expenses) {
    await addExpense(expense);
  }

  for (const inc of income) {
    await addIncome({ ...inc, source: inc.source as IncomeSource });
  }

  // console.log(`✅ January 2026 (until day 12): ${expenses.length} expenses, ${income.length} income entries`);
};
