import { useLauncherStore } from '../stores/launcher';

// Typed view over the launcher controller's JSON snapshot. The core publishes
// the full property map; these helpers extract and narrow the fields the UI
// needs, tolerating missing/partial snapshots.

export interface InstanceInfo {
  id: string;
  name: string;
  version: string;
  favorite: boolean;
  runtimeMode: string;
  runtimeComponent: string;
  status: string;
}

export interface VersionInfo {
  id: string;
  type: string;
  label: string;
}

export interface AccountInfo {
  accountId: string;
  name: string;
  type: string;
  active: boolean;
}

export interface RuntimeInfo {
  directory: string;
  component: string;
  vendor: string;
  version: string;
  users: string[];
  inUse: boolean;
}

export interface ServerInfo {
  id: string;
  name: string;
  version: string;
  distribution: string;
  installed: boolean;
  eulaAccepted: boolean;
  javaFlags: string[];
  viewDistance: number;
  onlineMode: boolean;
  useManagedJavaRuntime: boolean;
  javaRuntimeComponent: string;
  processState: string;
  running: boolean;
}

export interface ServerContentProject {
  id: string;
  title: string;
  description: string;
  downloads: number;
  iconUrl: string;
}

export interface ServerContentVersion {
  id: string;
  projectId: string;
  versionNumber: string;
}

export interface LauncherSnapshot {
  instances: InstanceInfo[];
  recentLaunchedInstances: Array<{ id: string; name: string }>;
  versions: VersionInfo[];
  loaderVersions: string[];
  loadingLoaderVersions: boolean;
  loaderVersionsError: string;
  installing: boolean;
  initializing: boolean;
  currentInstallName: string;
  installationProgress: number;
  currentInstallItem: string;
  installingRuntime: boolean;
  runtimeInstallationProgress: number;
  runtimeInstallationItem: string;
  deletingInstance: boolean;
  errorMessage: string;
  usingCachedManifest: boolean;
  latestRelease: string;
  consoleText: string;
  consoleInstanceName: string;
  accounts: AccountInfo[];
  activeAccountName: string;
  activeAccountId: string;
  offlineUsername: string;
  microsoftClientId: string;
  microsoftUserCode: string;
  microsoftVerificationUrl: string;
  microsoftAuthInProgress: boolean;
  trackInstanceLaunches: boolean;
  runtimeVendor: string;
  redundantRuntimes: boolean;
  recommendedJavaArguments: string[];
  globalJavaArguments: string[];
  installedRuntimes: RuntimeInfo[];
  servers: ServerInfo[];
  serverBusy: boolean;
  serverStatus: string;
  serverProperties: string;
  serverProgress: number;
  serverInstallItem: string;
  serverConsoleText: string;
  serverProcessState: string;
  serverResourceStatus: string;
  serverContentProjects: ServerContentProject[];
  serverContentVersions: ServerContentVersion[];
  serverContentStatus: string;
  serverContentBusy: boolean;
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

function parseInstance(value: unknown): InstanceInfo | null {
  const record = asRecord(value);
  const id = asString(record.id);
  if (id.length === 0) {
    return null;
  }
  return {
    id,
    name: asString(record.name),
    version: asString(record.version),
    favorite: asBool(record.favorite),
    runtimeMode: asString(record.runtimeMode),
    runtimeComponent: asString(record.runtimeComponent),
    status: asString(record.status) || 'stopped',
  };
}

function parseRuntime(value: unknown): RuntimeInfo | null {
  const record = asRecord(value);
  const directory = asString(record.directory);
  if (directory.length === 0) {
    return null;
  }
  return {
    directory,
    component: asString(record.component),
    vendor: asString(record.vendor),
    version: asString(record.version),
    users: asArray(record.users).map(asString),
    inUse: asBool(record.inUse),
  };
}

function parseServer(value: unknown): ServerInfo | null {
  const record = asRecord(value);
  const id = asString(record.id);
  if (id.length === 0) {
    return null;
  }
  return {
    id,
    name: asString(record.name),
    version: asString(record.version),
    distribution: asString(record.distribution),
    installed: asBool(record.installed),
    eulaAccepted: asBool(record.eulaAccepted),
    javaFlags: asArray(record.javaFlags).map(asString),
    viewDistance: asNumber(record.viewDistance) || 10,
    onlineMode: record.onlineMode !== false,
    useManagedJavaRuntime: record.useManagedJavaRuntime !== false,
    javaRuntimeComponent: asString(record.javaRuntimeComponent),
    processState: asString(record.processState),
    running: asBool(record.running),
  };
}

export function parseLauncherSnapshot(raw: Record<string, unknown> | null): LauncherSnapshot {
  const state = asRecord(raw);
  return {
    instances: asArray(state.instances)
      .map(parseInstance)
      .filter((instance): instance is InstanceInfo => instance !== null),
    recentLaunchedInstances: asArray(state.recentLaunchedInstances).map((value) => {
      const record = asRecord(value);
      return { id: asString(record.id), name: asString(record.name) };
    }),
    versions: asArray(state.versions).map((value) => {
      const record = asRecord(value);
      return {
        id: asString(record.id),
        type: asString(record.type),
        label: asString(record.label) || asString(record.id),
      };
    }),
    loaderVersions: asArray(state.loaderVersions).map(asString).filter((v) => v.length > 0),
    loadingLoaderVersions: asBool(state.loadingLoaderVersions),
    loaderVersionsError: asString(state.loaderVersionsError),
    installing: asBool(state.installing),
    initializing: asBool(state.initializing),
    currentInstallName: asString(state.currentInstallName),
    installationProgress: asNumber(state.installationProgress),
    currentInstallItem: asString(state.currentInstallItem),
    installingRuntime: asBool(state.installingRuntime),
    runtimeInstallationProgress: asNumber(state.runtimeInstallationProgress),
    runtimeInstallationItem: asString(state.runtimeInstallationItem),
    deletingInstance: asBool(state.deletingInstance),
    errorMessage: asString(state.errorMessage),
    usingCachedManifest: asBool(state.usingCachedManifest),
    latestRelease: asString(state.latestRelease),
    consoleText: asString(state.consoleText),
    consoleInstanceName: asString(state.consoleInstanceName),
    accounts: asArray(state.accounts).map((value) => {
      const record = asRecord(value);
      return {
        accountId: asString(record.accountId),
        name: asString(record.name),
        type: asString(record.type),
        active: asBool(record.active),
      };
    }),
    activeAccountName: asString(state.activeAccountName),
    activeAccountId: asString(state.activeAccountId),
    offlineUsername: asString(state.offlineUsername),
    microsoftClientId: asString(state.microsoftClientId),
    microsoftUserCode: asString(state.microsoftUserCode),
    microsoftVerificationUrl: asString(state.microsoftVerificationUrl),
    microsoftAuthInProgress: asBool(state.microsoftAuthInProgress),
    trackInstanceLaunches: asBool(state.trackInstanceLaunches),
    runtimeVendor: asString(state.runtimeVendor),
    redundantRuntimes: asBool(state.redundantRuntimes),
    recommendedJavaArguments: asArray(state.recommendedJavaArguments).map(asString),
    globalJavaArguments: asArray(state.globalJavaArguments).map(asString),
    installedRuntimes: asArray(state.installedRuntimes)
      .map(parseRuntime)
      .filter((runtime): runtime is RuntimeInfo => runtime !== null),
    servers: asArray(state.servers)
      .map(parseServer)
      .filter((server): server is ServerInfo => server !== null),
    serverBusy: asBool(state.serverBusy),
    serverStatus: asString(state.serverStatus),
    serverProperties: asString(state.serverProperties),
    serverProgress: asNumber(state.serverProgress),
    serverInstallItem: asString(state.serverInstallItem),
    serverConsoleText: asString(state.serverConsoleText),
    serverProcessState: asString(state.serverProcessState),
    serverResourceStatus: asString(state.serverResourceStatus),
    serverContentProjects: asArray(state.serverContentProjects).map((value) => {
      const record = asRecord(value);
      return {
        id: asString(record.id),
        title: asString(record.title),
        description: asString(record.description),
        downloads: asNumber(record.downloads),
        iconUrl: asString(record.iconUrl),
      };
    }),
    serverContentVersions: asArray(state.serverContentVersions).map((value) => {
      const record = asRecord(value);
      return {
        id: asString(record.id),
        projectId: asString(record.projectId),
        versionNumber: asString(record.versionNumber),
      };
    }),
    serverContentStatus: asString(state.serverContentStatus),
    serverContentBusy: asBool(state.serverContentBusy),
  };
}

export function useLauncherSnapshot(): LauncherSnapshot {
  const raw = useLauncherStore((state) => state.state);
  return parseLauncherSnapshot(raw);
}
