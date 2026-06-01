/**
 * CDP: Bootstrap and mount the Vessel surface.
 *
 * The Vessel is the primary interaction surface. It holds intentions, threads
 * them through a composition orchestrator, and renders calm, grounded
 * reflections back. This is the entry point. It mounts Vessel to #app and wires
 * the orchestrator.
 *
 * Orchestrator choice. The server-backed ApiOrchestrator is used by default,
 * because it already degrades to an honest held state when the endpoint is
 * unreachable, so it is safe even before or during a server problem. Gating on
 * a configured API base would be unsafe here: the production deploy proxies
 * /api to Railway with an empty VITE_API_BASE, so such a gate would silently
 * fall back to the local placeholder in production, the worst place for it.
 * The local placeholder is therefore selected only in an explicit offline mode,
 * VITE_OFFLINE set to true, or VITE_API_BASE set to the sentinel "local".
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

import { mountVessel } from './surface/vessel';
import { LocalOrchestrator, ApiOrchestrator } from './surface/compose';
import type { Orchestrator } from './surface/compose';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
const OFFLINE = (import.meta.env.VITE_OFFLINE as string | undefined) === 'true' || API_BASE === 'local';

function chooseOrchestrator(): Orchestrator {
  const local = new LocalOrchestrator();
  if (OFFLINE) return local;
  // The empty base resolves to a relative /api path, which the Netlify proxy
  // forwards to Railway in production. A set base posts directly in dev.
  const base = API_BASE === 'local' ? '' : API_BASE;
  return new ApiOrchestrator(base, local);
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
