import { useCallback, useState, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import { TooltipProvider } from '@/components/motion/tooltip';
import AppLayout from './components/AppLayout';
import FrameTimeOverlay from './components/FrameTimeOverlay';
import StartupOverlay from './components/StartupOverlay';
import { useAppReducedMotion } from './hooks/useAppReducedMotion';
import { useCoreConnection } from './hooks/useCoreConnection';
import { durations, motionEase } from './theme/motion';
import { useConnectionStore } from './stores/connection';
import { useUiStore } from './stores/ui';
import ContentPage from './pages/ContentPage';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import ServersPage from './pages/ServersPage';

function StartupGate({ children }: { children: ReactNode }) {
  const status = useConnectionStore((state) => state.status);
  const reduceMotion = useAppReducedMotion();
  const setBooted = useUiStore((state) => state.setBooted);
  const [visible, setVisible] = useState(true);

  const coreStatus =
    status.state === 'connected' ? 'ready' : status.state === 'error' ? 'error' : 'starting';

  const handleFinished = useCallback(() => {
    setVisible(false);
    setBooted(true);
  }, [setBooted]);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="startup"
            exit={{ opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: durations.fast, ease: motionEase('express') }
            }
          >
            <StartupOverlay coreStatus={coreStatus} onFinished={handleFinished} />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}

export default function App() {
  useCoreConnection();

  return (
    <TooltipProvider>
      <StartupGate>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="instances" element={<InstancesPage />} />
            <Route path="servers" element={<ServersPage />} />
            <Route path="content" element={<ContentPage />} />
          </Route>
          <Route path="*" element={<HomePage />} />
        </Routes>
        <FrameTimeOverlay />
      </StartupGate>
    </TooltipProvider>
  );
}
