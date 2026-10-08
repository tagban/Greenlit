// The theatrical run, one week at a time. The player can advance a week, skip to the end,
// buy extra advertising, and answer promotion events (talk shows, rival openings, viral
// moments). Every week's numbers come from a seed plus the player's recorded choices, so a
// run can be replayed exactly.

import { clamp, hashSeed, makeRng } from './rng'
import { computeHype, filmQuality, filmWeights, totalCost, trendFor, type MonthSlot } from './sim'
import { money, reviewFilm, writeBreakdown, writeHeadline } from './text'
import type { Film, FilmResult, Game, Review, Talent } from './types'

export type RunChoice = { label: string; cost: number; note: string }
export type RunEvent = { key: string; title: string; text: string; choices: RunChoice[] }

export type RunState = {
  week: number // weeks played so far (1 = opening weekend done)
  weekly: number[]
  screens: number
  bookable: number
  peakScreens: number
  maxScreens: number
  perScreen: number
  hold: number
  buzz: number
  quality: number
  scores: FilmResult['deptScores']
  criticScore: number
  reviews: Review[]
  hype: number
  reception: number
  trend: number
  share: number // studio's share of the box office
  boost: number // extra pull from ads and promotion this coming week (multiplier - 1)
  adSpend: number
  log: string[] // one line per week, newest last
  pending?: RunEvent
  done: boolean
  slot: MonthSlot
}

const MAX_WEEKS = 20
const FLOOR = 40_000

// ---------- Opening weekend ----------

export function openRun(game: Game, film: Film, slot: MonthSlot): RunState {
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
  const perScreen = 2000 * hype * appeal * rng.range(0.9, 1.1)
  let hold = 0.28 + (0.45 * quality) / 100 + (criticScore - 50) / 600 + (reception - 1) * 0.05 - Math.max(0, hype - 2) * 0.03 + rng.normal(0, 0.03)
  if (film.subgenre === 'parody' && trend < 1) hold -= 0.05 // stale target
  // Word of mouth: only films critics and audiences both like get booked into more
  // theaters, and even a sleeper hit grows to at most two and a half times its opening count.
  const buzz = criticScore >= 60 && quality >= 55 && reception > 0.9 ? (criticScore - 58) / 100 + (quality - 55) / 100 : 0
  const opening = Math.round(bookable * perScreen)
  return {
    week: 1,
    weekly: [opening],
    screens: bookable,
    bookable,
    peakScreens: bookable,
    maxScreens: Math.min(3800, Math.round(bookable * 2.5)),
    perScreen,
    hold: clamp(hold, 0.22, 0.8),
    buzz,
    quality,
    scores,
    criticScore,
    reviews,
    hype,
    reception,
    trend,
    share: 0.5,
    boost: 0,
    adSpend: 0,
    log: [`Opening weekend: ${money(opening)} on ${bookable.toLocaleString()} screens.`],
    pending: rollRunEvent(game, film, 1, criticScore),
    done: opening < FLOOR,
    slot,
  }
}

// ---------- Promotion events ----------

function rollRunEvent(game: Game, film: Film, week: number, criticScore: number): RunEvent | undefined {
  const rng = makeRng(hashSeed(film.seed, 'run-event', week))
  if (week >= 8 || !rng.chance(week === 1 ? 0.55 : 0.3)) return undefined
  const lead = game.talent.find((t) => t.id === film.leadIds[0])
  const options: (RunEvent | undefined)[] = [
    lead && !lead.retired
      ? {
          key: 'talk-show',
          title: `${lead.name} is booked on a late-night talk show`,
          text: `The host wants ${lead.name} to come on and talk up “${film.title}”. It could sell a lot of tickets, if they behave.`,
          choices: [
            { label: 'Send them', cost: 25_000, note: 'Travel, stylist and a clip package. Charm sells tickets; a bad night makes headlines.' },
            { label: 'Pass', cost: 0, note: 'No risk, no reward.' },
          ],
        }
      : undefined,
    {
      key: 'rival-opens',
      title: 'A blockbuster opens next week',
      text: 'A rival studio’s summer-sized sequel opens against you and will grab screens.',
      choices: [
        { label: 'Counter-program with ads', cost: Math.round(Math.max(50_000, film.release.screens * 120) / 1000) * 1000, note: 'Pitch your film as the alternative.' },
        { label: 'Ride it out', cost: 0, note: 'Expect a hard week.' },
      ],
    },
    {
      key: 'viral',
      title: 'A scene from your film is going viral',
      text: 'A clip is all over social media. Fans are making memes.',
      choices: [
        { label: 'Pour fuel on it', cost: 60_000, note: 'Paid promotion and a fan contest.' },
        { label: 'Let it grow on its own', cost: 0, note: 'Free buzz, smaller bump.' },
      ],
    },
    {
      key: 'theater-dispute',
      title: 'A theater chain wants a bigger cut',
      text: 'One of the big chains says it will drop your film unless you take a smaller share of ticket sales.',
      choices: [
        { label: 'Accept a smaller share', cost: 0, note: 'Keep your screens; earn less per ticket.' },
        { label: 'Refuse', cost: 0, note: 'Lose a chunk of your screens.' },
      ],
    },
    criticScore >= 70
      ? {
          key: 'awards-buzz',
          title: 'Critics are talking awards',
          text: `“${film.title}” is showing up on early awards lists.`,
          choices: [
            { label: 'Run a “For Your Consideration” campaign', cost: 150_000, note: 'Ads in the trades. Helps the run and your reputation.' },
            { label: 'Let the work speak', cost: 0, note: 'A small boost anyway.' },
          ],
        }
      : undefined,
  ]
  const valid = options.filter(Boolean) as RunEvent[]
  return valid.length ? rng.pick(valid) : undefined
}

// Apply the player's answer to a promotion event. Returns the updated run and any reputation change.
export function answerRunEvent(game: Game, film: Film, run: RunState, choice: number): { run: RunState; rep: number } {
  const e = run.pending
  if (!e) return { run, rep: 0 }
  const rng = makeRng(hashSeed(film.seed, 'run-answer', run.week))
  const lead = game.talent.find((t) => t.id === film.leadIds[0]) as Talent | undefined
  let r: RunState = { ...run, pending: undefined }
  let rep = 0
  const say = (line: string) => (r = { ...r, log: [...r.log, line] })
  switch (e.key) {
    case 'talk-show':
      if (choice === 0) {
        // Difficult stars are a gamble on live TV.
        const disaster = rng.chance(0.1 + (lead?.temperament ?? 30) / 250)
        if (disaster) {
          r.boost -= 0.15
          rep -= 2
          say(`${lead?.name} rambled, insulted the host and walked off. The clip is everywhere, for the wrong reasons.`)
        } else {
          const charm = 0.12 + ((lead?.star ?? 20) / 100) * 0.25
          r.boost += charm
          say(`${lead?.name} killed it on late-night TV. Ticket sales are up.`)
        }
      } else say('You passed on the talk show.')
      break
    case 'rival-opens':
      r.boost += choice === 0 ? -0.05 : -0.25
      say(choice === 0 ? 'Your counter-programming ads softened the blow from the rival blockbuster.' : 'The rival blockbuster took a big bite out of your audience.')
      break
    case 'viral':
      r.boost += choice === 0 ? 0.35 : 0.15
      say(choice === 0 ? 'Your fan contest turned the viral clip into a phenomenon.' : 'The viral clip brought in some curious new viewers.')
      break
    case 'theater-dispute':
      if (choice === 0) {
        r.share = Math.max(0.4, r.share - 0.05)
        say('You gave the chain a bigger cut to keep your screens.')
      } else {
        r.screens = Math.round(r.screens * 0.75)
        say('The chain dropped your film from a quarter of its screens.')
      }
      break
    case 'awards-buzz':
      r.boost += choice === 0 ? 0.15 : 0.05
      r.hold = Math.min(0.85, r.hold + (choice === 0 ? 0.04 : 0.01))
      if (choice === 0) rep += 3
      say(choice === 0 ? 'The awards campaign has the industry talking.' : 'Awards chatter keeps the film in conversation.')
      break
  }
  return { run: r, rep }
}

// ---------- Advertising during the run ----------

// Extra ads lift the coming week with diminishing returns, scaled to how wide the film is playing.
export function adBoostFor(run: RunState, spend: number): number {
  const scale = Math.max(40_000, run.screens * 150)
  return 0.6 * (1 - Math.exp(-spend / scale))
}

export const AD_OPTIONS = (run: RunState) => {
  const round = (n: number) => Math.max(10_000, Math.round(n / 10_000) * 10_000)
  return [round(run.screens * 60), round(run.screens * 150), round(run.screens * 400)]
}

// ---------- One more week ----------

export function stepRun(game: Game, film: Film, run: RunState, adSpend = 0): RunState {
  if (run.done) return run
  const rng = makeRng(hashSeed(film.seed, 'week', run.week + 1))
  const week = run.week + 1
  let screens = run.screens
  if (week <= 5 && run.buzz > 0) screens = Math.min(run.maxScreens, Math.round(screens * (1 + run.buzz * 1.1)))
  else if (run.perScreen < 1500 && adSpend === 0) screens = Math.max(50, Math.round(screens * 0.75))
  const lift = 1 + run.boost + adBoostFor({ ...run, screens }, adSpend)
  const perScreen = run.perScreen * clamp(run.hold + (run.buzz > 0 && week <= 5 ? 0.05 : 0) + rng.normal(0, 0.02), 0.2, 0.9)
  const gross = Math.round(screens * perScreen * lift)
  const done = gross < FLOOR || week >= MAX_WEEKS
  const line = `Week ${week}: ${money(gross)} on ${screens.toLocaleString()} screens${adSpend ? ` (with ${money(adSpend)} in extra ads)` : ''}.`
  return {
    ...run,
    week,
    weekly: done && gross < FLOOR ? run.weekly : [...run.weekly, gross],
    screens,
    peakScreens: Math.max(run.peakScreens, screens),
    perScreen,
    boost: run.boost * 0.4, // promotion fades
    adSpend: run.adSpend + adSpend,
    log: [...run.log, done && gross < FLOOR ? `Week ${week}: theaters pulled the film.` : line],
    pending: done ? undefined : rollRunEvent(game, film, week, run.criticScore),
    done,
  }
}

// ---------- Final numbers ----------

export function finishRun(film: Film, run: RunState): FilmResult {
  const rng = makeRng(hashSeed(film.seed, 'final'))
  const domestic = run.weekly.reduce((a, b) => a + b, 0)
  const intl = film.genre === 'action' || film.genre === 'scifi' ? 1.3 : film.genre === 'horror' ? 1.1 : film.genre === 'comedy' ? 0.8 : 0.95
  const studioRevenue = Math.round(domestic * run.share)
  const ancillary = Math.round(domestic * (0.15 + (0.3 * run.quality) / 100) * intl)
  const cost = totalCost(film)
  const funded = film.financing?.used ?? 0
  // Recoupment: the backer is paid back what it put in first, then takes its share of the rest.
  const gross = studioRevenue + ancillary
  const partnerCut = film.financing ? Math.round(Math.min(gross, funded) + Math.max(0, gross - funded) * film.financing.share) : 0
  const result: FilmResult = {
    quality: run.quality,
    deptScores: run.scores,
    hype: run.hype,
    opening: run.weekly[0],
    weekly: run.weekly,
    domestic,
    ancillary,
    studioRevenue,
    totalCost: cost,
    profit: gross - partnerCut - (cost - funded),
    funded,
    partnerCut,
    reviews: run.reviews,
    criticScore: run.criticScore,
    peakScreens: run.peakScreens,
    reception: run.reception,
    headline: '',
    breakdown: [],
    releaseYear: run.slot.year,
    releaseMonth: run.slot.month,
  }
  result.headline = writeHeadline(film, result, rng, run.bookable < film.release.screens ? run.bookable : undefined)
  result.breakdown = writeBreakdown(film, result, filmWeights(film), run.trend, run.slot, run.bookable)
  return result
}

