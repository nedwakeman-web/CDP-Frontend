/**
 * Surface logic tests.
 *
 * Verify the pure inference (room emergence, thread kind, conservative anchor
 * reading) and the orchestrator placeholder, and a full hold through the real
 * repository so the surface wiring is honest. No browser is needed because the
 * tested pieces are pure or run against MemoryStore.
 *
 * STAGED: Tests below are placeholders pending full intake, repository, and store
 * implementation at step three of the Volume 16 sequence.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalOrchestrator, type Composed, type HeldIntention, type VesselState } from '../src/surface/compose';

const FIXED = Date.UTC(2026, 4, 27);

test('LocalOrchestrator.meet returns greeting when no intention is held', () => {
  const state: VesselState = { intentions: [], rooms: {} };
  const orchestrator = new LocalOrchestrator();
  const result = orchestrator.meet(state, null);
  assert.ok(result.includes('place to hold'));
});

test('LocalOrchestrator.meet reflects held intention', () => {
  const intention: HeldIntention = {
    text: 'clarify the board decision',
    kind: 'acute',
    anchor: '2026-05-28'
  };
  const state: VesselState = { intentions: [intention], rooms: {} };
  const orchestrator = new LocalOrchestrator();
  const result = orchestrator.meet(state, intention, FIXED);
  assert.ok(result.includes('holding'));
});

test('LocalOrchestrator.firstHold composes a first touch', () => {
  const intention: HeldIntention = {
    text: 'clarify the decision',
    kind: 'acute',
    anchor: null
  };
  const orchestrator = new LocalOrchestrator();
  const result = orchestrator.firstHold(intention, 'everyday');
  assert.ok(result.text.includes('Holding'));
  assert.ok(result.summary);
});
