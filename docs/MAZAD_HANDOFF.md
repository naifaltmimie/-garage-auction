# مزاد الكراج — Migration / Backend Handoff

## Product
Real-time party game for 2–8 players. One player hosts a room. Each player gets a fixed budget and an empty garage. Random cars appear one lot at a time, players bid, and the winning car enters the winner's garage. When all garages are full, a hidden category is revealed, everyone secretly rates every other garage 1–10, then the final ranking is revealed from last place to first.

## Important status of this repository
The recovered frontend is wired to `src/MockDriver.tsx`. The UI is real, but multiplayer/networking is not yet wired. Keep the UI and replace the mock adapter rather than redesigning the application.

Published reference: https://garage-auction.naifaltmimie.chatgpt.site

## Game rules
1. Host chooses garage size (3/4/5/6), budget level, bid window (10/15/20/30 seconds), and whether market prices are hidden.
2. Lots continue until all garages are full; there is no fixed lot count.
3. Minimum opening bid may be zero so a broke player cannot become permanently stranded.
4. Each accepted bid extends the clock using `antiSnipeSec`.
5. A player may sell a car back for 50% of what they paid if sell-back is enabled.
6. The category stays hidden until all garages are full.
7. Each player scores every other garage from 1–10 and cannot score their own garage.
8. `score100 = round(sumReceived / (votersCount * 10) * 100)`.
9. Rank high to low; ties are broken by lower total spend. Reveal last place first.

## Frontend state seam
Do not casually rename the public interfaces in `src/types.ts`. The realtime adapter should assemble `GameState` and implement the `Actions` interface so the screens do not need backend-specific code.

Main phases:
- `landing`
- `lobby`
- `auction`
- `theme`
- `vote`
- `results`

`serverNowMs` is authoritative. Countdown UI must be derived from server time and `lot.endsAtMs`; do not implement a client-owned decrementing game clock.

## Recommended architecture
Supabase Postgres + Realtime is the intended backend. The database should be the referee, not a browser client.

```text
React UI -> thin client adapter -> Supabase RPC -> Postgres
   ^                                      |
   +---------- Realtime changes ----------+
```

Rules that can be cheated must live server-side: bid validation, lot settlement, budget deduction, garage capacity, self-vote blocking, vote secrecy, scoring, and ranking.

## Suggested tables
### cars
Reference catalogue with make/model/year/display names, tier, market price, optional specs, source metadata, pool weight, and active flag.

### themes
`id`, `title_ar`, `desc_ar`, `weight`, `is_active`.

### rooms
`code`, `host_id`, `phase`, `settings jsonb`, `theme_id`, `revealed_count`, timestamps, and optional next-action timestamp.

### room_players
Room/player key, display name, remaining budget, join time, heartbeat/last-seen time.

### lots
Room, lot number, car, top bid, top bidder, start/end times, window size, winner/settlement fields.

### bids
Append-only audit trail: room, lot, player, amount, accepted flag, timestamp.

### garage_cars
Room, player, car, paid amount, lot number.

### votes
Room, voter, target, score. Enforce `voter_id <> target_id` and score 1–10 at database level.

## RPC surface
- `create_room(host_name)` — generate collision-free 4-char room code and seed settings.
- `join_room(code, name)` — max 8, prevent inappropriate mid-game joins, support reconnect behavior.
- `update_settings(code, patch)` — host only, lobby only.
- `start_auction(code)` — at least 2 players; reset round and open first lot.
- `place_bid(code, amount)` — transactional row lock; validate lot open, amount, budget, garage capacity; extend anti-snipe timer; return clear result such as `accepted`, `stale`, `too_low`, `broke`, `full`, or `closed`.
- `settle_lot(code)` — server/ticker only; award car and deduct budget; open next lot or transition to theme when every garage is full.
- `submit_votes(code, scores)` — one transaction, every other player exactly once, 1–10 only.
- `finalize_results(code)` — require all votes, compute score and ranking server-side.

## Concurrency
Bids are inherently concurrent. `place_bid` should use a database row lock and re-read the current top bid before accepting. Never let clients overwrite a top bid directly.

## Lot settlement
Do not make the host browser responsible for deciding when a lot closes. Use a server-side scheduled/ticker process so closing still works if the host backgrounds or closes the tab.

## Vote secrecy
During voting, clients should only see whether each player has submitted, not their scores. Deny direct vote reads until results are revealed.

## Car catalogue
The repository includes a newer Saudi car data pack under `car-data/`. Prefer a curated pool over a giant uniform table. Tier-weight the draw so daily cars do not dominate and junk/comedy lots still appear.

Suggested lot share:
- luxury 15%
- sport 20%
- suv 25%
- daily 25%
- junk 15%

Budget calibration target: total garage value across the room should be around 1.2x total available money. A useful rough target is:

`target_median_lot_price ~= (budget_sar * 1.2) / garage_size`

## Images
Car images in the migrated source are incomplete. Use `car-data/manifest.json` and `car-data/fetch_images.py` as references if expanding images. Keep a graceful placeholder when an image is unavailable.

## Migration order
1. Run the current mock frontend and understand every screen/state.
2. Preserve the current Arabic RTL design.
3. Replace `MockDriver` with a thin realtime adapter implementing `Actions`.
4. Create schema, RPC functions, RLS, and server-side lot settlement.
5. Seed the car catalogue from `car-data/cars.csv`.
6. Test two simultaneous bidders and reconnect scenarios before visual polishing.
7. Test at mobile width and desktop.

## Phase 2 ideas — do not build until core multiplayer works
- Blind lot / sealed bids.
- Mystery lot where identity is hidden until won.
- One-use power cards.
- Category awards in addition to numeric ratings.
- Persistent season leaderboard.
