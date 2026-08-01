"use client"

import { useMemo, useState } from "react"
import { Plus, X, UserPlus, UserMinus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { autoCourts } from "@/lib/rotation"

interface RosterChangeProps {
  /** Current active players (departures not yet removed). */
  players: string[]
  /** Total rounds in the schedule. */
  totalRounds: number
  /** Suggested first round to redraw (1-based). */
  defaultFirstRound: number
  /** Court count currently in use — kept unless the organiser changes it here. */
  currentCourts: number
  onApply: (change: {
    firstRound: number
    courts: number
    add: string[]
    remove: string[]
  }) => void
  onCancel: () => void
}

export function RosterChange({
  players,
  totalRounds,
  defaultFirstRound,
  currentCourts,
  onApply,
  onCancel,
}: RosterChangeProps) {
  const [firstRound, setFirstRound] = useState(() =>
    Math.min(Math.max(1, defaultFirstRound), totalRounds),
  )
  // Names (from the current roster) marked as leaving.
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set())
  // Pending late arrivals.
  const [additions, setAdditions] = useState<string[]>([])
  const [value, setValue] = useState("")
  // Court count defaults to what's already in use and only changes if the
  // organiser picks a different value here — never auto-bumped by roster size.
  const [courts, setCourts] = useState(currentCourts)

  const existingKeys = useMemo(
    () => new Set([...players, ...additions].map((p) => p.toLowerCase())),
    [players, additions],
  )

  const activeAfter = players.filter((p) => !leaving.has(p)).length + additions.length
  const enough = activeAfter >= 4
  // Most courts the resulting roster can fill; keep the selection in range.
  const maxCourts = enough ? autoCourts(activeAfter) : Math.max(1, currentCourts)
  const courtsValue = Math.min(Math.max(1, courts), maxCourts)
  const autoSuggestion = enough ? autoCourts(activeAfter) : maxCourts

  function toggleLeaving(name: string) {
    setLeaving((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function addNames() {
    const names = value
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean)
    if (names.length === 0) return
    setAdditions((prev) => {
      const keys = new Set([...existingKeys])
      const next = [...prev]
      for (const n of names) {
        const key = n.toLowerCase()
        if (keys.has(key)) continue
        keys.add(key)
        next.push(n)
      }
      return next
    })
    setValue("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === "Enter") {
      e.preventDefault()
      addNames()
    }
  }

  function removeAddition(name: string) {
    setAdditions((prev) => prev.filter((n) => n !== name))
  }

  function apply() {
    if (!enough) return
    onApply({
      firstRound,
      courts: courtsValue,
      add: additions,
      remove: [...leaving],
    })
  }

  const roundOptions = Array.from({ length: totalRounds }, (_, i) => i + 1)
  const courtOptions = Array.from({ length: maxCourts }, (_, i) => i + 1)

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <RotateCcw className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">Update roster</h2>
          <p className="text-sm text-muted-foreground">
            Keep played rounds, redraw the rest with fairness carried over.
          </p>
        </div>
      </div>

      {/* Redraw-from-round selector */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="first-round">Redraw from round</Label>
        <select
          id="first-round"
          value={firstRound}
          onChange={(e) => setFirstRound(Number(e.target.value))}
          className="h-11 rounded-md border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {roundOptions.map((r) => (
            <option key={r} value={r}>
              Round {r}
              {r === 1 ? " (redraw everything)" : ` — keep rounds 1–${r - 1}`}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Rounds before this stay exactly as played.
        </p>
      </div>

      {/* Courts — manual; a roster change never bumps this on its own */}
      <div className="mt-5 flex flex-col gap-1.5">
        <Label htmlFor="roster-courts">Courts</Label>
        <select
          id="roster-courts"
          value={courtsValue}
          onChange={(e) => setCourts(Number(e.target.value))}
          className="h-11 rounded-md border border-input bg-transparent px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {courtOptions.map((c) => (
            <option key={c} value={c}>
              {c} {c === 1 ? "court" : "courts"}
              {c === autoSuggestion ? " (auto)" : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Stays at your current {currentCourts}{" "}
          {currentCourts === 1 ? "court" : "courts"} unless you change it here.
        </p>
      </div>

      {/* Early departures */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <UserMinus className="size-4 text-muted-foreground" aria-hidden="true" />
          Leaving early
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Tap a player to remove them from the redrawn rounds.
        </p>
        <ul className="flex flex-wrap gap-2">
          {players.map((name) => {
            const isLeaving = leaving.has(name)
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => toggleLeaving(name)}
                  aria-pressed={isLeaving}
                  className={`inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-3 text-sm font-medium transition-colors ${
                    isLeaving
                      ? "border-destructive/40 bg-destructive/10 text-destructive line-through"
                      : "bg-secondary text-secondary-foreground hover:border-destructive/40"
                  }`}
                >
                  {name}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Late arrivals */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
          Arriving late
        </div>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a name…"
            aria-label="Add late arrival"
            className="h-11 text-base"
          />
          <Button
            type="button"
            onClick={addNames}
            className="h-11 shrink-0 px-4"
            aria-label="Add late arrival"
          >
            <Plus className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
        {additions.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {additions.map((name) => (
              <li key={name}>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary py-1.5 pl-3 pr-1.5 text-sm font-medium text-secondary-foreground">
                  {name}
                  <button
                    type="button"
                    onClick={() => removeAddition(name)}
                    className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Validation + actions */}
      <p className="mt-5 text-xs text-muted-foreground">
        {activeAfter} {activeAfter === 1 ? "player" : "players"} after this change.
        {!enough && (
          <span className="font-semibold text-destructive">
            {" "}
            Need at least 4 to keep playing.
          </span>
        )}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={apply}
          disabled={!enough}
          className="h-11 flex-1 rounded-xl font-semibold"
        >
          Apply changes
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
