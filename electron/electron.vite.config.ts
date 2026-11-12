import path from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: path.resolve(__dirname, 'main/index.ts') },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: path.resolve(__dirname, 'preload/index.ts') },
        output: {
          // Sandboxed preloads must be plain CJS.
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, 'renderer'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'renderer/src'),
      },
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: { index: path.resolve(__dirname, 'renderer/index.html') },
      },
    },
  },
});
