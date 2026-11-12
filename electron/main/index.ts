import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { totalmem } from 'node:os';

import { app, BrowserWindow, ipcMain, shell } from 'electron';

import type {
  CoreStatus,
  JsonRpcEvent,
  JsonRpcRequest,
  JsonRpcResponse,
} from '../shared/ipc';

const READY_PREFIX = 'STRATA_READY ';
const REQUEST_TIMEOUT_MS = 30_000;

let coreProcess: ChildProcess | null = null;
let socket: WebSocket | null = null;
let nextId = 1;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
    socket: WebSocket;
  }
>();
let status: CoreStatus = { state: 'starting' };
let statusWaiters: Array<{
  predicate: (status: CoreStatus) => boolean;
  resolve: (status: CoreStatus) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}> = [];

function setStatus(next: CoreStatus): void {
  status = next;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('strata:status', next);
  }
  const waiters = statusWaiters;
  statusWaiters = waiters.filter((waiter) => {
    if (!waiter.predicate(next)) {
      return true;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(next);
    return false;
  });
}

function resolveCorePath(): string | null {
  if (process.env.STRATA_CORE_PATH && existsSync(process.env.STRATA_CORE_PATH)) {
    return process.env.STRATA_CORE_PATH;
  }
  // Packaged builds: electron-builder places the self-contained core bundle
  // (wrapper + binary + libs + Qt plugins) under resources/strata-core.
  if (app.isPackaged) {
    const bundledDir = path.join(process.resourcesPath, 'strata-core');
    const bundled =
      process.platform === 'win32'
        ? path.join(bundledDir, 'strata-core.exe')
        : path.join(bundledDir, 'strata-core');
    if (existsSync(bundled)) {
      return bundled;
    }
    return null;
  }
  // electron/out/main -> electron/out -> electron -> repo root
  const root = path.resolve(__dirname, '..', '..', '..');
  const candidates = [
    path.join(root, 'build', 'qt-debug', 'cpp', 'app', 'strata-core'),
    path.join(root, 'build', 'qt-debug', 'app', 'strata-core'),
    path.join(root, 'build', 'qt-release', 'cpp', 'app', 'strata-core'),
    path.join(root, 'build', 'qt-release', 'app', 'strata-core'),
    path.join(root, 'build', 'qt-offscreen', 'cpp', 'app', 'strata-core'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function sendRequest(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected to strata-core'));
      return;
    }
    const id = nextId++;
    const owner = socket;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`IPC request timed out: ${method}`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer, socket: owner });
    const message: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    socket.send(JSON.stringify(message));
  });
}

function broadcastEvent(event: JsonRpcEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('strata:event', event);
  }
}

function handleSocketMessage(raw: string): void {
  let message: JsonRpcResponse & Partial<JsonRpcEvent>;
  try {
    message = JSON.parse(raw) as JsonRpcResponse & Partial<JsonRpcEvent>;
  } catch {
    return;
  }
  if (typeof message.id === 'number' && pending.has(message.id)) {
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (entry === undefined) {
      return;
    }
    clearTimeout(entry.timer);
    if (message.error !== undefined) {
      entry.reject(new Error(`${message.error.code}: ${message.error.message}`));
    } else {
      entry.resolve(message.result);
    }
    return;
  }
  if (typeof message.method === 'string') {
    broadcastEvent(message as JsonRpcEvent);
  }
}

function waitForStatus(
  predicate: (status: CoreStatus) => boolean,
  timeoutMs: number,
): Promise<CoreStatus> {
  if (predicate(status)) {
    return Promise.resolve(status);
  }
  return new Promise((resolve, reject) => {
    const waiter = {
      predicate,
      resolve,
      reject,
      timer: setTimeout(() => {
        statusWaiters = statusWaiters.filter((candidate) => candidate !== waiter);
        reject(new Error('Timed out waiting for strata-core'));
      }, timeoutMs),
    };
    statusWaiters.push(waiter);
  });
}

async function authenticateAndReady(port: number, token: string): Promise<void> {
  const url = `ws://127.0.0.1:${port}`;
  const connection = new WebSocket(url);
  socket = connection;
  connection.addEventListener('message', (event) => handleSocketMessage(String(event.data)));
  connection.addEventListener('close', () => {
    // Reject only requests that belonged to this socket — a respawned core
    // may already own a newer socket and its pending entries.
    for (const [id, entry] of pending) {
      if (entry.socket !== connection) {
        continue;
      }
      clearTimeout(entry.timer);
      entry.reject(new Error('strata-core connection closed'));
      pending.delete(id);
    }
    if (status.state === 'connected') {
      setStatus({ state: 'error', message: 'strata-core connection closed' });
    }
    if (socket === connection) {
      socket = null;
    }
  });

  await new Promise<void>((resolve, reject) => {
    connection.addEventListener('open', () => resolve(), { once: true });
    connection.addEventListener('error', () => reject(new Error('WebSocket connection failed')), {
      once: true,
    });
  });

  const auth = (await sendRequest('ipc.authenticate', { token })) as { authenticated?: boolean };
  if (auth.authenticated !== true) {
    throw new Error('strata-core rejected the session token');
  }

  const ping = (await sendRequest('ping')) as { version?: string };
  setStatus({ state: 'connected', version: ping.version ?? 'unknown' });
}

// ---- Launcher data directory ---------------------------------------------
// Persisted client-side (the core derives every store path from it at
// startup, so changing it requires a core respawn).

function clientConfigPath(): string {
  return path.join(app.getPath('userData'), 'strata-client.json');
}

function loadConfiguredDataDir(): string | null {
  try {
    const raw = readFileSync(clientConfigPath(), 'utf8');
    const parsed = JSON.parse(raw) as { dataDirectory?: unknown };
    return typeof parsed.dataDirectory === 'string' && parsed.dataDirectory.length > 0
      ? parsed.dataDirectory
      : null;
  } catch {
    return null;
  }
}

let configuredDataDir: string | null = null;

function persistDataDir(dir: string | null): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(
      clientConfigPath(),
      JSON.stringify({ dataDirectory: dir }),
      'utf8',
    );
  } catch {
    // Persistence failure still applies for this session.
  }
}

function restartCore(): void {
  socket?.close();
  socket = null;
  if (coreProcess !== null) {
    coreProcess.kill();
    coreProcess = null;
  }
  setStatus({ state: 'starting' });
  startCore();
}

function startCore(): void {
  const corePath = resolveCorePath();
  if (corePath === null) {
    setStatus({
      state: 'error',
      message: 'strata-core binary not found (build with: cmake --preset debug && cmake --build --preset debug)',
    });
    return;
  }

  // No --token: the core generates a CSPRNG token and returns it in the
  // STRATA_READY handshake. Passing it via argv would expose it through
  // /proc/<pid>/cmdline to any same-UID local process.
  const args = ['serve', '--port', '0'];
  if (configuredDataDir !== null) {
    args.push('--data-dir', configuredDataDir);
  }
  coreProcess = spawn(corePath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  coreProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[strata-core] ${chunk.toString()}`);
  });

  let buffer = '';
  coreProcess.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (!line.startsWith(READY_PREFIX)) {
        continue;
      }
      try {
        const ready = JSON.parse(line.slice(READY_PREFIX.length)) as {
          port: number;
          token: string;
        };
        authenticateAndReady(ready.port, ready.token).catch((error: unknown) => {
          setStatus({
            state: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        });
      } catch {
        setStatus({ state: 'error', message: 'Malformed STRATA_READY line from strata-core' });
      }
    }
  });

  coreProcess.on('exit', (code) => {
    coreProcess = null;
    if (status.state === 'connected' || status.state === 'starting') {
      setStatus({ state: 'error', message: `strata-core exited with code ${code ?? 'unknown'}` });
    }
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'StrataLauncher',
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl !== undefined && devUrl !== '') {
    void window.loadURL(devUrl);
  } else {
    void window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  configuredDataDir = loadConfiguredDataDir();

  ipcMain.handle('strata:getDataDirectory', () => ({
    // Raw configured value ('~/…' or absolute); null = platform default.
    path: configuredDataDir,
  }));
  ipcMain.handle('strata:getSystemMemoryMb', () => ({
    totalMb: Math.floor(totalmem() / (1024 * 1024)),
  }));
  ipcMain.handle(
    'strata:setDataDirectory',
    (_event, payload: { path?: unknown }) => {
      const raw = payload?.path;
      if (raw !== null && typeof raw !== 'string') {
        throw new Error('strata:setDataDirectory requires a string or null');
      }
      let next: string | null = null;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        const value = raw.trim();
        const looksAbsolute =
          value === '~' ||
          value.startsWith('~/') ||
          value.startsWith('~\\') ||
          value.startsWith('/') ||
          /^[A-Za-z]:[\\/]/.test(value);
        if (!looksAbsolute) {
          throw new Error('Data directory must be an absolute path or start with ~');
        }
        next = value;
      }
      configuredDataDir = next;
      persistDataDir(next);
      restartCore();
      return { ok: true };
    },
  );

  ipcMain.handle('strata:request', async (_event, payload: { method: string; params?: unknown }) => {
    // Renderer-side conveniences that never reach the core.
    if (payload.method === 'shell.openExternal') {
      const url = (payload.params as { url?: unknown } | undefined)?.url;
      if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        await shell.openExternal(url);
        return { ok: true };
      }
      throw new Error('shell.openExternal requires an http(s) URL');
    }
    // Ensure the core is up before proxying; requests made during startup wait
    // for the connected state (bounded by the request timeout above).
    if (status.state !== 'connected') {
      const waited = await waitForStatus(
        (s) => s.state === 'connected' || s.state === 'error',
        35_000,
      );
      if (waited.state !== 'connected') {
        throw new Error(waited.state === 'error' ? waited.message : 'strata-core not ready');
      }
    }
    return sendRequest(payload.method, payload.params);
  });
  ipcMain.handle('strata:status', () => status);

  startCore();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (coreProcess !== null) {
    coreProcess.kill();
    coreProcess = null;
  }
});
