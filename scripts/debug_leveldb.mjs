import fs from 'fs'
import path from 'path'

const dir = path.join(
  process.env.LOCALAPPDATA,
  'Google',
  'Chrome',
  'User Data',
  'Default',
  'Local Storage',
  'leveldb'
)
const buf = fs.readFileSync(path.join(dir, '016952.ldb'))
const idx = buf.indexOf(Buffer.from('sb-xmhxgrvrvdeooglonhae-auth-token'))
console.log('Index:', idx)

const slice = buf.subarray(idx, idx + 2500)
const str = slice.toString('latin1')
console.log('Slice length:', slice.length)

// Print chunks matching token parts
const match = str.match(/"access_token":"([^"]+)"/)
if (match) {
  console.log('Matched access token directly!')
  console.log('Length:', match[1].length)
  console.log('Token:', match[1])
  fs.writeFileSync('scripts/.valid_jwt.txt', match[1])
} else {
  console.log('Could not match cleanly, looking for parts...')
  const parts = str.split('eyJhbGciOi')
  if (parts.length > 1) {
    console.log('Found start of JWT, raw segment preview:')
    console.log(parts[1].slice(0, 1000))
  }
}
