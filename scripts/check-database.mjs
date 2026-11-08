import fs from 'node:fs'

// Solo lectura. No muestra URL, claves ni registros.
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2')]
  }))
for (const table of ['organizaciones', 'modulo_registros']) {
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=id&limit=0`, {
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(15000),
    })
    const data = await response.json()
    console.log(JSON.stringify({ table, status: response.status, code: data.code, message: data.message }))
  } catch (error) {
    console.log(JSON.stringify({ table, error: error.cause?.code || error.name }))
    process.exitCode = 1
  }
}
