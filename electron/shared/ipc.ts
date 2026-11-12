// Shared types for the JSON-RPC 2.0 IPC contract between the Electron main
// process and the C++ core (see AGENTS.md "IPC contract").

export type JsonRpcId = number | string | null;

export interface JsonRpcRequest<P = unknown> {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: P;
}

export interface JsonRpcResponse<R = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: R;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcEvent<P = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: P;
}

export interface PingResult {
  pong: boolean;
  version: string;
  time: number;
}

export interface VersionResult {
  name: string;
  version: string;
}

export interface LauncherState {
  name: string;
  version: string;
  dataDirectory: string;
}

export type StrataEventHandler = (event: JsonRpcEvent) => void;
export type StrataStatusHandler = (status: CoreStatus) => void;

// The only surface page JS may use. Implemented in preload/ via contextBridge;
// the raw socket, port, and token never cross into the renderer.
export interface StrataApi {
  request<R = unknown>(method: string, params?: unknown): Promise<R>;
  onEvent(handler: StrataEventHandler): () => void;
  onStatusChange(handler: StrataStatusHandler): () => void;
  getStatus(): Promise<CoreStatus>;
  /** Configured launcher data directory override (absolute path), or null for the platform default. */
  getDataDirectory(): Promise<{ path: string | null }>;
  /** Sets (or clears with null) the data directory and restarts strata-core. */
  setDataDirectory(path: string | null): Promise<{ ok: boolean }>;
  /** Total physical RAM in MiB, for memory-allocation UI bounds. */
  getSystemMemoryMb(): Promise<{ totalMb: number }>;
}

export type CoreStatus =
  | { state: 'starting' }
  | { state: 'connected'; version: string }
  | { state: 'error'; message: string };

declare global {
  interface Window {
    strata: StrataApi;
  }
}
