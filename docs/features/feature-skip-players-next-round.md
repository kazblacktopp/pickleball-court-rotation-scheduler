# Feature Spec — Skip Players for the Next Round

**Status:** Implemented (branch `feature/skip-players-next-round`)
**Phase:** 2 (see `pickleball-rotation-app-spec.md` → "Out of Scope for MVP")
**Author:** Kaz Blacktopp

## Problem

Mid-session, an organiser often needs one or more players to **sit out a single
upcoming round** without leaving the session — someone grabs water, takes a
phone call, or just wants a breather, then plays again the round after. None of
the existing controls cover this:

- **Reshuffle** redraws everything randomly; it can't target *who* sits.
- **Update roster → Leaving early** removes a player for the rest of the session
  (they never come back).
- **Host sits out first round** is a setup-time, round-1-only courtesy for one
  designated player, and only when the draw already has a sit-out slot.

We want a way to **bench chosen players for exactly one round**, guaranteed, and
have them return automatically.

## Scope

### In scope

- On the results screen, pick one or more current players to **sit out a chosen
  round** (defaulting to the next upcoming round).
- The benched players are **guaranteed not to play** that round — even if that
  means the round uses fewer courts or a shared 3-player court than the rest of
  the session.
- Players **return automatically** from the following round; normal fair
  rotation resumes.
- Rounds already played are kept verbatim; fairness counters carry across the
  change (as with mid-session roster changes).
- The forced sit-out counts as one rest turn, so the equal-rest selector does not
  immediately bench the same player again on their return.

### Out of scope (unchanged from parent spec)

- Skill ratings / rating-balanced pairings.
- Score entry, ladders, shareable links, DUPR.
- Permanent roster changes (that is the separate "Update roster" feature).
- Multi-round or sticky skips — each apply benches players for **one** round
  only. (Skipping several rounds means applying the panel several times.)
- Undo/redo history — each apply just re-derives from the locked rounds.

## Behaviour

The chosen round `F` is regenerated from the *available* players (roster minus
benched), so the benched players genuinely don't appear on any court that round.
The court count for that round is clamped to what the reduced count can fill
(`min(courts, maxUsableCourts(available))`), letting it drop to fewer courts or a
3-player court as needed. From round `F+1` the full roster returns.

### Fairness interaction

Each benched player takes one rest turn in round `F` (their `sitOutCount`
increments), mirroring the host round-1 sit-out. The existing "bench the
least-rested first" selector evens this out over the remaining rounds, so the
parent spec's "sit-outs differ by at most 1" goal continues to hold from the
skip onward.

### Summary line

Because a skip (or a roster change) can widen the total rest spread, the centred
results summary appends a short parenthetical explaining why, so a wider spread
reads as expected rather than a bug. The qualifier reflects which kinds of change
shaped the current draw:

- `(voluntary sit out)` — one or more one-round skips applied.
- `(roster changed)` — a mid-session "Update roster" change applied.
- `(roster changed + voluntary sit out)` — both.
- *(no qualifier)* — a fresh draw. Generate and Reshuffle clear the markers.

The two markers accumulate independently and reset only on a fresh draw, so a
roster change that redraws over a previously skipped round may still report
`voluntary sit out` — an accepted cosmetic over-report, since the rounds don't
record intent to re-derive it from.

### Guards

- At least **4 players must still be playing** the round, or Apply is disabled.
- At least **one player must be selected**, or Apply is disabled.

## Algorithm / API changes (`lib/rotation.ts`)

- `benchForRound(lockedRounds, roster, benched, courts, totalRounds, seed)` — new
  exported function. Replays locked history (`replayHistory`), generates round
  `F = lockedRounds.length + 1` for the available players via `generateSegment`,
  appends the benched players to that round's `sittingOut` (bumping their
  `sitOut` counters), then generates rounds `F+1 … N` for the full roster,
  splices, and returns a fully-recomputed `RotationResult` via `summarise`
  (`rosterChanged: true`). No changes to `generateRotation` / `extendRotation`.

## UI changes

- `components/skip-round.tsx` — new inline panel: a round selector (default = next
  upcoming round) and player chips toggled to sit out, with live validation and
  Apply/Cancel. Modeled on `components/roster-change.tsx`.
- `app/page.tsx`
  - New action `SKIP_ROUND` (`{ round, benched }`): slices locked rounds, calls
    `benchForRound`, updates `result` + `seed`, moves `currentIndex` to the
    skipped round, and sets `hadVoluntarySitOut`. The roster, courts, and host
    flag are left unchanged.
  - A third results-header button, **"Sit out next round"** (`Armchair` icon),
    toggling the panel (mutually exclusive with the "Update roster" panel).
  - State gains `hadRosterChange` / `hadVoluntarySitOut` markers, set by
    `APPLY_ROSTER_CHANGE` / `SKIP_ROUND` and cleared by `GENERATE` / `REGENERATE`,
    driving the centred summary line's change qualifier (see *Summary line*).

## Acceptance criteria

- Selecting players and applying makes them appear in the chosen round's
  sitting-out list and on **no** court that round.
- Those players appear back on a court from the following round.
- Rounds before the chosen round are identical.
- Benching enough players to force a 3-player court for that round renders
  correctly, and the next round restores the full court count.
- Apply is disabled when fewer than 4 would still be playing, or when nobody is
  selected.
- Over the session the benched player sits out no more than one round more than
  anyone else once rotation rebalances.
