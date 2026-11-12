import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { Button } from '@/components/motion/button/base';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/motion/alert';
import { Loader } from '@/components/motion/loader';
import InstanceCard from '../components/InstanceCard';
import ConsolePanel from '../components/ConsolePanel';
import CreateInstanceDialog from '../components/CreateInstanceDialog';
import ImportInstanceDialog from '../components/ImportInstanceDialog';
import DeleteInstanceDialog from '../components/DeleteInstanceDialog';
import InstallOverlay from '../components/InstallOverlay';
import InstanceSettingsFlyout from '../components/InstanceSettingsFlyout';
import { staggerContainer } from '../theme/motion';
import { useLauncherSnapshot } from '../lib/launcher';
import { strataApi } from '../lib/strata';
import { useLauncherStore } from '../stores/launcher';
import { useUiStore } from '../stores/ui';
import { motion } from 'framer-motion';

export default function InstancesPage() {
  const launcher = useLauncherSnapshot();
  const deletingInstance = useLauncherStore((state) => state.state?.deletingInstance);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleInstanceId, setConsoleInstanceId] = useState<string | null>(null);
  // Cross-page open requests (command palette) share the ui store.
  const createOpen = useUiStore((state) => state.createInstanceOpen);
  const setCreateOpen = useUiStore((state) => state.setCreateInstanceOpen);
  const importOpen = useUiStore((state) => state.importInstanceOpen);
  const setImportOpen = useUiStore((state) => state.setImportInstanceOpen);
  const focusInstanceId = useUiStore((state) => state.focusInstanceId);
  const requestInstanceFocus = useUiStore((state) => state.requestInstanceFocus);
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const instances = launcher.instances;

  // Command-palette deep link: select the requested instance once it exists.
  useEffect(() => {
    if (focusInstanceId === null) {
      return;
    }
    if (instances.some((instance) => instance.id === focusInstanceId)) {
      setSelectedId(focusInstanceId);
      requestInstanceFocus(null);
    }
  }, [focusInstanceId, instances, requestInstanceFocus]);

  const toggleLaunch = (instanceId: string) => {
    void strataApi.request('console.open', { instanceId }).catch(() => undefined);
    void strataApi
      .request('launch.instance', { instanceId })
      .catch(() => undefined);
  };

  const openConsole = (instanceId: string) => {
    setConsoleInstanceId(instanceId);
    setConsoleOpen(true);
    void strataApi.request('console.open', { instanceId }).catch(() => undefined);
  };

  const stopInstance = (instanceId: string) => {
    void strataApi.request('console.open', { instanceId }).catch(() => undefined);
    void strataApi.request('launch.stopInstance', { instanceId }).catch(() => undefined);
  };

  const launchOrStop = (instanceId: string, status: string) => {
    if (status === 'starting' || status === 'ready') {
      stopInstance(instanceId);
    } else {
      toggleLaunch(instanceId);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget === null) {
      return;
    }
    void strataApi
      .request('instances.delete', { instanceId: deleteTarget.id })
      .then(() => {
        setDeleteTarget(null);
        if (selectedId === deleteTarget.id) {
          setSelectedId(null);
        }
      })
      .catch(() => undefined);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="relative flex h-full flex-col gap-3 p-6"
    >
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-foreground">Instances</h1>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          disabled={launcher.initializing}
          onClick={() => void strataApi.request('launcher.refresh').catch(() => undefined)}
        >
          {launcher.initializing ? (
            <Loader variant="dot-matrix" size={14} label="Refreshing" />
          ) : (
            'Refresh'
          )}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
          Import
        </Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Create instance
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConsoleOpen((v) => !v)}>
          {consoleOpen ? 'Hide console' : 'Show console'}
        </Button>
      </div>

      {launcher.errorMessage.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{launcher.errorMessage}</AlertDescription>
        </Alert>
      )}

      {instances.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">
            No instances yet — create one to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-4">
          <AnimatePresence initial={false}>
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                selected={selectedId === instance.id}
                onSelect={() => setSelectedId(instance.id)}
                onLaunchToggle={() => launchOrStop(instance.id, instance.status)}
                onOpenConsole={() => openConsole(instance.id)}
                onSettings={() => setSettingsInstanceId(instance.id)}
                onDelete={() => setDeleteTarget({ id: instance.id, name: instance.name })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ConsolePanel
        open={consoleOpen}
        instances={instances}
        consoleText={launcher.consoleText}
        consoleInstanceName={launcher.consoleInstanceName}
        consoleInstanceId={consoleInstanceId}
        onClose={() => setConsoleOpen(false)}
      />
      <CreateInstanceDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ImportInstanceDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <DeleteInstanceDialog
        open={deleteTarget !== null}
        instanceName={deleteTarget?.name ?? ''}
        busy={deletingInstance === true}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <InstanceSettingsFlyout
        open={settingsInstanceId !== null}
        instanceId={settingsInstanceId}
        onClose={() => setSettingsInstanceId(null)}
      />
      <InstallOverlay />
    </motion.div>
  );
}
