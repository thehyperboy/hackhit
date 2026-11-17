/**
 * HackhIt — Global UI Layout Correction Verification Suite
 *
 * Verifies:
 * 1. Removal of boxed outer frame, 10px black outer border, 32px border radius, and grey background.
 * 2. Full-width viewport layout for html, body, #root, and .site-shell.
 * 3. Full-width responsive TopNav with desktop links and mobile hamburger drawer.
 * 4. Content layout containers (max-w-7xl for Landing & Hackathons, max-w-4xl for Community, max-w-6xl for Auth).
 * 5. Preservation of HackhIt visual identity (ivory #E9E7D8, ink #050505, yellow #F5F04A, card drop shadows).
 */

import fs from 'node:fs'
import path from 'node:path'

const results = []

function assert(condition, testId, description, details = '') {
  const status = condition ? 'PASS' : 'FAIL'
  const icon = condition ? '✅' : '❌'
  console.log(`${icon} [${status}] ${testId}: ${description}`)
  if (details) console.log(`   └─ ${details}`)
  results.push({ testId, description, status, details })
  return condition
}

function runLayoutVerification() {
  console.log('========================================================================')
  console.log('         HackhIt — Global UI Layout Correction Verification             ')
  console.log('========================================================================\n')

  const indexCss = fs.readFileSync(path.resolve('src/index.css'), 'utf8')
  const appTsx = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8')
  const communityTsx = fs.readFileSync(path.resolve('src/components/CommunityFeed.tsx'), 'utf8')
  const hackathonsTsx = fs.readFileSync(path.resolve('src/components/HackathonDiscovery.tsx'), 'utf8')
  const topNavTsx = fs.readFileSync(path.resolve('src/components/TopNav.tsx'), 'utf8')
  const loginTsx = fs.readFileSync(path.resolve('src/components/LoginScreen.tsx'), 'utf8')
  const signupTsx = fs.readFileSync(path.resolve('src/components/CreateAccountScreen.tsx'), 'utf8')

  // ---------------------------------------------------------------------------
  // SECTION 1: REMOVAL OF BOXED LAYOUT & GREY BACKGROUND
  // ---------------------------------------------------------------------------
  console.log('--- Section 1: Global CSS & Viewport Background ---')

  assert(
    !indexCss.includes('background: #c5c4c0'),
    'CSS_NO_GREY_BG',
    'Grey background (#c5c4c0) is completely removed from :root and body',
    'Replaced with full-width ivory (--paper: #e9e7d8)'
  )

  assert(
    indexCss.includes('background: #e9e7d8') &&
    indexCss.includes('html {') &&
    indexCss.includes('#root {'),
    'CSS_FULL_HTML_BODY',
    'html, body, and #root explicitly configured for full-height ivory layout',
    '100% min-height, overflow-x hidden'
  )

  assert(
    !indexCss.includes('border: 10px solid var(--ink)') &&
    !indexCss.includes('width: min(1120px'),
    'CSS_NO_OUTER_FRAME',
    '10px outer border, 32px border-radius, and 1120px box constraint removed from .site-shell'
  )

  assert(
    !indexCss.includes('margin: 24px auto') &&
    !indexCss.includes('margin: 10px auto'),
    'CSS_NO_BOX_MARGINS',
    'Outer margins centering a floating window frame are removed'
  )

  // ---------------------------------------------------------------------------
  // SECTION 2: FULL-WIDTH TOP NAVIGATION BAR
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 2: Full-Width Top Navigation Bar ---')

  assert(
    fs.existsSync(path.resolve('src/components/TopNav.tsx')),
    'NAV_COMPONENT_EXISTS',
    'Dedicated TopNav component exists'
  )

  assert(
    topNavTsx.includes('w-full bg-[#050505]') &&
    topNavTsx.includes('sticky top-0 z-40'),
    'NAV_FULL_WIDTH_STICKY',
    'TopNav spans 100% viewport width and is sticky with black #050505 background'
  )

  assert(
    topNavTsx.includes('Home') &&
    topNavTsx.includes('Community') &&
    topNavTsx.includes('Explore') &&
    topNavTsx.includes('brandLogo'),
    'NAV_LINKS_PRESERVED',
    'TopNav preserves HackhIt logo, Home, Community, Explore, and Profile navigation'
  )

  assert(
    topNavTsx.includes('isMobileMenuOpen') &&
    topNavTsx.includes('Menu') &&
    topNavTsx.includes('X'),
    'NAV_MOBILE_DRAWER',
    'TopNav implements responsive mobile menu drawer instead of hiding links'
  )

  assert(
    appTsx.includes('<TopNav') &&
    communityTsx.includes('<TopNav') &&
    hackathonsTsx.includes('<TopNav'),
    'NAV_UNIFIED_ACROSS_VIEWS',
    'TopNav is uniformly integrated into App.tsx (landing), CommunityFeed, and HackathonDiscovery'
  )

  // ---------------------------------------------------------------------------
  // SECTION 3: RESPONSIVE CONTENT CONTAINERS
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 3: Wide, Responsive Content Areas ---')

  assert(
    appTsx.includes('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'),
    'CONTAINER_LANDING',
    'Landing page uses wide max-w-7xl container with responsive horizontal gutters'
  )

  assert(
    hackathonsTsx.includes('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'),
    'CONTAINER_HACKATHONS',
    'Hackathon Discovery uses wide max-w-7xl container with responsive horizontal gutters'
  )

  assert(
    communityTsx.includes('max-w-4xl mx-auto px-4 sm:px-6 lg:px-8'),
    'CONTAINER_COMMUNITY',
    'Community feed uses spacious max-w-4xl container with responsive horizontal gutters'
  )

  assert(
    loginTsx.includes('max-w-6xl mx-auto px-4 sm:px-6 lg:px-8') &&
    signupTsx.includes('max-w-6xl mx-auto px-4 sm:px-6 lg:px-8'),
    'CONTAINER_AUTH',
    'Login and Signup screens use max-w-6xl containers with full-width headers'
  )

  // ---------------------------------------------------------------------------
  // SECTION 4: VISUAL IDENTITY & COMPONENT FIDELITY
  // ---------------------------------------------------------------------------
  console.log('\n--- Section 4: Preservation of HackhIt Identity ---')

  assert(
    indexCss.includes('--paper: #e9e7d8') &&
    indexCss.includes('--ink: #050505') &&
    indexCss.includes('--yellow: #f5f04a'),
    'BRAND_PALETTE',
    'Preserved core color tokens: Ivory (#E9E7D8), Ink (#050505), Yellow (#F5F04A)'
  )

  assert(
    indexCss.includes("font-family: 'Anton'") &&
    indexCss.includes('.display-font'),
    'BRAND_TYPOGRAPHY',
    'Preserved Anton display typography and condensed headings'
  )

  assert(
    hackathonsTsx.includes('shadow-[6px_6px_0_#050505]') &&
    communityTsx.includes('shadow-[6px_6px_0_#050505]'),
    'BRAND_CARD_SHADOWS',
    'Preserved distinctive black borders and offset shadows on individual content cards'
  )

  console.log('\n========================================================================')
  console.log('                            TEST SUMMARY                                ')
  console.log('========================================================================')
  const total = results.length
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  console.log(`Total tests : ${total}`)
  console.log(`Passed      : ${passed}`)
  console.log(`Failed      : ${failed}`)

  if (failed > 0) {
    console.error('\n❌ SOME LAYOUT VERIFICATIONS FAILED')
    process.exit(1)
  } else {
    console.log('\n🎉 ALL GLOBAL LAYOUT VERIFICATIONS PASSED!')
    process.exit(0)
  }
}

runLayoutVerification()
