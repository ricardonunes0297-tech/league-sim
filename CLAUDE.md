# League Sim: project handover

A pure-simulation football league game. The user sets up clubs and players, then watches the world build itself: seasons, drafts, trades, awards, retirements and a Hall of Fame. No currency, no match viewer. Matches are simulated in the background.

## Current state

- The game lives in one file: `index.html` in `~/Documents/league-sim-app` (this folder replaced the numbered `league-sim-N.html` copies in Downloads) (HTML, CSS and vanilla JS, no build step, no dependencies apart from optional Google Fonts with fallbacks).
- It runs offline by double-clicking the file.
- Saves live in save slots inside the app (IndexedDB database `leaguesim`, stores `meta` for slot cards and `data` for save text). The Saves page lists them with Load, Rename, Export and Delete, plus Save now, Save as a new slot, Import a save file and Export. The setup screen lists them too when no league is open.
- Autosave (on by default, stored in `localStorage` `leaguesim-autosave`) writes the open slot 1.5 seconds after the last `persist()`, and straight away when the app is hidden. All slot writes go through `queued()` so they never overlap. `slotId` (also in `localStorage` `leaguesim-slot`) is the open slot.
- `localStorage` `leaguesim-backup` is still written on every change as a crash copy and is what the app reopens on start. A league reopened with no slot gets one automatically. The app asks Chrome for persistent storage. Files (.json) are only for export and import, and old files import into a new slot.
- Older saves must always keep loading. All schema changes go through `migrate(d)`, which fills in missing fields with defaults.
- Saves are compact: `saveText()` runs `packState()`, which turns career rows and archived results into short arrays (marked `packed:1`) and writes JSON without whitespace. `migrate()` calls `unpackState()` first, so in memory everything stays as objects. New fields on career rows or results are safe: rows with unknown keys are left as objects.
- Keep the save small as features grow: about 30KB per season for a 10 club 11 a side league. Store ids, not copies of names, wherever history allows.

## Architecture notes

- Global `state` holds the league: `teams`, `players` (active), `retired` (retired and released players, kept for history), `fixtures` (current season rounds), `history` (one entry per finished season), `results` (archived matches for head to head), `trades`, `draftHistory`, `draft` (active draft or null), `hof`, `settings`.
- `render()` rebuilds the whole view from `state`. Long lists are paged (the players list shows 50 at a time via `ps.lim`). Views: table, fixtures, players, clubs, `club:<id>`, `player:<id>`, draft, trades, cup, history, `review:<season>`, hof, settings.
- Events use delegated `data-act` click handlers and `data-*` change and input handlers at the bottom of the script.
- `persist()` marks unsaved changes and writes the browser backup.
- Back buttons use `navStack`: any click that opens a player, manager, club or review page pushes the previous view, sidebar nav clears it, and `backTo()` falls back to the matching list page.
- Formats: 5, 7 and 11 a side (`FORMATS`), each with lineup shape, squad shape, match length and base goal rate.

## Simulation

- `lineup()` picks the strongest available side (injured players excluded, out of position players penalised). If a club has too few fit players it plays short rather than field injured ones.
- `simMatch()` uses Poisson goals from attack against defence, then assigns scorers and assisters, match ratings out of 10, player of the match, clean sheets and injuries. Injuries and their minute are rolled before goals, and `goals()` only picks players still on the pitch at each goal's minute, so an injured player never scores or assists after going off.
- `endSeason()` archives the season (table, matchday positions, awards, results), pushes career rows, ages players, runs progression, handles retirements and youth replacements, runs the end of season trade window, inducts the Hall of Fame every third season, then opens the yearly draft.
- Draft: lowest finisher picks first. The opening draft (new league option) is a snake draft over a big pool, with a setup stage where the pool can be edited first. AI picks fill starting positions, then bench, with small per-club positional tastes.
- AI trades: 1 for 1 swaps that fix each club's weakest position at similar value. Windows run only at the end of the season and after the draft. Players traded recently are excluded, and each pair of clubs trades once per window.
- Awards each season: MVP (best average rating among regulars), Golden Boot, Golden Glove (keeper clean sheets), Rookie (first season, age 23 or under).
- Hall of Fame: legacy points from apps, goals, assists, clean sheets, titles and awards. Up to two retired players per class, one class every three seasons.

## Domestic cup

- `state.cup` holds the current season's cup: `sched` (the league matchday index each round plays after), `rounds` (ties and byes), `cur` and `winner`. Each round is drawn when the one before it is played. The final follows the last matchday on neutral ground (home advantage set to 0 for that match).
- Every cup round has a match day of its own. `cupDue()` is true once the matchday in `sched[cur]` has been played, and each `simRound()` then plays either that cup day or the next league matchday, never both (injuries tick on both). `state.fixtures` and `state.round` stay league only, so tables, `posByRound`, results and records are unchanged. `leagueDone()` means the league is played out; `seasonDone()` also waits for the cup final, which is always the last game of the season.
- `calendar()` lists the season as `{lg}` and `{cup}` days in order and `nextDay()` finds the next one. The Fixtures strip, dashboard, sidebar and slot cards (`dayLabel()`) use them. `fxRound` is an index into `calendar()`.
- Older saves need no migration: the old engine played a round on the same step as its matchday, so their `cur` and `round` already line up.
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

## Trophy art and custom awards

- Trophies are hand-drawn maps in `TRO_MAPS` (14 shapes: title, grand, champ, cup, plate, star, ball, boot, glove, medal, kicker, runner, keeper, coach). `title` (gold lidded cup with ribbons) is the league default and `grand` (tall silver cup with ear handles) the cup default; the older `champ` and `cup` stay as options. Metal is also one step darker along bottom edges. Characters: g metal, d engraving, w shine, a accent, k black. `pxTrophy()` shades each row of metal light on the left to dark on the right and adds a small plinth (rows 25 to 31). Icon mode drops the plinth. Shape, metal, plinth and accent are still set per award in the Trophy room (`settings.trophies`).
- Custom awards live in `settings.customAwards` ({id, name, short, stat, pos, age, off}). `syncCustom()` (called in `render`) adds each one to `AWARDS`, `TROPHY_DEF` and `TROPHY_L` under the key `x<id>`, so every page that shows awards works with them. `decideAwards` ranks them with `caRank()` (stats in `CA_STATS`) and they appear on awards night with nominees. Removing an award that has been won only sets `off`, so history keeps its name and trophy.

## Releases

- Bump `APP_VERSION` in index.html with every push, so the user can confirm in Settings which version they are on. Settings also has a Check for updates button (`checkUpdates`) that clears the offline cache and service worker, then reloads.
- sw.js is network first for the page and stores each fresh copy, even when the 4 second fallback was used. Bump `CACHE` in sw.js if its file list changes.

## Trophy cabinet

- Clubs have a Trophy cabinet tab (`clubTab="cab"`); player and manager pages have Career and Trophy cabinet tabs (`pTab`, shared by both).
- `cabinetPanel(name, groups)` draws a flat pixel wooden cabinet with a brass name plate, glass sheen and one run of shelves (a repeating CSS gradient; slots are a fixed 170px tall so they stand on them). Each group is one slot: the latest three wins stacked at 3x (`stackHTML`, fixed overlap) with a ×count plaque. A fanning bundle of every win was tried and removed at the user's request (felt laggy). Award slots (`g.aw`) link to that award's winners on History; on touch the first tap shows the tooltip and a second tap follows the link. A group with no wins but a `ghost` image shows as a dark silhouette (league and cup everywhere; MVP plus Golden Boot or Glove by position, and Rookie in a first season, for active players; Manager of the season for active managers).
- Trophy details use one shared pixel tooltip (`#tip`, `showTip`/`hideTip`) driven by `data-tip` (lines joined by newlines, first line is the title): mouse hover, keyboard focus, or tap on touch (tap again or elsewhere to close). Hovered slots lift with a stepped glow. Club cards on the Clubs page show a small league and cup row (`trophyRow`) with the same tooltips. `clubCabinet` (titles, cups, plus every individual award its players and managers won while there, via `clubAwards`), `playerCabinet` (rings, cup medals, team of the season picks, each award type, Hall of Fame) and `managerCabinet` (titles, cups, awards) build the groups. Team of the season (`tots`) and Hall of Fame (`hof`) have their own trophy looks in `TROPHY_DEF`.
- In lists (players table, plaques) `ringsHTML` and `awardsHTML` show only the latest icon plus a count (class `flat`, no hover spread) so the table fits without side scrolling. The tooltip lists them all. Big versions on the player page still spread on hover.
- Rafter banners were tried and removed at the user's request.

## Comparisons

- Club groups and player groups for cabinets come from `clubGroups(t)` and `playerGroups(p)`; `cabCompare(nameA,nameB,gA,gB)` puts two sides on one set of shelves, a row per honour either has, counts in the middle with the leader lit, silhouettes where one side has none. Compare trophies are 2x (`cw` on items), and half that on phones via `zoom`.
- Clubs: the Head to head card has Meetings and Compare tabs (`h2hTab`). `clubCompareHTML` adds a stat duel (`duelRow`, higher or lower wins, the winner marked) with titles, cups, awards, finishes, points, record, all-time top scorer and appearances (`clubLeader`), squad rating and ground.
- Players: view `pcmp:<id>` (Compare button on the player page). Side B is `pc.b`, picked by search (`pc.q`, active and retired) or defaulting to the best active player at the same position; Swap flips sides without adding to the back stack. Career duel follows `pc.comp` (all, league, cup). Nothing new is saved.

## History page

- Tabs (`histTab`): Seasons, Roll of honour (`rollHTML`), the cup (`cupHistoryHTML`, shared with the Cup page), Awards, Records (`viewRecords`), Eras and dynasties, Rivalries.
- Awards tab (`awardsHistHTML`, chips set `awHist`): every winner of one award from `awardWinners(k)` (POTY, MVP, Boot, Glove, Rookie, custom awards, Manager of the season, Team of the season, Hall of Fame) plus most wins. `data-act="awhist"` opens it from History seasons, season reviews and cabinet slots.

## Player of the Year

- A year is three seasons (`yearOf`). `awardPoty(h)` runs in `endSeason()` on the same seasons as the Hall of Fame (`season%3===0`), after the history entry is pushed, and stores `h.poty` = {year, from, to, win, noms}; the winner also gets `{type:"poty"}` in `p.awards` (so cabinets, lists and `legacy()` see it).
- `decidePoty(to)` works only from career rows, rings, cup medals, awards and `p.tots`, so `ensurePoty()` (called in `render`) fills in every finished year on older saves. Eligible: half the top appearances across the three seasons. Four parts, each divided by the best eligible value: average rating, goals plus assists in all competitions (keepers: clean sheets, scored against other keepers), team trophies (title 2, cup 1), individual awards (MVP 3, Boot and Glove 2, Rookie 1, team of the season 1). Weighted by `settings.potyW` (Settings, Awards tab); `redoPoty()` recalculates every past year.
- Shown on awards night (after MVP), the season review, the History page and the player cabinet. Trophy `poty`.

## GOATs

- Commissioner only: Crown as GOAT on the player page. GOATs live outside saves in their own IndexedDB database `leaguesim-goats` (store `goats`, key `lid:pid`), loaded at boot into `goats`, so the GOATs page (menu, view `goat`) shows every league's GOATs, even after a save is deleted.
- `state.lid` (made by `leagueId()` on first crowning) ties entries to a league. Each league has a line: `n`, `reign`, `season`, `until`, `recrowned`. Crowning a new one makes the last a former GOAT; taking the title away hands the reign back to the latest former one.
- `snap` (`goatSnap`) is a self-contained copy: bio, main club badge, club names, totals, legacy and cabinet groups as plain data (items carry their trophy kind `k`, rings their colour). `snapGroups` redraws them. `refreshGoats()` updates the open league's snapshots at boot, at season end and on the GOATs page. `then` keeps their totals from the day they were crowned.
- The player keeps `p.goat` (season first crowned), which gives a crown trophy (`TRO_MAPS.crown`, `goat` in `TROPHY_DEF`) in their cabinet.
- The GOATs page compares any two GOATs from any leagues with `cabCompare` and `duelRow`, noting when formats differ.

## Players list

- Everyone, Active or Retired chips (`ps.status`). Retired forces All time, since retired players have no stats this season.

## Awards night

- When a season ends (`settings.awardsNight`, on by default) a full-screen overlay (`#an`) reveals the awards one at a time: Rookie, Golden Glove, Golden Boot, Team of the season, Manager of the season, MVP, cup final, champions. Built by `anSteps(h)`, drawn by `anRender()`; Space or Enter reveals and moves on, Escape skips to the season review.
- `decideAwards` now keeps the top three for each award as nominees (`h.noms`); manager nominees go in `h.mosNoms`. Older seasons simply show no nominees.
- Any season can be replayed from its review page with the Awards night button.

## Milestones and club identity

- `checkMilestones()` runs after every match for the players who took part: career goals and appearances count league and cup together, plus assists and clean sheets (`MILESTONES`). Stored in `p.ms`; the season's list goes to `h.milestones`. Older saves record already passed milestones quietly in `migrate()` with `s:null`, so nothing floods in.
- One-club legends: on retirement, 7+ seasons all at one club sets `p.oneClub`.
- Club Legends tab (`legendsHTML`): most appearances and goals for the club, Hall of Famers, one-club legends, trophy-winning managers.
- Stadiums: `ground.cap` starts by format (`CAP0`), grows 3% after a top half finish, 10% after a cup and 20% after a title (`growGrounds`, history in `ground.ups`). `crowdF()` scales home advantage a little by capacity against the league average.

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
- Pixel UI theme: tokens on `:root` are `--px` (digits from `PxNum`, a 1KB Jersey 10 cut to 0-9 embedded as a data URL with `unicode-range` and `size-adjust`, because Pixelify's 5 and 7 read like S and 1; everything else Pixelify Sans, for headings, nav, buttons, tabs, chips, scores and big numbers), `--hd`/`--bd` (Barlow, kept for tables, stats, settings text and small text), `--pxb` border width, `--pxc` border colour, `--pxsh` shadow colour with `--px-sh`, `--px-sh-lg` and `--px-press` hard offset shadows, and `--silf` for small silhouettes. No rounded corners except the chalk pitch markings in the sidebar. Ligatures are off (`font-feature-settings`) because the pixel face's fi ligature reads like an A.
- Settings are split into tabs (`SET_TABS`: League, Players, Awards, Look, App; `setTab` kept for the session). Cards are built on demand in `viewSettings()` and laid out in CSS columns so they pack without gaps.
- Theme: light, dark or match device, colour presets plus custom sidebar and accent colours. 28 nations with SVG flags and name pools per nation.

## Writing style for UI text

- Plain, natural English. No em dashes. Simple words.

## League and cup stats

- League stats are `apps/goals/assists/cs`, cup stats are `capps/cgoals/cas/ccs` (cup assists and clean sheets only exist from version 2026.10.25-11, older seasons read 0). `simCupTie` restores league stats after the tie and adds the difference to the cup fields.
- `cv(stats, key, comp)` reads "lg", "cup" or "all"; `compStats()` returns a stats object for one competition. The player page career and the players list have All competitions / League / Cup chips (`pComp`, `ps.comp`, default all). Milestones, tributes and eras count all competitions.

## Records tab, eras and tributes

- Records live in the History page's Records tab (the Table page no longer has tabs). `viewRecords()` builds club records (league seasons from `clubSeasons()`, matches from `allMatches()`, runs from `clubRuns()`), player all-time and single-season records for the chosen competition (`recComp`), and top 10 leaderboards. The old records cards on History were folded into it.
- `erasOf(team)` groups a club's titles into runs with no more than one season between titles; three or more titles make an era (a dynasty at four titles or three in a row). It is named after the manager who won at least two thirds of those titles, otherwise the core player with most appearances. Shown on History and in the club History tab, plus a Greatest dynasty record.
- `notable(p)` picks retired players worth a tribute (enough appearances plus a legacy of half the Hall of Fame bar, two titles, an award, a one-club career or ten seasons). `tributeHTML(p)` writes the card live from the player's data. Tributes show on the player page, in the season review (Farewells) and as an awards night step.

## Ideas not built yet

- News feed with auto-written headlines.
- Second division with promotion and relegation.
- Sim several seasons at once.

## Installable app

- The folder is an installable web app for Chrome on the user's Mac, for personal use only.
- `manifest.webmanifest` holds the name, colours and icons. Icons are pixel art PNGs in `icons/`.
- `sw.js` is the offline worker. The game page is network first with a 4 second fallback to cache, so an update is just uploading a new `index.html`. Fonts and other files are cached and refreshed in the background. Bump `CACHE` only if cached files other than the page need forcing.
- The worker registers only over http(s), so double-clicking `index.html` still works.
- Save slots and the `localStorage` backup are tied to the web address, so the installed app and the site share them (same origin). Export files for copies outside the app.
