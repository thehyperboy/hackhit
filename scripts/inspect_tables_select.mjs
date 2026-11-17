import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice('VITE_SUPABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice('VITE_SUPABASE_PUBLISHABLE_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
}
const supabase = createClient(url, key)

const tablesToCheck = [
  'profiles',
  'posts',
  'post_likes',
  'comments',
  'hackathons',
  'hackathon_registrations',
  'registrations',
  'event_registrations',
  'team_members',
  'teams'
]

for (const t of tablesToCheck) {
  const { data, error, status } = await supabase.from(t).select('*').limit(1)
  console.log(`Table '${t}': status=${status}, error=${error?.message || 'none'}, code=${error?.code || 'OK'}`)
}
