import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/budget-app/advisor/',
  build: {
    outDir: '../advisor',
    emptyOutDir: true
  }
});
