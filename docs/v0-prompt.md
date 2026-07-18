I want to prototype a Pickleball court player rotations app in React. Here are the requirements:

FEATURES:

* Player entry screen: organiser adds any number of player names (add/remove individually or paste a list), with a court count setting (default: auto-calculated as floor(players ÷ 4)) and a rounds setting (default 8)
* Rotation generator: creates a round-by-round doubles schedule where each round fills the courts with pairs ("Player A & Player B vs Player C & Player D") and lists everyone else as sitting out
* Fairness rules: sit-outs rotate so all players rest a near-equal number of times (max difference of 1); repeated partners and repeated opponents are minimised across the session
* Schedule view: a table with rounds as rows and Court 1…N plus "Sitting Out" as columns, plus a large-text "current round" view with next/previous round buttons for courtside use
* Regenerate button that reshuffles the draw with a new random seed
* Handles awkward player counts gracefully (5, 7, 11, 13 etc.) and shows a friendly message if fewer than 4 players are entered

TECHNICAL REQUIREMENTS:

* React 18+ (Next.js App Router is fine since it will deploy to Vercel)
* Tailwind CSS for styling, mobile-first layout (primary use is on a phone at the venue)
* State management with useState/useReducer only — no external state libraries
* Keep the rotation algorithm in a pure standalone function, e.g. generateRotation(players, courts, rounds, seed), separate from any component code

CONSTRAINTS:

* Session-only data — no backend, no database, no authentication; sessionStorage may be used so a page refresh doesn't lose the schedule
* Must render well at ~380px width; schedule table should scroll or stack sensibly on small screens
* Instant generation — player counts are small (max ~30), so a simple greedy algorithm with fairness scoring is fine; no need for an optimal combinatorial solver
* Modern evergreen browsers only

CONTEXT:
This replaces paper rotation templates used at social pickleball sessions (e.g. 10 players on 2 courts or 15 players on 3 courts over 8 rounds, with sit-outs rotating each round). The app will be pushed to GitHub and auto-deployed on Vercel.

Start with the player entry screen and the schedule table view, then we'll refine the courtside "current round" view and add per-player skill ratings for balanced pairings later.
