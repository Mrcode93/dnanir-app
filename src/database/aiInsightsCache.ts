import { getDb } from './database';

export interface AiInsightRecord {
  id: number;
  data: Record<string, unknown>;
  analysisType: string;
  month: number;
  year: number;
  created_at: number;
  walletId: number | null;
}

/** AI Smart Insights: get last cached response for current month and wallet, or null if none. */
export const getAiInsightsCache = async (walletId?: number): Promise<{
  data: Record<string, unknown>;
  analysisType: string;
  createdAt: number;
} | null> => {
  const database = getDb();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  let query = 'SELECT data, analysis_type, created_at FROM ai_insights_cache WHERE month = ? AND year = ?';
  const params: any[] = [currentMonth, currentYear];

  if (walletId) {
    query += ' AND walletId = ?';
    params.push(walletId);
  } else {
    query += ' AND walletId IS NULL';
  }

  query += ' ORDER BY created_at DESC LIMIT 1';

  const row = await database.getFirstAsync<{ data: string; analysis_type: string; created_at: number }>(query, params);
  
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
export const getAllAiInsightsCache = async (walletId?: number): Promise<AiInsightRecord[]> => {
  const database = getDb();
  let query = 'SELECT id, data, analysis_type, month, year, created_at, walletId FROM ai_insights_cache';
  const params: any[] = [];

  if (walletId) {
    query += ' WHERE walletId = ?';
    params.push(walletId);
  }

  query += ' ORDER BY year DESC, month DESC, created_at DESC';

  const rows = await database.getAllAsync<any>(query, params);
  
  return rows.map(row => {
    try {
      return {
        id: row.id,
        data: JSON.parse(row.data) as Record<string, unknown>,
        analysisType: row.analysis_type || 'full',
        month: row.month,
        year: row.year,
        created_at: row.created_at,
        walletId: row.walletId
      };
    } catch {
      return null;
    }
  }).filter((item): item is AiInsightRecord => item !== null);
};

/** AI Smart Insights: save response to local cache (saves history, doesn't overwrite). */
export const saveAiInsightsCache = async (
  data: Record<string, unknown>,
  analysisType: string = 'full',
  walletId?: number
): Promise<void> => {
  const database = getDb();
  const json = JSON.stringify(data);
  const createdAt = Date.now();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  
  await database.runAsync(
    'INSERT INTO ai_insights_cache (data, analysis_type, month, year, created_at, walletId) VALUES (?, ?, ?, ?, ?, ?)',
    [json, analysisType, month, year, createdAt, walletId || null]
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
