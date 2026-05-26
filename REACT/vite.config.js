import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
