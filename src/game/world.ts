import { FIRST_NAMES, GENRE_IDS, LAST_NAMES, START_CASH, START_YEAR, SUBGENRES, CAMPAIGN_YEARS, type GenreId } from './data'
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

function makeTalent(rng: Rng, role: Role, index: number): Talent {
  const star = clamp(Math.round(Math.pow(rng.next(), 2.2) * 100), 2, 98)
  const skill = clamp(Math.round(rng.normal(45 + star * 0.3, 15)), 10, 98)
  const strong = rng.pick(GENRE_IDS)
  const genreFit = {} as Record<GenreId, number>
  for (const g of GENRE_IDS) genreFit[g] = clamp(Math.round(rng.normal(g === strong ? 80 : 50, 15)), 5, 100)
  return {
    id: `${role[0]}${index}`,
    name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
    role,
    age: rng.int(role === 'actor' ? 19 : 28, role === 'actor' ? 68 : 72),
    skill,
    star,
    genreFit,
    temperament: clamp(Math.round(rng.normal(30 + star * 0.3, 18)), 0, 100),
    relationship: 0,
    hue: rng.int(0, 359),
  }
}

export function generateTalent(seed: number): Talent[] {
  const rng = makeRng(hashSeed(seed, 'talent'))
  const list: Talent[] = []
  for (let i = 0; i < 40; i++) list.push(makeTalent(rng, 'actor', i))
  for (let i = 0; i < 14; i++) list.push(makeTalent(rng, 'director', i))
  for (let i = 0; i < 8; i++) list.push(makeTalent(rng, 'composer', i))
  return list
}

export function rollTrends(seed: number, year: number, prev?: Record<string, number>): Record<string, number> {
  const rng = makeRng(hashSeed(seed, 'trends', year))
  const trends: Record<string, number> = {}
  for (const s of SUBGENRES) {
    const before = prev?.[s.id] ?? rng.range(0.7, 1.3)
    // Drift toward the middle with occasional booms and busts.
    let next = before + (1 - before) * 0.25 + rng.normal(0, 0.12)
    if (rng.chance(0.06)) next += 0.4
    if (before > 1.35 && rng.chance(0.35)) next -= 0.45 // fatigue
    trends[s.id] = clamp(Number(next.toFixed(2)), 0.5, 1.6)
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
      g = { ...g, trends, hotKeyword: pickHotKeyword(g.seed, after, trends) }
    }
  }
  return g
}

// Age talent and nudge fame each year so the roster feels alive.
export function ageTalent(game: Game, years: number): Talent[] {
  const rng = makeRng(hashSeed(game.seed, 'age', game.week))
  return game.talent.map((t) => {
    if (years <= 0) return t
    const trend = t.age < 35 ? 2 : t.age > 55 ? -2 : 0
    return {
      ...t,
      age: t.age + years,
      star: clamp(Math.round(t.star + years * (trend + rng.normal(0, 2))), 1, 99),
      skill: clamp(Math.round(t.skill + years * rng.normal(t.age < 40 ? 1 : -0.3, 1)), 5, 99),
    }
  })
}
