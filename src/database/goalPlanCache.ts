import { getDb } from './database';

export interface GoalPlanData {
  message: string;
  planSteps: string[];
  tips: string[];
  suggestedMonthlySaving: number | null;
}

export interface GoalPlanRecord {
  id: number;
  goalId: number;
  data: GoalPlanData;
  month: number;
  year: number;
  createdAt: number;
}

/** Get latest cached AI plan for a goal, or null. */
export const getGoalPlanCache = async (goalId: number): Promise<{
  data: GoalPlanData;
  createdAt: number;
} | null> => {
  const database = getDb();
  const row = await database.getFirstAsync<{ data: string; created_at: number }>(
    'SELECT data, created_at FROM goal_plan_cache WHERE goal_id = ? ORDER BY created_at DESC LIMIT 1',
    [goalId]
  );
  if (!row?.data) return null;
  try {
    const data = JSON.parse(row.data) as GoalPlanData;
    return {
      data: {
        message: data.message ?? '',
        planSteps: Array.isArray(data.planSteps) ? data.planSteps : [],
        tips: Array.isArray(data.tips) ? data.tips : [],
        suggestedMonthlySaving: data.suggestedMonthlySaving ?? null,
      },
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
};

/** Get all cached plans for a goal (history) */
export const getAllGoalPlanCache = async (goalId: number): Promise<GoalPlanRecord[]> => {
  const database = getDb();
  const rows = await database.getAllAsync<{ id: number; data: string; month: number; year: number; created_at: number }>(
    'SELECT id, data, month, year, created_at FROM goal_plan_cache WHERE goal_id = ? ORDER BY created_at DESC',
    [goalId]
  );
  
  return rows.map(row => {
    try {
      return {
        id: row.id,
        goalId,
        data: JSON.parse(row.data) as GoalPlanData,
        month: row.month,
        year: row.year,
        createdAt: row.created_at,
      };
    } catch {
      return null;
    }
  }).filter((item): item is GoalPlanRecord => item !== null);
};

/** Save AI goal plan response for a goal (saves history, doesn't overwrite). */
export const saveGoalPlanCache = async (goalId: number, data: GoalPlanData): Promise<void> => {
  const database = getDb();
  const json = JSON.stringify(data);
  const createdAt = Date.now();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  await database.runAsync(
    'INSERT INTO goal_plan_cache (goal_id, data, month, year, created_at) VALUES (?, ?, ?, ?, ?)',
    [goalId, json, month, year, createdAt]
  );
};

/** Clear cached plans for a goal. */
export const clearGoalPlanCache = async (goalId: number): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'DELETE FROM goal_plan_cache WHERE goal_id = ?',
    [goalId]
  );
};

/** Clear old goal plan cache (keep only last N months) */
export const clearOldGoalPlanCache = async (keepMonths: number = 6): Promise<void> => {
  const database = getDb();
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - keepMonths);
  const cutoffTimestamp = cutoffDate.getTime();
  
  await database.runAsync(
    'DELETE FROM goal_plan_cache WHERE created_at < ?',
    [cutoffTimestamp]
  );
};
