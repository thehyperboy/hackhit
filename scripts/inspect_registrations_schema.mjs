import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice('VITE_SUPABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice('VITE_SUPABASE_PUBLISHABLE_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
}
const supabase = createClient(url, key)

const r1 = await supabase.from('hackathon_registrations').select('*').limit(1)
console.log('hackathon_registrations:', { error: r1.error?.message, data: r1.data })

const r2 = await supabase.from('registrations').select('*').limit(1)
console.log('registrations:', { error: r2.error?.message, data: r2.data })

const r3 = await supabase.from('event_registrations').select('*').limit(1)
console.log('event_registrations:', { error: r3.error?.message, data: r3.data })
