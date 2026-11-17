import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice(18).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice(30).trim().replace(/^['"]|['"]$/g, '')
}

const session = JSON.parse(fs.readFileSync('scripts/.fresh_session.json', 'utf8'))

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  },
})

// Query registrations for this authenticated student
const { data: registrations, error } = await supabase
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

console.log('--- LIVE REGISTRATION RECORD AUDIT ---')
console.log('Authenticated User Email:', session.user.email)
console.log('Authenticated User ID:   ', session.user.id)
console.log('Query Error:             ', error ? error.message : 'NONE')
console.log('Records Found:           ', registrations?.length || 0)

if (registrations && registrations.length > 0) {
  registrations.forEach((r, idx) => {
    console.log(`\n[Registration #${idx + 1}]`)
    console.log('  Registration ID:      ', r.id)
    console.log('  Linked User ID:       ', r.user_id, r.user_id === session.user.id ? '(MATCHES AUTH)' : '(MISMATCH!)')
    console.log('  Applicant Full Name:  ', r.full_name)
    console.log('  Applicant Email:      ', r.email)
    console.log('  University:           ', r.university)
    console.log('  Participation Type:   ', r.participation_type)
    console.log('  Team Name:            ', r.team_name)
    console.log('  Teammates Roster:     ', JSON.stringify(r.teammates))
    console.log('  Stored Status:        ', r.status)
    console.log('  Confirmed Eligibility:', r.confirmed_eligibility)
    console.log('  Accepted Rules:       ', r.accepted_rules)
    console.log('  Created At:           ', r.created_at)
    console.log('  Linked Event ID:      ', r.hackathon_id)
    console.log('  Linked Event Title:   ', r.hackathon?.title)
    console.log('  Linked Event Mode:    ', r.hackathon?.mode)
    console.log('  Linked Event Deadline:', r.hackathon?.registration_deadline)
    console.log('  Linked Event Status:  ', r.hackathon?.status)
  })
}
