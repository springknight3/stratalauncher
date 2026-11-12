import { useEffect, useMemo, useRef, useState } from 'react';

import { MorphingModal } from '@/components/motion/morphing-modal';
import { Button } from '@/components/motion/button/base';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/motion/select';
import type { InstanceInfo } from '../lib/launcher';
import { strataApi } from '../lib/strata';

const VIEWPORT_LINES = 200;
const OVERSCAN = 20;

interface ConsolePanelProps {
  open: boolean;
  instances: InstanceInfo[];
  consoleText: string;
  consoleInstanceName: string;
  // Last instance id the UI asked the core to open; the core snapshot only
  // exposes the console's display name, so this disambiguates duplicate names.
  consoleInstanceId: string | null;
  onClose: () => void;
}

// Live console: slide+fade in from the bottom, virtualized line list with
// batched appends (the core already coalesces output into ~75 ms events),
// autoscroll while pinned to the bottom.
export default function ConsolePanel({
  open,
  instances,
  consoleText,
  consoleInstanceName,
  consoleInstanceId,
  onClose,
}: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(240);
  const pinnedRef = useRef(true);

  const lines = useMemo(() => (consoleText.length > 0 ? consoleText.split('\n') : []), [consoleText]);

  // Keep the view pinned to the newest output unless the user scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (el !== null && pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [consoleText]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) {
      return;
    }
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight));
    observer.observe(el);
    setViewportHeight(el.clientHeight);
    return () => observer.disconnect();
  }, [open]);

  const lineHeight = 18;
  const totalHeight = lines.length * lineHeight;
  const start = Math.max(0, Math.floor(scrollTop / lineHeight) - OVERSCAN);
  const end = Math.min(
    lines.length,
    Math.ceil((scrollTop + viewportHeight) / lineHeight) + OVERSCAN,
  );
  const visible = lines.slice(start, Math.min(end, start + VIEWPORT_LINES));

  const selectInstance = (instanceId: string) => {
    void strataApi.request('console.open', { instanceId }).catch(() => undefined);
  };

  return (
    <MorphingModal
      viewId={open ? 'console' : null}
      onClose={onClose}
      placement="bottom"
      ariaLabel="Instance console"
      className="max-w-4xl rounded-2xl border-border bg-card/90 backdrop-blur-md"
    >
      {/* -m-5 cancels the modal's built-in p-5 so the header rule and the
          console viewport reach the panel edges. */}
      <div className="-m-5 flex flex-col">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <Select
              value={
                consoleInstanceId ??
                instances.find((i) => i.name === consoleInstanceName)?.id ??
                ''
              }
              onValueChange={selectInstance}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select instance" />
              </SelectTrigger>
              <SelectContent>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="truncate text-sm text-muted-foreground">
              {consoleInstanceName.length > 0 ? consoleInstanceName : 'No console selected'}
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void strataApi.request('launch.stopConsole', {}).catch(() => undefined)
              }
            >
              Stop
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
          <div
            ref={scrollRef}
            className="relative h-80 overflow-auto font-mono text-xs leading-[18px] text-foreground/90"
            onScroll={(event) => {
              const el = event.currentTarget;
              setScrollTop(el.scrollTop);
              pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
          >
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  top: start * lineHeight,
                  left: 0,
                  right: 0,
                }}
              >
                {visible.map((line, index) => (
                  <div key={start + index} className="truncate px-3">
                    {line.length > 0 ? line : ' '}
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>
    </MorphingModal>
  );
}
