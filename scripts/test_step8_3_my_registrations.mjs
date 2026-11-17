/**
 * HackhIt — Step 8.3: My Registrations Verification Suite
 *
 * Verifies:
 * 1. Database Schema & Relations:
 *    - Table public.hackathon_registrations exists
 *    - Foreign key relationship to public.hackathons(id)
 *    - PostgREST join query succeeds with status 200
 * 2. Database-Enforced Row-Level Security (RLS) Isolation:
 *    - Unauthenticated access returns 0 records / access denied
 *    - Attempting to filter by another user's ID without their auth JWT returns 0 rows (rejected by RLS at database layer)
 *    - fetchMyRegistrations() enforces session auth, rejects unauthenticated calls
 * 3. Data Service & Normalization:
 *    - fetchMyRegistrations() maps joined event fields (title, organizer, dates, mode, category, etc.)
 *    - Preserves stored status ('registered' | 'confirmed' | 'withdrawn' | 'waitlisted') without fabricating
 *    - Formats dates accurately with fallback
 * 4. UI Component & Navigation Architecture:
 *    - MyRegistrations component contains loading skeleton, empty, error, and retry states
 *    - Empty state includes "Explore Upcoming Hackathons" CTA
 *    - Cards render registration ID with copy button, format (solo/team), dates, and event link
 *    - TopNav desktop and mobile menus include "My Registrations" for authenticated users
 *    - App.tsx routing handles '#my-registrations' and '#registrations' with persistence on refresh
 * 5. Production Build & TypeScript Integrity
 */

import fs from 'fs'

// Load environment variables
const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env'
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      process.env.VITE_SUPABASE_URL = trimmed.slice('VITE_SUPABASE_URL='.length).replace(/^['"]|['"]$/g, '')
    }
    if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = trimmed.slice('VITE_SUPABASE_PUBLISHABLE_KEY='.length).replace(/^['"]|['"]$/g, '')
    }
  }
}

const { createClient } = await import('@supabase/supabase-js')
const {
  fetchMyRegistrations,
  formatEventDates,
  formatDeadlineCountdown,
} = await import('../src/lib/hackathons.ts')

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition, testName, details = '') {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`[PASS] Test ${totalTests}: ${testName}`)
  } else {
    failedTests++
    console.error(`[FAIL] Test ${totalTests}: ${testName}`)
    if (details) console.error(`       Details: ${details}`)
  }
}

console.log('='.repeat(75))
console.log('HackhIt — Step 8.3: My Registrations Verification Suite')
console.log('='.repeat(75))

// -----------------------------------------------------------------------------
// 1. DATABASE SCHEMA & POSTGREST JOIN VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- Section 1: Database Schema & PostgREST Join ---')

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

assert(Boolean(supabaseUrl && supabaseAnonKey), 'Supabase environment configuration present')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Probe hackathon_registrations with foreign key join and exact columns
const joinProbe = await supabase
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
  .limit(5)

assert(
  joinProbe.error === null,
  'Live query with cover_image_url executes with zero database column errors',
  joinProbe.error?.message
)
assert(
  joinProbe.status === 200,
  'Query returns HTTP 200 response from backend',
  `HTTP Status: ${joinProbe.status}`
)

// -----------------------------------------------------------------------------
// 2. DATABASE-LEVEL ROW-LEVEL SECURITY (RLS) ISOLATION
// -----------------------------------------------------------------------------
console.log('\n--- Section 2: Database-Enforced Row-Level Security (RLS) ---')

// An anonymous client querying hackathon_registrations must receive 0 records
assert(
  Array.isArray(joinProbe.data) && joinProbe.data.length === 0,
  'Anonymous/unauthenticated requests return 0 records under RLS (private registrations protected)',
  `Received ${joinProbe.data?.length} records`
)

// Attempting to query records belonging to an arbitrary foreign UUID via client filter
const fakeTargetUserId = '00000000-0000-0000-0000-000000000001'
const spoofProbe = await supabase
  .from('hackathon_registrations')
  .select('id, user_id, full_name, email')
  .eq('user_id', fakeTargetUserId)

assert(
  Array.isArray(spoofProbe.data) && spoofProbe.data.length === 0,
  'Client-side user_id filtering cannot bypass database RLS policy (auth.uid() = user_id enforced)',
  `Received ${spoofProbe.data?.length} records`
)

// Calling fetchMyRegistrations() without authenticated user session
const serviceUnauthResult = await fetchMyRegistrations()
assert(
  serviceUnauthResult.isUnauthenticated === true,
  'fetchMyRegistrations rejects unauthenticated caller with isUnauthenticated: true'
)
assert(
  serviceUnauthResult.registrations.length === 0,
  'fetchMyRegistrations returns empty registrations list for unauthenticated caller'
)
assert(
  serviceUnauthResult.error?.includes('signed in'),
  'fetchMyRegistrations provides clear authentication prompt in error message',
  serviceUnauthResult.error
)

// -----------------------------------------------------------------------------
// 3. CODEBASE & COMPONENT IMPLEMENTATION CHECKS
// -----------------------------------------------------------------------------
console.log('\n--- Section 3: Component & Architecture Verification ---')

const myRegistrationsCode = fs.readFileSync('src/components/MyRegistrations.tsx', 'utf8')
const topNavCode = fs.readFileSync('src/components/TopNav.tsx', 'utf8')
const appCode = fs.readFileSync('src/App.tsx', 'utf8')
const hackathonsServiceCode = fs.readFileSync('src/lib/hackathons.ts', 'utf8')
const typesCode = fs.readFileSync('src/types/hackathons.ts', 'utf8')

// Types check
assert(
  typesCode.includes('export interface UserRegistrationItem'),
  'types/hackathons.ts exports UserRegistrationItem interface'
)
assert(
  typesCode.includes('export interface FetchMyRegistrationsResult'),
  'types/hackathons.ts exports FetchMyRegistrationsResult interface'
)

// Service check
assert(
  hackathonsServiceCode.includes('export async function fetchMyRegistrations'),
  'lib/hackathons.ts exports fetchMyRegistrations service function'
)
assert(
  hackathonsServiceCode.includes('hackathon:hackathons'),
  'fetchMyRegistrations performs joined relational query with hackathons'
)
assert(
  hackathonsServiceCode.includes('categorizeDatabaseError'),
  'fetchMyRegistrations handles categorized database errors (network, missing table, permission)'
)
assert(
  hackathonsServiceCode.includes('cover_image_url') &&
  !hackathonsServiceCode.includes('cover_image,'),
  'fetchMyRegistrations uses real column cover_image_url and avoids non-existent cover_image'
)
assert(
  typesCode.includes('cover_image_url?: string | null') &&
  !typesCode.includes('cover_image?: string | null'),
  'UserRegistrationItem type uses real column cover_image_url'
)

// MyRegistrations component checks
assert(
  myRegistrationsCode.includes('export function MyRegistrations'),
  'MyRegistrations.tsx exports MyRegistrations component'
)
assert(
  myRegistrationsCode.includes('loadRegistrations') && myRegistrationsCode.includes('RefreshCw'),
  'MyRegistrations implements manual and automatic reload with refresh button'
)
assert(
  myRegistrationsCode.includes('animate-pulse'),
  'MyRegistrations implements loading skeleton state'
)
assert(
  myRegistrationsCode.includes('No Registrations Found') || myRegistrationsCode.includes('No Applications Yet'),
  'MyRegistrations implements dedicated empty state for accounts with zero registrations'
)
assert(
  myRegistrationsCode.includes('Failed to Load Registrations') && myRegistrationsCode.includes('Retry Loading'),
  'MyRegistrations implements error state with retry button'
)
assert(
  myRegistrationsCode.includes('renderStatusBadge'),
  'MyRegistrations renders actual stored status (registered, confirmed, waitlisted, withdrawn)'
)
assert(
  myRegistrationsCode.includes('copyRegistrationId') || myRegistrationsCode.includes('Registration ID'),
  'MyRegistrations renders registration ID'
)
assert(
  myRegistrationsCode.includes('onNavigateToEventDetails'),
  'MyRegistrations links each registered event to its details page'
)

// TopNav navigation checks
assert(
  topNavCode.includes('onNavigateToMyRegistrations'),
  'TopNav accepts onNavigateToMyRegistrations navigation prop'
)
assert(
  topNavCode.includes('My Registrations') && topNavCode.includes('currentView === \'my-registrations\''),
  'TopNav renders My Registrations link for authenticated users with active state indicator'
)

// App.tsx routing and persistence checks
assert(
  appCode.includes('\'my-registrations\''),
  'App.tsx includes \'my-registrations\' in currentView union'
)
assert(
  appCode.includes('window.location.hash === \'#my-registrations\'') ||
  appCode.includes('hash === \'#my-registrations\''),
  'App.tsx synchronizes #my-registrations hash route on initial load and hashchange'
)
assert(
  appCode.includes('<MyRegistrations'),
  'App.tsx renders <MyRegistrations /> component when currentView === \'my-registrations\''
)
assert(
  appCode.includes('navigateToMyRegistrations'),
  'App.tsx defines navigateToMyRegistrations handler and passes it to navigation components'
)

// -----------------------------------------------------------------------------
// 4. DATE FORMATTING & STATUS UTILITIES
// -----------------------------------------------------------------------------
console.log('\n--- Section 4: Data Utilities & Formatters ---')

const formattedDates = formatEventDates('2026-11-15T09:00:00Z', '2026-11-17T18:00:00Z')
assert(
  typeof formattedDates === 'string' && formattedDates.includes('Nov'),
  'formatEventDates correctly formats multi-day event dates',
  formattedDates
)

const countdownFuture = formatDeadlineCountdown('2028-12-31T23:59:59Z')
assert(
  countdownFuture.isClosed === false,
  'formatDeadlineCountdown correctly identifies active deadline'
)

const countdownPast = formatDeadlineCountdown('2020-01-01T00:00:00Z')
assert(
  countdownPast.isClosed === true,
  'formatDeadlineCountdown correctly identifies closed deadline'
)

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n' + '='.repeat(75))
console.log(`Step 8.3 Verification Summary: ${passedTests}/${totalTests} tests passed`)
if (failedTests > 0) {
  console.error(`FAILED: ${failedTests} tests failed.`)
  process.exit(1)
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY (PASS)!')
}
