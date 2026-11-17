import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice(18).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice(30).trim().replace(/^['"]|['"]$/g, '')
}

const token = fs.readFileSync('scripts/.extracted_token.txt', 'utf8').trim()
console.log('Using extracted JWT token, length:', token.length)

const supabase = createClient(url, key, {
  global: {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
})

const { data: user, error: userErr } = await supabase.auth.getUser(token)
console.log('Auth check - User:', user?.user?.email, 'ID:', user?.user?.id, 'Error:', userErr?.message)

const { data: regs, error: regErr } = await supabase
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
    hackathon:hackathons (
      id,
      title,
      organizer,
      category,
      mode,
      start_date,
      end_date,
      registration_deadline,
      cover_image_url,
      status
    )
  `)

console.log('Registrations query result - Count:', regs?.length, 'Error:', regErr?.message)
if (regs && regs.length > 0) {
  console.log('\n--- SAVED REGISTRATION DETAILS ---')
  console.log(JSON.stringify(regs, null, 2))
}
