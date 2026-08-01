# Feature Spec — Mid-Session Roster Changes

**Status:** Implemented (branch `feature/mid-session-roster-changes`)
**Phase:** 2 (see `pickleball-rotation-app-spec.md` → "Out of Scope for MVP")
**Author:** Kaz Blacktopp

## Problem

A rotation schedule is generated up front for a fixed roster, but real social
sessions are fluid: some players announce they must **leave early**, and there
is nearly always at least one **late arrival**. Today the only way to react is
to regenerate the whole draw from scratch, which throws away the rounds already
played and the fairness (rest / partner / opponent) accumulated so far.

Organisers need to adjust the roster **partway through a session** so that:

1. Rounds already played stay exactly as they were played.
2. Fairness counters carry forward — the algorithm keeps balancing rest and
   variety from where the session actually is, not from zero.
3. Departing players simply drop out of upcoming rounds.
4. Late arrivals are folded in fairly — they start playing without either being
   immediately benched or letting everyone else pile up sit-outs.

## Scope

### In scope

- Remove one or more players from the remaining rounds (early departures).
- Add one or more players to the remaining rounds (late arrivals).
- Choose the round from which the change takes effect ("keep rounds 1…X as
  played, redraw from X+1").
- Preserve all fairness counters across the change:
  - `sitOutCount` (equal rest)
  - `partialCourtCount` (turns on the shared 3-player court)
  - partner history (partner variety)
  - opponent history (opponent variety)
- Cope with the **court count changing** mid-session (e.g. 10 players on 2
  courts → 7 players on 1 full + 1 shared 3-player court).

### Out of scope (unchanged from parent spec)

- Skill ratings / rating-balanced pairings.
- Score entry, ladders, shareable links, DUPR.
- Undo/redo history of roster changes (each apply just re-derives from the
  locked rounds; there is no multi-step undo stack).
- Persisting who "left" vs "arrived" as structured metadata — the schedule
  itself is the record.

## Fairness model

The core idea: **the rounds already played are the source of truth for
history.** When a change is applied effective from round `F`:

1. Rounds `1 … F-1` are **locked** — kept verbatim.
2. The four fairness counters are **replayed** from those locked rounds, so the
   continuation starts from the true mid-session state (not a stored guess).
3. The active roster is updated: `active = previousActive − departures + arrivals`.
4. Rounds `F … N` are regenerated with the greedy builder, continuing from the
   replayed counters, using a fresh random seed.
5. The locked and regenerated rounds are spliced back together and renumbered
   `1 … N`.

### Late arrivals — counter initialisation

A late arrival has no history. Initialising their counters to zero would be
unfair in both directions:

- Zero `sitOutCount` looks like "played the most", so the sit-out selector
  (which benches the least-rested first) would immediately bench them.
- Never benching them (max) would let continuing players accumulate all the
  rest.

**Decision:** a late arrival's `sitOutCount` and `partialCourtCount` are
initialised to the **minimum among the continuing active players**. This makes
them "caught up" — from that round on they take a fair share of sit-outs and
3-player-court turns alongside everyone else. Their partner/opponent history
starts empty (correct — they have not played anyone yet).

Rationale: perfect equality of *total* rest across the whole session is
impossible once people join/leave at different times. The achievable, and
organiser-meaningful, goal is **fair rest from this point forward**, which the
minimum-seed achieves.

**Play on arrival:** a late arrival is additionally guaranteed to *play* (never
sit out) in the first round they are added to — someone who has just walked on
should get on court, not be benched. The minimum sit-out seed above would
otherwise make them a prime sit-out candidate in that very round. This is a
first-round-only protection; from the next round on they take a normal, fair
share of sit-outs. (If arrivals ever outnumber the playing slots, the
protection yields gracefully and some still sit.)

### Early departures

A departing player is removed from the active roster and never selected for
rounds `F … N`. Their history remains baked into the locked rounds (and thus in
any aggregate counts) but no longer influences pairing.

## UX

Entry point: an **"Update roster"** control on the results screen (visible in
both the Schedule and Courtside views).

The panel (inline, collapsible — mobile-first, no modal) offers:

- **Redraw from round** selector. Rounds `1 … N`. Default = the round after the
  one currently in view in the Courtside stepper (`currentIndex + 2`, clamped),
  i.e. "keep what we've played, change what's next". The organiser can move it
  earlier (including round 1 = full redraw with the new roster).
- **Active players**, each toggleable as *leaving* (strikethrough while marked).
- **Add late arrivals** — a name input mirroring the entry screen (comma / newline
  paste supported), showing pending additions as removable chips.
- **Live validation** — resulting active count; **Apply disabled if < 4**.
- **Apply** / **Cancel**.

On apply, the schedule updates in place; the summary line notes that a
mid-session roster change occurred (so a wider rest spread reads as expected,
not a bug).

## Algorithm / API changes (`lib/rotation.ts`)

The single-pass generator is refactored so the per-round greedy builder can
start from an existing history:

- `interface HistoryMaps` — mutable counters: `sitOut`, `partial` (records) and
  `partner`, `opponent` (maps keyed by `pairKey`).
- `generateSegment(roster, courts, rounds, startNumber, rand, hist)` — the
  extracted round loop; mutates `hist`, returns the generated `RoundSchedule[]`.
- `generateRotation(...)` — unchanged public signature and **byte-identical
  output**; now a thin wrapper that seeds an empty history and calls
  `generateSegment`.
- `replayHistory(rounds)` — rebuild `HistoryMaps` (and the set of players seen)
  from already-played rounds. Mirrors exactly how counters accrued during
  generation, including that the 3-player court records **no** partner/opponent
  history.
- `extendRotation(lockedRounds, newRoster, courts, totalRounds, seed)` — replay
  locked history, seed late arrivals, generate the remainder, splice, and return
  a fully-recomputed `RotationResult`.
- `RotationResult` gains `rosterChanged: boolean`.
- Aggregates (`sitOutCounts`, `partialCourtCounts`, `repeatPartnerships`,
  `effectiveCourts`, `hasPartialCourt`) are recomputed from the final spliced
  rounds so the result stays internally consistent regardless of splicing.
  `effectiveCourts` becomes the **max courts used in any single round**, so a
  mid-session court-count change renders correctly.

## UI changes

- `components/schedule-table.tsx` — derive the column count from the max
  `matches.length` across rounds and render empty cells for rounds that use
  fewer courts (robust to mid-session court changes).
- `components/roster-change.tsx` — new inline panel described under UX.
- `app/page.tsx` — new reducer action `APPLY_ROSTER_CHANGE`
  (`{ firstRound, add, remove }`): compute new roster, re-sync courts when not
  manually overridden, call `extendRotation`, update `players` + `result`.

## Acceptance criteria

- Applying a change from round `F` leaves rounds `1 … F-1` **identical**.
- A removed player never appears in rounds `F … N`.
- A late arrival appears in rounds `F … N`, plays in round `F` where capacity
  allows, and is not immediately forced to sit out.
- Remaining rounds still satisfy the parent spec's fairness goals **relative to
  the mid-session counters** (rest spread among continuing players stays within
  1 going forward; partner/opponent variety keeps improving from history).
- Court count adapts if the active player count crosses a court boundary, and
  both the Schedule and Courtside views render the mixed-court session cleanly.
- Reducing the active roster below 4 is prevented with a clear message.
- `generateRotation` output is unchanged for existing (no-change) sessions.
