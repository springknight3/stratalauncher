import { create } from 'zustand';

import type { JsonRpcEvent } from '../../../shared/ipc';
import { strataApi } from '../lib/strata';

export interface AppearanceSnapshot {
  theme: 'dark' | 'light';
  reduceMotion: boolean;
  vsyncEnabled: boolean;
  frameTimeOverlayEnabled: boolean;
}

interface AppearanceState extends AppearanceSnapshot {
  loaded: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: 'dark' | 'light') => void;
  setReduceMotion: (enabled: boolean) => void;
  setDiagnostics: (vsyncEnabled: boolean, frameTimeOverlayEnabled: boolean) => void;
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

function applyTheme(theme: 'dark' | 'light'): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
}

// Initial value follows the OS until the persisted ThemeSettings value
// arrives via settings.getAppearance (system-preference default).
const initialTheme: 'dark' | 'light' = systemPrefersDark() ? 'dark' : 'light';
applyTheme(initialTheme);

export const useAppearanceStore = create<AppearanceState>((set) => ({
  theme: initialTheme,
  reduceMotion: false,
  vsyncEnabled: false,
  frameTimeOverlayEnabled: false,
  loaded: false,

  hydrate: async () => {
    try {
      const appearance = await strataApi.request<AppearanceSnapshot>('settings.getAppearance');
      const theme = appearance.theme === 'light' ? 'light' : 'dark';
      applyTheme(theme);
      set({ ...appearance, theme, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    void strataApi.request('settings.setTheme', { theme }).catch(() => undefined);
  },

  setReduceMotion: (enabled) => {
    set({ reduceMotion: enabled });
    void strataApi
      .request('settings.setReduceMotion', { enabled })
      .catch(() => undefined);
  },

  setDiagnostics: (vsyncEnabled, frameTimeOverlayEnabled) => {
    set({ vsyncEnabled, frameTimeOverlayEnabled });
    void strataApi
      .request('settings.setDiagnostics', { vsyncEnabled, frameTimeOverlayEnabled })
      .catch(() => undefined);
  },
}));

// Applies pushed ThemeSettings NOTIFY events to the store (and the DOM class).
export function applyAppearanceEvent(event: JsonRpcEvent): void {
  const params = (event.params ?? {}) as Record<string, unknown>;
  const patch: Partial<AppearanceSnapshot> = {};
  if (event.method === 'theme.changed' && typeof params.theme === 'string') {
    const theme = params.theme === 'light' ? 'light' : 'dark';
    applyTheme(theme);
    patch.theme = theme;
  } else if (event.method === 'reduceMotion.changed') {
    patch.reduceMotion = params.reduceMotion === true;
  } else if (event.method === 'diagnostics.changed') {
    patch.vsyncEnabled = params.vsyncEnabled === true;
    patch.frameTimeOverlayEnabled = params.frameTimeOverlayEnabled === true;
  } else {
    return;
  }
  useAppearanceStore.setState(patch);
}
