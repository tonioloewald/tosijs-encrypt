/**
 * Prints the gzipped size of the shipped bundle and its delta against dist-sizes.json.
 * `bun bin/sizes.ts --record` re-records the baseline (do it when cutting a tag).
 */
import { gzipSync } from 'node:zlib'

const files = ['dist/index.js']
const baselinePath = 'dist-sizes.json'
const pkg = await Bun.file('package.json').json()

const gz: Record<string, number> = {}
for (const f of files) gz[f] = gzipSync(await Bun.file(f).bytes(), { level: 9 }).length

const baselineFile = Bun.file(baselinePath)
const baseline = (await baselineFile.exists()) ? await baselineFile.json() : undefined

for (const [f, size] of Object.entries(gz)) {
  const before = baseline?.gz?.[f]
  const delta = before === undefined ? '(no baseline)' : `${size - before >= 0 ? '+' : ''}${size - before} B vs ${baseline.version}`
  console.log(`${f}: ${size} B gzipped ${delta}`)
}

if (process.argv.includes('--record')) {
  await Bun.write(baselinePath, JSON.stringify({ version: pkg.version, gz }, null, 2) + '\n')
  console.log(`recorded ${baselinePath} at ${pkg.version}`)
}
