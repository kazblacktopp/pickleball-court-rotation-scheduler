# Pickleball Court Rotation App — MVP Implementation Spec

## Overview

A single-page React app that lets a game organiser enter a list of player names and generates a fair, round-by-round court rotation for a pickleball session. Modelled on the existing paper/PDF rotation templates (2 courts / 10 players, 3 courts / 15 players), but works for **any** number of players.

Session-only data — no backend, no database, no auth. State lives in memory (and optionally `sessionStorage` so an accidental refresh doesn't wipe the draw). Deployed as a static app on Vercel via GitHub.

## User Flow

1. **Setup screen** — organiser enters player names (comma-seperated, one per line or add-one-at-a-time), sets the number of available courts (default: auto = as many as the player count supports), and the number of rounds (default 8, matching the paper templates).
2. **Generate** — the app produces the rotation schedule.
3. **Schedule screen** — a table showing each round: pairings per court and who is sitting out. Optionally a "current round" view with large text suitable for reading off a phone at the venue.
4. **Adjust** — organiser can regenerate the draw, or (phase 2) add/remove a late arrival/early leaver mid-session.

## Rotation Algorithm

### Court allocation

- Players per court: 4 (doubles).
- Courts used per round: `min(availableCourts, floor(playerCount / 4))`.
- Sitting out per round: `playerCount − (courtsUsed × 4)`.
- Minimum viable player count: 4. Below that, show a friendly message instead of a schedule.

### Fairness goals (in priority order)

1. **Equal rest** — sit-outs rotate so the difference between any two players' total sit-outs never exceeds 1 across the session.
2. **Partner variety** — minimise repeated partnerships; ideally no pair partners twice until all other options are exhausted.
3. **Opponent variety** — minimise repeated matchups as a secondary objective.

### Approach

A greedy round-builder with scoring is sufficient for MVP (player counts are small, ≤ ~30):

- Track per-player counters: `sitOutCount`, `partneredWith` (map), `playedAgainst` (map).
- Each round: first select sit-outs (players with the lowest `sitOutCount`, tie-broken randomly), then form pairs and matchups by choosing combinations that minimise repeat-partner and repeat-opponent scores.
- Regeneration re-runs with a new random seed so the organiser can reshuffle if they dislike a draw.

No need for a perfect combinatorial solution — the paper templates themselves contain occasional repeats, so "good and fast" beats "optimal and slow".

## UI Requirements

- Mobile-first: this gets used courtside on a phone.
- Schedule table mirrors the PDF layout: rows = rounds, columns = Court 1…N + Sitting Out.
- Clear visual separation of the two teams on each court ("A & B vs C & D").
- Highlight the current round with next/previous controls.
- Print-friendly view (the paper templates suggest organisers like a printable draw).

## Technical Decisions

- **Framework**: React 18+ with Vite (or Next.js if v0 outputs it — either deploys cleanly to Vercel as static/SSG).
- **Styling**: Tailwind CSS.
- **State**: React `useState`/`useReducer` only. Rotation logic in a pure, framework-free module (`generateRotation(players, courts, rounds, seed)`) so it's unit-testable and reusable later.
- **Persistence**: `sessionStorage` for refresh-safety only. No accounts, no server.
- **Deployment**: GitHub repo → Vercel auto-deploy.

## Out of Scope for MVP (Phase 2 candidates)

- Skill ratings per player (the paper templates tag players 1 or 2) and rating-balanced pairings.
- Mid-session roster changes (late arrivals / early departures) that preserve fairness counters.
- Score entry and a session ladder.
- Shareable link so players can view the draw on their own phones.
- DUPR-style rating integration.

## Acceptance Criteria

- Works for 4–30 players, including awkward counts (5, 7, 11, 13…).
- Over an 8-round session with 10 players, every player sits out either 1 or 2 rounds — never 0 and 3.
- No pair partners together more than twice in 8 rounds at typical player counts.
- Renders cleanly on a ~380px-wide phone screen.
- Regenerate produces a different valid draw.

## References

- `docs/pickleball-rotation-template-2-courts-10-players.pdf`
- `docs/pickleball-rotation-template-3-courts-15-players.pdf`