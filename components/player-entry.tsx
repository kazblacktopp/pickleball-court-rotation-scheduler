"use client"

import { useEffect, useState } from "react"
import { Plus, X, Users, Trash2, ClipboardList, Crown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sitOutsPerRound } from "@/lib/rotation"
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
  host: string | null
  hostSitsOutFirstRound: boolean
  onAddPlayers: (names: string[]) => void
  onRemovePlayer: (index: number) => void
  onClearAll: () => void
  onCourtsChange: (courts: number) => void
  onRoundsChange: (rounds: number) => void
  onSetHost: (name: string | null) => void
  onHostSitsOutChange: (value: boolean) => void
  onGenerate: () => void
}

export function PlayerEntry({
  players,
  courts,
  rounds,
  autoCourts,
  host,
  hostSitsOutFirstRound,
  onAddPlayers,
  onRemovePlayer,
  onClearAll,
  onCourtsChange,
  onRoundsChange,
  onSetHost,
  onHostSitsOutChange,
  onGenerate,
}: PlayerEntryProps) {
  const [value, setValue] = useState("")

  // Courts / rounds inputs keep their own text state so the field can be
  // cleared or partially typed. We push valid numbers up on change and
  // clamp/normalise on blur — a controlled numeric value that coerces every
  // keystroke to a minimum makes the field impossible to edit.
  const [courtsText, setCourtsText] = useState(String(courts))
  const [roundsText, setRoundsText] = useState(String(rounds))
  useEffect(() => setCourtsText(String(courts)), [courts])
  useEffect(() => setRoundsText(String(rounds)), [rounds])

  function handleCourtsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setCourtsText(raw)
    const n = Number(raw)
    if (raw !== "" && Number.isInteger(n) && n >= 1) onCourtsChange(n)
  }

  function commitCourts() {
    const n = Math.round(Number(courtsText))
    const next = Number.isFinite(n) && n >= 1 ? Math.min(n, maxCourts) : courts
    if (next !== courts) onCourtsChange(next)
    setCourtsText(String(next))
  }

  function handleRoundsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setRoundsText(raw)
    const n = Number(raw)
    if (raw !== "" && Number.isInteger(n) && n >= 1) onRoundsChange(n)
  }

  function commitRounds() {
    const n = Math.round(Number(roundsText))
    const next = Number.isFinite(n) && n >= 1 ? Math.min(n, 40) : rounds
    if (next !== rounds) onRoundsChange(next)
    setRoundsText(String(next))
  }

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
  // The host can only opt to sit out round 1 when some player actually has to
  // sit out — i.e. the roster exceeds what the selected courts can seat.
  const canHostSitOut = enoughPlayers && sitOutsPerRound(players.length, courts) > 0

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
              {players.map((name, i) => {
                const isHost = name === host
                return (
                  <li key={`${name}-${i}`}>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border py-1.5 pl-1.5 pr-1.5 text-sm font-medium transition-colors ${
                        isHost
                          ? "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/30"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSetHost(isHost ? null : name)}
                        aria-pressed={isHost}
                        aria-label={isHost ? `${name} is the host — remove host` : `Make ${name} the host`}
                        title={isHost ? "Host — tap to unset" : "Make host"}
                        className={`flex size-5 items-center justify-center rounded-full transition-colors ${
                          isHost
                            ? "text-primary"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <Crown
                          className="size-3.5"
                          aria-hidden="true"
                          {...(isHost ? { fill: "currentColor" } : {})}
                        />
                      </button>
                      <span className="pl-0.5">{name}</span>
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
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Tap the <Crown className="inline size-3 align-[-1px]" aria-hidden="true" /> on a
              player to set them as the host.
            </p>
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

      {!enoughPlayers && (
        <p className="rounded-xl border border-dashed bg-muted/50 px-4 py-3 text-center text-sm text-muted-foreground">
          Add at least <span className="font-semibold text-foreground">4 players</span> to
          generate a rotation.
        </p>
      )}

      {/* Host options — only relevant once a host is chosen */}
      {host && (
        <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Crown className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">Host options</h2>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{host}</span> is the host.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={hostSitsOutFirstRound && canHostSitOut}
            disabled={!canHostSitOut}
            onClick={() => onHostSitsOutChange(!hostSitsOutFirstRound)}
            className="flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors enabled:hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                hostSitsOutFirstRound && canHostSitOut
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-transparent"
              }`}
              aria-hidden="true"
            >
              {hostSitsOutFirstRound && canHostSitOut && <Check className="size-3.5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Host sits out the first round
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {canHostSitOut
                  ? `${host} takes a sit-out in round 1 so a guest gets on court first. Rest stays fair across the session.`
                  : "Available only when there are more players than the courts can seat — right now everyone plays every round."}
              </span>
            </span>
          </button>
        </section>
      )}

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
              value={courtsText}
              onChange={handleCourtsChange}
              onBlur={commitCourts}
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
              value={roundsText}
              onChange={handleRoundsChange}
              onBlur={commitRounds}
              className="h-11 text-base"
            />
            <p className="text-xs text-muted-foreground">How many rounds to play</p>
          </div>
        </div>
      </section>

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
