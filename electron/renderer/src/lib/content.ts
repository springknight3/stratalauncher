import { useContentStore } from '../stores/content';

// Typed view over the ContentController JSON snapshot (Modrinth browser).

export interface ContentProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  projectType: string;
  downloads: number;
  iconUrl: string;
  categories: string[];
}

export interface ContentVersionDependency {
  projectId: string;
  versionId: string;
  type: string;
}

export interface ContentVersion {
  id: string;
  projectId: string;
  versionNumber: string;
  projectType: string;
  gameVersions: string[];
  loaders: string[];
  dependencies: ContentVersionDependency[];
}

export interface InstalledContent {
  type: string;
  projectId: string;
  slug: string;
  title: string;
  versionId: string;
  versionNumber: string;
  worldName: string;
  filename: string;
  installedAt: string;
  enabled: boolean;
}

export interface PendingDependency {
  title: string;
  versionNumber: string;
  projectType: string;
}

export interface ContentSnapshot {
  projects: ContentProject[];
  versions: ContentVersion[];
  installedContent: InstalledContent[];
  worlds: string[];
  statusMessage: string;
  selectedProjectId: string;
  totalProjects: number;
  pageOffset: number;
  pageSize: number;
  canGoBack: boolean;
  canGoForward: boolean;
  modsAvailable: boolean;
  loadingTarget: boolean;
  searching: boolean;
  loadingVersions: boolean;
  busy: boolean;
  installProgress: number;
  installItem: string;
  dependenciesToInstall: PendingDependency[];
  dependencyConfirmationVisible: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export function parseContentSnapshot(
  raw: Record<string, unknown> | null,
): ContentSnapshot {
  const state = asRecord(raw);
  return {
    projects: asArray(state.projects).map((value) => {
      const record = asRecord(value);
      return {
        id: asString(record.id),
        slug: asString(record.slug),
        title: asString(record.title),
        description: asString(record.description),
        projectType: asString(record.projectType),
        downloads: asNumber(record.downloads),
        iconUrl: asString(record.iconUrl),
        categories: asArray(record.categories).map(asString),
      };
    }),
    versions: asArray(state.versions).map((value) => {
      const record = asRecord(value);
      return {
        id: asString(record.id),
        projectId: asString(record.projectId),
        versionNumber: asString(record.versionNumber),
        projectType: asString(record.projectType),
        gameVersions: asArray(record.gameVersions).map(asString),
        loaders: asArray(record.loaders).map(asString),
        dependencies: asArray(record.dependencies).map((dep) => {
          const depRecord = asRecord(dep);
          return {
            projectId: asString(depRecord.projectId),
            versionId: asString(depRecord.versionId),
            type: asString(depRecord.type),
          };
        }),
      };
    }),
    installedContent: asArray(state.installedContent).map((value) => {
      const record = asRecord(value);
      return {
        type: asString(record.type),
        projectId: asString(record.projectId),
        slug: asString(record.slug),
        title: asString(record.title),
        versionId: asString(record.versionId),
        versionNumber: asString(record.versionNumber),
        worldName: asString(record.worldName),
        filename: asString(record.filename),
        installedAt: asString(record.installedAt),
        enabled: asBool(record.enabled),
      };
    }),
    worlds: asArray(state.worlds).map(asString),
    statusMessage: asString(state.statusMessage),
    selectedProjectId: asString(state.selectedProjectId),
    totalProjects: asNumber(state.totalProjects),
    pageOffset: asNumber(state.pageOffset),
    pageSize: asNumber(state.pageSize) || 20,
    canGoBack: asBool(state.canGoBack),
    canGoForward: asBool(state.canGoForward),
    modsAvailable: asBool(state.modsAvailable),
    loadingTarget: asBool(state.loadingTarget),
    searching: asBool(state.searching),
    loadingVersions: asBool(state.loadingVersions),
    busy: asBool(state.busy),
    installProgress: asNumber(state.installProgress),
    installItem: asString(state.installItem),
    dependenciesToInstall: asArray(state.dependenciesToInstall).map((value) => {
      const record = asRecord(value);
      return {
        title: asString(record.title),
        versionNumber: asString(record.versionNumber),
        projectType: asString(record.projectType),
      };
    }),
    dependencyConfirmationVisible: asBool(state.dependencyConfirmationVisible),
  };
}

export function useContentSnapshot(): ContentSnapshot {
  const raw = useContentStore((state) => state.state);
  return parseContentSnapshot(raw);
}
