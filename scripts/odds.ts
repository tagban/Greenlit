// Difficulty check: plays hundreds of first films with random or sensible choices and
// reports how often they make money. Run with: npx tsx scripts/odds.ts
import { GENRE_IDS, SUBGENRES } from '../src/game/data'
import { makeRng } from '../src/game/rng'
import { backerBids, newFilm, releaseCalendar, scriptOffers } from '../src/game/sim'
import { acceptFinancing, chooseScript, confirmCast, finishPost, releaseFilm, resolveEvent, startProduction, wrapProduction } from '../src/game/store'
import { money } from '../src/game/text'
import type { Game } from '../src/game/types'
import { newGame, talentFee, willWork } from '../src/game/world'

type Style = 'random' | 'smart'

function playOne(seed: number, style: Style): { profit: number; domestic: number; cost: number; roi: number } | undefined {
  const r = makeRng(seed)
  let g: Game = newGame('Odds', 'Bot')
  const subs = style === 'smart'
    ? [...SUBGENRES].filter((s) => s.id !== 'parody' && ['horror', 'comedy', 'drama'].includes(s.genre)).sort((a, b) => g.trends[b.id] - g.trends[a.id]).slice(0, 3)
    : SUBGENRES.filter((s) => s.id !== 'parody')
  const sub = r.pick(subs)
  const genre = style === 'random' && r.chance(0.2) ? r.pick(GENRE_IDS) : sub.genre
  const logline = style === 'smart' ? `A story of ${sub.keywords[0]} and ${sub.keywords[1]} with ${g.hotKeyword} at its heart, told with nerve.` : 'A movie about some people and what happens to them.'
  g = { ...g, current: { ...newFilm(g), title: 'X', genre, subgenre: genre === sub.genre ? sub.id : undefined, logline } }
  const bid = backerBids(g, g.current!).find((b) => b.cap > 0)
  if (!bid) return undefined
  g = acceptFinancing(g, g.current!, bid)
  const offers = scriptOffers(g, g.current!)
  const script = style === 'smart' ? offers.reduce((a, b) => (b.coverage < a.coverage && b.cost < bid.cap * 0.2 ? b : a)) : r.pick(offers)
  g = chooseScript(g, g.current!, script.id, offers)
  const pool = (role: string) => g.talent.filter((t) => t.role === role && !t.retired && willWork(t, g.reputation) && talentFee(t) < bid.cap * 0.25)
  const best = (role: string) => pool(role).sort((a, b) => b.skill * (0.6 + b.genreFit[genre] / 250) - a.skill * (0.6 + a.genreFit[genre] / 250))[0]
  const pick = (role: string) => (style === 'smart' ? best(role) : r.pick(pool(role)))
  const remaining = () => bid.cap - g.current!.financing!.used + g.cash
  g = confirmCast(g, { ...g.current!, directorId: pick('director')?.id, leadIds: [pick('actor')?.id].filter(Boolean) as string[] })
  const spend = remaining() * (style === 'smart' ? 0.45 : r.range(0.2, 0.7))
  g = startProduction(g, { ...g.current!, techBudget: Math.round(spend * 0.75), musicBudget: Math.round(spend * 0.25) })
  g.current!.events.forEach((e, i) => { g = resolveEvent(g, g.current!, i, style === 'smart' ? 0 : r.int(0, e.choices.length - 1)) })
  g = wrapProduction(g, g.current!)
  g = finishPost(g, g.current!, false)
  const mkt = Math.max(0, remaining() - 150_000) * (style === 'smart' ? 0.7 : r.range(0.2, 0.9))
  const film = { ...g.current!, marketing: { tv: mkt * 0.3, print: mkt * 0.1, web: mkt * 0.5, trailer: mkt * 0.1 }, release: { monthOffset: 1, screens: style === 'smart' ? 1200 : r.pick([400, 1200, 2500]) } }
  const slots = releaseCalendar(g, film, g.week)
  const slot = style === 'smart' ? slots.reduce((a, b) => (b.season - b.competition > a.season - a.competition ? b : a)) : slots[0]
  const prints = film.release.screens * 250
  if (mkt + prints > remaining()) film.release.screens = 400
  g = releaseFilm(g, { ...film, release: { ...film.release, monthOffset: slot.offset } }, slot)
  const res = g.current!.result!
  return { profit: res.profit, domestic: res.domestic, cost: res.totalCost, roi: (res.studioRevenue + res.ancillary) / res.totalCost }
}

for (const style of ['random', 'smart'] as Style[]) {
  const results = [] as { profit: number; domestic: number; cost: number; roi: number }[]
  let noDeal = 0
  for (let i = 0; i < 400; i++) {
    const r = playOne(1000 + i, style)
    if (r) results.push(r)
    else noDeal++
  }
  const profits = results.map((r) => r.profit).sort((a, b) => a - b)
  const q = (p: number) => profits[Math.floor(p * (profits.length - 1))]
  const win = results.filter((r) => r.roi > 1).length / results.length
  const hits = results.filter((r) => r.roi > 3).length / results.length
  const bombs = results.filter((r) => r.roi < 0.5).length / results.length
  const studioWin = results.filter((r) => r.profit > 0).length / results.length
  console.log(`${style.padEnd(7)} films ${results.length} (no deal ${noDeal}) | film earns back cost ${(win * 100).toFixed(0)}% | 3x hits ${(hits * 100).toFixed(1)}% | bombs (<half back) ${(bombs * 100).toFixed(0)}% | studio profits ${(studioWin * 100).toFixed(0)}% | studio profit p10 ${money(q(0.1))} median ${money(q(0.5))} p90 ${money(q(0.9))} max ${money(q(1))}`)
}
