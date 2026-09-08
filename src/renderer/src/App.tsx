import { useCallback, useEffect, useRef, useState } from 'react';
import type { CredentialInfo, ProviderSnapshot, Settings } from '../../shared/types';
import { ProviderRow } from './components/ProviderRow';
import { Ring } from './components/Ring';
import { SettingsPanel } from './components/SettingsPanel';
import { timeAgo } from './lib/format';

/**
 * CodeNotch — collapsed pill → hover expands into the detail card.
 *
 * The Electron window is a fixed-size transparent overlay (400×280). The card
 * anchors to the bottom-right corner inside it and expands upward in place —
 * no window resize on hover (which would flicker). Outside the card the window
 * passes clicks through to whatever is underneath (`setIgnoreMouseEvents` with
 * forwarded mousemoves so we can detect re-entry).
 *
 * Drag the pill/card anywhere; the main process persists geometry.
 */

type View = 'collapsed' | 'expanded' | 'settings';

function headlineOf(snap: ProviderSnapshot) {
  return snap.windows.find((w) => w.id === snap.headlineId) ?? snap.windows[0] ?? null;
}

export default function App() {
  const [snapshots, setSnapshots] = useState<ProviderSnapshot[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [credentials, setCredentials] = useState<CredentialInfo[]>([]);
  const [view, setView] = useState<View>('collapsed');
  const [now, setNow] = useState(Date.now());
  const cardRef = useRef<HTMLDivElement>(null);
  const hoveringRef = useRef(false);

  // clock tick so "resets in"/"updated" strings stay honest
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const [snaps, sets, creds] = await Promise.all([
        window.notch.getSnapshots(),
        window.notch.getSettings(),
        window.notch.getCredentials(),
      ]);
      if (cancelled) return;
      setSnapshots(snaps);
      setSettings(sets);
      setCredentials(creds);
      unsub = window.notch.onSnapshots(setSnapshots);
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const pushHover = useCallback((h: boolean) => {
    if (hoveringRef.current !== h) {
      hoveringRef.current = h;
      void window.notch.setHover(h);
    }
  }, []);

  // Cursor moved anywhere over the window: interactive only when over the card.
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = cardRef.current?.getBoundingClientRect();
      const inside =
        !!rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      pushHover(inside);
    },
    [pushHover],
  );

  const applySettings = useCallback((next: Settings & { moveToCorner?: boolean }) => {
    const { moveToCorner, ...rest } = next;
    setSettings((prev) => (prev ? { ...prev, ...rest } : rest));
    void window.notch.setSettings(next);
  }, []);

  const refresh = useCallback(() => {
    void window.notch.refresh();
  }, []);

  const enabled = snapshots.filter((s) => settings?.providers[s.id] !== false);
  const overall = (() => {
    const heads = enabled.map(headlineOf).filter((w): w is NonNullable<typeof w> => !!w);
    if (heads.length === 0) return null;
    return heads.reduce((acc, w) => acc + w.usedFraction, 0) / heads.length;
  })();
  const anyBad = enabled.some((s) => ['stale', 'error', 'needsAuth', 'rateLimited'].includes(s.status));

  return (
    <div className="h-screen w-screen" onMouseMove={onMouseMove}>
      <div
        ref={cardRef}
        id="notch-card"
        onMouseEnter={() => setView((v) => (v === 'collapsed' ? 'expanded' : v))}
        onMouseLeave={() => setView('collapsed')}
        className="absolute bottom-2 right-2 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
        style={{
          WebkitAppRegion: 'drag',
          width: view === 'collapsed' ? 'fit-content' : 376,
          height: view === 'collapsed' ? 'fit-content' : 264,
          transition: 'width 200ms ease, height 200ms ease',
        } as React.CSSProperties}
      >
        {view === 'collapsed' ? (
          <CollapsedPill snapshots={enabled} overall={overall} anyBad={anyBad} onOpenSettings={() => setView('settings')} />
        ) : view === 'expanded' ? (
          <div className="flex h-full flex-col">
            <ExpandedHeader overall={overall} snapshots={enabled} onOpenSettings={() => setView('settings')} onRefresh={refresh} />
            <div
              className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-y-auto"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              {enabled.map((s) => (
                <ProviderRow key={s.id} snap={s} now={now} />
              ))}
            </div>
          </div>
        ) : (
          settings && (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2">
                <span className="text-[11px] font-semibold text-zinc-200">Settings</span>
                <button
                  onClick={() => setView('expanded')}
                  className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/[0.12]"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  Back
                </button>
              </div>
              <div className="min-h-0 flex-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <SettingsPanel
                  settings={settings}
                  credentials={credentials}
                  onSet={applySettings}
                  onRefresh={refresh}
                  onQuit={() => void window.notch.quit()}
                />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CollapsedPill({
  snapshots,
  overall,
  anyBad,
  onOpenSettings,
}: {
  snapshots: ProviderSnapshot[];
  overall: number | null;
  anyBad: boolean;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex h-[52px] items-center gap-3 px-4">
      {overall != null && <Ring size={28} used={overall} status="ok" />}
      <div className="flex items-center gap-2">
        {snapshots.map((s) => {
          const h = headlineOf(s);
          return <Ring key={s.id} size={22} used={h ? h.usedFraction : null} status={s.status} />;
        })}
      </div>
      {anyBad && (
        <span className="rounded bg-amber-400/10 px-1.5 py-px text-[9px] uppercase tracking-wider text-amber-300">
          check
        </span>
      )}
      <span className="flex-1" />
      <button
        onClick={onOpenSettings}
        className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        aria-label="settings"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}

function ExpandedHeader({
  snapshots,
  overall,
  onOpenSettings,
  onRefresh,
}: {
  snapshots: ProviderSnapshot[];
  overall: number | null;
  onOpenSettings: () => void;
  onRefresh: () => void;
}) {
  const freshest = Math.max(...snapshots.map((s) => s.lastGoodAt ?? s.lastAttemptAt ?? 0), 0);
  return (
    <div className="flex items-center gap-2.5 border-b border-white/[0.06] py-2 pl-3.5 pr-7">
      {overall != null && <Ring size={20} used={overall} status="ok" />}
      <span className="text-[12px] font-semibold text-zinc-100">Usage</span>
      <span className="font-mono text-[10px] text-zinc-500">{timeAgo(freshest || null)}</span>
      <span className="flex-1" />
      <button
        onClick={onRefresh}
        className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        aria-label="refresh now"
        title="Refresh now"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
        </svg>
      </button>
      <button
        onClick={onOpenSettings}
        className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        aria-label="settings"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
