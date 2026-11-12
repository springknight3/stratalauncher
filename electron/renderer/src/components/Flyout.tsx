import type { ReactNode } from 'react';

import {
  CenterMorphModal,
  CenterMorphModalContent,
} from '@/components/motion/center-morph-modal';
import { cn } from '@/lib/utils';

interface FlyoutProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  // QML parity: account flyout ~620px wide / 560px tall, instance settings
  // ~960px wide / 680px tall.
  widthClass?: string;
  heightClass?: string;
}

// Shared in-window flyout shell built on beUI CenterMorphModal: backdrop,
// clip-path unfold from center, focus trap, Escape/backdrop dismissal,
// built-in close button — mounted once per flyout and toggled via `open`.
export default function Flyout({
  open,
  onClose,
  label,
  children,
  widthClass = 'max-w-[620px]',
  heightClass = 'h-[min(560px,calc(100dvh-8rem))]',
}: FlyoutProps) {
  return (
    <CenterMorphModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <CenterMorphModalContent
        ariaLabel={label}
        // Our flyouts render their own header "Close" button (QML parity);
        // the built-in corner ✕ would overlap it.
        showCloseButton={false}
        className={cn(
          'flex flex-col overflow-hidden rounded-lg border border-border bg-card/90 backdrop-blur-md',
          widthClass,
          heightClass,
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </CenterMorphModalContent>
    </CenterMorphModal>
  );
}
