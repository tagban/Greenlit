import { useEffect, useState } from 'react'
import { loadGame, saveGame } from './game/store'
import { money } from './game/text'
import type { Game } from './game/types'
import FilmFlow from './screens/FilmFlow'
import { StudioLogo } from './ui'
import { Handbook, Hub, NewStudio, Roster, Settings } from './screens/Studio'

type Tab = 'studio' | 'handbook' | 'talent' | 'office'

export default function App() {
  const [game, setGameState] = useState<Game | undefined>(() => loadGame())
  const [tab, setTab] = useState<Tab>('studio')

  // Autosave after every action.
  useEffect(() => { saveGame(game) }, [game])
  // Each new screen starts at the top.
  useEffect(() => { window.scrollTo(0, 0) }, [tab, game?.current?.stage])

  const setGame = (g: Game | undefined) => {
    setGameState(g)
    if (!g) setTab('studio')
  }

  if (!game) return <main className="app"><NewStudio onCreate={setGame} onImport={setGame} /></main>

  const inFilm = tab === 'studio' && game.current
  return (
    <main className="app">
      <header className="topbar">
        <span className="brand"><StudioLogo id={game.studio.logoId} size={24} /> Greenlit</span>
        <span className={game.cash < 0 ? 'bad' : ''}>{money(game.cash)}</span>
      </header>
      <div className="content" key={tab + (game.current?.stage ?? '')}>
        {tab === 'studio' && (inFilm ? <FilmFlow game={game} setGame={setGame} /> : <Hub game={game} setGame={setGame} />)}
        {tab === 'handbook' && <Handbook game={game} />}
        {tab === 'talent' && <Roster game={game} />}
        {tab === 'office' && <Settings game={game} setGame={setGame} />}
      </div>
      <nav className="bottomnav">
        {([['studio', game.current ? 'Film' : 'Studio', '🎬'], ['handbook', 'Handbook', '📖'], ['talent', 'Talent', '⭐'], ['office', 'Office', '🗂️']] as const).map(([id, label, icon]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </main>
  )
}
