/**
 * CDP Vessel, data layer: the domain model.
 *
 * This is the substance of a person's life as the vessel holds it. It is
 * modelled once and modelled well, because it is the thing that must survive
 * every future change of surface, orchestration, and resource. Nothing above
 * this layer defines its own shape for these objects; they import from here.
 * That single rule is what heals the type fork that opened when an earlier
 * surface declared its own HeldIntention inline.
 *
 * The model encodes the doctrine of Strategic Foundation Volume 16:
 *   - Rooms are the few standing domains of a life. They persist, they are
 *     capped, they emerge from use, they are never configured.
 *   - Themes emerge fractally from threads (the relationship with a child,
 *     gathered from its episodes). A life has few standing themes.
 *   - Held intentions (threads) are the open loops. They have a kind that
 *     gives them a natural half-life: acute resolves and recedes, standing
 *     persists and is returned to, lifetime endures.
 *   - Touches are the tended record within a thread.
 *   - Nothing is ever destroyed. A thread is live or resting; both are
 *     fully recoverable. There is no hard delete in the model.
 *
 * House style holds in this file: no em dashes, no en dashes, no exclamation
 * marks, in code and in comments alike.
 */

/** A lens is how a person chooses to read the coordinates, not a different truth. */
export type Lens = 'tradition' | 'science' | 'everyday';

/**
 * The natural half-life of a held thing. Inferred from how the person holds
 * it, never configured. Governs gravity and whether the vessel ever offers
 * a sense of completion.
 *   - acute:    has or implies a moment; resolves and sinks fast after it
 *   - standing: an ongoing orientation (healthy living, a relationship theme);
 *               never asked to resolve; returned to on a rhythm
 *   - lifetime: identity-level; endures as ground
 */
export type ThreadKind = 'acute' | 'standing' | 'lifetime';

/** Live, or resting. Resting is fully recoverable. There is no third, destructive state. */
export type ThreadStatus = 'live' | 'resting';

/** A single tended entry within a thread. Either the person's words or a composed touch. */
export interface Touch {
  id: string;
  role: 'person' | 'vessel';
  text: string;
  /** A touch can be a light hold or summoned depth; depth is rendered differently. */
  depth?: boolean;
  /** The lens this touch was composed in, when it was a vessel touch. */
  lens?: Lens;
  createdAt: number;
}

/** A future moment a thread is anchored to: the meeting, the appointment, the deadline. */
export interface Anchor {
  label: string;
  /** ISO date (YYYY-MM-DD), UTC-constructed upstream. Optional: some anchors are vague. */
  date?: string;
}

/**
 * A held intention: an open loop the person is carrying. The central object.
 */
export interface HeldIntention {
  id: string;
  /** What the person said they are holding, verbatim, preserved. */
  text: string;
  roomId: string;
  /** Set once the thread has been gathered into an emergent theme; null until then. */
  themeId: string | null;
  kind: ThreadKind;
  status: ThreadStatus;
  anchor: Anchor | null;
  touches: Touch[];
  /** A living, composed read of where this thread stands. Refreshed as it changes. */
  summary: string;
  summaryAt: number;
  createdAt: number;
  /** Last time the person engaged the thread. Drives gravity. */
  lastTendedAt: number;
  /** When the thread last changed status (live to resting and back). */
  statusChangedAt: number;
}

/**
 * A theme: a standing pattern that has emerged from related threads within a
 * room (the relationship with a child, a thread of grief, a recurring decision).
 * Emerges fractally from threads; a life has few.
 */
export interface Theme {
  id: string;
  roomId: string;
  label: string;
  /** Thread ids gathered under this theme. */
  threadIds: string[];
  createdAt: number;
  lastActiveAt: number;
}

/**
 * A room: a standing domain of a life. Persists even when nothing is held in
 * it. Emerges from use. Capped in number by the repository.
 */
export interface Room {
  id: string;
  label: string;
  createdAt: number;
}

/** The person's birth coordinates, captured at Make it yours. The birth date
 *  drives the personal numerology now; time and place are held for the natal
 *  chart, which arrives with the transits. */
export interface VesselProfile {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  name?: string;
}

/** The whole of what the vessel holds for one person. The unit of persistence. */
export interface VesselState {
  rooms: Room[];
  themes: Theme[];
  intentions: HeldIntention[];
  /** The person's chosen default lens. */
  lens: Lens;
  /** The person's birth profile, present once they have made it theirs. */
  profile?: VesselProfile;
  /** Schema version, so migrations are explicit and safe. */
  version: number;
}

export const SCHEMA_VERSION = 1;

/** Hard caps that keep the surface a glance rather than a list. Doctrine, not preference. */
export const LIMITS = {
  maxRooms: 7,
  maxLiveIntentions: 12,
  /** Days after which a resting thread is deep enough to be offered back by the metabolism. */
  deepRestDays: 90,
} as const;

export function emptyState(lens: Lens = 'everyday'): VesselState {
  return { rooms: [], themes: [], intentions: [], lens, version: SCHEMA_VERSION };
}
