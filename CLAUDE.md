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
- `render()` rebuilds the whole view from `state`. Long lists are paged (the players list shows 50 at a time via `ps.lim`). Views: table, fixtures, players, clubs, `club:<id>`, `player:<id>`, draft, trades, cup, history, `review:<season>`, hof, settings.
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

## Domestic cup

- `state.cup` holds the current season's cup: `sched` (the league matchday index each round plays after), `rounds` (ties and byes), `cur` and `winner`. Each round is drawn when the one before it is played. The final follows the last matchday on neutral ground (home advantage set to 0 for that match).
- Byes go to last season's top finishers. Level ties go to a shootout (`shootout()`).
- `simCupTie()` runs `simMatch()` and then moves the apps and goals into `s.capps` and `s.cgoals`, so league stats, averages and awards only count league games. Injuries carry over.
- `endSeason()` stores `h.cup` (`cupSummary()`), archives cup ties in `results` with `c:1`, and `ensureCup()` draws next season's cup. `ensureCup()` also runs in `render()`, so an old save gets a cup from the next season start.
- Settings: `settings.cup` = `{on, name}`. Cup medals for players are worked out from career rows (`cupMedalsOf`), not stored.

## Managers

- The user is the league commissioner and never manages a club. Every manager is AI; the commissioner can edit any manager or sack one from the manager page.
- `state.managers` keyed by id; each club points to its manager with `t.mgr`. A manager has a style (attacking, balanced, defensive), tactics, coaching and scouting (1 to 5), a `hist` row per finished season (finish, expected finish, W/D/L, honours) and `awards` (Manager of the season, type `mos`).
- Effects: style multiplies goals for and against in `simMatch()`, tactics adds to both sides' strength, coaching nudges growth for players aged 25 and under (`coachBonus`), scouting sets how much AI clubs misjudge prospects in the draft (`scoutView`).
- `setExpect()` ranks clubs by squad strength when a season kicks off. `managersSeason()` runs in `endSeason()`: career rows, Manager of the season, small skill changes, sackings (two seasons running finishing a quarter of the league or more below expectation, unless they won something; `settings.sackings`), retirements, then `fillVacancies()` hires from out-of-work managers, one recently retired player with a strong legacy, and fresh names. Moves are kept in `h.mgrMoves` for the season review.
- First appointments in an older save use fresh managers only.

## Hidden potential

- `p.pot` is a hidden ceiling (`rollPot`): young players can sit far below it, players in their late twenties are close. Positive growth stops at the ceiling (a 5% chance of +1 beyond it), so busts and late gems happen.
- The UI shows a scout's range (`potRange`) that narrows with age and is shifted by a fixed per-player bias `p.potN`, so it is not centred on the truth. Players aged 26+ or at their ceiling show as fully developed. `settings.revealPot` (off by default) shows exact values.
- `scoutView()` is how an AI club sees a prospect: young players are valued mostly on the scout's read of their ceiling, and poor scouts misread by much more.

## Player traits

- `TRAITS` lists each trait with its plain-English description and the positions it suits. Players hold up to two in `p.tr`. `rollTraits()` gives new players 0 to 2 (about 70% get one), and `TRAIT_CLASH` stops opposites pairing up.
- Effects: Clinical and Playmaker weight scorer and assister picks in `goals()`. Wall (DF) and Shot stopper (GK) add to defence in `strength()`, Leader adds to both sides. Big game player adds to `eff()` when `_bigGame` is set (cup ties and derbies). Iron man and Injury prone change injury odds and length. Fast learner, Late bloomer and Evergreen change `prog()`, and Evergreen also retires later. Steady and Flair change match rating spread. Loyal players are skipped by AI trades.
- Older saves get traits once in `migrate()`; the load path then persists the backup so they are not rolled again. Traits can be added or removed on the player page.

## Records and rivalries

- `trackMatch()` runs at the end of every match: hat-tricks go into `s.ht` (career rows keep them), scoring runs into `p.sk` and the best into `p.skBest`. Both only count from the version that added them.
- `clubRuns()` works out winning, unbeaten and losing runs from archived league results, so it covers every season.
- `pickTots()` picks the team of the season at the end of each season in the format's lineup shape (regulars only, best average rating) and stores it in `h.tots`; players keep a list of seasons in `p.tots`.
- `updateRivals()` scores every pair of clubs from results (close games and cup ties count more), title races, cup finals and trades, with older seasons weighted down by 0.85 a season. Pairs well above average become rivalries (`state.rivals`), each club has at most one, and established rivalries hold on unless they fade well below the bar. Names come from `DERBY_NAMES` and can be renamed on the History page.

## Season review

- `viewReview(season)` opens straight after `endSeason()` and from each season on the History page: champions, award winners, leaders, final table, Hall of Fame class and retirements.
- `reviewCard(season)` and `totsCard(season)` draw 1080 x 1350 PNG cards on a canvas (theme colours, pixel trophies at whole number scales). The Image card dialog can save or copy it.

## Visual style

- The sidebar is drawn as a pitch: a chalk outline, a penalty box around the league name, one mowing stripe per menu item, the halfway line and centre circle above the sim buttons, and a penalty box around the file buttons.

- Pixel art engine drawn onto canvas at low resolution and shown with `image-rendering: pixelated`: badges (`pxBadge`), kits (`pxKit`), championship rings (`pxRing`), trophies (`pxTrophy`), position charts (`pxChart`).
- `pxTrophy(kind, icon)` draws the league title and every award from one spec: shape (cup, plate, star, ball, boot, glove, medal), metal, plinth and accent colour. Defaults live in `TROPHY_DEF`; the user's changes in `settings.trophies[kind]`. Sprites are 23 px wide and are always shown at exactly 1x, 2x or 3x so they stay crisp. `icon` gives the topper only, used for league title counts. New competitions add a `TROPHY_DEF` entry and get a Trophy room tab for free. A 3x5 pixel font is in `FONT`, with wide 5x5 glyphs for M, N, V and W in `FONTW`.
- A Smooth setting falls back to the earlier vector SVG art.
- Ring designer settings: size, metal, stones, centre piece, side panel and banner text. The Trophy room card in Settings sits next to it.
- Theme: light, dark or match device, colour presets plus custom sidebar and accent colours. 28 nations with SVG flags and name pools per nation.

## Writing style for UI text

- Plain, natural English. No em dashes. Simple words.

## Ideas not built yet

- News feed with auto-written headlines.
- Second division with promotion and relegation.
- Sim several seasons at once.

## Installable app

- The folder is an installable web app for Chrome on the user's Mac, for personal use only.
- `manifest.webmanifest` holds the name, colours and icons. Icons are pixel art PNGs in `icons/`.
- `sw.js` is the offline worker. The game page is network first with a 4 second fallback to cache, so an update is just uploading a new `index.html`. Fonts and other files are cached and refreshed in the background. Bump `CACHE` only if cached files other than the page need forcing.
- The worker registers only over http(s), so double-clicking `index.html` still works.
- Save files stay on disk through the File System Access API. The `localStorage` backup is tied to the web address, so the installed app has its own backup slot.
