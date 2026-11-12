import { describe, expect, it } from 'vitest';

import { parseLauncherSnapshot } from './launcher';

describe('parseLauncherSnapshot', () => {
  it('returns empty defaults for null/garbage input', () => {
    const snapshot = parseLauncherSnapshot(null);
    expect(snapshot.instances).toEqual([]);
    expect(snapshot.installing).toBe(false);
    expect(snapshot.installationProgress).toBe(0);
    expect(snapshot.consoleText).toBe('');
  });

  it('narrows instance entries and drops id-less rows', () => {
    const snapshot = parseLauncherSnapshot({
      instances: [
        {
          id: 'abc',
          name: 'Test',
          version: '1.21.1',
          favorite: true,
          runtimeMode: 'MANAGED',
          runtimeComponent: 'java-21',
          status: 'ready',
        },
        { name: 'no id' },
        'junk',
      ],
      recentLaunchedInstances: [{ id: 'abc', name: 'Test' }],
      versions: [{ id: '1.21.1', type: 'release', label: '1.21.1' }],
      loaderVersions: ['0.16.0'],
      consoleText: 'line1\nline2',
      consoleInstanceName: 'Test',
      installationProgress: 0.42,
      currentInstallItem: 'client.jar',
    });

    expect(snapshot.instances).toHaveLength(1);
    expect(snapshot.instances[0]).toMatchObject({
      id: 'abc',
      name: 'Test',
      status: 'ready',
      favorite: true,
    });
    expect(snapshot.recentLaunchedInstances[0]?.id).toBe('abc');
    expect(snapshot.versions[0]?.label).toBe('1.21.1');
    expect(snapshot.loaderVersions).toEqual(['0.16.0']);
    expect(snapshot.consoleText).toBe('line1\nline2');
    expect(snapshot.installationProgress).toBe(0.42);
    expect(snapshot.currentInstallItem).toBe('client.jar');
  });

  it('defaults missing instance status to stopped', () => {
    const snapshot = parseLauncherSnapshot({
      instances: [{ id: 'x', name: 'X' }],
    });
    expect(snapshot.instances[0]?.status).toBe('stopped');
  });
});
