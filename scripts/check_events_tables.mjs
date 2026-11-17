import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env'
const env = fs.readFileSync(envPath, 'utf8')
const lines = env.split('\n')
let url = ''
let key = ''

for (const line of lines) {
  const trimmed = line.trim()
  if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
    url = trimmed.slice('VITE_SUPABASE_URL='.length).replace(/^['"]|['"]$/g, '')
  }
  if (trimmed.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
    key = trimmed.slice('VITE_SUPABASE_PUBLISHABLE_KEY='.length).replace(/^['"]|['"]$/g, '')
  }
}

console.log('Target URL:', url)
console.log('Has key:', Boolean(key))

const sb = createClient(url, key)

async function check() {
  const candidates = ['hackathons', 'events', 'competitions', 'challenges', 'opportunities', 'posts']
  for (const t of candidates) {
    const { data, error } = await sb.from(t).select('*').limit(1)
    if (error) {
      console.log(`- ${t}: [${error.code || error.status}] ${error.message}`)
    } else {
      console.log(`- ${t}: FOUND! Records: ${data.length}`)
    }
  }
}

check()
