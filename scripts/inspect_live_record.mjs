import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = fs.readFileSync('.env.local', 'utf8')
let url = ''
let key = ''

for (const line of env.split('\n')) {
  const t = line.trim()
  if (t.startsWith('VITE_SUPABASE_URL=')) url = t.slice(18).replace(/^['"]|['"]$/g, '')
  if (t.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = t.slice(30).replace(/^['"]|['"]$/g, '')
}

const sb = createClient(url, key)
const { data, error } = await sb.from('hackathons').select('*')
console.log('Error:', error)
console.log('Count:', data?.length)
if (data && data.length > 0) {
  for (const item of data) {
    console.log(`- [${item.id}] ${item.title} (${item.category}, ${item.mode}) - Deadline: ${item.registration_deadline}`)
    console.log(`  website_url: ${item.website_url}`)
    console.log(`  eligibility: ${item.eligibility ? 'Yes' : 'None'}`)
    console.log(`  rules: ${item.rules ? 'Yes' : 'None'}`)
  }
}
