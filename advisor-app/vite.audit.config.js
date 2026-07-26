import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const mock = fileURLToPath(new URL('./src/__audit/mockSupabase.js', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { port: 5199, strictPort: true },
  resolve: {
    alias: [{ find: /(\.\.?\/)+supabaseClient\.js$/, replacement: mock }]
  }
});
