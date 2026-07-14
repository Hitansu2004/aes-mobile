`Header.js` and `BottomNav.js` (`../../aes-frontend/src/components/Header.js`,
`.../BottomNav.js`) were deliberately **not** ported.

`Shell.js`'s `NO_CHROME_PREFIXES` list (`../../aes-frontend/src/components/Shell.js`)
covers `/`, `/login`, `/services`, `/ops`, `/crm`, `/engineer`, `/admin`,
`/notifications`, `/quotes`, `/dashboard`, `/tickets`, `/installations` and
`/account` — i.e. every route in this app's complete source inventory. Every
page therefore renders its own `RoseShell` sidebar/topbar instead, so
`Header`/`BottomNav` never actually render on the web and are dead code.
Porting them would have added two files nobody would ever see.

This app's shell (`AppShell.tsx`, `Sidebar.tsx`, `GlassTopBar.tsx`,
`BottomNav.tsx`, `Drawer.tsx`) is the RN equivalent of `RoseShell.js`, built
in Phase 5 — not a port of the legacy `Header`/`BottomNav`.
