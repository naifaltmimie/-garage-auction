# Garage Auction — Claude Transfer

Published site reference:
https://garage-auction.naifaltmimie.chatgpt.site

## What is in this repository

- React + TypeScript + Vite source recovered from the saved `mazad-complete.zip`.
- `docs/MAZAD_HANDOFF.md` — detailed product/state/backend handoff for the multiplayer migration.
- `car-data/` — the newer Saudi vehicle catalogue (167 entries, split across four CSV files).

## Important status

The recovered source is a strong handoff, but its entry point currently uses `src/MockDriver.tsx`. Treat it as the frontend/design/game-flow source, not proof that the latest published ChatGPT Site is byte-for-byte identical.

The published URL could not be fetched by the tools used to assemble this transfer, so Claude should compare the repository against the live URL itself if it has browser access.

The original binary font files and vehicle image binaries are not included in this GitHub migration. The project uses safe fallback/system fonts and includes `public/cars/placeholder.svg` so development can continue immediately.

## Start here in Claude Code

1. Read `CLAUDE.md`, `AGENTS.md`, `docs/MAZAD_HANDOFF.md`, and `car-data/README.md`.
2. Run `npm install`, then `npm run dev`.
3. Run `npm run build` before committing major changes.
4. Preserve the existing Arabic RTL UI and game flow. Do not redesign from scratch.
5. Replace the mock-only wiring with the real multiplayer/realtime implementation described in the handoff.
6. Import/normalize all four catalogue files in `car-data/`: `cars-001-045.csv`, `cars-046-090.csv`, `cars-091-135.csv`, and `cars-136-167.csv`.
7. If adding vehicle images, keep each row's `image_filename` mapping. `car-data/fetch_images.py` can generate a deterministic image-search worklist; source images appropriately rather than inventing filenames.
8. Compare against the published site URL above before changing visuals and preserve current site behavior where it differs from the recovered source.
9. Make the game work well on desktop and mobile.
10. Keep logical checkpoints in Git so every working state is recoverable.

## Suggested first message to Claude

Open this repository as an existing project; do not redesign it from scratch. First read CLAUDE.md, AGENTS.md, docs/MAZAD_HANDOFF.md, and car-data/README.md. Run the current app and summarize what is already implemented versus what is still mock-only. Then make a migration plan to turn it into a real multiplayer auction game while preserving the current Arabic RTL UI. Use the published site https://garage-auction.naifaltmimie.chatgpt.site as the visual/behavior reference if you can access it. Do not delete working features. Commit logical checkpoints.
