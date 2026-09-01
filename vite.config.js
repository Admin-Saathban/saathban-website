import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

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

export default defineConfig({
  plugins: [react()],
  define: {
    __SB_BUILD_HASH__: JSON.stringify(commitHash()),
    __SB_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
