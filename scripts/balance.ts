// Headless balance check: plays sample films with different strategies and prints outcomes.
// Run with: npx tsx scripts/balance.ts
import { newGame, talentFee, willWork } from '../src/game/world'
import { newFilm, scriptOffers, releaseCalendar } from '../src/game/sim'
import { chooseScript, confirmCast, startProduction, resolveEvent, wrapProduction, finishPost, releaseFilm, closeFilm } from '../src/game/store'
import { money } from '../src/game/text'
import type { Game, Film } from '../src/game/types'
import type { GenreId } from '../src/game/data'

type Plan = { name: string; genre: GenreId; sub?: string; script: number; star: 'cheap' | 'best'; tech: number; music: number; mkt: number; screens: number }

function play(game: Game, plan: Plan): Game {
  let g: Game = { ...game, current: { ...newFilm(game), title: plan.name, genre: plan.genre, subgenre: plan.sub, logline: 'test' } }
  const offers = scriptOffers(g, g.current!)
  g = chooseScript(g, g.current!, offers[plan.script].id, offers)
  const avail = (role: string) => g.talent.filter((t) => t.role === role && willWork(t, g.reputation))
  const pick = (role: string) => {
    const list = avail(role).sort((a, b) => plan.star === 'best' ? b.skill + b.star - (a.skill + a.star) : talentFee(a) - talentFee(b))
    return plan.star === 'cheap' ? list.sort((a, b) => b.skill - a.skill).filter((t) => talentFee(t) < 120_000)[0] ?? list[0] : list[0]
  }
  const f: Film = { ...g.current!, directorId: pick('director').id, leadIds: [pick('actor').id], techBudget: plan.tech, musicBudget: plan.music }
  g = confirmCast(g, f)
  g = startProduction(g, g.current!)
  g.current!.events.forEach((_, i) => { g = resolveEvent(g, g.current!, i, 1) })
  g = wrapProduction(g, g.current!)
  g = finishPost(g, g.current!, false)
  const film = { ...g.current!, marketing: { tv: plan.mkt * 0.4, print: plan.mkt * 0.1, web: plan.mkt * 0.4, trailer: plan.mkt * 0.1 }, release: { monthOffset: 2, screens: plan.screens } }
  const slot = releaseCalendar(g, film, g.week).find((s) => s.offset === 2)!
  const cashBefore = g.cash
  g = releaseFilm(g, film, slot)
  const r = g.current!.result!
  console.log(`${plan.name.padEnd(22)} Q${String(r.quality).padStart(3)} crit ${String(r.criticScore).padStart(3)}% hype ${r.hype.toFixed(2)} open ${money(r.opening).padStart(7)} dom ${money(r.domestic).padStart(7)} cost ${money(r.totalCost).padStart(7)} profit ${money(r.profit).padStart(7)} | cash ${money(cashBefore)}→${money(g.cash)} rep ${g.reputation}`)
  return closeFilm(g)
}

const plans: Plan[] = [
  { name: 'Cheap horror', genre: 'horror', sub: 'slasher', script: 2, star: 'cheap', tech: 300_000, music: 80_000, mkt: 150_000, screens: 400 },
  { name: 'Found footage', genre: 'horror', sub: 'found-footage', script: 1, star: 'cheap', tech: 50_000, music: 40_000, mkt: 100_000, screens: 400 },
  { name: 'Indie drama', genre: 'drama', script: 2, star: 'cheap', tech: 100_000, music: 60_000, mkt: 150_000, screens: 400 },
  { name: 'Cheap comedy', genre: 'comedy', script: 2, star: 'cheap', tech: 100_000, music: 40_000, mkt: 200_000, screens: 1200 },
  { name: 'Broke action', genre: 'action', script: 1, star: 'cheap', tech: 300_000, music: 50_000, mkt: 150_000, screens: 400 },
]
for (let run = 0; run < 3; run++) {
  console.log(`--- run ${run + 1}`)
  for (const p of plans) play(newGame('Test', 'Bot'), p)
}
console.log('--- career: 8 cheap horrors in a row')
let g = newGame('Career', 'Bot')
for (let i = 0; i < 8; i++) g = play(g, { ...plans[0], name: `Horror ${i + 1}`, tech: Math.min(600_000, Math.max(200_000, g.cash * 0.3)), mkt: Math.max(100_000, g.cash * 0.2), screens: g.cash > 3e6 ? 1200 : 400 })
