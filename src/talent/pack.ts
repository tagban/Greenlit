// Talent packs: real filmographies the player imported on their own device.
// The game derives each person's stats for the year being played from their films up to
// that year, so a future star starts out cheap and unknown. No personality traits,
// scandals or deaths are invented for real people.

import { GENRE_IDS, type GenreId } from '../game/data'
import { clamp } from '../game/rng'
import type { Role, Talent } from '../game/types'

// [year, rating × 10, votes in thousands, lead role 1/0, game genre index]
export type PackFilm = [number, number, number, number, number]
export type PackPerson = { id: string; n: string; r: 'a' | 'd' | 'c'; b: number | null; d: number | null; f: PackFilm[] }
export type TalentPack = { format: 'greenlit-talent-pack'; version: 1; source: string; built: string; people: PackPerson[] }

const ROLE: Record<PackPerson['r'], Role> = { a: 'actor', d: 'director', c: 'composer' }
const ROSTER = { actor: [130, 50], director: [40, 15], composer: [18, 6] } as const // [top by fame, extra unknowns]

// ---------- Storage (IndexedDB; packs are a few MB) ----------

const DB = 'greenlit-data'
const STORE = 'kv'
const KEY = 'talent-pack'
let loaded: TalentPack | undefined

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function kv<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function savePack(pack: TalentPack) {
  loaded = pack
  await kv('readwrite', (s) => s.put(pack, KEY))
}

export async function loadPack(): Promise<TalentPack | undefined> {
  if (loaded) return loaded
  try {
    loaded = (await kv<TalentPack | undefined>('readonly', (s) => s.get(KEY))) ?? undefined
  } catch {
    loaded = undefined
  }
  return loaded
}

export async function removePack() {
  loaded = undefined
  await kv('readwrite', (s) => s.delete(KEY))
}

// The pack already in memory (loaded at startup), for the synchronous game rules.
export const currentPack = () => loaded

export function packSummary(pack: TalentPack) {
  const count = (r: PackPerson['r']) => pack.people.filter((p) => p.r === r).length
  return { actors: count('a'), directors: count('d'), composers: count('c'), built: pack.built }
}

// ---------- Stats for a given year ----------

type Snapshot = { p: PackPerson; fame: number; skill: number; fit: Record<GenreId, number>; age: number; debut: number }

function snapshot(p: PackPerson, year: number): Snapshot | undefined {
  if (p.d !== null && p.d <= year) return undefined
  const past = p.f.filter((f) => f[0] <= year)
  if (!past.length) return undefined
  // Active: worked recently, or about to (they were between jobs, not retired).
  const lastPast = past[past.length - 1][0]
  const nextFilm = p.f.find((f) => f[0] > year)?.[0]
  if (year - lastPast > 6 && !(nextFilm && nextFilm - year <= 3)) return undefined
  // Fame: audience reach of their films, weighted toward lead roles and recent years.
  const fame = past.reduce((s, f) => s + f[2] * (f[3] ? 1 : 0.4) * Math.pow(0.82, year - f[0]), 0)
  // Skill: how well their recent films were rated, weighted by how many people rated them.
  const recent = past.slice(-12)
  const w = recent.reduce((s, f) => s + Math.sqrt(f[2]), 0)
  const rating = recent.reduce((s, f) => s + (f[1] / 10) * Math.sqrt(f[2]), 0) / w
  const counts = GENRE_IDS.map((_, i) => past.filter((f) => f[4] === i).length)
  const most = Math.max(1, ...counts)
  const fit = Object.fromEntries(GENRE_IDS.map((g, i) => [g, Math.round(40 + (55 * counts[i]) / most)])) as Record<GenreId, number>
  const debut = p.f[0][0]
  const age = p.b ? year - p.b : year - debut + 24
  return { p, fame, skill: clamp(Math.round((rating - 5) * 20 + 40), 15, 98), fit, age, debut }
}

// Build the year's roster: the most famous active people plus some lesser-known ones,
// keeping anyone the studio already has history with.
export function rosterForYear(pack: TalentPack, year: number, previous: Talent[] = [], keepIds: Set<string> = new Set()): Talent[] {
  const prev = new Map(previous.map((t) => [t.id, t]))
  const out: Talent[] = []
  for (const role of ['actor', 'director', 'composer'] as Role[]) {
    const snaps = pack.people.filter((p) => ROLE[p.r] === role).map((p) => snapshot(p, year)).filter(Boolean) as Snapshot[]
    snaps.sort((a, b) => b.fame - a.fame)
    // Star power is a ranking: the top 1% are megastars, the median is a working actor.
    const n = snaps.length
    const star = (i: number) => clamp(Math.round(5 + 90 * Math.pow(1 - i / Math.max(1, n - 1), 3)), 1, 99)
    const [top, extra] = ROSTER[role]
    const picked = new Set<number>()
    for (let i = 0; i < Math.min(top, n); i++) picked.add(i)
    // Lesser-known talent, spread evenly through the rest so the pick is stable year to year.
    const step = Math.max(1, Math.floor((n - top) / Math.max(1, extra)))
    for (let i = top; i < n && picked.size < top + extra; i += step) picked.add(i)
    snaps.forEach((s, i) => {
      const known = keepIds.has(s.p.id) || (prev.get(s.p.id)?.relationship ?? 0) !== 0
      if (!picked.has(i) && !known) return
      const before = prev.get(s.p.id)
      out.push({
        id: s.p.id,
        name: s.p.n,
        role,
        age: s.age,
        skill: s.skill,
        star: star(i),
        genreFit: s.fit,
        temperament: 30, // neutral: we don't invent personalities for real people
        relationship: before?.relationship ?? 0,
        hue: [...s.p.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0),
        debut: s.debut,
        prevStar: before?.star ?? star(i),
        source: 'imdb',
      })
    })
  }
  // People who left the business stay on file only if one of the studio's films references them.
  const present = new Set(out.map((o) => o.id))
  for (const t of previous) if (!present.has(t.id) && keepIds.has(t.id)) out.push({ ...t, retired: true })
  return out
}
