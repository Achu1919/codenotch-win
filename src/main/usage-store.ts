import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { backoffMs, UsageProvider, UsageProviderError } from './provider';
import type {
  PersistedState,
  ProviderId,
  ProviderSnapshot,
  Settings,
} from '../shared/types';

/**
 * UsageStore — the main-process polling engine (codenotch's UsageStore,
 * ported). Owns:
 *  - the timer that polls each enabled provider
 *  - last-good snapshots across launches (persisted to disk)
 *  - 429 backoff schedules that survive relaunch
 *  - degrading every failure to a visible status (never a fake percentage)
 */

const STATE_FILE = path.join(appDataDir(), 'state.json');

export function appDataDir(): string {
  const base = process.env.APPDATA || os.homedir();
  return path.join(base, 'CodeNotch');
}

export function stateFile(): string {
  return STATE_FILE;
}

interface ProviderRuntime {
  provider: UsageProvider;
  snapshot: ProviderSnapshot | null;
  consecutiveRateLimits: number;
  backoffUntil: number | null;
}

export class UsageStore {
  private providers = new Map<ProviderId, ProviderRuntime>();
  private settings: Settings;
  private timer: NodeJS.Timeout | null = null;
  private inFlight = new Set<ProviderId>();
  private listeners: Array<(s: ProviderSnapshot[]) => void> = [];
  private statePath: string;

  constructor(
    providers: UsageProvider[],
    settings: Settings,
    statePath?: string,
  ) {
    this.statePath = statePath ?? stateFile();
    this.settings = settings;
    for (const p of providers) {
      this.providers.set(p.id, { provider: p, snapshot: null, consecutiveRateLimits: 0, backoffUntil: null });
    }
    this.loadState();
  }

  onChange(fn: (s: ProviderSnapshot[]) => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    const list = this.list();
    for (const fn of this.listeners) fn(list);
  }

  /** All snapshots, provider registry order, disabled ones included. */
  list(): ProviderSnapshot[] {
    const out: ProviderSnapshot[] = [];
    for (const [, rt] of this.providers) {
      out.push(
        rt.snapshot ?? {
          id: rt.provider.id,
          displayName: rt.provider.displayName,
          fidelity: 'official',
          status: 'loading',
          windows: [],
          headlineId: '',
          lastGoodAt: null,
          lastAttemptAt: null,
          message: null,
          retryAfterMs: null,
          account: null,
        },
      );
    }
    return out;
  }

  /** Kick off fetches for every enabled provider, respecting backoff. */
  refreshAll(): void {
    for (const [id, rt] of this.providers) {
      if (this.settings.providers[id] === false) {
        this.setSnapshot(id, disabledSnapshot(rt));
        continue;
      }
      const now = Date.now();
      if (rt.backoffUntil && rt.backoffUntil > now) {
        this.setSnapshot(id, { ...this.snapshotFor(id), status: 'rateLimited', retryAfterMs: rt.backoffUntil - now });
        continue;
      }
      if (this.inFlight.has(id)) continue;
      this.inFlight.add(id);
      this.fetchOne(id)
        .catch(() => {}) // errors already degraded into the snapshot
        .finally(() => this.inFlight.delete(id));
    }
  }

  refreshOne(id: ProviderId): void {
    const rt = this.providers.get(id);
    if (!rt) return;
    rt.backoffUntil = null;
    this.fetchOne(id).catch(() => {});
  }

  updateSettings(s: Settings): void {
    this.settings = s;
    this.restartTimer();
    // Re-emit so disabled providers flip to the disabled state immediately.
    this.refreshAll();
  }

  private snapshotFor(id: ProviderId): ProviderSnapshot {
    const rt = this.providers.get(id);
    return (
      rt?.snapshot ?? {
        id,
        displayName: rt?.provider.displayName ?? id,
        fidelity: 'official',
        status: 'loading',
        windows: [],
        headlineId: '',
        lastGoodAt: null,
        lastAttemptAt: null,
        message: null,
        retryAfterMs: null,
        account: null,
      }
    );
  }

  private setSnapshot(id: ProviderId, snap: ProviderSnapshot): void {
    const rt = this.providers.get(id);
    if (!rt) return;
    rt.snapshot = snap;
    this.saveState();
    this.emit();
  }

  private async fetchOne(id: ProviderId): Promise<void> {
    const rt = this.providers.get(id);
    if (!rt) return;
    const now = Date.now();
    const prev = rt.snapshot;
    const base: ProviderSnapshot = {
      ...(prev ?? emptySnapshot(id, rt.provider.displayName)),
      lastAttemptAt: now,
    };
    rt.snapshot = base; // attempt timestamp visible even while in flight
    try {
      const snap = await rt.provider.fetchSnapshot();
      rt.consecutiveRateLimits = 0;
      rt.backoffUntil = null;
      rt.snapshot = snap;
      this.saveState();
      this.emit();
    } catch (err) {
      const upe =
        err instanceof UsageProviderError
          ? err
          : new UsageProviderError('network', err instanceof Error ? err.message : 'Unknown failure');
      const degraded = degrade(base, upe, rt.consecutiveRateLimits);
      if (upe.type === 'rateLimited') {
        rt.consecutiveRateLimits += 1;
        rt.backoffUntil = Date.now() + degraded.retryAfterMs!;
      } else if (upe.type === 'needsAuth') {
        // A stale credential won't heal by hammering; retry on the normal cadence.
        rt.backoffUntil = null;
      } else {
        rt.backoffUntil = Date.now() + 60_000; // brief pause after hard failures
        rt.consecutiveRateLimits = 0;
      }
      rt.snapshot = degraded;
      this.saveState();
      this.emit();
    }
  }

  private restartTimer(): void {
    if (this.timer) clearInterval(this.timer);
    const sec = clampInterval(this.settings.pollIntervalSec);
    this.timer = setInterval(() => this.refreshAll(), sec * 1000);
    this.refreshAll();
  }

  start(): void {
    this.restartTimer();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private loadState(): void {
    try {
      const raw = fs.readFileSync(this.statePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedState;
      for (const [id, snap] of Object.entries(parsed.snapshots ?? {})) {
        const rt = this.providers.get(id as ProviderId);
        if (rt && snap) {
          // Restored readings are stale by definition until a fresh fetch lands.
          rt.snapshot = { ...snap, status: snap.status === 'ok' ? 'stale' : snap.status };
        }
      }
    } catch {
      // first run / corrupt file — start empty
    }
  }

  private saveState(): void {
    try {
      fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
      const snapshots: PersistedState['snapshots'] = {};
      for (const [id, rt] of this.providers) {
        if (rt.snapshot) snapshots[id] = rt.snapshot;
      }
      fs.writeFileSync(this.statePath, JSON.stringify({ snapshots } satisfies PersistedState, null, 2));
    } catch {
      // persistence is best-effort; the app still works without it
    }
  }
}

/** Turn a thrown provider error into a snapshot the UI can render honestly. */
function degrade(
  base: ProviderSnapshot,
  err: UsageProviderError,
  consecutiveRateLimits: number,
): ProviderSnapshot {
  const hadGoodData = base.lastGoodAt != null;
  let status: ProviderSnapshot['status'];
  let message = err.message;
  switch (err.type) {
    case 'needsAuth':
    case 'credentialExpired':
      status = 'needsAuth';
      break;
    case 'rateLimited': {
      status = 'rateLimited';
      message = 'Rate limited — backing off, will retry automatically';
      break;
    }
    case 'nothingMetered':
      status = 'nothingMetered';
      break;
    case 'badResponse':
    case 'network':
    default:
      status = hadGoodData ? 'stale' : 'error';
      break;
  }
  const retryAfterMs =
    err.type === 'rateLimited' ? backoffMs(consecutiveRateLimits, err.retryAfterMs) : null;
  return {
    ...base,
    status,
    windows: status === 'stale' || status === 'rateLimited' ? base.windows : [],
    message,
    retryAfterMs,
    account: base.account,
  };
}

function disabledSnapshot(rt: { provider: UsageProvider; snapshot: ProviderSnapshot | null }): ProviderSnapshot {
  return {
    id: rt.provider.id,
    displayName: rt.provider.displayName,
    fidelity: 'official',
    status: 'disabled',
    windows: [],
    headlineId: '',
    lastGoodAt: rt.snapshot?.lastGoodAt ?? null,
    lastAttemptAt: null,
    message: 'Turned off in settings',
    retryAfterMs: null,
    account: null,
  };
}

function emptySnapshot(id: ProviderId, displayName: string): ProviderSnapshot {
  return {
    id,
    displayName,
    fidelity: 'official',
    status: 'loading',
    windows: [],
    headlineId: '',
    lastGoodAt: null,
    lastAttemptAt: null,
    message: null,
    retryAfterMs: null,
    account: null,
  };
}

export function clampInterval(sec: number): number {
  const n = Math.round(Number(sec));
  if (!Number.isFinite(n)) return 300;
  return Math.max(60, Math.min(3600, n));
}
