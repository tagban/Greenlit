import { useEffect, useState } from 'react'
import { IMDB_FILES } from './imdbImport'
import { loadPack, packSummary, removePack, savePack, type TalentPack } from './pack'
import { runImport, type ImportFiles } from './runImport'

// Office section: build a talent pack of real actors from IMDb files on this device.
export default function TalentPackPanel({ onChange }: { onChange?: (pack: TalentPack | undefined) => void } = {}) {
  const [pack, setPack] = useState<TalentPack | undefined>()
  const [files, setFiles] = useState<Partial<ImportFiles>>({})
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadPack().then(setPack) }, [])

  const pick = (list: FileList | null) => {
    const next = { ...files }
    for (const file of Array.from(list ?? [])) {
      const match = IMDB_FILES.find((f) => file.name.startsWith(f.name.replace('.tsv.gz', '')))
      if (match) next[match.key] = file
    }
    setFiles(next)
  }
  const ready = IMDB_FILES.every((f) => files[f.key])

  const build = async () => {
    setBusy(true)
    setError('')
    try {
      const built = await runImport(files as ImportFiles, (step, detail) => setStatus(detail ? `${step}: ${detail}` : `${step}…`))
      await savePack(built)
      setPack(built)
      onChange?.(built)
      setFiles({})
      setStatus('')
    } catch (e) {
      setError(`The import stopped: ${(e as Error).message}`)
    }
    setBusy(false)
  }

  if (pack) {
    const s = packSummary(pack)
    return (
      <div>
        <p className="small">Talent pack ready: <strong>{s.actors.toLocaleString()}</strong> actors, <strong>{s.directors.toLocaleString()}</strong> directors and <strong>{s.composers.toLocaleString()}</strong> composers, built {s.built}.</p>
        <p className="muted small">Start a new studio and choose “Real actors” to use it. Each person’s fame and skill come from their real films up to the year you’re playing.</p>
        <button onClick={async () => { await removePack(); setPack(undefined); onChange?.(undefined) }}>Remove talent pack</button>
      </div>
    )
  }

  return (
    <div>
      <p className="muted small">
        Play with real actors, directors and composers. Download these four files from{' '}
        <a href="https://datasets.imdbws.com/" target="_blank" rel="noopener">IMDb’s dataset page</a> (about 1.3 GB in total), then choose them here.
        Everything is processed on this device and stays here. IMDb’s data is for personal, non-commercial use.
      </p>
      <ul className="file-checklist">
        {IMDB_FILES.map((f) => (
          <li key={f.key} className={files[f.key] ? 'good' : ''}>{files[f.key] ? '✓' : '○'} {f.name} <span className="muted">({f.about})</span></li>
        ))}
      </ul>
      <div className="row">
        <label className="upload as-button">
          Choose files
          <input type="file" multiple accept=".gz,.tsv,application/gzip,text/tab-separated-values" hidden disabled={busy} onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        </label>
        <button className="share" disabled={!ready || busy} onClick={build}>{busy ? 'Building…' : 'Build talent pack'}</button>
      </div>
      {busy && <p className="small">{status || 'Starting…'} <span className="muted">This can take a few minutes, longer on a phone.</span></p>}
      {error && <p className="small bad">{error}</p>}
    </div>
  )
}
