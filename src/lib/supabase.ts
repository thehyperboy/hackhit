/**
 * HackhIt — Supabase Client Configuration
 *
 * Initializes and exports the Supabase client instance with runtime validation.
 *
 * Security Requirements:
 * - Only the public publishable/anon key should be accessed in browser code.
 * - Service-role / secret keys must NEVER be placed in frontend environment variables.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfigStatus {
  isConfigured: boolean
  url: string
  hasKey: boolean
  errors: string[]
  isPlaceholder: boolean
  maskedKey?: string
}

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env || {}

const rawUrl = (env.VITE_SUPABASE_URL || '').trim()
// Allow VITE_SUPABASE_PUBLISHABLE_KEY or legacy VITE_SUPABASE_ANON_KEY
const rawKey = (
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

const placeholderPatterns = [
  'your-project-ref',
  'your-anon-publishable-key',
  'your_supabase_url',
  'example.supabase.co',
]

function isPlaceholderValue(val: string): boolean {
  const lower = val.toLowerCase()
  return placeholderPatterns.some((pattern) => lower.includes(pattern))
}

/**
 * Validates the runtime Supabase environment configuration.
 */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const errors: string[] = []
  let isPlaceholder = false

  if (!rawUrl) {
    errors.push('Missing VITE_SUPABASE_URL in environment configuration.')
  } else if (isPlaceholderValue(rawUrl)) {
    isPlaceholder = true
    errors.push('VITE_SUPABASE_URL contains an unconfigured placeholder value.')
  } else {
    try {
      const parsed = new URL(rawUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('VITE_SUPABASE_URL must use http:// or https:// protocol.')
      }
    } catch {
      errors.push('VITE_SUPABASE_URL is not a valid URL.')
    }
  }

  if (!rawKey) {
    errors.push('Missing VITE_SUPABASE_PUBLISHABLE_KEY in environment configuration.')
  } else if (isPlaceholderValue(rawKey)) {
    isPlaceholder = true
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY contains an unconfigured placeholder value.')
  }

  // Security check: Guard against accidental service_role key leakage in frontend
  if (rawKey.toLowerCase().includes('service_role')) {
    errors.push(
      'SECURITY WARNING: service_role key detected! Never expose secret service_role keys in browser code. Use the public anon/publishable key only.'
    )
  }

  const isConfigured = errors.length === 0

  let maskedKey: string | undefined
  if (rawKey) {
    if (rawKey.length > 12) {
      maskedKey = `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}`
    } else {
      maskedKey = '***'
    }
  }

  return {
    isConfigured,
    url: rawUrl,
    hasKey: Boolean(rawKey),
    errors,
    isPlaceholder,
    maskedKey,
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigStatus().isConfigured
}

/**
 * Initialize client instance safely.
 * If credentials are not configured, client is null to prevent runtime exceptions on page load.
 */
let clientInstance: SupabaseClient | null = null

const initialStatus = getSupabaseConfigStatus()
if (initialStatus.isConfigured) {
  try {
    clientInstance = createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err)
  }
} else {
  // Output a helpful diagnostic in development console without breaking the application
  if (env.DEV) {
    console.warn(
      '[HackhIt] Supabase client is not fully configured yet:\n' +
        initialStatus.errors.map((e) => `  - ${e}`).join('\n') +
        '\nConfigure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.'
    )
  }
}

/**
 * The Supabase client instance (or null if unconfigured).
 */
export const supabase = clientInstance

/**
 * Returns the Supabase client or throws a descriptive error if unconfigured.
 */
export function getSupabase(): SupabaseClient {
  if (!clientInstance) {
    const status = getSupabaseConfigStatus()
    throw new Error(
      'Supabase client is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.local.\nErrors: ' +
        status.errors.join('; ')
    )
  }
  return clientInstance
}
