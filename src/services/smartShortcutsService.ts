import {
  ExpenseShortcut,
  IncomeShortcut,
  getExpenseShortcuts,
  getIncomeShortcuts,
  getExpenses,
  getIncome,
} from '../database/database';

type ExpenseLike = {
  title?: string;
  category?: string;
  amount: number;
  base_amount?: number;
  date: string;
};

type IncomeLike = {
  source?: string;
  category?: string;
  amount: number;
  base_amount?: number;
  date: string;
};

const normalizeText = (value?: string): string => (value || '').trim().toLowerCase();

const toDateMs = (date: string | undefined): number => {
  if (!date) return 0;
  const normalized = date.length === 10 ? `${date}T00:00:00` : date;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? 0 : ms;
};

const getAmount = (row: { amount: number; base_amount?: number }): number => {
  if (typeof row.base_amount === 'number' && Number.isFinite(row.base_amount)) {
    return row.base_amount;
  }
  return row.amount;
};

const amountCloseEnough = (value: number, target: number): boolean => {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return false;
  const ratio = Math.abs(value - target) / Math.max(target, 1);
  return ratio <= 0.35;
};

const buildScore = ({
  usageCount,
  lastUsedMs,
  createdAtMs,
  nowMs,
}: {
  usageCount: number;
  lastUsedMs: number;
  createdAtMs: number;
  nowMs: number;
}): number => {
  const usageScore = Math.min(usageCount, 20) * 6;
  const daysSinceLastUse = lastUsedMs > 0 ? (nowMs - lastUsedMs) / (1000 * 60 * 60 * 24) : Infinity;
  const recencyScore = Number.isFinite(daysSinceLastUse) ? Math.max(0, 36 - daysSinceLastUse) : 0;
  const daysSinceCreated = createdAtMs > 0 ? (nowMs - createdAtMs) / (1000 * 60 * 60 * 24) : Infinity;
  const freshnessScore = Number.isFinite(daysSinceCreated) ? Math.max(0, 10 - daysSinceCreated) * 0.7 : 0;
  return usageScore + recencyScore + freshnessScore;
};

export const rankSmartExpenseShortcuts = (
  shortcuts: ExpenseShortcut[],
  expenses: ExpenseLike[],
): ExpenseShortcut[] => {
  if (shortcuts.length <= 1) return shortcuts;

  const nowMs = Date.now();

  const ranked = shortcuts.map((shortcut) => {
    const shortcutTitle = normalizeText(shortcut.title);
    const shortcutCategory = normalizeText(shortcut.category);
    const shortcutAmount = Number(shortcut.amount) || 0;

    const matches = expenses.filter((expense) => {
      const expenseTitle = normalizeText(expense.title);
      const expenseCategory = normalizeText(expense.category);
      const amount = getAmount(expense);
      const categoryMatch = expenseCategory === shortcutCategory;
      const titleMatch = expenseTitle === shortcutTitle || expenseTitle.includes(shortcutTitle);
      return amountCloseEnough(amount, shortcutAmount) && (categoryMatch || titleMatch);
    });

    const usageCount = matches.length;
    const lastUsedMs = matches.reduce((max, item) => Math.max(max, toDateMs(item.date)), 0);
    const createdAtMs = toDateMs(shortcut.createdAt);
    const score = buildScore({ usageCount, lastUsedMs, createdAtMs, nowMs });

    return { shortcut, score, usageCount, lastUsedMs, createdAtMs };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    if (b.lastUsedMs !== a.lastUsedMs) return b.lastUsedMs - a.lastUsedMs;
    return b.createdAtMs - a.createdAtMs;
  });

  return ranked.map((item) => item.shortcut);
};

export const rankSmartIncomeShortcuts = (
  shortcuts: IncomeShortcut[],
  incomeRows: IncomeLike[],
): IncomeShortcut[] => {
  if (shortcuts.length <= 1) return shortcuts;

  const nowMs = Date.now();

  const ranked = shortcuts.map((shortcut) => {
    const shortcutSource = normalizeText(shortcut.source);
    const shortcutCategory = normalizeText(shortcut.incomeSource);
    const shortcutAmount = Number(shortcut.amount) || 0;

    const matches = incomeRows.filter((income) => {
      const source = normalizeText(income.source);
      const category = normalizeText(income.category);
      const amount = getAmount(income);
      const sourceMatch = source === shortcutSource || source.includes(shortcutSource);
      const categoryMatch = category === shortcutCategory;
      return amountCloseEnough(amount, shortcutAmount) && (sourceMatch || categoryMatch);
    });

    const usageCount = matches.length;
    const lastUsedMs = matches.reduce((max, item) => Math.max(max, toDateMs(item.date)), 0);
    const createdAtMs = toDateMs(shortcut.createdAt);
    const score = buildScore({ usageCount, lastUsedMs, createdAtMs, nowMs });

    return { shortcut, score, usageCount, lastUsedMs, createdAtMs };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    if (b.lastUsedMs !== a.lastUsedMs) return b.lastUsedMs - a.lastUsedMs;
    return b.createdAtMs - a.createdAtMs;
  });

  return ranked.map((item) => item.shortcut);
};

export const getSmartExpenseShortcuts = async (limit?: number): Promise<ExpenseShortcut[]> => {
  const [shortcuts, expenses] = await Promise.all([getExpenseShortcuts(), getExpenses()]);
  const ranked = rankSmartExpenseShortcuts(shortcuts, expenses);
  return typeof limit === 'number' ? ranked.slice(0, limit) : ranked;
};

export const getSmartIncomeShortcuts = async (limit?: number): Promise<IncomeShortcut[]> => {
  const [shortcuts, incomeRows] = await Promise.all([getIncomeShortcuts(), getIncome()]);
  const ranked = rankSmartIncomeShortcuts(shortcuts, incomeRows);
  return typeof limit === 'number' ? ranked.slice(0, limit) : ranked;
};
