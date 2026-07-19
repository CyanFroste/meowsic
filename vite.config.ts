import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const host = process.env.TAURI_DEV_HOST

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  publicDir: path.resolve(__dirname, 'assets'),
  build: {
    outDir: path.resolve(__dirname, 'build'),
    chunkSizeWarningLimit: 2000,
    target: 'esnext',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    ...(host
      ? {
          host,
          hmr: { protocol: 'ws', host, port: 1421 },
        }
      : { host: false }),
    watch: {
      ignored: ['**/backend/**'],
    },
  },
}))
