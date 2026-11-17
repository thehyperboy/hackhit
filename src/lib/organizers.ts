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
import type {
  OrganizerRoleCheckResult,
  FetchOrganizerDashboardDataResult,
  OrganizerSummaryMetrics,
  OrganizerEventItem,
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

    // Query trusted organizer_roles table
    const { data: roleRow, error: roleErr } = await supabase
      .from('organizer_roles')
      .select('user_id, role, organization_name, is_active')
      .eq('user_id', userId)
      .maybeSingle()

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

    if (roleRow && roleRow.is_active) {
      return {
        isOrganizer: true,
        roleState: 'authorized',
        organizationName: roleRow.organization_name || null,
      }
    }

    return {
      isOrganizer: false,
      roleState: 'unauthorized',
      error: 'Your campus account is not registered as an authorized organizer.',
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
