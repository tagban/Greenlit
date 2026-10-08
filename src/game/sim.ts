import { BACKERS, DEPTS, GENRES, MONTHS, RIVAL_STUDIOS, RIVAL_TITLE_A, RIVAL_TITLE_B, SUBGENRES, subgenreById, type Dept, type Weights } from './data'
import { clamp, hashSeed, makeRng } from './rng'
import { reviewFilm, writeBreakdown, writeHeadline } from './text'
import type { Bid, Film, FilmResult, Game, ProductionEvent, ScriptOffer, Talent } from './types'
import { monthOf, talentFee, yearOf } from './world'

export const SCREEN_OPTIONS = [
  { screens: 400, label: 'Limited' },
  { screens: 1200, label: 'Moderate' },
  { screens: 2500, label: 'Wide' },
  { screens: 3800, label: 'Saturation' },
]
export const PRINT_COST = 250
export const CREW_WEEKLY = 8_000

// How much money buys a strong technical / music score. Horror looks scary on a
// shoestring; a space battle does not.
export const TECH_SCALE: Record<string, number> = { action: 2_500_000, scifi: 2_500_000, horror: 400_000, comedy: 250_000, drama: 300_000, romance: 250_000 }
export const MUSIC_SCALE = 120_000
export const POST_WEEKS = 6

export const normalShoot = (film: Pick<Film, 'genre'>) => (film.genre === 'action' || film.genre === 'scifi' ? 10 : 6)

export function newFilm(game: Game): Film {
  const seed = hashSeed(game.seed, 'film', game.films.length, game.week)
  return {
    id: `f${game.films.length + 1}-${seed.toString(36)}`,
    seed,
    title: '',
    logline: '',
    genre: 'horror',
    leadIds: [],
    supportIds: [],
    techBudget: 150_000,
    musicBudget: 40_000,
    shootWeeks: 6,
    events: [],
    reshoot: false,
    marketing: { tv: 0, print: 0, web: 50_000, trailer: 20_000 },
    release: { monthOffset: 2, screens: 400 },
    costs: { script: 0, talent: 0, production: 0, events: 0, post: 0, marketing: 0, prints: 0 },
    stage: 'pitch',
  }
}

// ---------- Pitch and financing ----------

export function pitchScore(game: Game, film: Film): { score: number; notes: string[] } {
  const notes: string[] = []
  const trend = trendFor(game, film)
  const trendPts = clamp((trend - 0.6) / 0.9, 0, 1) * 35
  const sub = subgenreById(film.subgenre)
  const label = film.subgenre === 'parody' ? `Spoofing ${subgenreById(film.parodyTarget)?.name ?? 'that'}` : sub?.name ?? `General ${GENRES[film.genre].name.toLowerCase()}`
  if (trend >= 1.2) notes.push(`${label} is hot right now. Backers are excited.`)
  else if (trend < 0.85) notes.push(`${label} is out of fashion. Backers are nervous.`)
  else notes.push(`${label} is a steady seller.`)
  const text = film.logline.toLowerCase()
  const matches = sub ? sub.keywords.filter((k) => text.includes(k)).length : 0
  const hot = text.includes(game.hotKeyword)
  const keywordPts = Math.min(2, matches) * 8 + (hot ? 10 : 0)
  if (hot) notes.push(`Your logline has this year’s buzzword, “${game.hotKeyword}”.`)
  if (matches) notes.push(`The logline sells the ${sub!.name.toLowerCase()} hook.`)
  else if (sub) notes.push(`The logline doesn’t sound like a ${sub.name.toLowerCase()}. Try words like “${sub.keywords[0]}” or “${sub.keywords[1]}”.`)
  const len = film.logline.trim().length
  const effortPts = len >= 60 ? 8 : len >= 25 ? 4 : 0
  if (len < 25) notes.push('The logline is too thin to sell anyone.')
  const repPts = game.reputation * 0.3
  if (game.reputation < 20) notes.push('Nobody knows your studio yet, so offers are small.')
  return { score: Math.round(clamp(trendPts + keywordPts + effortPts + repPts, 0, 100)), notes }
}

export function backerBids(game: Game, film: Film): Bid[] {
  const rng = makeRng(hashSeed(film.seed, 'bids'))
  const { score } = pitchScore(game, film)
  const small = clamp((40 - game.reputation) / 40, 0, 1) // how "indie" this studio still is
  return BACKERS.map((b) => {
    const pass = (reason: string) => ({ backer: b.name, cap: 0, share: 0, blurb: b.style, reason })
    if (game.reputation < b.minRep) return pass('Won’t take a meeting with a studio your size yet.')
    const memory = game.backerRel?.[b.name] ?? 0
    const interest = score + (b.taste[film.genre] ?? 0) + b.indie * small + memory + rng.normal(0, 7)
    if (interest < 30 && memory <= -10) return pass('Still burned from your last film together.')
    if (interest < 30) return pass(rng.pick(['Passed. “Not for us.”', 'Passed. They didn’t see an audience for it.', 'Passed after a polite meeting.']))
    const base = (250_000 + game.reputation * 60_000) * b.pockets
    const cap = Math.round(Math.min(b.maxCap, base * Math.pow(interest / 50, 1.5)) / 10_000) * 10_000
    const share = Number(clamp(0.8 - interest / 250 + b.greed, 0.35, 0.8).toFixed(2))
    return { backer: b.name, cap, share, blurb: b.style }
  }).sort((a, b) => b.cap - a.cap)
}

// ---------- Scripts ----------

const GRADES = ['F', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+']
export const grade = (score: number) => GRADES[clamp(Math.floor((score - 20) / 6.5), 0, GRADES.length - 1)]

export function scriptOffers(game: Game, film: Film): ScriptOffer[] {
  const rng = makeRng(hashSeed(film.seed, 'scripts'))
  const writer = () => `${rng.pick(['Ava', 'Hal', 'Mina', 'Rory', 'Suki', 'Walt', 'Ines', 'Cal'])} ${rng.pick(['Penn', 'Doyle', 'Asher', 'Kemp', 'Moreau', 'Tan', 'Bishop'])}`
  const offer = (id: string, source: ScriptOffer['source'], lo: number, hi: number, costFor: (q: number) => number, name: string): ScriptOffer => {
    const quality = Math.round(rng.range(lo, hi))
    return { id, source, writer: name, quality, coverage: grade(quality + rng.normal(0, 6)), cost: Math.round(costFor(quality) / 1000) * 1000 }
  }
  const repBoost = game.reputation / 5
  return [
    offer('self', 'self', 22, 48, () => 0, `${game.studio.owner} (you)`),
    offer('spec', 'spec', 30, 62, (q) => 8_000 + q * q * 8, writer()),
    offer('spec2', 'spec', 35, 68 + repBoost / 2, (q) => 12_000 + q * q * 10, writer()),
    offer('commission', 'commission', 52 + repBoost / 2, 88, (q) => 60_000 + q * q * 70, writer()),
  ]
}

// ---------- Quality ----------

export function filmWeights(film: Pick<Film, 'genre' | 'subgenre'>): Weights {
  const base = { ...GENRES[film.genre].weights }
  const sub = subgenreById(film.subgenre)
  if (sub) for (const d of DEPTS) base[d] = Math.max(0, base[d] + (sub.shift[d] ?? 0))
  if (film.subgenre === 'parody') {
    // Parody is the most script-driven film in the game.
    const rest = DEPTS.filter((d) => d !== 'script')
    const restTotal = rest.reduce((s, d) => s + base[d], 0)
    for (const d of rest) base[d] = (base[d] / restTotal) * 55
    base.script = 45
  }
  const total = DEPTS.reduce((s, d) => s + base[d], 0)
  for (const d of DEPTS) base[d] = Math.round((base[d] / total) * 100)
  return base
}

const fitted = (t: Talent | undefined, film: Film) => (t ? t.skill * (0.6 + 0.4 * (t.genreFit[film.genre] / 100)) : 20)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function deptScores(film: Film, talent: Talent[]): Record<Dept, number> {
  const byId = (id?: string) => talent.find((t) => t.id === id)
  const leads = film.leadIds.map(byId)
  const support = film.supportIds.map(byId)
  const leadScore = leads.length ? avg(leads.map((t) => fitted(t, film))) : 15
  const supportScore = support.length ? avg(support.map((t) => fitted(t, film))) : leadScore * 0.8
  const norm = normalShoot(film)
  const shortBy = Math.max(0, norm - film.shootWeeks)
  const extra = Math.min(4, Math.max(0, film.shootWeeks - norm))
  const tech = 100 * (1 - Math.exp(-film.techBudget / TECH_SCALE[film.genre]))
  const musicSpend = 100 * (1 - Math.exp(-film.musicBudget / MUSIC_SCALE))
  const composer = byId(film.composerId)
  return {
    script: film.script?.quality ?? 15,
    direction: clamp(fitted(byId(film.directorId), film) - shortBy * 4 + extra * 1.5, 0, 100),
    acting: clamp(leadScore * 0.75 + supportScore * 0.25, 0, 100),
    technical: clamp(tech - shortBy * 5 + extra * 2, 0, 100),
    music: clamp(composer ? fitted(composer, film) * 0.5 + musicSpend * 0.5 : musicSpend * 0.7, 0, 100),
  }
}

export function filmQuality(film: Film, talent: Talent[]): { quality: number; scores: Record<Dept, number> } {
  const scores = deptScores(film, talent)
  const w = filmWeights(film)
  let q = DEPTS.reduce((s, d) => s + (w[d] * scores[d]) / 100, 0)
  for (const e of film.events) if (e.chosen !== undefined) q += e.choices[e.chosen].quality
  if (film.reshoot) q += 4
  const rng = makeRng(hashSeed(film.seed, 'chemistry'))
  q += rng.normal(0, 4) // cast and crew chemistry
  return { quality: clamp(Math.round(q), 1, 99), scores }
}

// ---------- Production events ----------

type EventTemplate = (rng: ReturnType<typeof makeRng>, scale: number, film: Film, lead?: Talent) => Omit<ProductionEvent, 'week'>

const money = (n: number) => Math.round(n / 1000) * 1000

const EVENT_TEMPLATES: EventTemplate[] = [
  (rng, s) => ({
    title: 'Storm on location',
    text: 'A three-day storm has the crew stuck in their trailers.',
    choices: [
      { label: 'Wait it out', cost: money(s * rng.range(0.6, 1)), quality: 0, note: 'Pay for the lost days.' },
      { label: 'Shoot in the rain', cost: 0, quality: -3, note: 'Saves money, looks rushed.' },
    ],
  }),
  (rng, s, _f, lead) => ({
    title: `${lead?.name ?? 'Your lead'} won’t come out of their trailer`,
    text: 'Their agent says a bigger trailer and a rewrite of the big scene would help.',
    choices: [
      { label: 'Give in', cost: money(s * rng.range(0.4, 0.8)), quality: 1, note: 'Expensive, but they’ll be happy.' },
      { label: 'Hold firm', cost: 0, quality: -4, note: 'A sulky performance on camera.' },
    ],
  }),
  (rng, s, film) => ({
    title: 'Effects shots running over',
    text: 'The effects house says the big sequence needs more time and money.',
    choices: [
      { label: 'Pay the overage', cost: money(s * rng.range(0.8, 1.5) + film.techBudget * 0.1), quality: 0, note: 'Keep the shots as planned.' },
      { label: 'Cut the sequence', cost: 0, quality: film.genre === 'action' || film.genre === 'scifi' ? -6 : -2, note: 'Cheaper; audiences may notice.' },
    ],
  }),
  (rng, s) => ({
    title: 'Happy accident',
    text: 'An improvised moment on set had the whole crew in stitches. The director wants to rework a scene around it.',
    choices: [
      { label: 'Rework the scene', cost: money(s * rng.range(0.2, 0.4)), quality: 4, note: 'A bit of extra shooting.' },
      { label: 'Stick to the script', cost: 0, quality: 0, note: 'Stay on schedule.' },
    ],
  }),
  (rng, s) => ({
    title: 'Stunt injury',
    text: 'A stunt performer sprained an ankle. Everyone is OK, but the action scene is on hold.',
    choices: [
      { label: 'Delay and reshoot safely', cost: money(s * rng.range(0.5, 0.9)), quality: 0, note: 'Costs a few days.' },
      { label: 'Cover it in the edit', cost: 0, quality: -3, note: 'Choppy, but it’s done.' },
    ],
  }),
  (rng, s) => ({
    title: 'Location permit pulled',
    text: 'The city revoked your street permit at the last minute.',
    choices: [
      { label: 'Build the set on a stage', cost: money(s * rng.range(0.7, 1.2)), quality: 1, note: 'Pricey but controlled.' },
      { label: 'Shoot guerrilla style', cost: 0, quality: -2, note: 'Risky and a little rough.' },
    ],
  }),
]

export function rollProductionEvents(film: Film, talent: Talent[]): ProductionEvent[] {
  const rng = makeRng(hashSeed(film.seed, 'events'))
  const crew = [...film.leadIds, ...film.supportIds, film.directorId].map((id) => talent.find((t) => t.id === id)).filter(Boolean) as Talent[]
  const temper = avg(crew.map((t) => t.temperament)) || 30
  const rush = Math.max(0, normalShoot(film) - film.shootWeeks)
  const scale = Math.max(15_000, (film.techBudget + film.costs.talent) * 0.06)
  const lead = talent.find((t) => t.id === film.leadIds[0])
  const events: ProductionEvent[] = []
  for (let week = 1; week <= film.shootWeeks; week++) {
    const p = 0.1 + temper / 450 + rush * 0.04
    if (rng.chance(p) && events.length < 3) {
      const template = rng.pick(EVENT_TEMPLATES)
      events.push({ week, ...template(rng, scale, film, lead) })
    }
  }
  return events
}

// ---------- Costs ----------

export function talentCost(film: Film, talent: Talent[]): number {
  const ids = [film.directorId, film.composerId, ...film.leadIds, ...film.supportIds].filter(Boolean) as string[]
  return ids.reduce((s, id) => {
    const t = talent.find((x) => x.id === id)
    if (!t) return s
    const fee = talentFee(t)
    return s + (film.supportIds.includes(id) ? Math.round(fee * 0.5) : fee)
  }, 0)
}

export const productionCost = (film: Film) => film.techBudget + film.musicBudget + film.shootWeeks * CREW_WEEKLY
export const reshootCost = (film: Film) => money(productionCost(film) * 0.15 + 20_000)
export const marketingTotal = (film: Film) => film.marketing.tv + film.marketing.print + film.marketing.web + film.marketing.trailer
export const totalCost = (film: Film) => Object.values(film.costs).reduce((a, b) => a + b, 0)

// ---------- Release calendar ----------

export type MonthSlot = { offset: number; year: number; month: number; competition: number; rivals: string[]; season: number }

export function releaseCalendar(game: Game, film: Film, startWeek: number): MonthSlot[] {
  const slots: MonthSlot[] = []
  const startAbsMonth = yearOf(startWeek) * 12 + monthOf(startWeek)
  for (let offset = 1; offset <= 6; offset++) {
    const abs = startAbsMonth + offset
    const year = Math.floor(abs / 12)
    const month = abs % 12
    const rng = makeRng(hashSeed(game.seed, 'competition', abs))
    const busy = [4, 5, 6, 10, 11].includes(month) ? 0.25 : 0
    const competition = clamp(rng.range(0.05, 0.6) + busy, 0, 1)
    const count = Math.round(1 + competition * 4)
    const rivals = Array.from({ length: count }, () => `${rng.pick(RIVAL_TITLE_A)} ${rng.pick(RIVAL_TITLE_B)} (${rng.pick(RIVAL_STUDIOS)})`)
    const g = GENRES[film.genre]
    let season = g.peakMonths.includes(month) ? 1.25 : 1
    if (film.subgenre === 'holiday-romance') season = month === 11 ? 1.6 : 0.6
    slots.push({ offset, year, month, competition, rivals, season })
  }
  return slots
}

export const monthLabel = (slot: Pick<MonthSlot, 'month' | 'year'>) => `${MONTHS[slot.month]} ${slot.year}`

// ---------- Box office ----------

export function trendFor(game: Game, film: Pick<Film, 'genre' | 'subgenre' | 'parodyTarget'>): number {
  const id = film.subgenre === 'parody' ? film.parodyTarget : film.subgenre
  if (id && game.trends[id] !== undefined) return game.trends[id]
  const subs = SUBGENRES.filter((s) => s.genre === film.genre)
  return avg(subs.map((s) => game.trends[s.id] ?? 1))
}

export function computeHype(game: Game, film: Film): number {
  const byId = (id?: string) => game.talent.find((t) => t.id === id)
  const leadStar = avg(film.leadIds.map((id) => byId(id)?.star ?? 0))
  const directorStar = byId(film.directorId)?.star ?? 0
  const young = GENRES[film.genre].youngShare
  const m = film.marketing
  const effective = m.tv + m.print * (0.5 + 0.8 * (1 - young)) + m.web * (0.5 + 0.8 * young) + Math.min(m.trailer, 2_000_000) * 1.4
  const marketing = 2 * (1 - Math.exp(-effective / 15_000_000))
  const trend = trendFor(game, film)
  const text = film.logline.toLowerCase()
  const sub = subgenreById(film.subgenre)
  const keyword = (text.includes(game.hotKeyword) ? 0.12 : 0) + (sub && sub.keywords.some((k) => text.includes(k)) ? 0.05 : 0)
  return Math.max(0.15, 0.3 + ((leadStar + directorStar * 0.4) / 100) * 1.1 + marketing + (trend - 1) * 0.8 + keyword)
}

export function simulateRelease(game: Game, film: Film, slot: MonthSlot): FilmResult {
  const rng = makeRng(hashSeed(film.seed, 'boxoffice'))
  const { quality, scores } = filmQuality(film, game.talent)
  const hype = computeHype(game, film)
  const trend = trendFor(game, film)
  const { reviews, criticScore } = reviewFilm(film, quality, trend, scores, rng)
  // Audiences are unpredictable: every film rolls a reception factor that can sink a
  // good film or lift a modest one. Most films land near 1; a few flop or break out.
  const reception = Math.exp(rng.normal(-0.12, 0.42))
  const appeal = Math.pow(trend, 0.6) * (0.6 + (0.6 * quality) / 100) * slot.season * (1 - slot.competition * 0.4) * reception
  const bookable = Math.round(Math.min(film.release.screens, 250 + hype * 1300))
  let perScreen = 2400 * hype * appeal * rng.range(0.9, 1.1)
  let hold = 0.28 + (0.45 * quality) / 100 + (criticScore - 50) / 600 + (reception - 1) * 0.05 - Math.max(0, hype - 2) * 0.03 + rng.normal(0, 0.03)
  if (film.subgenre === 'parody' && trend < 1) hold -= 0.05 // stale target
  hold = clamp(hold, 0.22, 0.8)
  // Word of mouth: only films critics and audiences both like get booked into more
  // theaters, and even a sleeper hit grows to at most three times its opening count.
  const buzz = criticScore >= 60 && quality >= 55 && reception > 0.9 ? (criticScore - 58) / 100 + (quality - 55) / 100 : 0
  const maxScreens = Math.min(3800, bookable * 3)
  let screens = bookable
  let peakScreens = bookable
  const weekly: number[] = []
  while (weekly.length < 20) {
    const gross = Math.round(screens * perScreen)
    if (weekly.length > 0 && gross < 40_000) break
    weekly.push(gross)
    if (weekly.length < 5 && buzz > 0) screens = Math.min(maxScreens, Math.round(screens * (1 + buzz * 1.1)))
    else if (perScreen < 1500) screens = Math.max(50, Math.round(screens * 0.75))
    peakScreens = Math.max(peakScreens, screens)
    perScreen *= clamp(hold + (buzz > 0 && weekly.length < 5 ? 0.05 : 0) + rng.normal(0, 0.02), 0.2, 0.9)
  }
  const opening = weekly[0]
  const domestic = weekly.reduce((a, b) => a + b, 0)
  const intl = film.genre === 'action' || film.genre === 'scifi' ? 1.3 : film.genre === 'horror' ? 1.1 : film.genre === 'comedy' ? 0.8 : 0.95
  const studioRevenue = Math.round(domestic * 0.5)
  const ancillary = Math.round(domestic * (0.15 + (0.3 * quality) / 100) * intl)
  const cost = totalCost(film)
  const funded = film.financing?.used ?? 0
  // Recoupment: the backer is paid back what it put in first, then takes its share of the rest.
  const gross = studioRevenue + ancillary
  const partnerCut = film.financing ? Math.round(Math.min(gross, funded) + Math.max(0, gross - funded) * film.financing.share) : 0
  const result: FilmResult = {
    quality,
    deptScores: scores,
    hype,
    opening,
    weekly,
    domestic,
    ancillary,
    studioRevenue,
    totalCost: cost,
    profit: studioRevenue + ancillary - partnerCut - (cost - funded),
    funded,
    partnerCut,
    reviews,
    criticScore,
    peakScreens,
    reception,
    headline: '',
    breakdown: [],
    releaseYear: slot.year,
    releaseMonth: slot.month,
  }
  result.headline = writeHeadline(film, result, rng, bookable < film.release.screens ? bookable : undefined)
  result.breakdown = writeBreakdown(film, result, filmWeights(film), trend, slot, bookable)
  return result
}
