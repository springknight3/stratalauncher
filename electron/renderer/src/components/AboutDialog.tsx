import { Button } from '@/components/motion/button/base';
import { MorphingModal } from '@/components/motion/morphing-modal';
import { useConnectionStore } from '../stores/connection';

const WARNING_TEXT =
  'This is a hobby project and not meant to replace anything! May contain security issues and flaws! Not affiliated with Mojang Studios, Microsoft, or any other official platform partner.';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

// About presented as an in-window morphing modal, rendered at layout level
// outside the page-transition AnimatePresence.
export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  const status = useConnectionStore((state) => state.status);
  const version = status.state === 'connected' ? status.version : 'unknown';

  return (
    <MorphingModal
      viewId={open ? 'about' : null}
      onClose={onClose}
      placement="center"
      ariaLabel="About StrataLauncher"
      className="max-w-lg rounded-2xl border-border bg-card/90 backdrop-blur-md"
    >
      <div className="flex flex-col gap-4 text-foreground">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-semibold">About StrataLauncher</h2>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm leading-relaxed">{WARNING_TEXT}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Minecraft is a trademark of Mojang Studios.
        </p>
        <p className="text-sm text-muted-foreground">Version {version}</p>
      </div>
    </MorphingModal>
  );
}
