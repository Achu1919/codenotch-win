import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload: the only bridge between the sandboxed renderer and the main
 * process. Narrow, typed, no node APIs leak.
 */

const api = {
  getSnapshots: () => ipcRenderer.invoke('notch:getSnapshots'),
  refresh: (id?: string) => ipcRenderer.invoke('notch:refresh', id),
  getSettings: () => ipcRenderer.invoke('notch:getSettings'),
  setSettings: (settings: unknown) => ipcRenderer.invoke('notch:setSettings', settings),
  getCredentials: () => ipcRenderer.invoke('notch:getCredentials'),
  setHover: (hovering: boolean) => ipcRenderer.invoke('notch:setHover', hovering),
  onSnapshots: (fn: (snapshots: unknown) => void) => {
    const listener = (_e: unknown, snapshots: unknown) => fn(snapshots);
    ipcRenderer.on('notch:snapshots', listener as never);
    return () => ipcRenderer.removeListener('notch:snapshots', listener as never);
  },
  quit: () => ipcRenderer.invoke('notch:quit'),
};

contextBridge.exposeInMainWorld('notch', api);

export type NotchApi = typeof api;
