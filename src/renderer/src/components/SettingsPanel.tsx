import { useEffect, useState } from 'react';
import type { CredentialInfo, Settings } from '../../../shared/types';

const CORNERS: Array<{ id: Settings['corner']; label: string }> = [
  { id: 'bottom-right', label: 'Bottom right' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'top-left', label: 'Top left' },
];

const INTERVALS: Array<{ sec: number; label: string }> = [
  { sec: 60, label: '1 min' },
  { sec: 300, label: '5 min' },
  { sec: 900, label: '15 min' },
  { sec: 1800, label: '30 min' },
];

export function SettingsPanel({
  settings,
  credentials,
  onSet,
  onRefresh,
  onQuit,
}: {
  settings: Settings;
  credentials: CredentialInfo[];
  onSet: (next: Settings & { moveToCorner?: boolean }) => void;
  onRefresh: () => void;
  onQuit: () => void;
}) {
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    if (!confirmQuit) return;
    const t = setTimeout(() => setConfirmQuit(false), 3000);
    return () => clearTimeout(t);
  }, [confirmQuit]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3.5 py-3 text-[11px] text-zinc-300">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Providers</div>
      <div className="space-y-1.5">
        {credentials.map((c) => (
          <div key={c.provider} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    onSet({
                      ...settings,
                      providers: { ...settings.providers, [c.provider]: !settings.providers[c.provider] },
                    })
                  }
                  className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${
                    settings.providers[c.provider] ? 'bg-emerald-400/80' : 'bg-zinc-600'
                  }`}
                  aria-label={`toggle ${c.provider}`}
                >
                  <span
                    className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${
                      settings.providers[c.provider] ? 'left-3' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="font-medium capitalize text-zinc-200">{c.provider}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-zinc-500" title={c.source ?? undefined}>
                {c.found ? `reading: ${c.source}` : 'no sign-in found on this PC'}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Polling</div>
      <div className="flex gap-1">
        {INTERVALS.map((i) => (
          <button
            key={i.sec}
            onClick={() => onSet({ ...settings, pollIntervalSec: i.sec })}
            className={`flex-1 rounded-md px-1 py-1 font-mono text-[10px] transition-colors ${
              settings.pollIntervalSec === i.sec
                ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30'
                : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]'
            }`}
          >
            {i.label}
          </button>
        ))}
      </div>

      <div className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Corner</div>
      <div className="grid grid-cols-2 gap-1">
        {CORNERS.map((c) => (
          <button
            key={c.id}
            onClick={() => onSet({ ...settings, corner: c.id, moveToCorner: true })}
            className={`rounded-md px-1 py-1 text-[10px] transition-colors ${
              settings.corner === c.id
                ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30'
                : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-1.5">
        <span className="text-zinc-200">Start with Windows</span>
        <button
          onClick={() => onSet({ ...settings, autoStart: !settings.autoStart })}
          className={`relative h-3.5 w-6 shrink-0 rounded-full transition-colors ${
            settings.autoStart ? 'bg-emerald-400/80' : 'bg-zinc-600'
          }`}
          aria-label="toggle auto start"
        >
          <span
            className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${
              settings.autoStart ? 'left-3' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex gap-1.5">
        <button
          onClick={onRefresh}
          className="flex-1 rounded-md bg-white/[0.06] px-2 py-1.5 text-[10px] text-zinc-300 transition-colors hover:bg-white/[0.1]"
        >
          Refresh now
        </button>
        <button
          onClick={() => (confirmQuit ? onQuit() : setConfirmQuit(true))}
          className={`flex-1 rounded-md px-2 py-1.5 text-[10px] transition-colors ${
            confirmQuit
              ? 'bg-red-400/20 text-red-300 ring-1 ring-red-400/40'
              : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]'
          }`}
        >
          {confirmQuit ? 'Really quit?' : 'Quit'}
        </button>
      </div>

      <div className="mt-3 text-[9px] leading-relaxed text-zinc-600">
        Rings read the same endpoints the vendors' own dashboards use, borrowing the credentials those
        tools already store on this PC. Failures show as Stale / Not signed in — never a made-up number.
        Drag the pill anywhere; it remembers where you left it.
      </div>
    </div>
  );
}
