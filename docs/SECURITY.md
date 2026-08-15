# Security Posture — plink

*Written 2026-08-15. Answers the six questions in
`ai-toolkit/project-seed/SECURITY-baseline.md`; re-verify at each milestone
(§6). Companion to `docs/GENESIS.md` (intent), `docs/CANON.md` (current
mechanisms) and CLAUDE.md (how). Hard rules are the bd memories
`rule-secrets-out-of-band` and `rule-untrusted-content-to-agents`; this doc
holds the specifics. plink is a static, offline-capable toy with no server,
no accounts and no network calls of its own — most answers are short, and
"none" below is the honest answer, not a gap.*

## 1. Data — what's sensitive, where it lives, who can reach it

**What we hold.** Nothing about anyone. The only data the game creates is
each player's save: `localStorage['plink-v2']` (counters, level, jar
contents, tray beads, shelf history, hint flags) on the player's own device
(browser or the Capacitor webview). No telemetry, no analytics, no server
round-trip — `game.js`/`rules.js` make no `fetch`; `sw.js` only caches
same-origin GETs of the game's own assets.

**Committed vs. never tracked.** The repo is code, art (icons/splash), the
docs and the native shell scaffolding. There is no data tier to gitignore.
Not tracked: `native/node_modules/`, `native/www/` (generated copy of the
game), Xcode/Gradle build output, beads' local Dolt state.

**Where it runs.** `mhosinski/plink` is a **public** GitHub repo; GitHub
Pages serves `main` at `https://mhosinski.github.io/plink/` to anyone.
Everything committed here — code, GENESIS/CANON, this doc — is public by
design. Two things to remember because of that:

- **Beads sync goes to the same public remote.** `.beads/config.yaml` sets
  `sync.remote` to the repo, and `refs/dolt/data` is present on origin — so
  the beads database (issues, notes, memories, the handoff) is readable by
  anyone who fetches that ref. Beads content here is fine to be public
  (design decisions, family first-names-as-roles); keep it that way: no
  addresses, no device identifiers, no Apple/Google account details in
  beads. See the findings log.
- **Saves are a public contract** (CLAUDE.md): real players run builds we
  don't control the cache of. That is a compatibility duty, not a
  confidentiality one, but it is the closest thing plink has to "other
  people's data" — a bad migration is how we would lose it.

**Retention.** Nothing to prune. A player deletes their save by clearing
site data or uninstalling; the in-game **copy backup** puts the save on the
clipboard as JSON for the player to keep wherever they like.

## 2. Secrets — inventory and rotation

| Key | Lives in | Scope / purpose | Rotate how; consequence |
| --- | -------- | --------------- | ----------------------- |
| *(none in the project)* | — | The web game has no API keys, tokens or passwords; nothing is read from env | — |
| GitHub push auth | Mike's Mac (`git@github.com` SSH key, `gh` OAuth) | Push to `main` **is** the deploy | Revoke the SSH key / `gh auth logout` in GitHub settings; a compromised Mac can publish any game build |
| Apple signing identity | Xcode / Keychain on Mike's Mac (free-tier device signing today; Developer Program enrolment underway, plink-6wl.2) | Sign the iOS shell for device/TestFlight | Revoke in the Apple Developer portal; certificates and provisioning profiles never enter the repo |
| Android release keystore | Not created yet (plink-6wl.3) | Sign the APK/AAB | When created it lives outside the repo (root `.gitignore` covers `*.jks` / `*.keystore` — the Android template's own lines are commented out); losing it means a new app identity on Play |

Third-party credentials: none — plink talks to no one's system. Nothing is
shown-once. Local dev copies: none. Secret scanning: gitleaks pre-commit
appended to `.beads/hooks/pre-commit` by the seed's `install-hooks.sh`
(2026-08-15); a full-history `gitleaks git` scan on the same date found no
leaks across 60 commits.

## 3. Access — what gates each surface

- **Users:** anyone with the URL (the family today — Mike's wife, her
  sister, their niece — via the PWA or a device-signed native build). There
  is no login, no cookie, no per-user anything: identity is the device.
- **Gate:** none, deliberately. The site is a public static page; the
  service worker and PWA install add offline play, not access control.
- **Outside the gate:** everything, by design; there is no privileged
  surface to list. Writes reach the repo only through GitHub push auth (§2).
- **Sessions/tokens:** none. The one "credential-like" flow is the save
  backup: `copy backup` writes the save JSON to the clipboard, `restore
  backup` reads the clipboard back (browser permission prompt +
  in-game `confirm()`); the payload is a bead layout, not a secret.

## 4. Trust boundaries — third parties and agents

**External services and the terms we talk to them on:**

- **GitHub Pages** — the host; deploy is a push to `main`, verified by
  curling the live page for a build marker (CLAUDE.md, Build & Deploy).
  GitHub Actions is only used implicitly (the Pages build).
- **Apple (TestFlight/App Store) and Google Play** — the eventual native
  distribution channels (epic plink-6wl); interaction is through Xcode /
  Android Studio on Mike's Mac, never scripted with stored credentials.
- No mail, no analytics, no CDN, no fonts, no third-party scripts —
  `index.html` loads only its own four files, manifest and icons.

**What agents may do here without asking:** commit and push — and because
push is deploy, that means ship to players (CLAUDE.md opts into the
team-maintainer profile; memory `feedback-always-push`). Quality
gate `node tests/run.js` first; bump `sw.js`'s `CACHE` when the four-file
surface changes so installed apps don't skew. **Must confirm first:**
anything touching signing (Xcode team, keystore), the Pages configuration
(`gh api repos/{owner}/plink/pages`), or a save-schema change without a
load-time migration and gates test. **Never:** add a network call, telemetry
or a third-party script to the game (GENESIS: it's a fidget for one player's
calm; there is nothing to phone home about), or put personal details about
the players into beads (public remote, §1).

**Authority held by automated agents/routines:** none beyond the coding
session itself. No cloud routine, bot or scheduled job acts for plink.

**Untrusted content reaching an agent with authority:** none flows into an
agent — there is no agent at runtime. At the *game's* level the one outside
input is a pasted backup: `restore backup` does `JSON.parse` on clipboard
text, requires the shape check + player confirmation, then every colour id
passes `normalizeColorId()` on load so state can never hold an id the build
can't complete. That is data-hygiene for the save contract, not a security
boundary — worst case is a broken save on the player's own device. During
sessions, agents read GENESIS/CANON, beads and this repo — our own
authored content; the beads remote is ours.

**The toolchain itself:** `bd` hooks (third-party OSS, marker-managed in
`.beads/hooks/`, `core.hooksPath` points there), the seed's gitleaks line
appended after bd's block, `bd prime --hook-json` on session start
(`.claude/settings.json`), the Codex `bd codex-hook` hooks
(`.codex/hooks.json`), and the global ai-toolkit session-traceability hooks
(own repo). No MCP servers or connectors are needed for plink; leave the
claude.ai connectors (Instacart, Gmail, Drive, Calendar, Linear) that appear
in sessions unauthenticated here.

## 5. Dependencies and supply chain

**Web game: zero dependencies.** No `package.json` at the root, no build
step, no bundler — the browser loads `index.html`, `styles.css`, `game.js`,
`rules.js` natively. The tests are plain `node tests/run.js`.

**Native shell (`native/`):** npm, `package-lock.json` committed (94
resolved packages), Capacitor pinned to the 7 line (`@capacitor/*` ^7.x —
Capacitor 8 needs Node ≥ 22; the shell was built on Node 20, the Mac now
runs Node 24, so that pin is a choice we can revisit, not a constraint).
`@capacitor/cli` (a dev-time code generator that writes into the Xcode /
Gradle projects) is the load-bearing one; the runtime deps are the shells
themselves plus `@capacitor/haptics`. Xcode's CocoaPods `Podfile.lock` is
committed too.

Band per `feedback-surface-dependency-debt`: never newer than the cooldown,
never more than one major behind on anything load-bearing. Mechanics: npm
has no resolver-side cooldown — check `npm view <pkg> time` before bumping
a Capacitor package and don't take a version younger than ~7 days without a
CVE reason; review a new dep's install scripts before adding it (the current
`native/` tree has no `preinstall`/`postinstall` scripts — only `prepare`,
which npm does not run for registry deps). No CI: `npm audit --omit=dev` in
`native/` at each milestone checkpoint. The surface is small enough that
this paragraph is the whole policy — no `docs/DEPENDENCIES.md`.

## 6. Review cadence and incident notes

**Milestone checkpoint** (same moment as the dependency review — a natural
one is each native-release step in plink-6wl): re-read this doc against
reality — a first network call? a first secret (keystore, store API key)? a
new hook or connector? — then `npm audit --omit=dev` in `native/` and
`/security-review` on the milestone's diff; findings become beads and the
checkpoint date is updated below.

**If something leaks / breaks:** there is no plink secret to rotate.
Order of operations if the Mac is in question: revoke the GitHub SSH key /
`gh` token (stops rogue deploys), revoke Apple signing certificates, then
inspect `git log origin/main` for pushes we didn't make and re-push a known
good `main` (Pages redeploys in ~1 min; installed PWAs pick it up on their
next launch). If a bad build reached players' saves: the fix is a
load-time migration in the next deploy, never asking players to reset —
saves are the contract. Who to tell: the family group chat.

**Findings log:**

| Date | Finding | Disposition |
| ---- | ------- | ----------- |
| 2026-08-15 | No secrets, no network calls, no server; full-history gitleaks scan clean (60 commits) | Nothing to rotate — recorded as the baseline |
| 2026-08-15 | Beads DB syncs to `refs/dolt/data` on the **public** repo — issues, notes and memories (incl. the handoff) are world-readable | Accepted for now: content is design history and roles, not personal data; rule added above (no personal details in beads); reconsider a private beads remote if the project ever holds player-identifying info (plink-rlb) |
| 2026-08-15 | Android template `.gitignore` ships its keystore lines commented out; no root-level guard before a release keystore exists | Fixed — root `.gitignore` now ignores `*.jks` / `*.keystore` alongside the seed's `*.pem` / `*.p12` / `*.key` |
| 2026-08-15 | No CI audit gate for `native/`; npm has no cooldown mechanics | Accepted — surface is Capacitor only; checkpoint runs `npm audit`, publish-date check by hand before bumps |

*Last checkpoint: 2026-08-15 — first application of the seed's posture
questions; no code changes required.*
