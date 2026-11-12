import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '@/components/motion/button/base';
import { Tooltip } from '@/components/motion/tooltip';
import { ShaderBackground } from '@/components/motion/shader-background';

import { useAppReducedMotion } from '../hooks/useAppReducedMotion';
import { pageVariants } from '../theme/motion';
import { useAppearanceStore } from '../stores/appearance';
import { useConnectionStore } from '../stores/connection';
import StatusLight, { type StatusLightState } from './StatusLight';
import Icon from './Icon';
import AccountsFlyout from './AccountsFlyout';
import AboutDialog from './AboutDialog';
import SettingsDialog from './SettingsDialog';
import CommandPaletteMount from './CommandPaletteMount';
import Toaster from './Toaster';
import { useLauncherStore } from '../stores/launcher';
import { useUiStore } from '../stores/ui';
import { useCoreErrorToasts } from '../hooks/useCoreErrorToasts';

const CORE_LIGHT: Record<string, StatusLightState> = {
  starting: 'starting',
  connected: 'ready',
  error: 'crashed',
};

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  // Dialog actions open an in-window flyout instead of navigating.
  action?: 'settings' | 'about';
}

// Icon names are Material Symbols ligatures.
const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/instances', label: 'Instances', icon: 'sports_esports' },
  { to: '/content', label: 'Content', icon: 'download' },
  { to: '/servers', label: 'Servers', icon: 'dns' },
  { to: '', label: 'Settings', icon: 'settings', action: 'settings' },
  { to: '', label: 'About', icon: 'info', action: 'about' },
];

function NavButton({ item }: { item: NavItem }) {
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);
  const content = (
    <>
      <span>
        <Icon name={item.icon} size={18} />
      </span>
      <span className="text-muted-foreground">{item.label}</span>
    </>
  );
  if (item.action === 'settings' || item.action === 'about') {
    return (
      <button
        type="button"
        onClick={() =>
          item.action === 'settings' ? setSettingsOpen(true) : setAboutOpen(true)
        }
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/60"
      >
        {content}
      </button>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className="relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active-pill"
              className="absolute inset-0 rounded-lg bg-accent"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative">
            <Icon name={item.icon} size={18} />
          </span>
          <span
            className={`relative ${
              isActive ? 'text-accent-foreground' : 'text-muted-foreground'
            }`}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const reduceMotion = useAppReducedMotion();
  const theme = useAppearanceStore((state) => state.theme);
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const coreStatus = useConnectionStore((state) => state.status);
  // Selective subscription: the launcher snapshot updates at console-event
  // rates, so only the account label may trigger a layout re-render.
  const activeAccountName = useLauncherStore(
    (state) => state.state?.activeAccountName,
  );
  const [accountsOpen, setAccountsOpen] = useState(false);
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const aboutOpen = useUiStore((state) => state.aboutOpen);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);
  useCoreErrorToasts();

  const warpColors =
    theme === 'dark'
      ? ['#1b2a4a', '#274060', '#3b2f63', '#173a4a']
      : ['#dbe7ff', '#eef2ff', '#f5e9ff', '#e0f2fe'];

  return (
    <div className="relative flex h-full">
      {/* Global warp-shader backdrop behind all content (reduced-motion
          freezes it via the component's own speed=0 handling). */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <ShaderBackground
          variant="warp"
          colors={warpColors}
          shape="edge"
          distortion={0.45}
          swirl={0.35}
          swirlIterations={4}
          speed={0.4}
        />
      </div>
      <aside className="relative flex w-56 shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur-md">
        <div className="flex items-center gap-2 px-5 pb-4 pt-5">
          <span className="font-display text-base font-semibold tracking-wide">
            StrataLauncher
          </span>
          <Tooltip
            content={
              coreStatus.state === 'connected'
                ? `Connected to strata-core v${coreStatus.version}`
                : coreStatus.state === 'error'
                  ? `Core error: ${coreStatus.message}`
                  : 'Connecting to strata-core…'
            }
          >
            <StatusLight
              status={CORE_LIGHT[coreStatus.state] ?? 'stopped'}
              size={8}
            />
          </Tooltip>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.to} item={item} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAccountsOpen(true)}
            className="justify-start text-muted-foreground hover:text-foreground"
          >
            <Icon name="person_add" size={16} />
            <span className="truncate">
              {typeof activeAccountName === 'string' && activeAccountName.length > 0
                ? `Account: ${activeAccountName}`
                : 'Select account'}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="justify-start text-muted-foreground hover:text-foreground"
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={16} />
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </Button>
        </div>
        <AccountsFlyout open={accountsOpen} onClose={() => setAccountsOpen(false)} />
        <CommandPaletteMount onOpenAccounts={() => setAccountsOpen(true)} />
        <Toaster />
      </aside>
      {/* overflow-x-hidden clips the page-transition translate so it cannot
          spawn a transient horizontal scrollbar; vertical scroll unaffected. */}
      <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial={reduceMotion ? false : 'initial'}
            animate="animate"
            exit={reduceMotion ? undefined : 'exit'}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Modal-route dialogs live outside the page transition so their
          portals never participate in page exit/enter. */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
