import { useEffect, useState } from 'react';

import { Button } from '@/components/motion/button/base';
import { Checkbox } from '@/components/motion/checkbox';
import { RangeSlider } from '@/components/motion/range-slider';
import Flyout from './Flyout';
import { Input } from '@/components/motion/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import VersionPicker from './VersionPicker';
import { useLauncherSnapshot } from '../lib/launcher';
import { strataApi } from '../lib/strata';

const LOADER_TYPES = [
  { id: 'VANILLA', label: 'Vanilla' },
  { id: 'FABRIC', label: 'Fabric' },
  { id: 'QUILT', label: 'Quilt' },
  { id: 'FORGE', label: 'Forge' },
  { id: 'NEOFORGE', label: 'NeoForge' },
] as const;

interface CreateInstanceDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateInstanceDialog({ open, onClose }: CreateInstanceDialogProps) {
  const launcher = useLauncherSnapshot();

  const [name, setName] = useState('');
  const [versionId, setVersionId] = useState('');
  const [loaderType, setLoaderType] = useState('VANILLA');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [memoryGb, setMemoryGb] = useState(4);
  const [memoryMaxGb, setMemoryMaxGb] = useState(8);
  const [launchAfterInstall, setLaunchAfterInstall] = useState(false);
  const [useManagedJava, setUseManagedJava] = useState(false);
  const [autoPerformanceMods, setAutoPerformanceMods] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    void strataApi
      .getSystemMemoryMb()
      .then(({ totalMb }) => {
        const totalGb = Math.max(2, Math.floor(totalMb / 1024));
        const max = Math.max(1, Math.floor(totalGb * 0.75));
        setMemoryMaxGb(max);
        setMemoryGb((current) => Math.min(Math.max(current, 1), max));
      })
      .catch(() => undefined);
  }, [open]);

  // Default the name + version once manifest data arrives (parity with QML:
  // "Minecraft <latestRelease>" and latest release preselected).
  useEffect(() => {
    if (!open) {
      return;
    }
    if (name.length === 0 && launcher.latestRelease.length > 0) {
      setName(`Minecraft ${launcher.latestRelease}`);
    }
    if (versionId.length === 0) {
      const latest = launcher.versions.find((v) => v.id === launcher.latestRelease);
      setVersionId((latest ?? launcher.versions[0])?.id ?? '');
    }
  }, [open, launcher.latestRelease, launcher.versions, name, versionId]);

  // Fetch loader versions whenever a non-vanilla loader + MC version is chosen.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (loaderType !== 'VANILLA' && versionId.length > 0) {
      void strataApi
        .request('versions.loadLoaderVersions', {
          loaderType,
          minecraftVersion: versionId,
        })
        .catch(() => undefined);
    }
  }, [open, loaderType, versionId]);

  useEffect(() => {
    if (launcher.loaderVersions.length > 0 && loaderVersion.length === 0) {
      setLoaderVersion(launcher.loaderVersions[0]);
    }
  }, [launcher.loaderVersions, loaderVersion]);

  const canCreate =
    name.trim().length > 0 &&
    versionId.length > 0 &&
    (loaderType === 'VANILLA' || loaderVersion.length > 0) &&
    !launcher.loadingLoaderVersions &&
    !launcher.installing;

  const create = () => {
    void strataApi
      .request('install.instanceWithLoader', {
        name: name.trim(),
        versionId,
        loaderType,
        loaderVersion: loaderType === 'VANILLA' ? '' : loaderVersion,
        allocatedMemoryMb: memoryGb * 1024,
        launchAfterInstall,
        useManagedJava,
        autoPerformanceMods,
      })
      .then(() => onClose())
      .catch(() => undefined);
  };

  const statusText = launcher.usingCachedManifest
    ? 'Using cached version data while offline.'
    : launcher.versions.length > 0
      ? 'Choose a version to install its metadata and client files.'
      : launcher.errorMessage.length > 0
        ? `Could not load versions: ${launcher.errorMessage}`
        : 'Fetching Mojang version data...';

  const loaderStatus =
    launcher.loadingLoaderVersions
      ? 'Fetching compatible loader versions...'
      : launcher.loaderVersionsError.length > 0
        ? launcher.loaderVersionsError
        : launcher.loaderVersions.length === 0
          ? 'No compatible loader versions are available.'
          : 'Choose a loader version.';

  return (
    <Flyout
      open={open}
      onClose={onClose}
      label="Create instance"
      widthClass="max-w-[480px]"
      heightClass="h-auto max-h-[calc(100dvh-4rem)]"
    >
      <div className="flex max-h-[calc(100dvh-4rem)] flex-col overflow-hidden p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Create instance
          </h2>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-3 overflow-y-auto">
          <Input
            value={name}
            onChange={setName}
            placeholder="Instance name"
          />
          <VersionPicker
            options={launcher.versions}
            value={versionId}
            onChange={setVersionId}
            placeholder="Minecraft version"
            disabled={launcher.versions.length === 0}
            emptyText="No matching versions."
          />
          <Select value={loaderType} onValueChange={setLoaderType}>
            <SelectTrigger>
              <SelectValue placeholder="Loader" />
            </SelectTrigger>
            <SelectContent>
              {LOADER_TYPES.map((loader) => (
                <SelectItem key={loader.id} value={loader.id}>
                  {loader.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loaderType !== 'VANILLA' && (
            <>
              <VersionPicker
                options={launcher.loaderVersions.map((version) => ({
                  id: version,
                  label: version,
                }))}
                value={loaderVersion}
                onChange={setLoaderVersion}
                placeholder="Loader version"
                disabled={
                  launcher.loadingLoaderVersions || launcher.loaderVersions.length === 0
                }
                emptyText="No matching loader versions."
              />
              <p className="text-xs text-muted-foreground">{loaderStatus}</p>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm text-foreground">
              <span>Allocated RAM</span>
              <span className="tabular-nums text-muted-foreground">{memoryGb} GB</span>
            </div>
            <RangeSlider
              min={1}
              max={memoryMaxGb}
              step={1}
              value={memoryGb}
              onValueChange={setMemoryGb}
              aria-label="Allocated RAM"
            />
          </div>
          <Checkbox
            label="Use Managed Java"
            checked={useManagedJava}
            onCheckedChange={setUseManagedJava}
          />
          <Checkbox
            label="Auto-Add Performance Mods"
            checked={autoPerformanceMods}
            onCheckedChange={setAutoPerformanceMods}
          />
          {autoPerformanceMods && loaderType === 'VANILLA' && (
            <p className="text-xs text-muted-foreground">
              Performance mods require a mod loader — pick Fabric, Quilt, Forge,
              or NeoForge for them to install.
            </p>
          )}
          <p className="text-xs text-muted-foreground">{statusText}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Checkbox
              label="Launch after Install"
              checked={launchAfterInstall}
              onCheckedChange={setLaunchAfterInstall}
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" disabled={!canCreate} onClick={create}>
                Install
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Flyout>
  );
}
