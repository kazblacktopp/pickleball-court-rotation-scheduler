"use client"

import { useState } from "react"
import { Plus, X, Users, Trash2, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PlayerEntryProps {
  players: string[]
  courts: number
  rounds: number
  autoCourts: number
  onAddPlayers: (names: string[]) => void
  onRemovePlayer: (index: number) => void
  onClearAll: () => void
  onCourtsChange: (courts: number) => void
  onRoundsChange: (rounds: number) => void
  onGenerate: () => void
}

export function PlayerEntry({
  players,
  courts,
  rounds,
  autoCourts,
  onAddPlayers,
  onRemovePlayer,
  onClearAll,
  onCourtsChange,
  onRoundsChange,
  onGenerate,
}: PlayerEntryProps) {
  const [value, setValue] = useState("")

  function commit() {
    // Split on newlines and commas so a pasted list works too.
    const names = value
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean)
    if (names.length > 0) {
      onAddPlayers(names)
      setValue("")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    }
  }

  const enoughPlayers = players.length >= 4
  // `autoCourts` already accounts for an extra shared 3-player court when 3
  // players are left over, so it doubles as the highest selectable court count.
  const maxCourts = autoCourts

  return (
    <div className="flex flex-col gap-6">
      {/* Add players */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">Players</h2>
            <p className="text-sm text-muted-foreground">
              {players.length} {players.length === 1 ? "player" : "players"} added
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a name, or paste a list…"
            aria-label="Add player name"
            className="h-11 text-base"
          />
          <Button
            type="button"
            onClick={commit}
            className="h-11 shrink-0 px-4"
            aria-label="Add player"
          >
            <Plus className="size-5" aria-hidden="true" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Tip: paste multiple names separated by commas or new lines.
        </p>

        {players.length > 0 && (
          <>
            <ul className="mt-4 flex flex-wrap gap-2">
              {players.map((name, i) => (
                <li key={`${name}-${i}`}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary py-1.5 pl-3 pr-1.5 text-sm font-medium text-secondary-foreground">
                    {name}
                    <button
                      type="button"
                      onClick={() => onRemovePlayer(i)}
                      className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
                      aria-label={`Remove ${name}`}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <AlertDialog>
              <AlertDialogTrigger className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive">
                <Trash2 className="size-4" aria-hidden="true" />
                Clear all
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all players?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {`This removes all ${players.length} ${
                      players.length === 1 ? "player" : "players"
                    } from the list. This action can't be undone.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onClearAll}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Clear all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </section>

      {/* Session settings */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="size-5" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-bold leading-tight">Session settings</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="courts">Courts</Label>
            <Input
              id="courts"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxCourts}
              value={courts}
              onChange={(e) => onCourtsChange(Number(e.target.value))}
              className="h-11 text-base"
            />
            <p className="text-xs text-muted-foreground">
              Auto: {autoCourts} {autoCourts === 1 ? "court" : "courts"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rounds">Rounds</Label>
            <Input
              id="rounds"
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              value={rounds}
              onChange={(e) => onRoundsChange(Number(e.target.value))}
              className="h-11 text-base"
            />
            <p className="text-xs text-muted-foreground">How many rounds to play</p>
          </div>
        </div>
      </section>

      {!enoughPlayers && (
        <p className="rounded-xl border border-dashed bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
          Add at least <span className="font-semibold text-foreground">4 players</span> to
          generate a rotation.
        </p>
      )}

      <Button
        type="button"
        size="lg"
        disabled={!enoughPlayers}
        onClick={onGenerate}
        className="h-14 rounded-2xl text-base font-semibold shadow-sm"
      >
        Generate rotation
      </Button>
    </div>
  )
}
