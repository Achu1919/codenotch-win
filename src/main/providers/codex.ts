import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { fetchJson, jwtClaims, UsageProvider, UsageProviderError } from '../provider';
import type {
  CredentialInfo,
  LimitWindow,
  ProviderSnapshot,
} from '../../shared/types';

/**
 * Codex usage — borrows the ChatGPT sign-in session Codex already holds at
 * `~/.codex/auth.json`, exactly like codenotch does on macOS. Ported from
 * codenotch (MIT) Sources/Providers/Codex*.
 *
 * The app never refreshes or writes the token. If Codex rotates it, the next
 * poll either works with the fresh token or reports needsAuth — never a guess.
 */

const CODEX_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';

interface LoadedCredential {
  accessToken: string;
  accountId: string;
}

function authPath(): string {
  return path.join(os.homedir(), '.codex', 'auth.json');
}

function loadCredential(): LoadedCredential | null {
  try {
    const raw = fs.readFileSync(authPath(), 'utf8');
    const root = JSON.parse(raw) as {
      tokens?: { access_token?: string; account_id?: string };
    };
    const t = root.tokens;
    const accessToken = t?.access_token?.trim();
    const accountId = t?.account_id?.trim();
    if (!accessToken || !accountId) return null;
    return { accessToken, accountId };
  } catch {
    return null;
  }
}

/** Identity labels from the id_token claims (never the access token's secrets). */
function accountFromIdToken(): { label: string | null; plan: string | null } {
  try {
    const root = JSON.parse(fs.readFileSync(authPath(), 'utf8'));
    const idToken = root.tokens?.id_token;
    if (typeof idToken !== 'string') return { label: null, plan: null };
    const claims = jwtClaims(idToken);
    if (!claims) return { label: null, plan: null };
    const email = typeof claims['email'] === 'string' ? claims['email'] : null;
    const auth = claims['https://api.openai.com/auth'] as { chatgpt_plan_type?: string } | undefined;
    const plan = auth?.chatgpt_plan_type ?? null;
    return { label: email, plan };
  } catch {
    return { label: null, plan: null };
  }
}

interface WhamWindow {
  limit_window_seconds?: number;
  used_percent?: number;
  reset_at?: number;
  reset_after_seconds?: number;
}

interface WhamResponse {
  rate_limit?: {
    primary_window?: WhamWindow;
    secondary_window?: WhamWindow;
  };
}

/** codenotch's label logic: derive the name from the window length actually sent. */
export function codexWindowLabel(windowSeconds: number | undefined, fallback: string): string {
  if (!windowSeconds || windowSeconds <= 0) {
    return fallback === 'primary' ? 'Current session' : 'Longer window';
  }
  const minutes = windowSeconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m limit`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h limit`;
  const days = Math.round(minutes / (60 * 24));
  if (days === 7) return 'Weekly limit';
  if (days === 30) return 'Monthly limit';
  return `${days}d limit`;
}

export async function fetchCodexWindows(cred: LoadedCredential): Promise<LimitWindow[]> {
  const { status, json } = whamToJson(
    await fetchJson(CODEX_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${cred.accessToken}`,
        'ChatGPT-Account-Id': cred.accountId,
        Accept: 'application/json',
        'Cache-Control': 'no-cache, no-store',
      },
    }),
  );

  if (status === 401 || status === 403) {
    throw new UsageProviderError('needsAuth', 'Codex session rejected — sign in again via Codex (401/403)');
  }
  if (status === 429) {
    throw new UsageProviderError('rateLimited', 'Rate limited by ChatGPT (429)', { retryAfterMs: 60_000 });
  }
  if (status < 200 || status >= 300) {
    throw new UsageProviderError('badResponse', `ChatGPT endpoint answered ${status}`, { status });
  }

  const windows: LimitWindow[] = [];
  const rl = json?.rate_limit;
  const pairs: Array<[string, WhamWindow | undefined]> = [
    ['primary', rl?.primary_window],
    ['secondary', rl?.secondary_window],
  ];
  for (const [id, w] of pairs) {
    if (!w) continue;
    if (typeof w.used_percent !== 'number') {
      throw new UsageProviderError('badResponse', 'Codex window missing used_percent');
    }
    const resetsAt =
      typeof w.reset_at === 'number'
        ? new Date(w.reset_at * 1000).toISOString()
        : typeof w.reset_after_seconds === 'number'
          ? new Date(Date.now() + w.reset_after_seconds * 1000).toISOString()
          : null;
    windows.push({
      id,
      label: codexWindowLabel(w.limit_window_seconds, id),
      usedFraction: Math.max(0, Math.min(1, w.used_percent / 100)),
      resetsAt,
      limitWindowSeconds: w.limit_window_seconds,
    });
  }
  if (windows.length === 0) {
    throw new UsageProviderError('nothingMetered', 'Codex reported no usage windows');
  }
  return windows;
}

function whamToJson(r: { status: number; json: unknown }): { status: number; json: WhamResponse | null } {
  return { status: r.status, json: (r.json as WhamResponse) ?? null };
}

class UsageError extends UsageProviderError {}

export class CodexProvider implements UsageProvider {
  readonly id = 'codex' as const;
  readonly displayName = 'Codex';

  async fetchSnapshot(): Promise<ProviderSnapshot> {
    const cred = loadCredential();
    if (!cred) {
      throw new UsageProviderError('needsAuth', 'No Codex sign-in found at ~/.codex/auth.json');
    }
    const windows = await fetchCodexWindows(cred);
    const now = Date.now();
    return {
      id: this.id,
      displayName: 'Codex',
      fidelity: 'official',
      status: 'ok',
      windows,
      headlineId: 'primary',
      lastGoodAt: now,
      lastAttemptAt: now,
      message: null,
      retryAfterMs: null,
      account: accountFromIdToken(),
    };
  }

  credentialInfo(): CredentialInfo {
    const cred = loadCredential();
    return {
      provider: this.id,
      found: !!cred,
      source: cred ? '~/.codex/auth.json' : null,
    };
  }
}
