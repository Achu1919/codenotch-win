/**
 * Shared types between main and renderer processes.
 *
 * Design rule (from codenotch): every failure degrades to a visible status —
 * `stale`, `needsAuth`, `error`, `rateLimited`, `nothingMetered` — never a
 * made-up percentage.
 */

export type ProviderId = 'opencode' | 'codex';

export type WindowId = string;

/** One metered window (5h / weekly / monthly — the label comes from the data). */
export interface LimitWindow {
  id: WindowId;
  /** e.g. "5h limit", "Weekly limit" — derived from the provider's own data */
  label: string;
  /** 0..1 — fraction of the limit USED (matches the vendor dashboard's "X% used") */
  usedFraction: number;
  /** When this window resets, if the vendor reported it */
  resetsAt: string | null;
  /** Human-reported window length in seconds, when known (Codex sends this) */
  limitWindowSeconds?: number;
}

/** How trustworthy a reading is. */
export type Fidelity = 'official' | 'derived';

export type ProviderStatus =
  | 'ok'
  | 'loading'
  | 'stale'        // had a good reading, but the last refresh failed
  | 'needsAuth'    // no credential found / rejected
  | 'error'        // bad response, network failure
  | 'rateLimited'  // backing off after 429
  | 'nothingMetered'
  | 'disabled';

export interface ProviderSnapshot {
  id: ProviderId;
  displayName: string;
  fidelity: Fidelity;
  status: ProviderStatus;
  windows: LimitWindow[];
  /** Which window is the headline (the collapsed pill's ring) */
  headlineId: WindowId;
  /** ms timestamp of the last successful fetch (null = never succeeded) */
  lastGoodAt: number | null;
  /** ms timestamp when we last attempted a fetch */
  lastAttemptAt: number | null;
  /** If status is an error-ish state, short reason for the hover details */
  message: string | null;
  /** ms until the next retry makes sense (rateLimited) */
  retryAfterMs: number | null;
  /** Account label (email / plan) when available */
  account: { label: string | null; plan: string | null } | null;
}

/** Credential provenance — shown in settings so nothing is mysterious. */
export interface CredentialInfo {
  provider: ProviderId;
  found: boolean;
  /** Which file/source the credential was found in (no secret values) */
  source: string | null;
}

export interface Settings {
  corner: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  pollIntervalSec: number;
  autoStart: boolean;
  providers: Record<ProviderId, boolean>;
  theme: 'dark' | 'light' | 'system';
}

export interface PersistedState {
  snapshots: Partial<Record<ProviderId, ProviderSnapshot>>;
}
