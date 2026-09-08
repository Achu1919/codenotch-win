import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';

import { UsageStore } from './usage-store';
import { OpenCodeProvider } from './providers/opencode';
import { CodexProvider } from './providers/codex';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  loadWindowPos,
  saveSettings,
  saveWindowPos,
} from './settings';
import type { ProviderSnapshot, Settings } from '../shared/types';

/**
 * Main process: owns the frameless always-on-top window, the UsageStore
 * polling loop, auto-start registration, and the IPC surface.
 */

const WIDGET_W = 400;
const WIDGET_H = 280;

let win: BrowserWindow | null = null;
let store: UsageStore | null = null;
let settings: Settings = { ...DEFAULT_SETTINGS, providers: { ...DEFAULT_SETTINGS.providers } };

// --- single instance --------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
}

function computeCornerPosition(corner: Settings['corner']): { x: number; y: number } {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea; // excludes the taskbar — codenotch pins to the usable edge
  const gap = 16;
  switch (corner) {
    case 'bottom-left':
      return { x: wa.x + gap, y: wa.y + wa.height - WIDGET_H - gap };
    case 'top-right':
      return { x: wa.x + wa.width - WIDGET_W - gap, y: wa.y + gap };
    case 'top-left':
      return { x: wa.x + gap, y: wa.y + gap };
    case 'bottom-right':
    default:
      return { x: wa.x + wa.width - WIDGET_W - gap, y: wa.y + wa.height - WIDGET_H - gap };
  }
}

function clampToWorkArea(x: number, y: number): { x: number; y: number } {
  const wa = screen.getPrimaryDisplay().workArea;
  const cx = Math.max(wa.x, Math.min(x, wa.x + wa.width - WIDGET_W));
  const cy = Math.max(wa.y, Math.min(y, wa.y + wa.height - WIDGET_H));
  return { x: cx, y: cy };
}

function createWindow(): void {
  const savedPos = loadWindowPos(app.getPath('userData'));
  const pos = savedPos
    ? clampToWorkArea(savedPos.x, savedPos.y)
    : computeCornerPosition(settings.corner);

  win = new BrowserWindow({
    width: WIDGET_W,
    height: WIDGET_H,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Float above other always-on-top windows; visibleOnFullScreen keeps it up
  // over fullscreen apps on Windows where practical.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.on('moved', () => {
    if (!win) return;
    const [x, y] = win.getPosition();
    saveWindowPos(app.getPath('userData'), { x, y });
  });

  win.on('closed', () => {
    win = null;
  });
}

// --- IPC --------------------------------------------------------------------

function registerIpc(): void {
  ipcMain.handle('notch:getSnapshots', (): ProviderSnapshot[] => store?.list() ?? []);

  ipcMain.handle('notch:refresh', (_e, id?: string) => {
    if (id) store?.refreshOne(id as never);
    else store?.refreshAll();
  });

  ipcMain.handle('notch:getSettings', (): Settings => settings);

  ipcMain.handle('notch:setSettings', (_e, next: Settings & { moveToCorner?: boolean }) => {
    const { moveToCorner, ...rest } = next;
    settings = rest;
    saveSettings(app.getPath('userData'), settings);
    applyAutoStart(settings.autoStart);
    store?.updateSettings(settings);
    if (moveToCorner && win) {
      const pos = computeCornerPosition(settings.corner);
      win.setPosition(pos.x, pos.y);
      saveWindowPos(app.getPath('userData'), pos);
    }
    return settings;
  });

  ipcMain.handle('notch:getCredentials', () => {
    const opencode = new OpenCodeProvider();
    const codex = new CodexProvider();
    return [opencode.credentialInfo(), codex.credentialInfo()];
  });

  ipcMain.handle('notch:quit', () => {
    app.quit();
  });

  // Click-through control: the window is a fixed-size transparent overlay.
  // When the cursor is NOT over the card, the window passes clicks through
  // (forward keeps mousemove flowing so we can detect re-entry).
  ipcMain.handle('notch:setHover', (_e, hovering: boolean) => {
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(!hovering, { forward: true });
  });
}

// --- auto-start (registry Run key via app.setLoginItemSettings) --------------

function applyAutoStart(enabled: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: ['--hidden'],
    });
  } catch {
    // best-effort; settings UI reflects the attempt
  }
}

// --- lifecycle ---------------------------------------------------------------

app.whenReady().then(() => {
  settings = loadSettings(app.getPath('userData'));

  store = new UsageStore(
    [new OpenCodeProvider(), new CodexProvider()],
    settings,
    path.join(app.getPath('userData'), 'state.json'),
  );
  store.onChange((snapshots) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('notch:snapshots', snapshots);
    }
  });
  store.start();

  registerIpc();
  createWindow();
  applyAutoStart(settings.autoStart);
});

app.on('window-all-closed', () => {
  // Widget lives in the tray/notification area conceptually; quitting is via
  // the settings panel's Quit button (notch:quit).
  app.quit();
});

app.on('before-quit', () => {
  store?.stop();
});
