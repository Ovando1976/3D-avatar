import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@3d-avatar/design-system': path.resolve(__dirname, '../../packages/design-system/src'),
      '@3d-avatar/avatar-engine': path.resolve(__dirname, '../../packages/avatar-engine/src'),
      '@3d-avatar/ai-clients': path.resolve(__dirname, '../../packages/ai-clients/src'),
      '@3d-avatar/collaboration-sdk': path.resolve(__dirname, '../../packages/collaboration-sdk/src')
    }
  },
  server: {
    port: 5173
  }
});
