import { motion } from 'framer-motion';

import { Button } from '@/components/motion/button/base';
import StatusLight, { type StatusLightState } from './StatusLight';
import Icon from './Icon';
import type { InstanceInfo } from '../lib/launcher';
import { durations, motionEase } from '../theme/motion';

const STATUS_MAP: Record<string, StatusLightState> = {
  starting: 'starting',
  ready: 'ready',
  crashed: 'crashed',
  stopped: 'stopped',
};

interface InstanceCardProps {
  instance: InstanceInfo;
  selected: boolean;
  onSelect: () => void;
  onLaunchToggle: () => void;
  onOpenConsole: () => void;
  onSettings: () => void;
  onDelete: () => void;
}

export default function InstanceCard({
  instance,
  selected,
  onSelect,
  onLaunchToggle,
  onOpenConsole,
  onSettings,
  onDelete,
}: InstanceCardProps) {
  const running = instance.status === 'starting' || instance.status === 'ready';
  const light = STATUS_MAP[instance.status] ?? 'stopped';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: durations.fast, ease: motionEase('standard') }}
      onClick={onSelect}
      className={`flex h-[92px] cursor-pointer items-center gap-3 rounded-2xl border px-4 transition-colors ${
        selected
          ? 'border-primary/60 bg-accent/60 backdrop-blur-sm'
          : 'border-border bg-card/70 backdrop-blur-sm hover:border-primary/40 hover:bg-accent/30'
      }`}
    >
      <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        <Button
          size="sm"
          variant={running ? 'secondary' : 'primary'}
          onClick={onLaunchToggle}
        >
          <Icon name={running ? 'stop' : 'play_arrow'} size={16} />
          {running ? 'Stop' : 'Launch'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenConsole}>
          <Icon name="terminal" size={16} />
          Console
        </Button>
        <Button size="sm" variant="ghost" onClick={onSettings}>
          <Icon name="settings" size={16} />
          Settings
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Icon name="delete" size={16} />
        </Button>
      </div>
      <div className="flex flex-1 flex-col items-end">
        <span className="w-full truncate text-right font-display text-xl text-foreground">
          {instance.name}
        </span>
        <span className="w-full truncate text-right text-sm text-muted-foreground">
          Minecraft {instance.version}
          {instance.runtimeMode !== 'SYSTEM' && instance.runtimeComponent.length > 0
            ? ` · ${instance.runtimeMode}`
            : ''}
        </span>
      </div>
      <StatusLight status={light} size={12} />
    </motion.div>
  );
}
