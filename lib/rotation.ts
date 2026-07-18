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
 * Generate a round-by-round doubles schedule.
 *
 * Fairness:
 *  - Sit-outs rotate so rest counts differ by at most 1.
 *  - A greedy scorer minimises repeated partners and opponents.
 */
export function generateRotation(
  players: string[],
  courts: number,
  rounds: number,
  seed = 1,
): RotationResult {
  const rand = mulberry32(seed)
  const roster = players.map((p) => p.trim()).filter(Boolean)

  // Full courts seat 4. If 3 players are left over we add one shared
  // 3-player court, so the maximum usable courts can be one higher.
  const maxCourts = maxUsableCourts(roster.length)
  const effectiveCourts = Math.max(0, Math.min(courts, maxCourts))

  const result: RotationResult = {
    rounds: [],
    effectiveCourts,
    sitOutCounts: Object.fromEntries(roster.map((p) => [p, 0])),
    partialCourtCounts: Object.fromEntries(roster.map((p) => [p, 0])),
    hasPartialCourt: false,
    repeatPartnerships: 0,
    seed,
  }

  if (roster.length < 4 || effectiveCourts === 0) {
    return result
  }

  // With the court cap above, a shortfall (if any) is always exactly one seat,
  // which becomes a single shared 3-player court.
  const capacity = effectiveCourts * 4
  const hasPartialCourt = roster.length < capacity
  const fullCourts = hasPartialCourt ? effectiveCourts - 1 : effectiveCourts
  const playingPerRound = fullCourts * 4 + (hasPartialCourt ? 3 : 0)
  const sitPerRound = roster.length - playingPerRound
  result.hasPartialCourt = hasPartialCourt

  // History matrices keyed by "a|b".
  const partnerCount = new Map<string, number>()
  const opponentCount = new Map<string, number>()
  const inc = (map: Map<string, number>, a: string, b: string) =>
    map.set(pairKey(a, b), (map.get(pairKey(a, b)) ?? 0) + 1)
  const get = (map: Map<string, number>, a: string, b: string) =>
    map.get(pairKey(a, b)) ?? 0

  for (let r = 0; r < rounds; r++) {
    // 1. Choose who sits out: players who have rested the least sit first.
    let sittingOut: string[] = []
    if (sitPerRound > 0) {
      const ordered = shuffle(roster, rand).sort(
        (a, b) => result.sitOutCounts[a] - result.sitOutCounts[b],
      )
      sittingOut = ordered.slice(0, sitPerRound)
      sittingOut.forEach((p) => (result.sitOutCounts[p] += 1))
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
        (a, b) => result.partialCourtCounts[a] - result.partialCourtCounts[b],
      )
      partialPlayers = ordered.slice(0, 3)
      partialPlayers.forEach((p) => (result.partialCourtCounts[p] += 1))
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
          get(partnerCount, seedPlayer, best) * 10 + get(opponentCount, seedPlayer, best)
        const xScore =
          get(partnerCount, seedPlayer, x) * 10 + get(opponentCount, seedPlayer, x)
        return xScore < bScore ? x : best
      }, rest[0])
      rest = rest.filter((x) => x !== partner)

      // Opponent 1: fewest prior encounters with team A.
      const opp1 = rest.reduce((best, x) => {
        const score = (p: string) => get(opponentCount, seedPlayer, p) + get(opponentCount, partner, p)
        return score(x) < score(best) ? x : best
      }, rest[0])
      rest = rest.filter((x) => x !== opp1)

      // Opponent 2: fewest encounters with team A + fewest partnering opp1.
      const opp2 = rest.reduce((best, x) => {
        const score = (p: string) =>
          get(opponentCount, seedPlayer, p) +
          get(opponentCount, partner, p) +
          get(partnerCount, opp1, p) * 10
        return score(x) < score(best) ? x : best
      }, rest[0])
      rest = rest.filter((x) => x !== opp2)

      const teamA: Team = [seedPlayer, partner]
      const teamB: Team = [opp1, opp2]

      if (get(partnerCount, teamA[0], teamA[1]) > 0) result.repeatPartnerships++
      if (get(partnerCount, teamB[0], teamB[1]) > 0) result.repeatPartnerships++

      inc(partnerCount, teamA[0], teamA[1])
      inc(partnerCount, teamB[0], teamB[1])
      for (const a of teamA) for (const b of teamB) inc(opponentCount, a, b)

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

    result.rounds.push({ round: r + 1, matches, sittingOut })
  }

  return result
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
