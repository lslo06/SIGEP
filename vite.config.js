import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'leaflet', 'react-leaflet', 'lucide-react'] },
  optimizeDeps: { include: ['react-leaflet'] },
  server: {
    host: 'localhost',
    proxy: {
      '^/api/sigep/(?:predios(?:/mapa)?|fundos/predio|pagos|campo|sesion(?:/entrar|/salir)?|admin/usuarios(?:/[0-9a-fA-F-]+)?|modulos/[a-z_]+|expedientes(?:/\\d+(?:/predios/\\d+/medicion)?)?)(?:\\?|$)': {
        target: 'http://127.0.0.1:8100',
        rewrite: path => path.replace('/api/sigep/', '/api/'),
        bypass(request) {
          if (request.method === 'GET') return undefined
          const sameOrigin = request.headers.origin === `http://${request.headers.host}`
          const json = request.headers['content-type']?.split(';')[0] === 'application/json'
          const writable = /^\/api\/sigep\/(?:predios|pagos|expedientes(?:\/\d+\/predios\/\d+\/medicion)?)$/.test(request.url || '')
          if (request.method === 'POST' && writable && sameOrigin && json) return undefined
          const admin = /^\/api\/sigep\/admin\/usuarios(?:\/[0-9a-fA-F-]+)?$/.test(request.url || '')
          if (admin && sameOrigin && json && ['POST', 'PATCH'].includes(request.method)) return undefined
          if (sameOrigin && json && request.method === 'POST' && ['/api/sigep/sesion/entrar', '/api/sigep/sesion/salir'].includes(request.url)) return undefined
          return false
        },
      },
    },
  },
})
