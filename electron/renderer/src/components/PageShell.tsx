import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

import { staggerContainer, staggerItem } from '../theme/motion';

interface PageShellProps {
  title: string;
  children?: ReactNode;
}

export default function PageShell({ title, children }: PageShellProps) {
  return (
    <motion.section
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-4xl p-8"
    >
      <motion.h1
        variants={staggerItem}
        className="font-display text-2xl font-semibold tracking-tight"
      >
        {title}
      </motion.h1>
      <motion.div
        variants={staggerItem}
        className="mt-4 rounded-xl border border-border bg-card p-6 text-muted-foreground"
      >
        {children ?? <p>This page is a placeholder pending its phase.</p>}
      </motion.div>
    </motion.section>
  );
}
