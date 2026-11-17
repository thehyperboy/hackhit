import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const envContent = fs.readFileSync('.env.local', 'utf8')
let url = '', key = ''
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.slice(18).trim().replace(/^['"]|['"]$/g, '')
  if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.slice(30).trim().replace(/^['"]|['"]$/g, '')
}
const supabase = createClient(url, key)

const dir = path.join(
  process.env.LOCALAPPDATA,
  'Google',
  'Chrome',
  'User Data',
  'Default',
  'Local Storage',
  'leveldb'
)
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ldb') || f.endsWith('.log'))

const foundRefreshTokens = new Set()
const foundAccessTokens = new Set()

for (const file of files) {
  try {
    const buf = fs.readFileSync(path.join(dir, file))
    const str = buf.toString('latin1')
    const rfMatches = str.matchAll(/"refresh_token":"([^"]+)"/g)
    for (const m of rfMatches) {
      foundRefreshTokens.add(m[1])
    }
    const atMatches = str.matchAll(/"access_token":"([^"]+)"/g)
    for (const m of atMatches) {
      foundAccessTokens.add(m[1])
    }
  } catch {}
}

console.log('Found candidate refresh tokens:', foundRefreshTokens.size)
for (const rf of foundRefreshTokens) {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: rf })
  if (data?.session) {
    console.log('SUCCESS with refresh token:', rf)
    console.log('User:', data.session.user.email)
    fs.writeFileSync('scripts/.fresh_session.json', JSON.stringify(data.session, null, 2))
    process.exit(0)
  }
}

console.log('Testing access tokens directly:', foundAccessTokens.size)
for (const at of foundAccessTokens) {
  const { data, error } = await supabase.auth.getUser(at)
  if (data?.user) {
    console.log('SUCCESS with access token!')
    console.log('User:', data.user.email)
    const sessionObj = {
      access_token: at,
      user: data.user,
    }
    fs.writeFileSync('scripts/.fresh_session.json', JSON.stringify(sessionObj, null, 2))
    process.exit(0)
  }
}

console.log('No working tokens found in leveldb.')
