import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'leaflet', 'react-leaflet', 'lucide-react'] },
  optimizeDeps: { include: ['react-leaflet'] },
  server: {
    host: 'localhost',
    proxy: {
      '^/api/sigep/solicitudes-titulacion(?:/\\d+(?:/visita|/predio|/evidencia|/archivos/[0-9a-fA-F-]{36})?)?(?:\\?|$)': {
        target: 'http://127.0.0.1:8100',
        rewrite: path => path.replace('/api/sigep/', '/api/'),
        bypass(request) {
          if (request.method === 'GET') return undefined
          const sameOrigin = request.headers.origin === `http://${request.headers.host}`
          if (request.method !== 'POST' || !sameOrigin) return false
          const type = request.headers['content-type']?.split(';')[0]
          if (type === 'application/json' && /^\/api\/sigep\/solicitudes-titulacion(?:\/\d+\/(?:visita|predio))?$/.test(request.url || '')) return undefined
          if (type === 'multipart/form-data' && /^\/api\/sigep\/solicitudes-titulacion\/\d+\/evidencia$/.test(request.url || '')) return undefined
          return false
        },
      },
      '^/api/sigep/(?:predios(?:/mapa|/[0-9]+/(?:geometria|historial-geometria))?|fundos/predio|pagos|campo|sesion(?:/entrar|/salir)?|admin/usuarios(?:/[0-9a-fA-F-]+)?|modulos/[a-z_]+|requisitos-documentales|expedientes(?:/\\d+(?:/dictamen|/documentos(?:/[0-9a-fA-F-]{36}(?:/revision)?)?|/predios/\\d+/(?:medicion|catastro|archivos(?:/[0-9a-fA-F-]{36})?|evidencia-visita|plano))?)?)(?:\\?|$)': {
        target: 'http://127.0.0.1:8100',
        rewrite: path => path.replace('/api/sigep/', '/api/'),
        bypass(request) {
          if (request.method === 'GET') return undefined
          const sameOrigin = request.headers.origin === `http://${request.headers.host}`
          const json = request.headers['content-type']?.split(';')[0] === 'application/json'
          const multipart = request.headers['content-type']?.split(';')[0] === 'multipart/form-data'
          const writable = /^\/api\/sigep\/(?:predios|pagos|requisitos-documentales|expedientes(?:\/\d+\/(?:dictamen|documentos(?:\/[0-9a-fA-F-]{36}\/revision)?|predios\/\d+\/(?:medicion|catastro)))?)$/.test(request.url || '')
          if (['POST', 'PUT', 'PATCH'].includes(request.method) && writable && sameOrigin && json) return undefined
          if (request.method === 'PATCH' && sameOrigin && json && /^\/api\/sigep\/predios\/\d+\/geometria$/.test(request.url || '')) return undefined
          const privateUpload = /^\/api\/sigep\/expedientes\/\d+\/predios\/\d+\/(?:evidencia-visita|plano)(?:\?|$)/.test(request.url || '')
          if (request.method === 'POST' && privateUpload && sameOrigin && multipart) return undefined
          const documentUpload = /^\/api\/sigep\/expedientes\/\d+\/documentos(?:\?|$)/.test(request.url || '')
          if (request.method === 'POST' && documentUpload && sameOrigin && multipart) return undefined
          const admin = /^\/api\/sigep\/admin\/usuarios(?:\/[0-9a-fA-F-]+)?$/.test(request.url || '')
          if (admin && sameOrigin && json && ['POST', 'PATCH', 'DELETE'].includes(request.method)) return undefined
          if (sameOrigin && json && request.method === 'POST' && ['/api/sigep/sesion/entrar', '/api/sigep/sesion/salir'].includes(request.url)) return undefined
          return false
        },
      },
    },
  },
})
