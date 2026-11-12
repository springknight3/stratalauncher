import { create } from 'zustand';

// A domain store holds the latest JSON state snapshot published by the core
// (either via a `*.state` request or pushed inside an event's `state`/`snapshot`
// param). Components subscribe selectively; high-frequency events update these
// external stores, never React state.
export interface SnapshotState {
  state: Record<string, unknown> | null;
  setState: (state: Record<string, unknown>) => void;
}

export function createSnapshotStore() {
  return create<SnapshotState>((set) => ({
    state: null,
    setState: (state) => set({ state }),
  }));
}
