// Game actions (pure: each takes a Game and returns a new one) plus saving and the name filter.

import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'
import { START_YEAR, overheadFor } from './data'
import { clamp } from './rng'
import {
  POST_WEEKS, PRINT_COST, grade, filmQuality, marketingTotal, productionCost, reshootCost, rollProductionEvents,
  simulateRelease, talentCost, type MonthSlot,
} from './sim'
import { getImages, putImage } from '../images'
import type { Bid, Film, Game } from './types'
import { advanceWeeks, ageTalent, campaignOver, yearOf } from './world'

const SAVE_KEY = 'greenlit.save.v1'
export const LOAN_STEP = 250_000
export const LOAN_LIMIT = 1_000_000

// ---------- Name filter ----------

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers })
export const isClean = (text: string) => !matcher.hasMatch(text)

// ---------- Saving ----------

export function loadGame(): Game | undefined {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return undefined
    const game = JSON.parse(raw) as Game
    return game.version === 1 ? game : undefined
  } catch {
    return undefined
  }
}

export function saveGame(game: Game | undefined) {
  try {
    if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    // Storage can be unavailable (private mode); the game still plays.
  }
}

// A save export carries the player's images too, so posters survive moving devices.
type SaveFile = Game & { images?: Record<string, string> }

export async function exportSave(game: Game) {
  const ids = [game.studio.logoId, ...game.films.map((f) => f.posterId), game.current?.posterId].filter(Boolean) as string[]
  const file: SaveFile = { ...game, images: await getImages(ids) }
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `greenlit-${game.studio.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${yearOf(game.week)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importSave(file: File): Promise<Game> {
  const { images, ...game } = JSON.parse(await file.text()) as SaveFile
  if (game.version !== 1 || !game.studio?.id) throw new Error('Not a Greenlit save file')
  for (const [id, url] of Object.entries(images ?? {})) await putImage(id, url)
  return game
}

// Attach a picture to a film, whether it's in production or already released.
export function setPoster(game: Game, filmId: string, posterId: string): Game {
  if (game.current?.id === filmId) return { ...game, current: { ...game.current, posterId } }
  return { ...game, films: game.films.map((f) => (f.id === filmId ? { ...f, posterId } : f)) }
}

// ---------- Time ----------

function passTime(game: Game, weeks: number): Game {
  const yearBefore = yearOf(game.week)
  const overhead = overheadFor(game.reputation) + Math.round((game.debt * 0.08) / 52)
  const g = advanceWeeks(game, weeks, overhead)
  const years = yearOf(g.week) - yearBefore
  return years > 0 ? { ...g, talent: ageTalent(g, years) } : g
}

// Pays a cost, drawing on the backer's money first when the film has one.
function withFilm(game: Game, film: Film, cost = 0): Game {
  const f = film.financing
  if (f && cost > 0) {
    const draw = Math.min(cost, f.cap - f.used)
    film = { ...film, financing: { ...f, used: f.used + draw } }
    cost -= draw
  }
  return { ...game, current: film, cash: game.cash - cost }
}

export const backerLeft = (film: Film) => (film.financing ? film.financing.cap - film.financing.used : 0)

// ---------- Film pipeline ----------

export function canStartFilm(game: Game) {
  return !game.current && !campaignOver(game.week)
}

export function acceptFinancing(game: Game, film: Film, bid: Bid | undefined): Game {
  return withFilm(game, { ...film, financing: bid ? { ...bid, used: 0 } : undefined, stage: 'script' })
}

export function chooseScript(game: Game, film: Film, offerId: string, offers: { id: string; cost: number }[]): Game {
  const offer = offers.find((o) => o.id === offerId)
  if (!offer) return game
  const next = { ...film, script: offer as Film['script'], costs: { ...film.costs, script: offer.cost }, stage: 'cast' as const }
  return withFilm(game, next, offer.cost)
}

export function confirmCast(game: Game, film: Film): Game {
  const cost = talentCost(film, game.talent)
  return withFilm(game, { ...film, costs: { ...film.costs, talent: cost }, stage: 'budget' }, cost)
}

export function startProduction(game: Game, film: Film): Game {
  const cost = productionCost(film)
  const events = rollProductionEvents({ ...film, costs: { ...film.costs, production: cost } }, game.talent)
  return withFilm(game, { ...film, events, costs: { ...film.costs, production: cost }, stage: 'production' }, cost)
}

// Choices on set can be changed freely; their costs are charged when production wraps.
export function resolveEvent(game: Game, film: Film, index: number, choice: number): Game {
  if (!film.events[index]) return game
  const events = film.events.map((e, i) => (i === index ? { ...e, chosen: choice } : e))
  return withFilm(game, { ...film, events })
}

export const eventCosts = (film: Film) => film.events.reduce((s, e) => s + (e.chosen === undefined ? 0 : e.choices[e.chosen].cost), 0)

export function wrapProduction(game: Game, film: Film): Game {
  const cost = eventCosts(film)
  const { quality } = filmQuality(film, game.talent)
  const testScore = grade(quality + (((film.seed % 13) - 6) | 0))
  const next = { ...film, testScore, costs: { ...film.costs, events: cost }, stage: 'post' as const }
  return passTime(withFilm(game, next, cost), film.shootWeeks)
}

export function finishPost(game: Game, film: Film, reshoot: boolean): Game {
  const cost = reshoot ? reshootCost(film) : 0
  const next = { ...film, reshoot, costs: { ...film.costs, post: cost }, stage: 'release' as const }
  return passTime(withFilm(game, next, cost), POST_WEEKS)
}

export function releaseFilm(game: Game, film: Film, slot: MonthSlot): Game {
  const marketing = marketingTotal(film)
  const prints = film.release.screens * PRINT_COST
  const costed: Film = { ...film, costs: { ...film.costs, marketing, prints } }
  let g = withFilm(game, costed, marketing + prints)
  const targetWeek = (slot.year - START_YEAR) * 52 + Math.round((slot.month * 52) / 12)
  g = passTime(g, Math.max(0, targetWeek - g.week))
  const paid = g.current!
  const result = simulateRelease(g, paid, slot)
  const done: Film = { ...paid, result, stage: 'results' }
  const hired = new Set([film.directorId, film.composerId, ...film.leadIds, ...film.supportIds])
  const firm = film.events.some((e) => e.title.includes('trailer') && e.chosen === 1)
  const happy = result.profit > 0 || result.quality >= 60
  const talent = g.talent.map((t) => {
    if (!hired.has(t.id)) return t
    let rel = t.relationship + (happy ? 10 : -5)
    if (firm && t.id === film.leadIds[0]) rel -= 15
    const starBump = result.domestic > 50_000_000 ? 4 : result.domestic > 10_000_000 ? 2 : result.quality < 35 ? -2 : 0
    return { ...t, relationship: clamp(rel, -100, 100), star: clamp(t.star + starBump, 1, 99) }
  })
  const repDelta = (result.quality - 45) / 6 + (result.profit > 0 ? 2 : -1) + (result.domestic > 25_000_000 ? 4 : result.domestic > 5_000_000 ? 2 : 0)
  return {
    ...g,
    talent,
    cash: g.cash + result.studioRevenue + result.ancillary - result.partnerCut,
    reputation: clamp(Math.round(g.reputation + repDelta), 0, 100),
    current: done,
  }
}

export function closeFilm(game: Game): Game {
  if (!game.current) return game
  return { ...game, films: [...game.films, { ...game.current, stage: 'done' }], current: undefined }
}

// ---------- Money ----------

export const takeLoan = (game: Game): Game =>
  game.debt + LOAN_STEP > LOAN_LIMIT ? game : { ...game, debt: game.debt + LOAN_STEP, cash: game.cash + LOAN_STEP }

export const repayLoan = (game: Game): Game => {
  const amount = Math.min(LOAN_STEP, game.debt, Math.max(0, game.cash))
  return { ...game, debt: game.debt - amount, cash: game.cash - amount }
}

// ---------- Stats ----------

export function lifetimeGross(game: Game) {
  return game.films.reduce((s, f) => s + (f.result?.domestic ?? 0), 0)
}
