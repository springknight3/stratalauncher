import { useEffect } from 'react';

import { routeIpcEvent } from '../lib/ipcEvents';
import { onCoreEvent, onCoreStatusChange, strataApi } from '../lib/strata';
import { useAppearanceStore } from '../stores/appearance';
import { useConnectionStore } from '../stores/connection';
import { useContentStore } from '../stores/content';
import { useInstanceSettingsStore } from '../stores/instanceSettings';
import { useLauncherStore } from '../stores/launcher';
import { useUiStore } from '../stores/ui';

async function refreshStates(): Promise<void> {
  const [launcher, content, settings] = await Promise.allSettled([
    strataApi.request<Record<string, unknown>>('launcher.state'),
    strataApi.request<Record<string, unknown>>('content.state'),
    strataApi.request<Record<string, unknown>>('instanceSettings.state'),
  ]);
  if (launcher.status === 'fulfilled') {
    useLauncherStore.getState().setState(launcher.value);
  }
  if (content.status === 'fulfilled') {
    useContentStore.getState().setState(content.value);
  }
  if (settings.status === 'fulfilled') {
    useInstanceSettingsStore.getState().setState(settings.value);
  }
}

// Subscribes the renderer to core push events and status changes for the
// lifetime of the component tree. On every transition into `connected`
// (initial connect or reconnect) the domain stores are refetched so they
// cannot drift from core state while the socket was down.
export function useCoreConnection(): void {
  const setStatus = useConnectionStore((state) => state.setStatus);
  const status = useConnectionStore((state) => state.status);

  useEffect(() => {
    const offEvents = onCoreEvent(routeIpcEvent);
    const offStatus = onCoreStatusChange(setStatus);
    void strataApi
      .getStatus()
      .then(setStatus)
      .catch(() => undefined);
    void useAppearanceStore.getState().hydrate();
    return () => {
      offEvents();
      offStatus();
    };
  }, [setStatus]);

  // Refreshes begin only after the window and startup animation are visible
  // (booted) and the core reports connected — covers initial connect and
  // reconnects alike.
  const booted = useUiStore((state) => state.booted);
  useEffect(() => {
    if (status.state === 'connected' && booted) {
      // Kick the core's full refresh (version manifest, instances, runtimes,
      // servers) — nothing populates those domains until this runs. Results
      // arrive as pushed *.changed events; the state fetches below cover the
      // initial paint.
      void strataApi.request('launcher.refresh').catch(() => undefined);
      void refreshStates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state, booted]);
}
