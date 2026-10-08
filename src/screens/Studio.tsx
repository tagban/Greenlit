import { useState } from 'react'
import { CAMPAIGN_YEARS, DEPTS, DEPT_LABEL, GENRES, GENRE_IDS, MONTHS, SUBGENRES, START_YEAR, subgenreById, type GenreId } from '../game/data'
import { filmWeights, newFilm } from '../game/sim'
import { LOAN_LIMIT, LOAN_STEP, canStartFilm, setPoster, exportSave, importSave, isClean, lifetimeGross, repayLoan, takeLoan } from '../game/store'
import { money } from '../game/text'
import type { Game, Role } from '../game/types'
import { campaignOver, monthOf, newGame, yearOf } from '../game/world'
import { ImageUpload, Meter, Poster, ShareButton, Stat, StudioLogo, TalentCard, trendLabel } from '../ui'
import { applyTheme, loadTheme, type Theme } from '../theme'

type Props = { game: Game; setGame: (g: Game | undefined) => void }

// ---------- New studio ----------

export function NewStudio({ onCreate, onImport }: { onCreate: (g: Game) => void; onImport: (g: Game) => void }) {
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [error, setError] = useState('')
  const clean = isClean(name) && isClean(owner)
  const ready = name.trim() && owner.trim() && clean
  return (
    <div className="welcome">
      <img className="logo" src={`${import.meta.env.BASE_URL}art/logo.svg`} alt="" />
      <h1 className="wordmark">Greenlit</h1>
      <p className="muted">Run a movie studio from a garage to the top of the box office. You have {CAMPAIGN_YEARS} years, $100K in savings and a head full of pitches.</p>
      <label className="field">
        <span>Studio name</span>
        <input value={name} maxLength={32} placeholder="Unicorn Studios" onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Your name (studio owner)</span>
        <input value={owner} maxLength={24} placeholder="Jamie R." onChange={(e) => setOwner(e.target.value)} />
      </label>
      {!clean && <em className="bad">Pick names you’d be happy to see on a leaderboard.</em>}
      <button className="primary" disabled={!ready} onClick={() => onCreate(newGame(name.trim(), owner.trim()))}>Open the studio</button>
      <label className="link import">
        Restore a save file
        <input type="file" accept="application/json" hidden onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try { onImport(await importSave(file)) } catch { setError('That file isn’t a Greenlit save.') }
        }} />
      </label>
      {error && <em className="bad">{error}</em>}
    </div>
  )
}

// ---------- Studio hub ----------

export function Hub({ game, setGame }: Props) {
  const over = campaignOver(game.week)
  const hot = SUBGENRES.filter((s) => s.id !== 'parody').sort((a, b) => game.trends[b.id] - game.trends[a.id])
  const films = [...game.films].reverse()
  return (
    <section>
      <div className="hub-head">
        <StudioLogo id={game.studio.logoId} size={56} />
        <div>
          <h1>{game.studio.name} <span className="tag">#{game.studio.tag}</span></h1>
          <div className="muted">{game.studio.owner} · {MONTHS[monthOf(game.week)]} {yearOf(game.week)} · Year {Math.min(CAMPAIGN_YEARS, Math.floor(game.week / 52) + 1)} of {CAMPAIGN_YEARS}</div>
        </div>
      </div>
      <div className="stats">
        <Stat label="Cash" value={money(game.cash)} tone={game.cash < 0 ? 'bad' : undefined} />
        <Stat label="Reputation" value={game.reputation} />
        <Stat label="Films" value={game.films.length} />
        <Stat label="Lifetime gross" value={money(lifetimeGross(game))} />
      </div>
      {over ? (
        <div className="callout good">
          <strong>Campaign complete.</strong> {CAMPAIGN_YEARS} years, {game.films.length} films, {money(lifetimeGross(game))} at the box office. This studio is headed for the Hall of Fame.
        </div>
      ) : (
        <button className="primary big" disabled={!canStartFilm(game)} onClick={() => setGame({ ...game, current: newFilm(game) })}>
          Pitch a new film
        </button>
      )}
      <h3>What audiences want in {yearOf(game.week)}</h3>
      <div className="trends">
        {hot.slice(0, 4).map((s) => <TrendChip key={s.id} name={s.name} value={game.trends[s.id]} />)}
        {hot.slice(-3).map((s) => <TrendChip key={s.id} name={s.name} value={game.trends[s.id]} />)}
      </div>
      <p className="muted small">Buzzword of the year: “{game.hotKeyword}”. Put it in a logline for extra hype.</p>
      <h3>Filmography</h3>
      {films.length === 0 && <p className="muted">No films yet. Horror and comedy are cheap places to start.</p>}
      <div className="filmography">
        {films.map((f) => (
          <div key={f.id} className="film-card">
            <Poster genre={f.genre} posterId={f.posterId} small />
            <div>
              <div className="film-title">{f.title}</div>
              <div className="muted small">{MONTHS[f.result!.releaseMonth]} {f.result!.releaseYear} · {subgenreById(f.subgenre)?.name ?? GENRES[f.genre].name}</div>
              <div className="small">{money(f.result!.domestic)} gross · {f.result!.criticScore}% critics</div>
              <div className={`small ${f.result!.profit >= 0 ? 'good' : 'bad'}`}>{money(f.result!.profit)} profit</div>
              <div className="row card-actions">
                <ImageUpload label={f.posterId ? 'Change poster' : 'Add poster'} width={600} height={900} onDone={(id) => setGame(setPoster(game, f.id, id))} />
                <ShareButton game={game} film={f} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TrendChip({ name, value }: { name: string; value: number }) {
  const t = trendLabel(value)
  return <span className={`chip ${t.tone ?? ''}`}>{name ? `${name} · ${t.text}` : t.text}</span>
}

// ---------- Genre Handbook ----------

export function Handbook({ game }: { game: Game }) {
  const [open, setOpen] = useState<GenreId | null>(null)
  if (!open) {
    return (
      <section>
        <h1>Genre Handbook</h1>
        <p className="muted">What makes a drama dramatic? Every genre leans on different departments.</p>
        <div className="genre-grid">
          {GENRE_IDS.map((id) => (
            <button key={id} className="genre-pick" onClick={() => setOpen(id)}>
              <Poster genre={id} sub={GENRES[id].name} small />
            </button>
          ))}
        </div>
      </section>
    )
  }
  const g = GENRES[open]
  const w = filmWeights({ genre: open })
  return (
    <section>
      <button className="link" onClick={() => setOpen(null)}>← All genres</button>
      <Poster genre={open} title={g.name} sub={g.audience} />
      <h3>What makes it work</h3>
      <p>{g.works}</p>
      <div className="depts">
        {DEPTS.map((d) => (
          <div key={d} className="dept">
            <div className="dept-head"><span>{DEPT_LABEL[d]}</span><span className="muted">{w[d]}%</span></div>
            <Meter value={w[d] * 2.5} />
          </div>
        ))}
      </div>
      <h3>Pitfalls</h3>
      <p>{g.pitfalls}</p>
      <h3>Classic tropes</h3>
      <p>{g.tropes}</p>
      <h3>Best months</h3>
      <p>{g.peakMonths.map((m) => MONTHS[m]).join(', ')}</p>
      <h3>Sub-genres</h3>
      <div className="list">
        {SUBGENRES.filter((s) => s.genre === open).map((s) => (
          <div key={s.id} className="sub-row">
            <div><strong>{s.name}</strong><div className="muted small">{s.note}</div></div>
            {s.id !== 'parody' && <TrendChip name="" value={game.trends[s.id]} />}
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- Talent roster ----------

export function Roster({ game }: { game: Game }) {
  const [role, setRole] = useState<Role>('actor')
  const list = game.talent.filter((t) => t.role === role).sort((a, b) => b.star - a.star)
  return (
    <section>
      <h1>Talent</h1>
      <div className="tabs">
        {(['actor', 'director', 'composer'] as Role[]).map((r) => (
          <button key={r} className={role === r ? 'active' : ''} onClick={() => setRole(r)}>{r[0].toUpperCase() + r.slice(1)}s</button>
        ))}
      </div>
      <div className="list">
        {list.map((t) => {
          const best = GENRE_IDS.reduce((a, b) => (t.genreFit[a] >= t.genreFit[b] ? a : b))
          const rel = t.relationship > 15 ? 'Likes working with you' : t.relationship < -15 ? 'Unhappy with your studio' : undefined
          return <TalentCard key={t.id} t={t} note={[`Best at ${GENRES[best].name.toLowerCase()}`, rel].filter(Boolean).join(' · ')} />
        })}
      </div>
    </section>
  )
}

// ---------- Settings ----------

export function Settings({ game, setGame }: Props) {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [confirm, setConfirm] = useState(false)
  const [show, setShow] = useState(false)
  return (
    <section>
      <h1>Studio office</h1>
      <h3>Look</h3>
      <div className="row logo-row">
        <StudioLogo id={game.studio.logoId} size={64} />
        <ImageUpload label={game.studio.logoId ? 'Change studio logo' : 'Upload a studio logo'} width={256} height={256} type="image/png" onDone={(id) => setGame({ ...game, studio: { ...game.studio, logoId: id } })} />
      </div>
      <div className="tabs theme-toggle">
        {(['dark', 'light'] as Theme[]).map((t) => (
          <button key={t} className={theme === t ? 'active' : ''} onClick={() => { applyTheme(t); setTheme(t) }}>{t === 'dark' ? 'Dark mode' : 'Light mode'}</button>
        ))}
      </div>
      <h3>Bank</h3>
      <div className="ledger">
        <div><span>Loans outstanding</span><span>{money(game.debt)}</span></div>
        <div><span>Interest</span><span>8% a year, paid weekly</span></div>
      </div>
      <div className="row">
        <button disabled={game.debt + LOAN_STEP > LOAN_LIMIT} onClick={() => setGame(takeLoan(game))}>Borrow {money(LOAN_STEP)}</button>
        <button disabled={game.debt === 0 || game.cash <= 0} onClick={() => setGame(repayLoan(game))}>Repay</button>
      </div>
      <h3>Leaderboard identity</h3>
      <p className="muted small">Your studio is listed as <strong>{game.studio.name} #{game.studio.tag}</strong>. The recovery code restores your leaderboard spot on another device. Keep it private.</p>
      <button onClick={() => setShow(!show)}>{show ? game.studio.recovery : 'Show recovery code'}</button>
      <h3>Save file</h3>
      <p className="muted small">The game saves automatically on this device. Export a copy to move to another device or keep a backup.</p>
      <button onClick={() => exportSave(game)}>Export save</button>
      <h3>Start over</h3>
      {confirm ? (
        <div className="row">
          <button className="danger" onClick={() => setGame(undefined)}>Yes, close {game.studio.name}</button>
          <button onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)}>New studio…</button>
      )}
      <p className="muted small footer-note">Greenlit · campaign started {START_YEAR} · {CAMPAIGN_YEARS} years</p>
    </section>
  )
}
