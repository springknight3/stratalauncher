import { describe, expect, it, beforeEach } from 'vitest';

import { routeIpcEvent } from '../lib/ipcEvents';
import { useConnectionStore } from '../stores/connection';
import { useContentStore } from '../stores/content';
import { useInstanceSettingsStore } from '../stores/instanceSettings';
import { useLauncherStore } from '../stores/launcher';

// Store updates driven by mocked core events (no Electron required).
describe('ipc event routing', () => {
  beforeEach(() => {
    useLauncherStore.setState({ state: null });
    useContentStore.setState({ state: null });
    useInstanceSettingsStore.setState({ state: null });
    useConnectionStore.setState({ status: { state: 'starting' } });
  });

  it('routes launcher events into the launcher store', () => {
    routeIpcEvent({
      jsonrpc: '2.0',
      method: 'instances.changed',
      params: { state: { instances: [{ id: 'a' }], installing: false } },
    });
    expect(useLauncherStore.getState().state).toEqual({
      instances: [{ id: 'a' }],
      installing: false,
    });
    expect(useContentStore.getState().state).toBeNull();
  });

  it('routes process.state.changed via the snapshot param', () => {
    routeIpcEvent({
      jsonrpc: '2.0',
      method: 'process.state.changed',
      params: { instanceId: 'a', state: 'running', snapshot: { instances: [] } },
    });
    expect(useLauncherStore.getState().state).toEqual({ instances: [] });
  });

  it('routes content.changed into the content store only', () => {
    routeIpcEvent({
      jsonrpc: '2.0',
      method: 'content.changed',
      params: { state: { projects: [{ id: 'p1' }] } },
    });
    expect(useContentStore.getState().state).toEqual({ projects: [{ id: 'p1' }] });
    expect(useLauncherStore.getState().state).toBeNull();
  });

  it('routes instanceSettings.changed into the settings store', () => {
    routeIpcEvent({
      jsonrpc: '2.0',
      method: 'instanceSettings.changed',
      params: { state: { instanceName: 'test', busy: false } },
    });
    expect(useInstanceSettingsStore.getState().state).toEqual({
      instanceName: 'test',
      busy: false,
    });
  });

  it('ignores events without a state payload', () => {
    routeIpcEvent({ jsonrpc: '2.0', method: 'install.finished', params: { success: true } });
    expect(useLauncherStore.getState().state).toBeNull();
  });
});
