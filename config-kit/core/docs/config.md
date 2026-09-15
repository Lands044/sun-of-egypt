# Runtime config

The landing is driven by **`public/config.json`**. It is a plain static file: Vite
serves it at the site root in dev and copies it verbatim into `dist/` on build, so
it can be edited on a deployed site and the landing picks the change up on the next
page load — **no `npm run build`, no commands from `package.json`**.

```
public/config.json   →   dist/config.json   →   fetched at runtime
```

This document describes the **core kit** — the part that is the same on every
landing built with it. Game-specific config (the `game` block, extra sections
like `layout` or `sectors`, the devmenu fields for them) lives in the game's own
files and is documented separately per project — see `docs/config.game.md` if the
project has one, or the comments in `src/js/config/game.defaults.js`.

## Where the config comes from

Resolved in priority order on every page load (`src/js/config/config.js`):

| # | Source | Use |
|---|---|---|
| 1 | `window.LANDING_CONFIG` | a PWA host injects a config object before the bundle runs (name configurable, see below) |
| 2 | `?config=<url>` | per-link override, e.g. `?config=/configs/geo-br.json` |
| 3 | `config.json` | the default — the file in the public folder |
| 4 | built-in defaults | `src/js/config/defaults.js`, used if the fetch fails |

Anything the file omits falls back to the defaults, so a partial config is valid —
`{"sound":{"enabled":false}}` is enough.

> The injected-global name defaults to `LANDING_CONFIG`. If the PWA host expects a
> different name (chicken-road used `CHICKEN_ROAD_CONFIG`), pass it explicitly:
> `loadConfig({ injectGlobal: 'MY_CONFIG' })` and the matching option to
> `watchConfig(config, onChange, { injectGlobal: 'MY_CONFIG' })`.

## Core sections

These exist in `DEFAULT_CONFIG` regardless of game mechanics:

### `cta`
`url` and `target` (`_self` / `_blank`) for the popup button.

### `texts`
`actionButton`, `popupTitle`, `popupText`, `ctaButton`, `rotateNotice`. A game
typically adds more keys here for mechanic-specific labels.

### `sound`
`enabled` (bool), `volume` (0–1).

### `assets`
Each value is either a **built-in key** or a **URL**. Built-in keys are the file
names in `src/assets/img` and `src/assets/sound` without the extension. Anything
starting with `/`, `./`, `http://` or `https://` is used as-is, so custom art can
be dropped into the public folder:

```json
"assets": {
  "background": "/art/custom-bg.webp"
}
```

### `dev`
| Key | Meaning |
|---|---|
| `watch` | Poll `config.json` and re-render in place when it changes. |
| `watchInterval` | Poll interval, ms. |
| `menu` | Show the config editor panel. |

## Extending for a new mechanic

The core kit deliberately has no `game`/`layout`/`sectors`-shaped assumptions —
those depend entirely on what the landing plays like. A game adds its own section
the same way `game-template` does:

1. **`src/js/config/game.defaults.js`** (the game's own — named differently from
   the core kit's own `src/js/config/defaults.js` so the two files can sit next
   to each other without colliding) — spread the core `DEFAULT_CONFIG` and add a
   `game` block (and any other sections the mechanic needs):
   ```js
   import { DEFAULT_CONFIG as CORE_DEFAULTS } from '@js/config/defaults.js'
   export const DEFAULT_CONFIG = { ...CORE_DEFAULTS, game: { /* ... */ } }
   ```
2. **`src/js/config/normalize.js`** (or similar) — validate/clamp the new fields
   and register the function with the core module *before* `loadConfig()` runs:
   ```js
   import { setGameNormalizer } from '@js/config/config.js'
   setGameNormalizer((config) => { /* mutate and return config */ return config })
   ```
   The core `normalizeConfig()` always calls this hook last, after merging with
   defaults and clamping the generic `sound` fields. Leave it unregistered and it
   is the identity function — a config-only landing works with just the core.
3. **`public/config.json`** — add matching keys with real values (mirroring the
   defaults, same as chicken-road's original file did).
4. **`src/components/pages/index/render.js`** — read the new config and update the
   DOM. This is the one function the dev watcher re-runs on every edit; keep it
   idempotent (safe to call repeatedly on the same elements).
5. **Devmenu fields** (optional) — a `GAME_FIELDS` array in the same shape as
   `CORE_FIELDS` (see `src/js/config/devmenu.js`), concatenated in when calling
   `initDevMenu`:
   ```js
   const { initDevMenu, CORE_FIELDS } = await import('@js/config/devmenu.js')
   await initDevMenu(config, onApply, { fields: [...GAME_FIELDS, ...CORE_FIELDS] })
   ```

`game-template/` in this kit is a working, minimal example of all five steps —
copy it as the starting point for a new game rather than writing this from
scratch.

## Non-destructive normalization

When a config value is padded, clamped, or defaulted, prefer **padding without
trimming** and **clamping without deleting**. The devmenu panel saves back
whatever the normalized config renders — if normalization silently drops an
entry (e.g. pruning a list against a count that was just lowered), that entry is
gone from the file the next time the panel autosaves, even though the user only
changed an unrelated field. See `fitMultipliers` / the `crashes` handling in
chicken-road's `src/js/config/config.js` (git history) for a concrete instance of
this rule and why it mattered there.

## The config menu

A panel in the top-right of the page, for checking configs locally. Edit a field
and the landing re-renders immediately **and the change is written straight to
`public/config.json`**, so a refresh comes back in the state you left it. The
panel shows `сохранено <time>` under the fields when a write lands.

Saving goes through `POST /__config`, a dev-only Vite middleware
(`vite-plugins/config-writer.js`) that validates the JSON and writes via a temp
file + rename, so a bad payload or a crash mid-write cannot truncate the config.
It writes the file as fetched with your edits merged in, which keeps any
`$comment` documentation and any keys the panel does not manage.

`config.json` is excluded from Vite's watcher (`server.watch.ignored`, set up by
the install script), because a `.json` change otherwise triggers a full page
reload — the page applies config changes in place already, and a reload on every
keystroke would fight that.

**Download** still exports a copy. On a built preview there is no endpoint, so the
panel reports `не сохранено` and the edit stays in memory — but the panel is
dev-only and is stripped from `dist/` anyway.

It is **dev-only**. The whole module sits behind `import.meta.env.DEV`, which Vite
replaces with `false` at build time, so neither its code nor its CSS is present in
`dist/` — verify with `grep -r devmenu dist/`.

Collapse it from the header, or set `dev.menu` to `false`.

## One fixed form (viewport-unit scaling)

Carried over from chicken-road, and worth keeping on any new game built with this
kit: scale the whole scene from a single rule expressed in viewport units, with no
px breakpoints anywhere in the visual chain.

```scss
html { font-size: min(1.63vw, 1.07vh); }
```

Browser zoom resizes the *CSS* viewport (200% zoom halves it), so anything
measured in vw/vh keeps the exact same fraction of the window at every zoom
level, while px values and px-based media queries would not — they would make
the layout visibly shift or flip breakpoints as the user zooms. Pick the two
coefficients so the aspect-ratio-driven `min()` favors the vw term in portrait and
the vh term in landscape, verify by testing at a few zoom levels and aspect
ratios, and keep any CSS added later in `em`/`vh`/`vw`.

## Adding a new option to an existing game

1. Add the default to the game's `src/js/config/game.defaults.js`.
2. Add it to `public/config.json`.
3. Validate it in the game's normalizer (`setGameNormalizer` callback).
4. Apply it in `render.js` (or read it in the game class).
5. Optionally add a row to the game's `GAME_FIELDS`.
