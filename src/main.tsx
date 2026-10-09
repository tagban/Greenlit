import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, loadTheme } from './theme'
import { loadPack } from './talent/pack'

applyTheme(loadTheme())
// Load the player's talent pack (if any) before the game needs it for yearly rosters.
await loadPack()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
