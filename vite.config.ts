import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    },
  },
  optimizeDeps: {
    include: ['rxjs', '@wendellhu/redi', 'dayjs', 'lodash-es'],
  },
})
