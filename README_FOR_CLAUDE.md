# Garage Auction — Claude Transfer

Published site reference:
https://garage-auction.naifaltmimie.chatgpt.site

## What is in this repository

- React + TypeScript + Vite source recovered from the saved `mazad-complete.zip`.
- `docs/MAZAD_HANDOFF.md` — detailed product/state/backend handoff already written for this game.
- `car-data/` — the newer Saudi cars data pack.

## Important status

The recovered source is a strong handoff, but its entry point currently uses the mock driver. Treat it as the frontend/design source, not proof that the latest published ChatGPT Site is byte-for-byte identical.

The current published URL could not be fetched by the tools used to assemble this transfer, so Claude should compare the source against the live URL itself if it has browser access.

## Start here in Claude Code

1. Read `CLAUDE.md`, `AGENTS.md`, and especially `docs/MAZAD_HANDOFF.md`.
2. Run `npm install` then `npm run dev`.
3. Preserve the existing UI and Arabic RTL experience.
4. Replace the mock-only wiring with the real multiplayer/realtime implementation described in the handoff.
5. Import/normalize the newer car catalogue from `car-data/cars.csv` (or `cars_extended.csv`).
6. If images are missing, inspect `car-data/fetch_images.py` and `manifest.json`; do not invent filenames.
7. Before changing visuals, compare against the published site URL above and keep the current site behavior/design where it differs from the older recovered source.
8. Make the game work on desktop and mobile.
9. Keep changes in Git so every working checkpoint is recoverable.

## Suggested first message to Claude

Open this repository as an existing project, do not redesign it from scratch. First read CLAUDE.md, AGENTS.md, docs/MAZAD_HANDOFF.md, and the car-data folder. Run the current app and summarize what is already implemented versus what is still mock-only. Then make a migration plan to turn it into a real multiplayer auction game while preserving the current Arabic RTL UI. Use the published site https://garage-auction.naifaltmimie.chatgpt.site as the visual/behavior reference if you can access it. Do not delete working features. Commit logical checkpoints.
