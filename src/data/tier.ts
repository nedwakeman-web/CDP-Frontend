/*
 * CDP Vessel, data layer: tiers.
 *
 * The single source of truth for which tiers exist, what each offers, and which
 * one the person is currently reading through. The blurbs are taken verbatim
 * from the in app guide so the two never drift.
 *
 * Posture for the founding beta: show every tier, let anyone read today through
 * any depth, gate later. The persisted default is oracle, so nothing a current
 * reader sees gets shallower while the gate is still off. When Stripe gating
 * lands, the server clamps the requested tier to the person's entitlement, and
 * this default becomes their actual plan.
 *
 * House style holds: no em dashes, no en dashes, no exclamation marks.
 */

export type TierId = 'free' | 'seeker' | 'initiate' | 'mystic' | 'oracle';

export interface Tier {
  id: TierId;
  label: string;
  /** Display price, GBP, for the raise and the product. */
  price: string;
  /** One line of what the tier opens, matching the guide copy. */
  blurb: string;
}

export const TIERS: Tier[] = [
  { id: 'free', label: 'Free', price: 'Free', blurb: 'Universal Day, moon phase, and Kin. Instant.' },
  { id: 'seeker', label: 'Seeker', price: '\u00a39 a month', blurb: 'All four frameworks, priorities, shadow work, and the week ahead.' },
  { id: 'initiate', label: 'Initiate', price: '\u00a329 a month', blurb: 'Seeker plus the monthly arc, lunation map, and wavespell sequence.' },
  { id: 'mystic', label: 'Mystic', price: '\u00a379 a month', blurb: 'Natal chart integration, the yearly arc, and transit themes.' },
  { id: 'oracle', label: 'Oracle', price: 'Bespoke, by enquiry', blurb: 'Maximum depth across all frameworks, with Hellenistic lots, biorhythms, and an optional hormonal phase.' },
];

const KEY = 'cdp-tier';
const IDS: TierId[] = ['free', 'seeker', 'initiate', 'mystic', 'oracle'];

export function isTier(s: string): s is TierId {
  return (IDS as string[]).indexOf(s) >= 0;
}

/** The tier the person is currently reading through. Defaults to oracle. */
export function getTier(): TierId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && isTier(v)) return v;
  } catch (_e) { /* storage unavailable */ }
  return 'oracle';
}

export function setTier(t: TierId): void {
  try { localStorage.setItem(KEY, t); } catch (_e) { /* storage unavailable */ }
}

export function tierLabel(t: TierId): string {
  const found = TIERS.filter((x) => x.id === t)[0];
  return found ? found.label : t;
}
