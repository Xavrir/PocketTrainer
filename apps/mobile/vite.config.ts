import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  root: path.resolve(__dirname, 'web'),
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'node_modules/react-native-web'),
      'react-native-safe-area-context': path.resolve(
        __dirname,
        'web/safe-area-context.tsx',
      ),
      'react-native-svg': path.resolve(
        __dirname,
        'node_modules/react-native-svg/lib/module/elements.web.js',
      ),
    },
  },
  define: {
    'process.env.POCKETTRAINER_API_BASE_URL': JSON.stringify(
      process.env.POCKETTRAINER_API_BASE_URL ?? '',
    ),
    'process.env.POCKETTRAINER_ALLOW_AUTH_BYPASS': JSON.stringify(
      process.env.POCKETTRAINER_ALLOW_AUTH_BYPASS ?? 'true',
    ),
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV ?? 'development',
    ),
    'process.env.POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
      process.env.POCKETTRAINER_SUPABASE_PUBLISHABLE_KEY ?? '',
    ),
    'process.env.POCKETTRAINER_SUPABASE_URL': JSON.stringify(
      process.env.POCKETTRAINER_SUPABASE_URL ?? '',
    ),
  },
  build: { outDir: path.resolve(__dirname, 'dist-web'), emptyOutDir: true },
  server: { host: '127.0.0.1' },
});
