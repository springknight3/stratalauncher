import { useEffect, useRef, useState } from 'react';

import { ActionSwapBlurButton } from '@/components/motion/action-swap-blur';
import {
  AdaptiveStepper,
  AdaptiveStepperDecrement,
  AdaptiveStepperIncrement,
  AdaptiveStepperValue,
} from '@/components/motion/adaptive-stepper';
import { Button } from '@/components/motion/button/base';
import { Checkbox } from '@/components/motion/checkbox';
import { Input } from '@/components/motion/input';
import { RangeSlider } from '@/components/motion/range-slider';
import { Switch } from '@/components/motion/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/motion/tabs';
import Flyout from './Flyout';
import { useLauncherSnapshot } from '../lib/launcher';
import {
  useInstanceSettingsSnapshot,
  type CommonOptions,
} from '../lib/instanceSettings';
import { toast } from '../lib/toast';
import { strataApi } from '../lib/strata';

interface InstanceSettingsFlyoutProps {
  open: boolean;
  instanceId: string | null;
  onClose: () => void;
}

// Parity with the QML settingsFlyout: Game options / Controls / Servers /
// Java / Dangerous tabs editing the selected instance via instanceSettings.* IPC.
export default function InstanceSettingsFlyout({
  open,
  instanceId,
  onClose,
}: InstanceSettingsFlyoutProps) {
  const settings = useInstanceSettingsSnapshot();
  const launcher = useLauncherSnapshot();
  const dirtyRef = useRef(false);

  // Load the instance's settings whenever the flyout opens for an instance.
  useEffect(() => {
    if (open && instanceId !== null) {
      void strataApi
        .request('instanceSettings.load', { instanceId })
        .catch(() => undefined);
    }
  }, [open, instanceId]);

  const handleClose = () => {
    if (dirtyRef.current) {
      toast({
        title: 'You need to save your changes first!',
        status: 'error',
      });
      return;
    }
    onClose();
  };

  return (
    <Flyout
      open={open && instanceId !== null}
      onClose={handleClose}
      label="Instance settings"
      widthClass="max-w-[960px]"
      heightClass="h-[min(680px,calc(100dvh-6rem))]"
    >
      {instanceId !== null && (
        <SettingsForm
          key={instanceId}
          settings={settings}
          launcher={launcher}
          instanceId={instanceId}
          onClose={onClose}
          onDirtyChange={(dirty) => {
            dirtyRef.current = dirty;
          }}
        />
      )}
    </Flyout>
  );
}

// QML keyName mapping: Qt.keyToString lowercased, spaces -> dots, with the
// modifier keys pinned to left.* names.
function keyEventToBinding(event: KeyboardEvent): string | null {
  const key = event.key;
  if (key === 'Escape') {
    return '';
  }
  let name: string;
  switch (key) {
    case 'Shift':
      name = 'left.shift';
      break;
    case 'Control':
      name = 'left.control';
      break;
    case 'Alt':
      name = 'left.alt';
      break;
    case 'Meta':
      name = 'left.meta';
      break;
    case ' ':
      name = 'space';
      break;
    case 'ArrowUp':
      name = 'up';
      break;
    case 'ArrowDown':
      name = 'down';
      break;
    case 'ArrowLeft':
      name = 'left';
      break;
    case 'ArrowRight':
      name = 'right';
      break;
    default:
      name = key.toLowerCase().replace(/\s+/g, '.');
  }
  return name.length > 0 ? `key.keyboard.${name}` : null;
}

function displayBinding(value: string, display: string): string {
  if (display.length > 0) {
    return display.toUpperCase();
  }
  return value
    .replace('key.keyboard.', '')
    .replace('key.mouse.', 'Mouse ')
    .toUpperCase();
}

interface SettingsFormProps {
  settings: ReturnType<typeof useInstanceSettingsSnapshot>;
  launcher: ReturnType<typeof useLauncherSnapshot>;
  instanceId: string;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

function sameOptions(a: CommonOptions, b: CommonOptions, unlimited: boolean): boolean {
  return (
    a.fov === b.fov &&
    a.gamma === b.gamma &&
    a.renderDistance === b.renderDistance &&
    a.simulationDistance === b.simulationDistance &&
    a.maxFps === b.maxFps &&
    a.unlimitedFps === unlimited &&
    a.guiScale === b.guiScale &&
    a.fullscreen === b.fullscreen &&
    a.enableVsync === b.enableVsync
  );
}

function SettingsForm({
  settings,
  launcher,
  instanceId,
  onClose,
  onDirtyChange,
}: SettingsFormProps) {
  const [options, setOptions] = useState<CommonOptions>(settings.commonOptions);
  const [unlimitedFps, setUnlimitedFps] = useState(settings.commonOptions.unlimitedFps);
  const [advancedKey, setAdvancedKey] = useState('');
  const [advancedValue, setAdvancedValue] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [controlDraft, setControlDraft] = useState<Record<string, string>>({});
  const [capturingKey, setCapturingKey] = useState('');
  const [serverName, setServerName] = useState('');
  const [serverAddress, setServerAddress] = useState('');
  const [selectedServer, setSelectedServer] = useState(-1);
  const [javaFlagsOverridden, setJavaFlagsOverridden] = useState(
    settings.javaFlagsOverridden,
  );
  const [javaFlags, setJavaFlags] = useState(settings.javaFlags);
  const [optionsPhase, setOptionsPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [controlsPhase, setControlsPhase] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const instance = launcher.instances.find((entry) => entry.id === instanceId);

  // Repopulate the form whenever the core publishes fresh state while idle
  // (parity with QML populateForm on !busy changed).
  const statusSignature = `${settings.status}|${settings.instanceName}`;
  useEffect(() => {
    if (!settings.busy) {
      setOptions(settings.commonOptions);
      setUnlimitedFps(settings.commonOptions.unlimitedFps);
      const bindings: Record<string, string> = {};
      for (const binding of settings.controls) {
        bindings[binding.key] = binding.value;
      }
      setControlDraft(bindings);
      setJavaFlagsOverridden(settings.javaFlagsOverridden);
      setJavaFlags(settings.javaFlags);
      setSelectedServer(-1);
      setServerName('');
      setServerAddress('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusSignature, settings.busy]);

  // Dirty tracking: any unsaved draft blocks closing with a warning toast.
  const controlsBaseline = settings.controls
    .map((binding) => `${binding.key}=${binding.value}`)
    .sort()
    .join('|');
  const controlsDraftSignature = settings.controls
    .map((binding) => `${binding.key}=${controlDraft[binding.key] ?? binding.value}`)
    .sort()
    .join('|');
  const dirty =
    !sameOptions(settings.commonOptions, options, unlimitedFps) ||
    controlsDraftSignature !== controlsBaseline ||
    javaFlags !== settings.javaFlags ||
    javaFlagsOverridden !== settings.javaFlagsOverridden;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const requestClose = () => {
    if (dirty) {
      toast({
        title: 'You need to save your changes first!',
        status: 'error',
      });
      return;
    }
    onClose();
  };

  // Keyboard capture for control rebinding (parity with QML Keys.onPressed).
  useEffect(() => {
    if (capturingKey.length === 0) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setCapturingKey('');
        return;
      }
      const binding = keyEventToBinding(event);
      if (binding === null) {
        return;
      }
      setControlDraft((draft) => ({ ...draft, [capturingKey]: binding }));
      setCapturingKey('');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingKey]);

  const saveCommonOptions = () => {
    setOptionsPhase('saving');
    void strataApi
      .request('instanceSettings.saveCommonOptions', {
        options: {
          fov: options.fov,
          gamma: options.gamma,
          renderDistance: options.renderDistance,
          simulationDistance: options.simulationDistance,
          maxFps: options.maxFps,
          unlimitedFps,
          guiScale: options.guiScale,
          fullscreen: options.fullscreen,
          enableVsync: options.enableVsync,
        },
      })
      .then(() => {
        setOptionsPhase('saved');
        toast({ title: 'Game options saved', status: 'success' });
        window.setTimeout(() => setOptionsPhase('idle'), 1600);
      })
      .catch(() => {
        setOptionsPhase('idle');
        toast({ title: 'Failed to save game options', status: 'error' });
      });
  };

  const saveControls = () => {
    setCapturingKey('');
    setControlsPhase('saving');
    void strataApi
      .request('instanceSettings.saveControls', { bindings: controlDraft })
      .then(() => {
        setControlsPhase('saved');
        toast({ title: 'Controls saved!', status: 'success' });
        window.setTimeout(() => setControlsPhase('idle'), 1600);
      })
      .catch(() => {
        setControlsPhase('idle');
        toast({ title: 'Failed to save controls', status: 'error' });
      });
  };

  const runtimeLabel =
    instance === undefined
      ? 'Select an instance to configure its Java runtime.'
      : instance.runtimeMode === 'MANAGED'
        ? `Current runtime: Managed · ${instance.runtimeComponent}`
        : 'Current runtime: System Java';

  const confirmDelete = () => {
    void strataApi
      .request('instances.delete', { instanceId })
      .then(onClose)
      .catch(() => undefined);
  };

  const title =
    settings.instanceName.length > 0
      ? `${settings.instanceName} settings`
      : 'Instance settings';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <h2 className="font-display text-2xl font-semibold text-foreground">{title}</h2>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={requestClose}>
          Close
        </Button>
      </div>

      <Tabs defaultValue="game" className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-3">
        <TabsList>
          <TabsTrigger value="game">Game options</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="servers">Servers</TabsTrigger>
          <TabsTrigger value="java">Java</TabsTrigger>
          <TabsTrigger value="dangerous">Dangerous</TabsTrigger>
        </TabsList>

        <TabsContent value="game" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-3">
          <p className="text-sm text-muted-foreground">
            These settings apply only to {settings.instanceName} and preserve other entries in
            options.txt.
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm text-foreground">
                <span>Field of view</span>
                <span className="tabular-nums text-muted-foreground">{options.fov}</span>
              </div>
              <RangeSlider
                min={30}
                max={110}
                step={1}
                value={options.fov}
                onValueChange={(fov) => setOptions((o) => ({ ...o, fov }))}
                aria-label="Field of view"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm text-foreground">
                <span>Gamma / brightness</span>
                <span className="tabular-nums text-muted-foreground">
                  {options.gamma.toFixed(2)}
                </span>
              </div>
              <RangeSlider
                min={0}
                max={1}
                step={0.01}
                value={options.gamma}
                onValueChange={(gamma) => setOptions((o) => ({ ...o, gamma }))}
                aria-label="Gamma / brightness"
              />
            </div>
            <label className="flex items-center justify-between gap-2 text-sm text-foreground">
              Render distance (chunks)
              <AdaptiveStepper
                min={2}
                max={32}
                step={1}
                value={options.renderDistance}
                onValueChange={(renderDistance) =>
                  setOptions((o) => ({ ...o, renderDistance }))
                }
                aria-label="Render distance"
              >
                <AdaptiveStepperDecrement />
                <AdaptiveStepperValue />
                <AdaptiveStepperIncrement />
              </AdaptiveStepper>
            </label>
            <label className="flex items-center justify-between gap-2 text-sm text-foreground">
              Simulation distance (chunks)
              <AdaptiveStepper
                min={2}
                max={32}
                step={1}
                value={options.simulationDistance}
                onValueChange={(simulationDistance) =>
                  setOptions((o) => ({ ...o, simulationDistance }))
                }
                aria-label="Simulation distance"
              >
                <AdaptiveStepperDecrement />
                <AdaptiveStepperValue />
                <AdaptiveStepperIncrement />
              </AdaptiveStepper>
            </label>
            <label className="flex items-center justify-between gap-2 text-sm text-foreground">
              Maximum frame rate
              <span className="flex items-center gap-2">
                <AdaptiveStepper
                  min={10}
                  max={250}
                  step={10}
                  disabled={unlimitedFps}
                  value={options.maxFps}
                  onValueChange={(maxFps) => setOptions((o) => ({ ...o, maxFps }))}
                  aria-label="Maximum frame rate"
                >
                  <AdaptiveStepperDecrement />
                  <AdaptiveStepperValue />
                  <AdaptiveStepperIncrement />
                </AdaptiveStepper>
                <Switch
                  checked={unlimitedFps}
                  onCheckedChange={setUnlimitedFps}
                  ariaLabel="Unlimited frame rate"
                />
              </span>
            </label>
            <label className="flex items-center justify-between gap-2 text-sm text-foreground">
              GUI scale (0 = Auto)
              <AdaptiveStepper
                min={0}
                max={16}
                step={1}
                value={options.guiScale}
                onValueChange={(guiScale) => setOptions((o) => ({ ...o, guiScale }))}
                aria-label="GUI scale"
              >
                <AdaptiveStepperDecrement />
                <AdaptiveStepperValue />
                <AdaptiveStepperIncrement />
              </AdaptiveStepper>
            </label>
            <div className="col-span-2 flex flex-col gap-1.5 text-sm text-foreground">
              <span className="text-muted-foreground">Display</span>
              <Checkbox
                label="Start in fullscreen"
                checked={options.fullscreen}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({ ...o, fullscreen: checked }))
                }
              />
              <Checkbox
                label="Vertical synchronization"
                checked={options.enableVsync}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({ ...o, enableVsync: checked }))
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionSwapBlurButton
              items={[
                { id: 'save', label: 'Save Changes' },
                { id: 'saving', label: 'Saving...' },
                { id: 'saved', label: 'Saved' },
              ]}
              value={optionsPhase}
              cycle={false}
              disabled={settings.busy || optionsPhase !== 'idle'}
              onClick={saveCommonOptions}
              variant="primary"
              size="sm"
            />
          </div>

          <Checkbox
            label="Show Advanced"
            checked={showAdvanced}
            onCheckedChange={setShowAdvanced}
            className="pt-2"
          />
          {showAdvanced && (
            <>
              <p className="text-sm text-muted-foreground">
                Edit an additional Minecraft setting using its raw options.txt key and value.
              </p>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={advancedKey}
                  onChange={setAdvancedKey}
                  placeholder="Option key"
                />
                <Input
                  className="flex-1"
                  value={advancedValue}
                  onChange={setAdvancedValue}
                  placeholder="Raw value"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={settings.busy}
                  onClick={() => {
                    void strataApi
                      .request('instanceSettings.saveOption', {
                        key: advancedKey,
                        value: advancedValue,
                      })
                      .catch(() => undefined);
                    setAdvancedKey('');
                    setAdvancedValue('');
                  }}
                >
                  Save option
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="controls" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pt-3">
          <p className="text-sm text-muted-foreground">
            {capturingKey.length > 0
              ? `Press a key to bind ${capturingKey
                  .replace('key_key.', '')
                  .replace('.', ' ')}. Press Escape to cancel.`
              : 'Select Rebind, then press the keyboard key you want to use.'}
          </p>
          <div className="flex flex-col gap-1.5">
            {settings.controls.map((binding, index) => {
              const draft = controlDraft[binding.key] ?? binding.value;
              return (
                <div
                  key={binding.key}
                  className={`flex h-11 items-center gap-2 rounded-xl border px-3 ${
                    index % 2 === 0 ? 'bg-muted/60' : 'bg-muted/30'
                  } border-border`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {binding.name}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCapturingKey(binding.key)}
                  >
                    {capturingKey === binding.key
                      ? 'Press a key…'
                      : displayBinding(draft, binding.display)}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setControlDraft((draftMap) => ({
                        ...draftMap,
                        [binding.key]: 'key.keyboard.unknown',
                      }))
                    }
                  >
                    Unassign
                  </Button>
                </div>
              );
            })}
            {settings.controls.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No control bindings found in options.txt.
              </p>
            )}
          </div>
          <div className="mt-auto flex items-center gap-2 pt-2">
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">
              {settings.status}
            </span>
            <ActionSwapBlurButton
              items={[
                { id: 'save', label: 'Save Changes' },
                { id: 'saving', label: 'Saving...' },
                { id: 'saved', label: 'Saved!' },
              ]}
              value={controlsPhase}
              cycle={false}
              disabled={settings.busy || controlsPhase !== 'idle'}
              onClick={saveControls}
              variant="primary"
              size="sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="servers" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pt-3">
          <p className="text-sm text-muted-foreground">
            Saved multiplayer servers for this instance.
          </p>
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {settings.servers.map((server, index) => (
              <button
                key={`${server.name}-${index}`}
                type="button"
                onClick={() => {
                  setSelectedServer(index);
                  setServerName(server.name);
                  setServerAddress(server.address);
                }}
                className={`flex h-11 items-center gap-3 rounded-xl border px-3 text-left ${
                  selectedServer === index
                    ? 'border-primary/60 bg-accent/60'
                    : 'border-border bg-muted/30'
                }`}
              >
                <span className="shrink-0 text-sm font-semibold text-foreground">
                  {server.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {server.address}
                </span>
              </button>
            ))}
            {settings.servers.length === 0 && (
              <p className="text-sm text-muted-foreground">No saved servers.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              value={serverName}
              onChange={setServerName}
              placeholder="Server name"
            />
            <Input
              className="flex-1"
              value={serverAddress}
              onChange={setServerAddress}
              placeholder="Server address"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={settings.busy}
              onClick={() =>
                void strataApi
                  .request('instanceSettings.addServer', {
                    name: serverName,
                    address: serverAddress,
                  })
                  .catch(() => undefined)
              }
            >
              Add server
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={selectedServer < 0 || settings.busy}
              onClick={() =>
                void strataApi
                  .request('instanceSettings.updateServer', {
                    index: selectedServer,
                    name: serverName,
                    address: serverAddress,
                  })
                  .catch(() => undefined)
              }
            >
              Save selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={selectedServer < 0 || settings.busy}
              onClick={() =>
                void strataApi
                  .request('instanceSettings.removeServer', { index: selectedServer })
                  .then(() => setSelectedServer(-1))
                  .catch(() => undefined)
              }
            >
              Remove selected
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="java" className="flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto pt-3">
          <p className="text-sm text-muted-foreground">{runtimeLabel}</p>
          <Checkbox
            label="Use Managed Java"
            checked={instance?.runtimeMode === 'MANAGED'}
            disabled={settings.busy || launcher.installingRuntime}
            onCheckedChange={(checked) => {
              void strataApi
                .request(checked ? 'runtime.installForInstance' : 'runtime.useSystemJava', {
                  instanceId,
                })
                .catch(() => undefined);
            }}
          />
          <p className="text-sm text-muted-foreground">
            Use launcher Java flags or define an instance override. One JVM option per line.
          </p>
          <Checkbox
            label="Use instance-specific Java flags"
            checked={javaFlagsOverridden}
            disabled={settings.busy}
            onCheckedChange={setJavaFlagsOverridden}
          />
          <textarea
            value={javaFlags}
            disabled={!javaFlagsOverridden || settings.busy}
            onChange={(event) => setJavaFlags(event.target.value)}
            placeholder={'-Xmx4G\n-XX:+UseG1GC'}
            spellCheck={false}
            className="min-h-32 flex-1 resize-none rounded-xl border border-border bg-muted/30 p-3 font-mono text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={settings.busy}
              onClick={() =>
                void strataApi
                  .request('instanceSettings.saveJavaFlags', {
                    overridden: javaFlagsOverridden,
                    text: javaFlags,
                  })
                  .catch(() => undefined)
              }
            >
              Save Java flags
            </Button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="secondary"
              disabled={launcher.installingRuntime}
              onClick={() =>
                void strataApi
                  .request('runtime.installForInstance', { instanceId })
                  .catch(() => undefined)
              }
            >
              {`Install and use ${launcher.runtimeVendor || 'managed'} Java`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={() =>
                void strataApi
                  .request('runtime.useSystemJava', { instanceId })
                  .catch(() => undefined)
              }
            >
              Use System Java
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="dangerous" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-3">
          <h3 className="font-display text-lg font-semibold text-destructive">
            Dangerous instance actions
          </h3>
          <p className="text-sm text-muted-foreground">
            Deleting permanently removes this instance and its local files.
          </p>
          <Input
            value={deleteConfirmation}
            onChange={setDeleteConfirmation}
            placeholder="Type DELETE to remove this instance"
            disabled={launcher.deletingInstance}
          />
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {launcher.deletingInstance ? 'Deleting instance…' : settings.instanceName}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={
                deleteConfirmation !== 'DELETE' || launcher.deletingInstance
              }
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete instance
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2 border-t border-border px-5 py-3">
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">
          {settings.status}
          {settings.busy ? ' …' : ''}
        </span>
      </div>
    </div>
  );
}
