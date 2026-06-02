/**
 * Surface logic tests.
 *
 * Verify the orchestrator placeholder reads against the real model types. The
 * tested pieces are pure, so no browser and no server are needed. These build
 * proper HeldIntention and VesselState values from the data layer model rather
 * than the older inline shapes, so the test tracks the single source of truth.
 *
 * House style holds: no em dashes, no en dashes, no exclamation marks.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalOrchestrator } from '../src/surface/compose';
import type { Composed } from '../src/surface/compose';
import { emptyState } from '../src/data/model';
import type { HeldIntention, VesselState } from '../src/data/model';

const FIXED = Date.UTC(2026, 4, 27);

/** Build a valid held intention for the tests, overriding only what matters. */
function intention(over: Partial<HeldIntention> = {}): HeldIntention {
  return {
    id: 'i_test',
    text: 'clarify the board decision',
    roomId: 'r_test',
    themeId: null,
    kind: 'acute',
    status: 'live',
    anchor: null,
    touches: [],
    summary: '',
    summaryAt: 0,
    createdAt: FIXED,
    lastTendedAt: FIXED,
    statusChangedAt: FIXED,
    ...over,
  };
}

test('LocalOrchestrator.meet returns a greeting when nothing is held', () => {
  const state: VesselState = emptyState();
  const orchestrator = new LocalOrchestrator();
  const result = orchestrator.meet(state, null);
  assert.ok(result.includes('place to hold'));
});

test('LocalOrchestrator.meet reflects a held intention with its anchor', () => {
  const it = intention({ anchor: { label: 'The board meeting', date: '2026-05-28' } });
  const state: VesselState = { ...emptyState(), intentions: [it] };
  const orchestrator = new LocalOrchestrator();
  const result = orchestrator.meet(state, it, FIXED);
  assert.ok(result.includes('holding'));
});

test('LocalOrchestrator.firstHold composes a first touch with a living summary', () => {
  const it = intention({ text: 'clarify the decision' });
  const orchestrator = new LocalOrchestrator();
  const result: Composed = orchestrator.firstHold(it, 'everyday');
  assert.ok(result.text.includes('Holding'));
  assert.ok(result.summary);
});
