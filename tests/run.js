#!/usr/bin/env node
// Quality gates for plink. No dependencies; run with: node tests/run.js
//
// index.html is the single source file, so pure logic under test is
// extracted from it by slicing between function-declaration markers and
// eval'ing with stubs. If a marker function is renamed, update the
// SLICES table below.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Whole-script syntax check
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];
new Function(js); // throws on syntax error

// PWA satellites: manifest parses with required fields; sw parses; all
// referenced assets exist; index.html wires them up.
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons'])
  if (!manifest[key]) throw new Error('manifest missing ' + key);
for (const icon of manifest.icons)
  fs.statSync(path.join(root, icon.src)); // throws if an icon file is missing
new Function(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'));
if (!src.includes('manifest.webmanifest') || !src.includes('serviceWorker'))
  throw new Error('index.html does not wire up the PWA');

const SLICES = {
  scoop: ['function activeColorCount', 'function pour('],
  evict: ['function evictIndex', 'function reflowMinis'],
  clean: ['function hasCleanMove', 'function updatePourUI'],
  migrate: ['const RETIRED', 'state.jars = state.jars.map'],
};
function slice(name) {
  const [from, to] = SLICES[name];
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0 || b <= a) throw new Error('marker not found for slice: ' + name);
  return src.slice(a, b);
}

// ---- shared stubs matching the game's constants ----
const COLORS = Array.from({ length: 10 }, (_, i) => ({ id: 'c' + i, name: 'c' + i }));
const CAP = 12, JAR_COUNT = 5, TOTAL_CAP = 60, POUR_AT = 5, MIN_BREATH = 10;
let state, trayBeads = [];
const tray = { querySelectorAll: () => trayBeads.map(id => ({ dataset: { color: id } })) };

eval(slice('scoop'));
eval(slice('evict'));
eval(slice('clean'));

let failures = 0;
function check(cond, label) {
  console.log((cond ? 'ok   ' : 'FAIL ') + label);
  if (!cond) failures++;
}

// ---- evictIndex: minority color leaves first, newest of that color ----
state = null;
check(evictIndex(['a', 'a', 'b', 'a']) === 2, 'evict: minority first');
check(evictIndex(['a', 'a', 'a']) === 2, 'evict: single color = undo (newest)');
check(evictIndex(['a', 'b', 'a', 'b']) === 3, 'evict: tie -> newest of tied');
check(evictIndex(['b']) === 0, 'evict: lone bead');
check(evictIndex(['a', 'b', 'b', 'c', 'b']) === 3, 'evict: two tied minorities -> newest');

// ---- hasCleanMove: non-full jar, empty or uniformly the bead's color ----
function cleanCase(jars, beads, want, label) {
  state = { jars };
  trayBeads = beads;
  check(hasCleanMove() === want, 'clean: ' + label);
}
cleanCase([['x', 'x', 'x'], ['y', 'y', 'y'], ['z', 'z', 'z'], Array(10).fill('w'), Array(9).fill('v')],
  ['a', 'a', 'a', 'b', 'b', 'b'], false, 'all jars claimed by other colors -> none');
cleanCase([[], ['x']], ['a'], true, 'empty jar -> clean move');
cleanCase([['a', 'a'], ['x']], ['a'], true, 'matching uniform jar -> clean move');
cleanCase([Array(12).fill('a'), ['x']], ['a'], false, 'matching jar but full -> none');
cleanCase([['a', 'x'], ['y']], ['a'], false, 'only mixed/other jars -> none');
cleanCase([['x']], [], false, 'empty tray -> vacuously none needed');

// ---- normalizeColorId: saves are a public contract ----
// Evaluated in its own scope with the real palette ids, since the
// normalizer's KNOWN_IDS derives from COLORS.
const normalizeColorId = (function () {
  const COLORS = ['cherry', 'jade', 'cornflower', 'honey', 'clementine'].map(id => ({ id }));
  eval(slice('migrate'));
  return normalizeColorId;
})();
check(normalizeColorId('moss') === 'jade', 'migrate: retired moss -> jade');
check(normalizeColorId('cocoa') === 'clementine', 'migrate: retired cocoa -> clementine');
check(normalizeColorId('jade') === 'jade', 'migrate: known id passes through');
check(normalizeColorId('sage') === 'cherry', 'migrate: unknown future id coerced to a known color');
check(normalizeColorId(undefined) === 'cherry', 'migrate: corrupt entry coerced, never crashes');

// ---- computePerfectScoop: finish every color in play, leftovers too ----
trayBeads = [];
state = { level: 5, jars: [Array(7).fill('c0'), Array(4).fill('c1'), [], Array(11).fill('c0'), []] };
const perfect = computePerfectScoop();
const tally = {};
(perfect || []).forEach(id => tally[id] = (tally[id] || 0) + 1);
check(perfect && perfect.length === 14 && tally.c0 === 6 && tally.c1 === 8,
  'perfect: bag exactly tops every partial jar (c0 x6, c1 x8)');
state = { level: 5, jars: [['c0', 'c1'], []] };
check(computePerfectScoop() === null, 'perfect: mixed jar -> not offered');
state = { level: 5, jars: [[], [], [], [], []] };
check(computePerfectScoop() === null, 'perfect: nothing in play -> not offered');
state = { level: 9, jars: Array.from({ length: 5 }, (_, i) => ['c' + i]) };
check((computePerfectScoop() || []).length === 55, 'perfect: 55-bead grand spill allowed (one tray)');
state = { level: 9, jars: Array.from({ length: 5 }, (_, i) => ['c' + i]) };
trayBeads = ['c5'];
check(computePerfectScoop() === null, 'perfect: need 66 > one full tray -> not offered');
trayBeads = [];
state = { level: 5, jars: [Array(11).fill('c2'), [], [], [], []] };
check((computePerfectScoop() || []).length === 1, 'perfect: single finishing bead allowed');
// leftover-aware: held tray beads get their completing sets too
state = { level: 9, jars: [Array(7).fill('c0'), [], [], [], []] };
trayBeads = ['c5', 'c5', 'c5'];
const withLeft = computePerfectScoop();
const t2 = {};
(withLeft || []).forEach(id => t2[id] = (t2[id] || 0) + 1);
check(withLeft && t2.c0 === 5 && t2.c5 === 9, 'perfect: leftovers completed (c0 x5, c5 x9)');
trayBeads = Array(12).fill('c5');
check(JSON.stringify((computePerfectScoop() || []).sort()) === JSON.stringify(Array(5).fill('c0')),
  'perfect: an exact dozen on the tray needs no beads of its own');
// a color spread over two jars completes across both
state = { level: 9, jars: [Array(7).fill('c0'), Array(4).fill('c0'), [], [], []] };
trayBeads = ['c0', 'c0'];
check((computePerfectScoop() || []).length === 11, 'perfect: two jars of one color -> 24 total (need 11)');
// invariant: after any perfect bag, every color in play totals a multiple of CAP
state = { level: 9, jars: [Array(9).fill('c1'), Array(6).fill('c3'), [], [], []] };
trayBeads = ['c7', 'c7', 'c8'];
const inv = computePerfectScoop();
const totals = { c1: 9, c3: 6, c7: 2, c8: 1 };
(inv || []).forEach(id => totals[id]++);
check(inv && Object.values(totals).every(v => v % CAP === 0),
  'perfect: every in-play color lands on a multiple of 12');
trayBeads = [];

// ---- backfillShelf: synthesized history for counter-only shelves ----
const bf = backfillShelf(14, 8, 1234);
check(bf.length === 14, 'backfill: one entry per missing jar');
check(JSON.stringify(bf) === JSON.stringify(backfillShelf(14, 8, 1234)),
  'backfill: deterministic for the same save');
check(JSON.stringify(bf) !== JSON.stringify(backfillShelf(14, 8, 99)),
  'backfill: different saves differ');
check(bf.every(e => e.s === 1 && e.t === null), 'backfill: entries flagged seeded, no fake dates');
const poolOK = bf.every((e, k) => {
  const levelAt = 1 + Math.floor(((k + 1) / 15) * 7);
  return COLORS.slice(0, activeColorCount(levelAt)).some(c => c.id === e.c);
});
check(poolOK, 'backfill: colors respect the unlock curve at each point');
check(backfillShelf(0, 8, 1).length === 0, 'backfill: nothing missing -> nothing seeded');

// ---- computeScoop fairness: no color may starve in small-room play ----
// The sister-in-law regime: jars + held leftovers keep in-play near
// capacity, so scoops are tiny and the top-up consumes leading slots.
// Every active color must still appear across repeated scoops. (The old
// positional filler NEVER dealt fixed colors here.)
{
  trayBeads = [];
  const seen = new Set();
  for (let trial = 0; trial < 300; trial++) {
    // 5 jars x 10 mixed beads -> every color count 10 (need=2), room 10
    state = {
      level: 9,
      jars: Array.from({ length: 5 }, (_, j) =>
        [0, 1, 2, 3, 4].flatMap(k => ['c' + ((j * 2) % 10), 'c' + ((j * 2 + 1) % 10)])),
    };
    (computeScoop() || []).forEach(id => seen.add(id));
  }
  check(seen.size === 10,
    `fairness: all 10 colors dealt across small-room scoops (got ${seen.size})`);
}

// ---- computeScoop: no-deadlock invariant, property-tested ----
// After every pour: either everything in play fits in the jars (tray can
// clear) or some color has CAP beads in play (a shelve is achievable).
// null is allowed only when jars are full AND a shelvable color exists.
let bad = 0;
const TRIALS = 50000;
for (let t = 0; t < TRIALS; t++) {
  const level = 1 + Math.floor(Math.random() * 12);
  const nColors = Math.min(3 + level, 10);
  const jars = Array.from({ length: JAR_COUNT }, () => {
    const n = Math.floor(Math.random() * 13);
    return Array.from({ length: n }, () => 'c' + Math.floor(Math.random() * nColors));
  });
  trayBeads = Array.from({ length: Math.floor(Math.random() * (POUR_AT + 1)) },
    () => 'c' + Math.floor(Math.random() * nColors));
  state = { level, jars };
  const counts = inPlayCounts();
  const playTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const room = TOTAL_CAP - playTotal;
  const maxCount = Math.max(0, ...Object.values(counts));
  const bag = computeScoop();
  if (bag === null) {
    if (!(room <= 0 && maxCount >= CAP)) bad++;
    continue;
  }
  if (bag.length < 1) { bad++; continue; }
  const after = { ...counts };
  bag.forEach(id => after[id] = (after[id] || 0) + 1);
  const clearable = playTotal + bag.length <= TOTAL_CAP;
  const shelvable = Math.max(...Object.values(after)) >= CAP;
  if (!clearable && !shelvable) bad++;
}
check(bad === 0, `scoop: no-deadlock invariant over ${TRIALS} random states (${bad} bad)`);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall gates green');
process.exit(failures ? 1 : 0);
