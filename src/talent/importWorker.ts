// Runs the IMDb import off the main thread so the game stays responsive.
import { buildTalentPack } from './imdbImport'

type Files = { titleBasics: File; titleRatings: File; titlePrincipals: File; nameBasics: File }

self.onmessage = async (e: MessageEvent<Files>) => {
  const f = e.data
  try {
    const pack = await buildTalentPack(
      f,
      (step, detail) => self.postMessage({ type: 'progress', step, detail }),
    )
    self.postMessage({ type: 'done', pack })
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message })
  }
}
