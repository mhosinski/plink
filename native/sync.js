#!/usr/bin/env node
// Sync the web game into the Capacitor shell. The repo root's index.html
// stays the single source of truth — this copies it (plus icons) into
// www/ untouched. Run before every native build:
//   npm run sync   (= node sync.js && npx cap sync)
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(__dirname, 'www');
fs.mkdirSync(www, { recursive: true });

const FILES = ['index.html', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
for (const f of FILES){
  fs.copyFileSync(path.join(root, f), path.join(www, f));
  console.log('synced', f);
}
// sw.js and manifest.webmanifest are deliberately not shipped in the
// shell: assets are local and index.html skips SW registration when
// window.Capacitor is present.
