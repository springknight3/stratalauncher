import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import { Pagination } from '@/components/motion/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import { staggerContainer, staggerItem } from '../theme/motion';
import Flyout from '../components/Flyout';
import { useContentSnapshot } from '../lib/content';
import { useLauncherSnapshot } from '../lib/launcher';
import { strataApi } from '../lib/strata';

const CONTENT_TYPES = [
  { id: 'MOD', label: 'Mods' },
  { id: 'RESOURCE_PACK', label: 'Resource packs' },
  { id: 'DATA_PACK', label: 'Data packs' },
  { id: 'SHADER', label: 'Shader packs' },
] as const;

export default function ContentPage() {
  const launcher = useLauncherSnapshot();
  const content = useContentSnapshot();

  const [instanceId, setInstanceId] = useState('');
  const [contentType, setContentType] = useState('MOD');
  const [worldName, setWorldName] = useState('');
  const [query, setQuery] = useState('');
  const [versionId, setVersionId] = useState('');

  const instances = launcher.instances;

  // Default target: first instance + Mods once instances are known.
  useEffect(() => {
    if (instanceId.length === 0 && instances.length > 0) {
      const first = instances[0].id;
      setInstanceId(first);
      void strataApi
        .request('content.selectTarget', { instanceId: first, contentType: 'MOD' })
        .catch(() => undefined);
    }
  }, [instances, instanceId]);

  const selectTarget = (nextInstance: string, nextType: string) => {
    setInstanceId(nextInstance);
    setContentType(nextType);
    setVersionId('');
    void strataApi
      .request('content.selectTarget', {
        instanceId: nextInstance,
        contentType: nextType,
      })
      .catch(() => undefined);
  };

  const search = (offset = 0) => {
    void strataApi
      .request('content.search', { query, offset })
      .catch(() => undefined);
  };

  const needsWorld = contentType === 'DATA_PACK' && content.worlds.length > 0;
  const page =
    content.pageSize > 0 ? Math.floor(content.pageOffset / content.pageSize) + 1 : 1;
  const pageCount = Math.max(1, Math.ceil(content.totalProjects / content.pageSize));

  const install = () => {
    if (versionId.length === 0) {
      return;
    }
    void strataApi
      .request('content.installSelected', {
        versionId,
        worldName: contentType === 'DATA_PACK' ? worldName : '',
      })
      .catch(() => undefined);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="flex h-full flex-col gap-4 p-6"
    >
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse Modrinth and manage compatible content for an instance.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={instanceId}
          onValueChange={(value) => selectTarget(value, contentType)}
          disabled={instances.length === 0}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Instance" />
          </SelectTrigger>
          <SelectContent>
            {instances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={contentType}
          onValueChange={(value) => selectTarget(instanceId, value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {CONTENT_TYPES.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {contentType === 'DATA_PACK' && content.worlds.length > 0 && (
          <Select value={worldName} onValueChange={setWorldName}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="World" />
            </SelectTrigger>
            <SelectContent>
              {content.worlds.map((world) => (
                <SelectItem key={world} value={world}>
                  {world}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={setQuery}
          placeholder="Search Modrinth projects"
          disabled={instanceId.length === 0 || content.loadingTarget}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              search();
            }
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={instanceId.length === 0 || content.loadingTarget}
          onClick={() => search()}
        >
          Search
        </Button>
        {content.totalProjects > 0 && (
          <Pagination
            totalPages={pageCount}
            page={page}
            onPageChange={(target) =>
              search(Math.max(0, (target - 1) * content.pageSize))
            }
            aria-label="Search result pages"
            className="ml-auto"
          />
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        {/* Project results */}
        <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card/70 backdrop-blur-md">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Projects
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {content.projects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {content.searching
                  ? 'Searching Modrinth...'
                  : 'Search for projects to browse results.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {content.projects.map((project) => (
                  <motion.button
                    key={project.id}
                    variants={staggerItem}
                    onClick={() => {
                      setVersionId('');
                      void strataApi
                        .request('content.loadVersions', { projectId: project.id })
                        .catch(() => undefined);
                    }}
                    className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                      content.selectedProjectId === project.id
                        ? 'border-primary/60 bg-accent/60'
                        : 'border-border bg-card/70 hover:border-primary/40 hover:bg-accent/30'
                    }`}
                  >
                    <span className="font-display text-base text-foreground">
                      {project.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {project.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {project.downloads.toLocaleString()} downloads
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Versions + installed */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card/70 backdrop-blur-md">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Versions
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {content.versions.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {content.loadingVersions
                    ? 'Loading versions...'
                    : 'Select a project to see its versions.'}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {content.versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => setVersionId(version.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                        versionId === version.id
                          ? 'border-primary/60 bg-accent/60'
                          : 'border-border bg-card/70 hover:border-primary/40'
                      }`}
                    >
                      <span className="text-sm text-foreground">
                        {version.versionNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {version.loaders.join(', ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-border p-3">
              <Button
                size="sm"
                className="w-full"
                disabled={
                  content.busy ||
                  versionId.length === 0 ||
                  (needsWorld && worldName.length === 0)
                }
                onClick={install}
              >
                {content.busy && content.installItem.length > 0
                  ? content.installItem
                  : 'Install selected'}
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card/70 backdrop-blur-md">
            <div className="border-b border-border px-4 py-3">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Installed content
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {content.installedContent.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No content installed in this category.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {content.installedContent.map((item, index) => (
                    <div
                      key={`${item.projectId}-${item.versionId}-${index}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card/70 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {item.title} · {item.versionNumber}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.filename}
                          {item.worldName.length > 0 ? ` · ${item.worldName}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={content.busy}
                        onClick={() =>
                          void strataApi
                            .request('content.setInstalledEnabled', {
                              index,
                              enabled: !item.enabled,
                            })
                            .catch(() => undefined)
                        }
                      >
                        {item.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={content.busy}
                        onClick={() =>
                          void strataApi
                            .request('content.removeInstalled', { index })
                            .catch(() => undefined)
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {content.statusMessage.length > 0 && (
        <p className="text-xs text-muted-foreground">{content.statusMessage}</p>
      )}
      {content.busy && content.installProgress > 0 && content.installProgress < 1 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${Math.round(content.installProgress * 100)}%` }}
          />
        </div>
      )}

      <DependencyDialog content={content} />
    </motion.div>
  );
}

function DependencyDialog({
  content,
}: {
  content: ReturnType<typeof useContentSnapshot>;
}) {
  return (
    <Flyout
      open={content.dependencyConfirmationVisible}
      onClose={() =>
        void strataApi.request('content.cancelDependencies').catch(() => undefined)
      }
      label="Install dependencies"
      widthClass="max-w-[480px]"
      heightClass="h-auto"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Install dependencies
        </h2>
        <p className="text-sm text-muted-foreground">
          This content requires additional projects:
        </p>
        <ul className="flex flex-col gap-1">
          {content.dependenciesToInstall.map((dependency, index) => (
            <li key={index} className="text-sm text-foreground">
              {dependency.title} · {dependency.versionNumber}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void strataApi
                .request('content.cancelDependencies')
                .catch(() => undefined)
            }
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void strataApi
                .request('content.confirmDependencies')
                .catch(() => undefined)
            }
          >
            Install
          </Button>
        </div>
      </div>
    </Flyout>
  );
}
