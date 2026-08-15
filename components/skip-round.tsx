"use client"

import { useState } from "react"
import { Armchair } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface SkipRoundProps {
  /** Current active players. */
  players: string[]
  /** Total rounds in the schedule. */
  totalRounds: number
  /** Suggested round to skip (1-based). */
  defaultRound: number
  onApply: (change: { round: number; benched: string[] }) => void
  onCancel: () => void
}

export function SkipRound({
  players,
  totalRounds,
  defaultRound,
  onApply,
  onCancel,
}: SkipRoundProps) {
  const [round, setRound] = useState(() =>
    Math.min(Math.max(1, defaultRound), totalRounds),
  )
  // Names marked to sit out the chosen round.
  const [benched, setBenched] = useState<Set<string>>(() => new Set())

  const playingAfter = players.filter((p) => !benched.has(p)).length
  const enough = playingAfter >= 4

  function toggleBenched(name: string) {
    setBenched((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function apply() {
    if (!enough || benched.size === 0) return
    onApply({ round, benched: [...benched] })
  }

  const roundOptions = Array.from({ length: totalRounds }, (_, i) => i + 1)

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Armchair className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">Sit out a round</h2>
          <p className="text-sm text-muted-foreground">
            Bench players for one round — they return automatically after.
          </p>
        </div>
      </div>

      {/* Which round to skip */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skip-round">Sit out round</Label>
        <select
          id="skip-round"
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
          className="h-11 rounded-md border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {roundOptions.map((r) => (
            <option key={r} value={r}>
              Round {r}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Only this round changes; earlier rounds stay exactly as played.
        </p>
      </div>

      {/* Who sits out */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Armchair className="size-4 text-muted-foreground" aria-hidden="true" />
          Sitting out this round
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Tap a player to bench them for round {round}. They&rsquo;re back in the
          next round.
        </p>
        <ul className="flex flex-wrap gap-2">
          {players.map((name) => {
            const isBenched = benched.has(name)
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => toggleBenched(name)}
                  aria-pressed={isBenched}
                  className={`inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-3 text-sm font-medium transition-colors ${
                    isBenched
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "bg-secondary text-secondary-foreground hover:border-primary/40"
                  }`}
                >
                  {name}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Validation + actions */}
      <p className="mt-5 text-xs text-muted-foreground">
        {benched.size === 0
          ? "Pick at least one player to sit out."
          : `${benched.size} sitting out, ${playingAfter} playing round ${round}.`}
        {!enough && (
          <span className="font-semibold text-destructive">
            {" "}
            Need at least 4 still playing.
          </span>
        )}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={apply}
          disabled={!enough || benched.size === 0}
          className="h-11 flex-1 rounded-xl font-semibold"
        >
          Apply
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
