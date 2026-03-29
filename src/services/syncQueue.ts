/**
 * SyncQueue — conflict-aware offline-first sync for Dnanir
 *
 * Architecture rules enforced:
 *  1.  Server is single source of truth
 *  2.  Always PUSH before PULL
 *  3.  Push order: local_created_at ASC
 *  4.  Conflict rule: higher client_created_at wins
 *  5.  Deletes always win over edits (is_deleted=1 takes priority)
 *  6.  Never hard-delete — soft-delete only
 *  7.  Save losing version in conflict_backup before overwriting
 *  8.  Update last_sync_at ONLY after successful pull completes
 *  9.  Server NEVER deletes snapshot on incremental push
 *  10. Every payload must include device_id
 */

import * as SecureStore from 'expo-secure-store';
import { getDb } from '../database/database';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';

// ── Table names ───────────────────────────────────────────────────────────────
export type SyncTableName =
  | 'expenses'
  | 'income'
  | 'custom_categories'
  | 'financial_goals'
  | 'exchange_rates'
  | 'goal_plan_cache'
  | 'ai_insights_cache';

// ── Typed event emitter ───────────────────────────────────────────────────────
export type SyncEventName = 'sync:start' | 'sync:progress' | 'sync:done' | 'sync:error';

export type SyncEventMap = {
  'sync:start':    { table: SyncTableName };
  'sync:progress': { table: SyncTableName; pushed: number; total: number };
  'sync:done':     { table: SyncTableName; pulled: number };
  'sync:error':    { table: SyncTableName; error: string };
};

class SyncEmitter {
  private map = new Map<SyncEventName, Array<(p: any) => void>>();

  on<K extends SyncEventName>(event: K, cb: (payload: SyncEventMap[K]) => void): () => void {
    const list = this.map.get(event) ?? [];
    list.push(cb);
    this.map.set(event, list);
    return () => {
      this.map.set(event, (this.map.get(event) ?? []).filter(l => l !== cb));
    };
  }

  emit<K extends SyncEventName>(event: K, payload: SyncEventMap[K]): void {
    (this.map.get(event) ?? []).forEach(cb => cb(payload));
  }
}

export const syncEmitter = new SyncEmitter();

// ── Payload / response types ──────────────────────────────────────────────────
interface PushRecord {
  local_id:          string;
  device_id:         string;
  server_id:         string | null;
  local_created_at:  string;
  client_created_at: string;
  is_deleted:        boolean;
  version:           number;
  data:              Record<string, unknown>;
}

interface PushAccepted {
  local_id:           string;
  server_id:          string;
  version:            number;
  server_received_at: string;
}

interface PushConflict {
  local_id: string;
  winner:   IncomingRecord;
  loser:    PushRecord;
}

interface PushResponse {
  success:   boolean;
  accepted:  PushAccepted[];
  conflicts: PushConflict[];
  failed:    Array<{ local_id: string; error: string }>;
}

interface IncomingRecord {
  local_id:           string;
  device_id:          string;
  server_id:          string;
  version:            number;
  sync_status:        string;
  local_created_at:   string;
  client_created_at:  string;
  server_received_at: string;
  is_deleted:         boolean;
  conflict_backup:    Record<string, unknown> | null;
  data:               Record<string, unknown>;
}

interface PullResponse {
  success:     boolean;
  records:     IncomingRecord[];
  server_time: string;
}

// ── Columns that are sync metadata (not content data) ─────────────────────────
const SYNC_META_COLS = new Set([
  'id', 'local_id', 'device_id', 'server_id',
  'sync_status', 'local_created_at', 'client_created_at',
  'server_received_at', 'is_deleted', 'conflict_backup',
  'version', 'synced_at',
]);

// ── Utilities ─────────────────────────────────────────────────────────────────
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 10_000,
): Promise<Response> {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Exponential backoff: 1s → 2s → 4s
async function withRetry<T>(
  fn: () => Promise<T>,
  retriesLeft = 3,
  delayMs     = 1_000,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retriesLeft === 0) throw err;
    await new Promise(r => setTimeout(r, delayMs));
    return withRetry(fn, retriesLeft - 1, delayMs * 2);
  }
}

// ── SyncQueue ─────────────────────────────────────────────────────────────────
export class SyncQueue {
  private cachedDeviceId: string | null = null;
  private readonly base: string;

  constructor() {
    this.base = API_CONFIG.BASE_URL;
  }

  // ── Device ID — stored once in SecureStore ──────────────────────────────────
  async getDeviceId(): Promise<string> {
    if (this.cachedDeviceId) return this.cachedDeviceId;
    let id = await SecureStore.getItemAsync('dnanir_device_id');
    if (!id) {
      id = generateUUID();
      await SecureStore.setItemAsync('dnanir_device_id', id);
    }
    this.cachedDeviceId = id;
    return id;
  }

  // ── Auth token ──────────────────────────────────────────────────────────────
  private async authHeader(): Promise<Record<string, string>> {
    const { authStorage } = await import('./authStorage');
    const token = await authStorage.getAccessToken();
    if (!token) throw new Error('NOT_AUTHENTICATED');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  // ── Case A / D entry point — push then pull ─────────────────────────────────
  async sync(table: SyncTableName): Promise<void> {
    syncEmitter.emit('sync:start', { table });
    try {
      await this.pushPending(table);           // Rule 2: push first
      const pulled = await this.pullFromServer(table);
      syncEmitter.emit('sync:done', { table, pulled });
    } catch (err) {
      syncEmitter.emit('sync:error', { table, error: String(err) });
      throw err;
    }
  }

  // ── Sync all tables in dependency order ─────────────────────────────────────
  async syncAll(): Promise<void> {
    const ORDER: SyncTableName[] = [
      'exchange_rates',
      'custom_categories',
      'financial_goals',
      'expenses',
      'income',
      'goal_plan_cache',
      'ai_insights_cache',
    ];
    for (const table of ORDER) {
      try {
        await this.sync(table);
      } catch (err) {
        // Don't abort entire sync if one table fails
        syncEmitter.emit('sync:error', { table, error: String(err) });
      }
    }
  }

  // ── PUSH ────────────────────────────────────────────────────────────────────
  // Cases A, B, C, D
  private async pushPending(table: SyncTableName): Promise<void> {
    const db       = getDb();
    const deviceId = await this.getDeviceId();

    const pending = await db.getAllAsync<Record<string, unknown>>(
      // Rule 3: push order = local_created_at ASC
      `SELECT * FROM ${table}
       WHERE sync_status IN ('pending', 'failed')
         AND is_deleted IS NOT 1
       UNION
       SELECT * FROM ${table}
       WHERE sync_status IN ('pending', 'failed')
         AND is_deleted = 1
       ORDER BY local_created_at ASC`,
    );

    // Deduplicate (UNION may not preserve order across both halves in all SQLite versions)
    const seen  = new Set<unknown>();
    const rows  = pending.filter(r => {
      const key = r['id'];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => {
      const ta = String(a['local_created_at'] ?? '');
      const tb = String(b['local_created_at'] ?? '');
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

    if (rows.length === 0) return;

    // Ensure every row has a local_id + timestamps (idempotent backfill)
    for (const row of rows) {
      if (!row['local_id']) {
        const lid = generateUUID();
        const now = new Date().toISOString();
        await db.runAsync(
          `UPDATE ${table}
           SET local_id          = ?,
               device_id         = ?,
               local_created_at  = COALESCE(local_created_at, ?),
               client_created_at = COALESCE(client_created_at, ?)
           WHERE id = ?`,
          [lid, deviceId, now, now, row['id']] as any[],
        );
        row['local_id']          = lid;
        row['device_id']         = deviceId;
        row['local_created_at']  = row['local_created_at']  ?? now;
        row['client_created_at'] = row['client_created_at'] ?? now;
      }
    }

    const BATCH = 50;
    let totalPushed = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      // Build push payload — separate sync metadata from content data
      const records: PushRecord[] = batch.map(row => {
        const data: Record<string, unknown> = {};
        for (const key of Object.keys(row)) {
          if (!SYNC_META_COLS.has(key)) data[key] = row[key];
        }
        return {
          local_id:          String(row['local_id']),
          device_id:         String(row['device_id'] ?? deviceId),
          server_id:         row['server_id'] as string | null,
          local_created_at:  String(row['local_created_at']),
          client_created_at: String(row['client_created_at'] ?? row['local_created_at']),
          is_deleted:        row['is_deleted'] === 1,
          version:           Number(row['version'] ?? 0),
          data,
        };
      });

      let body: PushResponse;
      try {
        const res = await withRetry(
          () => this.authHeader().then(headers =>
            fetchWithTimeout(
              `${this.base}${API_ENDPOINTS.SYNC_V2.PUSH(table)}`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify({ device_id: deviceId, records }),   // Rule 10
              },
            )
          ),
          3,
          1_000,
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        body = await res.json() as PushResponse;
      } catch (batchErr) {
        // All retries exhausted — mark batch as failed, continue to next batch
        const ids = batch.map(r => `'${r['local_id']}'`).join(',');
        await db.runAsync(
          `UPDATE ${table} SET sync_status = 'failed'
           WHERE local_id IN (${ids})`,
        );
        syncEmitter.emit('sync:error', {
          table,
          error: `Batch ${Math.ceil(i / BATCH) + 1} failed: ${batchErr}`,
        });
        continue;
      }

      await this.applyAccepted(table, body.accepted);
      await this.applyConflicts(table, body.conflicts);   // Cases B, C
      await this.markFailed(table, body.failed);           // Case D

      totalPushed += body.accepted.length;
      syncEmitter.emit('sync:progress', {
        table,
        pushed: totalPushed,
        total:  rows.length,
      });
    }
  }

  // ── Apply push accepted results ──────────────────────────────────────────────
  private async applyAccepted(
    table:    SyncTableName,
    accepted: PushAccepted[],
  ): Promise<void> {
    const db = getDb();
    for (const a of accepted) {
      await db.runAsync(
        `UPDATE ${table}
         SET server_id          = ?,
             version            = ?,
             server_received_at = ?,
             sync_status        = 'synced'
         WHERE local_id = ?`,
        [a.server_id, a.version, a.server_received_at, a.local_id],
      );
    }
  }

  // ── Apply conflict results (Cases B, C) ──────────────────────────────────────
  private async applyConflicts(
    table:     SyncTableName,
    conflicts: PushConflict[],
  ): Promise<void> {
    const db = getDb();
    for (const c of conflicts) {
      // Rule 7: save loser in conflict_backup BEFORE overwriting
      const loserJson = JSON.stringify(c.loser);
      const w = c.winner;

      // Build SET clause from winner's data fields
      const dataKeys = Object.keys(w.data);
      const dataSets = dataKeys.map(k => `${k} = ?`).join(', ');
      const dataVals = dataKeys.map(k => w.data[k]) as any[];

      await db.runAsync(
        `UPDATE ${table}
         SET server_id          = ?,
             version            = ?,
             server_received_at = ?,
             client_created_at  = ?,
             is_deleted         = ?,
             conflict_backup    = ?,
             sync_status        = 'synced'
             ${dataSets ? `, ${dataSets}` : ''}
         WHERE local_id = ?`,
        [
          w.server_id,
          w.version,
          w.server_received_at,
          w.client_created_at,
          w.is_deleted ? 1 : 0,
          loserJson,           // Rule 7
          ...dataVals,
          c.local_id,
        ],
      );
    }
  }

  // ── Mark server-side failures ────────────────────────────────────────────────
  private async markFailed(
    table:  SyncTableName,
    failed: Array<{ local_id: string; error: string }>,
  ): Promise<void> {
    const db = getDb();
    for (const f of failed) {
      await db.runAsync(
        `UPDATE ${table} SET sync_status = 'failed' WHERE local_id = ?`,
        [f.local_id],
      );
    }
  }

  // ── PULL ────────────────────────────────────────────────────────────────────
  private async pullFromServer(
    table: SyncTableName,
    since?: string | null,   // null = full restore (Case E)
  ): Promise<number> {
    const db       = getDb();
    const deviceId = await this.getDeviceId();

    const lastSync = since !== undefined ? since : await this.getLastSyncAt(table);
    const url      = lastSync
      ? `${this.base}${API_ENDPOINTS.SYNC_V2.PULL(table)}?since=${encodeURIComponent(lastSync)}&device_id=${encodeURIComponent(deviceId)}`
      : `${this.base}${API_ENDPOINTS.SYNC_V2.PULL(table)}?device_id=${encodeURIComponent(deviceId)}`;

    const res = await withRetry(
      () => this.authHeader().then(headers => fetchWithTimeout(url, { method: 'GET', headers })),
    );
    if (!res.ok) throw new Error(`Pull failed: ${res.status}`);

    const body = await res.json() as PullResponse;

    for (const record of body.records) {
      await this.applyIncomingRecord(table, record);
    }

    // Rule 8: set last_sync_at ONLY after full pull succeeds
    await this.setLastSyncAt(table, body.server_time);
    return body.records.length;
  }

  // ── Upsert a record received from the server ─────────────────────────────────
  private async applyIncomingRecord(
    table:    SyncTableName,
    incoming: IncomingRecord,
  ): Promise<void> {
    const db = getDb();

    const existing = await db.getFirstAsync<{
      id: number; version: number; sync_status: string;
    }>(
      `SELECT id, version, sync_status FROM ${table} WHERE server_id = ?`,
      [incoming.server_id],
    );

    const dataKeys = Object.keys(incoming.data);

    if (!existing) {
      // New record from another device — INSERT
      const syncCols = [
        'local_id', 'device_id', 'server_id', 'sync_status',
        'local_created_at', 'client_created_at', 'server_received_at',
        'is_deleted', 'conflict_backup', 'version',
      ];
      const allCols = [...syncCols, ...dataKeys];
      const placeholders = allCols.map(() => '?').join(', ');

      const syncVals: unknown[] = [
        incoming.local_id,
        incoming.device_id,
        incoming.server_id,
        'synced',
        incoming.local_created_at,
        incoming.client_created_at,
        incoming.server_received_at,
        incoming.is_deleted ? 1 : 0,
        incoming.conflict_backup ? JSON.stringify(incoming.conflict_backup) : null,
        incoming.version,
      ];
      const dataVals = dataKeys.map(k => incoming.data[k]);

      await db.runAsync(
        `INSERT OR IGNORE INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders})`,
        [...syncVals, ...dataVals] as any[],
      );
      return;
    }

    // Skip if this device has local pending changes — let next push resolve it
    if (existing.sync_status === 'pending') return;

    // Skip if incoming is not newer
    if (incoming.version <= existing.version) return;

    // UPDATE with server version
    const dataSets = dataKeys.map(k => `${k} = ?`).join(', ');
    const dataVals = dataKeys.map(k => incoming.data[k]) as any[];

    await db.runAsync(
      `UPDATE ${table}
       SET server_id          = ?,
           sync_status        = 'synced',
           device_id          = ?,
           client_created_at  = ?,
           server_received_at = ?,
           is_deleted         = ?,
           conflict_backup    = ?,
           version            = ?
           ${dataSets ? `, ${dataSets}` : ''}
       WHERE id = ?`,
      [
        incoming.server_id,
        incoming.device_id,
        incoming.client_created_at,
        incoming.server_received_at,
        incoming.is_deleted ? 1 : 0,
        incoming.conflict_backup ? JSON.stringify(incoming.conflict_backup) : null,
        incoming.version,
        ...dataVals,
        existing.id,
      ],
    );
  }

  // ── Case E — new device full restore ─────────────────────────────────────────
  async fullRestore(table: SyncTableName): Promise<void> {
    syncEmitter.emit('sync:start', { table });
    try {
      const db = getDb();

      // If there's already data, fall back to incremental sync
      const { n } = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) as n FROM ${table}`,
      ) ?? { n: 0 };

      if (n > 0) {
        await this.sync(table);
        return;
      }

      // Nothing local to push — go straight to full pull  (no `since`)
      const pulled = await this.pullFromServer(table, null);
      syncEmitter.emit('sync:done', { table, pulled });
    } catch (err) {
      syncEmitter.emit('sync:error', { table, error: String(err) });
      throw err;
    }
  }

  // ── Full restore of all tables — call at first login on a new device ─────────
  async fullRestoreAll(): Promise<void> {
    const ORDER: SyncTableName[] = [
      'exchange_rates',
      'custom_categories',
      'financial_goals',
      'expenses',
      'income',
      'goal_plan_cache',
      'ai_insights_cache',
    ];
    for (const table of ORDER) {
      try {
        await this.fullRestore(table);
      } catch (err) {
        syncEmitter.emit('sync:error', { table, error: String(err) });
      }
    }
  }

  // ── Soft delete — Rule 6 ─────────────────────────────────────────────────────
  async softDelete(table: SyncTableName, localId: string): Promise<void> {
    const db  = getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE ${table}
       SET is_deleted         = 1,
           sync_status        = 'pending',
           -- bump client_created_at so delete wins any simultaneous edit (Rule 5)
           client_created_at  = ?
       WHERE local_id = ?`,
      [now, localId],
    );
  }

  // ── Mark a row as pending sync (call after INSERT or UPDATE) ─────────────────
  async markForSync(table: SyncTableName, rowId: number): Promise<void> {
    const db       = getDb();
    const deviceId = await this.getDeviceId();
    const now      = new Date().toISOString();

    const existing = await db.getFirstAsync<{ local_id: string | null }>(
      `SELECT local_id FROM ${table} WHERE id = ?`, [rowId],
    );
    if (!existing) return;

    const localId = existing.local_id ?? generateUUID();
    await db.runAsync(
      `UPDATE ${table}
       SET local_id          = COALESCE(local_id, ?),
           device_id         = COALESCE(device_id, ?),
           local_created_at  = COALESCE(local_created_at, ?),
           client_created_at = COALESCE(client_created_at, ?),
           sync_status       = 'pending'
       WHERE id = ?`,
      [localId, deviceId, now, now, rowId],
    );
  }

  // ── sync_meta helpers ────────────────────────────────────────────────────────
  private async getLastSyncAt(table: SyncTableName): Promise<string | null> {
    const db  = getDb();
    const row = await db.getFirstAsync<{ synced_at: string }>(
      `SELECT synced_at FROM sync_meta WHERE table_name = ?`, [table],
    );
    return row?.synced_at ?? null;
  }

  private async setLastSyncAt(table: SyncTableName, time: string): Promise<void> {
    const db = getDb();
    await db.runAsync(
      `INSERT INTO sync_meta (table_name, synced_at)
       VALUES (?, ?)
       ON CONFLICT(table_name) DO UPDATE SET synced_at = excluded.synced_at`,
      [table, time],
    );
  }
}

// Singleton — import this everywhere
export const syncQueue = new SyncQueue();
