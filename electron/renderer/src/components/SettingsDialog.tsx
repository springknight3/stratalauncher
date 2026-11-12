import { useEffect, useState } from 'react';

import { Button } from '@/components/motion/button/base';
import { Checkbox } from '@/components/motion/checkbox';
import { Input } from '@/components/motion/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import Flyout from './Flyout';
import { SegmentedControl, ToggleRow } from './controls';
import { useAppearanceStore } from '../stores/appearance';
import { useUiStore } from '../stores/ui';
import { useLauncherSnapshot } from '../lib/launcher';
import { strataApi } from '../lib/strata';

const RUNTIME_VENDORS = [
  { id: 'MOJANG', label: 'Mojang' },
  { id: 'TEMURIN', label: 'Eclipse Temurin' },
  { id: 'ZULU', label: 'Azul Zulu' },
] as const;

const DATA_DIR_PRESETS = [
  { id: 'default', label: 'Default (~/.local/share/StrataLauncher)', path: null },
  { id: 'stratalauncher', label: '~/.stratalauncher', path: '~/.stratalauncher' },
  { id: 'minecraft', label: '~/.minecraft', path: '~/.minecraft' },
] as const;
type DataDirPreset = (typeof DATA_DIR_PRESETS)[number]['id'] | 'custom';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

function RuntimeDeleteDialog({
  open,
  vendor,
  version,
  users,
  inUse,
  onConfirm,
  onClose,
}: {
  open: boolean;
  vendor: string;
  version: string;
  users: string[];
  inUse: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');

  return (
    <Flyout
      open={open}
      onClose={onClose}
      label="Delete Java runtime"
      widthClass="max-w-[480px]"
      heightClass="h-auto"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-destructive">
            Delete Java runtime
          </h2>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <p className="text-sm text-foreground">
          {vendor} Java {version}
        </p>
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {users.length > 0
            ? `Currently used by:\n${users.join('\n')}`
            : 'No instances or servers currently use this runtime.'}
        </p>
        {inUse && (
          <p className="text-sm text-destructive">
            Stop using this runtime in every listed instance or server before
            deleting it.
          </p>
        )}
        {!inUse && (
          <Input
            value={confirmation}
            onChange={setConfirmation}
            placeholder="Type DELETE to confirm"
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={inUse || (!inUse && confirmation !== 'DELETE')}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete runtime
          </Button>
        </div>
      </div>
    </Flyout>
  );
}

// Launcher settings presented as an in-window flyout dialog (beUI
// CenterMorphModal via the shared Flyout shell). Rendered at layout level,
// outside the page-transition AnimatePresence, so the modal portal never
// participates in page exit/enter. Tabs mirror the QML Launcher Settings
// panel: General + Runtime Manager.
export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [tab, setTab] = useState<'general' | 'runtimes'>('general');
  const [javaFlags, setJavaFlags] = useState('');
  const [dataPreset, setDataPreset] = useState<DataDirPreset>('default');
  const [customDir, setCustomDir] = useState('');
  const [effectiveDir, setEffectiveDir] = useState('');
  const [dataDirApplying, setDataDirApplying] = useState(false);
  const [dataDirNotice, setDataDirNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{
    directory: string;
    vendor: string;
    version: string;
    users: string[];
    inUse: boolean;
  } | null>(null);

  const theme = useAppearanceStore((state) => state.theme);
  const reduceMotion = useAppearanceStore((state) => state.reduceMotion);
  const vsyncEnabled = useAppearanceStore((state) => state.vsyncEnabled);
  const frameTimeOverlayEnabled = useAppearanceStore(
    (state) => state.frameTimeOverlayEnabled,
  );
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const setReduceMotion = useAppearanceStore((state) => state.setReduceMotion);
  const setDiagnostics = useAppearanceStore((state) => state.setDiagnostics);

  const launcher = useLauncherSnapshot();

  // Populate the Java flags editor and data-directory state each time the
  // dialog opens.
  useEffect(() => {
    if (!open) {
      return;
    }
    setTab(useUiStore.getState().settingsTab);
    setJavaFlags(launcher.globalJavaArguments.join('\n'));
    setDataDirNotice('');
    void (async () => {
      const [configured, state] = await Promise.allSettled([
        strataApi.getDataDirectory(),
        strataApi.request<{ dataDirectory?: string }>('launcher.getState'),
      ]);
      if (state.status === 'fulfilled' && typeof state.value.dataDirectory === 'string') {
        setEffectiveDir(state.value.dataDirectory);
      }
      if (configured.status !== 'fulfilled') {
        return;
      }
      const path = configured.value.path;
      const preset = DATA_DIR_PRESETS.find((entry) => entry.path === path);
      if (path === null) {
        setDataPreset('default');
        setCustomDir('');
      } else if (preset !== undefined) {
        setDataPreset(preset.id);
        setCustomDir('');
      } else {
        setDataPreset('custom');
        setCustomDir(path);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const saveJavaFlags = () => {
    void strataApi
      .request('runtime.setGlobalJavaArguments', { flags: javaFlags })
      .catch(() => undefined);
  };

  const confirmRuntimeDelete = () => {
    if (deleteTarget === null) {
      return;
    }
    void strataApi
      .request('runtime.delete', { directory: deleteTarget.directory })
      .then(() => setDeleteTarget(null))
      .catch(() => undefined);
  };

  return (
    <>
      <Flyout
        open={open}
        onClose={onClose}
        label="Settings"
        widthClass="max-w-[640px]"
        heightClass="h-[min(640px,calc(100dvh-4rem))]"
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Settings
          </h2>
          <div className="flex-1" />
          <Button
            size="sm"
            variant={tab === 'general' ? 'secondary' : 'ghost'}
            onClick={() => setTab('general')}
          >
            General
          </Button>
          <Button
            size="sm"
            variant={tab === 'runtimes' ? 'secondary' : 'ghost'}
            onClick={() => setTab('runtimes')}
          >
            Runtime Manager
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {tab === 'general' ? (
          <div className="flex-1 space-y-6 overflow-y-auto p-5 text-foreground">
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Appearance
              </h3>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm">Theme</span>
                <SegmentedControl
                  ariaLabel="Theme"
                  value={theme}
                  options={[
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                  ]}
                  onChange={setTheme}
                />
              </div>
              <ToggleRow
                label="Reduce motion"
                description="Disables non-essential animations."
                checked={reduceMotion}
                onChange={setReduceMotion}
              />
            </section>
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Diagnostics
              </h3>
              <ToggleRow
                label="VSync"
                description="Sync rendering to the display refresh rate."
                checked={vsyncEnabled}
                onChange={(enabled) => setDiagnostics(enabled, frameTimeOverlayEnabled)}
              />
              <ToggleRow
                label="Frame time overlay"
                description="Debug overlay showing the current frame rate."
                checked={frameTimeOverlayEnabled}
                onChange={(enabled) => setDiagnostics(vsyncEnabled, enabled)}
              />
            </section>
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Launch
              </h3>
              <ToggleRow
                label="Track instance launches"
                description="Record recently launched instances on the home screen."
                checked={launcher.trackInstanceLaunches}
                onChange={(track) =>
                  void strataApi
                    .request('settings.setTrackInstanceLaunches', { track })
                    .catch(() => undefined)
                }
              />
            </section>
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Accounts
              </h3>
              <label className="mt-2 flex flex-col gap-1.5 text-sm">
                Azure client ID
                <Input
                  defaultValue={launcher.microsoftClientId}
                  placeholder="Azure application (client) ID"
                  onBlur={(event) => {
                    const value = event.target.value.trim();
                    if (value !== launcher.microsoftClientId) {
                      void strataApi
                        .request('accounts.setMicrosoftClientId', { clientId: value })
                        .catch(() => undefined);
                    }
                  }}
                />
              </label>
            </section>
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Java
              </h3>
              <label className="mt-2 flex flex-col gap-1.5 text-sm">
                Global Java launch flags
                <textarea
                  value={javaFlags}
                  onChange={(event) => setJavaFlags(event.target.value)}
                  rows={5}
                  placeholder={launcher.recommendedJavaArguments.join('\n')}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                These JVM arguments apply to instances without their own
                Java-flag override. Unsupported values can cause crashes or
                prevent Minecraft from starting; most players should leave the
                defaults unchanged.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={saveJavaFlags}>
                  Save Java flags
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setJavaFlags(launcher.recommendedJavaArguments.join('\n'))
                  }
                >
                  Use recommended
                </Button>
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Data
              </h3>
              <label className="mt-2 flex flex-col gap-1.5 text-sm">
                Launcher data directory
                <Select
                  value={dataPreset}
                  onValueChange={(value) => {
                    const preset = DATA_DIR_PRESETS.find((entry) => entry.id === value);
                    setDataPreset(value as DataDirPreset);
                    if (preset !== undefined) {
                      setCustomDir('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Data directory" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_DIR_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom…</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {dataPreset === 'custom' && (
                <Input
                  className="mt-2"
                  value={customDir}
                  onChange={setCustomDir}
                  placeholder="/absolute/path or ~/relative/path"
                />
              )}
              {effectiveDir.length > 0 && (
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  Current: {effectiveDir}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Instances, settings, servers, and runtimes live under this
                directory. Applying restarts the core and reloads all data.
              </p>
              {dataDirNotice.length > 0 && (
                <p className="mt-1 text-xs text-primary">{dataDirNotice}</p>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                disabled={dataDirApplying}
                onClick={() => {
                  const preset = DATA_DIR_PRESETS.find(
                    (entry) => entry.id === dataPreset,
                  );
                  const next =
                    dataPreset === 'custom' ? customDir.trim() : (preset?.path ?? null);
                  if (dataPreset === 'custom' && next !== null && next.length === 0) {
                    return;
                  }
                  setDataDirApplying(true);
                  void strataApi
                    .setDataDirectory(next)
                    .then(() => {
                      setDataDirNotice(
                        'Data directory updated — the core is restarting.',
                      );
                    })
                    .catch(() => {
                      setDataDirNotice('Could not update the data directory.');
                    })
                    .finally(() => setDataDirApplying(false));
                }}
              >
                {dataDirApplying ? 'Applying…' : 'Apply data directory'}
              </Button>
            </section>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-5 text-foreground">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void strataApi.request('runtime.refresh').catch(() => undefined)
                }
              >
                Refresh runtimes
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                Preferred Java runtime provider
                <Select
                  value={launcher.runtimeVendor}
                  onValueChange={(vendor) =>
                    void strataApi
                      .request('runtime.setPreferences', {
                        vendor,
                        redundant: launcher.redundantRuntimes,
                      })
                      .catch(() => undefined)
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {RUNTIME_VENDORS.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Checkbox
                checked={launcher.redundantRuntimes}
                onCheckedChange={(redundant) =>
                  void strataApi
                    .request('runtime.setPreferences', {
                      vendor: launcher.runtimeVendor,
                      redundant,
                    })
                    .catch(() => undefined)
                }
                label="Keep a separate copy for each instance or server"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Shared storage is the default. Changing this preference affects
              new installs; existing instances keep their saved Java component.
            </p>

            {launcher.installingRuntime && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm text-foreground">
                  Installing {launcher.runtimeVendor} Java…
                </p>
                {launcher.runtimeInstallationItem.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {launcher.runtimeInstallationItem}
                  </p>
                )}
                {launcher.runtimeInstallationProgress > 0 &&
                  launcher.runtimeInstallationProgress < 1 && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{
                          width: `${Math.round(launcher.runtimeInstallationProgress * 100)}%`,
                        }}
                      />
                    </div>
                  )}
              </div>
            )}

            <h3 className="font-display text-lg font-semibold text-foreground">
              Installed runtimes
            </h3>
            {launcher.installedRuntimes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Java runtimes installed yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {launcher.installedRuntimes.map((runtime) => (
                  <div
                    key={runtime.directory}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {runtime.vendor} Java {runtime.version}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {runtime.users.length > 0
                          ? `Used by: ${runtime.users.join(', ')}`
                          : 'Not currently used'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDeleteTarget({
                          directory: runtime.directory,
                          vendor: runtime.vendor,
                          version: runtime.version,
                          users: runtime.users,
                          inUse: runtime.inUse,
                        })
                      }
                    >
                      Review delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Flyout>

      <RuntimeDeleteDialog
        open={deleteTarget !== null}
        vendor={deleteTarget?.vendor ?? ''}
        version={deleteTarget?.version ?? ''}
        users={deleteTarget?.users ?? []}
        inUse={deleteTarget?.inUse ?? false}
        onConfirm={confirmRuntimeDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
