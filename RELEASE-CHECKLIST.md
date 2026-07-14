# AES Mobile — Release Checklist

Phase 22 of `../AES-MOBILE-REACT-NATIVE-MASTER-PROMPT.txt`, captured here so
every future release is mechanical instead of re-derived from memory.

## Status as of 2026-07-13

| Item | Status |
|---|---|
| App icon, adaptive icon (fg/bg/monochrome), splash, favicon | ✅ done (`assets/`) |
| `app.json` permissions with honest rationale strings | ✅ done |
| `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` | ✅ done |
| Android `intentFilters` / iOS `associatedDomains` for deep links | ✅ done |
| `eas.json` build + submit profiles | ✅ scaffolded — **placeholder values, see below** |
| `extra.eas.projectId` in `app.json` | ❌ **not set** — required before push tokens work in a production build |
| EAS CLI login / `eas build:configure` | ❌ not run — needs your Expo account |
| First preview/production builds | ❌ not run |
| Play Store listing / submission | ❌ not started |
| App Store listing / submission | ❌ not started |
| Privacy Policy / Terms of Service pages reachable | ⚠️ **unverified** — URLs are guesses, see below |
| Delete-account backend endpoint | ❌ **does not exist** — see below |

None of the store-submission steps below can be run by an automated agent —
they require your Apple/Google developer accounts, credentials, and
judgment calls (pricing, listing copy, content rating answers). This file
is the checklist to work through by hand.

---

## Known blockers to resolve before you can actually submit

1. **`extra.eas.projectId` is missing from `app.json`.** Running
   `eas init` (or `eas build:configure`) the first time will create the
   project on your Expo account and write this automatically. Do this
   before your first build — `expo-notifications`' `getExpoPushTokenAsync()`
   needs it in production or push token retrieval will fail silently.
2. **Privacy Policy / Terms of Service URLs are unverified guesses**
   (`src/lib/constants.ts` → `PRIVACY_POLICY_URL` / `TERMS_OF_SERVICE_URL`,
   currently `arialengineering.com/privacy-policy` and `/terms-of-service`).
   No hosted privacy policy or ToS page was found anywhere in
   `aes-frontend/` or `aes-backend-node/` at port time. **Visit both URLs
   in a browser and confirm they 200** before submitting — Apple Guideline
   5.1.1(v) and the Play Data Safety form both require a reachable policy.
   If they don't resolve, you need to host one first.
3. **No delete-account backend endpoint exists.** `aes-backend-node` has
   no `DELETE /users/me` (or equivalent). The account screen's "Delete my
   account" row currently opens a pre-filled `mailto:support@arialengineering.com`
   as a stopgap. Apple Guideline 5.1.1(v) requires account deletion to be
   reachable **in-app** for any app with account creation — a mailto
   stopgap is a near-certain rejection reason on iOS review. Build the
   real endpoint + wire the button to it before submitting to the App
   Store. (Google Play's account-deletion requirement can be satisfied by
   an external web form, so this blocks iOS specifically, not Android.)
4. **`eas.json`'s `preview`/`production` API URLs are placeholders**
   (`https://staging.arialengineering.com`, `https://api.arialengineering.com`)
   — invented to match the domain already used for product photos, **not
   confirmed to exist**. Point these at your real staging/production API
   hosts before running a preview or production build, or the app will
   fail to connect.
5. **`submit.production.ios` in `eas.json` has placeholder
   `appleId`/`ascAppId`/`appleTeamId`**, and `submit.production.android`
   points at `./play-key.json`, which does not exist yet. Fill these in
   (or pass them via `eas submit` prompts) when you're ready to submit.

---

## 1. First builds

```bash
npm install -g eas-cli
eas login
eas build:configure          # writes extra.eas.projectId into app.json
eas build --profile preview --platform android    # → APK you can sideload
# Install it on a REAL phone. Walk every flow. Only then:
eas build --profile production --platform android # → AAB for Play
eas build --profile production --platform ios     # → IPA (built on EAS's Macs, no Mac needed locally)
```

## 2. Play Store (first-time checklist)

- [ ] Google Play Developer account ($25, one-time)
- [ ] Play Console → create the app → upload the AAB to **Internal testing** first. Never go straight to production.
- [ ] Privacy policy URL — mandatory, must be reachable (see blocker #2 above)
- [ ] Data Safety form — declare exactly what's collected: name, email, phone, approximate + precise location, photos. Must match actual permissions or risks suspension.
- [ ] Store listing: title, short description (80 chars), full description, 512×512 icon, 1024×500 feature graphic, ≥2 phone screenshots, ≥1 tablet screenshot (the app has a real tablet layout — use it)
- [ ] Content rating questionnaire
- [ ] Target audience: 18+ (no child-directed content)
- [ ] ⚠️ New personal developer accounts must run a **12-tester closed test for 14 days** before production access is granted — start this immediately, it's a hard 14-day wall

## 3. App Store (first-time checklist)

- [ ] Apple Developer Program membership ($99/yr)
- [ ] App Store Connect → create the app → bundle ID must match `app.json` (`com.arialengineering.aes`)
- [ ] `eas submit --platform ios` → TestFlight → test on a real device
- [ ] App Privacy questionnaire (same honesty rule as Google)
- [ ] ⚠️ Account deletion must be reachable **in-app** (Guideline 5.1.1(v)) — see blocker #3, this is currently a mailto stopgap and needs a real endpoint first
- [ ] A demo account (login + password) in App Review notes — the app is invite-only, reviewers can't sign up. Give them a CUSTOMER account with real seeded tickets and installations.
- [ ] Screenshots: 6.7" iPhone AND 12.9" iPad (required because `supportsTablet` is true)
- [ ] Support URL + marketing URL
- [ ] Sign-in with Apple: not required (app uses phone/email + password, no other third-party social logins)

## 4. Pre-submit smoke test — on a real device, on a production build

- [ ] Login as each of the 7 roles → each lands on the right home screen
- [ ] Raise a P1 ticket (free) end to end
- [ ] Raise a P3 ticket → address picker → live price → payment → success
- [ ] Attach 4 photos → they upload → they appear on the ticket detail
- [ ] Complete the 5-step installation wizard
- [ ] Kill the app → fire a push → tap it → it opens the right ticket
- [ ] Airplane mode → clear error states, no infinite spinners
- [ ] Background for 5 min → resume → the WebSocket reconnects, live updates resume
- [ ] Rotate a tablet through every screen
- [ ] Dark mode on every screen
- [ ] Hardware back from every screen behaves correctly

## 5. Final definition of done (from the master prompt)

- [ ] 22 screens exist — count them against the source inventory table
- [ ] Every user-facing string matches the web source character for character (spot-check 20 at random)
- [ ] Every colour traces back to `tokens.ts` — `grep -rn "#" src/ --include=*.tsx` outside `theme/` returns zero hardcoded hex values
- [ ] Light and dark both correct on all 22 screens
- [ ] Phone and tablet both correct on all 22 screens, in both orientations
- [ ] Cormorant Garamond renders as a serif for every heading
- [ ] Gold text uses `secondaryInk` (`#8F701E`) on light surfaces, never `#C9A84C`
- [ ] Text on gold fills is navy (`#0B1A2C`), never white
- [ ] Push notifications work from a killed app and deep-link correctly
- [ ] The WebSocket survives backgrounding and reconnects
- [ ] Photos upload via `/uploads`, not base64
- [ ] No Google API key exists anywhere in the app bundle
- [ ] Every animation runs at 60fps on the UI thread
- [ ] `npx tsc --noEmit` → zero errors
- [ ] The same codebase builds and runs on both Android and iOS
