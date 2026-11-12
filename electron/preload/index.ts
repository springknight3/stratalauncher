import { contextBridge, ipcRenderer } from 'electron';

import type {
  CoreStatus,
  JsonRpcEvent,
  StrataApi,
  StrataStatusHandler,
} from '../shared/ipc';

const api: StrataApi = {
  request: <R,>(method: string, params?: unknown): Promise<R> =>
    ipcRenderer.invoke('strata:request', { method, params }) as Promise<R>,
  onEvent: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: JsonRpcEvent) =>
      handler(payload);
    ipcRenderer.on('strata:event', listener);
    return () => {
      ipcRenderer.removeListener('strata:event', listener);
    };
  },
  onStatusChange: (handler: StrataStatusHandler) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CoreStatus) => handler(payload);
    ipcRenderer.on('strata:status', listener);
    return () => {
      ipcRenderer.removeListener('strata:status', listener);
    };
  },
  getStatus: (): Promise<CoreStatus> => ipcRenderer.invoke('strata:status') as Promise<CoreStatus>,
  getDataDirectory: () =>
    ipcRenderer.invoke('strata:getDataDirectory') as Promise<{ path: string | null }>,
  setDataDirectory: (path: string | null) =>
    ipcRenderer.invoke('strata:setDataDirectory', { path }) as Promise<{ ok: boolean }>,
  getSystemMemoryMb: () =>
    ipcRenderer.invoke('strata:getSystemMemoryMb') as Promise<{ totalMb: number }>,
};

contextBridge.exposeInMainWorld('strata', api);
