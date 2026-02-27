import { defineConfig } from 'vite';

export default defineConfig({
optimizeDeps: {
    exclude: ['@imgly/background-removal'],
  },
});
