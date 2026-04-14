import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: false,
  build: {
    outDir: 'build',
  },
  server: {
    proxy: {
      '/api/yields': {
        target: 'https://rendimientos.co',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost')
          const source = url.searchParams.get('source') || 'config'
          return `/api/${source}`
        },
      },
      '/api/inflation': {
        target: 'https://api.argentinadatos.com',
        changeOrigin: true,
        rewrite: () => '/v1/finanzas/indices/inflacion',
      },
      '/api/rates': {
        target: 'https://dolarapi.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost')
          const type = url.searchParams.get('type') || 'all'
          const endpoints = {
            all: '/v1/dolares',
            blue: '/v1/dolares/blue',
            oficial: '/v1/dolares/oficial',
            mep: '/v1/dolares/bolsa',
            ccl: '/v1/dolares/contadoconliqui',
            tarjeta: '/v1/dolares/tarjeta',
            cripto: '/v1/dolares/cripto',
          }
          return endpoints[type] || '/v1/dolares'
        },
      },
    },
  },
})
