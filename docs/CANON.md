# CANON — plink

*This document continues Genesis. Genesis recorded why plink exists and is
not rewritten; Canon records the current center of gravity — the version of
the game that future work should reinforce unless there is a deliberate
reason to change course. Where a mechanism described here differs from one
Genesis mentioned, Genesis's values still govern and Canon's mechanisms are
how they are currently honored. Read both in full at session start. Updated
whenever the direction genuinely moves; last updated 2026-07-19.*

---

## Why This Document Exists

plink has moved past its first design twice. The scoop composer that
mathematically guaranteed progress gave way to honest randomness once
physical reversibility could carry the never-stuck promise. The interface
grew tabs, then shed them for something simpler. Each shift was earned
through play — hers and Mike's — and each left old descriptions behind in
docs and code. Canon is where a future session learns which version of the
game is current without archaeology.

---

## The Game as It Stands

The table is the game. One scene: a two-compartment tray (the big **mix**
well and the smaller **pre-sort dish**), five jars above it, the shelf on
the wall above those, and the catalog — a thing you pick up, not a place
you go.

- **Scoops are honest.** `computeScoopHonest()` deals genuinely random
  handfuls — clumpy, lucky, textured. The one orchestration kept is the
  perfect scoop, arriving on an unannounced cadence measured in *sorted
  beads* (tip-back spam can never summon one), and the rule that a newly
  unlocked color always appears in the next handful — gifts never whiff.
- **Reversibility carries never-stuck.** Tap a jar to take a bead back,
  hold to pour it out, tip the whole mix back into the bag. Every state
  reaches a fresh handful because nothing is permanent until it's shelved.
  This is the physical successor to the old composer proof.
- **Both wells are bounded by room, not rules.** The mix holds `MIX_CAP`
  (180) beads and the pour is offered only while a whole scoop fits; the
  pre-sort dish holds 80. Both are static performance backstops — chosen
  from felt area and what an older phone paints comfortably, far above
  any pile real play produces — never pacing, and they never scale with
  the player. Refusal speaks the full-jar grammar: a dimmed pill, a low
  tone, a plain sentence. Caps gate new arrivals only; an over-full save
  keeps its beads. (This supersedes "the dish holds a handful": capacity
  is what fits in the dish, not what fits in a hand.) Staged beads may
  pile and overlap like a real dish; the no-squinting rule protects the
  *mix*, where hunting happens, not the dish, where chosen beads wait.
- **A tray celebrates once per pour.** `state.cleared` arms exactly one
  level-up per poured tray, however the beads leave it. Re-sorting an
  evicted bead earns nothing, in levels or in cadence.
- **Buttons are earned, never demanded.** A shelved jar earns one, a
  matched-silhouette dozen a little more, a clean slate ten. They fly
  visibly into the count at the tray's top right, which is also the door
  to the catalog. The count sits quietly; it never pulses, badges, or nags.

## The Chrome as It Stands

**The scene is the game; the chrome is furniture.** This was earned twice
in one week — a pewter button tin and a shelf-lip peek both tried to make
navigation something to discover, and both were cut.

- One control family: **pills**, in two weights. Small utility pills at
  the top right (sound, shelf, the button count); large verb pills at the
  thumb (**pour a scoop**, **tip back**), in the marker script that keeps
  verbs in plink's handwriting.
- **Lit cream means active — everywhere and only.** The pressed shelf
  toggle and the armed "sure?" confirm share it. Nothing else may use it.
- The **shelf** is a same-location toggle: the pill lights while you're
  up there, and the same spot brings you back. The header persists over
  both places; the wood wall is one continuous surface (the shelf view
  paints no background of its own).
- The **catalog** opens as a bottom sheet over the table — scrim, grip,
  Escape — and is put down, not navigated away from.
- Diegetic invention is reserved for gameplay objects: beads, jars, tray,
  dish, and someday the bag. Navigation and status get plain, obvious
  mobile controls dressed in the room's materials. Proposals are checked
  against iOS/mobile best practice, not against cleverness. If a control
  needs discovering, it's wrong.

---

## What Is Not Canon

- **The orchestrated composer** — `computeScoop()`, `hasCleanMove()`, the
  wall messages and `ROOM_CAP` machinery — was deleted outright with the
  `UNI` flag (plink-pbr, 2026-07-19), along with its test harness. The
  'uni' name itself is gone too: it was a random bead slug that calcified
  into ~60 identifiers; the survivors were renamed to what they mean
  (`cadenceSorted`, `nextPerfectAt`, `pendingGift`) with a load-time
  migration, and the old save keys remain only as frozen fossils for
  older cached pages.
- **The tape material.** Cream tapes, kraft tapes, the clip-path cut —
  retired with plink-apl. The craft-table voice lives in the marker
  script, the wood, the felt, and the glass now.
- **Labels on gameplay objects.** The PRE-SORT watermark is gone for the
  same reason jars have never been labeled: form is the signifier, and a
  one-time whisper that fades on first use is the most instruction the
  scene will carry.
- **Discovery-based navigation.** The tin-as-object and the peek plank are
  cut, not parked. Their lesson is the chrome rule above.

---

## Open Questions (live beads, decide from play)

- Should level pacing eventually move from cleared trays to shelved jars —
  advancement tied to irreversible progress? (plink-ppe.)
- Gesture accelerators — swipe down for the shelf, drag the sheet grip —
  as accelerators only, never the discoverable path. (plink-xb1.)
- The first-run experience in the two-well era: where the tray hint
  lives, and who gets the whisper. (plink-piq.)
