import fs from 'fs'
import path from 'path'

const levelDbDir = path.join(
  process.env.LOCALAPPDATA || 'C:\\Users\\Koushik\\AppData\\Local',
  'Google',
  'Chrome',
  'User Data',
  'Default',
  'Local Storage',
  'leveldb'
)

console.log('Searching leveldb in:', levelDbDir)
if (fs.existsSync(levelDbDir)) {
  const files = fs.readdirSync(levelDbDir).filter((f) => f.endsWith('.ldb') || f.endsWith('.log'))
  for (const file of files) {
    const fullPath = path.join(levelDbDir, file)
    try {
      const buffer = fs.readFileSync(fullPath)
      const content = buffer.toString('utf8', 0, buffer.length)
      const tokenIdx = content.lastIndexOf('sb-xmhxgrvrvdeooglonhae-auth-token')
      if (tokenIdx !== -1) {
        console.log(`Found token in file: ${file}`)
        const slice = content.slice(tokenIdx, tokenIdx + 3000)
        // Look for access_token
        const atMatch = slice.match(/eyJhbGciOi[A-Za-z0-9_.-]+/)
        if (atMatch) {
          console.log('Found JWT in slice:', atMatch[0].slice(0, 40) + '...')
          fs.writeFileSync('scripts/.extracted_token.txt', atMatch[0], 'utf8')
        }
      }
    } catch {
      // ignore locked/binary errors
    }
  }
}
