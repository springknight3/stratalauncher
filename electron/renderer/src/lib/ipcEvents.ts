import type { JsonRpcEvent } from '../../../shared/ipc';

import { applyAppearanceEvent } from '../stores/appearance';
import { useContentStore } from '../stores/content';
import { useInstanceSettingsStore } from '../stores/instanceSettings';
import { useLauncherStore } from '../stores/launcher';

interface EventParams {
  state?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
}

// Routes a pushed JSON-RPC event into the matching domain store. The core
// attaches the emitting controller's full property snapshot as `state`
// (`snapshot` for process.state.changed); arg-carrying events may add fields.
export function routeIpcEvent(event: JsonRpcEvent): void {
  if (
    event.method === 'theme.changed' ||
    event.method === 'reduceMotion.changed' ||
    event.method === 'diagnostics.changed'
  ) {
    applyAppearanceEvent(event);
    return;
  }
  const params = (event.params ?? {}) as EventParams;
  // `snapshot` wins: arg-carrying events like process.state.changed reuse the
  // `state` key for a scalar, while the controller snapshot rides in `snapshot`.
  const state =
    params.snapshot ?? (typeof params.state === 'object' ? params.state : undefined);

  if (event.method === 'content.changed') {
    if (state !== undefined) {
      useContentStore.getState().setState(state);
    }
    return;
  }
  if (event.method === 'instanceSettings.changed') {
    if (state !== undefined) {
      useInstanceSettingsStore.getState().setState(state);
    }
    return;
  }
  // All other events originate from the launcher controller family.
  if (state !== undefined) {
    useLauncherStore.getState().setState(state);
  }
}
