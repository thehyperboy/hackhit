/**
 * HackhIt — Hackathons Service Layer
 *
 * Provides real-data fetching, schema verification, and safe normalization
 * for Hackathon Discovery with Supabase Row-Level Security enforcement.
 */

import { getSupabase } from './supabase'
import type {
  Hackathon,
  RegistrationFormData,
  RegistrationFieldErrors,
  ParticipationType,
  HackathonRegistrationRecord,
  SubmitRegistrationResult,
  UserRegistrationItem,
  FetchMyRegistrationsResult,
} from '../types/hackathons'

export interface FetchHackathonsResult {
  hackathons: Hackathon[]
  error: string | null
  isPendingSchema: boolean
}

/**
 * Verified Real-World Hackathons and Collegiate Competitions.
 * Only genuine university-created hackathons are served.
 */
export const REAL_WORLD_HACKATHONS: Hackathon[] = []

export type HackathonSchemaState =
  | 'initialized'
  | 'uninitialized'
  | 'inaccessible'
  | 'unauthorized'
  | 'error'

export interface HackathonSchemaReport {
  state: HackathonSchemaState
  message: string
  details?: string
  checkedAt: string
}

/**
 * Checks whether the error indicates a missing table in the PostgREST schema cache.
 */
export function isHackathonsSchemaPendingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  const errorObj = err as Record<string, unknown>
  const status = typeof errorObj.status === 'number' ? errorObj.status : null
  const code = String(errorObj.code || '')
  const msg = String(errorObj.message || '').toLowerCase()

  // Guard: Network failure must not be treated as missing schema
  if (
    status === 0 ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  ) {
    return false
  }

  // Guard: Auth key rejection (401)
  if (status === 401 || msg.includes('apikey') || msg.includes('jwt')) {
    return false
  }

  // Guard: Permission denied / RLS restricted (403 / 42501) means table EXISTS
  if (status === 403 || code === '42501' || msg.includes('permission denied')) {
    return false
  }

  // Check for PostgREST missing table codes
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes("could not find the table 'public.hackathons'") ||
    msg.includes('relation "public.hackathons"') ||
    (status === 404 && msg.includes('schema cache'))
  ) {
    return true
  }

  return false
}

/**
 * Probes the backend to verify whether the hackathons table exists.
 */
export async function checkHackathonsSchemaStatus(): Promise<HackathonSchemaReport> {
  const checkedAt = new Date().toLocaleTimeString()
  const supabase = getSupabase()

  if (!supabase) {
    return {
      state: 'inaccessible',
      message: 'Supabase client is not configured.',
      checkedAt,
    }
  }

  try {
    const { error } = await supabase.from('hackathons').select('id').limit(1)

    if (!error) {
      return {
        state: 'initialized',
        message: 'Hackathons database table is ready.',
        checkedAt,
      }
    }

    if (isHackathonsSchemaPendingError(error)) {
      return {
        state: 'uninitialized',
        message: "Table 'public.hackathons' is missing from the database schema cache.",
        details: error.message || 'Run migration supabase/migrations/20260402000000_hackathons_discovery.sql',
        checkedAt,
      }
    }

    const msg = (error.message || '').toLowerCase()
    if (msg.includes('fetch') || msg.includes('network')) {
      return {
        state: 'inaccessible',
        message: 'Unable to reach the Supabase backend.',
        details: error.message,
        checkedAt,
      }
    }

    const errorStatus = (error as unknown as { status?: number }).status
    if (errorStatus === 401 || msg.includes('apikey')) {
      return {
        state: 'unauthorized',
        message: 'Supabase publishable key was rejected.',
        details: error.message,
        checkedAt,
      }
    }

    return {
      state: 'error',
      message: error.message || 'Failed to inspect hackathons database state.',
      checkedAt,
    }
  } catch (err) {
    return {
      state: 'error',
      message: err instanceof Error ? err.message : String(err),
      checkedAt,
    }
  }
}

/**
 * Normalizes a raw database record into a safe, strongly-typed Hackathon object.
 */
export function normalizeHackathonRow(row: Record<string, unknown>): Hackathon {
  const modeVal = String(row.mode || 'Online')
  const validMode = (['Online', 'Offline', 'Hybrid'].includes(modeVal)
    ? modeVal
    : 'Online') as 'Online' | 'Offline' | 'Hybrid'

  return {
    id: String(row.id || ''),
    title: String(row.title || 'Untitled Hackathon'),
    organizer: String(row.organizer || 'Campus Organizer'),
    category: String(row.category || 'Open Innovation'),
    mode: validMode,
    location: row.location ? String(row.location) : null,
    cover_image_url: row.cover_image_url ? String(row.cover_image_url) : null,
    registration_deadline: row.registration_deadline ? String(row.registration_deadline) : null,
    start_date: row.start_date ? String(row.start_date) : null,
    end_date: row.end_date ? String(row.end_date) : null,
    prize_pool: row.prize_pool ? String(row.prize_pool) : null,
    description: row.description ? String(row.description) : null,
    eligibility: row.eligibility ? String(row.eligibility) : null,
    rules: row.rules ? String(row.rules) : null,
    schedule: row.schedule ? String(row.schedule) : null,
    website_url: row.website_url ? String(row.website_url) : null,
    featured: Boolean(row.featured),
    status: (row.status as 'draft' | 'published' | 'archived') || 'published',
    organizer_id: row.organizer_id ? String(row.organizer_id) : null,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  }
}

/**
 * Validates that an external URL uses a safe web protocol (http or https).
 */
export function isValidExternalUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export interface FetchHackathonByIdResult {
  hackathon: Hackathon | null
  error: string | null
  isNotFound: boolean
  isPendingSchema: boolean
}

/**
 * Fetches a single hackathon record by its stable ID.
 * Respects RLS: unpublished/draft hackathons not owned by the user return not-found.
 */
export async function fetchHackathonById(
  id: string,
  options?: { signal?: AbortSignal }
): Promise<FetchHackathonByIdResult> {
  const supabase = getSupabase()

  if (!supabase) {
    return {
      hackathon: null,
      error: 'Backend connection not available.',
      isNotFound: false,
      isPendingSchema: false,
    }
  }

  if (!id || typeof id !== 'string' || id.trim() === '') {
    return {
      hackathon: null,
      error: 'Invalid hackathon identifier.',
      isNotFound: true,
      isPendingSchema: false,
    }
  }

  try {
    const query = supabase
      .from('hackathons')
      .select('*')
      .eq('id', id.trim())

    if (options?.signal) {
      query.abortSignal(options.signal)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      if (isHackathonsSchemaPendingError(error)) {
        return {
          hackathon: null,
          error: null,
          isNotFound: false,
          isPendingSchema: true,
        }
      }

      return {
        hackathon: null,
        error: error.message || 'Failed to load hackathon details.',
        isNotFound: false,
        isPendingSchema: false,
      }
    }

    if (!data || !data.organizer_id || LEGACY_MOCK_TITLES.has(String(data.title || '').trim())) {
      return {
        hackathon: null,
        error: null,
        isNotFound: true,
        isPendingSchema: false,
      }
    }

    return {
      hackathon: normalizeHackathonRow(data as Record<string, unknown>),
      error: null,
      isNotFound: false,
      isPendingSchema: false,
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))
    ) {
      return { hackathon: null, error: null, isNotFound: false, isPendingSchema: false }
    }

    return {
      hackathon: null,
      error: err instanceof Error ? err.message : 'An error occurred while loading hackathon details.',
      isNotFound: false,
      isPendingSchema: false,
    }
  }
}

// Known legacy migration seed titles that must be excluded so only genuine user-created hackathons appear
const LEGACY_MOCK_TITLES = new Set([
  'Google Solution Challenge 2026',
  'Smart India Hackathon (SIH) 2026',
  'ETHIndia Collegiate Hackathon 2026',
  'Malla Reddy Web Cup 2026',
  'Kaggle Student Predictive Analytics Challenge',
])

/**
 * Fetches published hackathons from Supabase created by university organizers.
 * Strictly returns genuine university-created events; leaves empty if none created yet.
 */
export async function fetchHackathons(options?: {
  signal?: AbortSignal
}): Promise<FetchHackathonsResult> {
  const supabase = getSupabase()

  if (!supabase) {
    return {
      hackathons: [],
      error: null,
      isPendingSchema: false,
    }
  }

  try {
    const query = supabase
      .from('hackathons')
      .select('*')
      .not('organizer_id', 'is', null)
      .eq('status', 'published')
      .order('registration_deadline', { ascending: true, nullsFirst: false })

    if (options?.signal) {
      query.abortSignal(options.signal)
    }

    const { data, error } = await query

    if (error) {
      return {
        hackathons: [],
        error: isHackathonsSchemaPendingError(error) ? null : error.message,
        isPendingSchema: isHackathonsSchemaPendingError(error),
      }
    }

    const normalized = (data || [])
      .filter((row) => {
        const title = String(row.title || '').trim()
        const hasOrganizer = Boolean(row.organizer_id)
        return hasOrganizer && !LEGACY_MOCK_TITLES.has(title)
      })
      .map((row) =>
        normalizeHackathonRow(row as Record<string, unknown>)
      )

    return {
      hackathons: normalized,
      error: null,
      isPendingSchema: false,
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.toLowerCase().includes('abort'))
    ) {
      return { hackathons: [], error: null, isPendingSchema: false }
    }

    return {
      hackathons: [],
      error: null,
      isPendingSchema: false,
    }
  }
}

/**
 * Formats event start and end dates safely handling nulls or invalid values.
 */
export function formatEventDates(startStr?: string | null, endStr?: string | null): string {
  if (!startStr && !endStr) return 'Dates TBD'
  try {
    const hasStart = Boolean(startStr && !isNaN(new Date(startStr).getTime()))
    const hasEnd = Boolean(endStr && !isNaN(new Date(endStr).getTime()))

    if (!hasStart && !hasEnd) return 'Dates TBD'

    if (hasStart && !hasEnd) {
      const start = new Date(startStr!)
      return `Starts ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }

    if (!hasStart && hasEnd) {
      const end = new Date(endStr!)
      return `Until ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }

    const start = new Date(startStr!)
    const end = new Date(endStr!)

    const sameMonth = start.getMonth() === end.getMonth()
    const sameYear = start.getFullYear() === end.getFullYear()

    if (sameMonth && sameYear) {
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.getDate()}, ${end.getFullYear()}`
    }

    if (sameYear) {
      return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${end.getFullYear()}`
    }

    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  } catch {
    return 'Dates TBD'
  }
}

/**
 * Calculates countdown label, urgency flag, and closed state for registration deadline.
 */
export function formatDeadlineCountdown(deadlineStr?: string | null): {
  label: string
  isClosingSoon: boolean
  isClosed: boolean
} {
  if (!deadlineStr) return { label: 'Deadline Rolling / TBD', isClosingSoon: false, isClosed: false }
  try {
    const deadline = new Date(deadlineStr)
    if (isNaN(deadline.getTime())) return { label: 'Deadline Rolling / TBD', isClosingSoon: false, isClosed: false }

    const now = new Date()
    const diffMs = deadline.getTime() - now.getTime()

    if (diffMs <= 0) return { label: 'Registration Closed', isClosingSoon: false, isClosed: true }

    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours <= 1) return { label: 'Closes in 1 hour!', isClosingSoon: true, isClosed: false }
    if (diffHours <= 24) return { label: 'Closes Today!', isClosingSoon: true, isClosed: false }
    if (diffDays === 1) return { label: 'Closes Tomorrow', isClosingSoon: true, isClosed: false }
    if (diffDays <= 5) return { label: `${diffDays} days left`, isClosingSoon: true, isClosed: false }

    return {
      label: `Deadline: ${deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      isClosingSoon: false,
      isClosed: false,
    }
  } catch {
    return { label: 'Deadline Rolling / TBD', isClosingSoon: false, isClosed: false }
  }
}

/**
 * Determines participation type support (Individual vs Team) based strictly on real event data.
 * Checks event rules and description for team-only or individual-only requirements.
 */
export function determineParticipationSupport(hackathon: Hackathon): {
  allowsIndividual: boolean
  allowsTeam: boolean
  defaultType: ParticipationType
  isTeamOnly: boolean
  isIndividualOnly: boolean
  guidance?: string
} {
  const combinedText = `${hackathon.rules || ''} ${hackathon.description || ''}`.toLowerCase()

  // Match patterns like "strictly 6 team members", "teams of 2 to 4 members"
  const teamOnlyPatterns = [
    /strictly\s+\d+\s+team\s+members/i,
    /teams?\s+of\s+[2-9]/i,
    /minimum\s+[2-9]\s+(members|students|hackers)/i,
    /team\s+participation\s+only/i,
  ]
  const isTeamOnly = teamOnlyPatterns.some((pattern) => pattern.test(combinedText))

  // Match patterns like "individual only", "solo hackers only"
  const individualOnlyPatterns = [
    /individual\s+only/i,
    /solo\s+hackers?\s+only/i,
    /no\s+teams?\s+allowed/i,
  ]
  const isIndividualOnly = !isTeamOnly && individualOnlyPatterns.some((pattern) => pattern.test(combinedText))

  if (isTeamOnly) {
    return {
      allowsIndividual: false,
      allowsTeam: true,
      defaultType: 'team',
      isTeamOnly: true,
      isIndividualOnly: false,
      guidance: 'This competition requires team participation according to event rules.',
    }
  }

  if (isIndividualOnly) {
    return {
      allowsIndividual: true,
      allowsTeam: false,
      defaultType: 'individual',
      isTeamOnly: false,
      isIndividualOnly: true,
      guidance: 'This competition is for individual hackers only.',
    }
  }

  // Default: both individual and team supported
  return {
    allowsIndividual: true,
    allowsTeam: true,
    defaultType: 'individual',
    isTeamOnly: false,
    isIndividualOnly: false,
    guidance: 'You can register individually or participate with a team.',
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validates registration form inputs against student details and event constraints.
 * Enforces field limits, email formats, eligibility agreement, and team member consistency.
 */
export function validateRegistrationForm(
  data: RegistrationFormData,
  hackathon: Hackathon
): { isValid: boolean; errors: RegistrationFieldErrors } {
  const errors: RegistrationFieldErrors = {}

  // 1. Full name validation
  const trimmedName = data.fullName.trim()
  if (!trimmedName) {
    errors.fullName = 'Full name is required.'
  } else if (trimmedName.length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.'
  } else if (trimmedName.length > 100) {
    errors.fullName = 'Full name cannot exceed 100 characters.'
  }

  // 2. Email validation
  const trimmedEmail = data.email.trim()
  if (!trimmedEmail) {
    errors.email = 'Contact email is required.'
  } else if (!EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = 'Please provide a valid email address.'
  }

  // 3. University validation (optional, but length checked)
  const trimmedUniversity = data.university.trim()
  if (trimmedUniversity.length > 120) {
    errors.university = 'University / College cannot exceed 120 characters.'
  }

  // 4. Participation type support check
  const support = determineParticipationSupport(hackathon)
  if (data.participationType === 'individual' && !support.allowsIndividual) {
    errors.participationType = 'This event requires team participation.'
  } else if (data.participationType === 'team' && !support.allowsTeam) {
    errors.participationType = 'This event only supports individual registration.'
  }

  // 5. Team validation if participating as a team
  if (data.participationType === 'team') {
    const trimmedTeamName = data.teamName.trim()
    if (!trimmedTeamName) {
      errors.teamName = 'Team name is required for team registration.'
    } else if (trimmedTeamName.length < 2) {
      errors.teamName = 'Team name must be at least 2 characters.'
    } else if (trimmedTeamName.length > 80) {
      errors.teamName = 'Team name cannot exceed 80 characters.'
    }

    if (!data.teammates || data.teammates.length === 0) {
      errors.general = 'Please add at least one teammate for team registration.'
    } else {
      const teammateErrors: { [index: number]: { name?: string; email?: string } } = {}
      let hasTeammateError = false
      const seenEmails = new Set<string>()
      const applicantEmailLower = trimmedEmail.toLowerCase()

      data.teammates.forEach((tm, idx) => {
        const itemError: { name?: string; email?: string } = {}
        const tmName = tm.name.trim()
        const tmEmail = tm.email.trim()

        if (!tmName) {
          itemError.name = 'Teammate name is required.'
          hasTeammateError = true
        } else if (tmName.length < 2) {
          itemError.name = 'Name must be at least 2 characters.'
          hasTeammateError = true
        } else if (tmName.length > 80) {
          itemError.name = 'Name cannot exceed 80 characters.'
          hasTeammateError = true
        }

        if (!tmEmail) {
          itemError.email = 'Teammate email is required.'
          hasTeammateError = true
        } else if (!EMAIL_REGEX.test(tmEmail)) {
          itemError.email = 'Enter a valid email address.'
          hasTeammateError = true
        } else if (tmEmail.toLowerCase() === applicantEmailLower) {
          itemError.email = 'Teammate cannot have your email address.'
          hasTeammateError = true
        } else if (seenEmails.has(tmEmail.toLowerCase())) {
          itemError.email = 'Duplicate teammate email.'
          hasTeammateError = true
        } else {
          seenEmails.add(tmEmail.toLowerCase())
        }

        if (itemError.name || itemError.email) {
          teammateErrors[idx] = itemError
        }
      })

      if (hasTeammateError) {
        errors.teammates = teammateErrors
      }
    }
  }

  // 6. Eligibility Confirmation (required only if event defines eligibility)
  const hasEligibilityRequirement =
    typeof hackathon.eligibility === 'string' && hackathon.eligibility.trim().length > 0
  if (hasEligibilityRequirement && !data.confirmedEligibility) {
    errors.confirmedEligibility = 'You must confirm that you meet the event eligibility criteria.'
  }

  // 7. Rules acceptance
  if (!data.acceptedRules) {
    errors.acceptedRules = 'You must agree to the event rules and guidelines to register.'
  }

  const isValid = Object.keys(errors).length === 0
  return { isValid, errors }
}

export type DatabaseErrorCategory =
  | 'missing_table'
  | 'network'
  | 'permission'
  | 'conflict'
  | 'general'

export interface CategorizedDatabaseError {
  category: DatabaseErrorCategory
  code?: string
  status?: number
  message: string
  details?: string
  isMissingTable: boolean
  isNetworkError: boolean
  isPermissionError: boolean
  isConflict: boolean
}

/**
 * Robustly categorizes database errors distinguishing:
 * 1. Network / Connection errors (Failed to fetch, timeout, offline)
 * 2. Permission / Auth errors (401, 403, 42501, RLS violation)
 * 3. Unique conflicts (23505)
 * 4. Missing table / Schema pending (PGRST205, 42P01)
 */
export function categorizeDatabaseError(error: unknown): CategorizedDatabaseError {
  if (!error || typeof error !== 'object') {
    return {
      category: 'general',
      message: error ? String(error) : 'Unknown database error',
      isMissingTable: false,
      isNetworkError: false,
      isPermissionError: false,
      isConflict: false,
    }
  }

  const err = error as { code?: string; message?: string; details?: string; status?: number; name?: string }
  const code = (err.code || '').toUpperCase()
  const msg = (err.message || '').toLowerCase()
  const details = (err.details || '').toLowerCase()
  const name = (err.name || '').toLowerCase()
  const status = typeof err.status === 'number' ? err.status : undefined

  // 1. Check for Network / Connection errors first
  const isNetwork =
    name === 'aborterror' ||
    status === 0 ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('connection refused') ||
    msg.includes('offline') ||
    details.includes('network')

  if (isNetwork) {
    return {
      category: 'network',
      code,
      status,
      message: err.message || 'Unable to reach the database server.',
      details: err.details,
      isMissingTable: false,
      isNetworkError: true,
      isPermissionError: false,
      isConflict: false,
    }
  }

  // 2. Check for Permission / Auth errors
  const isPermission =
    status === 401 ||
    status === 403 ||
    code === '42501' || // insufficient_privilege
    code === 'PGRST301' || // JWT expired / unauthorized
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('jwt') ||
    msg.includes('apikey') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('not authorized')

  if (isPermission) {
    return {
      category: 'permission',
      code,
      status,
      message: err.message || 'Permission denied by database security policy.',
      details: err.details,
      isMissingTable: false,
      isNetworkError: false,
      isPermissionError: true,
      isConflict: false,
    }
  }

  // 3. Check for Duplicate / Conflict (Postgres unique constraint violation)
  const isConflict = code === '23505' || msg.includes('unique constraint') || msg.includes('duplicate key')
  if (isConflict) {
    return {
      category: 'conflict',
      code,
      status,
      message: 'A duplicate record already exists in the database.',
      details: err.details,
      isMissingTable: false,
      isNetworkError: false,
      isPermissionError: false,
      isConflict: true,
    }
  }

  // 4. Check for Missing Table / Uninitialized Schema
  const isMissingTable =
    code === 'PGRST205' ||
    code === '42P01' || // undefined_table
    (status === 404 && (msg.includes('schema cache') || msg.includes('not found') || msg.includes('does not exist'))) ||
    (msg.includes('hackathon_registrations') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not found'))) ||
    (details.includes('hackathon_registrations') && details.includes('does not exist'))

  if (isMissingTable) {
    return {
      category: 'missing_table',
      code,
      status,
      message: "Table 'public.hackathon_registrations' has not yet been initialized in the database.",
      details: err.details,
      isMissingTable: true,
      isNetworkError: false,
      isPermissionError: false,
      isConflict: false,
    }
  }

  return {
    category: 'general',
    code,
    status,
    message: err.message || 'An unexpected database error occurred.',
    details: err.details,
    isMissingTable: false,
    isNetworkError: false,
    isPermissionError: false,
    isConflict: false,
  }
}

/**
 * Checks whether an error signifies that public.hackathon_registrations is missing from database schema.
 * Strictly guarantees that network errors and permission errors are NOT misidentified as missing tables.
 */
export function isRegistrationsSchemaPendingError(error: unknown): boolean {
  return categorizeDatabaseError(error).isMissingTable
}

/**
 * Probes the backend to verify whether the hackathon_registrations table exists.
 * Accurately distinguishes missing table, network errors, and permission/auth errors.
 */
export async function checkRegistrationsSchemaStatus(): Promise<HackathonSchemaReport> {
  const checkedAt = new Date().toLocaleTimeString()
  const supabase = getSupabase()

  if (!supabase) {
    return {
      state: 'inaccessible',
      message: 'Supabase client is not configured.',
      checkedAt,
    }
  }

  try {
    const { error } = await supabase.from('hackathon_registrations').select('id').limit(1)

    if (!error) {
      return {
        state: 'initialized',
        message: 'Hackathon registrations database table is ready.',
        checkedAt,
      }
    }

    const categorized = categorizeDatabaseError(error)

    if (categorized.isNetworkError) {
      return {
        state: 'inaccessible',
        message: 'Unable to reach the Supabase backend due to network issues.',
        details: categorized.message,
        checkedAt,
      }
    }

    if (categorized.isPermissionError) {
      return {
        state: 'unauthorized',
        message: 'Database query rejected due to insufficient permissions or invalid auth credentials.',
        details: categorized.message,
        checkedAt,
      }
    }

    if (categorized.isMissingTable) {
      return {
        state: 'uninitialized',
        message: "Table 'public.hackathon_registrations' is missing from the database schema cache.",
        details: 'Run migration supabase/migrations/20260403000000_hackathon_registrations.sql in Supabase SQL editor.',
        checkedAt,
      }
    }

    return {
      state: 'error',
      message: categorized.message || 'Failed to inspect registrations database state.',
      details: categorized.details,
      checkedAt,
    }
  } catch (err) {
    const categorized = categorizeDatabaseError(err)
    if (categorized.isNetworkError) {
      return {
        state: 'inaccessible',
        message: 'Network error communicating with the Supabase backend.',
        details: err instanceof Error ? err.message : String(err),
        checkedAt,
      }
    }
    return {
      state: 'error',
      message: err instanceof Error ? err.message : String(err),
      checkedAt,
    }
  }
}

/**
 * Fetches the authenticated student's existing registration for a specific hackathon.
 * Returns null if not registered or if unauthenticated.
 */
export async function fetchUserHackathonRegistration(
  hackathonId: string,
  options?: { signal?: AbortSignal }
): Promise<{
  registration: HackathonRegistrationRecord | null
  isPendingSchema: boolean
  error: string | null
}> {
  const supabase = getSupabase()
  if (!supabase) {
    return { registration: null, isPendingSchema: false, error: 'Database client unavailable.' }
  }

  if (!hackathonId || typeof hackathonId !== 'string') {
    return { registration: null, isPendingSchema: false, error: 'Invalid hackathon ID.' }
  }

  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { registration: null, isPendingSchema: false, error: null }
    }

    const query = supabase
      .from('hackathon_registrations')
      .select('*')
      .eq('hackathon_id', hackathonId.trim())
      .eq('user_id', authData.user.id)

    if (options?.signal) {
      query.abortSignal(options.signal)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      const categorized = categorizeDatabaseError(error)
      if (categorized.isMissingTable) {
        return { registration: null, isPendingSchema: true, error: null }
      }
      if (categorized.isNetworkError) {
        return { registration: null, isPendingSchema: false, error: 'Network connection error checking registration status.' }
      }
      if (categorized.isPermissionError) {
        return { registration: null, isPendingSchema: false, error: 'Permission error checking registration status.' }
      }
      return { registration: null, isPendingSchema: false, error: error.message }
    }

    return { registration: (data as HackathonRegistrationRecord) || null, isPendingSchema: false, error: null }
  } catch (err) {
    const categorized = categorizeDatabaseError(err)
    if (categorized.isMissingTable) {
      return { registration: null, isPendingSchema: true, error: null }
    }
    return {
      registration: null,
      isPendingSchema: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Submits and persists a real hackathon registration to Supabase.
 * Enforces:
 * 1. Verified authentication via session (never trusts client-supplied user ID).
 * 2. Trusted event verification (exists, published, open deadline).
 * 3. Prevention of duplicate registrations (via pre-check and unique database constraint).
 * 4. Input validation and team constraint compliance.
 */
export async function submitHackathonRegistration(params: {
  hackathonId: string
  formData: RegistrationFormData
}): Promise<SubmitRegistrationResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return {
      success: false,
      registration: null,
      error: 'Backend client is not configured.',
    }
  }

  // 1. Authenticate user from session - NEVER trust client-supplied user ID
  const { data: authData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !authData?.user) {
    return {
      success: false,
      registration: null,
      error: 'You must be signed in to submit an event registration.',
    }
  }
  const verifiedUserId = authData.user.id
  const verifiedUserEmail = authData.user.email || params.formData.email.trim()

  // 2. Validate event using trusted backend data
  const eventResult = await fetchHackathonById(params.hackathonId)
  if (eventResult.isNotFound || !eventResult.hackathon) {
    return {
      success: false,
      registration: null,
      error: 'The requested hackathon was not found or is unavailable.',
    }
  }

  const hackathon = eventResult.hackathon

  // Verify event is published
  if (hackathon.status !== 'published') {
    return {
      success: false,
      registration: null,
      error: 'This hackathon is not published for registration.',
    }
  }

  // Verify registration deadline using trusted date
  if (hackathon.registration_deadline) {
    const deadline = new Date(hackathon.registration_deadline)
    if (!isNaN(deadline.getTime()) && Date.now() > deadline.getTime()) {
      return {
        success: false,
        isClosed: true,
        registration: null,
        error: `Registration for ${hackathon.title} closed on ${deadline.toLocaleDateString()}. New entries are not accepted.`,
      }
    }
  }

  // Verify participation format matches event rules
  const support = determineParticipationSupport(hackathon)
  if (params.formData.participationType === 'individual' && !support.allowsIndividual) {
    return {
      success: false,
      registration: null,
      error: 'This event strictly requires team registration according to official rules.',
    }
  }
  if (params.formData.participationType === 'team' && !support.allowsTeam) {
    return {
      success: false,
      registration: null,
      error: 'This event only supports individual registration.',
    }
  }

  // 3. Validate form fields
  const validation = validateRegistrationForm(params.formData, hackathon)
  if (!validation.isValid) {
    const firstErrorMessage =
      validation.errors.general ||
      validation.errors.fullName ||
      validation.errors.email ||
      validation.errors.teamName ||
      validation.errors.confirmedEligibility ||
      validation.errors.acceptedRules ||
      'Validation failed. Please review your entered details.'
    return {
      success: false,
      registration: null,
      error: firstErrorMessage,
    }
  }

  // 4. Pre-check for duplicate registration
  try {
    const { data: existingReg, error: existingErr } = await supabase
      .from('hackathon_registrations')
      .select('id, created_at, status')
      .eq('hackathon_id', hackathon.id)
      .eq('user_id', verifiedUserId)
      .maybeSingle()

    if (existingErr) {
      const categorized = categorizeDatabaseError(existingErr)
      if (categorized.isMissingTable) {
        return {
          success: false,
          isPendingSchema: true,
          registration: null,
          error: "Table 'public.hackathon_registrations' has not yet been initialized in the database.",
        }
      }
      if (categorized.isNetworkError) {
        return {
          success: false,
          isNetworkError: true,
          registration: null,
          error: 'Network connection error: Unable to contact database server. Please check your internet connection.',
        }
      }
      if (categorized.isPermissionError) {
        return {
          success: false,
          isPermissionError: true,
          registration: null,
          error: 'Permission denied: Unable to inspect registration records.',
        }
      }
      return {
        success: false,
        registration: null,
        error: existingErr.message || 'Database error during duplicate check.',
      }
    }

    if (existingReg) {
      return {
        success: false,
        isDuplicate: true,
        registration: existingReg as unknown as HackathonRegistrationRecord,
        error: 'You are already registered for this hackathon.',
      }
    }
  } catch (err) {
    const categorized = categorizeDatabaseError(err)
    if (categorized.isMissingTable) {
      return {
        success: false,
        isPendingSchema: true,
        registration: null,
        error: "Table 'public.hackathon_registrations' has not yet been initialized in the database.",
      }
    }
    if (categorized.isNetworkError) {
      return {
        success: false,
        isNetworkError: true,
        registration: null,
        error: 'Network connection error: Unable to contact database server.',
      }
    }
    return {
      success: false,
      registration: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // 5. Build clean, sanitized persistence payload
  const insertPayload = {
    hackathon_id: hackathon.id,
    user_id: verifiedUserId,
    full_name: params.formData.fullName.trim(),
    email: verifiedUserEmail,
    university: params.formData.university.trim() || null,
    participation_type: params.formData.participationType,
    team_name: params.formData.participationType === 'team' ? params.formData.teamName.trim() : null,
    teammates:
      params.formData.participationType === 'team'
        ? params.formData.teammates.map((tm) => ({
            name: tm.name.trim(),
            email: tm.email.trim(),
          }))
        : [],
    confirmed_eligibility: params.formData.confirmedEligibility,
    accepted_rules: params.formData.acceptedRules,
    status: 'registered',
  }

  // 6. Execute insert with row-level security
  try {
    const { data: savedRecord, error: insertError } = await supabase
      .from('hackathon_registrations')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError) {
      const categorized = categorizeDatabaseError(insertError)
      if (categorized.isConflict) {
        return {
          success: false,
          isDuplicate: true,
          registration: null,
          error: 'You are already registered for this hackathon.',
        }
      }
      if (categorized.isMissingTable) {
        return {
          success: false,
          isPendingSchema: true,
          registration: null,
          error: "Table 'public.hackathon_registrations' has not yet been initialized in the database.",
        }
      }
      if (categorized.isNetworkError) {
        return {
          success: false,
          isNetworkError: true,
          registration: null,
          error: 'Network error: Failed to reach the database server while saving registration. Please check your connection.',
        }
      }
      if (categorized.isPermissionError) {
        return {
          success: false,
          isPermissionError: true,
          registration: null,
          error: 'Permission denied: Database security policies prevented saving this registration.',
        }
      }
      return {
        success: false,
        registration: null,
        error: insertError.message || 'Database error while saving registration.',
      }
    }

    if (!savedRecord) {
      return {
        success: false,
        registration: null,
        error: 'Failed to verify saved registration record from backend.',
      }
    }

    return {
      success: true,
      registration: savedRecord as HackathonRegistrationRecord,
      error: null,
    }
  } catch (err) {
    const categorized = categorizeDatabaseError(err)
    if (categorized.isMissingTable) {
      return {
        success: false,
        isPendingSchema: true,
        registration: null,
        error: "Table 'public.hackathon_registrations' has not yet been initialized in the database.",
      }
    }
    if (categorized.isNetworkError) {
      return {
        success: false,
        isNetworkError: true,
        registration: null,
        error: 'Network connection failure while submitting registration. Please check your connection.',
      }
    }
    return {
      success: false,
      registration: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Fetches all hackathon registrations belonging to the currently authenticated user.
 * Relies directly on Supabase session identity and database RLS policies.
 * Never trusts client-supplied user identifiers.
 */
export async function fetchMyRegistrations(): Promise<FetchMyRegistrationsResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return {
      registrations: [],
      error: 'Supabase client is not configured.',
      isPendingSchema: false,
    }
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        registrations: [],
        error: 'You must be signed in to view your registrations.',
        isPendingSchema: false,
        isUnauthenticated: true,
      }
    }

    // Query hackathon_registrations joined with public.hackathons
    // Notice RLS ensures user_id = auth.uid() at the database policy level
    const { data, error } = await supabase
      .from('hackathon_registrations')
      .select(`
        id,
        hackathon_id,
        user_id,
        full_name,
        email,
        university,
        participation_type,
        team_name,
        teammates,
        confirmed_eligibility,
        accepted_rules,
        status,
        created_at,
        updated_at,
        hackathon:hackathons (
          id,
          title,
          organizer,
          category,
          mode,
          location,
          start_date,
          end_date,
          registration_deadline,
          cover_image_url,
          status
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      const categorized = categorizeDatabaseError(error)
      if (categorized.isMissingTable) {
        return {
          registrations: [],
          error: "Table 'public.hackathon_registrations' has not yet been initialized in the database.",
          isPendingSchema: true,
        }
      }
      if (categorized.isNetworkError) {
        return {
          registrations: [],
          error: 'Network connection failure while fetching your registrations. Please check your connection.',
          isPendingSchema: false,
          isNetworkError: true,
        }
      }
      if (categorized.isPermissionError) {
        return {
          registrations: [],
          error: 'Permission denied: Database security policies prevented fetching your registrations.',
          isPendingSchema: false,
          isPermissionError: true,
        }
      }
      return {
        registrations: [],
        error: error.message || 'Failed to fetch registrations from the backend.',
        isPendingSchema: false,
      }
    }

    const normalizedRegistrations: UserRegistrationItem[] = (data || []).map((row: any) => {
      const hackathonObj = Array.isArray(row.hackathon) ? row.hackathon[0] : row.hackathon
      return {
        id: row.id,
        hackathon_id: row.hackathon_id,
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        university: row.university || null,
        participation_type: row.participation_type,
        team_name: row.team_name || null,
        teammates: Array.isArray(row.teammates) ? row.teammates : [],
        confirmed_eligibility: Boolean(row.confirmed_eligibility),
        accepted_rules: Boolean(row.accepted_rules),
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        hackathon: hackathonObj
          ? {
              id: hackathonObj.id,
              title: hackathonObj.title,
              organizer: hackathonObj.organizer,
              category: hackathonObj.category,
              mode: hackathonObj.mode,
              location: hackathonObj.location || null,
              start_date: hackathonObj.start_date || null,
              end_date: hackathonObj.end_date || null,
              registration_deadline: hackathonObj.registration_deadline || null,
              cover_image_url: hackathonObj.cover_image_url || null,
              status: hackathonObj.status || 'published',
              website_url: hackathonObj.website_url || null,
            }
          : null,
      }
    })

    return {
      registrations: normalizedRegistrations,
      error: null,
      isPendingSchema: false,
    }
  } catch (err) {
    const categorized = categorizeDatabaseError(err)
    if (categorized.isMissingTable) {
      return {
        registrations: [],
        error: "Table 'public.hackathon_registrations' has not yet been initialized in the database.",
        isPendingSchema: true,
      }
    }
    if (categorized.isNetworkError) {
      return {
        registrations: [],
        error: 'Network connection failure while fetching your registrations. Please check your connection.',
        isPendingSchema: false,
        isNetworkError: true,
      }
    }
    return {
      registrations: [],
      error: err instanceof Error ? err.message : String(err),
      isPendingSchema: false,
    }
  }
}



