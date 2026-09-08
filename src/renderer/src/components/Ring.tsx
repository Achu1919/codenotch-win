import type { ProviderSnapshot } from '../../../shared/types';
import { usageColor } from '../lib/format';

/**
 * The usage ring. Zero still shows a hairline of color (a 0% arc is invisible);
 * status-only rings (stale/needsAuth/error) carry a small status dot at the
 * top instead of any arc — never a fraction that isn't real.
 */
export function Ring({
  size = 22,
  used,
  status,
}: {
  size?: number;
  used: number | null;
  status: ProviderSnapshot['status'];
}) {
  const stroke = Math.max(2.5, size * 0.16);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = used == null ? 0 : Math.max(0, Math.min(1, used));
  const color = usageColor(used);
  const hasArc = status === 'ok' && used != null;
  const statusDot =
    status === 'stale'
      ? '#fbbf24'
      : status === 'needsAuth' || status === 'error'
        ? '#f87171'
        : status === 'rateLimited'
          ? '#fbbf24'
          : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        {hasArc && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(frac, 0.03))}
            style={{ transition: 'stroke-dashoffset 500ms ease, stroke 300ms ease' }}
          />
        )}
      </svg>
      {hasArc && size >= 28 && (
        <span
          className="absolute inset-0 flex items-center justify-center font-mono"
          style={{ fontSize: Math.round(size * 0.34), color }}
        >
          {Math.round(frac * 100)}
        </span>
      )}
      {!hasArc && statusDot && (
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: 5, height: 5, background: statusDot, boxShadow: `0 0 6px ${statusDot}` }}
        />
      )}
    </div>
  );
}
