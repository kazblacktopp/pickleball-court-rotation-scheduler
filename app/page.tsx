"use client"

import { useEffect, useReducer, useRef, useState } from "react"
import { RefreshCw, ChevronLeft, Table2, Maximize2, Users, Armchair, RotateCcw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { PlayerEntry } from "@/components/player-entry"
import { ScheduleTable } from "@/components/schedule-table"
import { CurrentRound } from "@/components/current-round"
import { RosterChange } from "@/components/roster-change"
import { SkipRound } from "@/components/skip-round"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  autoCourts,
  benchForRound,
  extendRotation,
  generateRotation,
  type RotationResult,
} from "@/lib/rotation"

const STORAGE_KEY = "pickleball-rotation-v1"
/**
 * A saved draw is only restored while it plausibly belongs to the session in
 * progress. Past this age it is a stale rotation from a previous outing, so we
 * start clean rather than dropping the user into last week's schedule.
 */
const STORAGE_MAX_AGE_MS = 12 * 60 * 60 * 1000

interface SavedSession {
  savedAt: number
  state: State
}

type View = "table" | "courtside"
type Screen = "entry" | "results"

interface State {
  players: string[]
  courts: number
  rounds: number
  courtsTouched: boolean
  /** Player flagged as host, if any. */
  host: string | null
  /** Whether the host should sit out round 1 (honoured only when there are sit-outs). */
  hostSitsOutFirstRound: boolean
  seed: number
  result: RotationResult | null
  /** Signature of the inputs that produced `result`, so the entry screen can tell
   *  whether the setup has since changed. Null until the first draw. */
  generatedSignature: string | null
  /** A mid-session "Update roster" change has been applied to the current draw. */
  hadRosterChange: boolean
  /** A one-round "Sit out" bench has been applied to the current draw. */
  hadVoluntarySitOut: boolean
  screen: Screen
  view: View
  currentIndex: number
}

const initialState: State = {
  players: [],
  courts: 1,
  rounds: 8,
  courtsTouched: false,
  host: null,
  hostSitsOutFirstRound: false,
  seed: 1,
  result: null,
  generatedSignature: null,
  hadRosterChange: false,
  hadVoluntarySitOut: false,
  screen: "entry",
  view: "table",
  currentIndex: 0,
}

type Action =
  | { type: "HYDRATE"; state: State }
  | { type: "ADD_PLAYERS"; names: string[] }
  | { type: "REMOVE_PLAYER"; index: number }
  | { type: "CLEAR_ALL" }
  | { type: "NEW_SESSION" }
  | { type: "SET_COURTS"; courts: number }
  | { type: "SET_ROUNDS"; rounds: number }
  | { type: "SET_HOST"; name: string | null }
  | { type: "SET_HOST_SITS_OUT"; value: boolean }
  | { type: "GENERATE" }
  | { type: "REGENERATE" }
  | { type: "APPLY_ROSTER_CHANGE"; firstRound: number; courts: number; add: string[]; remove: string[] }
  | { type: "SKIP_ROUND"; round: number; benched: string[] }
  | { type: "SET_SCREEN"; screen: Screen }
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_INDEX"; index: number }

function syncCourts(state: State, players: string[]): number {
  return state.courtsTouched ? state.courts : autoCourts(players.length)
}

function build(state: State): RotationResult {
  return generateRotation(state.players, state.courts, state.rounds, state.seed, {
    host: state.host,
    hostSitsOutFirstRound: state.hostSitsOutFirstRound,
  })
}

/** A stable fingerprint of every input that shapes the draw (the random seed
 *  aside). Comparing it against `generatedSignature` tells us whether the setup
 *  has changed since the current draw was produced. */
function inputsSignature(state: State): string {
  return JSON.stringify({
    players: state.players,
    courts: state.courts,
    rounds: state.rounds,
    host: state.host,
    hostSitsOutFirstRound: state.hostSitsOutFirstRound,
  })
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return action.state
    case "ADD_PLAYERS": {
      const existing = new Set(state.players.map((p) => p.toLowerCase()))
      const additions = action.names.filter((n) => {
        const key = n.toLowerCase()
        if (existing.has(key)) return false
        existing.add(key)
        return true
      })
      const players = [...state.players, ...additions]
      return { ...state, players, courts: syncCourts(state, players) }
    }
    case "REMOVE_PLAYER": {
      const removed = state.players[action.index]
      const players = state.players.filter((_, i) => i !== action.index)
      const host = removed === state.host ? null : state.host
      return { ...state, players, host, courts: syncCourts(state, players) }
    }
    case "CLEAR_ALL":
      return {
        ...state,
        players: [],
        courts: 1,
        courtsTouched: false,
        host: null,
        hostSitsOutFirstRound: false,
      }
    case "NEW_SESSION":
      // Full reset back to an empty entry screen, discarding the saved draw.
      return initialState
    case "SET_HOST":
      // Toggling off the host also drops the sit-out option that depends on it.
      return {
        ...state,
        host: action.name,
        hostSitsOutFirstRound: action.name ? state.hostSitsOutFirstRound : false,
      }
    case "SET_HOST_SITS_OUT":
      return { ...state, hostSitsOutFirstRound: action.value }
    case "SET_COURTS":
      return {
        ...state,
        courtsTouched: true,
        courts: Number.isFinite(action.courts) ? Math.max(1, action.courts) : 1,
      }
    case "SET_ROUNDS":
      return {
        ...state,
        rounds: Number.isFinite(action.rounds) ? Math.max(1, action.rounds) : 1,
      }
    case "GENERATE": {
      // A fresh draw clears any prior mid-session change markers.
      const next = {
        ...state,
        currentIndex: 0,
        screen: "results" as Screen,
        hadRosterChange: false,
        hadVoluntarySitOut: false,
      }
      return { ...next, result: build(next), generatedSignature: inputsSignature(next) }
    }
    case "REGENERATE": {
      const next = {
        ...state,
        seed: Math.floor(Math.random() * 1_000_000) + 1,
        currentIndex: 0,
        hadRosterChange: false,
        hadVoluntarySitOut: false,
      }
      return { ...next, result: build(next), generatedSignature: inputsSignature(next) }
    }
    case "APPLY_ROSTER_CHANGE": {
      if (!state.result) return state

      // New active roster: drop early departures, fold in deduped late arrivals.
      const removeSet = new Set(action.remove)
      const kept = state.players.filter((p) => !removeSet.has(p))
      const existing = new Set(kept.map((p) => p.toLowerCase()))
      const additions = action.add.filter((n) => {
        const key = n.trim().toLowerCase()
        if (!key || existing.has(key)) return false
        existing.add(key)
        return true
      })
      const players = [...kept, ...additions.map((n) => n.trim())]

      // Not enough players left to run a court — ignore (UI blocks this too).
      if (players.length < 4) return state

      const totalRounds = state.result.rounds.length
      const firstRound = Math.min(Math.max(1, action.firstRound), totalRounds)
      const lockedRounds = state.result.rounds.slice(0, firstRound - 1)
      // Court count comes straight from the panel — never auto-bumped by a
      // roster change. Clamp to what the new player count can actually fill.
      const courts = Math.min(Math.max(1, action.courts), autoCourts(players.length))
      const seed = Math.floor(Math.random() * 1_000_000) + 1
      const result = extendRotation(lockedRounds, players, courts, totalRounds, seed)

      // If the host is one of the departing players, drop the flag with them.
      const host = state.host && removeSet.has(state.host) ? null : state.host

      // Mark courts as manually set so later edits don't silently re-sync either.
      const nextState = {
        ...state,
        players,
        courts,
        courtsTouched: true,
        host,
        hostSitsOutFirstRound: host ? state.hostSitsOutFirstRound : false,
        seed,
        result,
        hadRosterChange: true,
      }
      // The draw now reflects the new roster, so re-baseline the signature.
      return { ...nextState, generatedSignature: inputsSignature(nextState) }
    }
    case "SKIP_ROUND": {
      if (!state.result) return state

      // Benched players sit out one round only; the roster itself is unchanged.
      const benchedSet = new Set(action.benched)
      const available = state.players.filter((p) => !benchedSet.has(p))
      // Need at least a full court left to play the round (UI blocks this too).
      if (available.length < 4) return state

      const totalRounds = state.result.rounds.length
      const round = Math.min(Math.max(1, action.round), totalRounds)
      const lockedRounds = state.result.rounds.slice(0, round - 1)
      const seed = Math.floor(Math.random() * 1_000_000) + 1
      const result = benchForRound(
        lockedRounds,
        state.players,
        [...benchedSet],
        state.courts,
        totalRounds,
        seed,
      )

      // Jump the Courtside stepper to the round the skip takes effect. The roster
      // itself is unchanged, so the signature stays as-is.
      return {
        ...state,
        seed,
        result,
        currentIndex: round - 1,
        hadVoluntarySitOut: true,
        generatedSignature: inputsSignature(state),
      }
    }
    case "SET_SCREEN":
      return { ...state, screen: action.screen }
    case "SET_VIEW":
      return { ...state, view: action.view }
    case "SET_INDEX": {
      const max = (state.result?.rounds.length ?? 1) - 1
      return { ...state, currentIndex: Math.min(Math.max(0, action.index), max) }
    }
    default:
      return state
  }
}

function save(state: State) {
  try {
    const payload: SavedSession = { savedAt: Date.now(), state }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / serialization errors
  }
}

export default function Page() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const hydrated = useRef(false)

  // Load any saved session on mount. localStorage (not sessionStorage) so the
  // draw survives the OS discarding the tab — which is what happens whenever the
  // phone is locked for a few minutes mid-session.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as SavedSession
        const age = Date.now() - (saved?.savedAt ?? 0)
        if (saved?.state && age >= 0 && age < STORAGE_MAX_AGE_MS) {
          dispatch({ type: "HYDRATE", state: { ...initialState, ...saved.state } })
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {
      // ignore malformed storage
    }
    hydrated.current = true
  }, [])

  // Persist whenever state changes (after initial hydration).
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    if (!hydrated.current) return
    save(state)
  }, [state])

  // Backstop for the discard path: iOS can freeze or kill a backgrounded tab
  // without running anything further, so flush on the way out as well.
  useEffect(() => {
    const flush = () => {
      if (hydrated.current) save(latest.current)
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", flush)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", flush)
    }
  }, [])

  const showResults = state.screen === "results" && state.result

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <span className="font-display text-xl font-bold" aria-hidden="true">
            P
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight">
            Pickleball Rotations
          </h1>
          <p className="text-sm text-muted-foreground">Fair doubles draws for social play</p>
        </div>
        <ThemeToggle />
      </header>

      {!showResults ? (
        <PlayerEntry
          players={state.players}
          courts={state.courts}
          rounds={state.rounds}
          autoCourts={autoCourts(state.players.length)}
          host={state.host}
          hostSitsOutFirstRound={state.hostSitsOutFirstRound}
          onAddPlayers={(names) => dispatch({ type: "ADD_PLAYERS", names })}
          onRemovePlayer={(index) => dispatch({ type: "REMOVE_PLAYER", index })}
          onClearAll={() => dispatch({ type: "CLEAR_ALL" })}
          onCourtsChange={(courts) => dispatch({ type: "SET_COURTS", courts })}
          onRoundsChange={(rounds) => dispatch({ type: "SET_ROUNDS", rounds })}
          onSetHost={(name) => dispatch({ type: "SET_HOST", name })}
          onHostSitsOutChange={(value) => dispatch({ type: "SET_HOST_SITS_OUT", value })}
          onGenerate={() => dispatch({ type: "GENERATE" })}
          hasExistingDraw={state.result != null}
          settingsChanged={inputsSignature(state) !== state.generatedSignature}
          onBackToResults={
            state.result
              ? () => dispatch({ type: "SET_SCREEN", screen: "results" })
              : undefined
          }
        />
      ) : (
        <Results state={state} dispatch={dispatch} />
      )}
    </main>
  )
}

function Results({
  state,
  dispatch,
}: {
  state: State
  dispatch: React.Dispatch<Action>
}) {
  const result = state.result as RotationResult
  const restValues = Object.values(result.sitOutCounts)
  const minRest = restValues.length ? Math.min(...restValues) : 0
  const maxRest = restValues.length ? Math.max(...restValues) : 0
  const [rosterOpen, setRosterOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)

  // Note which mid-session changes shaped this draw, so a wider rest spread reads
  // as expected rather than a bug.
  const changeQualifier =
    state.hadRosterChange && state.hadVoluntarySitOut
      ? " (roster changed + voluntary sit out)"
      : state.hadRosterChange
        ? " (roster changed)"
        : state.hadVoluntarySitOut
          ? " (voluntary sit out)"
          : ""

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "entry" })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Edit players
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSkipOpen((o) => !o)
              setRosterOpen(false)
            }}
            aria-expanded={skipOpen}
            className="rounded-xl aria-expanded:bg-primary aria-expanded:text-primary-foreground aria-expanded:hover:bg-primary/90"
          >
            <Armchair className="size-4" aria-hidden="true" />
            Sit out next round
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setRosterOpen((o) => !o)
              setSkipOpen(false)
            }}
            aria-expanded={rosterOpen}
            className="rounded-xl aria-expanded:bg-primary aria-expanded:text-primary-foreground aria-expanded:hover:bg-primary/90"
          >
            <Users className="size-4" aria-hidden="true" />
            Update roster
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => dispatch({ type: "REGENERATE" })}
            className="rounded-xl"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Reshuffle
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              className={buttonVariants({ variant: "ghost", className: "rounded-xl" })}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              New session
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start a new session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This discards the saved rotation and all player names, and returns to an
                  empty entry screen. This action can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => dispatch({ type: "NEW_SESSION" })}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Start new session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {skipOpen && (
        <SkipRound
          players={state.players}
          totalRounds={result.rounds.length}
          defaultRound={state.currentIndex + 2}
          onCancel={() => setSkipOpen(false)}
          onApply={(change) => {
            dispatch({ type: "SKIP_ROUND", ...change })
            setSkipOpen(false)
          }}
        />
      )}

      {rosterOpen && (
        <RosterChange
          players={state.players}
          totalRounds={result.rounds.length}
          defaultFirstRound={state.currentIndex + 2}
          currentCourts={result.effectiveCourts}
          onCancel={() => setRosterOpen(false)}
          onApply={(change) => {
            dispatch({ type: "APPLY_ROSTER_CHANGE", ...change })
            setRosterOpen(false)
          }}
        />
      )}

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Players" value={state.players.length} />
        <Stat label="Courts" value={result.effectiveCourts} />
        <Stat label="Rounds" value={result.rounds.length} />
      </div>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        {`Everyone sits ${minRest === maxRest ? minRest : `${minRest}–${maxRest}`} ${maxRest === 1 && minRest === 1 ? "time" : "times"}`}
        {changeQualifier}
        {" · "}
        {result.repeatPartnerships > 0
          ? `${result.repeatPartnerships} repeated partnership${result.repeatPartnerships === 1 ? "" : "s"}`
          : "no repeated partnerships"}
        {result.hasPartialCourt && " · 3-player court in use"}
      </p>

      {/* View toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/50 p-1">
        <ToggleButton
          active={state.view === "table"}
          onClick={() => dispatch({ type: "SET_VIEW", view: "table" })}
        >
          <Table2 className="size-4" aria-hidden="true" />
          Schedule
        </ToggleButton>
        <ToggleButton
          active={state.view === "courtside"}
          onClick={() => dispatch({ type: "SET_VIEW", view: "courtside" })}
        >
          <Maximize2 className="size-4" aria-hidden="true" />
          Courtside
        </ToggleButton>
      </div>

      {state.view === "table" ? (
        <ScheduleTable result={result} />
      ) : (
        <CurrentRound
          result={result}
          index={state.currentIndex}
          onPrev={() => dispatch({ type: "SET_INDEX", index: state.currentIndex - 1 })}
          onNext={() => dispatch({ type: "SET_INDEX", index: state.currentIndex + 1 })}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
      <div className="font-display text-2xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}
