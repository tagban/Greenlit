// Share cards: a poster-and-stats image the player can send through the phone's share sheet.

import { GENRES, MONTHS, subgenreById } from './game/data'
import { money } from './game/text'
import type { Film, Game } from './game/types'
import { getImage } from './images'

const W = 1080
const H = 1350

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export async function makeShareCard(game: Game, film: Film): Promise<Blob> {
  const r = film.result!
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0e0f13'
  ctx.fillRect(0, 0, W, H)

  // Poster on the left: the player's own art, or the genre art.
  const custom = film.posterId ? await getImage(film.posterId) : undefined
  const poster = await loadImage(custom ?? `${import.meta.env.BASE_URL}art/genres/${film.genre}.svg`)
  const px = 60, py = 60, pw = 560, ph = 840
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(px, py, pw, ph, 28)
  ctx.clip()
  ctx.drawImage(poster, px, py, pw, ph)
  ctx.restore()

  // Stats column.
  const sx = 670
  ctx.fillStyle = '#9aa1b0'
  ctx.font = '600 30px system-ui, sans-serif'
  ctx.fillText(`${MONTHS[r.releaseMonth]} ${r.releaseYear} · ${subgenreById(film.subgenre)?.name ?? GENRES[film.genre].name}`.toUpperCase(), sx, 110)
  const stats: [string, string, string?][] = [
    ['Box office', money(r.domestic)],
    ['Opening', money(r.opening)],
    ['Critics', `${r.criticScore}%`, r.criticScore >= 60 ? '#3ddc84' : undefined],
    ['Profit', money(r.profit), r.profit >= 0 ? '#3ddc84' : '#ff6b6b'],
  ]
  stats.forEach(([label, value, color], i) => {
    const y = 210 + i * 175
    ctx.fillStyle = '#9aa1b0'
    ctx.font = '600 28px system-ui, sans-serif'
    ctx.fillText(label.toUpperCase(), sx, y)
    ctx.fillStyle = color ?? '#eef0f4'
    ctx.font = '800 72px system-ui, sans-serif'
    ctx.fillText(value, sx, y + 80)
  })

  // Title and headline under the poster.
  ctx.fillStyle = '#eef0f4'
  ctx.font = '800 64px system-ui, sans-serif'
  let y = 1000
  for (const line of wrap(ctx, film.title.toUpperCase(), W - 120).slice(0, 2)) {
    ctx.fillText(line, 60, y)
    y += 72
  }
  ctx.fillStyle = '#d9dce3'
  ctx.font = 'italic 36px Georgia, serif'
  for (const line of wrap(ctx, `“${r.headline}”`, W - 120).slice(0, 2)) {
    ctx.fillText(line, 60, y + 10)
    y += 46
  }

  // Footer: studio and the game's credit line.
  ctx.fillStyle = '#20232c'
  ctx.fillRect(0, H - 110, W, 110)
  ctx.fillStyle = '#eef0f4'
  ctx.font = '700 34px system-ui, sans-serif'
  ctx.fillText(`${game.studio.name} #${game.studio.tag}`, 60, H - 45)
  ctx.fillStyle = '#3ddc84'
  ctx.textAlign = 'right'
  ctx.fillText('Made in Greenlit', W - 60, H - 45)

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
}

export async function shareFilm(game: Game, film: Film) {
  const blob = await makeShareCard(game, film)
  const name = `${film.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'film'}-greenlit.png`
  const file = new File([blob], name, { type: 'image/png' })
  const text = `${film.title} made ${money(film.result!.domestic)} at the box office. Made in Greenlit.`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // the player closed the share sheet
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
