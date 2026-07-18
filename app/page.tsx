"use client"

import { useEffect, useReducer, useRef } from "react"
import { RefreshCw, ChevronLeft, Table2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlayerEntry } from "@/components/player-entry"
import { ScheduleTable } from "@/components/schedule-table"
import { CurrentRound } from "@/components/current-round"
import { ThemeToggle } from "@/components/theme-toggle"
import { autoCourts, generateRotation, type RotationResult } from "@/lib/rotation"

const STORAGE_KEY = "pickleball-rotation-v1"

type View = "table" | "courtside"
type Screen = "entry" | "results"

interface State {
  players: string[]
  courts: number
  rounds: number
  courtsTouched: boolean
  seed: number
  result: RotationResult | null
  screen: Screen
  view: View
  currentIndex: number
}

const initialState: State = {
  players: [],
  courts: 1,
  rounds: 8,
  courtsTouched: false,
  seed: 1,
  result: null,
  screen: "entry",
  view: "table",
  currentIndex: 0,
}

type Action =
  | { type: "HYDRATE"; state: State }
  | { type: "ADD_PLAYERS"; names: string[] }
  | { type: "REMOVE_PLAYER"; index: number }
  | { type: "CLEAR_ALL" }
  | { type: "SET_COURTS"; courts: number }
  | { type: "SET_ROUNDS"; rounds: number }
  | { type: "GENERATE" }
  | { type: "REGENERATE" }
  | { type: "SET_SCREEN"; screen: Screen }
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_INDEX"; index: number }

function syncCourts(state: State, players: string[]): number {
  return state.courtsTouched ? state.courts : autoCourts(players.length)
}

function build(state: State): RotationResult {
  return generateRotation(state.players, state.courts, state.rounds, state.seed)
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
      const players = state.players.filter((_, i) => i !== action.index)
      return { ...state, players, courts: syncCourts(state, players) }
    }
    case "CLEAR_ALL":
      return { ...state, players: [], courts: 1, courtsTouched: false }
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
      const next = { ...state, currentIndex: 0, screen: "results" as Screen }
      return { ...next, result: build(next) }
    }
    case "REGENERATE": {
      const next = { ...state, seed: Math.floor(Math.random() * 1_000_000) + 1, currentIndex: 0 }
      return { ...next, result: build(next) }
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

export default function Page() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const hydrated = useRef(false)

  // Load any saved session on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as State
        dispatch({ type: "HYDRATE", state: { ...initialState, ...parsed } })
      }
    } catch {
      // ignore malformed storage
    }
    hydrated.current = true
  }, [])

  // Persist whenever state changes (after initial hydration).
  useEffect(() => {
    if (!hydrated.current) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore quota / serialization errors
    }
  }, [state])

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
          onAddPlayers={(names) => dispatch({ type: "ADD_PLAYERS", names })}
          onRemovePlayer={(index) => dispatch({ type: "REMOVE_PLAYER", index })}
          onClearAll={() => dispatch({ type: "CLEAR_ALL" })}
          onCourtsChange={(courts) => dispatch({ type: "SET_COURTS", courts })}
          onRoundsChange={(rounds) => dispatch({ type: "SET_ROUNDS", rounds })}
          onGenerate={() => dispatch({ type: "GENERATE" })}
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
        <Button
          type="button"
          variant="secondary"
          onClick={() => dispatch({ type: "REGENERATE" })}
          className="rounded-xl"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Reshuffle
        </Button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Players" value={state.players.length} />
        <Stat label="Courts" value={result.effectiveCourts} />
        <Stat label="Rounds" value={result.rounds.length} />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Rest spread: everyone sits {minRest === maxRest ? minRest : `${minRest}–${maxRest}`}{" "}
        {maxRest === 1 && minRest === 1 ? "time" : "times"}.
        {result.repeatPartnerships > 0
          ? ` ${result.repeatPartnerships} repeated partnership${result.repeatPartnerships === 1 ? "" : "s"}.`
          : " No repeated partnerships."}
        {result.hasPartialCourt &&
          " A 3-player court is in use; turns on it rotate evenly and don't count as a sit-out."}
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
