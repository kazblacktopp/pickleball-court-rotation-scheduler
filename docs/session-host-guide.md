# Pickleball Rotations — quick guide for session hosts

## What it is

A phone-friendly web app that builds a fair doubles rotation for a social pickleball session. You type in who turned up, tell it how many courts and rounds you have, and it produces a round-by-round draw: who plays with whom, on which court, and who sits out each round.

There are no accounts and no logins. Everything runs in your browser, and the session is saved on your phone (for up to 12 hours) so an accidental refresh doesn't lose the draw.

## Running a session

1. **Enter the players.** Type a name and hit Enter, or paste a whole list at once (comma separated). You need at least 4 players.
2. **Set courts and rounds.** Courts defaults to as many as the player count can fill; rounds defaults to 8. Maximum 40 rounds.
3. *(Optional)* **Flag yourself as host.** Tap a player to mark them host, then turn on "Host sits out the first round" — the traditional courtesy of letting a guest on court first. Only offered when someone has to sit out anyway.
4. **Generate rotation.** The schedule appears.

## The results screen

- **Schedule** view — the full table: one row per round, a column per court plus who's sitting out. Good for printing or scanning ahead.
- **Courtside** view — one round at a time in large text, with next/previous arrows. This is the view to use at the venue.
- **Summary line** — tells you the rest spread ("everyone sits 1–2 times"), how many repeated partnerships the draw contains, and whether a 3-player court is in use.

## Mid-session controls

Real sessions change. The following three buttons handle it without throwing away the rounds already played:

- **Sit out next round** — bench one or more players for a single round (water break, phone call). The round is guaranteed not to put them on court and they come back automatically the round after. 
- **Update roster** — someone leaves early or arrives late. Pick who's in and out and which round the change starts from; earlier rounds stay exactly as played.
- **Add rounds** — everyone's still keen and there's court time left. Appends 1–10 more rounds onto the end of the existing schedule instead of redrawing.

The following two buttons discard any rounds already played. Both ask for confirmation before making any changes to the draw:

- **Reshuffle** — don't like the draw? Regenerates it from scratch with a new shuffle. ***Use this before play starts, not partway through.***
- **New session** — clears everything and starts over. It asks for confirmation first, and can't be undone.

Important: only **Reshuffle** and **New session** discard rounds. The other controls keep every round already played verbatim.

## How it keeps things fair

The draw balances four things, in priority order:

- **No back-to-back rests** — nobody sits out two rounds in a row unless there's genuinely no alternative.
- **Equal rest** — total sit-outs, per player, across the session stay within one of each other.
- **Partner variety** — repeat partnerships are minimised.
- **Opponent variety** — repeat matchups are minimised as a secondary goal.

These carry across mid-session changes: when you add a late arrival or bench someone for a round, the app replays the history from the rounds already played and continues from there, rather than starting the fairness count over.

## Odd player counts

Courts hold 4 for doubles. If exactly 3 players are left over, the app opens a shared 3-player court rather than benching them; one or two leftovers sit out instead. Turns on the 3-player court rotate around the group like sit-outs do.

## Tips

- Use **Courtside** view during play and call the round off the phone.
- Reshuffle freely *before* round 1; after play starts, use the mid-session controls instead so you don't lose the record.
- Dark/light mode toggle sits in the top right if the screen is hard to read in sunlight.
