import { FIRST_NAMES, GENRE_IDS, LAST_NAMES, START_CASH, START_YEAR, SUBGENRES, CAMPAIGN_YEARS, type GenreId } from './data'
import { historicTrend } from './history'
import { clamp, hashSeed, makeRng, randomSeed, type Rng } from './rng'
import type { Game, Role, Studio, Talent } from './types'

export function talentFee(t: Talent): number {
  const base = t.role === 'actor' ? 8_000 : t.role === 'director' ? 12_000 : 5_000
  const scale = t.role === 'actor' ? 20_000_000 : t.role === 'director' ? 10_000_000 : 2_000_000
  const perSkill = t.role === 'composer' ? 300 : 700
  const fee = base + scale * Math.pow(t.star / 100, 4) + perSkill * t.skill
  return Math.round(fee / 1000) * 1000
}

// Stars only work with studios whose reputation is close to their own fame.
export function willWork(t: Talent, reputation: number): boolean {
  return t.star <= reputation + 40 + Math.max(0, t.relationship) / 4
}

// Career shape: fame builds through the twenties, peaks 30–50, then fades.
const careerCurve = (age: number) => (age < 22 ? 0.35 : age < 30 ? 0.35 + ((age - 22) / 8) * 0.65 : age <= 50 ? 1 : Math.max(0.3, 1 - (age - 50) / 30))

function makeTalent(rng: Rng, role: Role, id: string, year: number, rookie = false): Talent {
  const age = rookie ? rng.int(role === 'actor' ? 18 : 24, role === 'actor' ? 26 : 34) : rng.int(role === 'actor' ? 19 : 28, role === 'actor' ? 68 : 72)
  // Potential is skewed: most careers stay small, a few become megastars.
  const potential = clamp(Math.round(Math.pow(rng.next(), 1.8) * 100), 5, 99)
  const star = rookie ? rng.int(1, 8) : clamp(Math.round(potential * careerCurve(age) * rng.range(0.6, 1.1)), 2, 98)
  const skill = clamp(Math.round(rng.normal((rookie ? 38 : 45) + potential * 0.25, 13)), 10, 98)
  const strong = rng.pick(GENRE_IDS)
  const genreFit = {} as Record<GenreId, number>
  for (const g of GENRE_IDS) genreFit[g] = clamp(Math.round(rng.normal(g === strong ? 80 : 50, 15)), 5, 100)
  return {
    id,
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    role,
    age,
    skill,
    star,
    genreFit,
    temperament: clamp(Math.round(rng.normal(30 + star * 0.3, 18)), 0, 100),
    relationship: 0,
    hue: rng.int(0, 359),
    potential,
    debut: year,
    prevStar: star,
  }
}

export function generateTalent(seed: number): Talent[] {
  const rng = makeRng(hashSeed(seed, 'talent'))
  const list: Talent[] = []
  for (let i = 0; i < 40; i++) list.push(makeTalent(rng, 'actor', `a${i}`, START_YEAR))
  for (let i = 0; i < 14; i++) list.push(makeTalent(rng, 'director', `d${i}`, START_YEAR))
  for (let i = 0; i < 8; i++) list.push(makeTalent(rng, 'composer', `c${i}`, START_YEAR))
  return list
}

// Once a year: everyone ages, careers rise or fade toward their potential,
// some retire, and a new class of rookies debuts.
export function yearInTalent(seed: number, talent: Talent[], year: number): Talent[] {
  const rng = makeRng(hashSeed(seed, 'era', year))
  const next = talent.map((t) => {
    if (t.retired) return t
    const age = t.age + 1
    const potential = t.potential ?? Math.min(99, t.star + 10)
    const target = potential * careerCurve(age)
    const star = clamp(Math.round(t.star + (target - t.star) * 0.3 + rng.normal(0, 3)), 1, 99)
    const skill = clamp(Math.round(t.skill + rng.normal(age < 40 ? 1.2 : age > 60 ? -1 : 0, 1.5)), 5, 99)
    // Most careers never take off: low-fame actors drift out of the business.
    const retireOdds = age > 60 ? (age - 60) * 0.05 : star < 15 && age > 28 ? 0.14 : 0.01
    return { ...t, age, star, skill, potential, prevStar: t.star, retired: rng.chance(retireOdds) }
  })
  const rookies = [
    ...Array.from({ length: 3 }, (_, i) => makeTalent(rng, 'actor', `a${year}-${i}`, year, true)),
    ...(rng.chance(0.7) ? [makeTalent(rng, 'director', `d${year}`, year, true)] : []),
    ...(rng.chance(0.5) ? [makeTalent(rng, 'composer', `c${year}`, year, true)] : []),
  ]
  return [...next, ...rookies]
}

export const activeTalent = (talent: Talent[]) => talent.filter((t) => !t.retired)

export function rollTrends(seed: number, year: number, prev?: Record<string, number>): Record<string, number> {
  const rng = makeRng(hashSeed(seed, 'trends', year))
  const trends: Record<string, number> = {}
  for (const s of SUBGENRES) {
    const real = historicTrend(s.id, year)
    let next: number
    if (real !== undefined) {
      // 2000–2025 follows real box-office history, with a little noise per game.
      next = real + rng.normal(0, 0.05)
    } else {
      // Beyond recorded history: drift toward the middle with occasional booms and busts.
      const before = prev?.[s.id] ?? rng.range(0.7, 1.3)
      next = before + (1 - before) * 0.25 + rng.normal(0, 0.12)
      if (rng.chance(0.06)) next += 0.4
      if (before > 1.35 && rng.chance(0.35)) next -= 0.45 // fatigue
    }
    trends[s.id] = clamp(Number(next.toFixed(2)), 0.5, 1.65)
  }
  return trends
}

export function pickHotKeyword(seed: number, year: number, trends: Record<string, number>): string {
  const rng = makeRng(hashSeed(seed, 'keyword', year))
  const hottest = [...SUBGENRES].sort((a, b) => trends[b.id] - trends[a.id]).slice(0, 4)
  return rng.pick(rng.pick(hottest).keywords)
}

const WORDS = ['REEL', 'TAKE', 'CUT', 'SCENE', 'MATINEE', 'PREMIERE', 'TRAILER', 'ENCORE', 'SPOTLIGHT', 'MARQUEE', 'GAFFER', 'DOLLY']
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomString(n: number): string {
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => CODE[b % CODE.length]).join('')
}

export function makeStudio(name: string, owner: string): Studio {
  const id = crypto.randomUUID()
  const key = randomString(32)
  const tag = String(hashSeed(id) % 10000).padStart(4, '0')
  const buf = new Uint8Array(2)
  crypto.getRandomValues(buf)
  const recovery = `${WORDS[buf[0] % WORDS.length]}-${randomString(4)}-${WORDS[buf[1] % WORDS.length]}`
  return { name, owner, id, key, tag, recovery }
}

export function newGame(name: string, owner: string): Game {
  const seed = randomSeed()
  const trends = rollTrends(seed, START_YEAR)
  return {
    version: 1,
    seed,
    studio: makeStudio(name, owner),
    cash: START_CASH,
    debt: 0,
    week: 0,
    reputation: 10,
    talent: generateTalent(seed),
    trends,
    hotKeyword: pickHotKeyword(seed, START_YEAR, trends),
    films: [],
  }
}

export const yearOf = (week: number) => START_YEAR + Math.floor(week / 52)
export const monthOf = (week: number) => Math.min(11, Math.floor(((week % 52) / 52) * 12))
export const campaignOver = (week: number) => week >= CAMPAIGN_YEARS * 52

// Advance the calendar, paying overhead and re-rolling trends at each new year.
export function advanceWeeks(game: Game, weeks: number, overhead: number): Game {
  let g = { ...game }
  for (let i = 0; i < weeks; i++) {
    const before = yearOf(g.week)
    g.week += 1
    g.cash -= overhead
    const after = yearOf(g.week)
    if (after !== before) {
      const trends = rollTrends(g.seed, after, g.trends)
      g = { ...g, prevTrends: g.trends, trends, hotKeyword: pickHotKeyword(g.seed, after, trends), talent: yearInTalent(g.seed, g.talent, after) }
    }
  }
  return g
}

