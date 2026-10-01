# Gravity Drift

One-tap orbital slingshot. Orbit a planet, **tap to launch**, catch the next one. Dodge asteroids and black holes,
collect stardust, chain fast landings into combos. Endless, with a seeded **Daily Challenge**.

Pure HTML5 canvas, no dependencies, no asset files (art + audio are procedural). Wrapped for Android with Capacitor (free).

## Run
    npm run dev          # http://localhost:8080  (or any static server on ./www)

## Build the Android app
    npm install
    npm run cap:add      # creates android/
    npm run cap:open     # Android Studio -> Build > Generate Signed Bundle (.aab) for Play Store

## Retention & monetisation built in
- Combo/streak scoring, close-call bonuses, sector milestones, haptics/SFX
- Daily reward (7-day streak), 3 daily missions, Daily Challenge (same level for everyone), share/challenge button
- Shop: 7 orbs, 5 worlds (soft currency) · Store: Remove Ads, Starter Pack, coin packs (₹49–₹329)
- Ads: rewarded **Continue**, **Double coins**, **Free stardust**; interstitial capped (every 3 runs, ≥75 s apart, never mid-run, off if Ads Removed)

## Plugging in real ads / IAP (when accounts are ready)
`www/game.js` talks to two optional adapters. Without them a demo overlay runs, so the whole flow is testable now.
```js
window.GameAds = { showRewarded: (placement) => Promise<boolean>, showInterstitial: () => Promise<void> };
window.GameIAP = { purchase: (productId) => Promise<boolean>, restore: () => Promise<string[]> };
```
Add `@capacitor-community/admob` (and set its AdMob app id in AndroidManifest) for GameAds and a Play Billing plugin (e.g. RevenueCat) for GameIAP.
Product ids: `remove_ads`, `starter`, `coins_s`, `coins_m`, `coins_l`.
