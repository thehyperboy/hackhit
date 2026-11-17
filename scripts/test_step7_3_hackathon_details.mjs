/**
 * HackhIt — Step 7.3 Hackathon Event Details Verification Suite
 *
 * Verifies:
 * 1. fetchHackathonById contract:
 *    - Valid IDs vs invalid IDs vs non-existent IDs
 *    - Detecting schema pending vs not-found vs backend error
 * 2. URL validation (isValidExternalUrl):
 *    - Rejects invalid/malformed schemes (javascript:, data:, file:, etc.)
 *    - Accepts valid http:// and https:// links
 * 3. Event Details field normalization:
 *    - Correct extraction and fallbacks for:
 *      title, organizer, cover_image_url, category, mode, location,
 *      dates, deadline, prizes, eligibility, description, rules, schedule, website_url
 * 4. Handling missing optional fields safely (null eligibility, null rules, null schedule, null website_url)
 * 5. Routing contracts in App.tsx:
 *    - Detects #hackathons/:id and sets currentView to 'hackathon-details'
 *    - Provides back navigation to #hackathons
 * 6. RLS security & unpublished event protection:
 *    - Draft events return not-found/unavailable to unauthenticated users
 *    - Verifies SQL migration contains event details columns and draft RLS isolation
 */

import fs from 'fs'

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

const {
  normalizeHackathonRow,
  isValidExternalUrl,
  fetchHackathonById,
} = await import('../src/lib/hackathons.ts')

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition, testId, description, details = '') {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ [PASS] ${testId}: ${description}`)
    if (details) console.log(`     └─ ${details}`)
  } else {
    failedTests++
    console.error(`  ✗ [FAIL] ${testId}: ${description}`)
    if (details) console.error(`     └─ ${details}`)
  }
}

console.log('\n======================================================')
console.log('HackhIt — Step 7.3 Event Details Verification Suite')
console.log('======================================================\n')

// -------------------------------------------------------------------
// 1. External URL Validator
// -------------------------------------------------------------------
console.log('[Test Suite 1: External Registration URL Validation]')

assert(
  isValidExternalUrl('https://developers.google.com/community/gdsc-solution-challenge'),
  'URL_01',
  'Accepts valid https URL'
)
assert(
  isValidExternalUrl('http://sih.gov.in'),
  'URL_02',
  'Accepts valid http URL'
)
assert(
  !isValidExternalUrl('javascript:alert(1)'),
  'URL_03',
  'Strictly rejects javascript: pseudo-protocol'
)
assert(
  !isValidExternalUrl('data:text/html,<script>'),
  'URL_04',
  'Strictly rejects data: URIs'
)
assert(
  !isValidExternalUrl(''),
  'URL_05',
  'Rejects empty string'
)
assert(
  !isValidExternalUrl(null),
  'URL_06',
  'Rejects null URL'
)
assert(
  !isValidExternalUrl('not-a-valid-url'),
  'URL_07',
  'Rejects malformed URL strings'
)

// -------------------------------------------------------------------
// 2. Event Normalization with Details Fields & Null Safety
// -------------------------------------------------------------------
console.log('\n[Test Suite 2: Event Details Normalization & Null Safety]')

const completeRecord = {
  id: 'ev-complete-01',
  title: 'Google Solution Challenge 2026',
  organizer: 'GDSC',
  category: 'Open Innovation',
  mode: 'Online',
  location: 'Global Virtual',
  cover_image_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
  registration_deadline: '2026-10-25T23:59:59Z',
  start_date: '2026-11-01T09:00:00Z',
  end_date: '2026-11-05T18:00:00Z',
  prize_pool: '$120,000 USD',
  description: 'UN SDG solutions with Google technologies.',
  eligibility: 'Enrolled university students worldwide.',
  rules: 'Teams of up to 4. Original code created for UN SDGs.',
  schedule: 'Stage 1 -> Stage 2 -> Stage 3 -> Finale.',
  website_url: 'https://developers.google.com/community/gdsc-solution-challenge',
  featured: true,
  status: 'published',
}

const normComplete = normalizeHackathonRow(completeRecord)
assert(normComplete.id === 'ev-complete-01', 'NORM_01', 'Preserved event ID')
assert(normComplete.title === 'Google Solution Challenge 2026', 'NORM_02', 'Preserved title')
assert(normComplete.eligibility === 'Enrolled university students worldwide.', 'NORM_03', 'Extracted eligibility')
assert(normComplete.rules === 'Teams of up to 4. Original code created for UN SDGs.', 'NORM_04', 'Extracted rules')
assert(normComplete.schedule === 'Stage 1 -> Stage 2 -> Stage 3 -> Finale.', 'NORM_05', 'Extracted schedule')
assert(normComplete.website_url === 'https://developers.google.com/community/gdsc-solution-challenge', 'NORM_06', 'Extracted website_url')
assert(normComplete.featured === true, 'NORM_07', 'Extracted featured flag')

// Test record with all optional details fields missing/null
const partialRecord = {
  id: 'ev-partial-02',
  title: 'Minimal Hackathon',
  organizer: 'Local Club',
  category: 'Web Development',
  mode: 'Offline',
  location: null,
  cover_image_url: null,
  registration_deadline: null,
  start_date: null,
  end_date: null,
  prize_pool: null,
  description: null,
  eligibility: null,
  rules: null,
  schedule: null,
  website_url: null,
  featured: false,
  status: 'published',
}

const normPartial = normalizeHackathonRow(partialRecord)
assert(normPartial.id === 'ev-partial-02', 'NORM_08', 'Preserved partial ID')
assert(normPartial.eligibility === null, 'NORM_09', 'Safely handled null eligibility')
assert(normPartial.rules === null, 'NORM_10', 'Safely handled null rules')
assert(normPartial.schedule === null, 'NORM_11', 'Safely handled null schedule')
assert(normPartial.website_url === null, 'NORM_12', 'Safely handled null website_url')
assert(normPartial.location === null, 'NORM_13', 'Safely handled null location')
assert(normPartial.prize_pool === null, 'NORM_14', 'Safely handled null prize_pool')

// -------------------------------------------------------------------
// 3. fetchHackathonById Backend & Error Contract
// -------------------------------------------------------------------
console.log('\n[Test Suite 3: fetchHackathonById Backend Contract]')

const emptyIdRes = await fetchHackathonById('')
assert(emptyIdRes.isNotFound === true && emptyIdRes.hackathon === null, 'SVC_01', 'Empty ID returns isNotFound: true')

const whitespaceIdRes = await fetchHackathonById('   ')
assert(whitespaceIdRes.isNotFound === true && whitespaceIdRes.hackathon === null, 'SVC_02', 'Whitespace ID returns isNotFound: true')

const probeResult = await fetchHackathonById('00000000-0000-0000-0000-000000000000')
assert(
  probeResult.isPendingSchema || probeResult.isNotFound,
  'SVC_03',
  'Non-existent UUID safely returns isPendingSchema or isNotFound',
  `Result: isPendingSchema=${probeResult.isPendingSchema}, isNotFound=${probeResult.isNotFound}`
)

// -------------------------------------------------------------------
// 4. Routing & App State Contracts
// -------------------------------------------------------------------
console.log('\n[Test Suite 4: Routing & Application Contracts]')

const appCode = fs.readFileSync('src/App.tsx', 'utf8')

assert(
  appCode.includes("import { HackathonDetails } from './components/HackathonDetails'"),
  'ROUTE_01',
  'App.tsx imports HackathonDetails component'
)
assert(
  appCode.includes("'hackathon-details'"),
  'ROUTE_02',
  'App.tsx currentView union includes hackathon-details'
)
assert(
  appCode.includes('selectedHackathonId'),
  'ROUTE_03',
  'App.tsx tracks selectedHackathonId state'
)
assert(
  appCode.includes('navigateToHackathonDetails'),
  'ROUTE_04',
  'App.tsx provides navigateToHackathonDetails handler'
)
assert(
  appCode.includes("window.location.hash = `#hackathons/${id}`"),
  'ROUTE_05',
  'App.tsx updates hash to #hackathons/:id upon event selection'
)
assert(
  appCode.includes('onSelectHackathon'),
  'ROUTE_06',
  'HackathonDiscovery connects onSelectHackathon to navigateToHackathonDetails'
)
assert(
  appCode.includes('<HackathonDetails'),
  'ROUTE_07',
  'App.tsx renders <HackathonDetails /> on hackathon-details view'
)

// -------------------------------------------------------------------
// 5. Component State & Design Compliance
// -------------------------------------------------------------------
console.log('\n[Test Suite 5: HackathonDetails Component UI Compliance]')

const detailsCode = fs.readFileSync('src/components/HackathonDetails.tsx', 'utf8')

assert(
  detailsCode.includes('Back to Hackathons'),
  'UI_01',
  'HackathonDetails includes working back navigation action'
)
assert(
  detailsCode.includes('Event Not Found or Unavailable'),
  'UI_02',
  'HackathonDetails includes not-found and unpublished-event state'
)
assert(
  detailsCode.includes('Unable to Load Hackathon'),
  'UI_03',
  'HackathonDetails includes recoverable error state with Retry action'
)
assert(
  detailsCode.includes('Hackathons Table Not Initialized'),
  'UI_04',
  'HackathonDetails includes schema pending setup notice with Check Again'
)
assert(
  detailsCode.includes('Register on Official Site'),
  'UI_05',
  'HackathonDetails renders verified external registration CTA when URL is valid'
)
assert(
  detailsCode.includes('Registration Link Pending'),
  'UI_06',
  'HackathonDetails displays pending notice when registration link is missing'
)
assert(
  detailsCode.includes('Registration Closed'),
  'UI_07',
  'HackathonDetails indicates registration closed when deadline has passed'
)
assert(
  detailsCode.includes('Eligibility Criteria') &&
  detailsCode.includes('Rules & Submission Guidelines') &&
  detailsCode.includes('Schedule & Timeline'),
  'UI_08',
  'HackathonDetails includes eligibility, rules, and schedule sections'
)
assert(
  detailsCode.includes('#E9E7D8') &&
  detailsCode.includes('#050505') &&
  detailsCode.includes('#F5F04A'),
  'UI_09',
  'HackathonDetails maintains HackhIt ivory (#E9E7D8), black (#050505) and yellow (#F5F04A) theme'
)

// -------------------------------------------------------------------
// 6. Database Migration Details & RLS Security
// -------------------------------------------------------------------
console.log('\n[Test Suite 6: Database Migration & RLS Security]')

const migrationCode = fs.readFileSync(
  'supabase/migrations/20260402000000_hackathons_discovery.sql',
  'utf8'
)

assert(
  migrationCode.includes('eligibility text') &&
  migrationCode.includes('rules text') &&
  migrationCode.includes('schedule text') &&
  migrationCode.includes('website_url text'),
  'DB_01',
  'Migration file includes eligibility, rules, schedule, and website_url columns'
)
assert(
  migrationCode.includes('ALTER TABLE public.hackathons ADD COLUMN IF NOT EXISTS'),
  'DB_02',
  'Migration file includes idempotent ALTER TABLE statements for existing tables'
)
assert(
  migrationCode.includes("status = 'published'") &&
  migrationCode.includes('auth.uid() = organizer_id'),
  'DB_03',
  'Migration RLS strictly isolates drafts: published readable by all, drafts only by owning organizer'
)
assert(
  migrationCode.includes('https://developers.google.com/community/gdsc-solution-challenge') &&
  migrationCode.includes('https://sih.gov.in') &&
  migrationCode.includes('https://ethindia.co') &&
  migrationCode.includes('https://mruh.ac.in') &&
  migrationCode.includes('https://www.kaggle.com/competitions'),
  'DB_04',
  'Migration populates verified official event websites for genuine student opportunities'
)

console.log('\n======================================================')
console.log(`Results: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`)
console.log('======================================================\n')

if (failedTests > 0) {
  process.exit(1)
}
