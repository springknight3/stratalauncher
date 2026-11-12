import { useEffect } from 'react';

import {
  AnimatedToastStack,
  useAnimatedToastStack,
} from '@/components/motion/animated-toast-stack';
import { registerToaster } from '../lib/toast';

// Bottom-center notification stack (beUI animated-toast-stack). App code calls
// toast() from lib/toast.ts; this component owns the animated state.
export default function Toaster() {
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({
    defaultDuration: 4200,
  });

  useEffect(() => {
    registerToaster(showToast);
    return () => registerToaster(() => '');
  }, [showToast]);

  return (
    <AnimatedToastStack
      toasts={toasts}
      onDismiss={dismissToast}
      position="bottom-center"
      fixed
    />
  );
}
