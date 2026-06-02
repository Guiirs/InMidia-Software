import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'vendor-mui';
            }
            if (
              id.includes('leaflet')
              || id.includes('react-leaflet')
              || id.includes('react-leaflet-cluster')
            ) {
              return 'vendor-map';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'vendor-charts';
            }
            if (
              id.includes('@tanstack')
              || id.includes('axios')
              || id.includes('date-fns')
              || id.includes('file-saver')
              || id.includes('jwt-decode')
            ) {
              return 'vendor-utils';
            }
          }

          if (
            id.includes('/src/v4-painel/shell/')
            || id.includes('/src/v4-painel/providers/')
            || id.includes('/src/v4-painel/foundation/')
            || id.includes('/src/v4-painel/design-system/')
            || id.includes('/src/v4-painel/components/ui/')
          ) {
            return 'v4-core';
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/setupTests.js'],
    // Simula import.meta.env para o código de produção
    env: {
      DEV: 'false',
    },
  },
})
