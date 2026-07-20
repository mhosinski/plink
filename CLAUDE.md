# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

## Session Start

At the beginning of every session, run these steps in order:

**1. Read `docs/GENESIS.md` AND `docs/CANON.md` in full** (use the Read tool —
do not truncate with `sed`/`head`). GENESIS holds the original intent — the
*why* before any code — and is essentially frozen; do not amend it to track
evolving direction. CANON holds the current center of gravity: which version
of each system is live, what has been retired, and the design rules earned
since GENESIS. Where a mechanism differs between them, CANON wins. Ground
yourself in both before making any recommendation or design decision.

**2. Run `bd prime`** — this outputs the full beads workflow reference
(commands, rules, memories). Read the entire output; do not skip or summarize.
Run it manually at the start of every session; there is no reliable startup
hook for this.

```bash
bd prime
```

**3. Load handoff notes** — the last session's mechanics and where to resume.

```bash
bd recall handoff-next-session
```

Update handoff at the end of each session:

```bash
bd remember "handoff-next-session: ..." --key handoff-next-session
```

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

## Session Completion (project policy)

This repository explicitly opts into the **team-maintainer** profile above: this
section IS the push authority the managed block asks for. **When ending a work
session**, you MUST complete ALL steps below. Work is NOT complete until
`git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed):
   ```bash
   node tests/run.js
   ```
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY. Never rebase a dirty tree: fetch,
   check whether the remote is ahead (`git log --oneline main..origin/main`),
   and if it is empty a plain `git push` is a clean fast-forward. Only
   reconcile if the remote has diverged, and never auto-stash user WIP.
   ```bash
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Update `handoff-next-session` (see shape below)

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- Pushing to `main` IS the deploy: GitHub Pages serves it live within ~1 minute

### Handoff Shape

The handoff memory records state and rationale, not tasks — tasks live in beads
issues; the handoff is the bridge that tells the next session which bead to
pick up and what context it needs. Follow this shape:

- **Header line:** date, one-phrase session summary, repo/build state, and any
  **pending gate** (e.g. "user was about to test X; confirm before building on it")
- **WHAT LANDED:** each completed item with its bead ID, key values/decisions,
  and *why* — enough that the next session doesn't re-derive or re-litigate
- **NEXT STEPS in order:** prioritized, with bead IDs; note which beads stay
  open and which are close-eligible pending confirmation
- **PROCESS:** workflow lessons hardened this session — mistakes made and the
  corrected procedure — so process improvements compound

## Parking Work (Deferred Tails)

A feature push typically reaches ~80% before hitting diminishing returns and the
work with higher leverage moves elsewhere. That is a deliberate, healthy pivot —
not abandonment. Park the remaining tail instead of forcing it to completion or
losing track of it.

**To park an initiative's tail** (when it's "good enough for now"):

1. `bd update <remaining open descendant ids> --status deferred` — moves the tail
   out of the active working set. Add an `--append-notes` noting why/where you stopped.
2. **Keep the epic itself `open` — do NOT close it.** An open epic with done
   children and a deferred tail is the truthful record: substantial work done,
   remainder deliberately on ice. Closing it would read as finished and risk
   `bd epic close-eligible` treating parked work as complete.
3. `bd note <epic>` — one line on what remains and why, so the narrative survives.

**Views** (aliases in `~/.zshrc`):

```bash
bda   # bd list --status open,in_progress,blocked --limit 0  → active set (hides deferred/closed)
bdp   # bd list --status deferred --limit 0                  → parked backlog on demand
```

**To resume:** `bd children <epic>` (or `bdp`), then `bd update <ids> --status open`
to pull items back into the active set.

**Why `deferred`, not `closed`:** `deferred` (frozen) means "deliberately on ice
for later" — it leaves `bda`/`bd ready`, stays local, searchable, and instantly
resurfaceable, and does not inflate an epic's completion. `closed` means *done*;
using it for parked work loses the fact that real items remain.

## Build, Run & Deploy

There is no build step: the game is `index.html` (the scene — DOM,
interaction, audio, inline CSS) plus `rules.js` (the pure rules as a
native ES module the browser loads directly; vanilla JS, no
dependencies), and thin PWA satellites: `manifest.webmanifest`, `sw.js`,
and generated `icon-*.png`. The service worker is stale-while-revalidate,
so installed apps play offline and pick up a deploy on their **next**
launch (curl-based deploy verification is unaffected — it hits the
network). `index.html` and `rules.js` are a matched pair: bump `sw.js`'s
`CACHE` version string whenever the import/export surface between them
changes, or when the asset list changes.

```bash
python3 -m http.server 8000        # run locally → http://localhost:8000
node tests/run.js                  # quality gates (syntax + logic invariants)
git push                           # deploy: Pages serves main within ~1 min
curl -s https://mhosinski.github.io/plink/ | grep -q <marker>   # verify deploy
```

Phone testing happens against the live Pages URL. GitHub Pages sets
~10-minute cache headers — a hard refresh may be needed to see a fresh
deploy on a device.

## Architecture Overview

Pure rules — palette, composers, cadence, caps, eviction, save
migration — live in `rules.js`; everything else lives in `index.html`,
in this order:

- **CSS scene** — the committed single-theme art direction (walnut wood,
  spruce felt tray, glass jars). No cards or web chrome; the scene is the UI.
- **`COLORS`** — 10 colors with gloss (`hi`) and shadow (`lo`) variants;
  array order IS the unlock order, optimized for perceptual contrast
  (Lab ΔE ≥ 30.5 all pairs; first four ≥ 68). Retired color ids are
  migrated on load via the `RETIRED` map — never reuse a retired id.
- **`NOTES`** — one fixed pentatonic tone per jar (C5 D5 E5 G5 A5, left to
  right). Jars own notes; colors do not.
- **State & persistence** — `localStorage` key `plink-v2`: counters, level,
  jar contents, tray beads (with positions), shelf history, hint flags.
  **Saves are a public contract: plink has real players on devices we don't
  control** (Mike's wife, her sister, their niece — and counting). Every
  schema or palette change ships in the same commit as a load-time
  migration plus a gates test. All color ids pass through
  `normalizeColorId()` on load (retired ids map to kin via `RETIRED`;
  unknown ids coerce to a known color) so state can never hold an id the
  running build can't complete or pour — stale cached pages meeting newer
  saves is a real scenario under Pages' ~10-minute cache.
- **Audio** — all Web Audio-synthesized, no assets. iOS needs the
  `audioSession: 'playback'` opt-in and the silent-buffer unlock; keep both.
- **Interaction** — pointer-event drag with lerp, tap-to-hold alternative,
  keyboard support, aria-live announcements, `prefers-reduced-motion`
  respected throughout.
- **Core rules** — since the two-compartment tray (2026-07), the rules
  are `computeScoopHonest()` (honest-random scoops; a pending color gift
  never whiffs), `rollNextPerfect()` (perfect-scoop cadence in sorted
  beads via `state.cadenceSorted`, tip-back-spam-proof), `scoopFits()`
  (pour is offered only while a whole scoop fits the mix's static
  `MIX_CAP` of 180; the dish's `presortCap()` is a static 80 — both are
  performance backstops, never pacing), `state.cleared` (one tray
  celebration per pour — kills the jar-evict-jar level loop), and
  `evictIndex()` (minority-color take-back). The old orchestrated
  composer was deleted with the `UNI` flag (plink-pbr); bead counts are
  always derived from the DOM, never from a parallel counter. Rule
  functions take `state` (or jars/tray ids) as explicit arguments —
  rules.js never touches the DOM or module globals.

## Design Rules (invariants, not preferences)

- **No fail states, no rejection feedback, no timers, no scores-as-pressure.**
  Physical fullness (a full jar refusing a bead) is fine; judgment is not.
- **Sound must stay consonant** — fixed tone per jar, pentatonic across jars;
  never rising-pitch tension mechanics.
- **The player can never be stuck** — in both senses. The guarantee is now
  *physical reversibility*, not composer math: every placement can be
  undone (tap a jar to take back, hold to pour out, tip the mix back into
  the bag), so any state reaches a fresh handful. The UI must always
  signpost an action — the standing pour and tip-back are that signpost.
  Any new mechanic must preserve both senses.
- **New distinguishing axes (size/shape) are planned** — see beads issues —
  and should add challenge through variety, never through squinting.
  (The no-squinting rule protects the *mix*, where you hunt; staged beads
  in the pre-sort dish may pile and overlap like a real dish.)
- **Chrome is conventional; the scene is the game.** One control family
  (pills, hierarchy by weight and placement), lit cream means *active* and
  nothing else, diegetic invention reserved for gameplay objects. The full
  rule and its provenance live in `docs/CANON.md` (and plink-2q1) — CANON
  is the authority; this line is the reminder.

## Testing Philosophy

Use tests to protect core rules and formulas, not to simulate the full runtime.

Pure logic that must stay under test (imported from `rules.js` by
`tests/run.js`): the honest composer (gift-never-whiffs, pool discipline,
no color starving), the perfect-scoop cadence window, eviction order,
save migration (`normalizeColorId`, `migrateCadenceNames`, and kin), and
any future rule with the same shape (shelving conditions, palette
distances, level pacing). New rules belong in `rules.js` from the start;
`index.html`'s inline script is still syntax- and boot-checked by the
gates, with its import statement bound to the real exports.

Avoid brittle automated tests for runtime-heavy behavior: drag feel,
animations, Web Audio output, iOS quirks, layout. For those, do a manual
smoke test on a phone against the live Pages deploy and note the result in
the bead or handoff.

When adding a feature, extract pure helpers only when it makes the rule easier
to test or reuse. Do not add abstractions solely to satisfy a test.

## Feature Implementation Order

For every new feature, implement in this sequence:

1. Constants / palette / state-schema changes (with save migration)
2. Pure rule logic (in `rules.js`, imported by `tests/run.js`)
3. DOM & interaction wiring (pointer, keyboard, aria)
4. Scene polish: CSS, motion (with reduced-motion path), sound (consonant)
5. Extend `tests/run.js` when the change touches rules or invariants
6. Manual smoke test on a phone via the live deploy
