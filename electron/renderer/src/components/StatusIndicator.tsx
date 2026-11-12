import StatusLight, { type StatusLightState } from './StatusLight';
import { useConnectionStore } from '../stores/connection';

const STATUS_MAP: Record<string, StatusLightState> = {
  starting: 'starting',
  connected: 'ready',
  error: 'crashed',
};

// Light + short label; used on the Home page. The sidebar shows the bare
// StatusLight next to the logo (see AppLayout).
export default function StatusIndicator() {
  const status = useConnectionStore((state) => state.status);

  const light = STATUS_MAP[status.state] ?? 'stopped';
  const label =
    status.state === 'connected'
      ? `Connected to strata-core v${status.version}`
      : status.state === 'error'
        ? `Core error: ${status.message}`
        : 'Connecting to strata-core…';

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <StatusLight status={light} size={9} />
      <span className="max-w-72 truncate" title={label}>
        {label}
      </span>
    </div>
  );
}
