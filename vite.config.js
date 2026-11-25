import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function appVersionPlugin() {
  return {
    name: 'app-version',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? 'dist'
      const jsFile = Object.keys(bundle).find((name) => /^assets\/index-.*\.js$/.test(name))
      const buildId = jsFile?.match(/index-([A-Za-z0-9_-]+)\.js/)?.[1] ?? String(Date.now())
      const payload = {
        buildId,
        builtAt: new Date().toISOString(),
      }
      fs.writeFileSync(path.join(outDir, 'version.json'), `${JSON.stringify(payload)}\n`)
    },
  }
}

export default defineConfig({
  plugins: [react(), appVersionPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
