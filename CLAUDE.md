# League Sim: project handover

A pure-simulation football league game. The user sets up clubs and players, then watches the world build itself: seasons, drafts, trades, awards, retirements and a Hall of Fame. No currency, no match viewer. Matches are simulated in the background.

## Current state

- The game lives in one file: `index.html` in `~/Documents/league-sim-app` (this folder replaced the numbered `league-sim-N.html` copies in Downloads) (HTML, CSS and vanilla JS, no build step, no dependencies apart from optional Google Fonts with fallbacks).
- It runs offline by double-clicking the file.
- Saves are JSON files written with the File System Access API (Chrome and Edge overwrite the same file), with a download fallback. A backup also goes to `localStorage` under `leaguesim-backup`.
- Older saves must always keep loading. All schema changes go through `migrate(d)`, which fills in missing fields with defaults.
- Saves are compact: `saveText()` runs `packState()`, which turns career rows and archived results into short arrays (marked `packed:1`) and writes JSON without whitespace. `migrate()` calls `unpackState()` first, so in memory everything stays as objects. New fields on career rows or results are safe: rows with unknown keys are left as objects.
- Keep the save small as features grow: about 30KB per season for a 10 club 11 a side league. Store ids, not copies of names, wherever history allows.

## Architecture notes

- Global `state` holds the league: `teams`, `players` (active), `retired` (retired and released players, kept for history), `fixtures` (current season rounds), `history` (one entry per finished season), `results` (archived matches for head to head), `trades`, `draftHistory`, `draft` (active draft or null), `hof`, `settings`.
- `render()` rebuilds the whole view from `state`. Long lists are paged (the players list shows 50 at a time via `ps.lim`). Views: table, fixtures, players, clubs, `club:<id>`, `player:<id>`, draft, trades, history, hof, settings.
- Events use delegated `data-act` click handlers and `data-*` change and input handlers at the bottom of the script.
- `persist()` marks unsaved changes and writes the browser backup.
- Formats: 5, 7 and 11 a side (`FORMATS`), each with lineup shape, squad shape, match length and base goal rate.

## Simulation

- `lineup()` picks the strongest available side (injured players excluded, out of position players penalised).
- `simMatch()` uses Poisson goals from attack against defence, then assigns scorers and assisters, match ratings out of 10, player of the match, clean sheets and injuries.
- `endSeason()` archives the season (table, matchday positions, awards, results), pushes career rows, ages players, runs progression, handles retirements and youth replacements, runs the end of season trade window, inducts the Hall of Fame every third season, then opens the yearly draft.
- Draft: lowest finisher picks first. The opening draft (new league option) is a snake draft over a big pool, with a setup stage where the pool can be edited first. AI picks fill starting positions, then bench, with small per-club positional tastes.
- AI trades: 1 for 1 swaps that fix each club's weakest position at similar value. Windows run only at the end of the season and after the draft. Players traded recently are excluded, and each pair of clubs trades once per window.
- Awards each season: MVP (best average rating among regulars), Golden Boot, Golden Glove (keeper clean sheets), Rookie (first season, age 23 or under).
- Hall of Fame: legacy points from apps, goals, assists, clean sheets, titles and awards. Up to two retired players per class, one class every three seasons.

## Visual style

- The sidebar is drawn as a pitch: a chalk outline, a penalty box around the league name, one mowing stripe per menu item, the halfway line and centre circle above the sim buttons, and a penalty box around the file buttons.

- Pixel art engine drawn onto canvas at low resolution and shown with `image-rendering: pixelated`: badges (`pxBadge`), kits (`pxKit`), league trophy plate (`pxPlate`), championship rings (`pxRing`), award trophies on plinths (`pxAward`), position charts (`pxChart`). A 3x5 pixel font is in `FONT`, with wide 5x5 glyphs for M, N, V and W in `FONTW`.
- A Smooth setting falls back to the earlier vector SVG art.
- Ring designer settings: size, metal, stones, centre piece, side panel and banner text.
- Theme: light, dark or match device, colour presets plus custom sidebar and accent colours. 28 nations with SVG flags and name pools per nation.

## Writing style for UI text

- Plain, natural English. No em dashes. Simple words.

## Ideas not built yet

- News feed with auto-written headlines.
- Knockout cup alongside the league.
- Second division with promotion and relegation.
- Hidden potential and player traits.
- Team of the season, streak records, hat-tricks, derbies.
- Sim several seasons at once, and a season review screen.

## Installable app

- The folder is an installable web app for Chrome on the user's Mac, for personal use only.
- `manifest.webmanifest` holds the name, colours and icons. Icons are pixel art PNGs in `icons/`.
- `sw.js` is the offline worker. The game page is network first with a 4 second fallback to cache, so an update is just uploading a new `index.html`. Fonts and other files are cached and refreshed in the background. Bump `CACHE` only if cached files other than the page need forcing.
- The worker registers only over http(s), so double-clicking `index.html` still works.
- Save files stay on disk through the File System Access API. The `localStorage` backup is tied to the web address, so the installed app has its own backup slot.
