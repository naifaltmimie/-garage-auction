# Garage Auction

Standalone React + TypeScript + Vite project migrated from the original ChatGPT Sites/Figma Make source.

## Start here
- Read `README_FOR_CLAUDE.md` and `docs/MAZAD_HANDOFF.md` before major changes.
- `src/main.tsx` mounts `src/App.tsx`.
- `src/App.tsx` currently starts `MockDriver`, so the recovered project is still mock-driven until a realtime backend is wired.
- Preserve the Arabic RTL auction UI and existing game flow.
- Use the published site as a visual/behavior reference when accessible: https://garage-auction.naifaltmimie.chatgpt.site

## Run
- `npm install`
- `npm run dev`
- `npm run build`

## Structure
- `src/screens/` — landing, lobby, auction, theme, voting, and results screens.
- `src/components/` — shared auction UI components.
- `src/types.ts` — state and action contract.
- `src/useDerived.ts` — derived game state.
- `car-data/` — newer Saudi vehicle catalogue and image helper files.
- `docs/MAZAD_HANDOFF.md` — intended realtime/multiplayer architecture and implementation notes.

## Rules
- Do not redesign from scratch.
- Do not delete working features while migrating.
- Keep desktop and mobile behavior usable.
- Commit logical working checkpoints.
