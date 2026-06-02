import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        index: 'index.html',
        compass: 'compass.html',
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
