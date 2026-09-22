# Config Kit

```bash
node config-kit/install.mjs .
```

Runtime-config system extracted from this project (Chicken Road), generalized so
it can be dropped into **any other landing built on the same FLS/Vite template** —
regardless of the game mechanic. Same idea as here: the landing reads
`public/config.json` on every load, a dev-only panel edits it in place and writes
it back to disk, and nothing about the game (texts, sound, payouts, art) requires
a rebuild to change.

## What's in here

```
config-kit/
  core/                          framework — copied as-is, mechanic-agnostic
    src/js/config/
      config.js                  load/save/watch/merge/normalize engine
      defaults.js                core defaults: cta, texts, sound, assets, dev
      assets.js                  built-in art/audio registry + URL passthrough
      devmenu.js                 dev-only config editor panel (generic fields)
    vite-plugins/
      config-writer.js           dev-only POST /__config endpoint
    docs/
      config.md                  full reference + "extending for a new mechanic"

  game-template/                 starter game — copied, then YOU rewrite it
    public/config.json           example config for the placeholder mechanic
    src/js/config/
      game.defaults.js           adds a `game` block on top of core defaults
                                  (named differently from core/'s defaults.js —
                                  same install path, would otherwise collide)
      normalize.js                validates/clamps the `game` block
    src/components/pages/index/
      index.html, index.js, index.scss   "click to reveal a win/loss" placeholder
      render.js                  config -> DOM (the file to rewrite per game)
      devmenu.fields.js          game-specific devmenu fields

  install.mjs                    installer script (see below)
  README.md                      this file
```

The split matters: **core/** is the same on every project and gets overwritten on
every install run. **game-template/** is a starting point — the installer copies
it once and then it's yours to rewrite for the actual mechanic (reels, a wheel,
cards, whatever the new landing plays like).

## Install into a new project

The target project must be on the same template base (`vite.config.js` +
`template.config.js` + `template_modules/`) — the installer patches
`vite.config.js` textually and expects those anchors to exist.

```bash
node config-kit/install.mjs /path/to/other-project
```

This:
1. Copies `core/**` into the target, always overwriting (it's framework code).
2. Copies `game-template/**` into the target, **skipping any file that already
   exists** (so re-running it after you've started customizing the game doesn't
   clobber your work). Pass `--force` to overwrite those too — e.g. for a truly
   fresh start.
3. Patches the target's `vite.config.js`: serves `public/` at the site root,
   mounts the config-writer middleware, excludes `config.json` from the HMR
   watcher, and skips a redundant full-reload on the panel's own writes.
4. Checks the target's `template.config.js` has the `@js`/`@styles`/`@img`/
   `@sound` aliases the kit imports through, and warns (doesn't write) if not.

Safe to re-run — every step checks for its own marker first. Review `git status` /
`git diff` in the target project afterward; the installer never touches git
itself.

## After installing

1. Drop placeholder art into `src/assets/img` (`logo.webp`, `actor.webp`,
   `actor-lose.webp`, `background.webp`) and audio into `src/assets/sound`
   (`click.mp3`, `reveal.mp3`, `win.mp3`, `lose.mp3`) — or just repoint
   `public/config.json`'s `assets` block at whatever files/URLs you already have.
2. `npm run dev` — open the page. A panel appears top-right; editing a field
   there rewrites `public/config.json` and the page re-renders live.
3. Rewrite `src/components/pages/index/render.js` and the `Game` class in
   `index.js` for the actual mechanic, following **"Extending for a new
   mechanic"** in `core/docs/config.md` (also copied into the target as
   `docs/config.md`). The five-step pattern — defaults, normalizer, config.json,
   render, devmenu fields — is the same regardless of what the game does.
4. `npm run build` — verify `dist/config.json` exists. Whether the panel itself
   ships in `dist/` is a deliberate choice in `index.js` (see "The config menu"
   in `docs/config.md`): `game-template` ships it — in production it edits
   `localStorage` instead of `public/config.json`, since there's no server to
   write to — so `grep -r devmenu dist/` finding matches there is expected, not
   a bug. Switch the `index.js` condition to `import.meta.env.DEV &&
   config.dev.menu` for the original dev-only behavior instead, where that grep
   empty is the thing to verify.

## Why this shape

The original chicken-road implementation hard-coded seven road sectors into HTML
and SCSS, baked game parameters into `data-*` attributes, and had a `spins` field
that silently disabled the crash mechanic it was supposed to gate (documented in
`core/docs/config.md`, under "core sections" — kept as a cautionary note, not
reproduced here). Turning it into a config-driven landing fixed those bugs as a
side effect and, more importantly, decoupled "what the landing needs to run" from
"what this specific game looks like" — which is exactly the boundary this kit
draws: `core/` owns the former, a per-game `game.defaults.js` + `normalize.js` +
`render.js` own the latter.
