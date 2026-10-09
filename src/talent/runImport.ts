import type { TalentPack } from './pack'

export type ImportFiles = { titleBasics: File; titleRatings: File; titlePrincipals: File; nameBasics: File }

// Builds a talent pack in a background worker, reporting progress as it reads each file.
export function runImport(files: ImportFiles, onProgress: (step: string, detail: string) => void): Promise<TalentPack> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') onProgress(msg.step, msg.detail)
      if (msg.type === 'done') resolve(msg.pack)
      if (msg.type === 'error') reject(new Error(msg.message))
      if (msg.type !== 'progress') worker.terminate()
    }
    worker.onerror = (e) => {
      reject(new Error(e.message))
      worker.terminate()
    }
    worker.postMessage(files)
  })
}

// Installed apps (desktop and mobile wrappers) can fetch IMDb's files directly; a web page
// can't, because IMDb's server doesn't allow cross-site downloads. Wrappers set this flag.
export const canDownloadDirectly = () => Boolean((globalThis as { __GREENLIT_NATIVE__?: boolean }).__GREENLIT_NATIVE__)
