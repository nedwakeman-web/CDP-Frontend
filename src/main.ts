/**
 * CDP main entry point.
 *
 * Boots the vessel: the home that meets you, the rooms that emerge from use,
 * the tended space, the lens. It wires only the data layer and the surface,
 * reaching across no boundary it does not own. Storage is LocalStore for now,
 * which is exactly right for a single Alpha tester in a single browser; the
 * Supabase adapter drops in behind the Store interface when the vessel needs
 * to follow a person across devices, with no surface change. Composition is
 * the LocalOrchestrator placeholder; the API-backed orchestrator drops in
 * behind the Orchestrator interface at the next step, with no surface change.
 *
 * The retired reading-app modules under src/modules stay on disk as the seeds
 * of the resource layer (the framework calculation engines for the Tradition
 * lens, the cited retrieval over the consolidated bibliography for the Science
 * lens). They are not wired here, because the surface does not draw on them
 * yet. Nothing built is wasted; everything is moved to a truer position.
 */

import './styles/tokens.css';
import './styles/components.css';
import './styles/vessel.css';

import { mountVessel } from './surface/vessel';
import { ApiOrchestrator, LocalOrchestrator } from './surface/compose';
import type { Orchestrator } from './surface/compose';

/**
 * Where cdp-server lives. The composition endpoint is POST /api/compose/depth.
 * A page can override this by setting window.__CDP_API_BASE__ to another URL,
 * or disable the round-trip entirely by setting it to an empty string, which
 * keeps the vessel on the LocalOrchestrator placeholder for a fully offline or
 * demo session. The substance layer connects here and nowhere else.
 */
const DEFAULT_API_BASE = 'https://cdp-server-production.up.railway.app';

function resolveApiBase(): string {
  const override = (window as { __CDP_API_BASE__?: string }).__CDP_API_BASE__;
  if (typeof override === 'string') return override.trim();
  return DEFAULT_API_BASE;
}

function chooseOrchestrator(): Orchestrator {
  const base = resolveApiBase();
  // An empty base is an explicit offline choice; fall back to the placeholder.
  return base ? new ApiOrchestrator({ apiBase: base }) : new LocalOrchestrator();
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
    root.textContent = 'The vessel could not open just now. Please try again in a moment.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap());
} else {
  void bootstrap();
}
