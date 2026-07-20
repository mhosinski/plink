#!/usr/bin/env node
// Quality gates for plink. No dependencies; run with: node tests/run.js
//
// The pure rules live in rules.js (a native ES module) and are imported
// here directly — no extraction, no stub constants. game.js (the scene
// script) is still syntax- and boot-checked: its import statement is
// replaced by parameters bound to the real rules exports.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'game.js'), 'utf8');

let failures = 0;
function check(cond, label) {
  console.log((cond ? 'ok   ' : 'FAIL ') + label);
  if (!cond) failures++;
}

(async () => {

const R = await import(pathToFileURL(path.join(root, 'rules.js')));
const {
  COLORS, CAP, MIX_CAP,
  colorOf, shapeOf, activeColorCount, decorateBag, matchBonus,
  scoopFits, rollNextPerfect, computeScoopHonest, computePerfectScoop,
  evictIndex, normalizeColorId, migrateCadenceNames, seedButtons,
  backfillShelf,
} = R;

// ---- the scene script: import surface, syntax, boot ----
check(src.includes('src="./game.js"') && src.includes('href="./styles.css"'),
  'wiring: index.html loads game.js and styles.css');
const importMatch = js.match(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/rules\.js';/);
check(!!importMatch, 'wiring: game.js imports rules.js');
const importedNames = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
check(importedNames.every(n => n in R),
  'wiring: every imported name is exported by rules.js (' +
  importedNames.filter(n => !(n in R)).join(', ') + ')');
const body = js.replace(importMatch[0], '');
new Function(...importedNames, body); // throws on syntax error

// Boot smoke: the whole script must also INITIALIZE without throwing — a
// declaration-order/TDZ mistake bricks the game on load, invisible to the
// syntax check (caught live 2026-07-16: SHAPE_PATHS declared below the
// jar-restore loop that called it). Browser APIs are one recursive
// permissive proxy; only what boot genuinely branches on is stubbed real.
// The rules imports are bound to their real exports, so boot exercises
// the true load path (normalize, migrate, seed, first pour).
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
    'addEventListener', 'console', ...importedNames, body);
  try {
    boot(
      p, {}, { getItem: () => null, setItem(){}, removeItem(){} },
      { hostname: 'gate', search: '' }, {},
      () => ({ matches: false }), () => 0, () => 0, () => 0,
      () => 0, { log(){}, warn(){}, error(){} },
      ...importedNames.map(n => R[n]));
    console.log('ok   boot: script initializes without throwing');
  } catch (e) {
    console.log('FAIL boot: script threw during initialization: ' + e.message);
    process.exitCode = 1;
    throw e;
  }
}

// PWA satellites: manifest parses with required fields; sw parses; all
// referenced assets exist; index.html wires them up; the sw precaches
// the index.html + rules.js pair (they must deploy in lockstep).
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const key of ['name', 'short_name', 'start_url', 'display', 'icons'])
  if (!manifest[key]) throw new Error('manifest missing ' + key);
for (const icon of manifest.icons)
  fs.statSync(path.join(root, icon.src)); // throws if an icon file is missing
const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
new Function(swSrc);
if (!src.includes('manifest.webmanifest') || !js.includes('serviceWorker'))
  throw new Error('the PWA is not wired up (manifest in index, sw registration in game.js)');
check(['./index.html', './game.js', './styles.css', './rules.js']
    .every(a => swSrc.includes("'" + a + "'")),
  'wiring: sw.js precaches the whole matched set');

// ---- evictIndex: minority color leaves first, newest of that color ----
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
check(normalizeColorId('moss') === 'jade', 'migrate: retired moss -> jade');
check(normalizeColorId('cocoa') === 'clementine', 'migrate: retired cocoa -> clementine');
check(normalizeColorId('jade') === 'jade', 'migrate: known id passes through');
check(normalizeColorId('sage') === COLORS[0].id, 'migrate: unknown future id coerced to a known color');
check(normalizeColorId(undefined) === COLORS[0].id, 'migrate: corrupt entry coerced, never crashes');
check(normalizeColorId('jade~star') === 'jade~star', 'migrate: composite id passes with known shape');
check(normalizeColorId('moss~heart') === 'jade~heart', 'migrate: retired color keeps its shape');
check(normalizeColorId('jade~blob') === 'jade', 'migrate: unknown shape dropped, color kept');
check(normalizeColorId('sage~star') === COLORS[0].id + '~star', 'migrate: unknown color coerced, known shape kept');

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

// ---- computePerfectScoop(jars, trayIds): finish every color in play ----
{
  let perfect = computePerfectScoop([Array(7).fill('c0'), Array(4).fill('c1'), [], Array(11).fill('c0'), []], []);
  const tally = {};
  (perfect || []).forEach(id => tally[id] = (tally[id] || 0) + 1);
  check(perfect && perfect.length === 14 && tally.c0 === 6 && tally.c1 === 8,
    'perfect: bag exactly tops every partial jar (c0 x6, c1 x8)');
  check(computePerfectScoop([['c0', 'c1'], []], []) === null, 'perfect: mixed jar -> not offered');
  check(computePerfectScoop([[], [], [], [], []], []) === null, 'perfect: nothing in play -> not offered');
  const oneEach = Array.from({ length: 5 }, (_, i) => ['c' + i]);
  check((computePerfectScoop(oneEach, []) || []).length === 55, 'perfect: 55-bead grand spill allowed (one tray)');
  check(computePerfectScoop(oneEach, ['c5']) === null, 'perfect: need 66 > one full tray -> not offered');
  check((computePerfectScoop([Array(11).fill('c2'), [], [], [], []], []) || []).length === 1,
    'perfect: single finishing bead allowed');
  // leftover-aware: held tray beads get their completing sets too
  const withLeft = computePerfectScoop([Array(7).fill('c0'), [], [], [], []], ['c5', 'c5', 'c5']);
  const t2 = {};
  (withLeft || []).forEach(id => t2[id] = (t2[id] || 0) + 1);
  check(withLeft && t2.c0 === 5 && t2.c5 === 9, 'perfect: leftovers completed (c0 x5, c5 x9)');
  check(JSON.stringify((computePerfectScoop([Array(7).fill('c0'), [], [], [], []], Array(12).fill('c5')) || []).sort())
    === JSON.stringify(Array(5).fill('c0')),
    'perfect: an exact dozen on the tray needs no beads of its own');
  // a color spread over two jars completes across both
  check((computePerfectScoop([Array(7).fill('c0'), Array(4).fill('c0'), [], [], []], ['c0', 'c0']) || []).length === 11,
    'perfect: two jars of one color -> 24 total (need 11)');
  // invariant: after any perfect bag, every color in play totals a multiple of CAP
  const inv = computePerfectScoop([Array(9).fill('c1'), Array(6).fill('c3'), [], [], []], ['c7', 'c7', 'c8']);
  const totals = { c1: 9, c3: 6, c7: 2, c8: 1 };
  (inv || []).forEach(id => totals[id]++);
  check(inv && Object.values(totals).every(v => v % CAP === 0),
    'perfect: every in-play color lands on a multiple of 12');
  // shapes: a color-uniform jar with mixed silhouettes is still uniform
  check((computePerfectScoop([['c0', 'c0~star', 'c0', 'c0~heart', 'c0', 'c0', 'c0'], [], [], [], []], ['c0~cube']) || []).length === 4,
    'perfect: color-uniform jar with mixed shapes completes (7+1 -> +4)');
}

// ---- computeScoopHonest(state): honest randomness, gifts never whiff ----
{
  let state = { level: 1, pendingGift: null };
  let bag = computeScoopHonest(state);
  check(bag.length === 18, 'honest: bag is exactly a scoop (18 at level 1)');
  const pool = new Set(COLORS.slice(0, 4).map(c => c.id));
  check(bag.every(id => pool.has(id)), 'honest: only unlocked colors dealt');
  const gift = COLORS[3].id; // in the level-1 pool of four
  state = { level: 1, pendingGift: gift };
  bag = computeScoopHonest(state);
  check(bag.includes(gift) && state.pendingGift === null, 'honest: pending gift always dealt, then cleared');
  const far = COLORS[9].id; // out-of-pool gift (corrupt/future save)
  state = { level: 1, pendingGift: far };
  bag = computeScoopHonest(state);
  check(!bag.includes(far) && state.pendingGift === far && bag.length === 18,
    'honest: out-of-pool gift held for later, bag unharmed');
  const seenH = new Set();
  state = { level: 9, pendingGift: null };
  for (let t = 0; t < 200; t++) computeScoopHonest(state).forEach(id => seenH.add(id));
  check(seenH.size === 10, `honest: all 10 colors appear across many scoops (got ${seenH.size})`);
}

// ---- rollNextPerfect(state): the pours-era rhythm in sorted-bead units ----
{
  const state = { level: 1, cadenceSorted: 100 }; // scoopBase = 18 at level 1
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 500; t++){
    const v = rollNextPerfect(state);
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  check(lo >= 100 + 3 * 18 && hi <= 100 + 8 * 18,
    'cadence: next perfect lands 3-8 scoops of sorted beads ahead');
}

// ---- scoopFits(state, mix): the mix bound is a performance backstop ----
{
  check(scoopFits({ level: 1 }, 0), 'mixcap: an empty mix always takes a scoop');
  check(scoopFits({ level: 1 }, MIX_CAP - 18) && !scoopFits({ level: 1 }, MIX_CAP - 17),
    'mixcap: level-1 boundary sits at MIX_CAP minus one small scoop');
  check(scoopFits({ level: 20 }, MIX_CAP - 36) && !scoopFits({ level: 20 }, MIX_CAP - 35),
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
  const fat = computePerfectScoop([Array(6).fill('c0'), [], [], [], []],
    [...Array(20).fill('c1'), ...Array(9).fill('c2'), 'c0']);
  const after = { c0: 7, c1: 20, c2: 9 };
  (fat || []).forEach(id => after[id]++);
  check(fat && fat.length === 12 && Object.values(after).every(v => v % CAP === 0),
    'perfect: fat hoard still lands every color on a multiple of 12');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall gates green');
process.exit(failures ? 1 : 0);

})().catch(e => { console.error('FAIL gates crashed: ' + (e && e.message)); process.exit(1); });
