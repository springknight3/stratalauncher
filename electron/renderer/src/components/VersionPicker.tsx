import { useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/motion/input';
import Icon from './Icon';
import { cn } from '@/lib/utils';

export interface PickerOption {
  id: string;
  label: string;
}

interface VersionPickerProps {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}

const MAX_RESULTS = 50;

// Searchable picker for large option lists (Minecraft versions, loader
// versions). The beUI Select renders every item and freezes on ~800-entry
// manifests, so this filters client-side and caps rendered rows.
export default function VersionPicker({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  emptyText = 'No matches.',
}: VersionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.id === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches =
      needle.length === 0
        ? options
        : options.filter(
            (option) =>
              option.id.toLowerCase().includes(needle) ||
              option.label.toLowerCase().includes(needle),
          );
    return matches.slice(0, MAX_RESULTS);
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Focus after the panel mounts.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm text-foreground outline-none transition-colors',
          'hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        <span className={cn('truncate', selected === undefined && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <Icon name="arrow_drop_down" size={16} className="shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close picker"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-72 flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <div className="border-b border-border p-2">
              <Input
                ref={searchRef}
                value={query}
                onChange={setQuery}
                placeholder="Filter…"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setOpen(false);
                  } else if (event.key === 'Enter' && filtered.length > 0) {
                    choose(filtered[0].id);
                  }
                }}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {emptyText}
                </p>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choose(option.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                      option.id === value
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/60',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.id === value && (
                      <Icon name="check" size={14} className="shrink-0" />
                    )}
                  </button>
                ))
              )}
              {options.length > MAX_RESULTS && filtered.length === MAX_RESULTS && (
                <p className="px-3 py-1 text-center text-[10px] text-muted-foreground">
                  Showing first {MAX_RESULTS} — type to filter.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
