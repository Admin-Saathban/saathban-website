# Saathban App — Quality Report

Repo-wide audit of the authenticated app (`src/app/`) against SPEC.md's voice
principles and accessibility floors, plus an inventory of copy still hardcoded
outside the central locale system. Covers every screen in both languages
(English + Urdu) as all four roles (Saath-Icon, Saath-Buddy, Saath-Fam, Admin).

**Scope of fixes in this pass:** locale strings only (`src/app/locales/en.js`,
`ur.js`). Everything requiring a component edit is listed as a finding for the
owning lane — this report changes no component file.

Date: 2026-08-29.

---

## 1. Executive summary

| Area | Result |
|---|---|
| Voice / tone | **1** substantive issue found, **fixed** in locales. Rest of the app clean. |
| Bilingual coverage | en/ur key parity **perfect: 500 / 500**, no missing or orphaned keys. 3 newer lanes are English-only (copy not yet in the central files). |
| Accessibility | See §3 — completed by a dedicated sweep. |
| Hardcoded copy | 6 lanes hold copy in local modules; ~189 strings to lift into central `locales/` (§5). |

The app's voice is, overall, in excellent shape: the SPEC's hardest rules —
never "user"/"elderly", empty states as doors, nothing clinical or childish,
consistent آپ register in Urdu — are held almost everywhere. The single
exception has been corrected.

---

## 2. Voice & tone audit

Audited every user-facing string in `locales/en.js` + `ur.js`, in each per-lane
copy module (`routes/*/copy.js`, `*Copy.js`, `strings.js`), and in inline JSX,
against SPEC.md "Principles" and "Language & accessibility".

### Fixed (locales — this pass)

1. **Fam dashboard empty circle — scoreboard, not a door.**
   `locales/en.js` `fam.dashboard.emptyCircle` opened *"No one yet — and
   connecting takes a minute…"*; `locales/ur.js` mirrored it with *"ابھی کوئی
   نہیں —"*. Leading with the absence is exactly the framing SPEC forbids for
   empty states ("never imply a gap"). **Fixed** both to lead with the action:
   *"Connecting takes only a minute. Ask to join someone's circle below…"* /
   *"جڑنے میں بس ایک منٹ لگتا ہے۔…"*. (Commit `1d155c7`.)

### Verified clean (no violations)

- **No literal "user" or "elderly"** in any rendered string in either language.
  The only matches across `src/app` are code comments, variable names
  (`session.user.id`), the copy-rule header comments, and `capture="user"` (a
  camera hint, never shown).
- **Urdu register is consistently آپ (aap)** throughout — imperatives are
  کریں/بتائیں/لکھیں/چنیں; the companion/character lines, moods, share sheet,
  fam, vetting, and the newer lanes all use aap. No تم/تُو forms.
- **Empty states are doors elsewhere:** the Icon-side circle empty state
  (`circle/copy.js` "Your circle is yours to build…"), the score-share empty
  circle (`home.score.share.circleEmpty`), the community empty feed ("The first
  post starts the conversation"), and the events empty calendar are all model
  doors, not scoreboards.
- **Nothing clinical or childish:** medicines/diet are framed as "a record,
  never an alarm/diet plan"; the app says "seniors" (SPEC-sanctioned), never
  "patient"/"elderly". Participation summaries are softened ("Every one counts
  the same"), never leaderboards.
- Admin/staff-facing strings (buddy queue, moderation, broadcasts) are neutral
  and role-respectful; queue empties ("The queue is clear") are not
  audience-implying.

**Coverage:** locales (both languages); `routes/` — admin, auth, circle,
community, events, fam, home, notifications, profile, skills, vetting;
`components/`; `AppHome.jsx`, `AppSettings.jsx`. All checked; only the one issue
above.

---

## 3. Accessibility audit

Checked every screen against the floors in `src/shared/tokens.js` (`A11Y.minBodyPx
= 18`, `minTapTargetPx = 48`) and the `ts()` text-scaling helper: body/interactive
text ≥18px and routed through `ts()` so the in-app text-size control moves it;
tap targets ≥48px; state never signalled by colour alone; sufficient contrast.
All findings below are **component-level — not fixed in this pass** (this pass
edits locales only); each carries `file:line` for the owning lane.

**Headline:** the shared primitives are built correctly — `components/ui.jsx`,
`AppSettings.jsx`, and the `fam/`, `community/`, `auth/` UI enforce the floors.
Two classes of real defect remain: a handful of concrete sub-floor controls, and
a **systemic text-scaling gap** — the senior-facing home daily-log lane (and the
admin/vetting lanes) use raw pixel sizes and never call `ts()`, so the in-app
text-size control silently does nothing on those screens. That gap matters most
on exactly the screen a senior uses every day.

### Must-fix (tap targets & colour-only — hard floors)

- **`community/Feed.jsx:277`** — comment **Report** button `minHeight: 32` (<48); text `ts(15)` (<18). *(Independently confirmed.)*
- **`community/Thread.jsx:160`** — DM **Report** button `minHeight: 36` (<48); text `ts(14)` (<18). *(Independently confirmed.)*
  Both are report affordances, which SPEC calls non-negotiable — raise to `A11Y.minTapTargetPx` and `ts(18)`.
- **`community/Thread.jsx:131`** — money-warning **safety banner** `ts(16)` (<18); a safety alert should meet the floor.
- **Admin single-line inputs with no `minHeight`** (sub-48 tap target): `BuddyApplication.jsx:678, :691`; `BroadcastsPage.jsx:146, :168`; and the "back to the app" link `AdminLayout.jsx:224`. Add `minHeight: A11Y.minTapTargetPx`.
- **`admin/BuddyQueue.jsx:66`** — selected filter tab shown by **colour only** (green fill/border, no `aria-pressed`, no glyph). Add `aria-pressed` + a non-colour marker.

### Systemic — text does not scale (route through `ts()`)

Text here is ≥18px but hardcoded in raw px, so the text-size control has no
effect:

- **Home daily-log lane (senior-facing — highest impact):** `DailyLogCard.jsx`, `ScoreShare.jsx`, `IconHome.jsx`, `CalendarStrip.jsx`, `GreetingCharacter.jsx`. (`IconHub.jsx` already uses `ts()` correctly — the pattern to copy.)
- **Admin lane** (staff-facing, lower impact): all `admin/*` files use raw px; several controls are also <18 — `ui.jsx:154` AdminBtn 17, `AdminLayout.jsx:224` back link 15, `BuddyApplication.jsx:51` inputStyle 17, `BroadcastsPage.jsx:25` inputStyle 17, `QuestionsQueue.jsx:26` textarea 17, `BuddyQueue.jsx:81` filter tab 16.
- **Vetting lane** (Buddy-facing): `VettingForm.jsx`, `fields.jsx`, `steps.jsx`, `screens.jsx` all raw px — none <18, purely a scaling gap.
- **Events** shared `ui.jsx:185` inputStyle is raw `fontSize: 18` (not `ts`), so calendar/admin inputs won't scale.

### Sub-18px secondary text (low — systemic, partly a judgment call)

Hints, timestamps, badges, and sub-labels commonly sit at `ts(14)`–`ts(17)`,
below the 18px floor, across `circle/ui.jsx`, `events/ui.jsx`, `community/`,
`notifications/`, `skills/`, and admin chips. Whether these count depends on
reading "body text" strictly vs. exempting fine print. Recommendation: at minimum
raise **interactive and status** text to `ts(18)` — notably `circle/ui.jsx:174`
(Toggle On/Off on `role="switch"`) and `:230` (Segmented label on `role="radio"`),
`skills/SkillsPage.jsx:67` (status note), and `notifications/NotificationsPage.jsx:115`
("unread" label) — and set an explicit policy for captions.

### Contrast (low)

- `C.olive` (#6b7c5e) section labels ≈ **4.06:1** on the cream background — below the 4.5:1 AA threshold. Recurs at `circle/ui.jsx:40`, `events/ui.jsx:74`, `fam/ui.jsx:117`, `community/Messages.jsx:69`, `FamDashboard.jsx:85`. Use `C.greenMuted` or enlarge/embolden. `C.textMuted` (≈6:1) is fine; no other contrast issues.

### Verified clean (colour-not-alone & floors)

Home chips / calendar / meds / mood, events tabs & status badges, skills
interested state, circle toggles and removal — all pair a ✓/glyph + a word +
`aria-*`, never colour alone. `components/ui.jsx`, `AppSettings.jsx` (exemplary —
all `ts()`), `fam/*`, `auth/*`, and `profile/ProfilePage.jsx` meet all floors.

**Cross-check:** an independent grep sweep confirmed the two Community
tap-target defects and turned up three further sub-48 `minHeight` hits that are
**not** violations — `auth/CheckEmail.jsx:82` and `ResetPassword.jsx:135` are
`aria-live` status paragraphs (reserved space, not interactive), and
`vetting/screens.jsx:117` is a decorative pipeline connector (`aria-hidden`).
Excluded.

---

## 4. Bilingual coverage

- **Key parity: perfect.** `en.js` and `ur.js` each expose **500** keys, with
  **zero** missing in Urdu and **zero** orphaned — so no screen silently falls
  back to English through a missing key. (Verified by flattening both trees and
  diffing the key sets.)
- **Urdu is a complete draft, pending native review.** No `[UR]` placeholders
  remain in `ur.js`; the file header and QUESTIONS.md #4 both flag that a native
  speaker must sign off on register/warmth/regional word choice before launch.
- **Three newer lanes are not yet in the central files** and so are **English
  only** at present: community, events, circle (see §5). Their strings render
  in English regardless of the language toggle. skills, notifications, and
  profile already ship an Urdu draft in their local modules; fam and vetting are
  fully centralised and bilingual.

---

## 5. Hardcoded copy — consolidation inventory

For a single future task to lift all remaining lane-local copy into the central
`locales/` system. The good news: copy is **cleanly centralised per lane** (one
module each), not scattered through JSX — the lift is "move six objects," with
only two stray inline literals anywhere.

| Lane | Copy location | ~strings | Bilingual? | Target namespace |
|---|---|---|---|---|
| community | `communityCopy.js` (`COPY`) | ~49 (feed ~31, dm ~19) | English-only | `community.*` (`.feed`, `.dm`) |
| events | `eventsCopy.js` (`COPY`) | ~56 (nav 3, list 17, calendar 18, admin 21) | English-only | `events.*` (`.nav/.list/.calendar/.admin`) |
| circle | `copy.js` (`COPY`) + 2 inline fallbacks | ~38 + 2 | English-only | `circle.*` |
| skills | `strings.js` (`STRINGS.en/.ur`) | ~20 | Bilingual (Urdu draft) | `skills.*` |
| notifications | `strings.js` (`STRINGS.en/.ur`) | ~11 | Bilingual (Urdu draft) | `notifications.*` |
| profile | `strings.js` (`STRINGS.en/.ur`) | ~15 | Bilingual (Urdu draft) | `profile.*` |
| fam | central `fam.*`; `famCopy.js` = maps only | 0 | done | `fam.*` |
| vetting | central `vetting.*`; `vettingData.js` = keys only | 0 | done | `vetting.*` |
| outdoor | — route does not exist yet — | 0 | n/a | n/a |

### Two inline literals to move (only ones in the app)
- `routes/circle/CirclePage.jsx:31` — `"A member"` (name fallback) → `circle.member.unknownFallback`
- `routes/circle/CirclePage.jsx:141` — `"Someone"` (invitee fallback) → `circle.requests.unknownFallback`

### Notes for the lift
- Function-valued entries (`events` `capacity`/`goingCount`, `circle` `sosOrder`,
  `notifications` `unreadLabel`, `profile` `roleLine`, etc.) must become
  `{placeholder}` templates + plural keys when they move into the flat locale
  files. Each lane's header comment already anticipates this.
- **skills / notifications / profile** carry Urdu drafts already — they drop
  straight in. **community / events / circle** are English-only and need a fresh
  Urdu pass as part of (or right after) the lift.
- Leave in the modules, do **not** translate: community `MONEY_PATTERN` (regex
  matching logic, already includes Urdu keywords), `REACTIONS` emoji, and skills
  `SKILLS` keys. Trim the file-path reference out of `events.admin.intro` on lift.

Per-string line references (exact `file:line | "text" | suggested key`) were
captured for community, events, circle, skills, notifications, and profile; they
are lengthy and omitted here — regenerate with the same per-lane scan when the
lift task starts, or see the audit transcript.

---

## 6. Fixes applied in this pass (locales only)

- `locales/en.js` + `locales/ur.js`: `fam.dashboard.emptyCircle` reworded from a
  scoreboard opener to a door (§2.1). Committed as `1d155c7`, staged by explicit
  hunk so an unrelated concurrent edit to the same files was not swept in.

No other locale strings needed a voice change.

---

## 7. Findings for other lanes (non-locale — not fixed here)

These need a component/module edit owned by another lane; listed for them to
action.

- **Bilingual gap (high):** community, events, circle render English only. Lift
  their local copy into `locales/` (§5) and add Urdu, so the language toggle
  works on every screen.
- **Two inline fallbacks (low):** `circle/CirclePage.jsx:31,141` (§5).
- **Accessibility findings:** see §3 — each is tagged with its file and line for
  the owning lane.
