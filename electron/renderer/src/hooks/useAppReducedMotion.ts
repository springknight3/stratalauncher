import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

import { useAppearanceStore } from '../stores/appearance';

// Combined reduce-motion flag: OS-level preference (framer-motion) OR the
// persisted ThemeSettings.reduceMotion toggle.
export function useAppReducedMotion(): boolean {
  const systemReduced = useFramerReducedMotion();
  const persisted = useAppearanceStore((state) => state.reduceMotion);
  return systemReduced === true || persisted;
}
