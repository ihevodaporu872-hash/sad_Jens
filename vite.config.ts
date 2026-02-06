import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  resolve: {
    alias: {
      // SimplePDF
      '@simplepdf': path.resolve(__dirname, 'packages/simplepdf/src'),
      '@simplepdf/react-embed-pdf': path.resolve(__dirname, 'packages/simplepdf/src'),
      // CAD Viewer
      '@cad-viewer/core': path.resolve(__dirname, 'packages/cad-viewer/core/src'),
      '@cad-viewer/svg-renderer': path.resolve(__dirname, 'packages/cad-viewer/svg-renderer/src'),
      '@cad-viewer/three-renderer': path.resolve(__dirname, 'packages/cad-viewer/three-renderer/src'),
      // web-ifc
      'web-ifc': path.resolve(__dirname, 'packages/web-ifc'),
    },
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    include: ['rxjs', '@wendellhu/redi', 'dayjs', 'lodash-es'],
  },
})
