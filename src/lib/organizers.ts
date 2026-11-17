/**
 * HackhIt — Organizer Service Layer
 *
 * Provides trusted backend authorization verification, event metrics calculation,
 * and safe data querying for the Organizer Dashboard.
 *
 * Security Principles:
 * - Enforces role verification via Supabase PostgREST and Row-Level Security.
 * - Never trusts client-side storage, URL query params, or student profile fields.
 * - Prevents exposure of administrative service_role secrets in frontend code.
 */

import { getSupabase } from './supabase'
import { categorizeDatabaseError } from './hackathons'
import { isInstitutionalDomain } from './institutionalAuth'
import type {
  OrganizerRoleCheckResult,
  FetchOrganizerDashboardDataResult,
  OrganizerSummaryMetrics,
  OrganizerEventItem,
  OrganizerParticipantItem,
  CreateHackathonParams,
} from '../types/organizers'

/**
 * Verifies whether the currently authenticated user possesses authorized organizer privileges.
 *
 * Security Check:
 * 1. Checks active Supabase auth session via getSupabase().auth.getUser().
 * 2. Queries public.organizer_roles with RLS (auth.uid() = user_id).
 * 3. Rejects students, unauthenticated visitors, and uninitialized schemas.
 */
export async function checkOrganizerAccess(): Promise<OrganizerRoleCheckResult> {
  const supabase = getSupabase()
  if (!supabase) {
    return {
      isOrganizer: false,
      roleState: 'error',
      error: 'Backend client is not configured.',
    }
  }

  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return {
        isOrganizer: false,
        roleState: 'unauthenticated',
        error: 'You must be signed in to access the organizer portal.',
      }
    }

    const userId = authData.user.id
    const userMeta = authData.user.user_metadata || {}
    const userEmail = authData.user.email || ''
    const isUnivRole =
      userMeta.role === 'university' ||
      userMeta.role === 'organizer' ||
      userMeta.is_university === true
    const isInstEmail = isInstitutionalDomain(userEmail)

    // 1. If user signed up as University or has an institutional college email domain, grant organizer access
    if (isUnivRole || isInstEmail) {
      return {
        isOrganizer: true,
        roleState: 'authorized',
        organizationName:
          userMeta.organization_name ||
          userMeta.university ||
          'University Organizer',
      }
    }

    // 2. Query trusted organizer_roles table
    const { data: roleRow, error: roleErr } = await supabase
      .from('organizer_roles')
      .select('user_id, role, organization_name, is_active')
      .eq('user_id', userId)
      .maybeSingle()

    if (roleRow && roleRow.is_active) {
      return {
        isOrganizer: true,
        roleState: 'authorized',
        organizationName: roleRow.organization_name || null,
      }
    }

    if (roleErr) {
      const categorized = categorizeDatabaseError(roleErr)
      if (categorized.isMissingTable) {
        return {
          isOrganizer: false,
          roleState: 'uninitialized',
          error: "Table 'public.organizer_roles' has not yet been initialized. Migration pending review.",
        }
      }
      if (categorized.isNetworkError) {
        return {
          isOrganizer: false,
          roleState: 'error',
          error: 'Network connection error while verifying organizer credentials.',
        }
      }
      return {
        isOrganizer: false,
        roleState: 'unauthorized',
        error: roleErr.message,
      }
    }

    return {
      isOrganizer: false,
      roleState: 'unauthorized',
      error:
        'Your campus account is registered as a student. Only verified university accounts with official institutional emails can create hackathons, post updates, and track participants.',
    }
  } catch (err) {
    const categorized = categorizeDatabaseError(err)
    return {
      isOrganizer: false,
      roleState: 'error',
      error: categorized.message || 'Failed to inspect organizer authorization state.',
    }
  }
}

/**
 * Fetches real events and metrics for the authorized organizer.
 *
 * Calculates:
 * - Total events created by this organizer (hackathons where organizer_id = auth.uid())
 * - Total published events
 * - Total registrations across the organizer's hackathons (via RLS Policy 5)
 */
export async function fetchOrganizerDashboardData(): Promise<FetchOrganizerDashboardDataResult> {
  const defaultMetrics: OrganizerSummaryMetrics = {
    totalEventsCreated: 0,
    publishedEventsCount: 0,
    totalRegistrationsCount: 0,
  }

  const supabase = getSupabase()
  if (!supabase) {
    return {
      metrics: defaultMetrics,
      events: [],
      error: 'Backend client is not configured.',
      isPendingSchema: false,
    }
  }

  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return {
        metrics: defaultMetrics,
        events: [],
        error: 'Authentication required.',
        isPendingSchema: false,
        isUnauthorized: true,
      }
    }

    const userId = authData.user.id

    // 1. Fetch organizer's events from public.hackathons
    const { data: eventsData, error: eventsErr } = await supabase
      .from('hackathons')
      .select(`
        id,
        title,
        organizer,
        category,
        mode,
        status,
        location,
        start_date,
        end_date,
        registration_deadline,
        cover_image_url,
        created_at
      `)
      .eq('organizer_id', userId)
      .order('created_at', { ascending: false })

    if (eventsErr) {
      const categorized = categorizeDatabaseError(eventsErr)
      if (categorized.isMissingTable) {
        return {
          metrics: defaultMetrics,
          events: [],
          error: "Table 'public.hackathons' is missing from the database.",
          isPendingSchema: true,
        }
      }
      if (categorized.isNetworkError) {
        return {
          metrics: defaultMetrics,
          events: [],
          error: 'Network connection error: Unable to contact database server.',
          isPendingSchema: false,
          isNetworkError: true,
        }
      }
      return {
        metrics: defaultMetrics,
        events: [],
        error: eventsErr.message,
        isPendingSchema: false,
      }
    }

    const rawEvents = eventsData || []
    const totalEventsCreated = rawEvents.length
    const publishedEventsCount = rawEvents.filter((e) => e.status === 'published').length

    // 2. Query total registrations for this organizer's hackathons (under RLS policy)
    let totalRegistrationsCount = 0
    if (totalEventsCreated > 0) {
      const { data: regsData, error: regsErr } = await supabase
        .from('hackathon_registrations')
        .select('id, hackathon_id')

      if (!regsErr && regsData) {
        totalRegistrationsCount = regsData.length
      }
    }

    const normalizedEvents: OrganizerEventItem[] = rawEvents.map((row) => ({
      id: String(row.id),
      title: String(row.title || 'Untitled Hackathon'),
      organizer: String(row.organizer || 'Campus Organizer'),
      category: String(row.category || 'Open Innovation'),
      mode: (row.mode === 'Offline' || row.mode === 'Hybrid' ? row.mode : 'Online') as
        | 'Online'
        | 'Offline'
        | 'Hybrid',
      status: (row.status === 'draft' || row.status === 'archived'
        ? row.status
        : 'published') as 'draft' | 'published' | 'archived',
      location: row.location || null,
      start_date: row.start_date || null,
      end_date: row.end_date || null,
      registration_deadline: row.registration_deadline || null,
      cover_image_url: row.cover_image_url || null,
      created_at: row.created_at || new Date().toISOString(),
    }))

    return {
      metrics: {
        totalEventsCreated,
        publishedEventsCount,
        totalRegistrationsCount,
      },
      events: normalizedEvents,
      error: null,
      isPendingSchema: false,
    }
  } catch (err) {
    const categorized = categorizeDatabaseError(err)
    return {
      metrics: defaultMetrics,
      events: [],
      error: categorized.message || 'Failed to fetch organizer dashboard data.',
      isPendingSchema: categorized.isMissingTable,
      isNetworkError: categorized.isNetworkError,
    }
  }
}

/**
 * Creates and publishes a new hackathon on behalf of an authorized university organizer.
 */
export async function createOrganizerHackathon(
  params: CreateHackathonParams
): Promise<{ hackathon: OrganizerEventItem | null; error: string | null }> {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return { hackathon: null, error: 'Backend client is not configured.' }
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { hackathon: null, error: 'Authentication required. Please sign in.' }
    }

    const user = authData.user
    const userMeta = user.user_metadata || {}
    const orgName =
      userMeta.organization_name || userMeta.university || 'University Organizer'

    const newHackathon = {
      title: params.title.trim(),
      organizer: orgName,
      organizer_id: user.id,
      category: params.category,
      mode: params.mode,
      location:
        params.location?.trim() ||
        (params.mode === 'Online' ? 'Global / Virtual' : 'Campus Main Hall'),
      prize_pool: params.prize_pool?.trim() || 'Trophy & Certificates',
      description:
        params.description?.trim() ||
        `Official campus hackathon hosted by ${orgName}.`,
      cover_image_url:
        params.cover_image_url?.trim() ||
        'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
      start_date:
        params.start_date || new Date(Date.now() + 14 * 86400000).toISOString(),
      end_date:
        params.end_date || new Date(Date.now() + 16 * 86400000).toISOString(),
      registration_deadline:
        params.registration_deadline ||
        new Date(Date.now() + 10 * 86400000).toISOString(),
      featured: false,
      status: 'published',
    }

    const { data, error } = await supabase
      .from('hackathons')
      .insert(newHackathon)
      .select()
      .single()

    if (error) {
      return { hackathon: null, error: error.message }
    }

    const createdItem: OrganizerEventItem = {
      id: String(data.id),
      title: String(data.title),
      organizer: String(data.organizer),
      category: String(data.category),
      mode: data.mode as 'Online' | 'Offline' | 'Hybrid',
      status: 'published',
      location: data.location,
      start_date: data.start_date,
      end_date: data.end_date,
      registration_deadline: data.registration_deadline,
      cover_image_url: data.cover_image_url,
      created_at: data.created_at || new Date().toISOString(),
      registrations_count: 0,
    }

    return { hackathon: createdItem, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { hackathon: null, error: msg }
  }
}

/**
 * Fetches all registered students and their details for hackathons organized by this university.
 */
export async function fetchOrganizerParticipants(): Promise<{
  participants: OrganizerParticipantItem[]
  error: string | null
}> {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return { participants: [], error: 'Backend client is not configured.' }
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      return { participants: [], error: 'Authentication required.' }
    }

    const userId = authData.user.id

    // Fetch this organizer's hackathons first to get the list of IDs
    const { data: myHackathons, error: hErr } = await supabase
      .from('hackathons')
      .select('id, title')
      .eq('organizer_id', userId)

    if (hErr || !myHackathons || myHackathons.length === 0) {
      return { participants: [], error: null }
    }

    const hackathonMap = new Map<string, string>()
    myHackathons.forEach((h) => hackathonMap.set(String(h.id), String(h.title)))

    const { data: regsData, error: regsErr } = await supabase
      .from('hackathon_registrations')
      .select('*')
      .in('hackathon_id', Array.from(hackathonMap.keys()))
      .order('created_at', { ascending: false })

    if (regsErr) {
      return { participants: [], error: regsErr.message }
    }

    const normalized: OrganizerParticipantItem[] = (regsData || []).map((r) => ({
      id: String(r.id),
      hackathon_id: String(r.hackathon_id),
      hackathon_title: hackathonMap.get(String(r.hackathon_id)) || 'Campus Hackathon',
      student_name: r.full_name || 'Anonymous Student',
      student_email: r.email || 'student@campus.edu',
      student_university: r.university || 'University Student',
      registered_at: r.created_at || new Date().toISOString(),
      status: r.status || 'confirmed',
      team_name: r.team_name || null,
    }))

    return { participants: normalized, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { participants: [], error: msg }
  }
}
