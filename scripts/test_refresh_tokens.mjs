import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice(18).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice(30).trim().replace(/^['"]|['"]$/g, '')
}

const supabase = createClient(url, key)

const candidates = ['uwrktlpbj2sa', 'qpy7ktshmfpq']
for (const rf of candidates) {
  console.log('Testing refresh token:', rf)
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: rf })
  console.log('Result:', error?.message)
  if (data?.session) {
    console.log('SUCCESS! Active fresh session obtained!')
    console.log('User:', data.session.user.email)
    console.log('User ID:', data.session.user.id)
    fs.writeFileSync('scripts/.fresh_session.json', JSON.stringify(data.session, null, 2))
    break
  }
}
