import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { CommandPalette, type CommandItem } from '@/components/motion/command-palette';
import Icon from './Icon';
import { useAppearanceStore } from '../stores/appearance';
import { useUiStore } from '../stores/ui';
import { useContentStore } from '../stores/content';
import { useLauncherStore } from '../stores/launcher';
import { parseContentSnapshot } from '../lib/content';
import { parseLauncherSnapshot } from '../lib/launcher';
import {
  buildDynamicSearchDocuments,
  searchDocuments,
  updateSearchIndex,
  type SearchDocument,
} from '../lib/search';

interface CommandPaletteMountProps {
  onOpenAccounts: () => void;
}

const icon = (name: string) => <Icon name={name} size={16} />;

const toCommandItem = (doc: SearchDocument): CommandItem => ({
  id: `search:${doc.id}`,
  label: doc.label,
  group: doc.group,
  icon: icon(doc.icon),
  hint: doc.hint,
  keywords: [],
  onSelect: doc.run,
});

// Ctrl+K quick actions + unified MiniSearch domain results (instances,
// servers, versions, runtimes, content, settings keys, accounts).
export default function CommandPaletteMount({ onOpenAccounts }: CommandPaletteMountProps) {
  const navigate = useNavigate();
  const theme = useAppearanceStore((state) => state.theme);
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const setCreateInstanceOpen = useUiStore((state) => state.setCreateInstanceOpen);
  const setImportInstanceOpen = useUiStore((state) => state.setImportInstanceOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const setSettingsTab = useUiStore((state) => state.setSettingsTab);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);
  const requestInstanceFocus = useUiStore((state) => state.requestInstanceFocus);
  const requestServerFocus = useUiStore((state) => state.requestServerFocus);

  // Raw snapshot objects only change when the core pushes an event, so the
  // parsed snapshots (and therefore the search index) rebuild on real changes
  // rather than every render.
  const launcherRaw = useLauncherStore((state) => state.state);
  const contentRaw = useContentStore((state) => state.state);
  const launcher = useMemo(() => parseLauncherSnapshot(launcherRaw), [launcherRaw]);
  const content = useMemo(() => parseContentSnapshot(contentRaw), [contentRaw]);

  const openSettings = useCallback(
    (tab: 'general' | 'runtimes' = 'general') => {
      setSettingsTab(tab);
      setSettingsOpen(true);
    },
    [setSettingsTab, setSettingsOpen],
  );

  const staticDocs = useMemo<SearchDocument[]>(() => {
    const go =
      (to: string) =>
      () =>
        navigate(to);
    const pages: Array<{ to: string; label: string; icon: string; keywords: string }> = [
      { to: '/', label: 'Go to Home', icon: 'home', keywords: 'home dashboard' },
      { to: '/instances', label: 'Go to Instances', icon: 'sports_esports', keywords: 'instances minecraft worlds' },
      { to: '/servers', label: 'Go to Servers', icon: 'dns', keywords: 'servers multiplayer' },
      { to: '/content', label: 'Go to Content', icon: 'package_2', keywords: 'content mods plugins datapacks modrinth' },
    ];
    const settingsKeys: Array<{
      label: string;
      keywords: string;
      tab: 'general' | 'runtimes';
    }> = [
      { label: 'Setting: Theme', keywords: 'theme dark light appearance', tab: 'general' },
      { label: 'Setting: Reduce motion', keywords: 'animation motion accessibility', tab: 'general' },
      { label: 'Setting: VSync', keywords: 'vsync vsyncEnabled diagnostics', tab: 'general' },
      { label: 'Setting: Frame time overlay', keywords: 'fps debug overlay performance', tab: 'general' },
      { label: 'Setting: Track instance launches', keywords: 'recent launches history', tab: 'general' },
      { label: 'Setting: Azure client ID', keywords: 'azure client id auth', tab: 'general' },
      { label: 'Setting: Global Java arguments', keywords: 'java flags jvm arguments globals', tab: 'general' },
      { label: 'Setting: Data directory', keywords: 'data dir storage location instances path', tab: 'general' },
      { label: 'Setting: Java runtime vendor', keywords: 'runtime vendor temurin zulu mojang java', tab: 'runtimes' },
      { label: 'Setting: Redundant runtimes', keywords: 'runtime redundancy separate copy java', tab: 'runtimes' },
      { label: 'Setting: Installed Java runtimes', keywords: 'runtimes java inventory delete', tab: 'runtimes' },
    ];
    return [
      ...pages.map((page) => ({
        id: `nav-${page.to}`,
        kind: 'command' as const,
        label: page.label,
        keywords: page.keywords,
        group: 'Navigate',
        icon: page.icon,
        run: go(page.to),
      })),
      {
        id: 'nav-settings',
        kind: 'command' as const,
        label: 'Open Settings',
        keywords: 'settings preferences options configuration',
        group: 'Navigate',
        icon: 'settings',
        run: () => openSettings('general'),
      },
      {
        id: 'nav-about',
        kind: 'command' as const,
        label: 'Open About',
        keywords: 'about version license copyright hobby warning',
        group: 'Navigate',
        icon: 'info',
        run: () => setAboutOpen(true),
      },
      {
        id: 'create-instance',
        kind: 'command' as const,
        label: 'Create instance',
        keywords: 'new add minecraft instance install',
        group: 'Actions',
        icon: 'add',
        run: () => {
          setCreateInstanceOpen(true);
          navigate('/instances');
        },
      },
      {
        id: 'import-instance',
        kind: 'command' as const,
        label: 'Import instance',
        keywords: 'import prism launcher curseforge modrinth sklauncher official',
        group: 'Actions',
        icon: 'download',
        run: () => {
          setImportInstanceOpen(true);
          navigate('/instances');
        },
      },
      {
        id: 'toggle-theme',
        kind: 'command' as const,
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        keywords: 'theme dark light appearance toggle',
        group: 'Actions',
        icon: theme === 'dark' ? 'light_mode' : 'dark_mode',
        run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'accounts',
        kind: 'command' as const,
        label: 'Accounts…',
        keywords: 'account sign in microsoft offline profile',
        group: 'Actions',
        icon: 'person',
        run: onOpenAccounts,
      },
      ...settingsKeys.map((entry) => ({
        id: `setting:${entry.label}`,
        kind: 'setting' as const,
        label: entry.label,
        keywords: entry.keywords,
        group: 'Settings',
        icon: 'tune',
        run: () => openSettings(entry.tab),
      })),
    ];
  }, [
    navigate,
    theme,
    setTheme,
    setCreateInstanceOpen,
    setImportInstanceOpen,
    setAboutOpen,
    openSettings,
    onOpenAccounts,
  ]);

  // Empty-query palette shows the static commands through the built-in
  // filtering path; `items` mirrors the static docs.
  const items = useMemo<CommandItem[]>(() => staticDocs.map(toCommandItem), [staticDocs]);

  const dynamicActions = useMemo(
    () => ({
      openInstance: (id: string) => {
        requestInstanceFocus(id);
        navigate('/instances');
      },
      openServer: (id: string) => {
        requestServerFocus(id);
        navigate('/servers');
      },
      openContent: () => navigate('/content'),
      openCreateInstance: () => {
        setCreateInstanceOpen(true);
        navigate('/instances');
      },
      openSettings: () => openSettings('general'),
      openAccounts: onOpenAccounts,
    }),
    [navigate, requestInstanceFocus, requestServerFocus, setCreateInstanceOpen, openSettings, onOpenAccounts],
  );

  const allDocs = useMemo(
    () => [...staticDocs, ...buildDynamicSearchDocuments(launcher, content, dynamicActions)],
    [staticDocs, launcher, content, dynamicActions],
  );

  useEffect(() => {
    updateSearchIndex(allDocs);
  }, [allDocs]);

  const searchResults = useCallback(
    (query: string) => {
      const hits = searchDocuments(query);
      if (hits.length === 0) {
        return [{ name: 'Search results', items: [] }];
      }
      const groups = new Map<string, CommandItem[]>();
      for (const doc of hits) {
        const list = groups.get(doc.group) ?? [];
        list.push(toCommandItem(doc));
        groups.set(doc.group, list);
      }
      return Array.from(groups.entries()).map(([name, groupItems]) => ({
        name,
        items: groupItems,
      }));
    },
    [],
  );

  return <CommandPalette items={items} searchResults={searchResults} />;
}
