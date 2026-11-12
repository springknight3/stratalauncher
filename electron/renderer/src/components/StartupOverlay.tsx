import { useEffect, useRef } from 'react';

import { animate, stagger } from 'animejs';

import { Loader } from '@/components/motion/loader';
import { useAppReducedMotion } from '../hooks/useAppReducedMotion';

const WARNING_TEXT =
  'This is a hobby project and not meant to replace anything! May contain security issues and flaws! Not affiliated with Mojang Studios, Microsoft, or any other official platform partner.';

interface StartupOverlayProps {
  // Core version once connected; the overlay stays up until BOTH the minimum
  // duration has elapsed and the core reports a terminal startup status.
  coreStatus: 'starting' | 'ready' | 'error';
  onFinished: () => void;
}

const MINIMUM_VISIBLE_MS = 3000;

// Startup sequence: STRATA logo, product line, hobby warning, copyright.
// Anime.js owns the entrance timeline (imperative, non-React-managed DOM is
// not required here — targets are plain elements rendered once); the exit
// fade is handled by the parent's AnimatePresence.
export default function StartupOverlay({ coreStatus, onFinished }: StartupOverlayProps) {
  const reduceMotion = useAppReducedMotion();
  const finishedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const coreSettled = coreStatus !== 'starting';
      if (!finishedRef.current && elapsed >= MINIMUM_VISIBLE_MS && coreSettled) {
        finishedRef.current = true;
        window.clearInterval(timer);
        onFinished();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [coreStatus, onFinished]);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null || reduceMotion) {
      return;
    }
    const targets = root.querySelectorAll<HTMLElement>('[data-startup-item]');
    const logo = root.querySelector<HTMLElement>('[data-startup-logo]');
    const animations: Array<ReturnType<typeof animate>> = [];
    if (logo !== null) {
      animations.push(
        animate(logo, {
          opacity: [0, 1],
          scale: [0.92, 1],
          duration: 700,
          ease: 'outExpo',
        }),
      );
    }
    animations.push(
      animate(targets, {
        opacity: [0, 1],
        translateY: [12, 0],
        delay: stagger(90, { start: 250 }),
        duration: 600,
        ease: 'outExpo',
      }),
    );
    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
    // Entrance plays once on mount; reduce-motion skips it entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      role="status"
      aria-label="StrataLauncher starting"
    >
      <div className="flex w-full max-w-xl flex-col items-center gap-3 px-9 py-9 text-center">
        <div
          data-startup-logo
          className="font-display text-6xl font-bold tracking-[0.35em] text-foreground"
          style={{ opacity: reduceMotion ? 1 : 0 }}
        >
          STRATA
        </div>
        <div
          data-startup-item
          className="text-xs font-medium uppercase tracking-[0.5em] text-primary"
          style={{ opacity: reduceMotion ? 1 : 0 }}
        >
          Minecraft Launcher
        </div>
        <p
          data-startup-item
          className="mt-6 max-w-md text-sm leading-relaxed text-amber-300/90"
          style={{ opacity: reduceMotion ? 1 : 0 }}
        >
          {WARNING_TEXT}
        </p>
        <p
          data-startup-item
          className="mt-2 text-xs text-muted-foreground"
          style={{ opacity: reduceMotion ? 1 : 0 }}
        >
          Minecraft is a trademark of Mojang Studios.
        </p>
        <Loader
          variant="dot-matrix"
          size={28}
          label={coreStatus === 'error' ? 'Startup failed' : 'Starting StrataLauncher'}
        />
        {coreStatus === 'error' && (
          <p data-startup-item className="mt-4 text-xs text-destructive">
            Core failed to start — see the status indicator after launch.
          </p>
        )}
      </div>
    </div>
  );
}
