// Builds a talent pack from IMDb's non-commercial datasets (https://developer.imdb.com/non-commercial-datasets/).
// Runs entirely on the player's device: the four .tsv.gz files are streamed, filtered and
// reduced to a few MB. The pack is for personal use and never leaves the device.

import { GENRE_IDS, type GenreId } from '../game/data'
import type { PackFilm, PackPerson, TalentPack } from './pack'

// Each file may be gzipped (as downloaded) or already unzipped (some browsers unzip downloads).
export type ImdbFiles = {
  titleBasics: Blob // title.basics.tsv.gz
  titleRatings: Blob // title.ratings.tsv.gz
  titlePrincipals: Blob // title.principals.tsv.gz
  nameBasics: Blob // name.basics.tsv.gz
}

export type Progress = (step: string, detail: string) => void

export const IMDB_FILES = [
  { key: 'titleBasics', name: 'title.basics.tsv.gz', about: 'every film’s year and genres' },
  { key: 'titleRatings', name: 'title.ratings.tsv.gz', about: 'ratings and vote counts' },
  { key: 'titlePrincipals', name: 'title.principals.tsv.gz', about: 'who starred in, directed and scored each film' },
  { key: 'nameBasics', name: 'name.basics.tsv.gz', about: 'names, birth and death years' },
] as const

// Filters: keep real feature films people actually watched, and people with a real career.
const MIN_VOTES = 2_000
const MIN_YEAR = 1950
const MIN_FILMS = 3
const MIN_BEST_VOTES = 15_000
const CAPS = { a: 4000, d: 1200, c: 500 } as const

// IMDb genres in priority order; the first match decides the game genre.
const GENRE_MAP: [string, GenreId][] = [
  ['Horror', 'horror'], ['Sci-Fi', 'scifi'], ['Fantasy', 'scifi'], ['Romance', 'romance'], ['Comedy', 'comedy'],
  ['Action', 'action'], ['Adventure', 'action'], ['War', 'action'], ['Western', 'action'], ['Crime', 'action'],
  ['Thriller', 'horror'], ['Mystery', 'horror'], ['Family', 'comedy'], ['Musical', 'romance'], ['Animation', 'comedy'],
]

function gameGenre(imdbGenres: string): number {
  const list = imdbGenres.split(',')
  for (const [imdb, game] of GENRE_MAP) if (list.includes(imdb)) return GENRE_IDS.indexOf(game)
  return GENRE_IDS.indexOf('drama')
}

// Stream a TSV line by line (skipping the header), without holding the file in memory.
async function eachRow(file: Blob, onRow: (cols: string[]) => void, onCount?: (n: number) => void) {
  const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  const gzipped = magic[0] === 0x1f && magic[1] === 0x8b
  const raw = file.stream() as ReadableStream<BufferSource>
  const reader = (gzipped ? raw.pipeThrough(new DecompressionStream('gzip')) : raw).pipeThrough(new TextDecoderStream()).getReader()
  let rest = ''
  let n = 0
  let header = true
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = rest + value
    let start = 0
    for (let i = chunk.indexOf('\n'); i !== -1; i = chunk.indexOf('\n', start)) {
      const line = chunk.slice(start, i)
      start = i + 1
      if (header) {
        header = false
        continue
      }
      onRow(line.split('\t'))
      if (++n % 250_000 === 0) onCount?.(n)
    }
    rest = chunk.slice(start)
  }
  if (rest && !header) onRow(rest.split('\t'))
}

type Movie = { year: number; genre: number; rating: number; votes: number }

export async function buildTalentPack(files: ImdbFiles, progress: Progress = () => {}): Promise<TalentPack> {
  const rows = (n: number) => `${(n / 1_000_000).toFixed(1)}M rows read`

  // 1. Ratings first: only films with enough votes matter.
  progress('Reading ratings', '')
  const ratings = new Map<string, { rating: number; votes: number }>()
  await eachRow(files.titleRatings, ([id, rating, votes]) => {
    const v = Number(votes)
    if (v >= MIN_VOTES) ratings.set(id, { rating: Number(rating), votes: v })
  }, (n) => progress('Reading ratings', rows(n)))

  // 2. Keep feature films from those.
  progress('Reading films', '')
  const movies = new Map<string, Movie>()
  await eachRow(files.titleBasics, ([id, type, , , adult, year, , , genres]) => {
    if (type !== 'movie' || adult === '1') return
    const r = ratings.get(id)
    const y = Number(year)
    if (!r || !(y >= MIN_YEAR)) return
    movies.set(id, { year: y, genre: gameGenre(genres), rating: r.rating, votes: r.votes })
  }, (n) => progress('Reading films', `${rows(n)}, ${movies.size.toLocaleString()} films kept`))
  ratings.clear()

  // 3. Who worked on them: leads and supporting actors, directors, composers.
  progress('Reading cast and crew', '')
  const credits = new Map<string, { role: 'a' | 'd' | 'c'; films: PackFilm[] }>()
  await eachRow(files.titlePrincipals, ([tconst, ordering, nconst, category]) => {
    const m = movies.get(tconst)
    if (!m) return
    const order = Number(ordering)
    const role = category === 'actor' || category === 'actress' ? 'a' : category === 'director' ? 'd' : category === 'composer' ? 'c' : undefined
    if (!role || (role === 'a' && order > 5)) return
    let entry = credits.get(nconst)
    if (!entry) credits.set(nconst, (entry = { role, films: [] }))
    else if (entry.role !== role && role === 'a') entry.role = 'a' // actors who also direct are listed as actors
    entry.films.push([m.year, Math.round(m.rating * 10), Math.max(1, Math.round(m.votes / 1000)), role === 'a' && order <= 2 ? 1 : 0, m.genre])
  }, (n) => progress('Reading cast and crew', `${rows(n)}, ${credits.size.toLocaleString()} people so far`))
  movies.clear()

  // Keep people with a real career, capped per role by total audience.
  const keep = new Map<string, { role: 'a' | 'd' | 'c'; films: PackFilm[]; reach: number }>()
  for (const role of ['a', 'd', 'c'] as const) {
    const pool = [...credits.entries()]
      .filter(([, e]) => e.role === role && e.films.length >= MIN_FILMS && Math.max(...e.films.map((f) => f[2])) * 1000 >= MIN_BEST_VOTES)
      .map(([id, e]) => ({ id, ...e, reach: e.films.reduce((s, f) => s + f[2], 0) }))
      .sort((x, y) => y.reach - x.reach)
      .slice(0, CAPS[role])
    for (const p of pool) keep.set(p.id, p)
  }
  credits.clear()

  // 4. Names and birth/death years for the people we kept.
  progress('Reading names', '')
  const people: PackPerson[] = []
  await eachRow(files.nameBasics, ([nconst, name, birth, death]) => {
    const p = keep.get(nconst)
    if (!p) return
    p.films.sort((x, y) => x[0] - y[0])
    people.push({ id: nconst, n: name, r: p.role, b: birth === '\\N' ? null : Number(birth), d: death === '\\N' ? null : Number(death), f: p.films })
  }, (n) => progress('Reading names', `${rows(n)}, ${people.length.toLocaleString()} matched`))

  progress('Done', `${people.length.toLocaleString()} people`)
  return {
    format: 'greenlit-talent-pack',
    version: 1,
    source: 'IMDb non-commercial datasets (personal use)',
    built: new Date().toISOString().slice(0, 10),
    people,
  }
}
