import { AnimatePresence, motion } from 'framer-motion';

import { Loader } from '@/components/motion/loader';
import { useAppReducedMotion } from '../hooks/useAppReducedMotion';
import { useLauncherSnapshot } from '../lib/launcher';
import { durations, motionEase } from '../theme/motion';

// Parity with the QML install overlay: dimmed backdrop, centered white
// header "Installing <name>...", animated progress bar, small gray
// "Downloading: <item>" / "Preparing downloads..." line.
export default function InstallOverlay() {
  const launcher = useLauncherSnapshot();
  const reduceMotion = useAppReducedMotion();

  return (
    <AnimatePresence>
      {launcher.installing && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : durations.normal }}
        >
          <div className="flex w-[min(72vw,560px)] flex-col items-center gap-5">
            <h2 className="text-center font-display text-3xl font-semibold text-white">
              Installing {launcher.currentInstallName}...
            </h2>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${Math.round(launcher.installationProgress * 100)}%` }}
                transition={{ duration: durations.normal, ease: motionEase('standard') }}
              />
            </div>
            <p className="flex items-center justify-center gap-2 text-center text-sm text-slate-300">
              {launcher.currentInstallItem.length > 0 ? (
                `Downloading: ${launcher.currentInstallItem}`
              ) : (
                <>
                  <Loader variant="dot-matrix" size={16} />
                  Preparing downloads...
                </>
              )}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
