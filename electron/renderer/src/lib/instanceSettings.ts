import { useInstanceSettingsStore } from '../stores/instanceSettings';

// Typed view over the InstanceSettingsController snapshot
// (instanceSettings.state / instanceSettings.changed events).

export interface CommonOptions {
  fov: number;
  gamma: number;
  renderDistance: number;
  simulationDistance: number;
  maxFps: number;
  unlimitedFps: boolean;
  guiScale: number;
  fullscreen: boolean;
  enableVsync: boolean;
}

export interface ControlBinding {
  key: string;
  name: string;
  value: string;
  display: string;
}

export interface InstanceServer {
  name: string;
  address: string;
}

export interface InstanceSettingsSnapshot {
  busy: boolean;
  status: string;
  instanceName: string;
  instanceVersion: string;
  commonOptions: CommonOptions;
  controls: ControlBinding[];
  servers: InstanceServer[];
  javaFlags: string;
  javaFlagsOverridden: boolean;
}

const DEFAULT_OPTIONS: CommonOptions = {
  fov: 70,
  gamma: 0,
  renderDistance: 12,
  simulationDistance: 12,
  maxFps: 120,
  unlimitedFps: false,
  guiScale: 0,
  fullscreen: false,
  enableVsync: true,
};

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

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function parseInstanceSettingsSnapshot(
  raw: Record<string, unknown> | null,
): InstanceSettingsSnapshot {
  const state = asRecord(raw);
  const options = { ...DEFAULT_OPTIONS, ...asRecord(state.commonOptions) };
  return {
    busy: asBool(state.busy),
    status: asString(state.status),
    instanceName: asString(state.instanceName),
    instanceVersion: asString(state.instanceVersion),
    commonOptions: {
      fov: asNumber(options.fov, DEFAULT_OPTIONS.fov),
      gamma: asNumber(options.gamma, DEFAULT_OPTIONS.gamma),
      renderDistance: asNumber(options.renderDistance, DEFAULT_OPTIONS.renderDistance),
      simulationDistance: asNumber(
        options.simulationDistance,
        DEFAULT_OPTIONS.simulationDistance,
      ),
      maxFps: asNumber(options.maxFps, DEFAULT_OPTIONS.maxFps),
      unlimitedFps: asBool(options.unlimitedFps),
      guiScale: asNumber(options.guiScale, DEFAULT_OPTIONS.guiScale),
      fullscreen: asBool(options.fullscreen),
      // Core defaults enableVsync to true unless options.txt says otherwise.
      enableVsync:
        options.enableVsync === undefined ? true : asBool(options.enableVsync),
    },
    controls: asArray(state.controls).map((value) => {
      const record = asRecord(value);
      return {
        key: asString(record.key),
        name: asString(record.name),
        value: asString(record.value),
        display: asString(record.display),
      };
    }),
    servers: asArray(state.servers).map((value) => {
      const record = asRecord(value);
      return { name: asString(record.name), address: asString(record.address) };
    }),
    javaFlags: asString(state.javaFlags),
    javaFlagsOverridden: asBool(state.javaFlagsOverridden),
  };
}

export function useInstanceSettingsSnapshot(): InstanceSettingsSnapshot {
  const raw = useInstanceSettingsStore((state) => state.state);
  return parseInstanceSettingsSnapshot(raw);
}
