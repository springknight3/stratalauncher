import type {
  CoreStatus,
  JsonRpcEvent,
  LauncherState,
  PingResult,
  StrataApi,
  StrataEventHandler,
  VersionResult,
} from '../../../shared/ipc';

// Typed wrapper over the contextBridge-exposed `window.strata` API. Page JS
// never sees the socket, port, or token — only this request/event surface.
const strata: StrataApi = {
  request: <R,>(method: string, params?: unknown): Promise<R> =>
    window.strata.request<R>(method, params),
  onEvent: (handler: StrataEventHandler): (() => void) => window.strata.onEvent(handler),
  onStatusChange: (handler: (status: CoreStatus) => void): (() => void) =>
    window.strata.onStatusChange(handler),
  getStatus: (): Promise<CoreStatus> => window.strata.getStatus(),
  getDataDirectory: () => window.strata.getDataDirectory(),
  setDataDirectory: (path: string | null) => window.strata.setDataDirectory(path),
  getSystemMemoryMb: () => window.strata.getSystemMemoryMb(),
};

export const strataApi = strata;

export function ping(): Promise<PingResult> {
  return strata.request<PingResult>('ping');
}

export function getVersion(): Promise<VersionResult> {
  return strata.request<VersionResult>('version');
}

export function getLauncherState(): Promise<LauncherState> {
  return strata.request<LauncherState>('launcher.getState');
}

export function onCoreEvent(handler: (event: JsonRpcEvent) => void): () => void {
  return strata.onEvent(handler);
}

export function onCoreStatusChange(handler: (status: CoreStatus) => void): () => void {
  return strata.onStatusChange(handler);
}

export type { CoreStatus, JsonRpcEvent, LauncherState, PingResult, VersionResult };
