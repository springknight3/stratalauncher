import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/motion/button/base';
import { staggerContainer, staggerItem } from '../theme/motion';
import { motion } from 'framer-motion';
import StatusIndicator from '../components/StatusIndicator';
import { useLauncherSnapshot } from '../lib/launcher';
import { strataApi } from '../lib/strata';

export default function HomePage() {
  const navigate = useNavigate();
  const launcher = useLauncherSnapshot();
  const recent = launcher.recentLaunchedInstances;

  const launchRecent = (instanceId: string) => {
    void strataApi.request('console.open', { instanceId }).catch(() => undefined);
    void strataApi.request('launch.instance', { instanceId }).catch(() => undefined);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="relative flex h-full flex-col items-center justify-center gap-6 p-8"
    >
      <motion.div
        variants={staggerItem}
        className="flex w-full max-w-3xl flex-col items-center gap-5 rounded-2xl border border-border bg-card/70 px-12 py-14 text-center backdrop-blur-md"
      >
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
          Stratalauncher
        </h1>
        <p className="max-w-xl text-base text-muted-foreground">
          Launch, manage, and organize your Minecraft instances from a single shell.
        </p>

        <div className="mt-2 flex w-full max-w-md flex-col gap-2">
          {recent.map((instance) => (
            <div
              key={instance.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3"
            >
              <span className="truncate font-display text-lg text-foreground">
                {instance.name}
              </span>
              <Button size="sm" onClick={() => launchRecent(instance.id)}>
                Launch
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          size="md"
          className="mt-2"
          onClick={() => navigate('/instances')}
        >
          Create instance
        </Button>

        <div className="mt-4">
          <StatusIndicator />
        </div>
      </motion.div>

      <motion.p
        variants={staggerItem}
        className="max-w-2xl text-center text-sm text-primary"
      >
        Stratalauncher is completely open source and free (as in free beer and free speech);
        visit the{' '}
        <a
          className="underline"
          href="https://github.com/springknight3/stratalauncher"
          onClick={(event) => {
            event.preventDefault();
            void strataApi.request('shell.openExternal', {
              url: 'https://github.com/springknight3/stratalauncher',
            });
          }}
        >
          source page
        </a>{' '}
        or{' '}
        <a
          className="underline"
          href="https://strata-web-alpha.vercel.app"
          onClick={(event) => {
            event.preventDefault();
            void strataApi.request('shell.openExternal', {
              url: 'https://strata-web-alpha.vercel.app',
            });
          }}
        >
          our website
        </a>
        .
      </motion.p>
    </motion.div>
  );
}
