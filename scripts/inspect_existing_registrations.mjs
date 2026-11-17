import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice(18).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice(30).trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(url, key)

console.log('1. Fetching all profiles...')
const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name, university')
console.log('Profiles count:', profiles?.length, 'Error:', pErr?.message)
if (profiles) {
  for (const p of profiles) {
    console.log(`- User [${p.id}] ${p.full_name} (${p.university})`)
  }
}

console.log('\n2. Fetching published hackathons...')
const { data: hackathons, error: hErr } = await supabase.from('hackathons').select('id, title, status, registration_deadline')
console.log('Hackathons count:', hackathons?.length, 'Error:', hErr?.message)
if (hackathons) {
  for (const h of hackathons) {
    console.log(`- Event [${h.id}] "${h.title}" (status=${h.status}, deadline=${h.registration_deadline})`)
  }
}
