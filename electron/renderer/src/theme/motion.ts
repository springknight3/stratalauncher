import type { Easing, Transition, Variants } from 'framer-motion';

// Motion tokens mirroring CURVES.md / legacy Motion.qml. Durations in seconds
// (Framer Motion units); the QML values were 140/260/420 ms.
export const easeCurves = {
  standard: [0.25, 0.1, 0.25, 1],
  emphasis: [0.22, 1, 0.36, 1],
  express: [0.2, 0.8, 0.2, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EaseName = keyof typeof easeCurves;

export const durations = {
  fast: 0.14,
  normal: 0.26,
  slow: 0.42,
} as const;

export type DurationName = keyof typeof durations;

export function motionEase(name: EaseName): Easing {
  const curve = easeCurves[name];
  return [curve[0], curve[1], curve[2], curve[3]];
}

export function motionTransition(
  curve: EaseName = 'standard',
  durationName: DurationName = 'normal',
): Transition {
  return { duration: durations[durationName], ease: motionEase(curve) };
}

// Page transition: crossfade + slight horizontal translation.
export const pageVariants: Variants = {
  initial: { opacity: 0, x: 14 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: durations.normal, ease: motionEase('standard') },
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: { duration: durations.fast, ease: motionEase('express') },
  },
};

// Staggered element fade + move used inside pages.
export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.normal, ease: motionEase('standard') },
  },
};
