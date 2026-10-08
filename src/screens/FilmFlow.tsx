import { useMemo, useState } from 'react'
import { DEPTS, DEPT_LABEL, GENRES, GENRE_IDS, SUBGENRES, subgenreById, type GenreId } from '../game/data'
import {
  CREW_WEEKLY, MUSIC_SCALE, PRINT_COST, SCREEN_OPTIONS, TECH_SCALE, computeHype, deptScores, filmWeights, marketingTotal, monthLabel, normalShoot, productionCost,
  releaseCalendar, reshootCost, scriptOffers, talentCost, trendFor,
} from '../game/sim'
import {
  LOAN_LIMIT, LOAN_STEP, chooseScript, closeFilm, confirmCast, finishPost, isClean, releaseFilm, resolveEvent,
  startProduction, takeLoan, wrapProduction,
} from '../game/store'
import { money } from '../game/text'
import type { Film, Game, Talent } from '../game/types'
import { willWork } from '../game/world'
import { Meter, Poster, Stat, Steps, TalentCard, trendLabel } from '../ui'

type Props = { game: Game; setGame: (g: Game) => void }

export default function FilmFlow({ game, setGame }: Props) {
  const film = game.current!
  const update = (patch: Partial<Film>) => setGame({ ...game, current: { ...film, ...patch } })
  const step = {
    pitch: <Pitch film={film} game={game} update={update} />,
    script: <Script film={film} game={game} setGame={setGame} />,
    cast: <Cast film={film} game={game} setGame={setGame} update={update} />,
    budget: <Budget film={film} game={game} setGame={setGame} update={update} />,
    production: <Production film={film} game={game} setGame={setGame} />,
    post: <Post film={film} game={game} setGame={setGame} />,
    release: <Release film={film} game={game} setGame={setGame} update={update} />,
    results: <Results film={film} game={game} setGame={setGame} />,
    done: null,
  }[film.stage]
  return (
    <div className="flow">
      <Steps stage={film.stage} />
      {step}
    </div>
  )
}

function CashBar({ game, need }: { game: Game; need: number }) {
  const short = need > game.cash
  return (
    <div className={`cashbar${short ? ' short' : ''}`}>
      <span>Cost {money(need)}</span>
      <span>Cash {money(game.cash)}</span>
    </div>
  )
}

function LoanHint({ game, setGame, need }: { game: Game; setGame: (g: Game) => void; need: number }) {
  if (need <= game.cash) return null
  const canBorrow = game.debt + LOAN_STEP <= LOAN_LIMIT
  return (
    <div className="callout bad">
      You’re {money(need - game.cash)} short.{' '}
      {canBorrow ? (
        <button className="link" onClick={() => setGame(takeLoan(game))}>Borrow {money(LOAN_STEP)} from the bank (8% a year)</button>
      ) : (
        'The bank won’t lend you any more. Spend less.'
      )}
    </div>
  )
}

// ---------- 1. Pitch ----------

function Pitch({ film, game, update }: { film: Film; game: Game; update: (p: Partial<Film>) => void }) {
  const subs = SUBGENRES.filter((s) => s.genre === film.genre)
  const titleOk = film.title.trim().length > 0 && isClean(film.title)
  const loglineOk = isClean(film.logline)
  const ready = titleOk && loglineOk && (film.subgenre !== 'parody' || film.parodyTarget)
  const g = GENRES[film.genre]
  return (
    <section>
      <h1>Greenlight a film</h1>
      <label className="field">
        <span>Title</span>
        <input value={film.title} maxLength={40} placeholder="Night of the Long Lunch" onChange={(e) => update({ title: e.target.value })} />
        {film.title && !isClean(film.title) && <em className="bad">Let’s keep the marquee family-friendly.</em>}
      </label>
      <div className="field">
        <span>Genre</span>
        <div className="genre-grid">
          {GENRE_IDS.map((id) => (
            <button key={id} className={`genre-pick${film.genre === id ? ' selected' : ''}`} onClick={() => update({ genre: id as GenreId, subgenre: undefined, parodyTarget: undefined, shootWeeks: normalShoot({ genre: id }) })}>
              <Poster genre={id} sub={GENRES[id].name} small />
            </button>
          ))}
        </div>
        <p className="tip">{g.works}</p>
      </div>
      <label className="field">
        <span>Sub-genre</span>
        <select value={film.subgenre ?? ''} onChange={(e) => update({ subgenre: e.target.value || undefined, parodyTarget: undefined })}>
          <option value="">General {g.name.toLowerCase()}</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.id === 'parody' ? '' : ` (${trendLabel(game.trends[s.id]).text})`}</option>
          ))}
        </select>
        {film.subgenre && <em>{subgenreById(film.subgenre)?.note}</em>}
      </label>
      {film.subgenre === 'parody' && (
        <label className="field">
          <span>What are you spoofing?</span>
          <select value={film.parodyTarget ?? ''} onChange={(e) => update({ parodyTarget: e.target.value || undefined })}>
            <option value="">Pick a target…</option>
            {[...SUBGENRES].filter((s) => s.id !== 'parody').sort((a, b) => game.trends[b.id] - game.trends[a.id]).map((s) => (
              <option key={s.id} value={s.id}>{s.name}: {trendLabel(game.trends[s.id]).text}</option>
            ))}
          </select>
          <em>Parody rides its target’s popularity. Spoof what’s hot.</em>
        </label>
      )}
      <label className="field">
        <span>Logline</span>
        <textarea rows={3} maxLength={200} value={film.logline} placeholder="A retired detective must solve one last case…" onChange={(e) => update({ logline: e.target.value })} />
        <em>Buzzword this year: “{game.hotKeyword}”. Audiences are hearing it everywhere.</em>
      </label>
      <button className="primary" disabled={!ready} onClick={() => update({ title: film.title.trim(), stage: 'script' })}>Find a script</button>
    </section>
  )
}

// ---------- 2. Script ----------

function Script({ film, game, setGame }: Props & { film: Film }) {
  const offers = useMemo(() => scriptOffers(game, film), [game, film])
  const sourceText = { self: 'Write it yourself over a weekend', spec: 'Spec script from an agent’s pile', commission: 'Commission an established writer' }
  return (
    <section>
      <h1>Script for “{film.title}”</h1>
      <p className="tip">The script sets the ceiling for the film. Reader coverage is a rough guide, not a guarantee.</p>
      <div className="list">
        {offers.map((o) => (
          <button key={o.id} className="offer" disabled={o.cost > game.cash} onClick={() => setGame(chooseScript(game, film, o.id, offers))}>
            <div className="offer-grade">{o.coverage}</div>
            <div className="offer-body">
              <div className="offer-title">{sourceText[o.source]}</div>
              <div className="muted">by {o.writer}</div>
            </div>
            <div className="offer-cost">{o.cost ? money(o.cost) : 'Free'}</div>
          </button>
        ))}
      </div>
      <LoanHint game={game} setGame={setGame} need={Math.min(...offers.filter((o) => o.cost > 0).map((o) => o.cost))} />
    </section>
  )
}

// ---------- 3. Cast ----------

type Slot = 'directorId' | 'leadIds' | 'supportIds' | 'composerId'

function Cast({ film, game, setGame, update }: Props & { film: Film; update: (p: Partial<Film>) => void }) {
  const [tab, setTab] = useState<Slot>('directorId')
  const cost = talentCost(film, game.talent)
  const role = tab === 'directorId' ? 'director' : tab === 'composerId' ? 'composer' : 'actor'
  const max = { directorId: 1, leadIds: 2, supportIds: 3, composerId: 1 }[tab]
  const chosen = (slot: Slot) => ([] as (string | undefined)[]).concat(film[slot]).filter(Boolean) as string[]
  const otherActors = new Set(tab === 'leadIds' ? film.supportIds : tab === 'supportIds' ? film.leadIds : [])
  const available = (t: Talent) => willWork(t, game.reputation) && t.relationship > -30
  const score = (t: Talent) => t.skill * (0.6 + t.genreFit[film.genre] / 250) + (available(t) ? 1000 : 0)
  const pool = game.talent.filter((t) => t.role === role).sort((a, b) => score(b) - score(a))

  const toggle = (t: Talent) => {
    const current = chosen(tab)
    let next = current.includes(t.id) ? current.filter((id) => id !== t.id) : [...current, t.id]
    if (next.length > max) next = next.slice(next.length - max)
    if (tab === 'directorId' || tab === 'composerId') update({ [tab]: next[0] })
    else update({ [tab]: next })
  }
  const fitNote = (t: Talent) => {
    const fit = t.genreFit[film.genre]
    if (!willWork(t, game.reputation)) return 'Won’t take your calls yet. Build your reputation.'
    if (t.relationship <= -30) return 'Still angry about last time.'
    if (fit >= 70) return `Great fit for ${GENRES[film.genre].name.toLowerCase()}`
    if (fit < 40) return `Rarely does ${GENRES[film.genre].name.toLowerCase()}`
    return t.temperament > 70 ? 'Known to be difficult on set' : undefined
  }
  const ready = film.directorId && film.leadIds.length > 0 && cost <= game.cash
  const tabs: [Slot, string][] = [['directorId', 'Director'], ['leadIds', 'Leads'], ['supportIds', 'Support'], ['composerId', 'Composer']]
  return (
    <section>
      <h1>Casting</h1>
      <p className="tip">{GENRES[film.genre].name}: acting is {filmWeights(film).acting}% and direction {filmWeights(film).direction}% of the film’s quality. Star power drives opening weekend.</p>
      <div className="tabs">
        {tabs.map(([slot, label]) => (
          <button key={slot} className={tab === slot ? 'active' : ''} onClick={() => setTab(slot)}>
            {label} <span className="count">{chosen(slot).length}</span>
          </button>
        ))}
      </div>
      <div className="list">
        {pool.map((t) => (
          <TalentCard
            key={t.id}
            t={t}
            half={tab === 'supportIds'}
            selected={chosen(tab).includes(t.id)}
            disabled={!willWork(t, game.reputation) || t.relationship <= -30 || otherActors.has(t.id)}
            note={fitNote(t)}
            onClick={() => toggle(t)}
          />
        ))}
      </div>
      <div className="sticky-footer">
        <CashBar game={game} need={cost} />
        <LoanHint game={game} setGame={setGame} need={cost} />
        <button className="primary" disabled={!ready} onClick={() => setGame(confirmCast(game, film))}>
          {film.directorId && film.leadIds.length ? 'Sign the contracts' : 'Pick a director and a lead'}
        </button>
      </div>
    </section>
  )
}

// ---------- 4. Budget ----------

// Sliders top out where extra money stops helping, or at what you can afford.
const sliderMax = (useful: number, cash: number) => Math.max(50_000, Math.round(Math.min(useful, Math.max(cash, 50_000)) / 5_000) * 5_000)

function Budget({ film, game, setGame, update }: Props & { film: Film; update: (p: Partial<Film>) => void }) {
  const cost = productionCost(film)
  const scores = deptScores(film, game.talent)
  const weights = filmWeights(film)
  const norm = normalShoot(film)
  return (
    <section>
      <h1>Pre-production</h1>
      <p className="tip">Bars show how strong each department looks. The percentage is how much it matters for this film.</p>
      <div className="depts">
        {DEPTS.map((d) => (
          <div key={d} className="dept">
            <div className="dept-head"><span>{DEPT_LABEL[d]}</span><span className="muted">{weights[d]}%</span></div>
            <Meter value={scores[d]} tone={scores[d] >= 60 ? 'good' : scores[d] < 35 ? 'bad' : undefined} />
          </div>
        ))}
      </div>
      <label className="field">
        <span>Effects, sets and costumes: {money(film.techBudget)}</span>
        <input type="range" min={0} max={sliderMax(TECH_SCALE[film.genre] * 3, game.cash)} step={5_000} value={film.techBudget} onChange={(e) => update({ techBudget: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span>Music and sound: {money(film.musicBudget)}</span>
        <input type="range" min={0} max={sliderMax(MUSIC_SCALE * 3, game.cash)} step={5_000} value={film.musicBudget} onChange={(e) => update({ musicBudget: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span>Shooting schedule: {film.shootWeeks} weeks {film.shootWeeks < norm ? '(rushed)' : film.shootWeeks > norm ? '(generous)' : '(normal)'}</span>
        <input type="range" min={3} max={16} step={1} value={film.shootWeeks} onChange={(e) => update({ shootWeeks: Number(e.target.value) })} />
        <em>Crew costs {money(CREW_WEEKLY)} a week. Rushing hurts direction and effects and raises the odds of trouble.</em>
      </label>
      <div className="sticky-footer">
        <CashBar game={game} need={cost} />
        <LoanHint game={game} setGame={setGame} need={cost} />
        <button className="primary" disabled={cost > game.cash} onClick={() => setGame(startProduction(game, film))}>Start shooting</button>
      </div>
    </section>
  )
}

// ---------- 5. Production ----------

function Production({ film, game, setGame }: Props & { film: Film }) {
  const open = film.events.findIndex((e) => e.chosen === undefined)
  return (
    <section>
      <h1>On set: “{film.title}”</h1>
      {film.events.length === 0 && <div className="callout good">A smooth shoot. Everyone went home on time.</div>}
      <div className="list">
        {film.events.slice(0, open === -1 ? undefined : open + 1).map((e, i) => (
          <div key={i} className={`event${i === open ? ' active' : ''}`}>
            <div className="muted">Week {e.week}</div>
            <h3>{e.title}</h3>
            <p>{e.text}</p>
            {e.chosen === undefined ? (
              i === open && (
                <div className="choices">
                  {e.choices.map((c, ci) => (
                    <button key={ci} onClick={() => setGame(resolveEvent(game, film, i, ci))}>
                      <strong>{c.label}</strong>
                      <span>{c.cost ? money(c.cost) : 'Free'} · {c.note}</span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="muted">You chose: {e.choices[e.chosen].label}</div>
            )}
          </div>
        ))}
      </div>
      {open === -1 && (
        <div className="sticky-footer">
          <div className="cashbar"><span>Cash {money(game.cash)}</span></div>
          <button className="primary" onClick={() => setGame(wrapProduction(game, film))}>That’s a wrap</button>
        </div>
      )}
    </section>
  )
}

// ---------- 6. Post ----------

function Post({ film, game, setGame }: Props & { film: Film }) {
  const cost = reshootCost(film)
  return (
    <section>
      <h1>Post-production</h1>
      <div className="callout">
        Test screening audiences gave “{film.title}” a <strong className="grade">{film.testScore}</strong>.
      </div>
      <p className="tip">Reshoots can rescue a shaky cut. They cost about 15% of the production budget.</p>
      <div className="choices">
        <button disabled={cost > game.cash} title={cost > game.cash ? 'Not enough cash' : undefined} onClick={() => setGame(finishPost(game, film, true))}>
          <strong>Order reshoots</strong>
          <span>{money(cost)} · Fix the weakest scenes</span>
        </button>
        <button onClick={() => setGame(finishPost(game, film, false))}>
          <strong>Lock the cut</strong>
          <span>Free · Ship it as is</span>
        </button>
      </div>
    </section>
  )
}

// ---------- 7. Release ----------

function Release({ film, game, setGame, update }: Props & { film: Film; update: (p: Partial<Film>) => void }) {
  const slots = releaseCalendar(game, film, game.week)
  const slot = slots.find((s) => s.offset === film.release.monthOffset) ?? slots[0]
  const hype = computeHype(game, film)
  const prints = film.release.screens * PRINT_COST
  const cost = marketingTotal(film) + prints
  const setM = (k: keyof Film['marketing'], v: number) => update({ marketing: { ...film.marketing, [k]: v } })
  const trend = trendFor(game, film)
  const bookable = Math.round(Math.min(film.release.screens, 300 + hype * 1500))
  return (
    <section>
      <h1>Marketing and release</h1>
      <h3>Release month</h3>
      <div className="months">
        {slots.map((s) => (
          <button key={s.offset} className={s.offset === slot.offset ? 'selected' : ''} onClick={() => update({ release: { ...film.release, monthOffset: s.offset } })}>
            <strong>{monthLabel(s)}</strong>
            <span className={s.competition > 0.6 ? 'bad' : s.competition < 0.3 ? 'good' : ''}>{s.competition > 0.6 ? 'Crowded' : s.competition < 0.3 ? 'Quiet' : 'Busy'}</span>
            {s.season > 1.1 && <span className="good">Peak season</span>}
            {s.season < 1 && <span className="bad">Off season</span>}
          </button>
        ))}
      </div>
      <p className="muted small">Opening that month: {slot.rivals.join(', ')}</p>
      <h3>Screens</h3>
      <div className="months">
        {SCREEN_OPTIONS.map((o) => (
          <button key={o.screens} className={film.release.screens === o.screens ? 'selected' : ''} onClick={() => update({ release: { ...film.release, screens: o.screens } })}>
            <strong>{o.label}</strong>
            <span>{o.screens.toLocaleString()} screens</span>
            <span className="muted">{money(o.screens * PRINT_COST)} prints</span>
          </button>
        ))}
      </div>
      <h3>Marketing</h3>
      {([['tv', 'TV spots', 25_000_000], ['print', 'Print and billboards', 8_000_000], ['web', 'Web and social', 8_000_000], ['trailer', 'Trailer', 3_000_000]] as const).map(([k, label, max]) => (
        <label key={k} className="field">
          <span>{label}: {money(film.marketing[k])}</span>
          <input type="range" min={0} max={max} step={10_000} value={film.marketing[k]} onChange={(e) => setM(k, Number(e.target.value))} />
        </label>
      ))}
      <p className="tip">{GENRES[film.genre].audience}: {GENRES[film.genre].youngShare >= 0.5 ? 'web and social reach them best.' : 'TV and print reach them best.'} Trend: {trendLabel(trend).text.toLowerCase()}.</p>
      <div className="dept">
        <div className="dept-head"><span>Hype</span><span className="muted">{hype.toFixed(2)}</span></div>
        <Meter value={(hype / 4) * 100} tone={hype >= 1.5 ? 'good' : hype < 0.7 ? 'bad' : undefined} />
        {bookable < film.release.screens && <em className="bad">At this hype theaters will only book about {bookable.toLocaleString()} screens.</em>}
      </div>
      <div className="sticky-footer">
        <CashBar game={game} need={cost} />
        <LoanHint game={game} setGame={setGame} need={cost} />
        <button className="primary" disabled={cost > game.cash} onClick={() => setGame(releaseFilm(game, film, slot))}>Release in {monthLabel(slot)}</button>
      </div>
    </section>
  )
}

// ---------- 8. Results ----------

function Results({ film, game, setGame }: Props & { film: Film }) {
  const r = film.result!
  const maxWeek = Math.max(...r.weekly)
  const sub = subgenreById(film.subgenre)
  return (
    <section>
      <Poster genre={film.genre} title={film.title} sub={`${game.studio.name} · ${sub?.name ?? GENRES[film.genre].name}`} />
      <h2 className="headline">{r.headline}</h2>
      <div className="stats">
        <Stat label="Opening" value={money(r.opening)} />
        <Stat label="Domestic total" value={money(r.domestic)} />
        <Stat label="Critics" value={`${r.criticScore}%`} tone={r.criticScore >= 60 ? 'good' : r.criticScore < 40 ? 'bad' : undefined} />
        <Stat label="Profit" value={money(r.profit)} tone={r.profit >= 0 ? 'good' : 'bad'} />
      </div>
      <h3>Weekly box office</h3>
      <div className="bars" role="img" aria-label={`Box office over ${r.weekly.length} weeks`}>
        {r.weekly.map((w, i) => (
          <div key={i} className="bar" style={{ height: `${(w / maxWeek) * 100}%` }} title={`Week ${i + 1}: ${money(w)}`} />
        ))}
      </div>
      <p className="muted small">{r.weekly.length} weeks in theaters</p>
      <h3>What the critics said</h3>
      <div className="list">
        {r.reviews.map((rv) => (
          <div key={rv.critic} className="review">
            <div className="review-stars">{'★'.repeat(Math.floor(rv.stars))}{rv.stars % 1 ? '½' : ''}<span className="muted">{'☆'.repeat(4 - Math.ceil(rv.stars))}</span></div>
            <p>“{rv.quote}”</p>
            <div className="muted small">{rv.critic}, {rv.outlet}</div>
          </div>
        ))}
      </div>
      <h3>Why it played this way</h3>
      <ul className="breakdown">
        {r.breakdown.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
      <h3>The money</h3>
      <div className="ledger">
        <div><span>Studio share of domestic</span><span>{money(r.studioRevenue)}</span></div>
        <div><span>International, video and TV</span><span>{money(r.ancillary)}</span></div>
        <div><span>Total cost</span><span>-{money(r.totalCost)}</span></div>
        <div className="total"><span>Profit</span><span className={r.profit >= 0 ? 'good' : 'bad'}>{money(r.profit)}</span></div>
      </div>
      <button className="primary" onClick={() => setGame(closeFilm(game))}>Back to the studio</button>
    </section>
  )
}
