/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Apenas local: o estúdio não deve ficar exposto na rede.
    host: '127.0.0.1',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
