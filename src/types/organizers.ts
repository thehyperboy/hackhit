/**
 * HackhIt — Organizer Dashboard Types
 */

export type OrganizerRoleState =
  | 'authorized'
  | 'unauthorized'
  | 'unauthenticated'
  | 'uninitialized'
  | 'error'

export interface OrganizerRoleCheckResult {
  isOrganizer: boolean
  roleState: OrganizerRoleState
  organizationName?: string | null
  error?: string | null
}

export interface OrganizerSummaryMetrics {
  totalEventsCreated: number
  publishedEventsCount: number
  totalRegistrationsCount: number
}

export interface OrganizerEventItem {
  id: string
  title: string
  organizer: string
  category: string
  mode: 'Online' | 'Offline' | 'Hybrid'
  status: 'draft' | 'published' | 'archived'
  location?: string | null
  start_date?: string | null
  end_date?: string | null
  registration_deadline?: string | null
  cover_image_url?: string | null
  created_at: string
  registrations_count?: number
}

export interface FetchOrganizerDashboardDataResult {
  metrics: OrganizerSummaryMetrics
  events: OrganizerEventItem[]
  error: string | null
  isPendingSchema: boolean
  isUnauthorized?: boolean
  isNetworkError?: boolean
}
