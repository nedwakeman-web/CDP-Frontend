/**
 * CDP: Bootstrap and mount the Vessel surface.
 *
 * The Vessel is the primary interaction surface. It holds intentions (the acute,
 * chronic, developmental, systemic concerns a person names), threads them through
 * a composition orchestrator, and renders calm, grounded reflections back.
 *
 * This is the entry point. It mounts Vessel to #app and wires the orchestrator.
 * The orchestrator is switched at boot: if an API base is configured, the real
 * (server-backed) orchestrator is used; otherwise, the browser-side placeholder
 * is used.
 */

import { mountVessel } from './surface/vessel';
import { LocalOrchestrator } from './surface/compose';
import type { Orchestrator } from './surface/compose';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function chooseOrchestrator(): Orchestrator {
  // STAGED: ApiOrchestrator is a future step. For now, always use LocalOrchestrator.
  // At step three (Volume 16), this logic switches: if API_BASE is set, spin up
  // the ApiOrchestrator and it will round-trip to /api/vessel/meet, /api/vessel/hold, etc.
  // Until then, the LocalOrchestrator reflects the held state plainly and honestly.
  return new LocalOrchestrator();
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) {
    // eslint-disable-next-line no-console
    console.error('CDP: no #app root element');
    return;
  }
  try {
    await mountVessel({ root, orchestrator: chooseOrchestrator() });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('CDP: vessel failed to mount', e);
  }
}

// Mount on DOM ready.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
