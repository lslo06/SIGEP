import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { createWorkerHandler } from './handler.js'

const url = Deno.env.get('SUPABASE_URL')
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) throw new Error('Falta la configuración privada del servidor.')
const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
Deno.serve(createWorkerHandler(service))
