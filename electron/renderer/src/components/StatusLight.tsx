import { useAppReducedMotion } from '../hooks/useAppReducedMotion';

// Mirrors cpp/legacy-qml/StatusLight.qml:
//   stopped  -> grey #70819c, static
//   starting -> blue #56a9ff, static
//   ready    -> green #46d482, expanding pulse ring + opacity blink
//   crashed  -> red #ff6b6b, hard blink
// Looping animations are CSS keyframes (index.css) so the repeat boundary
// never renders a stray full-opacity frame; reduced motion renders statics.
export type StatusLightState = 'stopped' | 'starting' | 'ready' | 'crashed';

const COLORS: Record<StatusLightState, string> = {
  stopped: '#70819c',
  starting: '#56a9ff',
  ready: '#46d482',
  crashed: '#ff6b6b',
};

interface StatusLightProps {
  status: StatusLightState;
  size?: number;
  className?: string;
}

export default function StatusLight({ status, size = 12, className }: StatusLightProps) {
  const reduceMotion = useAppReducedMotion();
  const animate = !reduceMotion;
  const color = COLORS[status];
  const dotClass =
    status === 'ready' && animate
      ? 'strata-status-breathe'
      : status === 'crashed' && animate
        ? 'strata-status-blink'
        : '';

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className ?? ''}`}
      style={{ width: size * 2.8, height: size * 2.8 }}
      role="img"
      aria-label={`Status: ${status}`}
    >
      {status === 'ready' && animate && (
        <span
          aria-hidden
          className="strata-status-pulse absolute rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
        />
      )}
      <span
        aria-hidden
        className={`absolute rounded-full ${dotClass}`}
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      />
    </span>
  );
}
