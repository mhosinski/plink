# GENESIS — plink

*The grounding document. Read in full at every session start. This records
why plink exists — the intent that can't be reconstructed from the code.*

## Origin

My wife got into bead crafts, and I noticed something watching her: she
enjoys sorting the beads by color into containers as much as — maybe more
than — the crafting itself. The scoop of mixed beads, picking through them,
the little containers filling up one color at a time. That specific,
observed pleasure is what plink is. It started as a gift and an experiment:
can that feeling be carried in a phone?

She is the player. Her reactions are the roadmap, her stuck screenshots are
the bug tracker, and "she loves it" is the ship criterion.

## Inspirations

1. **The real hobby, first.** The reference for any design question is the
   physical act of sorting beads at a craft table — jars, trays, scoops,
   tipping a jar back out when a bead landed wrong. When a mechanic needs a
   shape, ask what the hands would do, not what software usually does.
   That's why corrections are physical (tap a jar to take a bead back, hold
   to pour it out), why a full jar simply doesn't take another bead, and why
   the whole interface is a scene — wood, felt, glass — rather than chrome.

2. **The cozy-game lineage.** A Little to the Left, Unpacking — games where
   tidying *is* the play and the game's job is to protect the calm. plink
   sits in that lineage: sorting is self-directed, the game cooperates with
   your plan, and every system exists to deepen the satisfaction of putting
   things where they belong.

## Design values

These were earned through playtesting, not theorized. They are invariants.

- **No judgment.** The player is never told they did it wrong. There are no
  labeled jars, no rejection wiggles, no error sounds. Physical limits
  (a full jar) are fine; verdicts are not.
- **Sound is always consonant.** Each jar has one fixed pentatonic note, so
  repetition soothes and any drop order makes a small melody. Rising-pitch
  tension and escalating audio cues are banned — they were tried and they
  created anxiety.
- **The player can never be stuck — in feel, not just in math.** The scoop
  composer provably guarantees progress (property-tested), but the standard
  is stricter: the interface must always signpost a *good* move. Being
  forced into a move that feels bad (dirtying a clean jar to proceed)
  counts as stuck. Both guarantees must survive every new mechanic.
- **Progression is unfolding, not escalation.** New colors arrive as gentle
  rewards for cleared trays. Scoops grow. Nothing speeds up, counts down,
  or punishes.

## What plink is NOT

**plink is not a challenge game.** Difficulty may emerge from variety —
more colors, someday different bead sizes and shapes — but never from
timers, fail states, scores-as-pressure, or skill gates. If a proposed
feature makes the game more *demanding* rather than more *absorbing*, it
doesn't belong. The stats exist to be admired ("113 beads sorted"), not to
be beaten.

## What success looks like

She keeps choosing to open it. Sessions where nothing is achieved except
calm are the product working as intended. Growth means deepening the fidget
(new bead varieties, richer tactility, more to gently notice) — not adding
goals.
