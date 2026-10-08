// Procedural text: reviews, headlines and the post-release breakdown.
// Everything is filled from simulation results, so the words always match the numbers.

import { CRITICS, DEPTS, DEPT_LABEL, GENRES, MONTHS, subgenreById, type Dept, type Weights } from './data'
import { clamp, type Rng } from './rng'
import type { Film, FilmResult, Review } from './types'
import type { MonthSlot } from './sim'

const PRAISE: Record<Dept, string[]> = {
  script: ['a script that crackles', 'sharp, confident writing', 'a screenplay with real wit'],
  direction: ['assured direction', 'a director in full command', 'tension that never lets up'],
  acting: ['performances that land every beat', 'a lead who owns the screen', 'a cast with real chemistry'],
  technical: ['jaw-dropping craft', 'effects that sell every frame', 'gorgeous production design'],
  music: ['a score that lingers', 'superb sound design', 'music that does the heavy lifting'],
}

const KNOCK: Record<Dept, string[]> = {
  script: ['a script that needed another pass', 'dialogue that clunks', 'a plot full of holes'],
  direction: ['flat, aimless direction', 'pacing that sags in the middle', 'a director out of their depth'],
  acting: ['wooden performances', 'leads with zero chemistry', 'a miscast lead'],
  technical: ['effects that look cheap', 'sets that wobble', 'muddy, rushed visuals'],
  music: ['a forgettable score', 'sound mixing that buries the dialogue', 'music that tells you how to feel'],
}

const VERDICT = [
  ['a misfire', 'a slog', 'dead on arrival'],
  ['a mixed bag', 'watchable but forgettable', 'not quite there'],
  ['a solid night out', 'a crowd-pleaser', 'better than it has any right to be'],
  ['a triumph', 'a must-see', 'the best film of the year'],
]

export function starsFor(score: number) {
  return clamp(Math.round(score / 12.5) / 2, 0, 4)
}

export function reviewFilm(film: Film, quality: number, trend: number, scores: Record<Dept, number>, rng: Rng): { reviews: Review[]; criticScore: number } {
  const used = new Set<string>()
  const reviews: Review[] = CRITICS.map((c) => {
    let score = quality + (c.bias[film.genre] ?? 0) + c.harsh + rng.normal(0, 6)
    if (c.parodyFan && film.subgenre === 'parody') score += trend >= 1.2 ? 12 : trend < 0.9 ? -10 : 4
    score = clamp(score, 2, 99)
    const stars = starsFor(score)
    // Critics shouldn't sound identical: re-draw a repeated line a few times.
    let quote = ''
    for (let tries = 0; tries < 5 && (!quote || used.has(quote)); tries++) quote = writeQuote(film, score, c.persona, c.parodyFan ?? false, trend, scores, rng)
    used.add(quote)
    return { critic: c.name, outlet: c.outlet, persona: c.persona, stars, quote }
  })
  const criticScore = Math.round(reviews.reduce((s, r) => s + r.stars * 25, 0) / reviews.length)
  return { reviews, criticScore }
}

function writeQuote(film: Film, score: number, persona: string, parodyFan: boolean, trend: number, scores: Record<Dept, number>, rng: Rng): string {
  // Tone follows the star rating so the words never contradict the stars.
  const stars = starsFor(score)
  const tier = stars <= 1.5 ? 0 : stars <= 2 ? 1 : stars <= 3 ? 2 : 3
  const verdict = rng.pick(VERDICT[tier])
  // Critics notice what is actually strong and weak, with a little disagreement.
  const ranked = [...DEPTS].sort((a, b) => scores[b] + rng.normal(0, 8) - (scores[a] + rng.normal(0, 8)))
  const praise = rng.pick(PRAISE[ranked[0]])
  const knock = rng.pick(KNOCK[ranked[ranked.length - 1]])
  const title = film.title || 'This film'
  if (parodyFan && film.subgenre === 'parody') {
    const target = subgenreById(film.parodyTarget)?.name.toLowerCase() ?? 'blockbusters'
    return trend >= 1.2
      ? `Finally, someone skewers ${target} while everyone’s still lining up for them. ${title} is ${verdict}.`
      : `Mocking ${target} now? That ship sailed years ago. ${title} is ${verdict}.`
  }
  if (persona === 'the gore-hound' && film.genre !== 'horror') {
    return tier >= 2 ? `Not enough blood for my taste, but ${title} is ${verdict}.` : `Zero scares, zero gore, zero reasons to go. ${title} is ${verdict}.`
  }
  if (tier === 0) return `${title} is ${verdict}, sunk by ${knock}.`
  if (tier === 1) return `${title} has ${praise}, but ${knock} leave it ${verdict}.`
  if (tier === 2) return `With ${praise}, ${title} is ${verdict}.`
  return `${title} is ${verdict}: ${praise} and not a wasted minute.`
}

export const money = (n: number) => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}K`
  return `${sign}$${Math.round(abs)}`
}

export function writeHeadline(film: Film, r: FilmResult, rng: Rng, cappedScreens?: number): string {
  const t = film.title
  if (r.opening > 40_000_000) return rng.pick([`${t} explodes with ${money(r.opening)} opening`, `${t} crushes the competition: ${money(r.opening)}`])
  if (r.opening > 10_000_000) return rng.pick([`${t} opens strong with ${money(r.opening)}`, `Audiences turn out for ${t}: ${money(r.opening)}`])
  if (r.domestic > r.totalCost * 1.5) return rng.pick([`Sleeper hit: ${t} keeps selling tickets`, `Small film, big returns: ${t} earns ${money(r.domestic)}`])
  if (cappedScreens) return `Theaters balk at ${t}; only ${cappedScreens.toLocaleString()} screens booked`
  if (r.opening > 2_000_000 || r.profit > 0) return rng.pick([`${t} finds a modest crowd: ${money(r.opening)}`, `${t} opens to ${money(r.opening)}`])
  return rng.pick([`${t} barely registers at the box office`, `Crickets for ${t}: ${money(r.opening)} opening`])
}

export function writeBreakdown(film: Film, r: FilmResult, w: Weights, trend: number, slot: MonthSlot, booked: number): string[] {
  const lines: string[] = []
  const genre = GENRES[film.genre]
  const weighted = DEPTS.map((d) => ({ d, impact: w[d] * (r.deptScores[d] - 50) })).sort((a, b) => b.impact - a.impact)
  const best = weighted[0]
  const worst = weighted[weighted.length - 1]
  if (best.impact > 0) lines.push(`${DEPT_LABEL[best.d]} carried the film (scored ${Math.round(r.deptScores[best.d])} and counts for ${w[best.d]}% of a ${genre.name.toLowerCase()}).`)
  if (worst.impact < 0) lines.push(`${DEPT_LABEL[worst.d]} held it back (scored ${Math.round(r.deptScores[worst.d])}; ${w[worst.d]}% of a ${genre.name.toLowerCase()} rides on it).`)
  const sub = subgenreById(film.subgenre)
  const trendName = film.subgenre === 'parody' ? `${subgenreById(film.parodyTarget)?.name ?? 'Its target'} (the parody target)` : sub?.name ?? genre.name
  if (trend >= 1.2) lines.push(`${trendName} is hot right now, which boosted interest.`)
  else if (trend < 0.85) lines.push(`${trendName} is out of fashion; audiences stayed away.`)
  if (slot.season > 1.1) lines.push(`${MONTHS[slot.month]} is prime season for this kind of film.`)
  else if (slot.season < 1) lines.push(`${MONTHS[slot.month]} was the wrong month for it.`)
  if (slot.competition > 0.6) lines.push(`Heavy competition that month split the audience.`)
  if (booked < film.release.screens) lines.push(`Low hype meant theaters only booked ${booked.toLocaleString()} of the ${film.release.screens.toLocaleString()} screens you wanted. More marketing or bigger stars fix that.`)
  for (const e of film.events) {
    const c = e.chosen === undefined ? undefined : e.choices[e.chosen]
    if (c?.aftermath) lines.push(c.aftermath)
  }
  if (r.reception < 0.65) lines.push('Audiences just didn’t connect with it. Sometimes a film misses for reasons nobody can explain.')
  else if (r.reception > 1.5) lines.push('Audiences fell for it. Lightning in a bottle that no amount of planning can guarantee.')
  if (r.peakScreens > booked * 1.3) lines.push(`Strong word of mouth expanded it from ${booked.toLocaleString()} to ${r.peakScreens.toLocaleString()} screens.`)
  if (r.hype > 2 && r.quality < 50) lines.push('Big marketing bought a big opening, but word of mouth killed the second weekend.')
  if (r.quality >= 70 && r.hype < 1) lines.push('A genuinely good film that too few people heard about. Spend more on marketing next time.')
  return lines
}
