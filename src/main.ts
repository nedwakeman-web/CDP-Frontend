/**
 * CDP: Bootstrap and mount the Vessel surface.
 *
 * The entry point. It constructs the data layer (a Store, chosen for the moment,
 * wrapped in the VesselRepository), chooses the composition orchestrator, and
 * mounts the Vessel to #app. The surface is handed a repository and an
 * orchestrator and knows nothing about what is behind either, which is what lets
 * the on-device store become the server store at scale with no surface change.
 *
 * Store choice. storeFor() returns the server store for a signed in person on a
 * configured backend, and the on-device store otherwise. Until auth is wired the
 * result is the on-device store, which persists across visits on this device.
 * An explicit offline mode (VITE_OFFLINE) forces the on-device store even when a
 * backend is configured, for safe local development.
 *
 * Orchestrator choice. The server-backed ApiOrchestrator is used by default,
 * because it already degrades to an honest held state when the endpoint is
 * unreachable, so it is safe even before or during a server problem. Gating on a
 * configured API base would be unsafe: the production deploy proxies /api to
 * Railway with an empty VITE_API_BASE, so such a gate would silently fall back to
 * the local placeholder in production, the worst place for it. The local
 * placeholder is selected only in an explicit offline mode, VITE_OFFLINE set to
 * true, or VITE_API_BASE set to the sentinel "local".
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

import { mountVessel } from './surface/vessel';
import { prewarmReading } from './surface/reading';
import { LocalOrchestrator, ApiOrchestrator } from './surface/compose';
import type { Orchestrator } from './surface/compose';
import { VesselRepository } from './data/repository';
import { storeFor } from './data/store';
import { kinDescriptor, lunarWindow, personalNumerology, reduceNumber } from './coordinates-core';
import type { DepthContext } from './surface/compose';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
const OFFLINE = (import.meta.env.VITE_OFFLINE as string | undefined) === 'true' || API_BASE === 'local';

function digitSum(s: string): number {
  let n = 0;
  for (const c of s) { if (c >= '0' && c <= '9') n += Number(c); }
  return n;
}

/**
 * The day coordinates the ask reply uses as scaffold, computed from the core so
 * the server reply is grounded in the same verified Kin, moon, and numerology
 * the surface shows. A gap here is harmless, the reply treats context as scaffold.
 */
function buildCompassContext(repo: VesselRepository): DepthContext {
  const today = new Date().toISOString().slice(0, 10);
  const ctx: DepthContext = { dateStr: today };
  try {
    const k = kinDescriptor(today);
    ctx.kin = k.full;
    ctx.isGAP = k.isGAP;
    const lw = lunarWindow(today);
    if (lw) { ctx.moon = lw.phase; ctx.isBlackMoon = lw.black; ctx.isShivaMoon = lw.shiva; }
    ctx.universalYear = reduceNumber(digitSum(String(new Date().getUTCFullYear()))).value;
    const prof = repo.getProfile();
    if (prof) {
      if (prof.name) ctx.name = prof.name;
      if (prof.birthDate) {
        const pn = personalNumerology(prof.birthDate, today);
        ctx.personalDay = pn.personalDay.value;
        ctx.personalYear = pn.personalYear.value;
      }
    }
  } catch (_e) {
    // context is scaffold only; a gap is acceptable
  }
  return ctx;
}

function chooseOrchestrator(repo: VesselRepository): Orchestrator {
  const local = new LocalOrchestrator();
  if (OFFLINE) return local;
  // The empty base resolves to a relative /api path, which the Netlify proxy
  // forwards to Railway in production. A set base posts directly in dev.
  const base = API_BASE === 'local' ? '' : API_BASE;
  return new ApiOrchestrator(base, local, { contextProvider: () => buildCompassContext(repo) });
}

async function buildRepository(): Promise<VesselRepository> {
  const store = await storeFor({ forceLocal: OFFLINE });
  const repo = new VesselRepository(store);
  await repo.init();
  return repo;
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) {
    // eslint-disable-next-line no-console
    console.error('CDP: no #app root element');
    return;
  }
  try {
    const repo = await buildRepository();
    await mountVessel({ root, orchestrator: chooseOrchestrator(repo), repo });
    // Pre start the reading the instant the app mounts, so the server is already
    // composing the depth before the person opens the reading. Best effort and
    // silent: a failure here never affects the surface. The computed scaffold
    // renders instantly on open regardless, so the page is never blank.
    if (!OFFLINE) {
      const base = API_BASE === 'local' ? '' : API_BASE;
      prewarmReading({
        base,
        tier: 'oracle',
        getProfile: () => {
          const p = repo.getProfile();
          return p ? { birthDate: p.birthDate, birthTime: p.birthTime, birthPlace: p.birthPlace, name: p.name } : null;
        },
        getLens: () => repo.getLens(),
        userId: null,
      });
    }
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
