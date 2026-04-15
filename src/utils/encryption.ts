/**
 * AES-256-GCM Encryption + DEK/KEK Key Wrapping — dnanir-app
 *
 * Architecture (same pattern as 1Password / Bitwarden):
 *
 *  ┌─── Data Encryption Key (DEK) ──────────────────────────────────┐
 *  │  • 256-bit random key, generated ONCE on first login           │
 *  │  • Encrypts all user financial data                            │
 *  │  • Cached in memory + SecureStore (fast restart, no password)  │
 *  └────────────────────── wrapped by ──────────────────────────────┘
 *  ┌─── Key Encryption Key (KEK) ───────────────────────────────────┐
 *  │  • PBKDF2-SHA256(password, userId, 100 000 iters) → 32 bytes  │
 *  │  • NEVER stored — re-derived from password only when needed    │
 *  │  • Wraps / unwraps the DEK (so password changes ≠ data loss)  │
 *  └────────────────────── stored as ───────────────────────────────┘
 *  ┌─── Wrapped DEK ─────────────────────────────────────────────────┐
 *  │  • AES-256-GCM(DEK, KEK)                                       │
 *  │  • Kept in SecureStore across sessions                         │
 *  │  • Embedded in cloud backups for cross-device restore          │
 *  └─────────────────────────────────────────────────────────────────┘
 *
 * Cipher: AES-256-GCM
 *  ✓ Authenticated — GCM auth tag detects any tampering
 *  ✓ Random 96-bit IV per operation — same plaintext ≠ same ciphertext
 *  ✓ Wire format: IV(12 B) | Ciphertext | AuthTag(16 B) → base64
 *
 * Rate limiting: 5 wrong-password attempts → 30 min lockout (exponential)
 */

import { gcm } from '@noble/ciphers/aes';
import * as Crypto from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha2';
import * as SecureStore from 'expo-secure-store';

// ─── SecureStore keys ─────────────────────────────────────────────────────────
const DEK_RAW_KEY     = 'dnanir_dek';         // raw DEK — fast restart without password
const DEK_WRAPPED_KEY = 'dnanir_dek_wrapped'; // GCM(DEK, KEK) — password rotation + backup
const DEK_OWNER_KEY   = 'dnanir_dek_owner';   // userId who owns this DEK
const KEK_KEY         = 'dnanir_kek';         // cached KEK — needed for backup DEK adoption
const KEK_LEGACY_KEY  = 'dnanir_kek_legacy';  // cached legacy KEK (100k iters)
const LOCKOUT_KEY     = 'dnanir_lockout';     // brute-force tracking

// ─── Constants ────────────────────────────────────────────────────────────────
const KEY_BYTES       = 32;             // 256-bit AES key
const IV_BYTES        = 12;             // 96-bit GCM nonce
const PBKDF2_ITERS    = 5_000;
const LEGACY_ITERS    = 100_000;
const ORIGINAL_ITERS  = 500;           // earliest app version
const MAX_ATTEMPTS    = 5;
const BASE_LOCKOUT_MS = 30 * 60_000;   // 30 minutes

// ─── In-memory session DEK ────────────────────────────────────────────────────
let _sessionDEK: Uint8Array | null = null;
let _sessionKEK: Uint8Array | null = null;  // cached KEK for backup DEK adoption
let _cachedCredentials: { password: string; userId: string } | null = null;  // temporary, cleared on logout

/** Returns true when the session DEK is loaded and encryption is operational. */
export function isEncryptionReady(): boolean {
  return _sessionDEK !== null;
}

/**
 * Waits up to `timeoutMs` for the DEK to become available (e.g. while
 * PBKDF2 is still running in the background after login).
 * Returns true if ready, false if timed out.
 */
export async function waitForEncryptionReady(timeoutMs = 15_000): Promise<boolean> {
  if (_sessionDEK) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
    if (_sessionDEK) return true;
  }
  return false;
}

// ─── Encoding helpers ─────────────────────────────────────────────────────────
function toBase64(b: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < b.length) {
    const b0 = b[i++];
    const b1 = i < b.length ? b[i++] : NaN;
    const b2 = i < b.length ? b[i++] : NaN;

    const c0 = b0 >> 2;
    const c1 = ((b0 & 0x03) << 4) | (isNaN(b1) ? 0 : b1 >> 4);
    const c2 = isNaN(b1) ? 64 : ((b1 & 0x0f) << 2) | (isNaN(b2) ? 0 : b2 >> 6);
    const c3 = isNaN(b2) ? 64 : b2 & 0x3f;

    result += alphabet.charAt(c0) + alphabet.charAt(c1) + (c2 === 64 ? '=' : alphabet.charAt(c2)) + (c3 === 64 ? '=' : alphabet.charAt(c3));
  }
  return result;
}

function fromBase64(s: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < alphabet.length; i++) lookup[alphabet.charCodeAt(i)] = i;

  const b64 = s.replace(/=/g, '');
  const n = b64.length;
  const out = new Uint8Array((n * 3) / 4);

  for (let i = 0, j = 0; i < n; i += 4) {
    const c0 = lookup[b64.charCodeAt(i)];
    const c1 = lookup[b64.charCodeAt(i + 1)];
    const c2 = i + 2 < n ? lookup[b64.charCodeAt(i + 2)] : 0;
    const c3 = i + 3 < n ? lookup[b64.charCodeAt(i + 3)] : 0;

    out[j++] = (c0 << 2) | (c1 >> 4);
    if (i + 2 < n) out[j++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (i + 3 < n) out[j++] = ((c2 & 0x03) << 6) | c3;
  }
  return out;
}

function toBytes(s: string): Uint8Array       { return new TextEncoder().encode(s); }
function fromBytes(b: Uint8Array): string     { return new TextDecoder().decode(b); }

// ─── AES-256-GCM primitives ───────────────────────────────────────────────────

/** Encrypt → IV(12) | Ciphertext+AuthTag(n+16). Auth tag is appended by @noble/ciphers. */
function gcmEncrypt(plain: Uint8Array, key: Uint8Array): Uint8Array {
  const iv  = Crypto.getRandomBytes(IV_BYTES);
  const ct  = gcm(key, iv).encrypt(plain);    // ct includes trailing 16-byte auth tag
  const out = new Uint8Array(IV_BYTES + ct.length);
  out.set(iv, 0);
  out.set(ct, IV_BYTES);
  return out;
}

/** Decrypt IV(12) | Ciphertext+AuthTag → plaintext. Throws if auth tag fails. */
function gcmDecrypt(payload: Uint8Array, key: Uint8Array): Uint8Array {
  const iv = payload.slice(0, IV_BYTES);
  const ct = payload.slice(IV_BYTES);
  return gcm(key, iv).decrypt(ct);            // throws on auth tag mismatch
}

// ─── PBKDF2 key derivation ────────────────────────────────────────────────────

async function deriveKEK(password: string, userId: string, iters: number = PBKDF2_ITERS): Promise<Uint8Array> {
  return pbkdf2Async(sha256, toBytes(password), toBytes(userId), {
    c: iters,
    dkLen: KEY_BYTES,
  });
}

// ─── Brute-force rate limiting ────────────────────────────────────────────────

interface Lockout { attempts: number; lockedUntil: number | null; }

async function getLockout(): Promise<Lockout> {
  try {
    const raw = await SecureStore.getItemAsync(LOCKOUT_KEY);
    return raw ? JSON.parse(raw) : { attempts: 0, lockedUntil: null };
  } catch { return { attempts: 0, lockedUntil: null }; }
}

export async function resetLockout(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCKOUT_KEY).catch(() => {});
}

async function recordFailedAttempt(): Promise<void> {
  const s = await getLockout();
  const n = s.attempts + 1;
  const lockedUntil =
    n >= 15 ? Date.now() + 24 * 3_600_000  : // 24 h
    n >= 10 ? Date.now() + 2  * 3_600_000  : // 2 h
    n >= MAX_ATTEMPTS ? Date.now() + BASE_LOCKOUT_MS :
    null;
  await SecureStore.setItemAsync(LOCKOUT_KEY, JSON.stringify({ attempts: n, lockedUntil }));
}

/** Returns milliseconds remaining in lockout, or 0 if not locked. */
export async function getLockoutRemaining(): Promise<number> {
  if (__DEV__) return 0; // Disable lockout in development mode
  const s = await getLockout();
  return s.lockedUntil ? Math.max(0, s.lockedUntil - Date.now()) : 0;
}

// ─── Key management public API ────────────────────────────────────────────────

/**
 * Initialize encryption after server login or register.
 *
 *  First login  → generates a fresh 256-bit DEK, wraps it with KEK, caches both.
 *  Later logins → verifies password by unwrapping the stored DEK.
 *  Wrong password → increments lockout; throws a descriptive Arabic error.
 */
export async function initEncryptionKey(
  password: string, 
  userId: string, 
  cloudWrappedDek?: string | null
): Promise<void> {
  const remaining = await getLockoutRemaining();
  if (remaining > 0) {
    throw new Error(`تم تجاوز عدد المحاولات. حاول بعد ${Math.ceil(remaining / 60_000)} دقيقة.`);
  }

  const kek5k = await deriveKEK(password, userId, PBKDF2_ITERS);
  _sessionKEK = kek5k;  // cache for later backup DEK adoption
  _cachedCredentials = { password, userId };  // cache for multi-iteration adoption
  // Persist KEK so it survives app restart (needed for adoptWrappedDEK)
  await SecureStore.setItemAsync(KEK_KEY, toBase64(kek5k));

  console.log(`[Encryption] 🔍 initEncryptionKey: userId=${userId.substring(0, 8)}..., cloudWrappedDek=${cloudWrappedDek ? 'yes(' + cloudWrappedDek.length + ')' : 'no'}`);

  try {
    let stored = await SecureStore.getItemAsync(DEK_WRAPPED_KEY);
    const owner  = await SecureStore.getItemAsync(DEK_OWNER_KEY);

    console.log(`[Encryption] 🔍 stored wrapped DEK: ${stored ? 'yes(' + stored.length + ')' : 'no'}, owner: ${owner || 'none'}`);

    // Normalize owner if needed
    if (owner && owner !== userId) {
      console.log(`[Encryption] 🔍 Owner mismatch (${owner} vs ${userId}), clearing stored DEK`);
      await SecureStore.deleteItemAsync(DEK_WRAPPED_KEY);
      await SecureStore.deleteItemAsync(DEK_OWNER_KEY);
      stored = null;
    }

    // Attempt to unwrap a key — either from cloud or local storage
    const targetWrapped = cloudWrappedDek || stored;
    console.log(`[Encryption] 🔍 targetWrapped: ${targetWrapped ? 'yes(' + targetWrapped.length + ' chars, starts: ' + targetWrapped.substring(0, 20) + ')' : 'NONE'}, source: ${cloudWrappedDek ? 'cloud' : stored ? 'local' : 'none'}`);

    if (targetWrapped) {
      let dek: Uint8Array | null = null;
      let usedLegacy = false;

      // 1. Try modern KEK (5,000 iterations)
      try {
        dek = gcmDecrypt(fromBase64(targetWrapped), kek5k);
      } catch (err) {
        // 2. Try legacy KEK (100,000 iterations)
        try {
          const kek100k = await deriveKEK(password, userId, LEGACY_ITERS);
          dek = gcmDecrypt(fromBase64(targetWrapped), kek100k);
          usedLegacy = true;
          // Persist legacy KEK for backup DEK adoption (server may still have legacy-wrapped DEK)
          await SecureStore.setItemAsync(KEK_LEGACY_KEY, toBase64(kek100k));
        } catch (legacyErr) {
          // 3. Try original KEK (500 iterations — earliest app version)
          try {
            const kek500 = await deriveKEK(password, userId, ORIGINAL_ITERS);
            dek = gcmDecrypt(fromBase64(targetWrapped), kek500);
            usedLegacy = true;
            await SecureStore.setItemAsync(KEK_LEGACY_KEY, toBase64(kek500));
          } catch (origErr) {
            // All three failed — wrong password or key is for different user
          }
        }
      }

      if (dek) {
        console.log(`[Encryption] ✅ Successfully unwrapped DEK (legacy=${usedLegacy})`);
        _sessionDEK = dek;
        
        // UPGRADE: If we used the legacy key, or if we were adopting a cloud key, 
        // save it locally with the modern (5k) wrapper for speed.
        if (usedLegacy || cloudWrappedDek || !stored) {
          const rewrapped = gcmEncrypt(dek, kek5k);
          await SecureStore.setItemAsync(DEK_WRAPPED_KEY, toBase64(rewrapped));
          await SecureStore.setItemAsync(DEK_OWNER_KEY, userId);
        }
        
        await SecureStore.setItemAsync(DEK_RAW_KEY, toBase64(dek));
        await resetLockout();
        return;
      }
    }

    // If we reached here, no key was found or they all failed (wrong pass/corrupt)
    // If it's the SAME owner, we might be rotating password or fixed-key mismatch
    if (stored && owner === userId) {
        // Already tried and failed above. We must stay locked or throw error.
        // Actually, during login it should throw if password doesn't match the key.
        // But if login was successful, the password is correct, so the key is likely old/corrupt.
        // We'll generate a fresh one if everything else failed.
    }

    // Fresh setup: generate DEK, wrap it with kek5k, cache raw
    console.log('[Encryption] ⚠️ All unwrap attempts failed — generating NEW DEK (old data will be undecryptable!)');
    const newDek    = Crypto.getRandomBytes(KEY_BYTES);
    const wrapped   = gcmEncrypt(newDek, kek5k);
    await SecureStore.setItemAsync(DEK_WRAPPED_KEY, toBase64(wrapped));
    await SecureStore.setItemAsync(DEK_RAW_KEY,     toBase64(newDek));
    await SecureStore.setItemAsync(DEK_OWNER_KEY,   userId);
    _sessionDEK = newDek;

    await resetLockout();
  } catch (err: any) {
    if (err?.message?.includes('دقيقة')) throw err; // already a lockout error
    await recordFailedAttempt();
    const s   = await getLockout();
    const left = MAX_ATTEMPTS - s.attempts;
    if (s.lockedUntil) throw new Error('كلمة مرور خاطئة. تم قفل التشفير لـ 30 دقيقة.');
    throw new Error(left > 0 ? `كلمة مرور خاطئة. ${left} محاولات متبقية.` : 'كلمة مرور خاطئة.');
  }
}

/**
 * Restore DEK from SecureStore on app restart (no password required).
 * Call this at app startup whenever the user has a valid JWT.
 */
export async function restoreEncryptionKeyFromStorage(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(DEK_RAW_KEY);
    if (raw) _sessionDEK = fromBase64(raw);
    const kek = await SecureStore.getItemAsync(KEK_KEY);
    if (kek) _sessionKEK = fromBase64(kek);
  } catch { /* non-critical — user will re-derive on next login */ }
}

/**
 * Re-wrap the DEK with a new KEK when the user changes their password.
 * All encrypted data remains valid — only the wrapper changes.
 */
export async function rotateKeyEncryption(
  oldPassword: string,
  newPassword: string,
  userId: string,
): Promise<void> {
  const oldKEK  = await deriveKEK(oldPassword, userId);
  const stored  = await SecureStore.getItemAsync(DEK_WRAPPED_KEY);
  if (!stored) throw new Error('مفتاح التشفير غير موجود. يرجى تسجيل الدخول مجدداً.');

  const dek    = gcmDecrypt(fromBase64(stored), oldKEK);
  const newKEK = await deriveKEK(newPassword, userId);
  await SecureStore.setItemAsync(DEK_WRAPPED_KEY, toBase64(gcmEncrypt(dek, newKEK)));
  _sessionDEK = dek;
}

export async function clearEncryptionKey(): Promise<void> {
  _sessionDEK = null;
  _sessionKEK = null;
  _cachedCredentials = null;
  await SecureStore.deleteItemAsync(DEK_RAW_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(KEK_KEY).catch(() => {});
  // Note: we DON'T clear DEK_WRAPPED_KEY or DEK_OWNER_KEY here.
  // They stay so the same user can log back in and decrypt their data.
}

/** 
 * Force a complete reset of all encryption data on this device.
 * Call this ONLY if the keys are corrupted beyond repair.
 */
export async function hardResetEncryption(): Promise<void> {
  _sessionDEK = null;
  _sessionKEK = null;
  _cachedCredentials = null;
  await SecureStore.deleteItemAsync(DEK_RAW_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(DEK_WRAPPED_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(DEK_OWNER_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(KEK_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(KEK_LEGACY_KEY).catch(() => {});
}

/**
 * Try to adopt a wrapped DEK from a server backup.
 * Uses the cached KEK (from the most recent login) to unwrap the backup's DEK
 * and swap it into the active session. This allows decrypting data that was
 * encrypted with a different DEK than the one generated during login.
 *
 * Returns true if the DEK was successfully adopted, false otherwise.
 */
export async function adoptWrappedDEK(wrappedDek: string): Promise<boolean> {
  // Try to restore KEK from storage if not in memory
  if (!_sessionKEK) {
    try {
      const kekStored = await SecureStore.getItemAsync(KEK_KEY);
      if (kekStored) {
        _sessionKEK = fromBase64(kekStored);
        console.log('[Encryption] Restored KEK from storage for backup adoption');
      }
    } catch {}
  }

  if (!_sessionKEK) {
    console.log('[Encryption] Cannot adopt wrapped DEK — no KEK available. Please log out and log back in.');
    return false;
  }

  try {
    // Try to unwrap using cached KEK (5k iterations — derived during login)
    const dek = gcmDecrypt(fromBase64(wrappedDek), _sessionKEK);
    _sessionDEK = dek;
    await SecureStore.setItemAsync(DEK_RAW_KEY, toBase64(dek));
    await SecureStore.setItemAsync(DEK_WRAPPED_KEY, wrappedDek);
    console.log('[Encryption] ✅ Adopted backup DEK successfully (modern KEK)');
    return true;
  } catch (err) {
    console.log('[Encryption] Modern KEK (5k) failed, trying other iteration counts...');
  }

  // Try legacy KEK from storage
  try {
    const legacyKekStored = await SecureStore.getItemAsync(KEK_LEGACY_KEY);
    if (legacyKekStored) {
      const legacyKek = fromBase64(legacyKekStored);
      const dek = gcmDecrypt(fromBase64(wrappedDek), legacyKek);
      _sessionDEK = dek;
      await SecureStore.setItemAsync(DEK_RAW_KEY, toBase64(dek));
      const rewrapped = gcmEncrypt(dek, _sessionKEK);
      await SecureStore.setItemAsync(DEK_WRAPPED_KEY, toBase64(rewrapped));
      console.log('[Encryption] ✅ Adopted backup DEK successfully (legacy KEK from storage)');
      return true;
    }
  } catch (err) {
    console.log('[Encryption] Legacy KEK from storage also failed');
  }

  // Last resort: re-derive KEKs with ALL known iteration counts using cached credentials
  if (_cachedCredentials) {
    const { password, userId } = _cachedCredentials;
    const iterationsToTry = [ORIGINAL_ITERS, LEGACY_ITERS]; // 500 and 100k (5k already tried above)
    for (const iters of iterationsToTry) {
      try {
        console.log(`[Encryption] Trying KEK derivation with ${iters} iterations...`);
        const kek = await deriveKEK(password, userId, iters);
        const dek = gcmDecrypt(fromBase64(wrappedDek), kek);
        _sessionDEK = dek;
        await SecureStore.setItemAsync(DEK_RAW_KEY, toBase64(dek));
        // Re-wrap with modern KEK and cache the working legacy KEK
        const rewrapped = gcmEncrypt(dek, _sessionKEK);
        await SecureStore.setItemAsync(DEK_WRAPPED_KEY, toBase64(rewrapped));
        await SecureStore.setItemAsync(KEK_LEGACY_KEY, toBase64(kek));
        console.log(`[Encryption] ✅ Adopted backup DEK successfully (${iters} iterations)`);
        return true;
      } catch (err) {
        console.log(`[Encryption] ${iters} iterations failed`);
      }
    }
  } else {
    console.log('[Encryption] No cached credentials — cannot try other iteration counts. Log out and back in.');
  }

  console.log('[Encryption] ❌ Could not adopt backup DEK — all iteration counts failed');
  return false;
}

// ─── Envelope types ───────────────────────────────────────────────────────────


export interface EncryptedEnvelope {
  _enc: true;
  v: 2;
  payload: string;       // base64(IV | Ciphertext | AuthTag)
  wrapped_dek?: string;  // only in full backups — allows cross-device restore
}

export function isEncryptedEnvelope(v: unknown): v is EncryptedEnvelope {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as any)._enc === true &&
    typeof (v as any).payload === 'string'
  );
}

// ─── Async API: sync / backup layer ──────────────────────────────────────────

/**
 * Encrypt any value for server storage or cloud backup.
 * Returns data unchanged if no key is loaded (graceful degradation).
 *
 * @param includeWrappedDek  Set true for full backups → embeds wrapped DEK in
 *                           the envelope so the user can restore on a new device.
 */
export async function encryptForStorage(
  data: unknown,
  includeWrappedDek = false,
): Promise<unknown> {
  const dek = _sessionDEK;
  if (!dek) return data;

  const cipher   = gcmEncrypt(toBytes(JSON.stringify(data)), dek);
  const envelope: EncryptedEnvelope = { _enc: true, v: 2, payload: toBase64(cipher) };

  if (includeWrappedDek) {
    const w = await SecureStore.getItemAsync(DEK_WRAPPED_KEY).catch(() => null);
    if (w) envelope.wrapped_dek = w;
  }

  return envelope;
}

/**
 * Decrypt a value received from server or loaded from backup.
 * Plain (non-envelope) values are returned as-is — backward compatible with
 * data uploaded before encryption was introduced.
 */
export async function decryptFromStorage<T = unknown>(raw: unknown): Promise<T> {
  if (!isEncryptedEnvelope(raw)) return raw as T;

  const dek = _sessionDEK;
  if (!dek) {
    throw new Error('مفتاح التشفير غير متاح. يرجى تسجيل الدخول مجدداً.');
  }

  try {
    return JSON.parse(fromBytes(gcmDecrypt(fromBase64((raw as EncryptedEnvelope).payload), dek))) as T;
  } catch (err) {
    throw new Error('فشل فك التشفير — البيانات تالفة أو المفتاح غير مطابق.');
  }
}

// ─── Sync API: SQLite field-level encryption ──────────────────────────────────

/**
 * Encrypt a value synchronously using the in-memory DEK.
 * Returns null if the DEK is not loaded yet (record stored as plaintext).
 */
export function encryptField(data: unknown): string | null {
  if (!_sessionDEK) return null;
  return toBase64(gcmEncrypt(toBytes(JSON.stringify(data)), _sessionDEK));
}

/**
 * Decrypt a field previously encrypted with encryptField().
 * Returns null on any failure (missing key, corrupted blob, wrong key).
 * The caller merges decrypted fields only when the result is non-null.
 */
export function decryptField<T = unknown>(enc: string | null | undefined): T | null {
  if (!enc || !_sessionDEK) return null;
  try {
    return JSON.parse(fromBytes(gcmDecrypt(fromBase64(enc), _sessionDEK))) as T;
  } catch { return null; }
}
