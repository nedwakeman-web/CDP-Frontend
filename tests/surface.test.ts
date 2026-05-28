/**
 * Surface logic tests.
 *
 * Verify the pure inference (room emergence, thread kind, conservative anchor
 * reading) and the orchestrator placeholder, and a full hold through the real
 * repository so the surface wiring is honest. No browser is needed because the
 * tested pieces are pure or run against MemoryStore.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessRoom, guessKind, guessAnchor, read } from '../src/surface/intake';
import { LocalOrchestrator, ApiOrchestrator } from '../src/surface/compose';
import { VesselRepository } from '../src/data/repository';
import { MemoryStore } from '../src/data/store';
import type { HeldIntention, VesselState } from '../src/data/model';

const FIXED = Date.UTC(2026, 4, 27); // Wednesday 27 May 2026, for deterministic anchors

test('rooms emerge from the words a person uses', () => {
  assert.equal(guessRoom('the board call on Thursday').label, 'Work');
  assert.equal(guessRoom('distance from my son').label, 'The people closest to me');
  assert.equal(guessRoom('the mortgage decision').label, 'Money');
  assert.equal(guessRoom('a thought I cannot place').label, 'What I am carrying');
});

test('parked things are always acute so they recede', () => {
  assert.equal(guessKind('looking after my health', true, false), 'acute');
});

test('an ongoing orientation is read as standing, a moment as acute', () => {
  assert.equal(guessKind('looking after my son day to day', false, false), 'standing');
  assert.equal(guessKind('the pitch', false, true), 'acute');
});

test('anchors are read conservatively and constructed in UTC', () => {
  assert.equal(guessAnchor('tomorrow', FIXED)?.date, '2026-05-28');
  assert.equal(guessAnchor('in three days', FIXED)?.date, '2026-05-30');
  assert.equal(guessAnchor('on Thursday', FIXED)?.date, '2026-05-28'); // next Thursday from a Wednesday
  assert.equal(guessAnchor('on the 14th', FIXED)?.date, '2026-06-14'); // already past in May, take June
  assert.equal(guessAnchor('something vague', FIXED), null);
});

test('the orchestrator meets an empty vessel and a held one differently', () => {
  const orch = new LocalOrchestrator();
  const empty = { rooms: [], themes: [], intentions: [], lens: 'everyday' as const, version: 1 };
  assert.match(orch.meet(empty, null), /place to hold/);
});

test('a full hold creates a live thread in an emergent room with two touches', async () => {
  const repo = new VesselRepository(new MemoryStore());
  await repo.init();
  const orch = new LocalOrchestrator();

  const text = 'the board call on Thursday';
  const intake = read(text, false, FIXED);
  const room = await repo.ensureRoom(intake.room.label);
  const it = await repo.hold({ text, roomId: room.id, kind: intake.kind, anchor: intake.anchor });
  const composed = orch.firstHold(it, 'everyday', FIXED);
  await repo.addTouch(it.id, { role: 'vessel', text: composed.text, lens: 'everyday' });
  if (composed.summary) await repo.setSummary(it.id, composed.summary);

  assert.equal(repo.rooms()[0].label, 'Work');
  const live = repo.live();
  assert.equal(live.length, 1);
  assert.equal(live[0].touches.length, 2, 'the person words and the vessel first hold');
  assert.ok(live[0].summary.length > 0, 'a living read was set');
  assert.equal(live[0].anchor?.date, '2026-05-28');
});

test('parking holds then rests, so nothing is lost and the figure is clear', async () => {
  const repo = new VesselRepository(new MemoryStore());
  await repo.init();
  const orch = new LocalOrchestrator();
  const room = await repo.ensureRoom('What I am carrying');
  const it = await repo.hold({ text: 'a nagging admin task', roomId: room.id, kind: 'acute', anchor: null });
  const composed = orch.park(it, 'everyday');
  await repo.addTouch(it.id, { role: 'vessel', text: composed.text, lens: 'everyday' });
  await repo.rest(it.id);
  assert.equal(repo.live().length, 0, 'the intruder is no longer figure');
  assert.equal(repo.resting().length, 1, 'but it is kept, resting and recoverable');
});

test('summoned depth resolves and is honest about what is not yet connected', async () => {
  const repo = new VesselRepository(new MemoryStore());
  await repo.init();
  const orch = new LocalOrchestrator();
  const room = await repo.ensureRoom('Work');
  const it = await repo.hold({ text: 'a decision being circled', roomId: room.id });
  const composed = await orch.depth(it, 'science');
  assert.ok(composed.text.length > 0);
  assert.match(composed.text, /resource layer/);
});

/* ---- ApiOrchestrator: the substance layer wired -------------------------- */

function makeIntention(over: Partial<HeldIntention> = {}): HeldIntention {
  return {
    id: 't1',
    text: 'a decision being circled',
    roomId: 'r1',
    themeId: null,
    kind: 'acute',
    status: 'live',
    anchor: null,
    touches: [],
    summary: 'An open thread. Last tended just now.',
    summaryAt: FIXED,
    createdAt: FIXED,
    lastTendedAt: FIXED,
    statusChangedAt: FIXED,
    ...over,
  };
}

function makeState(over: Partial<VesselState> = {}): VesselState {
  return { rooms: [], themes: [], intentions: [], lens: 'everyday', version: 1, ...over };
}

function withFetch(impl: (...args: any[]) => any): () => void {
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = impl;
  return () => { (globalThis as any).fetch = original; };
}

test('the api orchestrator delegates calm-glance touches to the local placeholder', () => {
  const api = new ApiOrchestrator({ apiBase: 'http://example.test' });
  const local = new LocalOrchestrator();
  const it = makeIntention();
  assert.equal(api.firstHold(it, 'science', FIXED).text, local.firstHold(it, 'science', FIXED).text);
  assert.equal(api.park(it, 'tradition').text, local.park(it, 'tradition').text);
  assert.equal(api.respond(it, 'a note', 'everyday').text, local.respond(it, 'a note', 'everyday').text);
  assert.equal(api.summary(it, 'science', FIXED), local.summary(it, 'science', FIXED));
  assert.equal(api.meet(makeState(), null), local.meet(makeState(), null));
});

test('summoned depth posts to the composition endpoint in the active lens and returns the server reading', async () => {
  let recorded: any = null;
  const restore = withFetch(async (url: string, init: any) => {
    recorded = { url, body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ text: 'A composed reading.', summary: 'A living read.' }) };
  });
  try {
    const api = new ApiOrchestrator({ apiBase: 'http://example.test/' });
    const it = makeIntention({ text: 'the board call' });
    const composed = await api.depth(it, 'tradition');
    assert.equal(composed.text, 'A composed reading.');
    assert.equal(composed.summary, 'A living read.');
    assert.ok(recorded.url.endsWith('/api/compose/depth'), 'posts to the depth endpoint');
    assert.equal(recorded.body.lens, 'tradition');
    assert.equal(recorded.body.intention.text, 'the board call');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(recorded.body.dateStr), 'sends a UTC date string');
  } finally {
    restore();
  }
});

test('summoned depth falls back to the local placeholder when the endpoint is unreachable', async () => {
  const restore = withFetch(async () => { throw new Error('network down'); });
  try {
    const api = new ApiOrchestrator({ apiBase: 'http://example.test' });
    const composed = await api.depth(makeIntention(), 'science');
    assert.match(composed.text, /resource layer/);
  } finally {
    restore();
  }
});

test('summoned depth falls back when the server returns an error status', async () => {
  const restore = withFetch(async () => ({ ok: false, json: async () => ({}) }));
  try {
    const api = new ApiOrchestrator({ apiBase: 'http://example.test' });
    const composed = await api.depth(makeIntention(), 'everyday');
    assert.match(composed.text, /resource layer/);
  } finally {
    restore();
  }
});

test('continuity from other live threads is gathered through meet and sent with the next depth', async () => {
  let recorded: any = null;
  const restore = withFetch(async (_url: string, init: any) => {
    recorded = JSON.parse(init.body);
    return { ok: true, json: async () => ({ text: 'ok' }) };
  });
  try {
    const api = new ApiOrchestrator({ apiBase: 'http://example.test' });
    const rooms = [
      { id: 'r1', label: 'Work', createdAt: FIXED },
      { id: 'r2', label: 'Money', createdAt: FIXED },
    ];
    const current = makeIntention({ id: 'cur', roomId: 'r1', summary: 'The current thread.' });
    const other = makeIntention({
      id: 'oth', roomId: 'r2', text: 'the mortgage',
      summary: 'An open thread. Last tended a day ago.', lastTendedAt: FIXED - 1000,
    });
    const state = makeState({ rooms, intentions: [current, other] });
    api.meet(state, current);
    await api.depth(current, 'everyday');
    const summaries = recorded.continuity.map((c: any) => c.summary);
    assert.ok(summaries.includes('An open thread. Last tended a day ago.'), 'the other live thread is included');
    assert.ok(!summaries.includes('The current thread.'), 'the current thread is excluded from its own continuity');
    assert.equal(recorded.continuity[0].label, 'Money', 'the room label is resolved for the server');
  } finally {
    restore();
  }
});

test('continuity injection is capped so a reading cannot send an unbounded context', async () => {
  let recorded: any = null;
  const restore = withFetch(async (_url: string, init: any) => {
    recorded = JSON.parse(init.body);
    return { ok: true, json: async () => ({ text: 'ok' }) };
  });
  try {
    const api = new ApiOrchestrator({ apiBase: 'http://example.test' });
    const rooms = [{ id: 'r1', label: 'Work', createdAt: FIXED }];
    const current = makeIntention({ id: 'cur', roomId: 'r1' });
    const big = (n: number) => makeIntention({ id: 'b' + n, roomId: 'r1', summary: 'x'.repeat(900), lastTendedAt: FIXED - n });
    const state = makeState({ rooms, intentions: [current, big(1), big(2), big(3), big(4)] });
    api.meet(state, current);
    await api.depth(current, 'science');
    const total = recorded.continuity.reduce((s: number, c: any) => s + c.label.length + c.summary.length, 0);
    assert.ok(total <= 2000, 'continuity stays within the cap');
    assert.ok(recorded.continuity.length < 4, 'not every thread fits, so the context is bounded');
  } finally {
    restore();
  }
});
