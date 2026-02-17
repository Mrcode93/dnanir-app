import { getDb } from './database';

export interface AiInsightRecord {
  id: number;
  data: Record<string, unknown>;
  analysisType: string;
  month: number;
  year: number;
  createdAt: number;
}

/** AI Smart Insights: get last cached response for current month, or null if none. */
export const getAiInsightsCache = async (): Promise<{
  data: Record<string, unknown>;
  analysisType: string;
  createdAt: number;
} | null> => {
  const database = getDb();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const row = await database.getFirstAsync<{ data: string; analysis_type: string; created_at: number }>(
    'SELECT data, analysis_type, created_at FROM ai_insights_cache WHERE month = ? AND year = ? ORDER BY created_at DESC LIMIT 1',
    [currentMonth, currentYear]
  );
  if (!row?.data) return null;
  try {
    const data = JSON.parse(row.data) as Record<string, unknown>;
    return {
      data,
      analysisType: row.analysis_type || 'full',
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
};

/** AI Smart Insights: get all cached insights (for history) */
export const getAllAiInsightsCache = async (): Promise<AiInsightRecord[]> => {
  const database = getDb();
  const rows = await database.getAllAsync<{ id: number; data: string; analysis_type: string; month: number; year: number; created_at: number }>(
    'SELECT id, data, analysis_type, month, year, created_at FROM ai_insights_cache ORDER BY year DESC, month DESC, created_at DESC'
  );
  
  return rows.map(row => {
    try {
      return {
        id: row.id,
        data: JSON.parse(row.data) as Record<string, unknown>,
        analysisType: row.analysis_type || 'full',
        month: row.month,
        year: row.year,
        createdAt: row.created_at,
      };
    } catch {
      return null;
    }
  }).filter((item): item is AiInsightRecord => item !== null);
};

/** AI Smart Insights: get cached insights for a specific month/year */
export const getAiInsightsCacheByMonth = async (year: number, month: number): Promise<AiInsightRecord | null> => {
  const database = getDb();
  const row = await database.getFirstAsync<{ id: number; data: string; analysis_type: string; created_at: number }>(
    'SELECT id, data, analysis_type, created_at FROM ai_insights_cache WHERE year = ? AND month = ? ORDER BY created_at DESC LIMIT 1',
    [year, month]
  );
  if (!row?.data) return null;
  try {
    return {
      id: row.id,
      data: JSON.parse(row.data) as Record<string, unknown>,
      analysisType: row.analysis_type || 'full',
      month,
      year,
      createdAt: row.created_at,
    };
  } catch {
    return null;
  }
};

/** AI Smart Insights: save response to local cache (saves history, doesn't overwrite). */
export const saveAiInsightsCache = async (
  data: Record<string, unknown>,
  analysisType: string = 'full'
): Promise<void> => {
  const database = getDb();
  const json = JSON.stringify(data);
  const createdAt = Date.now();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  await database.runAsync(
    'INSERT INTO ai_insights_cache (data, analysis_type, month, year, created_at) VALUES (?, ?, ?, ?, ?)',
    [json, analysisType, month, year, createdAt]
  );
};

/** Clear old insights cache (keep only last N months) */
export const clearOldAiInsightsCache = async (keepMonths: number = 6): Promise<void> => {
  const database = getDb();
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - keepMonths);
  const cutoffTimestamp = cutoffDate.getTime();
  
  await database.runAsync(
    'DELETE FROM ai_insights_cache WHERE created_at < ?',
    [cutoffTimestamp]
  );
};
