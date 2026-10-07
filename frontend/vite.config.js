import fs from 'node:fs'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/*
 * Content-Security-Policy para el build de producción:
 * solo scripts propios y conexiones al mismo servidor
 * (o al API configurado en VITE_API_URL).
 * (En desarrollo no se aplica: Vite usa scripts en línea.)
 */
function politicaSeguridad(apiUrl) {
  let origenApi = ''

  try {
    origenApi = apiUrl ? new URL(apiUrl).origin : ''
  } catch {
    origenApi = ''
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${origenApi ? ` ${origenApi}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')

  return {
    name: 'oma-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`
      )
    }
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // En desarrollo, /api se reenvía al backend: la app y la API comparten
  // origen y la cookie de sesión funciona igual que en producción.
  const backendHttps = fs.existsSync(new URL('../backend/certs/oma.crt', import.meta.url))
  const backend = env.VITE_BACKEND_URL || `${backendHttps ? 'https' : 'http'}://localhost:3000`

  return {
    plugins: [
      react(),
      politicaSeguridad(env.VITE_API_URL)
    ],
    server: {
      proxy: {
        '/api': { target: backend, changeOrigin: true, secure: false }
      }
    },
    build: {
      // Sin mapas de código fuente en producción
      sourcemap: false
    }
  }
})
