# Feature Spec — Host Flag & Host Sits Out First Round

**Status:** Implemented (branch `feature/host-sit-out-first-round`)
**Phase:** 2 (see `pickleball-rotation-app-spec.md` → "Out of Scope for MVP")
**Author:** Kaz Blacktopp

## Problem

The organiser running a session is usually one of the players, and there is a
common social courtesy: when the roster is bigger than the courts can seat, the
host offers to take the **first** sit-out so a guest gets on court straight away.
Today the rotation is blind to who the host is, so the only way to arrange this
is to reshuffle repeatedly and hope the draw benches the right person in round 1.

We want the organiser to be able to:

1. **Flag one player as the host.**
2. **Opt for the host to sit out round 1** — but only when it is actually a
   choice, i.e. there are more players than the selected courts can seat and
   someone has to sit out anyway.

## Scope

### In scope

- Designate exactly one of the entered players as the **host** (toggle on/off).
- A **"Host sits out the first round"** option, available only when the current
  players × courts combination produces at least one sit-out in a round.
- The rotation generator honours the option: on the very first round the host is
  guaranteed a sit-out slot, and fairness carries on normally from there (their
  early rest is just counted like any other, so the rest spread stays within 1
  across the session).
- The choice persists through **Reshuffle** (a regenerated draw still benches
  the host in round 1).
- Host designation survives refresh (`sessionStorage`) and is cleared correctly
  when the host is removed from the roster.

### Out of scope (unchanged from parent spec)

- Skill ratings / rating-balanced pairings.
- Score entry, ladders, shareable links, DUPR.
- Multiple hosts / co-hosts, or host-specific privileges beyond the round-1
  sit-out (there is no auth — "host" is purely a scheduling hint).
- Forcing the host to sit out **later** rounds, or to always play. The feature is
  a single round-1 courtesy; from round 2 on the host is an ordinary player.
- Wiring the round-1 host sit-out into mid-session roster changes
  (`extendRotation`). A roster change keeps the already-played rounds verbatim,
  so round 1 (with the host benched) is preserved anyway; the option only steers
  a from-scratch generation.

## Behaviour

### Availability rule

The option is only meaningful when a round has sit-outs. With `n` players and
`c` selected courts, the number sitting out each round is derived exactly as the
generator does it (full courts of 4, plus at most one shared 3-player court).
`sitOutsPerRound(n, c)` in `lib/rotation.ts` is the single source of truth, and
the UI uses it to decide whether to enable the toggle:

- `sitOutsPerRound > 0` → the host **can** opt to sit out round 1.
- `sitOutsPerRound === 0` → everyone plays every round (e.g. 8 players / 2
  courts, or 7 players / 2 courts with a 3-player court). The toggle is disabled
  with a short explanation.

### Fairness interaction

Making the host sit out round 1 simply means they take one of their rest turns
first. Their `sitOutCount` becomes 1 while everyone else is at 0, and the
existing equal-rest selector (bench the least-rested first) naturally evens this
out over the remaining rounds. No special counters are needed and the parent
spec's "sit-outs differ by at most 1" guarantee still holds.

If the option is left on but the situation changes so there are no sit-outs, the
generator degrades gracefully: with no sit-out slot to give, the host just plays.

## Algorithm / API changes (`lib/rotation.ts`)

- `interface RotationOptions { host?: string | null; hostSitsOutFirstRound?: boolean }`
  — new optional argument bag.
- `generateRotation(players, courts, rounds, seed, options?)` — gains a fifth
  optional `options` parameter. Called with no options it is **byte-identical**
  to before. When `hostSitsOutFirstRound` is set and `host` is in the roster, the
  host is added to a `mustSitOutFirstRound` set passed down to the segment
  builder.
- `generateSegment(..., mustSitOutFirstRound = new Set())` — gains a final
  parameter mirroring the existing `mustPlayFirstRound` protection. In the first
  round only, forced sit-outs are ordered **first** in the bench-selection sort
  (the mirror image of the must-play protection), so they claim sit-out slots
  before anyone else. It yields gracefully if there are more forced sitters than
  slots.
- `sitOutsPerRound(playerCount, courts)` — exported helper returning how many
  players sit out per round for a given roster/court combination, reusing
  `maxUsableCourts`. Drives the UI availability rule.

## UI changes

- `components/player-entry.tsx`
  - Each player chip gets a **crown toggle** to flag/unflag that player as host
    (radio-like — flagging one clears any previous host). The host chip is
    visually highlighted and its crown filled.
  - A new **Host options** block appears once a host is chosen: a checkbox-style
    toggle "**{host} sits out the first round**", enabled only when
    `sitOutsPerRound(players, courts) > 0`, with helper text for the disabled
    case.
- `app/page.tsx`
  - State gains `host: string | null` and `hostSitsOutFirstRound: boolean`.
  - New actions `SET_HOST` and `SET_HOST_SITS_OUT`.
  - `REMOVE_PLAYER` clears `host` if the removed player was the host; `CLEAR_ALL`
    resets both fields; `APPLY_ROSTER_CHANGE` clears `host` if the host departs.
  - `build()` forwards `{ host, hostSitsOutFirstRound }` to `generateRotation`,
    so GENERATE and REGENERATE both honour it.

## Acceptance criteria

- With a surplus roster (e.g. 10 players / 2 courts), flagging a host and
  enabling the option makes that host appear in **round 1's sitting-out list** on
  every generation and reshuffle.
- Over the full session the host still sits out no more than one round more than
  anyone else (rest spread stays within 1).
- With no surplus (e.g. 8 players / 2 courts) the option is disabled and the host
  plays every round.
- Removing the host from the roster clears the flag and the option.
- `generateRotation` output is unchanged when called without options (existing
  sessions and tests unaffected).
