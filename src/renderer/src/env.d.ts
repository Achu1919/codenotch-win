import type {
  CredentialInfo,
  ProviderSnapshot,
  Settings,
} from '../shared/types';

declare global {
  interface Window {
    notch: {
      getSnapshots(): Promise<ProviderSnapshot[]>;
      refresh(id?: string): Promise<void>;
      getSettings(): Promise<Settings>;
      setSettings(settings: Settings & { moveToCorner?: boolean }): Promise<Settings>;
      getCredentials(): Promise<CredentialInfo[]>;
      setHover(hovering: boolean): Promise<void>;
      onSnapshots(fn: (snapshots: ProviderSnapshot[]) => void): () => void;
      quit(): Promise<void>;
    };
  }
}

export {};
