"use client"

import { ChevronLeft, ChevronRight, Armchair } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RotationResult } from "@/lib/rotation"

interface CurrentRoundProps {
  result: RotationResult
  index: number
  onPrev: () => void
  onNext: () => void
}

export function CurrentRound({ result, index, onPrev, onNext }: CurrentRoundProps) {
  const round = result.rounds[index]
  if (!round) return null

  const total = result.rounds.length

  return (
    <div className="flex flex-col gap-4">
      {/* Round stepper */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onPrev}
          disabled={index === 0}
          className="h-14 flex-1 rounded-2xl"
          aria-label="Previous round"
        >
          <ChevronLeft className="size-6" aria-hidden="true" />
          Prev
        </Button>
        <div className="flex min-w-[92px] flex-col items-center">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Round
          </span>
          <span className="font-display text-3xl font-bold leading-none">
            {round.round}
          </span>
          <span className="text-xs text-muted-foreground">of {total}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onNext}
          disabled={index === total - 1}
          className="h-14 flex-1 rounded-2xl"
          aria-label="Next round"
        >
          Next
          <ChevronRight className="size-6" aria-hidden="true" />
        </Button>
      </div>

      {/* Courts */}
      <div className="flex flex-col gap-3">
        {round.matches.map((m) => (
          <div
            key={m.court}
            className="overflow-hidden rounded-2xl border bg-card shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 bg-primary px-4 py-2">
              <span className="font-display text-sm font-bold uppercase tracking-wide text-primary-foreground">
                Court {m.court}
              </span>
              {m.partial && (
                <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                  3-player
                </span>
              )}
            </div>
            {m.teamA && m.teamB ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4">
                <div className="flex flex-col gap-1 text-center">
                  <span className="text-balance font-display text-xl font-bold leading-tight">
                    {m.teamA[0]}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">&amp;</span>
                  <span className="text-balance font-display text-xl font-bold leading-tight">
                    {m.teamA[1]}
                  </span>
                </div>
                <span className="flex size-9 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-accent-foreground">
                  vs
                </span>
                <div className="flex flex-col gap-1 text-center">
                  <span className="text-balance font-display text-xl font-bold leading-tight">
                    {m.teamB[0]}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">&amp;</span>
                  <span className="text-balance font-display text-xl font-bold leading-tight">
                    {m.teamB[1]}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 p-4">
                {m.players.map((name) => (
                  <span
                    key={name}
                    className="text-balance font-display text-xl font-bold leading-tight"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sitting out */}
      {round.sittingOut.length > 0 && (
        <div className="rounded-2xl border border-dashed bg-muted/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Armchair className="size-4" aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Sitting out
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {round.sittingOut.map((name) => (
              <span
                key={name}
                className="rounded-full bg-accent/50 px-3 py-1 font-display text-base font-semibold text-accent-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
