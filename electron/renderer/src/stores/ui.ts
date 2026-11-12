import { create } from 'zustand';

type SettingsTab = 'general' | 'runtimes';

interface UiState {
  // True once the startup overlay has finished its minimum-duration sequence.
  // Domain refreshes wait for this so they begin only after the window and
  // startup animation are visible.
  booted: boolean;
  setBooted: (booted: boolean) => void;
  // Cross-page request to open the create-instance dialog (command palette).
  createInstanceOpen: boolean;
  setCreateInstanceOpen: (open: boolean) => void;
  // Same for the import-instance dialog.
  importInstanceOpen: boolean;
  setImportInstanceOpen: (open: boolean) => void;
  // Settings/About open as in-window flyouts over the current screen rather
  // than navigating to dedicated routes.
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  aboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;
  // Which Settings tab to show when the flyout opens (search deep-links).
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  // One-shot focus requests consumed by the Instances/Servers pages when the
  // command palette jumps to a specific entry.
  focusInstanceId: string | null;
  requestInstanceFocus: (id: string | null) => void;
  focusServerId: string | null;
  requestServerFocus: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  booted: false,
  setBooted: (booted) => set({ booted }),
  createInstanceOpen: false,
  setCreateInstanceOpen: (createInstanceOpen) => set({ createInstanceOpen }),
  importInstanceOpen: false,
  setImportInstanceOpen: (importInstanceOpen) => set({ importInstanceOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  aboutOpen: false,
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  settingsTab: 'general',
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  focusInstanceId: null,
  requestInstanceFocus: (focusInstanceId) => set({ focusInstanceId }),
  focusServerId: null,
  requestServerFocus: (focusServerId) => set({ focusServerId }),
}));
