"use client"

import { useState } from "react"
import { ListPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/** Hard cap on total rounds, matching the entry screen's rounds input. */
const MAX_TOTAL_ROUNDS = 40

interface AddRoundsProps {
  /** Rounds already in the schedule. */
  totalRounds: number
  onApply: (change: { extraRounds: number }) => void
  onCancel: () => void
}

export function AddRounds({ totalRounds, onApply, onCancel }: AddRoundsProps) {
  const headroom = Math.max(0, MAX_TOTAL_ROUNDS - totalRounds)
  const [extraRounds, setExtraRounds] = useState(() => Math.min(2, headroom))

  const options = Array.from({ length: Math.min(headroom, 10) }, (_, i) => i + 1)
  const canApply = extraRounds > 0 && extraRounds <= headroom

  function apply() {
    if (!canApply) return
    onApply({ extraRounds })
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ListPlus className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">Add rounds</h2>
          <p className="text-sm text-muted-foreground">
            Keep every round played so far and draw more on the end.
          </p>
        </div>
      </div>

      {headroom === 0 ? (
        <p className="text-sm text-muted-foreground">
          This session is already at the {MAX_TOTAL_ROUNDS}-round maximum.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="extra-rounds">How many more rounds</Label>
          <select
            id="extra-rounds"
            value={extraRounds}
            onChange={(e) => setExtraRounds(Number(e.target.value))}
            className="h-11 rounded-md border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {options.map((n) => (
              <option key={n} value={n}>
                {n} more {n === 1 ? "round" : "rounds"} (through round {totalRounds + n})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Rounds 1&ndash;{totalRounds} stay exactly as played. The new rounds carry on
            the same rotation: rest stays even, nobody sits twice in a row, and repeat
            partners and opponents are still avoided.
          </p>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="h-11 flex-1 rounded-xl font-semibold"
        >
          Add rounds
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-11 rounded-xl"
        >
          Cancel
        </Button>
      </div>
    </section>
  )
}
