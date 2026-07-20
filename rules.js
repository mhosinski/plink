// rules.js — plink's pure rules, loaded as a native ES module (no build
// step). Everything here is testable without a DOM: functions that need
// game state take it as an explicit argument, and the tray is passed as
// an array of bead ids, never queried. tests/run.js imports this file
// directly; index.html imports it at the top of its script.

// Colors unlock in this order, one per cleared tray, starting with four.
// The set and order are optimized for perceptual contrast (Lab deltaE):
// every pair differs by >=30.5, the starting four by >=68, and each
// color clears the felt background by >=35.
export const COLORS = [
  { id:'cherry',     name:'cherry',     c:'#e0475c', hi:'#ee9aa5', lo:'#822935' },
  { id:'jade',       name:'jade',       c:'#43a377', hi:'#98ccb4', lo:'#275f45' },
  { id:'cornflower', name:'cornflower', c:'#5b7fd6', hi:'#a5b9e8', lo:'#354a7c' },
  { id:'honey',      name:'honey',      c:'#f2c94c', hi:'#f8e19d', lo:'#8c752c' },
  { id:'orchid',     name:'orchid',     c:'#c94fc4', hi:'#e19edf', lo:'#752e72' },
  { id:'pearl',      name:'pearl',      c:'#ece4d4', hi:'#f5f0e7', lo:'#89847b' },
  { id:'fig',        name:'fig',        c:'#755775', hi:'#b3a3b3', lo:'#443244' },
  { id:'petal',      name:'petal',      c:'#f2a7c3', hi:'#f8cfde', lo:'#8c6171' },
  { id:'clementine', name:'clementine', c:'#ef8f3a', hi:'#f6c193', lo:'#8b5322' },
  { id:'lagoon',     name:'lagoon',     c:'#2f9fa8', hi:'#8dcacf', lo:'#1b5c61' },
];

export const CAP = 12;
export const JAR_COUNT = 5; // index.html's NOTES must keep one tone per jar
export const TOTAL_CAP = JAR_COUNT * CAP; // also the perfect-scoop bound (grand-spill rarity is tuned to it)

// Both wells are bounded by physical room, not pacing (plink-vj7): the
// caps are static performance backstops chosen from felt area and what
// an older phone paints comfortably (~250 beads on the felt, worst
// case), far above any pile real play produces. They gate new arrivals
// only — an over-full save keeps its beads and sorts or tips its way
// back under the line, so no migration is ever needed.
// (Supersedes the 2026-07-18 dish-tracks-scoopBase() rule: capacity is
// what fits in the dish, not what fits in a hand.)
export const MIX_CAP = 180;    // ~5 stacked scoops at full scoop size, ~6 beads deep
export const PRESORT_CAP = 80; // a genuinely heaped dish, ~7 deep

export const BUTTONS_PER_JAR = 1, BUTTONS_PER_SLATE = 10;
export const BUTTONS_MATCH_BONUS = 2; // extra for a silhouette-matched jar (tunable)
export const SHAPE_PRICE = 50;   // flat, every silhouette in the catalog
const SHAPE_RATE = 1 / 6; // how often a dealt bead wears an owned shape

// Saves are a public contract with real players: they may hold colors
// retired from the palette (map to kin) or ids this build has never
// heard of (a newer build's save meeting a stale cached page — coerce
// to a known color). State must only ever contain ids this build
// understands, or the composer can deal beads pour() can't make.
export const RETIRED = { moss:'jade', cocoa:'clementine' };
const KNOWN_IDS = new Set(COLORS.map(c => c.id));
// Purchasable silhouettes (round is implicit). A bead id is 'cherry'
// or 'cherry~star': color before the ~, shape after. Color is the
// sorting truth — shapes are garnish per plink-37v.2.
export const SHAPES = new Set(['star', 'heart', 'cube']);

export function colorOf(id){ return String(id).split('~')[0]; }
export function shapeOf(id){ return String(id).split('~')[1] || 'round'; }

export function normalizeColorId(id){
  const parts = String(id).split('~');
  const mapped = RETIRED[parts[0]] || parts[0];
  const color = KNOWN_IDS.has(mapped) ? mapped : COLORS[0].id;
  return SHAPES.has(parts[1]) ? color + '~' + parts[1] : color;
}

// Buttons arrived long after her first jars: a save without a balance
// is seeded once from its own counters, so existing players open the
// catalog already wealthy from work done for its own sake (plink-lr8).
// A corrupt balance re-seeds the same way — the counters are the truth.
export function seedButtons(s){
  return (typeof s.buttons === 'number' && isFinite(s.buttons) && s.buttons >= 0)
    ? Math.floor(s.buttons)
    : (s.shelved || 0) * BUTTONS_PER_JAR + (s.slates || 0) * BUTTONS_PER_SLATE;
}

// De-slug migration (plink-pbr): the cadence fields once wore the random
// bead slug 'uni' (uniSorted / uniNextPerfect / uniGift). Read the old
// keys once; leave them in place, frozen, so an older cached page
// meeting this save still finds them (keep-in-saves, stop-writing — the
// same fossil policy as pourCount/nextPerfect). Never overwrite a new
// key that already exists: on a round-tripped save the fossils are stale.
export function migrateCadenceNames(s){
  if (!('cadenceSorted' in s) && 'uniSorted' in s) s.cadenceSorted = s.uniSorted;
  if (!('nextPerfectAt' in s) && 'uniNextPerfect' in s) s.nextPerfectAt = s.uniNextPerfect;
  if (!('pendingGift' in s) && 'uniGift' in s) s.pendingGift = s.uniGift;
  return s;
}

export function activeColorCount(atLevel){
  return Math.min(3 + atLevel, COLORS.length);
}

// Dresses a dealt bag in owned silhouettes. A decoration layer only:
// colors are untouched, so the composer's math never knows shapes exist.
// rnd is injected so the gates can steer it.
export function decorateBag(bag, owned, rnd){
  if (!owned || !owned.length) return bag;
  return bag.map(id =>
    rnd() < SHAPE_RATE ? id + '~' + owned[Math.floor(rnd() * owned.length)] : id);
}

// A full jar whose twelve beads all share a purchased silhouette earns
// a little extra — quietly, never announced as a number (plink-37v.2).
// Round is the default, not an achievement: all-round jars earn no bonus.
export function matchBonus(contents){
  if (!contents.length) return 0;
  const s = shapeOf(contents[0]);
  if (s === 'round') return 0;
  return contents.every(id => shapeOf(id) === s) ? BUTTONS_MATCH_BONUS : 0;
}

export function scoopBase(state){
  return Math.min(16 + state.level * 2, 36);
}

// A pour is offered only when a whole scoop fits under MIX_CAP — the
// gate asks "does a full scoop fit," so a pour never partially spills.
export function scoopFits(state, mixCount){
  return mixCount + scoopBase(state) <= MIX_CAP;
}

// Finishing scoops arrive on an unpredictable cadence — a random gap,
// re-rolled after each one — and are never announced: the scoop looks
// ordinary, and the clean slate is discovered at the last bead. The
// cadence counts sorted beads, not pours (tip-back spam must never
// summon a grand spill), scaled by a scoop's worth of beads so the
// rhythm stays 3-8 scoops.
export function rollNextPerfect(state){
  return state.cadenceSorted + (3 + Math.floor(Math.random() * 6)) * scoopBase(state);
}

// No topping, no room math — physical reversibility (tip-back) is what
// guarantees the player is never stuck, so the scoop itself can be
// honest random (clumpy, lucky, textured). Never returns null; a
// newly-unlocked color is force-included once so the gift never whiffs
// (state.pendingGift is consumed here — the one state write in this file).
export function computeScoopHonest(state){
  const pool = COLORS.slice(0, activeColorCount(state.level)).map(c => c.id);
  const size = scoopBase(state);
  const bag = [];
  if (state.pendingGift && pool.includes(state.pendingGift)){
    bag.push(state.pendingGift);
    state.pendingGift = null;
  }
  while (bag.length < size) bag.push(pool[Math.floor(Math.random() * pool.length)]);
  for (let i = bag.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// Jars shelved before history recording existed live only in the
// counter; synthesize their entries once. Colors follow the unlock
// curve (early jars draw from the small early pool), entries are
// flagged s:1 with t:null so a shelf UI can group them honestly as
// "before records", and the PRNG is seeded from the save so the same
// save always backfills identically (the result may not be persisted
// until the first real action).
export function backfillShelf(missing, level, seed){
  let s = (Math.imul(seed, 2654435761) + missing * 97 + level) >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [];
  for (let k = 0; k < missing; k++){
    const levelAt = 1 + Math.floor(((k + 1) / (missing + 1)) * Math.max(0, level - 1));
    const pool = activeColorCount(levelAt);
    out.push({ c: COLORS[Math.floor(rnd() * pool)].id, t: null, s: 1 });
  }
  return out;
}

// A "finishing scoop": exactly the beads that finish every color in
// play — completing every partial jar AND giving every held tray
// leftover a full set — so perfect sorting shelves everything: a clean
// slate. Every non-empty jar must be uniform. A color with more than a
// jar's worth in play completes across that many jars; that is always
// schedulable because each finished jar shelves and frees its seat.
// Invariant-safe by construction: after this pour every color in play
// totals a multiple of CAP, so a shelve is always live.
export function computePerfectScoop(jars, trayIds){
  const have = {}, jarsOf = {};
  for (const jar of jars){
    if (!jar.length) continue;
    const c = colorOf(jar[0]);
    if (!jar.every(id => colorOf(id) === c)) return null;
    have[c] = (have[c] || 0) + jar.length;
    jarsOf[c] = (jarsOf[c] || 0) + 1;
  }
  trayIds.forEach(id => {
    const c = colorOf(id);
    have[c] = (have[c] || 0) + 1;
  });
  const bag = [];
  for (const c in have){
    const jarsNeeded = Math.max(jarsOf[c] || 0, Math.ceil(have[c] / CAP));
    for (let k = have[c]; k < jarsNeeded * CAP; k++) bag.push(c);
  }
  // Bounded by one full tray. Simulation note: steady-state "finish
  // everything" needs cluster around 50-58 beads, so a lower cap makes
  // finishing scoops near-mythical (~1 per 1000 pours at cap 40-56 vs
  // ~1 per 10 at 60). The rare grand spill is the feature.
  if (!bag.length || bag.length > TOTAL_CAP) return null;
  for (let i = bag.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// The bead to take back: from the jar's minority color (the odd ones
// out leave first), newest of that color. A single-color jar behaves
// like a plain undo.
export function evictIndex(contents){
  const counts = {};
  contents.forEach(id => { const c = colorOf(id); counts[c] = (counts[c] || 0) + 1; });
  let min = Infinity;
  for (const c in counts) min = Math.min(min, counts[c]);
  let best = -1;
  contents.forEach((id, i) => { if (counts[colorOf(id)] === min) best = Math.max(best, i); });
  return best;
}
