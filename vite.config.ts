import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the same build works on GitHub Pages (served from /Greenlit/)
  // and inside the iOS/Android app wrappers.
  base: './',
  // Shown in the Office and attached to bug reports.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
})
