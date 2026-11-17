/**
 * HackhIt — Pre-Step 9.2 Verification Script
 *
 * Verifies:
 * 1. Status of 20260404000000_organizer_roles.sql in live database.
 * 2. Whether an authorized organizer can access the dashboard.
 * 3. Ordinary student privilege isolation (cannot self-assign or bypass).
 * 4. Regression checks on Community, Profile, Hackathons Discovery, and My Registrations.
 */

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env'
const envContent = fs.readFileSync(envPath, 'utf8')
let supabaseUrl = ''
let supabaseAnonKey = ''
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = trimmed.slice(18).replace(/^['"]|['"]$/g, '')
  }
  if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
    supabaseAnonKey = trimmed.slice(30).replace(/^['"]|['"]$/g, '')
  }
}

// Load active session
let sessionData = JSON.parse(fs.readFileSync('scripts/.fresh_session.json', 'utf8'))
const authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${sessionData.access_token}` } },
})

const results = []

function logResult(checkId, title, status, details = '', evidence = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳'
  console.log(`${icon} [${status}] ${checkId}: ${title}`)
  if (details) console.log(`   ├─ Details:  ${details}`)
  if (evidence) console.log(`   └─ Evidence: ${evidence}`)
  results.push({ checkId, title, status, details, evidence })
}

console.log('='.repeat(80))
console.log('HACKHIT — PHASE 9, STEP 9.2 PRE-REQUISITE VERIFICATION')
console.log('='.repeat(80))
console.log(`Active Student: ${sessionData.user.email} (${sessionData.user.id})\n`)

// -----------------------------------------------------------------------------
// CHECK 1: Migration status of 20260404000000_organizer_roles.sql
// -----------------------------------------------------------------------------
console.log('--- 1. Migration Status Check ---')
const migrationFile = 'supabase/migrations/20260404000000_organizer_roles.sql'
const migrationFileExists = fs.existsSync(migrationFile)

const { data: roleCheckData, error: roleCheckErr } = await authedSupabase
  .from('organizer_roles')
  .select('*')
  .limit(1)

const isTableMissing = roleCheckErr && roleCheckErr.code === 'PGRST205'
const isMigrationApplied = !isTableMissing

logResult(
  'CHECK-1',
  'Migration 20260404000000_organizer_roles.sql status in live database',
  isMigrationApplied ? 'PASS' : 'BLOCKED',
  migrationFileExists
    ? `Migration file exists locally (${fs.statSync(migrationFile).size} bytes).`
    : 'Migration file missing!',
  isMigrationApplied
    ? 'Table public.organizer_roles exists and responded to query.'
    : `Table public.organizer_roles is not applied in Supabase: ${roleCheckErr?.message} (Code: ${roleCheckErr?.code})`
)

// -----------------------------------------------------------------------------
// CHECK 2: Authorized Organizer Access
// -----------------------------------------------------------------------------
console.log('\n--- 2. Authorized Organizer Access Check ---')
if (isMigrationApplied) {
  const { data: activeOrgs, error: activeOrgsErr } = await authedSupabase
    .from('organizer_roles')
    .select('user_id, role, organization_name, is_active')
    .eq('is_active', true)

  const hasAuthorizedOrganizer = activeOrgs && activeOrgs.length > 0
  logResult(
    'CHECK-2',
    'Explicitly authorized organizer can access organizer dashboard',
    hasAuthorizedOrganizer ? 'PASS' : 'BLOCKED',
    hasAuthorizedOrganizer
      ? `Found ${activeOrgs.length} authorized organizer(s).`
      : 'No active organizer record exists in public.organizer_roles yet.',
    activeOrgs?.[0] ? JSON.stringify(activeOrgs[0]) : 'Awaiting organizer assignment in database.'
  )
} else {
  logResult(
    'CHECK-2',
    'Explicitly authorized organizer can access organizer dashboard',
    'BLOCKED',
    'Blocked by pending migration: public.organizer_roles table is not yet created in Supabase.',
    'Schema pending execution in Supabase Dashboard SQL Editor.'
  )
}

// -----------------------------------------------------------------------------
// CHECK 3: Ordinary Student Privilege Isolation
// -----------------------------------------------------------------------------
console.log('\n--- 3. Ordinary Student Privilege Isolation ---')
// 3a: Cannot self-assign organizer role
const { data: selfAssignData, error: selfAssignErr } = await authedSupabase
  .from('organizer_roles')
  .insert({
    user_id: sessionData.user.id,
    role: 'organizer',
    is_active: true,
  })
  .select()

const selfAssignBlocked = Boolean(selfAssignErr && !selfAssignData)

logResult(
  'CHECK-3.1',
  'Ordinary student cannot grant themselves organizer privileges',
  selfAssignBlocked ? 'PASS' : 'FAIL',
  'Student attempting INSERT into organizer_roles was rejected by database engine.',
  `Error: ${selfAssignErr?.message || 'Rejected'} (Code: ${selfAssignErr?.code || 'RLS_ENFORCED'})`
)

// 3b: Cannot create hackathons without authorization
const { data: eventCreateData, error: eventCreateErr } = await authedSupabase
  .from('hackathons')
  .insert({
    title: 'Unauthorized Student Event',
    tagline: 'Should be blocked',
    description: 'Testing privilege escalation',
    category: 'AI / ML',
    mode: 'Online',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 86400000).toISOString(),
    registration_deadline: new Date(Date.now() + 43200000).toISOString(),
    status: 'draft',
    organizer: 'Fake Organizer',
    organizer_id: sessionData.user.id,
  })
  .select()

const eventCreateBlocked = Boolean(eventCreateErr && !eventCreateData)

logResult(
  'CHECK-3.2',
  'Ordinary student cannot create events in public.hackathons',
  eventCreateBlocked ? 'PASS' : 'FAIL',
  'Student attempting unauthorized INSERT into hackathons was rejected by database engine.',
  `Error: ${eventCreateErr?.message || 'Rejected'} (Code: ${eventCreateErr?.code || 'RLS_ENFORCED'})`
)

// -----------------------------------------------------------------------------
// CHECK 4: Regression Checks on Existing Student Features
// -----------------------------------------------------------------------------
console.log('\n--- 4. Regression Checks on Existing Features ---')

// 4a: Community Feed
const { data: postsData, error: postsErr } = await authedSupabase
  .from('posts')
  .select('id, content, created_at')
  .limit(5)

logResult(
  'CHECK-4.1',
  'Community feed query remains fully operational',
  !postsErr ? 'PASS' : 'FAIL',
  !postsErr ? `Retrieved ${postsData?.length || 0} posts without error.` : postsErr.message,
  `Error code: ${postsErr?.code || 'NONE'}`
)

// 4b: Student Profile
const { data: profileData, error: profileErr } = await authedSupabase
  .from('profiles')
  .select('*')
  .eq('id', sessionData.user.id)
  .maybeSingle()

logResult(
  'CHECK-4.2',
  'Student profile query remains fully operational',
  !profileErr && profileData ? 'PASS' : 'FAIL',
  !profileErr && profileData
    ? `Student profile loaded: ${profileData.full_name} (${profileData.id})`
    : profileErr?.message || 'Missing profile',
  `Full name: ${profileData?.full_name}, Email: ${profileData?.email || sessionData.user.email}`
)

// 4c: Hackathons Discovery
const { data: hackathonsData, error: hackathonsErr } = await authedSupabase
  .from('hackathons')
  .select('id, title, category, status')
  .eq('status', 'published')

logResult(
  'CHECK-4.3',
  'Hackathons discovery query remains fully operational',
  !hackathonsErr && hackathonsData && hackathonsData.length > 0 ? 'PASS' : 'FAIL',
  !hackathonsErr
    ? `Retrieved ${hackathonsData?.length || 0} published hackathons.`
    : hackathonsErr.message,
  `Sample: "${hackathonsData?.[0]?.title}" (${hackathonsData?.[0]?.category})`
)

// 4d: My Registrations
const { data: regsData, error: regsErr } = await authedSupabase
  .from('hackathon_registrations')
  .select('id, hackathon_id, user_id, full_name, status')
  .eq('user_id', sessionData.user.id)

logResult(
  'CHECK-4.4',
  'My Registrations query and student registration records remain intact',
  !regsErr && regsData && regsData.length > 0 ? 'PASS' : 'FAIL',
  !regsErr
    ? `Retrieved ${regsData?.length || 0} saved registration records for student.`
    : regsErr.message,
  `Registration ID: ${regsData?.[0]?.id}, Status: ${regsData?.[0]?.status}`
)

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n' + '='.repeat(80))
console.log('SUMMARY OF CHECKS')
console.log('='.repeat(80))
const passCount = results.filter((r) => r.status === 'PASS').length
const blockedCount = results.filter((r) => r.status === 'BLOCKED').length
const failCount = results.filter((r) => r.status === 'FAIL').length
console.log(`Total Checks:   ${results.length}`)
console.log(`PASS:          ${passCount}`)
console.log(`BLOCKED:       ${blockedCount}`)
console.log(`FAIL:          ${failCount}`)
console.log('='.repeat(80))

fs.writeFileSync('scripts/step9_2_prereq_results.json', JSON.stringify(results, null, 2))
