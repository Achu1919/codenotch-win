import type { ProviderSnapshot } from '../../../shared/types';
import { formatReset, pct, STATUS_BADGE_CLASS, STATUS_TEXT, timeAgo, usageColor } from '../lib/format';
import { Ring } from './Ring';

/** One provider's expanded row: rings per window + reset times + provenance. */
export function ProviderRow({ snap, now }: { snap: ProviderSnapshot; now: number }) {
  const headline = snap.windows.find((w) => w.id === snap.headlineId) ?? snap.windows[0] ?? null;
  const others = snap.windows.filter((w) => w.id !== headline?.id);

  return (
    <div className="flex gap-3 px-3.5 py-2.5">
      <Ring size={30} used={headline ? headline.usedFraction : null} status={snap.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[13px] font-semibold text-zinc-100">{snap.displayName}</span>
            {snap.account?.plan && (
              <span className="rounded bg-zinc-700/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-zinc-300">
                {snap.account.plan}
              </span>
            )}
            {snap.account?.label && (
              <span className="truncate font-mono text-[10px] text-zinc-500">{snap.account.label}</span>
            )}
          </div>
          <span className={`shrink-0 rounded border px-1.5 py-px text-[9px] uppercase tracking-wider ${STATUS_BADGE_CLASS[snap.status]}`}>
            {STATUS_TEXT[snap.status]}
          </span>
        </div>

        {/* windows */}
        <div className="mt-1.5 space-y-1">
          {snap.windows.length === 0 && (
            <div className="text-[11px] leading-snug text-zinc-500">
              {snap.message ?? STATUS_TEXT[snap.status]}
            </div>
          )}
          {snap.windows.map((w) => (
            <div key={w.id} className="flex items-center gap-2 text-[11px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: usageColor(w.usedFraction) }} />
              <span className="w-24 shrink-0 text-zinc-400">{w.label}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, w.usedFraction * 100))}%`,
                    background: usageColor(w.usedFraction),
                    transition: 'width 500ms ease',
                  }}
                />
              </div>
              <span className="w-9 shrink-0 text-right font-mono text-zinc-300">{pct(w.usedFraction)}</span>
            </div>
          ))}
        </div>

        {/* footer: reset + freshness */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
          {snap.windows.map((w) => {
            const reset = formatReset(w.resetsAt, now);
            return reset ? <span key={w.id}>{w.label}: {reset}</span> : null;
          })}
          {(snap.lastGoodAt != null || snap.lastAttemptAt != null) && (
            <span>
              {snap.status === 'ok'
                ? `updated ${timeAgo(snap.lastGoodAt, now)}`
                : snap.lastGoodAt != null
                  ? `last good ${timeAgo(snap.lastGoodAt, now)}`
                  : `tried ${timeAgo(snap.lastAttemptAt, now)}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
