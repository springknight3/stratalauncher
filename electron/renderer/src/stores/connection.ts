import { create } from 'zustand';

import type { CoreStatus } from '../../../shared/ipc';

interface ConnectionState {
  status: CoreStatus;
  setStatus: (status: CoreStatus) => void;
}

// High-frequency IPC events belong in external stores, not React state.
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: { state: 'starting' },
  setStatus: (status) => set({ status }),
}));
