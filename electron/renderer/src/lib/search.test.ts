import { describe, expect, it } from 'vitest';

import {
  buildDynamicSearchDocuments,
  searchDocuments,
  updateSearchIndex,
  type SearchDocument,
} from './search';
import { parseContentSnapshot } from './content';
import { parseLauncherSnapshot } from './launcher';

const emptyActions = {
  openInstance: () => undefined,
  openServer: () => undefined,
  openContent: () => undefined,
  openCreateInstance: () => undefined,
  openSettings: () => undefined,
  openAccounts: () => undefined,
};

describe('searchDocuments', () => {
  it('returns an empty list for blank queries', () => {
    expect(searchDocuments('   ')).toEqual([]);
  });

  it('finds documents by label and keywords', () => {
    const docs: SearchDocument[] = [
      {
        id: 'instance:1',
        kind: 'instance',
        label: 'Skyblock',
        keywords: 'instance 1.20.1 fabric',
        group: 'Instances',
        icon: 'sports_esports',
        run: () => undefined,
      },
      {
        id: 'server:1',
        kind: 'server',
        label: 'Creative Lab',
        keywords: 'server paper',
        group: 'Servers',
        icon: 'dns',
        run: () => undefined,
      },
    ];
    updateSearchIndex(docs);

    const skyblock = searchDocuments('skyblock');
    expect(skyblock.map((doc) => doc.id)).toContain('instance:1');

    const fabric = searchDocuments('fabric');
    expect(fabric.map((doc) => doc.id)).toContain('instance:1');

    const paper = searchDocuments('paper');
    expect(paper.map((doc) => doc.id)).toContain('server:1');
  });
});

describe('buildDynamicSearchDocuments', () => {
  it('emits docs for instances, servers, versions, runtimes, content, and accounts', () => {
    const launcher = parseLauncherSnapshot({
      instances: [{ id: 'i1', name: 'Test', version: '1.20.1' }],
      servers: [{ id: 's1', name: 'Srv', version: '1.20.1', distribution: 'PAPER' }],
      versions: [
        { id: '1.20.1', type: 'release', label: '1.20.1' },
        { id: '23w51b', type: 'snapshot', label: '23w51b' },
      ],
      installedRuntimes: [
        { directory: '/r1', component: 'java-runtime-delta', vendor: 'mojang', version: '21' },
      ],
      accounts: [{ accountId: 'a1', name: 'Player', type: 'microsoft' }],
    });
    const content = parseContentSnapshot({
      projects: [{ id: 'p1', slug: 'sodium', title: 'Sodium', projectType: 'mod' }],
      installedContent: [
        { type: 'mod', projectId: 'p1', slug: 'sodium', title: 'Sodium', versionNumber: '0.5' },
      ],
    });

    const docs = buildDynamicSearchDocuments(launcher, content, emptyActions);
    const ids = docs.map((doc) => doc.id);
    expect(ids).toContain('instance:i1');
    expect(ids).toContain('server:s1');
    expect(ids).toContain('version:1.20.1');
    expect(ids).toContain('version:23w51b');
    expect(ids).toContain('runtime:/r1');
    expect(ids).toContain('content:p1');
    expect(ids).toContain('installed:mod:p1:');
    expect(ids).toContain('account:a1');

    // Every doc carries a runnable action and a display group.
    for (const doc of docs) {
      expect(doc.group.length).toBeGreaterThan(0);
      expect(typeof doc.run).toBe('function');
    }
  });
});
