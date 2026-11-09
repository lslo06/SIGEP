import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

const isPlaceholder = value => !value || /YOUR_PROJECT|your_key|tu-proyecto|placeholder/i.test(value)
const isValidUrl = value => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname.includes('.') && !isPlaceholder(parsed.hostname)
  } catch {
    return false
  }
}

export const supabaseConfigured = isValidUrl(url) && !isPlaceholder(key)
export const supabase = supabaseConfigured ? createClient(url, key) : null
