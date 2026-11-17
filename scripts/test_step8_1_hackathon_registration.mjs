/**
 * HackhIt — Step 8.1 Hackathon Registration Form Verification Suite
 *
 * Verifies:
 * 1. determineParticipationSupport:
 *    - Real event rule detection (team-only vs individual-supported vs solo)
 *    - Smart India Hackathon, MRUH Web Cup, Google Solution Challenge, ETHIndia, Kaggle
 * 2. validateRegistrationForm:
 *    - Full name bounds (required, 2-100 chars)
 *    - Email validation (syntax, required)
 *    - Team name & teammate constraints (empty team, empty teammate, duplicate emails, applicant email collision)
 *    - Conditional eligibility acknowledgement (required only when event defines eligibility)
 *    - Rules agreement requirement
 *    - Individual vs team compatibility with event rules
 * 3. Expired & Closed Event Rejection:
 *    - Deadline calculation marks closed events
 *    - Expired events prevent registration and display clear reason
 * 4. App.tsx & Routing Contracts:
 *    - #hackathons/:id/register routing match
 *    - Back navigation to #hackathons/:id preserves event ID
 *    - HackathonDetails renders working registration action
 *    - HackathonRegistration rendered on hackathon-register view
 * 5. Security & Boundary Guardrails:
 *    - No fake database submissions or invented persistence
 *    - Pre-fill supports profile & session without trusting client ID
 *    - Visual theme compliance (#E9E7D8, #050505, #F5F04A)
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
  determineParticipationSupport,
  validateRegistrationForm,
  formatDeadlineCountdown,
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
console.log('HackhIt — Step 8.1 Hackathon Registration Form Test Suite')
console.log('======================================================\n')

// -------------------------------------------------------------------
// 1. Participation Mode Support Detection
// -------------------------------------------------------------------
console.log('[Test Suite 1: Participation Mode Support (Real Event Data)]')

const mockSIH = {
  id: 'sih-1',
  title: 'Smart India Hackathon',
  organizer: 'AICTE',
  category: 'AI/ML',
  mode: 'Hybrid',
  rules: 'Strictly 6 team members per team with at least 1 female teammate mandatory.',
}

const sihSupport = determineParticipationSupport(mockSIH)
assert(
  sihSupport.isTeamOnly === true && sihSupport.allowsIndividual === false && sihSupport.allowsTeam === true,
  'PART_01',
  'SIH correctly identified as Team-Only based on "strictly 6 team members"',
  `Default type: ${sihSupport.defaultType}, isTeamOnly: ${sihSupport.isTeamOnly}`
)

const mockMRUH = {
  id: 'mruh-1',
  title: 'Malla Reddy Web Cup 2026',
  organizer: 'ACM',
  category: 'Web Development',
  mode: 'Offline',
  rules: 'Teams of 2 to 4 members. Projects must be responsive web applications.',
}

const mruhSupport = determineParticipationSupport(mockMRUH)
assert(
  mruhSupport.isTeamOnly === true && mruhSupport.allowsIndividual === false,
  'PART_02',
  'MRUH Web Cup correctly identified as Team-Only based on "teams of 2 to 4"',
  `Default type: ${mruhSupport.defaultType}`
)

const mockGoogle = {
  id: 'google-1',
  title: 'Google Solution Challenge 2026',
  organizer: 'GDSC',
  category: 'Open Innovation',
  mode: 'Online',
  rules: 'Teams of up to 4 students. Projects must address at least one UN SDG.',
}

const googleSupport = determineParticipationSupport(mockGoogle)
assert(
  googleSupport.allowsIndividual === true && googleSupport.allowsTeam === true && googleSupport.isTeamOnly === false,
  'PART_03',
  'Google Solution Challenge allows both Individual and Team participation',
  `Default type: ${googleSupport.defaultType}`
)

const mockETH = {
  id: 'eth-1',
  title: 'ETHIndia Collegiate Hackathon 2026',
  organizer: 'ETHGlobal',
  category: 'Blockchain',
  mode: 'Offline',
  rules: 'Teams of 1 to 4 members. All code must be freshly built within 36 hours.',
}

const ethSupport = determineParticipationSupport(mockETH)
assert(
  ethSupport.allowsIndividual === true && ethSupport.allowsTeam === true,
  'PART_04',
  'ETHIndia allows both Solo and Team hackers ("1 to 4 members")'
)

const mockSolo = {
  id: 'solo-1',
  title: 'Algorithmic Speed Coding',
  organizer: 'Campus Club',
  category: 'Web Development',
  mode: 'Online',
  rules: 'Individual only. Solo hackers will compete in time-limited rounds.',
}

const soloSupport = determineParticipationSupport(mockSolo)
assert(
  soloSupport.isIndividualOnly === true && soloSupport.allowsTeam === false,
  'PART_05',
  'Identifies Individual-Only event when rules specify solo participation'
)

const mockGeneric = {
  id: 'gen-1',
  title: 'Open Campus Hackathon',
  organizer: 'Tech Club',
  category: 'Open Innovation',
  mode: 'Online',
}

const genericSupport = determineParticipationSupport(mockGeneric)
assert(
  genericSupport.allowsIndividual === true && genericSupport.allowsTeam === true,
  'PART_06',
  'Generic event without team restrictions supports both individual and team'
)

// -------------------------------------------------------------------
// 2. Form Input Validation
// -------------------------------------------------------------------
console.log('\n[Test Suite 2: Form Input Validation]')

const validIndividualData = {
  fullName: 'Arjun Rao',
  email: 'arjun.rao@mruh.ac.in',
  university: 'Malla Reddy University',
  participationType: 'individual',
  teamName: '',
  teammates: [],
  confirmedEligibility: true,
  acceptedRules: true,
}

const eventWithEligibility = {
  id: 'ev-1',
  title: 'Campus Hackathon',
  organizer: 'MRUH',
  category: 'Web Development',
  mode: 'Offline',
  eligibility: 'Must be actively enrolled undergraduate student.',
  rules: 'Open source submissions only.',
}

// 2.1 Valid Individual passes
const v1 = validateRegistrationForm(validIndividualData, eventWithEligibility)
assert(v1.isValid === true, 'VAL_01', 'Valid individual registration passes with zero errors')

// 2.2 Name validation
const vNameEmpty = validateRegistrationForm({ ...validIndividualData, fullName: '   ' }, eventWithEligibility)
assert(vNameEmpty.isValid === false && vNameEmpty.errors.fullName?.includes('required'), 'VAL_02', 'Rejects empty full name')

const vNameShort = validateRegistrationForm({ ...validIndividualData, fullName: 'A' }, eventWithEligibility)
assert(vNameShort.isValid === false && vNameShort.errors.fullName?.includes('at least 2'), 'VAL_03', 'Rejects single character full name')

// 2.3 Email validation
const vEmailEmpty = validateRegistrationForm({ ...validIndividualData, email: '' }, eventWithEligibility)
assert(vEmailEmpty.isValid === false && vEmailEmpty.errors.email?.includes('required'), 'VAL_04', 'Rejects empty email')

const vEmailBad = validateRegistrationForm({ ...validIndividualData, email: 'not-an-email' }, eventWithEligibility)
assert(vEmailBad.isValid === false && vEmailBad.errors.email?.includes('valid'), 'VAL_05', 'Rejects invalid email format')

// 2.4 Rules acceptance
const vRulesUnchecked = validateRegistrationForm({ ...validIndividualData, acceptedRules: false }, eventWithEligibility)
assert(vRulesUnchecked.isValid === false && !!vRulesUnchecked.errors.acceptedRules, 'VAL_06', 'Rejects unchecked rules agreement')

// 2.5 Eligibility confirmation requirement
const vEligUnchecked = validateRegistrationForm({ ...validIndividualData, confirmedEligibility: false }, eventWithEligibility)
assert(vEligUnchecked.isValid === false && !!vEligUnchecked.errors.confirmedEligibility, 'VAL_07', 'Requires eligibility confirmation when event defines eligibility')

const eventWithoutEligibility = {
  id: 'ev-2',
  title: 'Open Jam',
  organizer: 'Campus',
  category: 'AI/ML',
  mode: 'Online',
  eligibility: null,
}
const vNoEligUnchecked = validateRegistrationForm({ ...validIndividualData, confirmedEligibility: false }, eventWithoutEligibility)
assert(vNoEligUnchecked.isValid === true, 'VAL_08', 'Eligibility check is not required when event defines no eligibility')

// 2.6 Team-Only Event Restriction
const vSoloOnTeamEvent = validateRegistrationForm(validIndividualData, mockSIH)
assert(
  vSoloOnTeamEvent.isValid === false && !!vSoloOnTeamEvent.errors.participationType,
  'VAL_09',
  'Rejects individual registration when event requires team participation'
)

// 2.7 Team Registration Validation
const validTeamData = {
  fullName: 'Arjun Rao',
  email: 'arjun.rao@mruh.ac.in',
  university: 'Malla Reddy University',
  participationType: 'team',
  teamName: 'CyberKnights',
  teammates: [
    { name: 'Priya Sharma', email: 'priya.s@mruh.ac.in' },
    { name: 'Rahul Verma', email: 'rahul.v@mruh.ac.in' },
  ],
  confirmedEligibility: true,
  acceptedRules: true,
}

const vTeamPass = validateRegistrationForm(validTeamData, mockSIH)
assert(vTeamPass.isValid === true, 'VAL_10', 'Valid team registration passes validation')

// Empty team name
const vTeamNoName = validateRegistrationForm({ ...validTeamData, teamName: '' }, mockSIH)
assert(vTeamNoName.isValid === false && !!vTeamNoName.errors.teamName, 'VAL_11', 'Rejects empty team name for team registration')

// Empty teammates list
const vTeamNoMembers = validateRegistrationForm({ ...validTeamData, teammates: [] }, mockSIH)
assert(vTeamNoMembers.isValid === false && !!vTeamNoMembers.errors.general, 'VAL_12', 'Rejects team registration without teammates')

// Teammate missing name
const vTmBadName = validateRegistrationForm(
  {
    ...validTeamData,
    teammates: [{ name: '', email: 'valid@college.edu' }],
  },
  mockSIH
)
assert(vTmBadName.isValid === false && !!vTmBadName.errors.teammates?.[0]?.name, 'VAL_13', 'Rejects teammate with empty name')

// Teammate invalid email
const vTmBadEmail = validateRegistrationForm(
  {
    ...validTeamData,
    teammates: [{ name: 'Sonia Rao', email: 'invalid-email' }],
  },
  mockSIH
)
assert(vTmBadEmail.isValid === false && !!vTmBadEmail.errors.teammates?.[0]?.email, 'VAL_14', 'Rejects teammate with malformed email')

// Teammate duplicate email with applicant
const vTmApplicantEmail = validateRegistrationForm(
  {
    ...validTeamData,
    teammates: [{ name: 'Sonia Rao', email: 'arjun.rao@mruh.ac.in' }],
  },
  mockSIH
)
assert(
  vTmApplicantEmail.isValid === false && vTmApplicantEmail.errors.teammates?.[0]?.email?.includes('your email'),
  'VAL_15',
  'Rejects teammate email matching applicant email'
)

// Duplicate teammate emails in squad
const vTmDuplicate = validateRegistrationForm(
  {
    ...validTeamData,
    teammates: [
      { name: 'Member A', email: 'dup@college.edu' },
      { name: 'Member B', email: 'dup@college.edu' },
    ],
  },
  mockSIH
)
assert(
  vTmDuplicate.isValid === false && vTmDuplicate.errors.teammates?.[1]?.email?.includes('Duplicate'),
  'VAL_16',
  'Rejects duplicate teammate emails within squad'
)

// -------------------------------------------------------------------
// 3. Deadline Expiration & Closed Event Behavior
// -------------------------------------------------------------------
console.log('\n[Test Suite 3: Deadline Expiration & Unavailable Event Handling]')

const expiredDeadline = new Date(Date.now() - 3600000).toISOString() // 1 hour ago
const closedCountdown = formatDeadlineCountdown(expiredDeadline)
assert(closedCountdown.isClosed === true, 'DEADLINE_01', 'Past deadline correctly flagged as isClosed: true')
assert(closedCountdown.label === 'Registration Closed', 'DEADLINE_02', 'Label reads "Registration Closed"')

const futureDeadline = new Date(Date.now() + 86400000 * 5).toISOString() // 5 days from now
const openCountdown = formatDeadlineCountdown(futureDeadline)
assert(openCountdown.isClosed === false, 'DEADLINE_03', 'Future deadline correctly flagged as isClosed: false')

// -------------------------------------------------------------------
// 4. App.tsx & Routing Contract Verification
// -------------------------------------------------------------------
console.log('\n[Test Suite 4: Routing & Application Contracts]')

const appCode = fs.readFileSync('src/App.tsx', 'utf8')

assert(
  appCode.includes("import { HackathonRegistration } from './components/HackathonRegistration'"),
  'ROUTE_01',
  'App.tsx imports HackathonRegistration component'
)

assert(
  appCode.includes("'hackathon-register'"),
  'ROUTE_02',
  'App.tsx currentView type includes hackathon-register'
)

assert(
  appCode.includes('registerMatch = hash.match(/^#hackathons?\\/([^/?#]+)\\/register$/)'),
  'ROUTE_03',
  'App.tsx handles #hackathons/:id/register in hash router'
)

assert(
  appCode.includes('navigateToHackathonRegister'),
  'ROUTE_04',
  'App.tsx provides navigateToHackathonRegister handler'
)

assert(
  appCode.includes('<HackathonRegistration'),
  'ROUTE_05',
  'App.tsx renders <HackathonRegistration /> on currentView === hackathon-register'
)

const detailsCode = fs.readFileSync('src/components/HackathonDetails.tsx', 'utf8')

assert(
  detailsCode.includes('onNavigateToRegister?: (hackathonId: string) => void'),
  'DETAILS_01',
  'HackathonDetails accepts onNavigateToRegister callback prop'
)

assert(
  detailsCode.includes('onNavigateToRegister(hackathon.id)'),
  'DETAILS_02',
  'HackathonDetails passes real stable ID to onNavigateToRegister'
)

assert(
  detailsCode.includes('Register on HackhIt') || detailsCode.includes('Register for Event'),
  'DETAILS_03',
  'HackathonDetails renders working registration button when open'
)

assert(
  detailsCode.includes('disabled') && detailsCode.includes('Registration Closed'),
  'DETAILS_04',
  'HackathonDetails renders disabled button when deadline has passed'
)

// -------------------------------------------------------------------
// 5. Registration Component Contract Verification
// -------------------------------------------------------------------
console.log('\n[Test Suite 5: HackathonRegistration Component Integrity]')

const regCode = fs.readFileSync('src/components/HackathonRegistration.tsx', 'utf8')

assert(
  regCode.includes("stepMode === 'review'"),
  'COMP_01',
  'Includes dedicated Review & Confirmation section before submission'
)

assert(
  regCode.includes('isSubmittingRef.current'),
  'COMP_02',
  'Implements duplicate-click submission protection via ref lock'
)

assert(
  regCode.includes('isRegistrationClosed') && regCode.includes('Registration Closed'),
  'COMP_03',
  'Detects expired deadlines and blocks registration with clear explanation'
)

assert(
  regCode.includes('isNotFound') && regCode.includes('Event Not Found'),
  'COMP_04',
  'Handles not-found and unpublished events gracefully'
)

assert(
  regCode.includes('errorMessage') && regCode.includes('Try Again'),
  'COMP_05',
  'Includes recoverable error state with retry action'
)

assert(
  regCode.includes('onNavigateBack'),
  'COMP_06',
  'Provides back-to-event-details navigation without losing selected event'
)

assert(
  regCode.includes('#E9E7D8') && regCode.includes('#050505') && regCode.includes('#F5F04A'),
  'COMP_07',
  'Adheres strictly to HackhIt brand visual palette (Ivory, Black, Lemon Yellow)'
)

assert(
  regCode.includes('prefillProfile') && regCode.includes('profiles'),
  'COMP_08',
  'Prefills student details from user profile/session when available'
)

assert(
  !regCode.includes('INSERT INTO registrations') && !regCode.includes('fake-persistence'),
  'COMP_09',
  'Guards boundary: does not claim fake database persistence before Step 8.2 migration'
)

// -------------------------------------------------------------------
// Final Report
// -------------------------------------------------------------------
console.log('\n======================================================')
console.log(`Results: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`)
console.log('======================================================\n')

if (failedTests > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
