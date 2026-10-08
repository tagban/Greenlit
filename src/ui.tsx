import { useState, type ReactNode } from 'react'
import { newImageId, processImage, putImage, useImage } from './images'
import { shareFilm } from './share'
import type { Film, Game } from './game/types'
import { GENRES, type GenreId } from './game/data'
import { money } from './game/text'
import type { Talent } from './game/types'
import { talentFee } from './game/world'

export const art = (genre: GenreId) => `${import.meta.env.BASE_URL}art/genres/${genre}.svg`

export function Poster({ genre, title, sub, small, posterId }: { genre: GenreId; title?: string; sub?: string; small?: boolean; posterId?: string }) {
  const custom = useImage(posterId)
  return (
    <div className={`poster${small ? ' poster-small' : ''}${custom ? ' custom' : ''}`} style={{ backgroundImage: `url(${custom ?? art(genre)})` }}>
      <div className="poster-text">
        {title && <div className="poster-title">{title}</div>}
        {sub && <div className="poster-sub">{sub}</div>}
      </div>
    </div>
  )
}

export function Portrait({ t, size = 44 }: { t: Talent; size?: number }) {
  const initials = t.name.split(' ').map((p) => p[0]).join('')
  return (
    <div className="portrait" style={{ width: size, height: size, background: `hsl(${t.hue} 45% 32%)`, fontSize: size * 0.36 }}>
      {initials}
    </div>
  )
}

export function Meter({ value, label, tone }: { value: number; label?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="meter" aria-label={label}>
      <div className={`meter-fill ${tone ?? ''}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

export function TalentCard({ t, selected, disabled, onClick, note, half }: { t: Talent; selected?: boolean; disabled?: boolean; onClick?: () => void; note?: string; half?: boolean }) {
  const fee = talentFee(t) * (half ? 0.5 : 1)
  return (
    <button className={`talent${selected ? ' selected' : ''}`} disabled={disabled} onClick={onClick}>
      <Portrait t={t} />
      <div className="talent-body">
        <div className="talent-name">{t.name}</div>
        <div className="talent-stats">
          <span>Skill {t.skill}</span>
          <span>Star {t.star}</span>
          <span>Age {t.age}</span>
        </div>
        {note && <div className="talent-note">{note}</div>}
      </div>
      <div className="talent-fee">{money(fee)}</div>
    </button>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

export function Steps({ stage }: { stage: string }) {
  const steps = ['pitch', 'financing', 'script', 'cast', 'budget', 'production', 'post', 'release', 'results']
  const at = steps.indexOf(stage)
  return (
    <div className="steps" aria-label={`Step ${at + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <div key={s} className={`step-dot${i < at ? ' done' : i === at ? ' now' : ''}`} />
      ))}
    </div>
  )
}

export const genreName = (g: GenreId) => GENRES[g].name

export function trendLabel(v: number) {
  if (v >= 1.35) return { text: 'Booming', tone: 'good' as const }
  if (v >= 1.12) return { text: 'Hot', tone: 'good' as const }
  if (v <= 0.75) return { text: 'Dead', tone: 'bad' as const }
  if (v <= 0.9) return { text: 'Cooling', tone: 'bad' as const }
  return { text: 'Steady', tone: undefined }
}

// Pick a photo or file, crop it to the right shape and store it. Calls back with the image id.
export function ImageUpload({ label, width, height, type, onDone }: { label: string; width: number; height: number; type?: string; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <label className={`upload${busy ? ' busy' : ''}`}>
      {busy ? 'Saving…' : label}
      <input type="file" accept="image/*" hidden onChange={async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setBusy(true)
        setError('')
        try {
          const id = newImageId()
          await putImage(id, await processImage(file, width, height, type))
          onDone(id)
        } catch {
          setError('That image couldn’t be read.')
        }
        setBusy(false)
      }} />
      {error && <em className="bad">{error}</em>}
    </label>
  )
}

export function ShareButton({ game, film }: { game: Game; film: Film }) {
  const [busy, setBusy] = useState(false)
  return (
    <button className="share" disabled={busy} onClick={async () => {
      setBusy(true)
      try { await shareFilm(game, film) } finally { setBusy(false) }
    }}>
      {busy ? 'Making card…' : 'Share'}
    </button>
  )
}

export function StudioLogo({ id, size = 28 }: { id?: string; size?: number }) {
  const url = useImage(id)
  return <img className="studio-logo" src={url ?? `${import.meta.env.BASE_URL}art/logo.svg`} width={size} height={size} alt="" />
}

// Short career status shown on talent cards.
export function careerNote(t: Talent, year: number): string | undefined {
  if (t.debut === year && year > 2000) return 'New face this year'
  const change = t.star - (t.prevStar ?? t.star)
  if (change >= 4) return `Rising star ↑${change}`
  if (change <= -4) return `Fading ↓${-change}`
  return undefined
}
