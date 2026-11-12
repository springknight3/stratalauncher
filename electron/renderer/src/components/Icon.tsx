import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface IconProps extends Omit<ComponentProps<'span'>, 'children'> {
  /** Material Symbols ligature name, e.g. "close", "settings", "dark_mode". */
  name: string;
  /** Glyph size in px (default 20). */
  size?: number;
  /** Fill the glyph (active/selected states). */
  filled?: boolean;
}

// Material Symbols Rounded icon rendered as a ligature. The bundled variable
// font supports FILL/wght/opsz axes; `size` maps to the opsz axis.
export default function Icon({
  name,
  size = 20,
  filled = false,
  className,
  style,
  ...rest
}: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('material-symbols-rounded', className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
      {...rest}
    >
      {name}
    </span>
  );
}
