import fs from 'node:fs';
import path from 'node:path';

import type { Settings } from '../shared/types';

/**
 * Settings persistence — a plain JSON file in %APPDATA%/CodeNotch.
 * (Hand-rolled rather than electron-store to keep the app pure-JS,
 * which keeps the packaged build simple.)
 */

export function settingsDir(appDataPath: string): string {
  return path.join(appDataPath, 'CodeNotch');
}

export function settingsFile(appDataPath: string): string {
  return path.join(settingsDir(appDataPath), 'settings.json');
}

export const DEFAULT_SETTINGS: Settings = {
  corner: 'bottom-right',
  pollIntervalSec: 300, // 5 minutes, per the brief
  autoStart: false,
  providers: { opencode: true, codex: true },
  theme: 'dark',
};

export function loadSettings(appDataPath: string): Settings {
  try {
    const raw = fs.readFileSync(settingsFile(appDataPath), 'utf8');
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      providers: { ...DEFAULT_SETTINGS.providers, ...(parsed.providers ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers } };
  }
}

export function saveSettings(appDataPath: string, settings: Settings): void {
  try {
    const dir = settingsDir(appDataPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settingsFile(appDataPath), JSON.stringify(settings, null, 2));
  } catch {
    // best-effort — a failed settings write must not crash the widget
  }
}

/** Window position persists outside Settings (it's geometry, not preference). */
export interface WindowPos {
  x: number;
  y: number;
}

export function loadWindowPos(appDataPath: string): WindowPos | null {
  try {
    const raw = fs.readFileSync(path.join(settingsDir(appDataPath), 'window.json'), 'utf8');
    const pos = JSON.parse(raw) as WindowPos;
    if (typeof pos.x === 'number' && typeof pos.y === 'number') return pos;
    return null;
  } catch {
    return null;
  }
}

export function saveWindowPos(appDataPath: string, pos: WindowPos): void {
  try {
    const dir = settingsDir(appDataPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'window.json'), JSON.stringify(pos));
  } catch {
    // best-effort
  }
}
