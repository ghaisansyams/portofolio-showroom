#!/usr/bin/env node
/**
 * Pull the live portfolio data out of ghaisansyams.vercel.app and write it into
 * portfolio-data.js, which the game loads as a plain <script>.
 *
 *   node scripts/sync-portfolio.mjs
 *
 * The site is a Vite SPA with no JSON API, so the data is read straight out of
 * the deployed bundle. Minifiers rename variables on every build, so the three
 * arrays are located by the shape of their contents, never by variable name:
 *
 *   flagship  -> entries carry `subtitle:` / `year:` / `role:`
 *   more work -> entries carry `category:`
 * Those keys were checked to appear in one array and never the other.
 *   filters   -> the literal [{id:"all",label:"All"} ...]
 *
 * Every project gets a `shots` array of {src,label,blur}. Flagship entries carry
 * 5-7 labelled screenshots each; more-work entries carry their single one, so the
 * viewer has one shape to render either way.
 *
 * Screenshots are NOT copied: ghaisansyams.vercel.app serves them with
 * `access-control-allow-origin: *`, so the game textures them straight from the
 * live site and they stay current without re-running this.
 */
const ORIGIN = process.env.PORTFOLIO_ORIGIN || 'https://ghaisansyams.vercel.app'

const die = (msg) => { console.error('sync failed: ' + msg); process.exit(1) }

async function text(url) {
  const r = await fetch(url)
  if (!r.ok) die(`${r.status} ${r.statusText} for ${url}`)
  return r.text()
}

/** Extract a balanced [...] literal starting at `open`, respecting strings. */
function sliceArray(src, open) {
  let depth = 0, quote = null
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue }
    if (c === '[' || c === '{') depth++
    else if (c === ']' || c === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  die('unbalanced array literal — bundle format changed')
}

/**
 * Find the array whose own entries contain every marker.
 *
 * The candidate is bracket-matched BEFORE the markers are tested. Testing a
 * fixed-width window instead would spill past a short array into whatever the
 * minifier parked next to it — which is exactly how the 4-entry category list
 * first matched the marker set meant for the 22-entry project list.
 */
function findArray(src, markers, label) {
  const re = /\[\{id:"/g
  let m
  while ((m = re.exec(src))) {
    const candidate = sliceArray(src, m.index)
    if (markers.every((k) => candidate.includes(k))) return candidate
  }
  die(`could not locate the ${label} array (markers: ${markers.join(', ')})`)
}

// Object literals use unquoted keys and minifier shorthands like `!0`, so they
// are evaluated rather than JSON.parse'd. The input is the user's own domain.
const evalLiteral = (src, label) => {
  try { return new Function('return ' + src)() }
  catch (e) { die(`could not evaluate the ${label} array: ${e.message}`) }
}

const html = await text(ORIGIN + '/')
const asset = html.match(/\/assets\/index-[\w-]+\.js/)
if (!asset) die('no /assets/index-*.js in the served HTML')
console.log('bundle:', asset[0])

const bundle = await text(ORIGIN + asset[0])

const flagship = evalLiteral(findArray(bundle, ['subtitle:', 'year:', 'role:'], 'flagship'), 'flagship')
const more = evalLiteral(findArray(bundle, ['category:', 'blur:'], 'more-work'), 'more-work')
const catStart = bundle.indexOf('[{id:"all",label:"All"}')
const categories = catStart < 0 ? [] : evalLiteral(sliceArray(bundle, catStart), 'categories')

const validate = (rows, label, min) => {
  if (!Array.isArray(rows) || rows.length < min)
    die(`${label}: expected at least ${min} entries, got ${rows.length ?? 0}`)
  const bad = rows.find((r) => !r || typeof r.id !== 'string' || typeof r.name !== 'string')
  if (bad) die(`${label}: an entry is missing id/name — wrong array matched? ${JSON.stringify(bad)}`)
}
validate(flagship, 'flagship', 3)
validate(more, 'more-work', 5)

// Normalise the two different shapes into one record the game can render.
const abs = (u) => (u && u.startsWith('/') ? ORIGIN + u : u || null)
const shotsOf = (list) =>
  (list || [])
    .filter((s) => s && s.src)
    .map((s, i) => ({ src: abs(s.src), label: s.label || 'Tampilan ' + (i + 1), blur: s.blur || null }))

const norm = []
for (const p of flagship) {
  const shots = shotsOf(p.images)
  norm.push({
    id: p.id, name: p.name, kind: 'flagship',
    tagline: p.subtitle || '', meta: [p.year, p.role].filter(Boolean).join(' · '),
    color: p.color || '#7fd4ff', description: p.description || '',
    tech: p.techStack || [], stats: p.stats || [],
    url: p.liveUrl || p.caseStudyUrl || p.githubUrl || null,
    isPrivate: !!p.isPrivate,
    shots: shots,
    image: shots[0] ? shots[0].src : null,
    blur: shots[0] ? shots[0].blur : null,
  })
}
for (const p of more) {
  // one shot, same shape as flagship, so the viewer needs no special case
  const shots = shotsOf([{ src: p.image, label: p.name, blur: p.blur }])
  norm.push({
    id: p.id, name: p.name, kind: 'more',
    tagline: '', meta: '', category: p.category || 'all',
    color: p.color || '#7fd4ff', description: p.description || '',
    tech: p.tech || [], stats: [],
    url: p.liveUrl || null, isPrivate: false,
    shots: shots,
    image: shots[0] ? shots[0].src : null,
    blur: shots[0] ? shots[0].blur : null,
  })
}

const missing = norm.filter((p) => !p.image)
const shotTotal = norm.reduce((n, p) => n + p.shots.length, 0)
const out =
  '// GENERATED by scripts/sync-portfolio.mjs — do not edit by hand.\n' +
  `// Source: ${ORIGIN}${asset[0]}\n` +
  `// Synced: ${new Date().toISOString().slice(0, 10)}\n` +
  `window.PORTFOLIO_ORIGIN = ${JSON.stringify(ORIGIN)}\n` +
  `window.PORTFOLIO_CATEGORIES = ${JSON.stringify(categories)}\n` +
  `window.PORTFOLIO = ${JSON.stringify(norm, null, 2)}\n`

const outPath = new URL('../portfolio-data.js', import.meta.url)
const { writeFileSync } = await import('node:fs')
writeFileSync(outPath, out)

console.log(`flagship: ${flagship.length}  more: ${more.length}  categories: ${categories.length}`)
console.log(`screenshots: ${shotTotal} across ${norm.length} projects (max ${Math.max(...norm.map(p => p.shots.length))} on one)`)
console.log(`without a screenshot: ${missing.length}${missing.length ? ' (' + missing.map(p => p.id).join(', ') + ')' : ''}`)
console.log('wrote portfolio-data.js —', out.length, 'bytes')
