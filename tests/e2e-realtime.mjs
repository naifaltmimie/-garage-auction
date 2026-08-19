#!/usr/bin/env node
/**
 * Live end-to-end test against a REAL Supabase project.
 *
 * Opens actual Realtime websocket subscriptions and verifies private-channel
 * authorization, Broadcast delivery, RPC membership, direct-table lockdown,
 * disconnect-tolerant voting, and host kick.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  process.exit(2);
}

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function device(label) {
  const c = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`${label}: anonymous sign-in failed — ${error.message}`);
  await c.realtime.setAuth(data.session?.access_token);
  return { label, client: c, id: data.user.id };
}

function subscribe(dev, code, onBroadcast = () => {}) {
  return new Promise((resolve) => {
    const channel = dev.client.channel(`room:${code}`, { config: { private: true } });
    channel.on('broadcast', { event: 'room' }, ({ payload }) => onBroadcast(payload));
    const timer = setTimeout(() => resolve({ status: 'NO_RESPONSE', channel }), 12000);
    channel.subscribe((status, err) => {
      if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        clearTimeout(timer);
        resolve({ status, channel, error: err });
      }
    });
  });
}

const rpc = (dev, fn, args) => dev.client.rpc(fn, args);

async function main() {
  console.log('\nMazad Al-Karaj — live realtime E2E\n');

  const host = await device('host');
  const alice = await device('alice');
  const bob = await device('bob');
  const stranger = await device('stranger');

  const { data: created, error: cErr } = await rpc(host, 'create_room', { host_name: 'نايف' });
  if (cErr) throw new Error(`create_room: ${cErr.message}`);
  const code = created.code;
  console.log(`room ${code}\n`);

  for (const [d, name] of [[alice, 'سلطان'], [bob, 'ماجد']]) {
    const { error } = await rpc(d, 'join_room', { p_code: code, p_name: name });
    if (error) throw new Error(`join_room(${d.label}): ${error.message}`);
  }

  console.log('1. Realtime private channel authorization');
  const received = [];
  const hostSub = await subscribe(host, code);
  const aliceSub = await subscribe(alice, code, (p) => received.push(p));
  check('room member (host) reaches SUBSCRIBED', hostSub.status === 'SUBSCRIBED', hostSub.status);
  check('room member (alice) reaches SUBSCRIBED', aliceSub.status === 'SUBSCRIBED', aliceSub.status);

  const strangerSub = await subscribe(stranger, code);
  check('non-member is rejected (not SUBSCRIBED)', strangerSub.status !== 'SUBSCRIBED', `got ${strangerSub.status}`);

  console.log('\n2. Broadcast delivery');
  await rpc(host, 'update_settings', { p_code: code, patch: { garageSize: 3, level: 'hard', bidWindowSec: 10, antiSnipeSec: 0 } });
  await rpc(host, 'start_auction', { p_code: code });
  await sleep(1200);

  const { data: st } = await rpc(alice, 'get_state', { p_code: code });
  check('auction started', st?.phase === 'auction', st?.phase);
  check('a lot is open', Boolean(st?.lot), 'no lot');

  received.length = 0;
  await rpc(bob, 'place_bid', { p_code: code, amount: 5000 });
  await sleep(1500);
  check('member received the bid broadcast', received.some((p) => p.type === 'bid'), `${received.length} message(s)`);

  console.log('\n3. get_state membership');
  const { error: strangerErr } = await rpc(stranger, 'get_state', { p_code: code });
  check('non-member get_state is rejected', Boolean(strangerErr), 'no error raised');
  const { data: memberState } = await rpc(alice, 'get_state', { p_code: code.toLowerCase() });
  check('member get_state works with a lowercase code', Boolean(memberState));

  console.log('\n4. Client cannot touch game tables');
  for (const t of ['rooms', 'room_players', 'lots', 'bids', 'votes']) {
    const { error } = await alice.client.from(t).select('*').limit(1);
    check(`select ${t} denied`, Boolean(error), 'returned rows');
  }
  const { error: wErr } = await alice.client.from('lots').update({ top_bid_sar: 1 }).neq('id', 0);
  check('update lots denied', Boolean(wErr), 'write succeeded');

  console.log('\n5. Voter disconnects during voting');
  const players = [host, alice, bob];
  const fillDeadline = Date.now() + 150_000;
  while (Date.now() < fillDeadline) {
    const { data: s } = await rpc(host, 'get_state', { p_code: code });
    if (!s || s.phase !== 'auction') break;
    if (s.lot && !s.lot.result) {
      const needy = s.players.find((p) => p.garage.length < s.settings.garageSize);
      const dev = players.find((d) => d.id === needy?.id);
      if (dev) {
        const min = s.lot.topBidderId ? s.lot.topBidSar + 1 : 0;
        await rpc(dev, 'place_bid', { p_code: code, amount: min });
      }
      const waitMs = Math.max(100, Math.min(10_500, s.lot.endsAtMs - s.serverNowMs + 150));
      await sleep(waitMs);
    } else {
      await sleep(300);
    }
    await rpc(host, 'settle_lot', { p_code: code });
  }

  const { data: themeState } = await rpc(host, 'get_state', { p_code: code });
  check('reached the theme phase', themeState?.phase === 'theme', themeState?.phase);

  await rpc(host, 'start_voting', { p_code: code });
  await rpc(host, 'submit_votes', { p_code: code, scores: { [alice.id]: 8, [bob.id]: 5 } });
  await rpc(alice, 'submit_votes', { p_code: code, scores: { [host.id]: 7, [bob.id]: 6 } });

  const { error: earlyErr } = await rpc(host, 'reveal_next', { p_code: code });
  check('reveal is blocked while the missing player is still fresh', Boolean(earlyErr), 'reveal succeeded too early');

  for (let i = 0; i < 50; i++) {
    await sleep(1000);
    await rpc(host, 'get_state', { p_code: code });
    await rpc(alice, 'get_state', { p_code: code });
    const { error } = await rpc(host, 'reveal_next', { p_code: code });
    if (!error) break;
  }

  const { data: finalState } = await rpc(host, 'get_state', { p_code: code });
  check('reveal succeeds after the grace window', finalState?.phase === 'results', finalState?.phase);
  check('every player is still ranked', finalState?.results?.length === 3, `${finalState?.results?.length} row(s)`);
  const bobRow = finalState?.results?.find((r) => r.playerId === bob.id);
  check('the absent player is ranked, not dropped', Boolean(bobRow));

  console.log('\n6. Host kick');
  await rpc(host, 'new_round', { p_code: code });
  const { error: kickErr } = await rpc(host, 'kick_player', { p_code: code, p_player: bob.id });
  check('host can remove a player', !kickErr, kickErr?.message);
  const { error: kickedErr } = await rpc(bob, 'get_state', { p_code: code });
  check('removed player loses access', Boolean(kickedErr));
  const { error: notHostErr } = await rpc(alice, 'kick_player', { p_code: code, p_player: host.id });
  check('non-host cannot kick', Boolean(notHostErr));

  for (const s of [hostSub, aliceSub, strangerSub]) {
    try { await s.channel.unsubscribe(); } catch {}
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n${e.message}\n`);
  process.exit(1);
});
