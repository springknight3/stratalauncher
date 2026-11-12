import { createSnapshotStore } from './snapshotStore';

// LauncherController domain: versions, instances, launch/console, accounts,
// runtimes, servers — everything the launcher.* event family reports.
export const useLauncherStore = createSnapshotStore();
