import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

/* WHAT MUST EXIST OFFLINE, READ OFF THE BUILD ITSELF.

   The app is split into chunks now, so "the bundle" is no longer one
   file the worker can cache when it sees it. The worker precaches the
   entry script and everything the app shell statically imports — the
   header, the bar, Home and the daily log — because that is what has to
   open with no network for offline-first logging to mean anything.

   Everything reachable only through import() — other tabs, admin, the
   other language — is left out on purpose and cached when it is first
   used (see src/sw-template.js, rule 4). The list is computed from the
   finished bundle, so it can never name a file that was not emitted. */
function precacheList(bundle) {
  const chunks = Object.values(bundle).filter((f) => f.type === 'chunk')
  const byFile = new Map(chunks.map((c) => [c.fileName, c]))
  /* By the modules a chunk CONTAINS, not its facadeModuleId: measured,
     the AppRoot chunk reports facadeModuleId null (it re-exports through
     the entry), and matching on the facade silently precached nothing
     but the entry script. */
  const APP_ROOT = /[\\/]src[\\/]app[\\/]AppRoot\.jsx$/
  const isRoot = (c) =>
    c.isEntry ||
    APP_ROOT.test(c.facadeModuleId || '') ||
    Object.keys(c.modules || {}).some((id) => APP_ROOT.test(id))
  const out = new Set()
  const walk = (c) => {
    if (!c || out.has(c.fileName)) return
    out.add(c.fileName)
    for (const f of c.imports) walk(byFile.get(f))
    for (const css of c.viteMetadata?.importedCss || []) out.add(css)
  }
  chunks.filter(isRoot).forEach(walk)
  return [...out].map((f) => '/' + f)
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
       bundled. It is written to whatever outDir the build was given. */
    generateBundle(_options, bundle) {
      const src = readFileSync(resolve(process.cwd(), 'src/sw-template.js'), 'utf8')
      for (const token of ['__SB_SW_VERSION__', '__SB_SW_BUILT_AT__', '__SB_SW_PRECACHE__']) {
        if (!src.includes(token)) {
          throw new Error('src/sw-template.js has no ' + token + ' — the worker could not report which build it is')
        }
      }
      const precache = precacheList(bundle)
      if (!precache.length) {
        throw new Error('sb-stamp-sw: found no entry chunk to precache — the worker would open nothing offline')
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: src
          .split('__SB_SW_VERSION__').join(hash)
          .split('__SB_SW_BUILT_AT__').join(builtAt)
          .split('__SB_SW_PRECACHE__').join(JSON.stringify(precache)),
      })
    },
  }
}

/* THE APP'S OWN CHUNKS START WITH THE PAGE, NOT AFTER THE ENTRY SCRIPT.

   Splitting the bundle put a step in front of Home: the entry script has
   to download, parse and run before its import() of the app even begins.
   Measured on the throttled phone profile, a WARM open went from 808ms
   to about 1,200ms because of exactly that queue.

   So the built index.html carries a few lines that, ON /app PATHS ONLY,
   announce the app chunk and the stored language's strings as
   modulepreload. The browser fetches and compiles them alongside the
   entry script. The marketing site at / never sees the hint, so its
   visitors still never download the app. File names come from the
   finished bundle, so a hint can never name a file that was not emitted. */
function preloadAppOnAppPaths() {
  return {
    name: 'sb-preload-app',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx && ctx.bundle
        if (!bundle) return html
        const chunks = Object.values(bundle).filter((f) => f.type === 'chunk')
        const APP_ROOT = /[\\/]src[\\/]app[\\/]AppRoot\.jsx$/
        const app = chunks.find((c) => Object.keys(c.modules || {}).some((id) => APP_ROOT.test(id)))
        const locale = (code) =>
          chunks.find((c) => new RegExp(`[\\\\/]src[\\\\/]app[\\\\/]locales[\\\\/]${code}\\.js$`).test(c.facadeModuleId || ''))
        const en = locale('en')
        const ur = locale('ur')
        if (!app || !en || !ur) {
          throw new Error('sb-preload-app: could not find the app or locale chunks to announce')
        }
        const script =
          '(function(){if(!/^\\/app(\\/|$)/.test(location.pathname))return;' +
          'var l="en";try{if(localStorage.getItem("saathban.app.lang")==="ur")l="ur"}catch(e){}' +
          `var f=[${JSON.stringify('/' + app.fileName)},l==="ur"?${JSON.stringify('/' + ur.fileName)}:${JSON.stringify('/' + en.fileName)}];` +
          'for(var i=0;i<f.length;i++){var k=document.createElement("link");k.rel="modulepreload";k.crossOrigin="";k.href=f[i];document.head.appendChild(k)}})();'
        /* End of <head>, after <meta charset>: the entry is a module
           script and therefore deferred, so this still runs first. */
        return [{ tag: 'script', children: script, injectTo: 'head' }]
      },
    },
  }
}

const BUILD_HASH = commitHash()
const BUILD_TIME = new Date().toISOString()

export default defineConfig({
  plugins: [react(), stampServiceWorker(BUILD_HASH, BUILD_TIME), preloadAppOnAppPaths()],
  define: {
    __SB_BUILD_HASH__: JSON.stringify(BUILD_HASH),
    __SB_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
})
