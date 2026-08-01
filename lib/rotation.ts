// Pure rotation generator for pickleball doubles sessions.
// No React / DOM dependencies — safe to unit test in isolation.

export type Team = [string, string]

export interface CourtMatch {
  court: number // 1-based court number
  /** Team A / Team B are null on a partial (3-player) court. */
  teamA: Team | null
  teamB: Team | null
  /** Everyone on the court: 4 players for a full court, 3 for a partial court. */
  players: string[]
  /** True when this is the shared 3-player "extra" court. */
  partial: boolean
}

export interface RoundSchedule {
  round: number // 1-based round number
  matches: CourtMatch[]
  sittingOut: string[]
}

/** Optional scheduling hints for {@link generateRotation}. */
export interface RotationOptions {
  /** Name of the player acting as host, if any. */
  host?: string | null
  /**
   * When true (and the host is in the roster), the host is guaranteed a sit-out
   * in round 1 — the common courtesy of the organiser benching first when the
   * roster is bigger than the courts can seat. Ignored if there are no sit-outs.
   */
  hostSitsOutFirstRound?: boolean
}

export interface RotationResult {
  rounds: RoundSchedule[]
  effectiveCourts: number
  sitOutCounts: Record<string, number>
  /** How many times each player was on the shared 3-player court. */
  partialCourtCounts: Record<string, number>
  /** Whether the schedule ever uses a 3-player court. */
  hasPartialCourt: boolean
  /** Number of times any pair partnered more than once. */
  repeatPartnerships: number
  /** True when the schedule was produced by a mid-session roster change. */
  rosterChanged: boolean
  seed: number
}

// Deterministic seeded PRNG (mulberry32).
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Mutable fairness counters threaded through round generation. Keeping them in
 * one struct lets a session be *continued* from an existing state — the basis
 * for mid-session roster changes (see `extendRotation`).
 */
interface HistoryMaps {
  /** Total sit-outs per player. */
  sitOut: Record<string, number>
  /** Turns on the shared 3-player court per player. */
  partial: Record<string, number>
  /** Times a pair partnered, keyed by `pairKey`. */
  partner: Map<string, number>
  /** Times a pair were opponents, keyed by `pairKey`. */
  opponent: Map<string, number>
}

const inc = (map: Map<string, number>, a: string, b: string) =>
  map.set(pairKey(a, b), (map.get(pairKey(a, b)) ?? 0) + 1)
const get = (map: Map<string, number>, a: string, b: string) =>
  map.get(pairKey(a, b)) ?? 0

interface SegmentResult {
  rounds: RoundSchedule[]
  /** Highest number of courts used in any round of this segment. */
  effectiveCourts: number
  hasPartialCourt: boolean
}

/**
 * Build a run of rounds for a fixed roster, continuing from — and mutating —
 * the supplied fairness history. This is the shared engine behind both a
 * from-scratch schedule and a mid-session continuation.
 *
 * Fairness:
 *  - Sit-outs rotate so rest counts differ by at most 1.
 *  - A greedy scorer minimises repeated partners and opponents.
 */
function generateSegment(
  roster: string[],
  courts: number,
  rounds: number,
  startNumber: number,
  rand: () => number,
  hist: HistoryMaps,
  /**
   * Players who must not sit out in the first round of this segment — used so a
   * late arrival plays the round they are added to instead of being benched on
   * arrival (their low seeded rest count would otherwise make them a prime
   * sit-out candidate).
   */
  mustPlayFirstRound: Set<string> = new Set(),
  /**
   * Players who must sit out in the first round of this segment, if there are
   * sit-out slots to give — used for the host courtesy of benching first. The
   * mirror image of `mustPlayFirstRound`; yields gracefully when there are more
   * forced sitters than open slots.
   */
  mustSitOutFirstRound: Set<string> = new Set(),
): SegmentResult {
  const maxCourts = maxUsableCourts(roster.length)
  const effectiveCourts = Math.max(0, Math.min(courts, maxCourts))

  if (roster.length < 4 || effectiveCourts === 0 || rounds <= 0) {
    return { rounds: [], effectiveCourts, hasPartialCourt: false }
  }

  // Every roster player needs a counter entry so sorts are well-defined.
  for (const p of roster) {
    hist.sitOut[p] ??= 0
    hist.partial[p] ??= 0
  }

  // With the court cap above, a shortfall (if any) is always exactly one seat,
  // which becomes a single shared 3-player court.
  const capacity = effectiveCourts * 4
  const hasPartialCourt = roster.length < capacity
  const fullCourts = hasPartialCourt ? effectiveCourts - 1 : effectiveCourts
  const playingPerRound = fullCourts * 4 + (hasPartialCourt ? 3 : 0)
  const sitPerRound = roster.length - playingPerRound

  const out: RoundSchedule[] = []

  for (let r = 0; r < rounds; r++) {
    // 1. Choose who sits out: players who have rested the least sit first.
    // In the segment's first round, protect any must-play arrivals by ordering
    // them last so they are only ever benched if there aren't enough others.
    const protect = r === 0 && mustPlayFirstRound.size > 0 ? mustPlayFirstRound : null
    const forceSit = r === 0 && mustSitOutFirstRound.size > 0 ? mustSitOutFirstRound : null
    let sittingOut: string[] = []
    if (sitPerRound > 0) {
      const ordered = shuffle(roster, rand).sort((a, b) => {
        // Forced sitters (the host benching first) claim slots ahead of everyone.
        if (forceSit) {
          const af = forceSit.has(a) ? 0 : 1
          const bf = forceSit.has(b) ? 0 : 1
          if (af !== bf) return af - bf
        }
        if (protect) {
          const ap = protect.has(a) ? 1 : 0
          const bp = protect.has(b) ? 1 : 0
          if (ap !== bp) return ap - bp
        }
        return hist.sitOut[a] - hist.sitOut[b]
      })
      sittingOut = ordered.slice(0, sitPerRound)
      sittingOut.forEach((p) => (hist.sitOut[p] += 1))
    }
    const sitSet = new Set(sittingOut)
    let pool = shuffle(
      roster.filter((p) => !sitSet.has(p)),
      rand,
    )

    const matches: CourtMatch[] = []

    // 2. Fill the shared 3-player court, if any. It counts as playing (never a
    // sit-out), so we pick from the playing pool. Assignments rotate: players
    // who have had the fewest turns on it go first, keeping turns near-equal.
    // We deliberately record no partner/opponent history from this court.
    let partialPlayers: string[] = []
    if (hasPartialCourt) {
      const ordered = shuffle(pool, rand).sort(
        (a, b) => hist.partial[a] - hist.partial[b],
      )
      partialPlayers = ordered.slice(0, 3)
      partialPlayers.forEach((p) => (hist.partial[p] += 1))
      const partialSet = new Set(partialPlayers)
      pool = pool.filter((p) => !partialSet.has(p))
    }

    // 3. Greedily build each full court, minimising partner/opponent repeats.
    for (let c = 0; c < fullCourts; c++) {
      const seedPlayer = pool[0]
      let rest = pool.slice(1)

      // Partner: fewest prior partnerships with seedPlayer.
      const partner = rest.reduce((best, x) => {
        const bScore =
          get(hist.partner, seedPlayer, best) * 10 + get(hist.opponent, seedPlayer, best)
        const xScore =
          get(hist.partner, seedPlayer, x) * 10 + get(hist.opponent, seedPlayer, x)
        return xScore < bScore ? x : best
      }, rest[0])
      rest = rest.filter((x) => x !== partner)

      // Opponent 1: fewest prior encounters with team A.
      const opp1 = rest.reduce((best, x) => {
        const score = (p: string) => get(hist.opponent, seedPlayer, p) + get(hist.opponent, partner, p)
        return score(x) < score(best) ? x : best
      }, rest[0])
      rest = rest.filter((x) => x !== opp1)

      // Opponent 2: fewest encounters with team A + fewest partnering opp1.
      const opp2 = rest.reduce((best, x) => {
        const score = (p: string) =>
          get(hist.opponent, seedPlayer, p) +
          get(hist.opponent, partner, p) +
          get(hist.partner, opp1, p) * 10
        return score(x) < score(best) ? x : best
      }, rest[0])
      rest = rest.filter((x) => x !== opp2)

      const teamA: Team = [seedPlayer, partner]
      const teamB: Team = [opp1, opp2]

      inc(hist.partner, teamA[0], teamA[1])
      inc(hist.partner, teamB[0], teamB[1])
      for (const a of teamA) for (const b of teamB) inc(hist.opponent, a, b)

      matches.push({
        court: c + 1,
        teamA,
        teamB,
        players: [...teamA, ...teamB],
        partial: false,
      })
      pool = rest
    }

    // 4. Append the 3-player court last (highest court number).
    if (hasPartialCourt) {
      matches.push({
        court: fullCourts + 1,
        teamA: null,
        teamB: null,
        players: partialPlayers,
        partial: true,
      })
    }

    out.push({ round: startNumber + r, matches, sittingOut })
  }

  return { rounds: out, effectiveCourts, hasPartialCourt }
}

/**
 * Generate a round-by-round doubles schedule from scratch.
 *
 * Thin wrapper over `generateSegment` with an empty history.
 */
export function generateRotation(
  players: string[],
  courts: number,
  rounds: number,
  seed = 1,
  options: RotationOptions = {},
): RotationResult {
  const rand = mulberry32(seed)
  const roster = players.map((p) => p.trim()).filter(Boolean)

  const hist: HistoryMaps = {
    sitOut: Object.fromEntries(roster.map((p) => [p, 0])),
    partial: Object.fromEntries(roster.map((p) => [p, 0])),
    partner: new Map(),
    opponent: new Map(),
  }

  // The host sits out round 1 only when asked and actually in the roster; the
  // segment builder ignores it gracefully if there are no sit-out slots.
  const mustSitOut = new Set<string>()
  const host = options.host?.trim()
  if (options.hostSitsOutFirstRound && host && roster.includes(host)) {
    mustSitOut.add(host)
  }

  const seg = generateSegment(roster, courts, rounds, 1, rand, hist, new Set(), mustSitOut)

  // Full courts seat 4. If 3 players are left over we add one shared
  // 3-player court, so the maximum usable courts can be one higher.
  const maxCourts = maxUsableCourts(roster.length)
  const effectiveCourts = Math.max(0, Math.min(courts, maxCourts))

  return {
    rounds: seg.rounds,
    effectiveCourts: seg.rounds.length ? seg.effectiveCourts : effectiveCourts,
    sitOutCounts: hist.sitOut,
    partialCourtCounts: hist.partial,
    hasPartialCourt: seg.hasPartialCourt,
    repeatPartnerships: countRepeatPartnerships(seg.rounds),
    rosterChanged: false,
    seed,
  }
}

/**
 * Rebuild fairness counters (and the set of players seen) by replaying a run of
 * already-played rounds. Mirrors exactly how counters accrue during
 * generation — critically, the 3-player court records no partner/opponent
 * history — so a continuation picks up from the true mid-session state.
 */
function replayHistory(rounds: RoundSchedule[]): {
  hist: HistoryMaps
  players: Set<string>
} {
  const hist: HistoryMaps = {
    sitOut: {},
    partial: {},
    partner: new Map(),
    opponent: new Map(),
  }
  const players = new Set<string>()
  const bump = (rec: Record<string, number>, k: string) => (rec[k] = (rec[k] ?? 0) + 1)

  for (const round of rounds) {
    for (const name of round.sittingOut) {
      players.add(name)
      bump(hist.sitOut, name)
    }
    for (const m of round.matches) {
      for (const name of m.players) players.add(name)
      if (m.partial) {
        for (const name of m.players) bump(hist.partial, name)
      } else if (m.teamA && m.teamB) {
        inc(hist.partner, m.teamA[0], m.teamA[1])
        inc(hist.partner, m.teamB[0], m.teamB[1])
        for (const a of m.teamA) for (const b of m.teamB) inc(hist.opponent, a, b)
      }
    }
  }

  // Ensure every player who appeared has both counter entries (a player who
  // only ever played still needs a sitOut of 0, and vice versa).
  for (const p of players) {
    hist.sitOut[p] ??= 0
    hist.partial[p] ??= 0
  }

  return { hist, players }
}

/** Count teams that partnered together more than once, scanning in order. */
function countRepeatPartnerships(rounds: RoundSchedule[]): number {
  const seen = new Map<string, number>()
  let repeats = 0
  for (const round of rounds) {
    for (const m of round.matches) {
      if (m.partial || !m.teamA || !m.teamB) continue
      for (const team of [m.teamA, m.teamB]) {
        const k = pairKey(team[0], team[1])
        const prev = seen.get(k) ?? 0
        if (prev > 0) repeats++
        seen.set(k, prev + 1)
      }
    }
  }
  return repeats
}

/**
 * Continue a session after a mid-session roster change.
 *
 * `lockedRounds` are kept verbatim; their fairness counters are replayed and
 * the remaining `totalRounds - lockedRounds.length` rounds are regenerated for
 * `newRoster` (departures already removed, arrivals already added). Late
 * arrivals — players with no locked history — are seeded to the minimum
 * sit-out / 3-player-court counts among the continuing players so they take a
 * fair share of rest going forward, and are guaranteed to play (not sit out)
 * the first round they are added to.
 *
 * The returned result recomputes all aggregates from the final spliced rounds,
 * so it is internally consistent regardless of how the split fell.
 */
export function extendRotation(
  lockedRounds: RoundSchedule[],
  newRoster: string[],
  courts: number,
  totalRounds: number,
  seed: number,
): RotationResult {
  const roster = newRoster.map((p) => p.trim()).filter(Boolean)
  const { hist } = replayHistory(lockedRounds)

  // Continuing players are those already carrying history into this segment.
  const continuing = roster.filter((p) => p in hist.sitOut)
  const minSit = continuing.length ? Math.min(...continuing.map((p) => hist.sitOut[p])) : 0
  const minPartial = continuing.length
    ? Math.min(...continuing.map((p) => hist.partial[p]))
    : 0

  // Late arrivals are the active players with no locked history. (When nothing
  // is locked this is a full redraw, not a mid-session change, so nobody counts
  // as an arrival and normal rotation rules apply.)
  const continuingSet = new Set(continuing)
  const arrivals =
    lockedRounds.length > 0
      ? new Set(roster.filter((p) => !continuingSet.has(p)))
      : new Set<string>()

  // Seed late arrivals so they blend in and share future rest fairly.
  for (const p of roster) {
    if (!(p in hist.sitOut)) hist.sitOut[p] = minSit
    if (!(p in hist.partial)) hist.partial[p] = minPartial
  }

  const rand = mulberry32(seed)
  const roundsToMake = Math.max(0, totalRounds - lockedRounds.length)
  const seg = generateSegment(
    roster,
    courts,
    roundsToMake,
    lockedRounds.length + 1,
    rand,
    hist,
    arrivals,
  )

  const allRounds = [...lockedRounds, ...seg.rounds]
  return summarise(allRounds, seed, true)
}

/**
 * Build a fully-consistent `RotationResult` from a finished set of rounds by
 * recomputing every aggregate. `effectiveCourts` is the most courts used in any
 * single round, so a mid-session court-count change still renders correctly.
 */
function summarise(
  rounds: RoundSchedule[],
  seed: number,
  rosterChanged: boolean,
): RotationResult {
  const { hist } = replayHistory(rounds)
  let effectiveCourts = 0
  let hasPartialCourt = false
  for (const round of rounds) {
    effectiveCourts = Math.max(effectiveCourts, round.matches.length)
    if (round.matches.some((m) => m.partial)) hasPartialCourt = true
  }

  return {
    rounds,
    effectiveCourts,
    sitOutCounts: hist.sitOut,
    partialCourtCounts: hist.partial,
    hasPartialCourt,
    repeatPartnerships: countRepeatPartnerships(rounds),
    rosterChanged,
    seed,
  }
}

/**
 * Maximum number of courts a given player count can fill. Full courts seat 4;
 * if exactly 3 players are left over we add one shared 3-player court (more
 * than two remaining players warrants an extra court). One or two leftover
 * players sit out instead.
 */
export function maxUsableCourts(playerCount: number): number {
  const fullCourts = Math.floor(playerCount / 4)
  const remainder = playerCount % 4
  return fullCourts + (remainder === 3 ? 1 : 0)
}

export function autoCourts(playerCount: number): number {
  return Math.max(1, maxUsableCourts(playerCount))
}

/**
 * How many players sit out each round for a given roster and selected court
 * count. Mirrors the seating maths in `generateSegment` (full courts of 4, plus
 * at most one shared 3-player court) so callers — like the "host sits out first
 * round" toggle — can tell whether any round actually has sit-outs to give.
 */
export function sitOutsPerRound(playerCount: number, courts: number): number {
  const effectiveCourts = Math.max(0, Math.min(courts, maxUsableCourts(playerCount)))
  if (playerCount < 4 || effectiveCourts === 0) return 0
  const capacity = effectiveCourts * 4
  const hasPartialCourt = playerCount < capacity
  const fullCourts = hasPartialCourt ? effectiveCourts - 1 : effectiveCourts
  const playingPerRound = fullCourts * 4 + (hasPartialCourt ? 3 : 0)
  return Math.max(0, playerCount - playingPerRound)
}
