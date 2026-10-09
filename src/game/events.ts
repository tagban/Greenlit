// Production crises. Each event offers choices whose effects reach beyond the shoot:
// recasts change the film, fired talent holds grudges, word spreads to other actors,
// audiences react to stories they read about, backers remember, delays cost crew time.
// Choices can be changed until the wrap; effects apply when production wraps.

import { subgenreById } from './data'
import { clamp, hashSeed, makeRng, type Rng } from './rng'
import type { EventChoice, Film, Game, ProductionEvent, Talent } from './types'
import { talentFee, willWork } from './world'

export const CREW_WEEKLY = 8_000
const money = (n: number) => Math.round(n / 1000) * 1000
const delayCost = (weeks: number) => weeks * CREW_WEEKLY * 1.5

type Ctx = {
  rng: Rng
  game: Game
  film: Film
  scale: number // typical size of a setback for this film's budget
  lead?: Talent
  director?: Talent
  standIn?: Talent // best affordable replacement lead
  newDirector?: Talent
}

type Template = {
  key: string
  weight: (c: Ctx) => number // 0 = can't happen to this film
  make: (c: Ctx) => Omit<ProductionEvent, 'week' | 'key'>
}

const beloved = (t?: Talent) => (t?.star ?? 0) >= 55

function recastChoice(c: Ctx, label: string, extra: Partial<EventChoice>): EventChoice | undefined {
  if (!c.standIn) return undefined
  return {
    label: `${label} ${c.standIn.name}`,
    cost: money(talentFee(c.standIn) + delayCost(2)),
    quality: -5,
    delay: 2,
    recastWith: c.standIn.id,
    note: `Reshoot their scenes with ${c.standIn.name} (skill ${c.standIn.skill}, star ${c.standIn.star}). Two weeks lost.`,
    ...extra,
  }
}

const TEMPLATES: Template[] = [
  {
    key: 'lead-dies',
    // Never for real people: we don't invent deaths for them.
    weight: (c) => (!c.lead || c.lead.source ? 0 : c.lead.age >= 65 ? 0.5 : c.lead.age >= 55 ? 0.2 : 0.04),
    make: (c) => {
      const name = c.lead!.name
      const fans = beloved(c.lead)
      const choices = [
        recastChoice(c, 'Recast with', {
          hype: fans ? -0.25 : 0,
          note: `The film moves forward with ${c.standIn?.name}.${fans ? ` Fans of ${name} may not forgive it.` : ''}`,
          aftermath: fans ? `Replacing the late ${name} cost the film goodwill with fans.` : `${c.standIn?.name} stepped in after ${name}’s death.`,
        }),
        {
          label: 'Rewrite around their footage',
          cost: money(c.scale * 1.2 + delayCost(3)),
          quality: -8,
          delay: 3,
          hype: fans ? 0.25 : 0.05,
          note: `A tribute to ${name}. Critics may notice the seams.`,
          aftermath: fans ? `Audiences turned out to say goodbye to ${name}.` : `The rewrite around ${name}’s footage showed its seams.`,
        },
        {
          label: 'Shut down for a month',
          cost: money(c.scale * 1.5 + delayCost(4)),
          quality: -2,
          delay: 4,
          relAll: 6,
          note: 'Give everyone time to grieve, then finish with a stand-in and careful editing. Expensive, but the cast won’t forget it.',
          aftermath: 'Pausing production to grieve earned the studio lasting respect from actors.',
        },
      ].filter(Boolean) as EventChoice[]
      return {
        title: `Tragedy on set: ${name} has died`,
        text: `${name}, ${c.lead!.age}, died suddenly during the shoot. The cast and crew are devastated, and many of their scenes are still unshot.`,
        kills: c.lead!.id,
        choices,
      }
    },
  },
  {
    key: 'lead-quits',
    weight: (c) => (c.lead && !c.lead.source && c.lead.temperament >= 50 ? 0.6 + c.lead.temperament / 100 : 0),
    make: (c) => {
      const name = c.lead!.name
      const choices = [
        {
          label: 'Give them the rewrite',
          cost: money(c.scale * 0.5),
          quality: -2,
          relLead: 10,
          note: `${name} gets their way. The story bends a little.`,
        },
        recastChoice(c, 'Fire them and recast with', {
          relLead: -40,
          relAll: -6,
          note: `${name} will never work with you again, and other actors will hear about it.`,
          aftermath: `Firing ${name} mid-shoot made other actors wary of the studio.`,
        }),
        {
          label: 'Threaten to sue',
          cost: 0,
          quality: -5,
          rep: -3,
          relLead: -35,
          relAll: -4,
          note: 'They come back, furious. It will show on screen, and the story will leak.',
          aftermath: `The legal fight with ${name} leaked to the trades.`,
        },
      ].filter(Boolean) as EventChoice[]
      return {
        title: `${name} walks off the set`,
        text: `${name} says they won’t return unless the third act is rewritten around their character.`,
        choices,
      }
    },
  },
  {
    key: 'scandal',
    weight: (c) => (c.lead && !c.lead.source && c.lead.star >= 30 ? 0.5 : 0),
    make: (c) => {
      const name = c.lead!.name
      const choices = [
        {
          label: 'Stand by them',
          cost: 0,
          quality: 0,
          hype: -0.2,
          relLead: 15,
          relAll: 3,
          note: 'Loyalty earns respect from actors. Some audiences will stay away.',
          aftermath: `The ${name} scandal kept some audiences away.`,
        },
        recastChoice(c, 'Drop them and recast with', {
          relLead: -40,
          relAll: -4,
          rep: 1,
          note: `Cut ties fast. ${name} won’t forget it.`,
        }),
        {
          label: 'Lean into the headlines',
          cost: 0,
          quality: 0,
          hype: 0.25,
          rep: -4,
          note: 'There’s no such thing as bad press. Respectable people will remember this.',
          aftermath: 'Leaning into the scandal sold tickets and cost the studio respect.',
        },
      ].filter(Boolean) as EventChoice[]
      return {
        title: `Scandal: ${name} is all over the tabloids`,
        text: `Photos of ${name} at a wild party are on every front page. The publicity team wants a decision by morning.`,
        choices,
      }
    },
  },
  {
    key: 'director-final-cut',
    weight: (c) => (!c.director ? 0 : c.director.source ? 0.15 : c.director.temperament >= 45 ? 0.6 : 0.15),
    make: (c) => {
      const d = c.director!
      const visionary = d.skill >= 65
      const choices: EventChoice[] = [
        {
          label: 'Give them final cut',
          cost: 0,
          quality: visionary ? 4 : -5,
          relDirector: 15,
          note: 'Trust the director’s vision completely.',
          aftermath: visionary ? `${d.name}’s uncompromised vision paid off.` : `${d.name}’s indulgent cut ran long and lost audiences.`,
        },
        {
          label: 'Split the difference',
          cost: money(c.scale * 0.3),
          quality: 0,
          note: 'Some extra days of shooting and two cuts to compare.',
        },
      ]
      if (c.newDirector) {
        choices.push({
          label: `Fire them and hire ${c.newDirector.name}`,
          cost: money(talentFee(c.newDirector) + delayCost(2)),
          quality: -6,
          delay: 2,
          rep: -2,
          relDirector: -40,
          relAll: -3,
          replaceDirector: c.newDirector.id,
          note: 'A director change mid-shoot. The seams will show.',
          aftermath: `Replacing ${d.name} mid-shoot left the film uneven.`,
        })
      }
      return {
        title: `${d.name} demands final cut`,
        text: `Your director says they’ll walk unless they get the final say on the edit.${visionary ? ' Their dailies look terrific.' : ' Their dailies are… a lot.'}`,
        choices,
      }
    },
  },
  {
    key: 'backer-meddles',
    weight: (c) => (c.film.financing ? 0.7 : 0),
    make: (c) => {
      const b = c.film.financing!.backer
      return {
        title: `${b} wants changes`,
        text: `${b} watched the dailies and wants a happier ending and a softer rating to reach more people.`,
        choices: [
          { label: 'Make the changes', cost: money(c.scale * 0.4), quality: -4, hype: 0.05, backerRel: 6, note: `${b} is pleased. The film gets safer.` },
          { label: 'Refuse', cost: 0, quality: 0, backerRel: -12, note: `${b} will remember this next time you pitch.`, aftermath: `${b} was unhappy you ignored their notes.` },
          { label: 'Negotiate', cost: money(c.scale * 0.6), quality: -1, backerRel: 0, note: 'Shoot both endings and test them. Costly, but everyone saves face.' },
        ],
      }
    },
  },
  {
    key: 'strike',
    weight: () => 0.35,
    make: (c) => ({
      title: 'The crew goes on strike',
      text: 'The crew’s union has walked out over overtime pay. The set is dark.',
      choices: [
        { label: 'Meet their demands', cost: money(c.scale * 1.2), quality: 0, relAll: 2, note: 'Expensive, but everyone is back tomorrow.' },
        { label: 'Wait it out', cost: money(delayCost(4)), quality: 0, delay: 4, note: 'Four weeks of nothing, and your release slips.' },
        { label: 'Bring in replacement crews', cost: money(c.scale * 0.3), quality: -5, rep: -4, relAll: -8, note: 'Crossing the picket line. Actors won’t like it.', aftermath: 'Crossing the picket line soured actors on the studio.' },
      ],
    }),
  },
  {
    key: 'copycat',
    weight: (c) => (c.film.subgenre ? 0.4 : 0.2),
    make: (c) => {
      const what = subgenreById(c.film.subgenre)?.name.toLowerCase() ?? 'film like yours'
      return {
        title: 'A rival is making the same movie',
        text: `A bigger studio just announced a ${what} with a near-identical premise.`,
        choices: [
          { label: 'Ignore it', cost: 0, quality: 0, hype: -0.2, note: 'Audiences may see yours as the knockoff.', aftermath: 'A rival’s look-alike film stole some of the buzz.' },
          { label: 'Rewrite to stand apart', cost: money(c.scale * 0.6 + delayCost(1)), quality: 1, delay: 1, note: 'A week of rewrites makes it its own thing.' },
          { label: 'Get the trailer out first', cost: money(c.scale * 0.5), quality: 0, hype: 0.05, note: 'Plant your flag before they do.' },
        ],
      }
    },
  },
  {
    key: 'leak',
    weight: () => 0.3,
    make: (c) => ({
      title: 'The script leaked online',
      text: 'The full script, twist ending and all, is circulating on fan forums.',
      choices: [
        { label: 'Rewrite the ending', cost: money(c.scale * 0.5 + delayCost(1)), quality: -1, delay: 1, note: 'Keep the surprise, lose a week.' },
        { label: 'Shrug it off', cost: 0, quality: 0, hype: -0.15, note: 'Spoiled fans may skip it.', aftermath: 'The leaked script spoiled the twist for many fans.' },
      ],
    }),
  },
  {
    key: 'storm',
    weight: () => 0.6,
    make: (c) => ({
      title: 'Storm on location',
      text: 'A week of storms has the crew stuck in their trailers.',
      choices: [
        { label: 'Wait it out', cost: money(c.scale * c.rng.range(0.6, 1)), quality: 0, delay: 1, note: 'Pay for the lost days.' },
        { label: 'Shoot in the rain', cost: 0, quality: -3, note: 'Saves money, looks rushed.' },
      ],
    }),
  },
  {
    key: 'vfx-overrun',
    weight: (c) => (c.film.genre === 'action' || c.film.genre === 'scifi' ? 0.9 : 0.3),
    make: (c) => ({
      title: 'Effects shots running over',
      text: 'The effects house says the big sequence needs more time and money.',
      choices: [
        { label: 'Pay the overage', cost: money(c.scale * c.rng.range(0.8, 1.5) + c.film.techBudget * 0.1), quality: 0, note: 'Keep the shots as planned.' },
        { label: 'Cut the sequence', cost: 0, quality: c.film.genre === 'action' || c.film.genre === 'scifi' ? -6 : -2, note: 'Cheaper; audiences may notice.' },
      ],
    }),
  },
  {
    key: 'stunt-injury',
    weight: (c) => (c.film.genre === 'action' ? 0.8 : 0.25),
    make: (c) => ({
      title: 'Stunt injury',
      text: 'A stunt performer was hurt. They’ll recover, but the action scene is on hold and the crew is shaken.',
      choices: [
        { label: 'Pause and redo it safely', cost: money(c.scale * c.rng.range(0.5, 0.9) + delayCost(1)), quality: 0, delay: 1, relAll: 2, note: 'Costs a week. The crew appreciates it.' },
        { label: 'Cover it in the edit', cost: 0, quality: -3, note: 'Choppy, but it’s done.' },
      ],
    }),
  },
  {
    key: 'happy-accident',
    weight: () => 0.4,
    make: (c) => ({
      title: 'Happy accident',
      text: 'An improvised moment had the whole crew in stitches. The director wants to rework a scene around it.',
      choices: [
        { label: 'Rework the scene', cost: money(c.scale * c.rng.range(0.2, 0.4)), quality: 4, note: 'A bit of extra shooting.' },
        { label: 'Stick to the script', cost: 0, quality: 0, note: 'Stay on schedule.' },
      ],
    }),
  },
]

function pickWeighted(rng: Rng, items: { t: Template; w: number }[]): Template | undefined {
  const total = items.reduce((s, i) => s + i.w, 0)
  if (total <= 0) return undefined
  let r = rng.next() * total
  for (const i of items) {
    r -= i.w
    if (r <= 0) return i.t
  }
  return items[items.length - 1].t
}

export function rollProductionEvents(film: Film, game: Game): ProductionEvent[] {
  const rng = makeRng(hashSeed(film.seed, 'events'))
  const byId = (id?: string) => game.talent.find((t) => t.id === id)
  const lead = byId(film.leadIds[0])
  const director = byId(film.directorId)
  const crew = [lead, director, ...film.supportIds.map(byId)].filter(Boolean) as Talent[]
  const temper = crew.reduce((s, t) => s + t.temperament, 0) / Math.max(1, crew.length)
  const rush = Math.max(0, (film.genre === 'action' || film.genre === 'scifi' ? 10 : 6) - film.shootWeeks)
  const scale = Math.max(20_000, (film.techBudget + film.costs.talent) * 0.08)
  const inFilm = new Set([film.directorId, film.composerId, ...film.leadIds, ...film.supportIds])
  const leadFee = lead ? talentFee(lead) : 50_000
  const pickReplacement = (role: string, budget: number) =>
    game.talent
      .filter((t) => t.role === role && !t.retired && !inFilm.has(t.id) && willWork(t, game.reputation) && talentFee(t) <= budget)
      .sort((a, b) => b.skill + b.genreFit[film.genre] / 3 - (a.skill + a.genreFit[film.genre] / 3))[0]
  const ctx: Ctx = {
    rng, game, film, scale, lead, director,
    standIn: pickReplacement('actor', Math.max(80_000, leadFee * 0.8)),
    newDirector: pickReplacement('director', Math.max(80_000, director ? talentFee(director) * 0.8 : 80_000)),
  }
  const events: ProductionEvent[] = []
  const used = new Set<string>()
  for (let week = 1; week <= film.shootWeeks && events.length < 4; week++) {
    const p = 0.17 + temper / 400 + rush * 0.05
    if (!rng.chance(p)) continue
    const options = TEMPLATES.filter((t) => !used.has(t.key)).map((t) => ({ t, w: t.weight(ctx) }))
    const template = pickWeighted(rng, options)
    if (!template) continue
    used.add(template.key)
    events.push({ week, key: template.key, ...template.make(ctx) })
    if (template.key === 'lead-dies') break // nothing else matters that week
  }
  return events
}

// Apply what the chosen options did, once the shoot wraps.
export function applyEventOutcomes(game: Game, film: Film): { game: Game; film: Film; delay: number } {
  let delay = 0
  let hype = 0
  let rep = 0
  const leadId = film.leadIds[0]
  const relDelta = new Map<string, number>()
  const bump = (id: string | undefined, d: number) => id && relDelta.set(id, (relDelta.get(id) ?? 0) + d)
  let next = { ...film }
  const backerRel = { ...(game.backerRel ?? {}) }
  const killed = new Set<string>()
  for (const e of film.events) {
    if (e.kills) killed.add(e.kills)
    if (e.chosen === undefined) continue
    const c = e.choices[e.chosen]
    delay += c.delay ?? 0
    hype += c.hype ?? 0
    rep += c.rep ?? 0
    bump(leadId, c.relLead ?? 0)
    bump(film.directorId, c.relDirector ?? 0)
    if (c.relAll) for (const t of game.talent) if (t.role !== 'composer' && !t.retired) bump(t.id, c.relAll)
    if (c.backerRel && film.financing) backerRel[film.financing.backer] = clamp((backerRel[film.financing.backer] ?? 0) + c.backerRel, -30, 30)
    if (c.recastWith) next = { ...next, leadIds: [c.recastWith, ...next.leadIds.slice(1)] }
    if (c.replaceDirector) next = { ...next, directorId: c.replaceDirector }
  }
  const talent = game.talent.map((t) => {
    const d = relDelta.get(t.id) ?? 0
    const r = d ? { ...t, relationship: clamp(t.relationship + d, -100, 100) } : t
    return killed.has(t.id) ? { ...r, retired: true } : r
  })
  next = { ...next, hypeBonus: (film.hypeBonus ?? 0) + hype }
  return { game: { ...game, talent, reputation: clamp(game.reputation + rep, 0, 100), backerRel }, film: next, delay }
}
