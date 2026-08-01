# Interactive Soccer — Project Context

## Overview
Single-page football (soccer) management + simulation game. React 19 + TypeScript + Vite 8 + Zustand. No backend. All data in memory.

## Project Structure

```
src/
├── league/           # Management layer
│   ├── types.ts          # Club, Fixture, Standing, League, Cup interfaces
│   ├── engine/
│   │   ├── LeagueEngine.ts  # generateFixtures, computeStandings, createLeague, advanceWeek
│   │   └── CupEngine.ts     # Knockout tournament generation
│   ├── data/
│   │   ├── clubs.ts         # LEAGUES array, getLeague() — 6 leagues with 135+ teams
│   │   ├── premierLeague.ts # 20 EPL teams (createTeam with star players)
│   │   ├── laLiga.ts        # 20 La Liga teams
│   │   ├── championsLeague.ts # 20 UCL teams
│   │   ├── arabLeagues.ts   # Saudi/UAE/Qatar teams
│   │   ├── teamFactory.ts   # createTeam(config) — star players + auto-generated squad from namePools
│   │   └── namePools.ts     # 19 nationalities, first+last name arrays
│   └── components/
│       ├── MainMenu.tsx     # Title screen, league selector, mode buttons
│       ├── LeagueScreen.tsx # Standings table + week-by-week fixtures + Watch match
│       ├── LeagueTable.tsx  # Sortable standings with form indicators
│       ├── FixtureList.tsx  # Week navigation + fixture cards
│       ├── CupScreen.tsx    # Cup bracket visualization
│       └── CupBracket.tsx   # Horizontal round display
├── match/            # Real-time 2D match engine
│   ├── types.ts           # Vec2, Player, Ball, TeamData, MatchState, FORMATIONS constant
│   ├── constants.ts       # Pitch dimensions, physics params, speed options
│   ├── engine/
│   │   ├── MatchEngine.ts     # Game loop (requestAnimationFrame), physics + AI orchestration. The visual/real-time sim.
│   │   ├── PlayerAI.ts        # AI states: chase, dribble, pass, shoot, support, retreat, mark. Formation-aware via getFormationPos(i, side, formation)
│   │   ├── BallPhysics.ts     # Position updates, friction, boundary/goal collision, kickBall
│   │   ├── MatchEvents.ts     # Goal detection, shots, out-of-play, ball touch
│   │   ├── MatchSimulator.ts  # Wrapper for MatchEngine
│   │   ├── FastSimulator.ts   # Headless batch simulation (no canvas) — AI weeks. NOTE: NOT identical to MatchEngine (different dt, extra shot-hack, no halves)
│   │   ├── NarrativeSimulator.ts # Deterministic stats-based PvP match report (seed `narrative:<names>`) — currently the SAVED result, differs from 2D
│   │   ├── TeamConverter.ts   # Club → TeamData conversion
│   │   ├── LLMSimulator.ts    # Calls https://mlvoca.com/api/generate (tinyllama) for AI commentary
│   │   └── rng.ts            # Seeded deterministic PRNG (mulberry32) via setMatchSeed/seedFromString — ONLY randomness in the sim path
│   ├── renderer/
│   │   ├── MatchRenderer.ts   # Orchestrates rendering + scoreboard/clock HUD
│   │   ├── PitchRenderer.ts   # Pitch lines, goals, penalty areas, center circle
│   │   ├── PlayerRenderer.ts  # Colored circles with numbers
│   │   └── BallRenderer.ts    # White circle
│   ├── data/teams.ts          # Default Red FC vs Blue City
│   └── components/
│       ├── MatchScreen.tsx     # Full match layout + keyboard handling
│       ├── MatchView.tsx       # Canvas + engine init + click-to-control
│       ├── MatchControls.tsx   # Play/pause, speed, jump in/out
│       ├── StatsPanel.tsx      # Live stats (possession, shots, goals)
│       ├── EventFeed.tsx       # Scrollable event log
│       ├── LLMMatchView.tsx    # Play-by-play LLM commentary feed with scoreboard
│       └── OnlineNarrativeMatchView.tsx # Deterministic PvP report: preview → live feed → full-time; "Watch 2D Replay" button
├── multiplayer/      # Friends league system (pass-and-play)
│   ├── types.ts           # PlayerProfile, CustomTeam, DraftSlot, FormationName, TEAM_COLORS
│   ├── store.ts           # Zustand store: players, teams, phases, smart fast-forward
│   ├── playerPool.ts      # Gathers ALL real players from all 135+ clubs for drafting
│   └── components/
│       ├── PlayerSetup.tsx           # Add 2-6 friends with color picker
│       ├── TeamCreationScreen.tsx    # Draft real players (3 random options per slot, unlimited rolls)
│       ├── MultiplayerLobby.tsx      # Team overview, select league, replace count
│       └── MultiplayerLeagueScreen.tsx # League table + fast-forward + player-vs-player matches
├── store/
│   ├── leagueStore.ts  # View routing, league/cup state
│   └── matchStore.ts   # Live match state, engine ref
├── App.tsx             # Routes: menu | league | cup | match | multiplayer
├── main.tsx            # React entry point
├── vite-env.d.ts       # Declares __BUILD_ID__ (git short hash injected via vite define)
└── style.css           # All styles (~1900 lines)
```

## How to Run
```bash
npm run dev    # Vite dev server
npm run build  # Production build
```

## Key Features Implemented

### League Mode
- 6 leagues (EPL, La Liga, UCL, Saudi, UAE, Qatar) with 135+ teams
- Round-robin home-and-away fixtures
- Standings with W/D/L/GF/GA/GD/Pts/Form, UCL/Europa zone coloring
- Week-by-week navigation, Simulate Week, Watch individual matches
- Season progress bar, New Season reset

### Cup Tournament
- Knockout from 16 teams, 4 rounds (R16 → QF → SF → Final)
- Horizontal bracket visualization
- Winner progression, New Tournament reset

### Physics Match Engine
- Real-time 2D simulation via requestAnimationFrame
- Fixed timestep physics (1/60s), accumulator pattern
- Player AI: chase, dribble, pass (with lead prediction), shoot, support, retreat, GK
- Ball physics: friction, boundary/goal collision
- Match events: goals, shots on/off target, out-of-play (goal kick/corner)
- Possession tracking, stats panel, event feed
- Speed controls (0.5x/1x/2x/4x), pause/play (functional in OnlineMatchView)
- Jump-in player control: click player → WASD/E/Q, J to jump out
- **Formation-aware positioning**: `getFormationPos(i, side, formation?)` in `PlayerAI.ts` derives each player's home row/x from the team's actual `Position[]` formation (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 4-3-2-1). MatchEngine + FastSimulator pass formations through. Previously hardcoded 4-4-2 for everyone.
- **Deterministic PRNG** (mulberry32, seeded via `setMatchSeed(seedFromString(...))`): the ONLY randomness in the sim path. `Math.random`/`Date.now`/`performance.now` are confined to cosmetic code (PlayerRenderer leg-swing, MatchEndOverlay confetti, RAF timing accumulator) and never feed the sim, so both players' 2D engines produce identical output from the same seed + code.

### Match Engine Fixes (July 2026)
The following bugs were fixed in the physics engine to resolve the "22 players cluster in one spot" issue:

- **Dribble/shoot/pass aimed at own goal** `PlayerAI.ts:92,182,227` — Every `getGoalCenter` call inverted the side: `getGoalCenter(side === 'home' ? 'away' : 'home')`. For a home player this calls `getGoalCenter('away')` = y=105 = **home's own goal**. Players dribbled, shot, and passed backward toward their own net. The ball never progressed toward the opponent's goal, making forward play impossible. Fixed to `getGoalCenter(side)`.
- **Out-of-play detection runs before ball clamping** — `checkGoal` and `checkOutOfPlay` ran AFTER `updateBallPosition`, which clamps the ball within pitch bounds. So `ball.y < 0` was never true — the ball never went out of play, just bounced against walls with velocity halved until it stopped. Now predicted next-frame ball position is checked BEFORE `updateBallPosition`.
- **Boundary clamping removed** `BallPhysics.ts:22-41` — `updateBallPosition` treated boundaries as walls (bounce + halve velocity), preventing out-of-play detection from ever triggering. Removed all clamping; ball now passes freely past the line.
- **Goal detection uses predicted position** `MatchEngine.ts:301-314` — Was calling `checkGoal(this.state.ball, ...)` with the CURRENT ball position, which was still in-bounds even though `nextBallY` predicted it would cross the line. Now constructs the goal event inline using `nextBallY`/`nextBallX`.
- **Dribble now kicks the ball** — `executeAIAction` was missing a handler for the `'dribble'` state. Players with the ball would run toward their target without moving the ball, then abandon it, causing everyone to converge on the stationary ball. Now dribbling gently kicks the ball ahead (power 4-7) every 0.25-0.4s toward the opponent's goal.
- **Possession transfer fallback** `PlayerAI.ts:226-232` — When a player gains possession through touch (not AI), their `ai.currentAction` was still `'chase'`/`'support'` — no ball-kicking action fired. Added a fallback that forces `'dribble'` with timer=0.01s for any player holding the ball without a valid action.
- **Tackle pops the ball loose** — `performTackle` was setting `ball.vx = ball.vy = 0`, which stopped the ball dead after each tackle. Now the ball pops away from the tackle in a random direction at speed 3.
- **Goal/out-of-play resets clear ball state** — `resetBallAfterGoal` and `resetBallAfterOutOfPlay` now clear `lastTouchedBy` and `lastTouchedTeam` to `null`, so both teams contest the restart instead of the scoring team getting automatic possession.
- **Players keep moving during goal/outOfPlay cooldowns** — The cooldowns no longer freeze all player movement. Players still run to their formation positions during cooldown.
- **Same-team possession transfers restricted** — The `checkPlayerTouchedBall` logic now only transfers possession between teammates if the new player is at least 0.5 units closer to the ball, or if the current owner has drifted more than 3 units from it. This prevents teammates from swarming the ball.
- **Dribble target is dynamic** — Updated every AI think cycle (0.5s) to point toward the opponent's goal from the player's current position, instead of a fixed target that became stale.
- **Tackle no longer auto-assigns possession** — `performTackle` no longer sets `player.hasBall = true`. The ball pops loose and the nearest player gains possession naturally through touch detection on the next frame.
- **Dribble kick uses ball position as origin** — `kickBall(ball, ball, ...)` instead of `kickBall(ball, player, ...)`, so the ball is always kicked from where it actually is.
- **FastSimulator.ts updated** — The headless batch simulator now has all the same fixes applied.

The engine should now produce realistic spread and continuous ball movement with players attacking the correct goal.

### Fantasy Draft System (July 2026)
- Online league draft now starts with a **fantasy manager picker**: 20 iconic managers (Xabi Alonso, Guardiola, Klopp, Mourinho, Ancelotti, Simeone, Tuchel, etc.) each with a preferred formation and a per-position playstyle system (e.g. Xabi Alonso → 4-2-3-1, GK Sweeper Keeper, CB Ball-Playing Defender, CDM Holding Midfielder, CAM Chance Creator, LW/RW Inside Forward, ST False 9)
- Managers are **first-come, first-served** per league (enforced by a partial unique index + `set_member_manager` RPC that returns 'Manager already taken' on `unique_violation`)
- The draft uses the **manager's formation** (4-4-2 / 4-3-3 / 4-2-3-1 / 3-5-2); each slot shows the required playstyle and player cards get a **✓ System fit** badge when the player's playstyle matches
- **Chemistry** (nationality groups): groups of 3+ same-nationality players give `min(count,6)*5` points; the manager's own nationality adds +10 when its group is completed; capped at 100 (matches the Xabi Alonso spec: Spain 8 players → 30 + manager link 10 = 40/100)
- **System Proficiency**: index-to-index fraction of slots whose player playstyle matches the manager requirement, 0-100
- **Squad ratings**: Attack / Midfield / Defence / Goalkeeper / Overall computed from the drafted players' ratings
- Chemistry + proficiency apply a **deterministic attribute bonus** in the online league sim (`applyFantasyBonus`), so both clients compute identical teams
- New SQL: `src/supabase/fantasy_draft.sql` adds `league_members.manager_id` and `draft_picks.player_playstyle/player_nationality/player_rating`, and an updated `save_draft_picks`

### Manager System (July 2026)
- Every club has a manager profile (`club.manager`): 20 real 2026-27 managers (e.g. Pep Guardiola at Man City → Tiki-Taka 100, Arteta → Positional Play 100, Slot → Gegenpress 100, Emery → Counter Attack 100)
- Each manager has a **preferred tactical system** (Gegenpress, Positional Play, Tiki-Taka, Counter Attack, Direct Play, Wing Overload, Compact Defence, Total Football) and **proficiency ratings** (0-100) per system
- Clubs without a listed real manager get a **deterministic generated default** (seeded from the club name via `seedFromString`), so both online-league clients build identical managers
- **Tactical bonus**: `applyManagerBonus` boosts player attributes relevant to the manager's preferred system, scaled by proficiency (e.g. Compact Defence → +defending/+physical, Tiki-Taka → +passing/+dribbling). Applied in `clubToTeamData` and `draftPicksToTeamData` (default manager per team name for human draft teams)
- Manager name + preferred system shown in the online-league **standings rows** and the **human-vs-human match banner**
- Bonus math is pure/deterministic — does not break the cross-device match determinism guarantee

### Online League (Friends League 2.0)
- League creation with invite code, online sync via Supabase (RLS-protected)
- Auto-simulates AI weeks in the background; pauses automatically when it's your human-vs-human matchup
- **Auto-popup PvP match**: when the sim reaches your vs-friend week, the deterministic narrative PvP sim opens automatically (preview → live feed → full-time). "Watch 2D Replay" switches to the real-time 2D physics canvas.
- The PvP report is generated by `NarrativeSimulator` (seed `narrative:<home>|<away>|...`) and is what's saved to the league — identical on every device. The 2D replay is a **separate deterministic `MatchEngine` run** (seed `homeId+awayId+homeName+awayName`) that does NOT currently match the narrative score (see Known Issues — planned fix: make the 2D the single source of truth).
- Match result is saved once and never overwritten by a second player
- Both the narrative feed (1x/2x/4x) and the 2D replay (0.5x–4x) have speed controls; the live 2D is locked at 1x with no jump-in (determinism lock)
- Replay "Continue" and narrative "Continue" both call `handlePvPFinish`, which saves → fast-sims remaining AI week matches → CAS-advances the week → refreshes to the league table
- `handlePvPFinish` holds `playingRef` true through the save flow so the 2s poller can't re-open the same match (fixed re-open race)
- **Build stamp**: `__BUILD_ID__` (git short hash, via `vite define`) shown in the main menu footer and online-league header — both players must show the same id for identical 2D results
- Manual refresh button and 2s polling for live data sync
- League auto-advances weeks after match finishes; auto-sim continues from current week (never resets to week 1)
- 20 total teams per league (dynamic bot count based on human player count)
- Bot teams filtered by league type (e.g., EPL bots for Premier League league)

### Friends League (Legacy — Local Pass-and-Play)
- Add 2-6 players with colors
- **Draft system**: Each player picks 11 real players from the game's 135+ clubs
  - 3 random options per position slot, unlimited rolls
  - Shows player name, club badge, all 6 attributes (PAC/SHO/PAS/DRI/DEF/PHY)
  - Visual pitch with all boundary lines, penalty areas, goalposts, center circle
  - 120-second timer per player
- Lobby: Select base league, how many AI teams to replace with custom teams
- League running: Replace bottom N AI clubs with custom teams
- **Smart Fast-Forward**: Auto-simulates non-player weeks at 5 weeks/sec
- Player-vs-player matches: two viewing modes
  - **Watch** (physics canvas)
  - **AI Commentary** (LLM-generated play-by-play via mlvoca.com/tinyllama)

### AI Commentary (LLM)
- Calls `POST https://mlvoca.com/api/generate` with `tinyllama` model
- Prompt includes both teams' full lineups, formations, all player attributes
- Returns JSON array of 6-15 events (goals, shots, saves, cards, fouls, corners)
- Play-by-play feed with slide-in animations, color-coded events
- 1x/2x/4x speed, pause, skip to end
- Result saves to league standings on finish

## Known Issues

### Physics Match Engine
- The "22 players cluster in one spot" bug was the main physics engine issue. Multiple root causes were fixed in the July 2026 update (see "Match Engine Fixes" above). The engine should now produce realistic spread and continuous ball movement with players attacking the correct goal.
- If clustering still occurs, next debugging step: add console.log tracing of AI state machine transitions to identify remaining edge cases.
- AI Commentary (LLM) mode remains available as an alternative.
- Match engine results are now deterministic across devices (seeded mulberry32 PRNG based on match ID). Both players see identical goals, shots, and possession.
- **Out-of-play restarts are rough** (`MatchEngine.ts:248-272`): when the ball leaves play, everything freezes for a 2s cooldown, then the nearest restart-team player is teleported onto the ball. Opponents aren't repositioned for goal kicks/corners/throw-ins, and the teleport restart feels broken. Planned polish: shorter cooldown with formation repositioning, proper goal-kick/corner/throw-in placement, no teleport.

### Online League
- **Three simulators disagree — the "2D game is not the same game" bug (Aug 2026)**: for human-vs-human PvP there are three independent deterministic simulators producing different matches: `NarrativeSimulator` (currently the SAVED result, seed `narrative:<home>|<away>|...`), the 2D `MatchEngine` replay (seed `homeId+awayId+homeName+awayName`), and `FastSimulator` (AI weeks only — different dt + extra shot-hack, no halves). The 2D game a player watches can end 2-1 while the narrative/saved result says 1-0. **DECISION: make the 2D `MatchEngine` the single source of truth for PvP** — auto-open the same deterministic 2D for both players and save the 2D result; demote the narrative to a preview whose score matches the 2D. (Chosen by user — implementation pending.)
- **PvP 2D is not live-synced**: each device replays the same seeded 2D locally from minute 0; there is no server-authoritative stream. Two players watching at different wall-clock times (or after a page reload) look unsynced even though the sim sequence is identical. Determinism only holds when both are on the same build — verify via `__BUILD_ID__`.
- **Stale bundle causes real divergence**: a player on an older deployed bundle runs old sim code (e.g., pre-formation `getFormationPos` = hardcoded 4-4-2, old replay `onFinish` → returns to lobby) and sees a different 2D game + old redirect behavior. Fix: hard-refresh / clear site data and confirm both show the same `__BUILD_ID__`.
- The `claim_match` RPC does not exist on the Supabase database; `handlePlayMatch` opens the 2D match directly without DB claiming. Result is saved when the match finishes. The second player to finish sees the match is already finished and does not overwrite.
- Auto-sim race condition: both players' browsers independently run auto-sim. The `advanceLeagueWeek` call uses `expectedWeek` guard to prevent double-advancing, and the auto-sim re-syncs from DB when the week jumps ahead.
- Auto-sim previously could restart from week 1 after a 2D match finishes. Fixed by always reading current_week from DB at the start of `runAutoSimulate` instead of relying on potentially stale local state.
- **Online match determinism lock** (July 2026): Removed `MatchControls` (speed/jump-in controls) from `OnlineMatchView` and locked `engine.setSpeed(1)`. Previously, each player could independently change speed (0.5x–4x) or jump into control a player, which caused the two local simulations to diverge. With speed locked to 1x and no controls, both engines produce identical deterministic output from the same seeded RNG.
- **Re-open race fixed** (Aug 2026): `handlePvPFinish` used to clear `playingRef` at the top, leaving a window where the 2s poller could re-detect the still-`pending` match and re-open the PvP lobby after "Continue". Now `playingRef` stays true until `pvpMatch`/`showReplay` are cleared, and both branches clear `showReplay` too.

### Other
- (none reported)

## Next Steps (Suggested)
1. **Make the 2D `MatchEngine` the single source of truth for online PvP** (decided Aug 2026): auto-open the same deterministic 2D match for both players, save the 2D result (not the narrative report), and demote the narrative to a pre-match preview whose prediction/score always matches the 2D. This removes the "three simulators disagree" bug.
2. **Polish out-of-play restarts** in `MatchEngine.ts`: shorter cooldown, players reposition to formation, proper goal-kick/corner/throw-in placement, no teleport-to-ball restart.
3. Add goal scorer tracking / player stats persistence across league season
4. Add save/load (localStorage serialization)
5. Add substitution/formation editing during match
6. Add yellow/red card system
7. Mobile responsive layout improvements (sidebar stacking)