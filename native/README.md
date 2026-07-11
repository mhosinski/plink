# plink native shells

Capacitor wrappers that ship the exact same `../index.html` as native
iOS and Android apps. One codebase, thin shells: the repo root stays the
single source of truth, and `sync.js` copies the game (plus icons) into
`www/` before every native build. The service worker is web-only —
`index.html` skips registering it when `window.Capacitor` exists.

Pinned to the Capacitor 7 line (Capacitor 8's CLI requires Node >= 22;
this repo builds on Node 20).

```sh
npm install        # once per machine
npm run sync       # copy game into www/ and sync both platforms
npm run ios        # sync + open Xcode
npm run android    # sync + open Android Studio
```

## iOS — remaining setup (plink-6wl.2)

1. Install Xcode from the App Store, then:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
2. CocoaPods is already installed (brew) and pods are resolved.
3. `npm run ios`, select your signing team in Xcode, build to a device.
4. Set portrait-only orientation and status bar style in the project
   settings; launch screen background is #5c3d26.
5. Device installs for the family need an Apple Developer Program
   membership ($99/yr); TestFlight is the sane distribution path.

## Android — remaining setup (plink-6wl.3)

1. Install Android Studio (bundles the SDK and Gradle toolchain).
2. `npm run android`, build an APK, install directly on devices —
   no store account required for direct sharing.

## Player save migration

Saves live in each webview's own localStorage, so the browser save does
not automatically appear in the native app. The in-game backup covers
this: tap the stats line in the browser version, **copy backup**, then
**restore backup** inside the app.
