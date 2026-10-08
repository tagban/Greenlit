# Greenlit

A movie studio management sim, a spiritual successor to the late-90s Mac game Sim Cinema Deluxe.
Pitch a film, buy a script, cast it, manage the shoot, market it and sweat the opening weekend.
Free forever, no accounts, plays offline in any browser and on phones.

## Play it

https://tagban.github.io/Greenlit/

## Run it locally

```bash
npm install
npm run dev
```

## Project layout

- `src/game/` – the simulation, with no UI code. Everything random comes from a seed, so a film can be re-simulated exactly (the future leaderboard's anti-cheat depends on this).
  - `data.ts` – genres, sub-genres, critics and name lists
  - `world.ts` – new games, talent generation, trends, the calendar
  - `sim.ts` – scripts, quality, production events, release calendar, box office
  - `text.ts` – procedural reviews, headlines and the post-release breakdown
  - `store.ts` – game actions, saving and the profanity filter
- `src/screens/` – the UI (mobile-first React)
- `public/art/` – genre posters and logo (hand-made SVG)
- `scripts/balance.ts` – headless balance test: `npx tsx scripts/balance.ts`

## Prototype scope

One film at a time, 6 genres with 36 sub-genres, about 60 generated talent, production events,
test screenings, release calendar with competition, word-of-mouth box office, procedural reviews,
bank loans, autosave and save export. Not yet built: leaderboard, rival studios, eras, awards, app store builds.
