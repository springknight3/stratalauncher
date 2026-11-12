import { useState } from 'react';

import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import Flyout from './Flyout';

interface DeleteInstanceDialogProps {
  open: boolean;
  instanceName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Typed DELETE confirmation for destructive actions (parity rule), presented
// in the shared center-morph flyout shell.
export default function DeleteInstanceDialog({
  open,
  instanceName,
  busy,
  onConfirm,
  onClose,
}: DeleteInstanceDialogProps) {
  const [confirmation, setConfirmation] = useState('');

  return (
    <Flyout
      open={open}
      onClose={onClose}
      label="Delete instance"
      widthClass="max-w-[440px]"
      heightClass="h-auto"
    >
      <div className="flex flex-col p-6">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-destructive">
            Delete instance
          </h2>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Deleting permanently removes{' '}
          <span className="text-foreground">{instanceName}</span> and its local files.
        </p>
        <Input
          className="mt-4"
          value={confirmation}
          onChange={setConfirmation}
          placeholder="Type DELETE to remove this instance"
          disabled={busy}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {busy ? 'Deleting instance…' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={confirmation !== 'DELETE' || busy}
              onClick={onConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete instance
            </Button>
          </div>
        </div>
      </div>
    </Flyout>
  );
}
