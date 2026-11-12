import MiniSearch from 'minisearch';

import type { LauncherSnapshot } from './launcher';
import type { ContentSnapshot } from './content';

// Unified client-side search index (MiniSearch) over every launcher domain:
// static commands/settings keys plus live instances, servers, Minecraft
// versions, Java runtimes, and Modrinth content projects. The index is
// rebuilt on a debounce whenever the underlying snapshots change.

export interface SearchDocument {
  id: string;
  kind:
    | 'command'
    | 'instance'
    | 'server'
    | 'version'
    | 'runtime'
    | 'content'
    | 'setting'
    | 'account';
  label: string;
  keywords: string;
  group: string;
  icon: string;
  hint?: string;
  run: () => void;
}

export interface SearchGroup {
  name: string;
  items: SearchDocument[];
}

const MAX_RESULTS = 24;
const REINDEX_DEBOUNCE_MS = 200;

let index: MiniSearch<SearchDocument> | null = null;
let indexedDocs: SearchDocument[] = [];
let pendingDocs: SearchDocument[] | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

function buildIndex(docs: SearchDocument[]): MiniSearch<SearchDocument> {
  const next = new MiniSearch<SearchDocument>({
    fields: ['label', 'keywords', 'group'],
    storeFields: ['id', 'kind', 'label', 'keywords', 'group', 'icon', 'hint'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { label: 3, group: 0.5 },
    },
  });
  next.addAll(docs);
  return next;
}

function rebuildIndex() {
  rebuildTimer = null;
  if (pendingDocs === null) {
    return;
  }
  indexedDocs = pendingDocs;
  pendingDocs = null;
  index = buildIndex(indexedDocs);
}

// Called by the command palette mount whenever snapshots change. Rebuilds are
// debounced so rapid *.changed event bursts coalesce into one index build.
export function updateSearchIndex(docs: SearchDocument[]) {
  pendingDocs = docs;
  if (rebuildTimer !== null) {
    clearTimeout(rebuildTimer);
  }
  rebuildTimer = setTimeout(rebuildIndex, REINDEX_DEBOUNCE_MS);
}

export function searchDocuments(query: string, limit = MAX_RESULTS): SearchDocument[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }
  if (index === null || pendingDocs !== null) {
    // First query (or a pending debounced rebuild): index synchronously so
    // results are never stale relative to what the user sees.
    if (rebuildTimer !== null) {
      clearTimeout(rebuildTimer);
      rebuildTimer = null;
    }
    if (pendingDocs !== null) {
      indexedDocs = pendingDocs;
      pendingDocs = null;
    }
    index = buildIndex(indexedDocs);
  }
  return index
    .search(trimmed)
    .slice(0, limit)
    .map((result) => indexedDocs.find((doc) => doc.id === result.id))
    .filter((doc): doc is SearchDocument => doc !== undefined);
}

// Static command/settings documents are built by the caller (they need
// navigation and store closures); this helper appends the live-data docs.
export function buildDynamicSearchDocuments(
  launcher: LauncherSnapshot,
  content: ContentSnapshot,
  actions: {
    openInstance: (id: string) => void;
    openServer: (id: string) => void;
    openContent: () => void;
    openCreateInstance: () => void;
    openSettings: () => void;
    openAccounts: () => void;
  },
): SearchDocument[] {
  const docs: SearchDocument[] = [];

  for (const instance of launcher.instances) {
    docs.push({
      id: `instance:${instance.id}`,
      kind: 'instance',
      label: instance.name,
      keywords: `instance ${instance.version} ${instance.status} ${instance.favorite ? 'favorite' : ''}`,
      group: 'Instances',
      icon: 'sports_esports',
      hint: instance.version,
      run: () => actions.openInstance(instance.id),
    });
  }

  for (const server of launcher.servers) {
    docs.push({
      id: `server:${server.id}`,
      kind: 'server',
      label: server.name,
      keywords: `server ${server.version} ${server.distribution} ${server.running ? 'running' : 'stopped'}`,
      group: 'Servers',
      icon: 'dns',
      hint: server.distribution,
      run: () => actions.openServer(server.id),
    });
  }

  // Cap versions — the manifest can hold ~1000 entries and they are rarely
  // what the user searches for; keep releases + a few latest per type.
  const versions = launcher.versions;
  const perType = new Map<string, number>();
  for (const version of versions) {
    const seen = perType.get(version.type) ?? 0;
    if (seen >= 40) {
      continue;
    }
    perType.set(version.type, seen + 1);
    docs.push({
      id: `version:${version.id}`,
      kind: 'version',
      label: version.label || version.id,
      keywords: `minecraft version ${version.type} ${version.id}`,
      group: 'Versions',
      icon: 'deployed_code',
      hint: version.type,
      run: actions.openCreateInstance,
    });
  }

  for (const runtime of launcher.installedRuntimes) {
    docs.push({
      id: `runtime:${runtime.directory}`,
      kind: 'runtime',
      label: `${runtime.vendor} ${runtime.version}`.trim(),
      keywords: `java runtime ${runtime.component} ${runtime.vendor} ${runtime.version} ${runtime.inUse ? 'in use' : ''}`,
      group: 'Runtimes',
      icon: 'memory',
      hint: runtime.vendor,
      run: actions.openSettings,
    });
  }

  for (const project of content.projects) {
    docs.push({
      id: `content:${project.id}`,
      kind: 'content',
      label: project.title,
      keywords: `mod content ${project.projectType} ${project.categories.join(' ')} ${project.description}`,
      group: 'Content',
      icon: 'package_2',
      hint: project.projectType,
      run: actions.openContent,
    });
  }
  for (const item of content.installedContent) {
    docs.push({
      id: `installed:${item.type}:${item.projectId}:${item.worldName}`,
      kind: 'content',
      label: item.title,
      keywords: `installed ${item.type} ${item.versionNumber} ${item.worldName} ${item.enabled ? 'enabled' : 'disabled'}`,
      group: 'Installed content',
      icon: 'inventory_2',
      hint: item.enabled ? 'enabled' : 'disabled',
      run: actions.openContent,
    });
  }

  for (const account of launcher.accounts) {
    docs.push({
      id: `account:${account.accountId}`,
      kind: 'account',
      label: account.name,
      keywords: `account ${account.type} ${account.active ? 'active' : ''}`,
      group: 'Accounts',
      icon: 'person',
      hint: account.type,
      run: actions.openAccounts,
    });
  }

  return docs;
}
