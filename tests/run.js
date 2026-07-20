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
const CAP = 12, JAR_COUNT = 5, TOTAL_CAP = 60, MIX_CAP = 180;
let state, trayBeads = [];
const tray = { querySelectorAll: () => trayBeads.map(id => ({ dataset: { color: id } })) };

eval(slice('scoop'));
eval(slice('evict'));

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

// ---- normalizeColorId: saves are a public contract ----
// Evaluated in its own scope with the real palette ids, since the
// normalizer's KNOWN_IDS derives from COLORS.
const { normalizeColorId, seedButtons, migrateCadenceNames } = (function () {
  const COLORS = ['cherry', 'jade', 'cornflower', 'honey', 'clementine'].map(id => ({ id }));
  eval(slice('migrate'));
  return { normalizeColorId, seedButtons, migrateCadenceNames };
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

// ---- migrateCadenceNames: the uni de-slug reads fossils once ----
{
  const s = migrateCadenceNames({ uniSorted: 42, uniNextPerfect: 90, uniGift: 'jade' });
  check(s.cadenceSorted === 42 && s.nextPerfectAt === 90 && s.pendingGift === 'jade',
    'migrate: uni-era save maps to the de-slugged names');
  check(s.uniSorted === 42 && s.uniNextPerfect === 90 && s.uniGift === 'jade',
    'migrate: fossils stay in place for older cached pages');
  const round = migrateCadenceNames(
    { uniSorted: 42, uniGift: 'jade', cadenceSorted: 99, nextPerfectAt: 120, pendingGift: null });
  check(round.cadenceSorted === 99 && round.nextPerfectAt === 120 && round.pendingGift === null,
    'migrate: stale fossils never clobber a round-tripped save');
  check(!('cadenceSorted' in migrateCadenceNames({})),
    'migrate: pre-wells save passes through untouched');
}

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

// ---- computeScoopHonest: honest randomness, gifts never whiff ----
{
  trayBeads = [];
  state = { level: 1, pendingGift: null };
  let bag = computeScoopHonest();
  check(bag.length === 18, 'honest: bag is exactly a scoop (18 at level 1)');
  const pool = new Set(COLORS.slice(0, 4).map(c => c.id));
  check(bag.every(id => pool.has(id)), 'honest: only unlocked colors dealt');
  state = { level: 1, pendingGift: 'c3' };
  bag = computeScoopHonest();
  check(bag.includes('c3') && state.pendingGift === null, 'honest: pending gift always dealt, then cleared');
  state = { level: 1, pendingGift: 'c9' }; // out-of-pool gift (corrupt/future save)
  bag = computeScoopHonest();
  check(!bag.includes('c9') && state.pendingGift === 'c9' && bag.length === 18,
    'honest: out-of-pool gift held for later, bag unharmed');
  const seenH = new Set();
  state = { level: 9, pendingGift: null };
  for (let t = 0; t < 200; t++) computeScoopHonest().forEach(id => seenH.add(id));
  check(seenH.size === 10, `honest: all 10 colors appear across many scoops (got ${seenH.size})`);
}

// ---- rollNextPerfect: the pours-era rhythm in sorted-bead units ----
{
  state = { level: 1, cadenceSorted: 100 }; // scoopBase() = 18 at level 1
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 500; t++){
    const v = rollNextPerfect();
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  check(lo >= 100 + 3 * 18 && hi <= 100 + 8 * 18,
    'cadence: next perfect lands 3-8 scoops of sorted beads ahead');
}

// ---- scoopFits: the mix bound is a performance backstop (plink-vj7) ----
{
  check(+src.match(/const MIX_CAP = (\d+)/)[1] === MIX_CAP,
    'mixcap: test stub matches the source constant');
  state = { level: 1 };
  check(scoopFits(0), 'mixcap: an empty mix always takes a scoop');
  check(scoopFits(162) && !scoopFits(163),
    'mixcap: level-1 boundary sits at MIX_CAP minus one small scoop');
  state = { level: 20 };
  check(scoopFits(144) && !scoopFits(145),
    'mixcap: full-scoop boundary sits at MIX_CAP minus 36');
}

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
