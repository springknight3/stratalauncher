import { describe, expect, it } from 'vitest';

import { parseContentSnapshot } from './content';

describe('parseContentSnapshot', () => {
  it('parses an empty snapshot with safe defaults', () => {
    const snapshot = parseContentSnapshot(null);
    expect(snapshot.projects).toEqual([]);
    expect(snapshot.versions).toEqual([]);
    expect(snapshot.installedContent).toEqual([]);
    expect(snapshot.worlds).toEqual([]);
    expect(snapshot.pageSize).toBe(20);
    expect(snapshot.dependencyConfirmationVisible).toBe(false);
  });

  it('parses projects, versions, installed content, and dependencies', () => {
    const snapshot = parseContentSnapshot({
      projects: [
        {
          id: 'p1',
          slug: 'sodium',
          title: 'Sodium',
          description: 'Rendering optimization',
          projectType: 'mod',
          downloads: 12345,
          iconUrl: 'https://example.com/icon.png',
          categories: ['optimization'],
        },
      ],
      versions: [
        {
          id: 'v1',
          projectId: 'p1',
          versionNumber: '0.6.13',
          projectType: 'mod',
          gameVersions: ['1.21.1'],
          loaders: ['fabric'],
          dependencies: [{ projectId: 'p2', versionId: 'v2', type: 'required' }],
        },
      ],
      installedContent: [
        {
          type: 'mod',
          projectId: 'p1',
          slug: 'sodium',
          title: 'Sodium',
          versionId: 'v1',
          versionNumber: '0.6.13',
          worldName: '',
          filename: 'sodium.jar',
          installedAt: '2025-01-01T00:00:00Z',
          enabled: true,
        },
      ],
      worlds: ['world-a'],
      statusMessage: 'Ready',
      selectedProjectId: 'p1',
      totalProjects: 1,
      pageOffset: 0,
      pageSize: 20,
      canGoBack: false,
      canGoForward: false,
      modsAvailable: true,
      loadingTarget: false,
      searching: false,
      loadingVersions: false,
      busy: false,
      installProgress: 0,
      installItem: '',
      dependenciesToInstall: [
        { title: 'Fabric API', versionNumber: '0.116.0', projectType: 'mod' },
      ],
      dependencyConfirmationVisible: true,
    });

    expect(snapshot.projects[0].title).toBe('Sodium');
    expect(snapshot.projects[0].downloads).toBe(12345);
    expect(snapshot.versions[0].dependencies[0].projectId).toBe('p2');
    expect(snapshot.installedContent[0].enabled).toBe(true);
    expect(snapshot.worlds).toEqual(['world-a']);
    expect(snapshot.selectedProjectId).toBe('p1');
    expect(snapshot.dependenciesToInstall[0].title).toBe('Fabric API');
    expect(snapshot.dependencyConfirmationVisible).toBe(true);
  });
});
