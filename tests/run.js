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

// Boot smoke: the whole script must also INITIALIZE without throwing — a
// declaration-order/TDZ mistake bricks the game on load, invisible to the
// syntax check (caught live 2026-07-16: SHAPE_PATHS declared below the
// jar-restore loop that called it). Browser APIs are one recursive
// permissive proxy; only what boot genuinely branches on is stubbed real.
{
  const p = new Proxy(function () {}, {
    get(t, prop){
      if (prop === Symbol.toPrimitive) return () => 0;
      return p;
    },
    set(){ return true; },
    apply(){ return p; },
    construct(){ return p; },
  });
  const boot = new Function(
    'document', 'window', 'localStorage', 'location', 'navigator',
    'matchMedia', 'setTimeout', 'setInterval', 'requestAnimationFrame',
    'addEventListener', 'console', js);
  try {
    boot(
      p, {}, { getItem: () => null, setItem(){}, removeItem(){} },
      { hostname: 'gate', search: '' }, {},
      () => ({ matches: false }), () => 0, () => 0, () => 0,
      () => 0, { log(){}, warn(){}, error(){} });
    console.log('ok   boot: script initializes without throwing');
  } catch (e) {
    console.log('FAIL boot: script threw during initialization: ' + e.message);
    process.exitCode = 1;
    throw e;
  }
}

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
const CAP = 12, JAR_COUNT = 5, TOTAL_CAP = 60, ROOM_CAP = 120, MIN_BREATH = 10;
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

// ---- shapes are garnish: color sorts, silhouette decorates ----
check(colorOf('c1~star') === 'c1' && shapeOf('c1~star') === 'star' && shapeOf('c1') === 'round',
  'shape: colorOf/shapeOf split composite ids');
check(evictIndex(['a', 'a~star', 'b']) === 2, 'evict: minority judged by color, shape ignored');
check(evictIndex(['a', 'a~star']) === 1, 'evict: single color with shapes = undo (newest)');

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
cleanCase([['a', 'a~star'], ['x']], ['a~heart'], true, 'shaped bead fits its color-uniform jar');

// ---- normalizeColorId: saves are a public contract ----
// Evaluated in its own scope with the real palette ids, since the
// normalizer's KNOWN_IDS derives from COLORS.
const { normalizeColorId, seedButtons } = (function () {
  const COLORS = ['cherry', 'jade', 'cornflower', 'honey', 'clementine'].map(id => ({ id }));
  eval(slice('migrate'));
  return { normalizeColorId, seedButtons };
})();
check(normalizeColorId('moss') === 'jade', 'migrate: retired moss -> jade');
check(normalizeColorId('cocoa') === 'clementine', 'migrate: retired cocoa -> clementine');
check(normalizeColorId('jade') === 'jade', 'migrate: known id passes through');
check(normalizeColorId('sage') === 'cherry', 'migrate: unknown future id coerced to a known color');
check(normalizeColorId(undefined) === 'cherry', 'migrate: corrupt entry coerced, never crashes');
check(normalizeColorId('jade~star') === 'jade~star', 'migrate: composite id passes with known shape');
check(normalizeColorId('moss~heart') === 'jade~heart', 'migrate: retired color keeps its shape');
check(normalizeColorId('jade~blob') === 'jade', 'migrate: unknown shape dropped, color kept');
check(normalizeColorId('sage~star') === 'cherry~star', 'migrate: unknown color coerced, known shape kept');

// ---- seedButtons: the retroactive grant is a one-time gift ----
check(seedButtons({ shelved: 67, slates: 4 }) === 107, 'buttons: seeded from counters (67 + 4x10)');
check(seedButtons({}) === 0, 'buttons: fresh save seeds zero');
check(seedButtons({ buttons: 3, shelved: 67, slates: 4 }) === 3, 'buttons: existing balance never re-grants');
check(seedButtons({ buttons: 0, shelved: 67 }) === 0, 'buttons: a spent-to-zero balance stays zero');
check(seedButtons({ buttons: -5, shelved: 2 }) === 2, 'buttons: corrupt balance re-seeds from counters');
check(seedButtons({ buttons: 2.7 }) === 2, 'buttons: fractional balance floors');

// ---- matchBonus: silhouette-matched jars earn quietly ----
check(matchBonus(Array(12).fill('c0')) === 0, 'bonus: all-round jar earns nothing (round is the default)');
check(matchBonus(Array(12).fill('c0~star')) === 2, 'bonus: twelve matching stars earn the bonus');
check(matchBonus([...Array(11).fill('c0~star'), 'c0']) === 0, 'bonus: one round bead breaks the match');
check(matchBonus([...Array(6).fill('c0~star'), ...Array(6).fill('c0~heart')]) === 0, 'bonus: mixed silhouettes earn nothing');
check(matchBonus([]) === 0, 'bonus: empty jar earns nothing');

// ---- decorateBag: shapes dress the scoop, colors stay the truth ----
{
  const bag = ['c0', 'c1', 'c2', 'c0'];
  check(decorateBag(bag, [], Math.random) === bag, 'decorate: owning nothing changes nothing');
  const all = decorateBag(bag, ['star'], () => 0); // always decorate, pick first
  check(all.every((id, i) => id === bag[i] + '~star'), 'decorate: rnd floor dresses every bead in the owned shape');
  check(all.every((id, i) => colorOf(id) === bag[i]), 'decorate: colors survive decoration untouched');
  check(decorateBag(bag, ['star'], () => 0.99).join() === bag.join(), 'decorate: rnd ceiling dresses nothing');
  const seq = [0, 0.9, 0.1, 0.99, 0.05, 0.4]; let si = 0;
  const some = decorateBag(bag, ['cube', 'heart'], () => seq[si++ % seq.length]);
  check(some.every(id => ['round', 'cube', 'heart'].includes(shapeOf(id))), 'decorate: only owned shapes ever appear');
}

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
// shapes: a color-uniform jar with mixed silhouettes is still uniform
state = { level: 5, jars: [['c0', 'c0~star', 'c0', 'c0~heart', 'c0', 'c0', 'c0'], [], [], [], []] };
trayBeads = ['c0~cube'];
check((computePerfectScoop() || []).length === 4,
  'perfect: color-uniform jar with mixed shapes completes (7+1 -> +4)');
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
  // some beads wear shapes — the composer must stay garnish-blind
  const rid = () => 'c' + Math.floor(Math.random() * nColors) +
    (Math.random() < 0.15 ? '~star' : '');
  const jars = Array.from({ length: JAR_COUNT }, () => {
    const n = Math.floor(Math.random() * 13);
    return Array.from({ length: n }, rid);
  });
  // held leftovers are unbounded now that the pour is a standing button —
  // model everything up to a full hoard past room capacity, so the
  // null/wall states are exercised from hoard-heavy rooms
  trayBeads = Array.from({ length: Math.floor(Math.random() * (ROOM_CAP + 12)) }, rid);
  state = { level, jars };
  const counts = inPlayCounts();
  const playTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const room = ROOM_CAP - playTotal;
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

// ---- standing-pour boundaries: hoarding never wedges ----
// A hoarder pours without sorting. The composer must (a) never let beads
// in play exceed one breath past capacity, (b) hit its wall only when a
// complete dozen is already in play — so a "fill a jar to shelve it"
// signpost is always true — and (c) after shelving that dozen, deal
// again. (Shelving is modeled as removing CAP beads of the color: a jar
// is always freeable via pour-back, which has no capacity check.)
{
  const CEILING = ROOM_CAP + Math.max(MIN_BREATH, CAP - 1);
  let overshoot = 0, badWall = 0, wedged = 0, walls = 0;
  for (let trial = 0; trial < 400; trial++) {
    state = { level: 1 + Math.floor(Math.random() * 12),
              jars: Array.from({ length: JAR_COUNT }, () => []) };
    trayBeads = [];
    for (let step = 0; step < 60; step++) {
      const bag = computeScoop();
      if (bag) {
        trayBeads.push(...bag);
        if (trayBeads.length > CEILING) overshoot++;
        continue;
      }
      walls++;
      const counts = {};
      trayBeads.forEach(id => counts[id] = (counts[id] || 0) + 1);
      const top = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
      if (counts[top] < CAP) { badWall++; break; }
      for (let k = 0; k < CAP; k++) trayBeads.splice(trayBeads.indexOf(top), 1);
      if (!computeScoop()) { wedged++; break; }
    }
  }
  check(overshoot === 0, 'hoard: in-play never exceeds one breath past capacity (' + CEILING + ')');
  check(badWall === 0 && walls > 0, `hoard: the wall always holds a shelvable dozen (${walls} walls hit)`);
  check(wedged === 0, 'hoard: shelving at the wall always reopens the room');
}

// ---- perfect scoop stays sound under a fat hoard ----
{
  state = { level: 9, jars: [Array(6).fill('c0'), [], [], [], []] };
  trayBeads = [...Array(20).fill('c1'), ...Array(9).fill('c2'), 'c0'];
  const fat = computePerfectScoop();
  const after = { c0: 7, c1: 20, c2: 9 };
  (fat || []).forEach(id => after[id]++);
  check(fat && fat.length === 12 && Object.values(after).every(v => v % CAP === 0),
    'perfect: fat hoard still lands every color on a multiple of 12');
  trayBeads = [];
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall gates green');
process.exit(failures ? 1 : 0);
