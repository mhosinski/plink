# plink — a bead-sorting fidget

A cozy, mobile-first bead-sorting toy. A scoop of pony beads spills onto a felt tray;
drag them around to pre-sort, then into jars. Every jar plays its own note on an
ascending pentatonic scale (C–D–E–G–A, left to right), so sorting composes gentle
little melodies. A jar shelves when it holds 12 beads of a single color; mixed jars
sit full until you pour some beads back. Each cleared tray brings a bigger scoop and,
up to ten, a new bead color — with more colors than jars, you shelve to make room.
Scoops are composed so the player can never deadlock: after every pour, either
everything in play fits in the jars or some color has a full set of 12 available.
Every so often a **finishing scoop** arrives — exactly the beads that complete
every partial jar — and sorting it perfectly earns a **clean slate**: every jar
shelved, the tray clear, and a little fanfare to mark it.
No timer, no score pressure — progress persists in `localStorage`.

## Run it

It's a single self-contained `index.html` — no build step, no dependencies, no network
requests. Open the file in a browser, or serve it locally:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Host on GitHub Pages

```sh
git init
git add index.html README.md
git commit -m "plink: bead-sorting fidget"
gh repo create plink --public --source=. --push
gh api repos/{owner}/plink/pages -X POST -f 'source[branch]=main' -f 'source[path]=/'
```

Or without the `gh` CLI: push to any GitHub repo, then in the repo's
**Settings → Pages**, set the source to the `main` branch, root folder.
The game will be live at `https://<username>.github.io/plink/`.

## Notes

- Sounds are synthesized with the Web Audio API — there are no audio assets.
- Works with drag, tap-to-pick-up (tap a bead, then tap a jar), and keyboard
  (Tab to a bead, Enter to pick up, Tab to a jar, Enter to drop).
- Change your mind: tap a jar to take its last bead back, or press and hold
  to tip the whole jar back onto the tray (Shift+Enter on the keyboard).
- Respects `prefers-reduced-motion`.
