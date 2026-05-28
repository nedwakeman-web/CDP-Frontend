/**
 * Vessel: the CDP surface, the home that meets you.
 * 
 * This is a stub for the staged TypeScript migration.
 * The full surface implementation will be wired here in the next phase.
 * For now, it renders a placeholder and is ready for the orchestrator.
 */

import type { Orchestrator } from './compose';

export interface VesselOptions {
  root: HTMLElement;
  orchestrator: Orchestrator;
}

export async function mountVessel(options: VesselOptions): Promise<void> {
  const { root, orchestrator } = options;

  // Placeholder content while the surface is being migrated.
  root.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <h1 style="font-family: Cinzel, sans-serif; margin-bottom: 1rem;">
        Cosmic Daily Planner
      </h1>
      <p style="font-size: 1.1rem; margin-bottom: 2rem;">
        Your Personal Higher Intelligence
      </p>
      <p style="opacity: 0.7; font-size: 0.95rem;">
        The orchestration layer is live. The surface is being wired.
      </p>
      <p style="opacity: 0.6; font-size: 0.85rem; margin-top: 2rem;">
        Orchestrator status: Ready
      </p>
    </div>
  `;

  // The orchestrator is available here for testing.
  // eslint-disable-next-line no-console
  console.log('Vessel mounted. Orchestrator ready:', orchestrator);
}
