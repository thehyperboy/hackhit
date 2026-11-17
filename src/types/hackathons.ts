/**
 * HackhIt — Hackathon Discovery Types
 */

export type HackathonCategory =
  | 'All'
  | 'AI/ML'
  | 'Web Development'
  | 'Blockchain'
  | 'Data Science'
  | 'Open Innovation'

export type ParticipationMode = 'All' | 'Online' | 'Offline' | 'Hybrid'

export type DeadlineSort = 'closing-soon' | 'closing-later'

export interface Hackathon {
  id: string
  title: string
  organizer: string
  category: string
  mode: 'Online' | 'Offline' | 'Hybrid'
  location?: string | null
  cover_image_url?: string | null
  registration_deadline?: string | null // ISO date string or null
  start_date?: string | null // ISO date string or null
  end_date?: string | null // ISO date string or null
  prize_pool?: string | null
  description?: string | null
  eligibility?: string | null
  rules?: string | null
  schedule?: string | null
  website_url?: string | null
  featured?: boolean
  status?: 'draft' | 'published' | 'archived'
  organizer_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface HackathonFilterState {
  searchQuery: string
  category: HackathonCategory
  mode: ParticipationMode
  sortBy: DeadlineSort
}

export type ParticipationType = 'individual' | 'team'

export interface TeammateInfo {
  name: string
  email: string
}

export interface RegistrationFormData {
  fullName: string
  email: string
  university: string
  participationType: ParticipationType
  teamName: string
  teammates: TeammateInfo[]
  confirmedEligibility: boolean
  acceptedRules: boolean
}

export interface RegistrationFieldErrors {
  fullName?: string
  email?: string
  university?: string
  participationType?: string
  teamName?: string
  teammates?: { [index: number]: { name?: string; email?: string } }
  confirmedEligibility?: string
  acceptedRules?: string
  general?: string
}

export interface HackathonRegistrationRecord {
  id: string
  hackathon_id: string
  user_id: string
  full_name: string
  email: string
  university?: string | null
  participation_type: ParticipationType
  team_name?: string | null
  teammates?: TeammateInfo[]
  confirmed_eligibility: boolean
  accepted_rules: boolean
  status: 'registered' | 'confirmed' | 'withdrawn' | 'waitlisted'
  created_at: string
  updated_at: string
}

export interface SubmitRegistrationResult {
  success: boolean
  registration: HackathonRegistrationRecord | null
  error: string | null
  isDuplicate?: boolean
  isClosed?: boolean
  isPendingSchema?: boolean
  isNetworkError?: boolean
  isPermissionError?: boolean
}

export interface UserRegistrationItem extends HackathonRegistrationRecord {
  hackathon?: {
    id: string
    title: string
    organizer: string
    category: string
    mode: 'Online' | 'Offline' | 'Hybrid'
    location?: string | null
    start_date?: string | null
    end_date?: string | null
    registration_deadline?: string | null
    cover_image_url?: string | null
    status?: 'draft' | 'published' | 'archived'
    website_url?: string | null
  } | null
}

export interface FetchMyRegistrationsResult {
  registrations: UserRegistrationItem[]
  error: string | null
  isPendingSchema: boolean
  isUnauthenticated?: boolean
  isNetworkError?: boolean
  isPermissionError?: boolean
}
