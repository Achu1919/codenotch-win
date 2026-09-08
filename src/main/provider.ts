import type { CredentialInfo, ProviderId, ProviderSnapshot } from '../shared/types';

/**
 * A usage provider reads one AI coding tool's limits.
 *
 * Contract (ported from codenotch's UsageProvider):
 *  - Never invent numbers. Every failure throws a typed UsageProviderError
 *    that the UsageStore degrades to a visible status.
 *  - Read credentials from wherever the owning tool already stores them.
 *  - credentialInfo() describes WHERE the credential comes from (never its value).
 */
export interface UsageProvider {
  readonly id: ProviderId;
  readonly displayName: string;

  /** One refresh attempt. Resolves with a full snapshot, never a partial guess. */
  fetchSnapshot(): Promise<ProviderSnapshot>;

  /** Where the credential lives right now (null = not found), for settings UI. */
  credentialInfo(): CredentialInfo;
}

export type UsageProviderErrorType =
  | 'needsAuth'
  | 'credentialExpired'
  | 'rateLimited'
  | 'badResponse'
  | 'nothingMetered'
  | 'network';

export class UsageProviderError extends Error {
  readonly type: UsageProviderErrorType;
  /** HTTP status, when the error came from a response */
  readonly status?: number;
  /** ms to wait before retrying (rateLimited) */
  readonly retryAfterMs?: number;

  constructor(
    type: UsageProviderErrorType,
    message: string,
    opts?: { status?: number; retryAfterMs?: number },
  ) {
    super(message);
    this.name = 'UsageProviderError';
    this.type = type;
    this.status = opts?.status;
    this.retryAfterMs = opts?.retryAfterMs;
  }
}

/** Small fetch wrapper with timeout + typed errors, shared by all providers. */
export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; json: unknown }> {
  const { timeoutMs = 15_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // non-JSON body — leave null; caller decides by status
    }
    return { status: res.status, json };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UsageProviderError('network', 'Request timed out');
    }
    throw new UsageProviderError('network', err instanceof Error ? err.message : 'Network failure');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * codenotch's backoff: a minute floor, doubling per consecutive 429, capped
 * at 15 minutes so it always recovers on its own. The server's Retry-After is
 * honoured only as a floor-raiser.
 */
export function backoffMs(consecutive: number, retryAfterMs?: number): number {
  const floor = 60_000;
  const ceiling = 15 * 60_000;
  const doubled = floor * Math.pow(2, Math.min(consecutive, 4));
  return Math.min(ceiling, Math.max(doubled, retryAfterMs ?? 0));
}

/** Read an ISO timestamp that may or may not carry fractional seconds. */
export function parseIso(stamp: string): Date | null {
  const d = new Date(stamp);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Decode JWT claims locally (identity labels + expiry hint only). */
export function jwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}
