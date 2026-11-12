import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

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
import Icon from '../components/Icon';
import VersionPicker from '../components/VersionPicker';
import { staggerContainer, staggerItem } from '../theme/motion';
import Flyout from '../components/Flyout';
import { strataApi } from '../lib/strata';
import { useLauncherSnapshot, type ServerInfo } from '../lib/launcher';
import { useUiStore } from '../stores/ui';

const DISTRIBUTIONS = [
  { id: 'VANILLA', label: 'Vanilla' },
  { id: 'FABRIC', label: 'Fabric' },
  { id: 'PAPER', label: 'Paper' },
] as const;

const SERVER_TABS = ['Overview', 'Console', 'Content', 'Dangerous'] as const;
type ServerTab = (typeof SERVER_TABS)[number];

function distributionLabel(server: ServerInfo): string {
  return `${server.distribution} · ${server.version}`;
}

function ServerCreateDialog({
  open,
  versions,
  latestRelease,
  busy,
  onClose,
}: {
  open: boolean;
  versions: Array<{ id: string; label: string }>;
  latestRelease: string;
  busy: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [versionId, setVersionId] = useState('');
  const [distribution, setDistribution] = useState('VANILLA');

  useEffect(() => {
    if (open && versionId.length === 0) {
      const latest = versions.find((v) => v.id === latestRelease);
      setVersionId((latest ?? versions[0])?.id ?? '');
    }
  }, [open, versions, latestRelease, versionId]);

  const canCreate =
    name.trim().length > 0 && versionId.length > 0 && !busy;

  const create = () => {
    void strataApi
      .request('servers.create', {
        name: name.trim(),
        version: versionId,
        distribution,
      })
      .then(() => {
        setName('');
        onClose();
      })
      .catch(() => undefined);
  };

  return (
    <Flyout
      open={open}
      onClose={onClose}
      label="Create server"
      widthClass="max-w-[480px]"
      heightClass="h-auto max-h-[calc(100dvh-4rem)]"
    >
      <div className="flex max-h-[calc(100dvh-4rem)] flex-col overflow-hidden p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Create server
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
            placeholder="Server name"
          />
          <VersionPicker
            options={versions}
            value={versionId}
            onChange={setVersionId}
            placeholder="Minecraft version"
            disabled={versions.length === 0}
            emptyText="No matching versions."
          />
          <Select value={distribution} onValueChange={setDistribution}>
            <SelectTrigger>
              <SelectValue placeholder="Distribution" />
            </SelectTrigger>
            <SelectContent>
              {DISTRIBUTIONS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canCreate} onClick={create}>
              Create
            </Button>
          </div>
        </div>
      </div>
    </Flyout>
  );
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Flyout
      open={open}
      onClose={onClose}
      label={title}
      widthClass="max-w-[440px]"
      heightClass="h-auto"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Flyout>
  );
}

function DeleteServerDialog({
  open,
  serverName,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  serverName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (open) {
      setConfirmation('');
    }
  }, [open]);

  return (
    <Flyout
      open={open}
      onClose={onClose}
      label="Delete server"
      widthClass="max-w-[440px]"
      heightClass="h-auto"
    >
      <div className="flex flex-col p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-destructive">
            Delete server
          </h2>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Type DELETE to permanently remove{' '}
          <span className="text-foreground">{serverName}</span> and its files.
        </p>
        <Input
          className="mt-4"
          value={confirmation}
          onChange={setConfirmation}
          placeholder="DELETE"
          disabled={busy}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {busy ? 'Deleting…' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={confirmation !== 'DELETE' || busy}
              onClick={onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete server
            </Button>
          </div>
        </div>
      </div>
    </Flyout>
  );
}

function ServerConsole({ text }: { text: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el !== null && pinned.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text]);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const el = event.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className="min-h-0 flex-1 overflow-y-auto p-3"
    >
      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-foreground/70">
        {text.length > 0 ? text : 'No console output yet.'}
      </pre>
    </div>
  );
}

export default function ServersPage() {
  const launcher = useLauncherSnapshot();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<ServerTab>('Overview');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [eulaOpen, setEulaOpen] = useState(false);

  const [name, setName] = useState('');
  const [onlineMode, setOnlineMode] = useState(true);
  const [managedJava, setManagedJava] = useState(true);
  const [viewDistance, setViewDistance] = useState('10');
  const [javaFlags, setJavaFlags] = useState('');
  const [properties, setProperties] = useState('');
  const [command, setCommand] = useState('');
  const [contentQuery, setContentQuery] = useState('');
  const [contentProjectId, setContentProjectId] = useState('');
  const [contentVersionId, setContentVersionId] = useState('');

  const servers = launcher.servers;
  const selected: ServerInfo | null =
    servers.find((server) => server.id === selectedId) ?? null;
  const contentCapable =
    selected !== null &&
    (selected.distribution === 'PAPER' || selected.distribution === 'FABRIC');
  const visibleTabs = SERVER_TABS.filter(
    (candidate) => candidate !== 'Content' || contentCapable,
  );

  const selectServer = (server: ServerInfo) => {
    setSelectedId(server.id);
    setTab('Overview');
    setContentProjectId('');
    setContentVersionId('');
    setName(server.name);
    setOnlineMode(server.onlineMode);
    setManagedJava(server.useManagedJavaRuntime);
    setViewDistance(String(server.viewDistance));
    setJavaFlags(server.javaFlags.join('\n'));
    setProperties('');
    void strataApi.request('servers.select', { id: server.id }).catch(() => undefined);
    void strataApi
      .request('servers.loadProperties', { id: server.id })
      .catch(() => undefined);
  };

  // server.properties text arrives asynchronously via the launcher snapshot.
  useEffect(() => {
    setProperties(launcher.serverProperties);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launcher.serverProperties]);

  useEffect(() => {
    if (visibleTabs.includes(tab) === false) {
      setTab('Overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.distribution]);

  // Command-palette deep link: select the requested server once it exists.
  const focusServerId = useUiStore((state) => state.focusServerId);
  const requestServerFocus = useUiStore((state) => state.requestServerFocus);
  useEffect(() => {
    if (focusServerId === null) {
      return;
    }
    const target = servers.find((server) => server.id === focusServerId);
    if (target !== undefined) {
      selectServer(target);
      requestServerFocus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusServerId, servers, requestServerFocus]);

  const startServer = (server: ServerInfo) => {
    if (!server.eulaAccepted) {
      setEulaOpen(true);
      return;
    }
    void strataApi.request('servers.start', { id: server.id }).catch(() => undefined);
  };

  const acceptEulaAndStart = () => {
    if (selected === null) {
      return;
    }
    void strataApi
      .request('servers.setEulaAccepted', { id: selected.id, accepted: true })
      .then(() => strataApi.request('servers.start', { id: selected.id }))
      .catch(() => undefined)
      .finally(() => setEulaOpen(false));
  };

  const saveSettings = () => {
    if (selected === null) {
      return;
    }
    void strataApi
      .request('servers.updateSettings', {
        id: selected.id,
        name: name.trim(),
        eulaAccepted: selected.eulaAccepted,
        javaFlags,
        viewDistance: Number.parseInt(viewDistance, 10) || 10,
        onlineMode,
        useManagedJavaRuntime: managedJava,
      })
      .catch(() => undefined);
  };

  const searchContent = () => {
    if (selected === null) {
      return;
    }
    void strataApi
      .request('servers.searchContent', {
        id: selected.id,
        query: contentQuery,
      })
      .catch(() => undefined);
  };

  const installContent = () => {
    if (selected === null || contentProjectId.length === 0 || contentVersionId.length === 0) {
      return;
    }
    void strataApi
      .request('servers.installContent', {
        id: selected.id,
        projectId: contentProjectId,
        versionId: contentVersionId,
      })
      .catch(() => undefined);
  };

  const confirmDelete = () => {
    if (selected === null) {
      return;
    }
    void strataApi
      .request('servers.delete', { id: selected.id })
      .then(() => {
        setDeleteOpen(false);
        setSelectedId(null);
      })
      .catch(() => undefined);
  };

  const sendCommand = () => {
    if (selected === null || command.trim().length === 0) {
      return;
    }
    void strataApi
      .request('servers.sendCommand', { id: selected.id, command: command.trim() })
      .then(() => setCommand(''))
      .catch(() => undefined);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="relative flex h-full gap-4 p-6"
    >
      {/* Server list */}
      <div className="flex w-72 shrink-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-foreground">Servers</h1>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void strataApi.request('servers.refresh').catch(() => undefined)}
          >
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Create server
          </Button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto pb-4">
          {servers.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              {launcher.serverBusy ? 'Loading servers…' : 'No servers yet.'}
            </p>
          ) : (
            servers.map((server) => (
              <motion.button
                key={server.id}
                variants={staggerItem}
                onClick={() => selectServer(server)}
                className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                  selectedId === server.id
                    ? 'border-primary/60 bg-accent/60'
                    : 'border-border bg-card/70 hover:border-primary/40 hover:bg-accent/30'
                }`}
              >
                <span className="truncate font-display text-lg text-foreground">
                  {server.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {distributionLabel(server)} ·{' '}
                  {server.running
                    ? server.processState || 'running'
                    : server.installed
                      ? 'Installed'
                      : 'Not installed'}
                </span>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-border bg-card/70 backdrop-blur-md">
        {selected === null ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Select a server to edit its settings.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {selected.name}
              </h2>
              <div className="flex-1" />
              <div className="flex gap-1">
                {visibleTabs.map((candidate) => (
                  <Button
                    key={candidate}
                    size="sm"
                    variant={tab === candidate ? 'secondary' : 'ghost'}
                    onClick={() => setTab(candidate)}
                  >
                    {candidate}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {launcher.serverBusy && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground">{launcher.serverStatus}</p>
                  {launcher.serverInstallItem.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {launcher.serverInstallItem}
                    </p>
                  )}
                  {launcher.serverProgress > 0 && launcher.serverProgress < 1 && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${Math.round(launcher.serverProgress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {tab === 'Overview' && (
                <div className="flex max-w-2xl flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1.5 text-sm">
                      Name
                      <Input value={name} onChange={setName} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm">
                      View distance
                      <Input
                        type="number"
                        value={viewDistance}
                        onChange={setViewDistance}
                      />
                    </label>
                  </div>
                  <div className="flex gap-6">
                    <Checkbox
                      checked={onlineMode}
                      onCheckedChange={setOnlineMode}
                      label="Online mode"
                    />
                    <Checkbox
                      checked={managedJava}
                      onCheckedChange={setManagedJava}
                      label="Managed Java"
                    />
                  </div>
                  <label className="flex flex-col gap-1.5 text-sm">
                    Java flags (one argument per line)
                    <textarea
                      value={javaFlags}
                      onChange={(event) => setJavaFlags(event.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <div>
                    <Button size="sm" onClick={saveSettings} disabled={launcher.serverBusy}>
                      Save settings
                    </Button>
                  </div>

                  <div className="mt-4 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold text-foreground">
                      server.properties
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved changes apply next time the server starts.
                    </p>
                    <textarea
                      value={properties}
                      onChange={(event) => setProperties(event.target.value)}
                      rows={10}
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      disabled={launcher.serverBusy}
                      onClick={() =>
                        void strataApi
                          .request('servers.saveProperties', {
                            id: selected.id,
                            contents: properties,
                          })
                          .catch(() => undefined)
                      }
                    >
                      Save properties
                    </Button>
                  </div>
                </div>
              )}

              {tab === 'Console' && (
                <div className="flex h-full min-h-0 flex-col gap-3">
                  {launcher.serverResourceStatus.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {launcher.serverResourceStatus}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      aria-label="Start server"
                      title="Start"
                      disabled={selected.running || launcher.serverBusy}
                      onClick={() => startServer(selected)}
                    >
                      <Icon name="play_arrow" size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      aria-label="Stop server"
                      title="Stop"
                      disabled={!selected.running || launcher.serverBusy}
                      onClick={() =>
                        void strataApi
                          .request('servers.stop', { id: selected.id })
                          .catch(() => undefined)
                      }
                    >
                      <Icon name="stop" size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Terminate server"
                      title="Terminate"
                      disabled={!selected.running}
                      onClick={() => setTerminateOpen(true)}
                    >
                      <Icon name="bolt" size={18} />
                    </Button>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30">
                    <ServerConsole text={launcher.serverConsoleText} />
                    <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-3 py-2">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        &gt;
                      </span>
                      <Input
                        value={command}
                        onChange={setCommand}
                        placeholder="Enter command"
                        className="h-8 flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            sendCommand();
                          }
                        }}
                      />
                      <Button size="sm" variant="secondary" onClick={sendCommand}>
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'Content' && contentCapable && (
                <div className="grid h-full min-h-0 grid-cols-2 gap-4">
                  <div className="flex min-h-0 flex-col gap-2">
                    <div className="flex gap-2">
                      <Input
                        value={contentQuery}
                        onChange={setContentQuery}
                        placeholder="Search Modrinth"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            searchContent();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={launcher.serverContentBusy}
                        onClick={() => searchContent()}
                      >
                        Search
                      </Button>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                      {launcher.serverContentProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setContentProjectId(project.id);
                            setContentVersionId('');
                            void strataApi
                              .request('servers.loadContentVersions', {
                                id: selected.id,
                                projectId: project.id,
                              })
                              .catch(() => undefined);
                          }}
                          className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-left transition-colors ${
                            contentProjectId === project.id
                              ? 'border-primary/60 bg-accent/60'
                              : 'border-border bg-card/70 hover:border-primary/40'
                          }`}
                        >
                          <span className="text-sm font-medium text-foreground">
                            {project.title}
                          </span>
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {project.description}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {project.downloads.toLocaleString()} downloads
                          </span>
                        </button>
                      ))}
                      {launcher.serverContentProjects.length === 0 &&
                        !launcher.serverContentBusy && (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            Search Modrinth for plugins and content.
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-col gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Versions</h3>
                    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                      {contentProjectId.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          Select a project to see its versions.
                        </p>
                      ) : launcher.serverContentVersions.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          {launcher.serverContentBusy
                            ? 'Loading versions…'
                            : 'No compatible versions found.'}
                        </p>
                      ) : (
                        launcher.serverContentVersions.map((version) => (
                          <button
                            key={version.id}
                            onClick={() => setContentVersionId(version.id)}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                              contentVersionId === version.id
                                ? 'border-primary/60 bg-accent/60'
                                : 'border-border bg-card/70 hover:border-primary/40'
                            }`}
                          >
                            <span className="text-sm text-foreground">
                              {version.versionNumber}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    {contentProjectId.length > 0 && (
                      <Button
                        size="sm"
                        className="self-start"
                        disabled={
                          contentVersionId.length === 0 || launcher.serverContentBusy
                        }
                        onClick={installContent}
                      >
                        Install selected
                      </Button>
                    )}
                    {launcher.serverContentStatus.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {launcher.serverContentStatus}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {tab === 'Dangerous' && (
                <div className="flex max-w-xl flex-col gap-3">
                  <h3 className="font-display text-lg font-semibold text-destructive">
                    Dangerous server actions
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Repair replaces the server JAR. Deleting permanently removes this
                    server and its data.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={launcher.serverBusy}
                      onClick={() =>
                        void strataApi
                          .request('servers.install', { id: selected.id })
                          .catch(() => undefined)
                      }
                    >
                      Repair server
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={launcher.serverBusy}
                      onClick={() =>
                        void strataApi
                          .request('servers.installRuntime', { id: selected.id })
                          .catch(() => undefined)
                      }
                    >
                      Install managed Java
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      Delete server
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ServerCreateDialog
        open={createOpen}
        versions={launcher.versions}
        latestRelease={launcher.latestRelease}
        busy={launcher.serverBusy}
        onClose={() => setCreateOpen(false)}
      />
      <ConfirmDialog
        open={terminateOpen}
        title="Terminate server"
        body="Terminate the server immediately? Unsaved world data may be lost."
        confirmLabel="Terminate"
        onConfirm={() => {
          if (selected !== null) {
            void strataApi
              .request('servers.terminate', { id: selected.id })
              .catch(() => undefined);
          }
          setTerminateOpen(false);
        }}
        onClose={() => setTerminateOpen(false)}
      />
      <Flyout
        open={eulaOpen}
        onClose={() => setEulaOpen(false)}
        label="Minecraft EULA"
        widthClass="max-w-[480px]"
        heightClass="h-auto"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Minecraft EULA
          </h2>
          <p className="text-sm text-muted-foreground">
            To start this server, you must agree to Mojang&apos;s End User License
            Agreement (
            <a
              className="text-primary underline"
              href="https://www.minecraft.net/en-us/eula"
              onClick={(event) => {
                event.preventDefault();
                void strataApi
                  .request('shell.openExternal', {
                    url: 'https://www.minecraft.net/en-us/eula',
                  })
                  .catch(() => undefined);
              }}
            >
              here
            </a>
            ).
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEulaOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={acceptEulaAndStart}>
              Accept
            </Button>
          </div>
        </div>
      </Flyout>
      <DeleteServerDialog
        open={deleteOpen}
        serverName={selected?.name ?? ''}
        busy={launcher.serverBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </motion.div>
  );
}
