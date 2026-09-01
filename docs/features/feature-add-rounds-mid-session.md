# Feature Spec — Add Rounds Mid-Session

**Status:** Implemented
**Phase:** 2 (see `pickleball-rotation-app-spec.md` → "Out of Scope for MVP")
**Author:** Kaz Blacktopp

## Problem

Sessions run long. The organiser sets up, say, 6 rounds, everyone is still keen
after round 5, and there is court time left. Until now the only way to get more
rounds was to go back to the entry screen, raise the "Rounds" count and generate
a new rotation — which discards every round already played and redraws the whole
session from scratch. That loses the record of who has already played whom, and
the fresh draw can hand a player the same partner they just had, or bench
someone who has already sat out more than their share.

We want to **append rounds to the session in progress**, keeping everything
already played and continuing the same fairness rules.

## Scope

### In scope

- On the results screen, an **Add rounds** panel that appends 1–10 more rounds
  to the end of the current schedule (up to the 40-round session cap that the
  entry screen already enforces).
- Every existing round is kept **verbatim** — the schedule only grows.
- The appended rounds continue the session's fairness state, not a fresh start:
  - sit-outs keep rotating towards equal rest counts across the whole session;
  - nobody sits out two rounds running (including across the join, so the
    players who sat out the last existing round are not benched again in the
    first new round);
  - turns on the shared 3-player court keep rotating;
  - the partner/opponent scorer keeps avoiding pairings already used earlier in
    the session.
- The entry screen's "Rounds" value is updated to the new total, so the longer
  session does not read as an unapplied setting change.

### Out of scope

- Removing or truncating rounds (use **New session** or a fresh generate).
- Changing the roster or court count while adding rounds — those remain the job
  of **Update roster**.
- Undo/redo history — as with the other mid-session controls, each apply
  re-derives from the rounds already drawn.

## Behaviour

Adding `N` rounds keeps rounds `1…M` exactly as they are and generates rounds
`M+1…M+N` for the current roster and court count. The new rounds are drawn from
the fairness history replayed off the existing rounds, so they behave as if they
had been part of the original draw: rest stays even, back-to-back rests are
avoided across the join, and repeat partnerships remain minimised.

The summary line above the schedule (rest spread, repeated partnerships,
3-player court) is recomputed from the full spliced schedule, so it always
describes the whole session.

## Implementation

- `lib/rotation.ts` gains `appendRounds(existingRounds, roster, courts,
  extraRounds, seed, rosterChanged?)`. It replays the existing rounds'
  fairness counters (`replayHistory`), runs `generateSegment` for the extra
  rounds with `previousSitters` seeded from the last existing round, and
  summarises the spliced schedule. No changes to `generateRotation`,
  `extendRotation` or `benchForRound`.
- `components/add-rounds.tsx` is the results-screen panel (round-count select,
  Add rounds / Cancel), matching the existing "Sit out a round" and
  "Update roster" panels.
- `app/page.tsx` gains an `ADD_ROUNDS` action that dispatches into
  `appendRounds`, updates `rounds` to the new total and re-baselines
  `generatedSignature`. The "Add rounds" toggle sits alongside the other
  mid-session controls and closes the sibling panels when opened.

## Verification

Across rosters of 5–17 players, several court counts and seeds, appending rounds
to a 6-round draw:

- the first 6 rounds are byte-identical to the pre-append schedule;
- round numbering stays contiguous;
- no player sits out two rounds running (except where the bench is larger than
  the pool of rested players, which the generator already documents);
- the final rest spread matches a fresh full-length draw of the same total, and
  repeat-partnership counts are comparable.

Checked in the browser end to end: an 11-player / 3-court / 4-round draw plus 3
appended rounds keeps rounds 1–4 unchanged, adds rounds 5–7 with no repeated
partnerships, and leaves the entry screen showing 7 rounds with no pending
setting change.
