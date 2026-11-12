import { describe, expect, it } from 'vitest';

// Baseline import smoke test: every required package must resolve cleanly.
describe('baseline dependencies', () => {
  it('react and react-dom resolve', async () => {
    const react = await import('react');
    const reactDomClient = await import('react-dom/client');
    expect(react.createElement).toBeTypeOf('function');
    expect(reactDomClient.createRoot).toBeTypeOf('function');
  });

  it('react-router-dom resolves', async () => {
    const router = await import('react-router-dom');
    expect(router.MemoryRouter).toBeDefined();
    expect(router.Routes).toBeDefined();
    expect(router.Route).toBeDefined();
    expect(router.useNavigate).toBeDefined();
    expect(router.useParams).toBeDefined();
    expect(router.Link).toBeDefined();
    expect(router.BrowserRouter).toBeDefined();
  });

  it('clsx and tailwind-merge resolve', async () => {
    const { clsx } = await import('clsx');
    const { twMerge } = await import('tailwind-merge');
    expect(clsx('a', 'b')).toBe('a b');
    expect(twMerge('px-2', 'px-4')).toBe('px-4');
  });

  it('framer-motion resolves', async () => {
    const motion = await import('framer-motion');
    expect(motion.motion).toBeDefined();
    expect(motion.AnimatePresence).toBeDefined();
    expect(motion.LayoutGroup).toBeDefined();
    expect(motion.useReducedMotion).toBeTypeOf('function');
  });

  it('animejs resolves', async () => {
    const anime = await import('animejs');
    expect(anime.animate).toBeTypeOf('function');
  });

  it('minisearch resolves', async () => {
    const { default: MiniSearch } = await import('minisearch');
    const index = new MiniSearch({ fields: ['name'] });
    index.add({ id: '1', name: 'test' });
    expect(index.search('test')).toHaveLength(1);
  });

  it('zustand resolves', async () => {
    const { create } = await import('zustand');
    const useStore = create<{ value: number }>(() => ({ value: 1 }));
    expect(useStore.getState().value).toBe(1);
  });

  it('@supabase/supabase-js resolves (deferred module)', async () => {
    const supabase = await import('@supabase/supabase-js');
    expect(supabase.createClient).toBeTypeOf('function');
  });
});
