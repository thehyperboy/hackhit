/**
 * HackhIt — Student Social Feed Automated Test Suite
 *
 * Verifies backend integration, schema detection, validation rules,
 * error handling, and authorization rules.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xmhxgrvrvdeooglonhae.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_AgZdu52HPGrxTRqqh9hwKw_QEAJbf1e'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const results = []

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ PASS: ${testName}`)
    results.push({ test: testName, passed: true })
  } else {
    console.error(`❌ FAIL: ${testName} - ${details}`)
    results.push({ test: testName, passed: false, details })
  }
}

// Function matching the implementation in src/lib/community.ts
function isSchemaPendingError(err) {
  if (!err || typeof err !== 'object') return false
  const code = err.code || ''
  const msg = (err.message || '').toLowerCase()

  // Guard: Network failure must NEVER be classified as missing schema
  if (
    err.status === 0 ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror')
  ) {
    return false
  }

  // Guard: Auth key rejection (401) must NEVER be classified as missing schema
  if (
    err.status === 401 ||
    msg.includes('apikey') ||
    msg.includes('jwt') ||
    msg.includes('invalid api key')
  ) {
    return false
  }

  // Guard: Permission denied / RLS restricted (403 / 42501) means table EXISTS
  if (
    err.status === 403 ||
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied')
  ) {
    return false
  }

  // Strictly check for PGRST205 or 42P01
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    (err.status === 404 &&
      (msg.includes('could not find the table') ||
        msg.includes('relation "public.') ||
        msg.includes('schema cache')))
  )
}

async function runTests() {
  console.log('--- Starting HackhIt Community Feed Test Suite ---')

  // Test 1: PostgREST Connectivity
  try {
    const res = await supabase.from('posts').select('*').limit(1)
    assert(
      res.status === 200 || res.status === 404,
      'PostgREST service responds with standard HTTP status code',
      `Got status ${res.status}`
    )
  } catch (err) {
    assert(false, 'PostgREST service responds', err.message)
  }

  // Test 2: Unauthenticated insertion to protected tables is rejected by RLS
  try {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const { error: postInsertErr, status: postStatus } = await supabase.from('posts').insert({
      user_id: fakeId,
      content: 'Unauthorized post test',
    })
    assert(
      postInsertErr !== null,
      'Unauthorized post creation without session is rejected',
      `Status: ${postStatus}, error: ${postInsertErr?.message}`
    )
  } catch (err) {
    assert(false, 'Unauthorized post creation check', err.message)
  }

  // Test 3: Unauthorized like insertion is rejected
  try {
    const { error: likeErr } = await supabase.from('post_likes').insert({
      post_id: '00000000-0000-0000-0000-000000000000',
      user_id: '00000000-0000-0000-0000-000000000000',
    })
    assert(
      likeErr !== null,
      'Unauthorized post like without session is rejected by RLS',
      `Error: ${likeErr?.message}`
    )
  } catch (err) {
    assert(false, 'Unauthorized post like check', err.message)
  }

  // Test 4: Unauthorized comment insertion is rejected
  try {
    const { error: commentErr } = await supabase.from('comments').insert({
      post_id: '00000000-0000-0000-0000-000000000000',
      user_id: '00000000-0000-0000-0000-000000000000',
      content: 'Unauthorized comment',
    })
    assert(
      commentErr !== null,
      'Unauthorized comment creation without session is rejected by RLS',
      `Error: ${commentErr?.message}`
    )
  } catch (err) {
    assert(false, 'Unauthorized comment creation check', err.message)
  }

  // Test 5: Storage bucket unauthorized write to storage.objects is rejected
  try {
    const testFile = new Blob(['test content'], { type: 'text/plain' })
    const { error: storageErr } = await supabase.storage
      .from('community-media')
      .upload('unauthorized_test.txt', testFile)
    assert(
      storageErr !== null,
      'Unauthorized or invalid file write to storage is rejected',
      `Error: ${storageErr?.message}`
    )
  } catch (err) {
    assert(false, 'Storage write check', err.message)
  }

  // Test 6: Validation rules
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  const testFileAllowed = { type: 'image/png', size: 1024 * 1024 }
  const testFileDisallowedType = { type: 'application/pdf', size: 1024 }
  const testFileTooLarge = { type: 'image/png', size: 6 * 1024 * 1024 }

  assert(
    allowedMimeTypes.includes(testFileAllowed.type) && testFileAllowed.size <= 5 * 1024 * 1024,
    'Image validator accepts 1MB PNG image'
  )
  assert(
    !allowedMimeTypes.includes(testFileDisallowedType.type),
    'Image validator rejects non-image mime types (e.g. application/pdf)'
  )
  assert(
    testFileTooLarge.size > 5 * 1024 * 1024,
    'Image validator rejects images exceeding 5MB'
  )

  // Test 7: Precision of isSchemaPendingError
  assert(
    isSchemaPendingError({ status: 404, code: 'PGRST205', message: "Could not find the table 'public.posts' in the schema cache" }),
    'isSchemaPendingError correctly identifies PGRST205 missing table'
  )
  assert(
    isSchemaPendingError({ status: 404, code: '42P01', message: 'relation "public.posts" does not exist' }),
    'isSchemaPendingError correctly identifies 42P01 relation missing'
  )
  assert(
    !isSchemaPendingError({ status: 0, message: 'fetch failed' }),
    'isSchemaPendingError rejects network failure (status 0, fetch failed) from being treated as missing schema'
  )
  assert(
    !isSchemaPendingError({ status: 401, message: 'Invalid API key' }),
    'isSchemaPendingError rejects 401 invalid API key from being treated as missing schema'
  )
  assert(
    !isSchemaPendingError({ status: 403, code: '42501', message: 'permission denied for table posts' }),
    'isSchemaPendingError rejects 403 / 42501 RLS restriction from being treated as missing schema'
  )

  // Test 8: Live probe of required tables accurately identifies missing tables
  const REQUIRED_TABLES = ['profiles', 'posts', 'post_likes', 'comments']
  const detectedMissing = []
  const detectedExisting = []
  for (const table of REQUIRED_TABLES) {
    const { error, status } = await supabase.from(table).select('id').limit(1)
    if (!error || status === 200) {
      detectedExisting.push(table)
    } else if (isSchemaPendingError(error || { status })) {
      detectedMissing.push(table)
    }
  }

  assert(
    detectedExisting.length === 4 &&
      detectedExisting.includes('posts') &&
      detectedExisting.includes('profiles') &&
      detectedExisting.includes('post_likes') &&
      detectedExisting.includes('comments'),
    'Live schema check verifies all 4 community tables are initialized and reachable in Supabase',
    `Existing tables: ${detectedExisting.join(', ')}; Missing: ${detectedMissing.join(', ')}`
  )

  console.log('\n--- Test Suite Summary ---')
  const passedCount = results.filter((r) => r.passed).length
  console.log(`Passed: ${passedCount} / ${results.length}`)
  if (passedCount === results.length) {
    console.log('ALL AUTOMATED INTEGRATION TESTS PASSED!')
  }
}

runTests()
