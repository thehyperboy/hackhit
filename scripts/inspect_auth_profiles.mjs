import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice('VITE_SUPABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice('VITE_SUPABASE_PUBLISHABLE_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
}
const supabase = createClient(url, key)

const { data, count, error } = await supabase.from('profiles').select('id, full_name, university', { count: 'exact' }).limit(5)
console.log('Profiles count:', count, 'data:', data, 'error:', error?.message)
