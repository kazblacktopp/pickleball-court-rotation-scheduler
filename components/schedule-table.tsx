"use client"

import type { RotationResult } from "@/lib/rotation"

interface ScheduleTableProps {
  result: RotationResult
}

export function ScheduleTable({ result }: ScheduleTableProps) {
  const { rounds, effectiveCourts } = result
  // Court count can vary per round after a mid-session roster change, so size
  // the columns to the busiest round (falling back to effectiveCourts).
  const courtCount = rounds.reduce((max, r) => Math.max(max, r.matches.length), effectiveCourts)
  const courtNumbers = Array.from({ length: courtCount }, (_, i) => i + 1)
  // Take only as much width as the schedule needs — roughly a comfortable
  // column per court plus the round and sit-out columns — so a small draw stays
  // compact on a wide screen while a big one spreads out instead of scrolling.
  // The floor keeps it aligned with the controls above for one- and two-court
  // draws.
  const maxWidth = Math.max(672, 72 + courtCount * 200 + 168)

  return (
    <div
      className="mx-auto w-full overflow-hidden rounded-2xl border bg-card shadow-sm"
      style={{ maxWidth }}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-3 text-left font-display font-semibold">
                Round
              </th>
              {/* Court columns need a generous floor on a phone, where the table
                  scrolls anyway; a tighter one from tablet up lets another court
                  or two fit before scrolling starts. */}
              {courtNumbers.map((c) => (
                <th
                  key={c}
                  className="min-w-[168px] px-3 py-3 text-left font-display font-semibold md:min-w-[150px]"
                >
                  Court {c}
                </th>
              ))}
              <th className="min-w-[120px] px-3 py-3 text-left font-display font-semibold">
                Sitting Out
              </th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round) => (
              <tr key={round.round} className="border-b last:border-b-0 align-top">
                <td className="sticky left-0 z-10 bg-card px-3 py-3">
                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
                    {round.round}
                  </span>
                </td>
                {courtNumbers.map((c) => {
                  const m = round.matches.find((match) => match.court === c)
                  if (!m) {
                    return (
                      <td key={c} className="px-3 py-3">
                        <span className="text-xs text-muted-foreground">—</span>
                      </td>
                    )
                  }
                  return (
                    <td key={c} className="px-3 py-3">
                      {m.teamA && m.teamB ? (
                        <div className="flex flex-col gap-1 leading-snug">
                          <span className="font-medium">
                            {m.teamA[0]} &amp; {m.teamA[1]}
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            vs
                          </span>
                          <span className="font-medium">
                            {m.teamB[0]} &amp; {m.teamB[1]}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 leading-snug">
                          {m.players.map((name) => (
                            <span key={name} className="font-medium">
                              {name}
                            </span>
                          ))}
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            3-player court
                          </span>
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="px-3 py-3">
                  {round.sittingOut.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {round.sittingOut.map((name) => (
                        <span
                          key={name}
                          className="rounded-md bg-accent/40 px-2 py-0.5 text-xs font-medium text-accent-foreground"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
