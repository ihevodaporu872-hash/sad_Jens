import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'packages/',
      ],
    },
  },
  resolve: {
    alias: {
      '@univerjs/core': path.resolve(__dirname, 'packages/univer/core/src'),
      '@univerjs/design': path.resolve(__dirname, 'packages/univer/design/src'),
      '@univerjs/sheets': path.resolve(__dirname, 'packages/univer/sheets/src'),
      '@univerjs/sheets-ui': path.resolve(__dirname, 'packages/univer/sheets-ui/src'),
      '@univerjs/sheets-formula': path.resolve(__dirname, 'packages/univer/sheets-formula/src'),
      '@univerjs/sheets-numfmt': path.resolve(__dirname, 'packages/univer/sheets-numfmt/src'),
      '@univerjs/ui': path.resolve(__dirname, 'packages/univer/ui/src'),
      '@univerjs/engine-formula': path.resolve(__dirname, 'packages/univer/engine-formula/src'),
      '@univerjs/engine-render': path.resolve(__dirname, 'packages/univer/engine-render/src'),
      '@univerjs/drawing': path.resolve(__dirname, 'packages/univer/drawing/src'),
      '@univerjs/themes': path.resolve(__dirname, 'packages/univer/themes/src'),
      '@simplepdf': path.resolve(__dirname, 'packages/simplepdf/src'),
      '@simplepdf/react-embed-pdf': path.resolve(__dirname, 'packages/simplepdf/src'),
      '@cad-viewer/core': path.resolve(__dirname, 'packages/cad-viewer/core/src'),
      '@cad-viewer/svg-renderer': path.resolve(__dirname, 'packages/cad-viewer/svg-renderer/src'),
      '@cad-viewer/three-renderer': path.resolve(__dirname, 'packages/cad-viewer/three-renderer/src'),
      'web-ifc': path.resolve(__dirname, 'packages/web-ifc'),
    },
  },
})
