import { describe, expect, it } from 'vitest';

import { parseInstanceSettingsSnapshot } from './instanceSettings';

describe('parseInstanceSettingsSnapshot', () => {
  it('returns defaults for null input', () => {
    const snapshot = parseInstanceSettingsSnapshot(null);
    expect(snapshot.busy).toBe(false);
    expect(snapshot.instanceName).toBe('');
    expect(snapshot.commonOptions.fov).toBe(70);
    expect(snapshot.commonOptions.enableVsync).toBe(true);
    expect(snapshot.controls).toEqual([]);
    expect(snapshot.servers).toEqual([]);
  });

  it('parses options, controls, servers, and java flags', () => {
    const snapshot = parseInstanceSettingsSnapshot({
      busy: true,
      status: 'Saving controls…',
      instanceName: 'Test',
      instanceVersion: '1.21.1',
      commonOptions: {
        fov: '90',
        gamma: 0.5,
        renderDistance: '16',
        simulationDistance: 8,
        maxFps: 260,
        unlimitedFps: true,
        guiScale: 2,
        fullscreen: true,
        enableVsync: false,
      },
      controls: [
        {
          key: 'key_forward',
          name: 'Forward',
          value: 'key.keyboard.w',
          display: 'W',
        },
      ],
      servers: [{ name: 'Hypixel', address: 'mc.hypixel.net' }],
      javaFlags: '-Xmx4G\n-XX:+UseG1GC',
      javaFlagsOverridden: true,
    });

    expect(snapshot.busy).toBe(true);
    expect(snapshot.commonOptions.fov).toBe(90);
    expect(snapshot.commonOptions.renderDistance).toBe(16);
    expect(snapshot.commonOptions.unlimitedFps).toBe(true);
    expect(snapshot.commonOptions.fullscreen).toBe(true);
    expect(snapshot.commonOptions.enableVsync).toBe(false);
    expect(snapshot.controls[0]).toMatchObject({
      key: 'key_forward',
      name: 'Forward',
      value: 'key.keyboard.w',
      display: 'W',
    });
    expect(snapshot.servers[0]?.address).toBe('mc.hypixel.net');
    expect(snapshot.javaFlagsOverridden).toBe(true);
  });
});
