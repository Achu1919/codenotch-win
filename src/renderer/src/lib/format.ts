import type { ProviderSnapshot } from '../../../shared/types';

/** Ring/badge colors — green = plenty, amber = getting low, red = almost done. */
export function usageColor(used: number | null): string {
  if (used == null) return '#71717a'; // zinc-500
  if (used >= 0.85) return '#f87171'; // red-400
  if (used >= 0.6) return '#fbbf24'; // amber-400
  return '#34d399'; // emerald-400
}

export const STATUS_TEXT: Record<ProviderSnapshot['status'], string> = {
  ok: 'Live',
  loading: 'Reading…',
  stale: 'Stale',
  needsAuth: 'Not signed in',
  error: 'Can’t reach',
  rateLimited: 'Backing off',
  nothingMetered: 'Nothing metered',
  disabled: 'Off',
};

export const STATUS_BADGE_CLASS: Record<ProviderSnapshot['status'], string> = {
  ok: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  loading: 'bg-zinc-400/10 text-zinc-300 border-zinc-400/20',
  stale: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  needsAuth: 'bg-red-400/10 text-red-300 border-red-400/20',
  error: 'bg-red-400/10 text-red-300 border-red-400/20',
  rateLimited: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
  nothingMetered: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
  disabled: 'bg-zinc-400/5 text-zinc-500 border-zinc-500/20',
};

/** "resets in 2h 13m" / "1d 4h" — future only; vendors always send future stamps. */
export function formatReset(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  let s = Math.round((t - now) / 1000);
  if (s <= 0) return 'resetting…';
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `resets in ${d}d ${h}h`;
  if (h > 0) return `resets in ${h}h ${m}m`;
  return `resets in ${m}m`;
}

/** "just now" / "4m ago" / "1h 12m ago" */
export function timeAgo(ms: number | null, now = Date.now()): string {
  if (ms == null) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const mm = m - h * 60;
  return `${h}h ${mm}m ago`;
}

export function pct(used: number | null): string {
  if (used == null) return '–';
  return `${Math.round(used * 100)}%`;
}
