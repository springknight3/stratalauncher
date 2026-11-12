import type { ToastInput } from '@/components/motion/animated-toast-stack';

// Tiny bridge between app code and the mounted <AppToaster/>: components call
// toast() without prop-drilling; the toaster registers its showToast on mount.
let shower: ((input: ToastInput) => string) | null = null;

export function registerToaster(fn: (input: ToastInput) => string): void {
  shower = fn;
}

export function toast(input: ToastInput): string | undefined {
  return shower?.(input);
}
