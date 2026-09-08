import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  fetchJson,
  parseIso,
  UsageProvider,
  UsageProviderError,
} from '../provider';
import type {
  CredentialInfo,
  LimitWindow,
  ProviderSnapshot,
} from '../../shared/types';

/**
 * OpenCode Go plan usage — the same official endpoint the OpenCode dashboard
 * reads, authenticated with the `opencode-go` key OpenCode itself stores on
 * sign-in. Ported from codenotch (MIT) Sources/Providers/OpenCode*.
 *
 * Credential fallback chain (Windows):
 *  1. `~/.local/share/opencode/auth.json` — OpenCode's own store (both shapes
 *     that have shipped: the key as a plain string, or `{ key: ... }`).
 *  2. `OPENCODE_GO_API_KEY` environment variable (how Hermes holds it here).
 *  3. Hermes profile `.env` file, same variable — read into memory only,
 *     never logged, never sent anywhere but OpenCode's own endpoint.
 */

interface LoadedCredential {
  token: string;
  source: string;
}

const WINDOWS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'rolling', label: '5h limit' },
  { id: 'weekly', label: 'Weekly limit' },
  { id: 'monthly', label: 'Monthly limit' },
];

export const OPENCODE_ENDPOINT = 'https://opencode.ai/zen/go/v1/usage';

function authJsonPath(): string {
  return path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function loadFromAuthJson(): LoadedCredential | null {
  try {
    const raw = fs.readFileSync(authJsonPath(), 'utf8');
    const root = JSON.parse(raw) as Record<string, unknown>;
    const entry = root['opencode-go'];
    if (nonEmpty(entry)) return { token: entry, source: '~/.local/share/opencode/auth.json' };
    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      for (const k of ['key', 'apiKey', 'api_key', 'token', 'accessToken']) {
        if (nonEmpty(obj[k])) {
          return { token: obj[k] as string, source: '~/.local/share/opencode/auth.json' };
        }
      }
    }
  } catch {
    // no file / unreadable — fall through
  }
  return null;
}

function loadFromEnv(): LoadedCredential | null {
  if (nonEmpty(process.env.OPENCODE_GO_API_KEY)) {
    return { token: process.env.OPENCODE_GO_API_KEY as string, source: 'OPENCODE_GO_API_KEY (environment)' };
  }
  return null;
}

/** Hermes profile .env — KEY=VALUE lines; we only read our own variable. */
function loadFromHermesEnv(): LoadedCredential | null {
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'profiles', 'forge', '.env'),
    path.join(os.homedir(), '.hermes', '.env'),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/^\s*OPENCODE_GO_API_KEY\s*=\s*(.+)\s*$/);
        if (m) {
          const value = m[1].trim().replace(/^["']|["']$/g, '');
          if (value) return { token: value, source: `Hermes profile .env (${p.replace(os.homedir(), '~')})` };
        }
      }
    } catch {
      // unreadable — try next candidate
    }
  }
  return null;
}

export function loadOpenCodeCredential(): LoadedCredential | null {
  return loadFromAuthJson() ?? loadFromEnv() ?? loadFromHermesEnv();
}

interface UsageEntry {
  status?: string;
  percent?: number;
  resetsAt?: string;
}

interface UsageRoot {
  usage?: Record<string, UsageEntry>;
}

/** Throws UsageProviderError on any failure — the store degrades, never fakes. */
export async function fetchOpenCodeWindows(token: string): Promise<LimitWindow[]> {
  const { status, json } = await fetchJson(OPENCODE_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  // Upstream serves a missing Go plan as 401, same as a bad key.
  if (status === 401) throw new UsageProviderError('needsAuth', 'Key rejected by OpenCode (401)');
  if (status === 403) {
    throw new UsageProviderError('nothingMetered', 'No OpenCode Go subscription on this key');
  }
  if (status === 429) {
    throw new UsageProviderError('rateLimited', 'Rate limited by OpenCode (429)', { retryAfterMs: 60_000 });
  }
  if (status < 200 || status >= 300) {
    throw new UsageProviderError('badResponse', `OpenCode endpoint answered ${status}`, { status });
  }

  const root = json as UsageRoot | null;
  const usage = root?.usage;
  if (!usage) throw new UsageProviderError('badResponse', 'OpenCode response had no usage object');

  const out: LimitWindow[] = [];
  for (const { id, label } of WINDOWS) {
    const entry = usage[id];
    if (!entry || typeof entry.percent !== 'number') continue;
    out.push({
      id,
      label,
      usedFraction: Math.max(0, Math.min(1, entry.percent / 100)),
      resetsAt: entry.resetsAt && parseIso(entry.resetsAt) ? entry.resetsAt : null,
    });
  }
  if (out.length === 0) {
    throw new UsageProviderError('nothingMetered', 'OpenCode reported no usage windows');
  }
  return out;
}

export class OpenCodeProvider implements UsageProvider {
  readonly id = 'opencode' as const;
  readonly displayName = 'OpenCode Go';

  async fetchSnapshot(): Promise<ProviderSnapshot> {
    const cred = loadOpenCodeCredential();
    if (!cred) {
      throw new UsageProviderError('needsAuth', 'No opencode-go key found (install/sign in to OpenCode, or set OPENCODE_GO_API_KEY)');
    }
    const windows = await fetchOpenCodeWindows(cred.token);
    const now = Date.now();
    return {
      id: this.id,
      displayName: this.displayName,
      fidelity: 'official',
      status: 'ok',
      windows,
      headlineId: 'rolling',
      lastGoodAt: now,
      lastAttemptAt: now,
      message: null,
      retryAfterMs: null,
      account: { label: null, plan: 'Go' },
    };
  }

  credentialInfo(): CredentialInfo {
    const cred = loadOpenCodeCredential();
    return { provider: this.id, found: !!cred, source: cred?.source ?? null };
  }
}
