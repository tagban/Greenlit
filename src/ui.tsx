import type { ReactNode } from 'react'
import { GENRES, type GenreId } from './game/data'
import { money } from './game/text'
import type { Talent } from './game/types'
import { talentFee } from './game/world'

export const art = (genre: GenreId) => `${import.meta.env.BASE_URL}art/genres/${genre}.svg`

export function Poster({ genre, title, sub, small }: { genre: GenreId; title?: string; sub?: string; small?: boolean }) {
  return (
    <div className={`poster${small ? ' poster-small' : ''}`} style={{ backgroundImage: `url(${art(genre)})` }}>
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
  const steps = ['pitch', 'script', 'cast', 'budget', 'production', 'post', 'release', 'results']
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
