import { useEffect, useRef } from 'react';

import { useLauncherStore } from '../stores/launcher';
import { toast } from '../lib/toast';

// Surfaces core-reported errors as bottom-center toasts. The launcher
// snapshot's errorMessage is sticky (stays until the next operation), so we
// toast only when the value actually changes to a new non-empty string.
export function useCoreErrorToasts(): void {
  const errorMessage = useLauncherStore((state) => state.state?.errorMessage);
  const lastToasted = useRef('');

  useEffect(() => {
    if (
      typeof errorMessage === 'string' &&
      errorMessage.length > 0 &&
      errorMessage !== lastToasted.current
    ) {
      lastToasted.current = errorMessage;
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 6000,
      });
    } else if (typeof errorMessage === 'string' && errorMessage.length === 0) {
      // Core cleared the error — allow the same message to toast again later.
      lastToasted.current = '';
    }
  }, [errorMessage]);
}
