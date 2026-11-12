import { useEffect, useState } from 'react';

import { useAppearanceStore } from '../stores/appearance';

// Debug-only frame-time overlay; enabled via Settings → diagnostics
// (persisted core-side through ThemeSettings).
export default function FrameTimeOverlay() {
  const enabled = useAppearanceStore((state) => state.frameTimeOverlayEnabled);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frame += 1;
      if (now - last >= 500) {
        setFps(Math.round((frame * 1000) / (now - last)));
        frame = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) {
    return null;
  }
  return (
    <div className="pointer-events-none fixed bottom-2 right-2 z-50 rounded-md bg-black/70 px-2 py-1 font-mono text-xs text-white">
      {fps} fps
    </div>
  );
}
