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
    closeBundle() {
      const out = resolve(process.cwd(), 'dist/sw.js')
      const src = readFileSync(out, 'utf8')
      if (!src.includes('__SB_SW_VERSION__')) {
        throw new Error('sw.js has no __SB_SW_VERSION__ placeholder — the worker would never update')
      }
      if (!src.includes('__SB_SW_BUILT_AT__')) {
        throw new Error('sw.js has no __SB_SW_BUILT_AT__ placeholder — the update notice could not tell which side is stale')
      }
      const stamped = src.split('__SB_SW_VERSION__').join(hash).split('__SB_SW_BUILT_AT__').join(builtAt)
      writeFileSync(out, stamped)
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
