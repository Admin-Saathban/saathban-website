import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* THE BUILD STAMPS ITSELF.

   The recurring argument this ends: a lane reports something fixed,
   the owner's phone still shows it broken, and neither side can tell
   whether they are looking at the same code. Every report now carries
   a hash and the phone shows one, so the comparison is done by eye in
   two seconds instead of by argument.

   On Vercel the commit is handed to us; locally we ask git. Neither
   is allowed to fail the build — a stamp that breaks deploys is worse
   than no stamp, so an unknown hash is a value, not an error. It says
   "unknown" rather than showing nothing, because a stamp that is
   silently absent is exactly the class of defect this exists to end. */
function commitHash() {
  const fromCI = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
  if (fromCI) return fromCI.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

/* STAMPS THE SERVICE WORKER WITH THE SAME HASH.

   public/ is copied verbatim, so the worker shipped byte-identical
   on every deploy — and a browser installs a new worker only when
   the script bytes change. That is why it had never updated once
   since the day it shipped. Rewriting the placeholder after the
   copy makes the file differ per commit, which is the whole
   mechanism.

   It MUST be the same hash the app reports, because the page asks
   the worker its version and compares. Two sources would drift and
   the notice would either cry wolf or never fire. */
function stampServiceWorker(hash, builtAt) {
  return {
    name: 'sb-stamp-sw',
    apply: 'build',
    /* EMITTED, not post-processed.

       This first read dist/sw.js after Vite had copied public/ over
       it — which depends on hook ordering, and a build failed the day
       it did not hold: the copy had not run, so the file it read was
       the PREVIOUS build's already-stamped worker and the guard
       correctly refused. Reading the template from src/ and emitting
       the result as a build asset depends on nothing. The template
       lives in src/ and is imported by no one, so it is never
       bundled. */
    generateBundle() {
      const src = readFileSync(resolve(process.cwd(), 'src/sw-template.js'), 'utf8')
      for (const token of ['__SB_SW_VERSION__', '__SB_SW_BUILT_AT__']) {
        if (!src.includes(token)) {
          throw new Error('src/sw-template.js has no ' + token + ' — the worker could not report which build it is')
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: src.split('__SB_SW_VERSION__').join(hash).split('__SB_SW_BUILT_AT__').join(builtAt),
      })
    },
  }
}

const BUILD_HASH = commitHash()
const BUILD_TIME = new Date().toISOString()

export default defineConfig({
  plugins: [react(), stampServiceWorker(BUILD_HASH, BUILD_TIME)],
  define: {
    __SB_BUILD_HASH__: JSON.stringify(BUILD_HASH),
    __SB_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
})
