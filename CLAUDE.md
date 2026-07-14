# AES Mobile — Claude Code Context

## Project

React Native (Expo SDK 57, Expo Router v6, TypeScript strict). Ships to
**both** Google Play and the Apple App Store from one codebase.

This repo is a sibling of the other two AES repos, not nested under them:

```
Poc java to node/
├── aes-frontend/        ← Next.js 16 web app — SOURCE OF TRUTH (read-only)
├── aes-backend-node/    ← Node 22 + Express + Prisma API (mobile-ready)
├── aes-mobile/          ← THIS REPO
├── AES-MOBILE-REACT-NATIVE-MASTER-PROMPT.txt      ← the 22-phase build guide
└── AES-BACKEND-MOBILE-READINESS-PROMPT.txt        ← backend fix-pack (already applied)
```

All relative paths below (`../aes-frontend`, `../aes-backend-node`) are
correct from inside `aes-mobile/`.

## THE SOURCE OF TRUTH

`../aes-frontend/` is the source of truth for **every** screen, every
string, every colour, every card, every empty state. ALWAYS read the
corresponding web file(s) before writing a screen.

```
┌────────────────────────────────────────────────────────────────────┐
│  IF IT IS NOT IN THE WEB SOURCE, IT DOES NOT GO IN THE APP.        │
│  IF IT IS IN THE WEB SOURCE, IT GOES IN THE APP — EXACTLY.         │
│                                                                    │
│  Every string is copied VERBATIM (em-dashes, ellipses "…", ₹,      │
│  exact capitalisation). Every colour comes from the token table.   │
│  Every card keeps its layout, order, padding, radius, shadow.      │
│  Every empty / loading / error state is reproduced.                │
└────────────────────────────────────────────────────────────────────┘
```

The one thing you ADD beyond the web: **motion** (spring physics,
gesture-driven sheets, haptics, skeleton shimmer, list stagger). Motion is
additive — it never changes layout, colour, copy or information
architecture.

Write for **iOS and Android from line one** — one codebase, both stores.
No `Platform.OS === 'android'` forks except where genuinely required
(elevation vs shadow, ripple vs opacity, status bar). Also reproduce the
web's real **tablet** layout (769–1023px: persistent 200px sidebar, no
bottom nav) — don't just stretch the phone layout.

Backend: `../aes-backend-node/` — already mobile-ready (device tokens,
uploads, maps proxy, app-config, push). See its own `CLAUDE.md` for the
"Mobile Client Contract" section.

## Rules — NEVER break these

1. DO NOT run `git commit` / `git push` without explicit instruction.
2. DO NOT create placeholder or "TODO" screens. Every file is real, finished code.
3. DO NOT invent copy. Every user-facing string is copied VERBATIM from the
   web source — including em-dashes (—), ellipses (…), ₹ symbols and
   capitalisation.
4. DO NOT hand-pick a colour. Every colour comes from `src/theme/tokens.ts`.
   If a colour you need is not in tokens.ts, it did not exist in the web app.
5. DO NOT use `any`. TypeScript strict, always (`unknown` + type guards).
6. DO NOT use `localStorage` / `sessionStorage` / `window` / `document` /
   `navigator`. None of them exist in React Native. Use `src/lib/storage.ts`.
7. DO NOT change the API contract. The backend is fixed; the app adapts.
8. ALWAYS support BOTH light and dark themes on every screen.
9. ALWAYS support phone AND tablet layouts (see `useBreakpoint()`).
10. ALWAYS reproduce loading, empty AND error states — the web app has all three.
11. ONE phase per session, and `/clear` before starting the next one — the
    web source files are large (ticket wizard alone is 1,837 lines) and a
    stale context window burns quota fast.
12. **Do not start Phase 2 or later without the user's explicit go-ahead.**
    Phase 0 (scaffold) and Phase 1 (design tokens/theme/fonts) are complete;
    everything after that is the user's call.

## Target stack (web → mobile)

| Web (Next.js 16)                 | Mobile (React Native / Expo)                  |
|-----------------------------------|------------------------------------------------|
| Next.js App Router                | Expo Router v6 (file-based, same URL shape)    |
| React 19                          | React 19 + React Native 0.86 (Expo SDK 57)     |
| CSS Modules + CSS variables       | StyleSheet + typed token/theme system          |
| `globals.css` `:root` tokens      | `src/theme/tokens.ts` (light + dark objects)   |
| `[data-theme="dark"]`             | `ThemeProvider` + `useTheme()`                 |
| framer-motion                     | react-native-reanimated 4 + Moti               |
| lucide-react                      | lucide-react-native (same icon names)          |
| Google Fonts `@import`            | `@expo-google-fonts/*` + `expo-font`           |
| `localStorage` (tokens)           | expo-secure-store (encrypted keychain)         |
| `sessionStorage` (drafts)         | `@react-native-async-storage/async-storage`    |
| `@stomp/stompjs` + sockjs-client   | `@stomp/stompjs` over raw WebSocket            |
| `<img>`                           | `expo-image` (caching, blurhash, transitions)  |
| CSS `linear-gradient`             | `expo-linear-gradient`                         |
| CSS `backdrop-filter: blur()`     | `expo-blur` (`<BlurView>`)                     |
| inline `<svg>` (BottomNav)        | `react-native-svg`                             |
| Google Maps JS SDK                | `react-native-maps` + backend Places proxy     |
| `window.history` wizard steps     | Reanimated step transitions + hardware back    |
| Polling notifications             | `expo-notifications` (real push) + polling     |
| n/a                                | `expo-haptics`, `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `react-native-safe-area-context` |

**Why Expo, not bare RN:** EAS Build compiles the iOS binary in the cloud
(no Mac needed) and EAS Submit uploads to both stores. `expo-notifications`
gives one push API for FCM + APNs.

**Why Moti over raw Reanimated:** Moti's API is deliberately
framer-motion-shaped (`from`/`animate`/`exit`/`transition`/`delay`), so web
`variants`/`initial`/`animate`/`staggerChildren` port almost 1:1. Drop to
raw Reanimated only for gesture-driven work (sheets, swipes, wizard slide).

## Web → Mobile mapping cheatsheet

- CSS Module class            → StyleSheet entry using theme tokens
- framer-motion `motion.div`  → Moti `<MotiView>` (from/animate/exit/transition)
- `variants` + `staggerChildren` → Moti `delay: index * 60`
- `lucide-react`              → `lucide-react-native` (same icon names)
- `<img src>`                 → `<Image source={{uri}} />` from `expo-image`
- CSS `linear-gradient`       → `<LinearGradient>` (expo-linear-gradient)
- CSS `backdrop-filter: blur` → `<BlurView>` (expo-blur)
- `<button>`                  → `<Pressable>` + Moti scale on press
- `:hover`                    → DROP IT (no hover on touch); use `:active`/press
- `:active { scale(0.98) }`   → Moti/Reanimated press scale — KEEP, it's the
                                 app's tactile signature
- `localStorage aes_token`    → expo-secure-store (encrypted, key: `aes_token`)
- `sessionStorage draft`      → AsyncStorage (`aes_install_draft_v1`,
                                 `aes_service_draft_v1`)
- `window.history.pushState`  → wizard step state + hardware back handler
- `router.push/replace`       → expo-router `useRouter()` (same method names)

## Design system — copy these values exactly

Extracted verbatim from `../aes-frontend/src/app/globals.css`. Brand:
**Antique Gold on Deep Navy over Warm Cream**. Never hand-pick a hex.

- **Primary/Navy**: `#0B1A2C` (chrome, strong contrast)
- **Secondary/Antique Gold**: `#C9A84C` — the CTA/action colour, but it is
  a FILL colour, not text. Gold **text/icons** on a light surface use the
  separate token `secondaryInk` (`#8F701E`) — `secondary` is unreadable as
  text. Text ON a gold fill is NAVY `onSecondary` (`#0B1A2C`), never white.
- **Surfaces**: warm cream `#faf9f5` (light) / `#0B141E` (dark)
- Full light/dark palettes, badge fg/bg pairs, SLA tones, AMC gradient,
  header glass, and blueprint-grid decoration values are in the master
  prompt (`../AES-MOBILE-REACT-NATIVE-MASTER-PROMPT.txt`, "THE DESIGN
  SYSTEM" section) — read that section in full before building
  `src/theme/tokens.ts` in Phase 1. Do not transcribe from memory; read the
  actual `globals.css`.

**Typography** — the serif headings are the entire personality of this
brand:
- `display` = Cormorant Garamond (weights 500/600/700) — ALL headings
- `body` = Inter (300–800)
- `mono` = JetBrains Mono (400/500/600) — ticket numbers, splash
- React Native does **not** synthesise font weights on Android — load each
  weight as its own family and select the FAMILY, never the weight.

**Spacing**: 4px baseline — `1:4 2:8 3:12 4:16 5:20 6:24 7:28 8:32 10:40
12:48 16:64`. **Radius**: `xs:4 sm:8 md:12 lg:16 xl:24 2xl:28 full:9999`.

**Shadows**: iOS uses `shadowColor/Offset/Opacity/Radius`; Android uses
`elevation` (no colour, no offset). One `shadow(level)` helper in
`tokens.ts` emits the right object per `Platform.OS` — never a raw shadow
in a screen file. The gold CTA glow has no true Android equivalent;
approximate with `elevation` + `shadowColor: '#C9A84C'` and document the
compromise in code.

**Breakpoints** — reactive to rotation via `useWindowDimensions()`, never a
module-level constant:
- **phone** ≤768px — glass top bar (60px) + glass bottom nav (72px,
  radius 18/18/0/0) + off-canvas drawer sidebar; content max 480px, pad 16px
- **tablet** 769–1023px — PERSISTENT 200px sidebar, NO bottom nav, NO
  mobile top bar; desktop top bar (80px); content max 760px, pad 24px;
  headline-xl grows to 36/44
- **large** ≥1024px — sidebar 240px (260px ≥1440px); content max 980px,
  pad 32px

## Complete source inventory (definition of done)

**22 screens, 16 UI components + shell, 11 state/data modules.** If the
final app has 21 screens, it's wrong — count them. Full manifest (routes,
line counts, roles, which phase builds which file) is in the master prompt
under "COMPLETE SOURCE INVENTORY" — read it before starting any phase from
2 onward so you know exactly which web file(s) that phase ports.

Two web files are explicitly marked for **replacement**, not porting:
- `hooks/useGoogleMaps.js` — browser-only → replace with `react-native-maps`
  + the backend Places proxy (`../aes-backend-node` `maps.routes.ts`)
- `lib/websocket/stompClient.js` — SockJS → replace with raw WebSocket
  STOMP (`@stomp/stompjs` connecting straight to `/ws/websocket`, no SockJS
  session protocol)

## Project structure

```
aes-mobile/
├── CLAUDE.md
├── app.json  babel.config.js  tsconfig.json  package.json  .env
├── assets/                     (icon, adaptive-icon, splash, fonts)
└── src/
    ├── app/                     ← Expo Router, mirrors Next.js routes 1:1
    │   ├── _layout.tsx          ← root: fonts, providers, splash, StatusBar
    │   ├── index.tsx            ← "/" splash redirector
    │   ├── login.tsx
    │   └── (app)/                ← authenticated group; renders AppShell
    │       ├── dashboard.tsx  notifications.tsx  account.tsx
    │       ├── services/{index,select,amc,products,error-codes,installation,ticket}.tsx
    │       ├── tickets/{index,[ticketNumber]}.tsx
    │       ├── installations/{index,[requestNumber]}.tsx
    │       ├── crm.tsx  ops.tsx  engineer.tsx
    │       └── admin/{index,revenue,coupons}.tsx
    ├── theme/                    ← tokens.ts, ThemeProvider.tsx, typography.ts, shadow.ts
    ├── components/
    │   ├── shell/                ← AppShell, Sidebar, GlassTopBar, BottomNav, Drawer, Splash
    │   ├── ui/                   ← the 16 ported components
    │   └── primitives/           ← Text, Button, Card, Input, Badge, Chip, Skeleton, Sheet, …
    ├── context/                  ← AuthContext, NotificationContext, ToastContext
    ├── store/                    ← installationStore, serviceStore
    ├── hooks/                    ← useBreakpoint, useSlaCountdown, useStompTopic, useHaptics
    ├── lib/                      ← api.ts, constants.ts, aesCatalog.ts, errorCodes.ts, stomp.ts, storage.ts, push.ts
    └── types/
```

Route parity is deliberate: `/tickets/[ticketNumber]` on the web maps to
`app/(app)/tickets/[ticketNumber].tsx` here — same URL, same param name.
Deep links from push notifications work with zero extra routing code.

## Roles

`CUSTOMER · CRM_AGENT · OPS_MANAGER · SITE_ENGINEER · SERVICE_MANAGER ·
ADMIN · SUPER_ADMIN`

## Environment

`.env` uses `EXPO_PUBLIC_*` (Expo reads these at build time):
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080/api/v1
EXPO_PUBLIC_WS_URL=ws://10.0.2.2:8080/ws/websocket
```
`10.0.2.2` targets the Android emulator's host machine. Swap to your LAN IP
(e.g. `192.168.1.x`) for a physical device, or `localhost` for the iOS
simulator only.

## Phase map (22 phases — one per session, `/clear` between each)

| # | Phase                                   | Status |
|---|-------------------------------------------|--------|
| 0 | Scaffold + CLAUDE.md                       | ✅ done |
| 1 | Design tokens + theme + fonts              | ✅ done |
| 2 | Primitives (Text/Button/Card/Input/…)      | ✅ done |
| 3 | API client + constants + catalogs          | ✅ done |
| 4 | Storage + STOMP + Auth/Notif/Toast context | ✅ done |
| 5 | AppShell: sidebar, glass bars, splash      | ✅ done |
| 6 | The 16 UI components                       | ✅ done |
| 7 | Login                                       | ✅ done |
| 8 | Customer dashboard                          | ✅ done |
| 9 | Services hub + AMC + Products + Errors      | ✅ done |
|10 | ⭐ Installation wizard (5 steps)            | ✅ done |
|11 | ⭐ Service-ticket wizard (4 steps)          | ✅ done |
|12 | Tickets list + ticket detail                | ✅ done |
|13 | Installations list + project detail         | ✅ done |
|14 | Account + Notifications                     | ✅ done |
|15 | ⭐ CRM dispatch pool                        | ✅ done |
|16 | Ops triage board                            | ✅ done |
|17 | Engineer dashboard                          | ✅ done |
|18 | ⭐ Admin escalation + Revenue + Coupons     | ✅ done |
|19 | Push notifications + deep links             | ✅ done |
|20 | Motion & haptics polish pass                 | ✅ done |
|21 | Tablet + iOS audit, a11y, error boundary     | ✅ done |
|22 | Icons, splash, EAS build, store submit       | ✅ app-side done; store submission is manual — see `RELEASE-CHECKLIST.md` |

**Note (2026-07-13):** this table previously lagged the real repo state by
several sessions — phases 2/10/11/13/16/19/20 were marked "not started"
while finished, real code already existed on disk for all of them. Always
verify with `find src -type f` / reading the actual files before trusting
this table, per the recurring lesson in the project memory.

⭐ = large phase, start with a full context window. Full per-phase
instructions (what to read, what to build, verification steps) live in
`../AES-MOBILE-REACT-NATIVE-MASTER-PROMPT.txt` — read the relevant phase
section before starting it.

**Do not begin Phase 7 or later without explicit user instruction.**

## Definition of done for any screen (Phase 7 onward)

- [ ] Every string matches the web source character-for-character
- [ ] Every colour comes from `tokens.ts`
- [ ] Light + dark both correct
- [ ] Phone + tablet both correct
- [ ] Loading, empty and error states present
- [ ] Entry animation + press feedback + haptic on primary actions
- [ ] `npx tsc --noEmit` clean
