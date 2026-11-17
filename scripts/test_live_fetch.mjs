import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
for (const line of env.split('\n')) {
  const t = line.trim()
  if (t.startsWith('VITE_SUPABASE_URL=')) process.env.VITE_SUPABASE_URL = t.slice(18).replace(/^['"]|['"]$/g, '')
  if (t.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) process.env.VITE_SUPABASE_PUBLISHABLE_KEY = t.slice(30).replace(/^['"]|['"]$/g, '')
}

const { fetchHackathonById, fetchHackathons } = await import('../src/lib/hackathons.ts')

async function run() {
  console.log('1. Fetching all hackathons...')
  const listRes = await fetchHackathons()
  console.log('   Fetched count:', listRes.hackathons.length)

  if (listRes.hackathons.length > 0) {
    const firstEvent = listRes.hackathons[0]
    console.log(`2. Fetching details by ID: ${firstEvent.id} (${firstEvent.title})...`)
    const detailRes = await fetchHackathonById(firstEvent.id)

    console.log('   Detail fetch result:')
    console.log('   - Title:', detailRes.hackathon?.title)
    console.log('   - Organizer:', detailRes.hackathon?.organizer)
    console.log('   - Mode:', detailRes.hackathon?.mode)
    console.log('   - Deadline:', detailRes.hackathon?.registration_deadline)
    console.log('   - isNotFound:', detailRes.isNotFound)
    console.log('   - error:', detailRes.error)
  }

  console.log('\n3. Fetching non-existent UUID...')
  const fakeRes = await fetchHackathonById('11111111-2222-3333-4444-555555555555')
  console.log('   Non-existent result - isNotFound:', fakeRes.isNotFound, 'hackathon:', fakeRes.hackathon)
}

run()
