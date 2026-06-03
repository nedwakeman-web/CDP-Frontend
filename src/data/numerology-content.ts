/**
 * CDP Vessel, content: numerology meanings and the personal year arcs.
 *
 * Ported faithfully from the monolith NUM_DATA and PY_ARC tables, with the em
 * dashes the source carried replaced by house-style punctuation. These are
 * symbolic meanings, labelled symbolic wherever they are shown. The numbers
 * themselves are computed from the corrected core, never from a table.
 *
 * House style holds here: no em dashes, no en dashes, no exclamation marks,
 * and no spaced hyphen patterns.
 */

export interface NumMeaning {
  /** The name of the number, a symbolic title. */
  n: string;
  /** A short keyword line. */
  k: string;
  /** The fuller symbolic meaning. */
  m: string;
  /** True for the master numbers, which are preserved rather than reduced. */
  master?: boolean;
}

export const NUM_DATA: Record<number, NumMeaning> = {
  1: { n: 'New Beginnings', k: 'Initiation, leadership, independence', m: 'A day to start fresh and lead with confidence. Your actions today carry unusual weight, begin something new, assert your direction.' },
  2: { n: 'Partnership', k: 'Cooperation, balance, receptivity', m: 'Everything about union and togetherness. A natural day for collaboration, listening, and tending relationships. Gentle and receptive energy.' },
  3: { n: 'Creative Expression', k: 'Joy, communication, creative flow', m: 'A day for inspired communication, creative work, and authentic expression. What wants to be said or made today, let it out.' },
  4: { n: 'Foundation and Order', k: 'Structure, discipline, patient building', m: 'A day for careful, methodical work. Systems, plans, and steady effort are rewarded. Build something that will last.' },
  5: { n: 'Freedom and Change', k: 'Adventure, versatility, expansion', m: 'An energetic, changeable day. Stay adaptable, embrace the unexpected. Rigidity will frustrate, flexibility opens doors.' },
  6: { n: 'Love and Responsibility', k: 'Harmony, family, service, care', m: 'A day centred on relationship, care, and responsibility to others. Home, family, and community call for attention.' },
  7: { n: 'Wisdom and Introspection', k: 'Analysis, spiritual depth, truth seeking', m: 'A day for inner work, research, and deep thinking. Slow down, go inward. Answers come through reflection rather than action.' },
  8: { n: 'Power and Abundance', k: 'Authority, material mastery, accountability', m: 'The axis of cause and effect made visible. An exceptional day for business, projects, and decisions with material consequence. Speak with authority.' },
  9: { n: 'Completion and Compassion', k: 'Wisdom, generosity, release, universal love', m: 'Cosmic energies are fully open. A very special day for rest, channelling higher sources, and allowing things to complete naturally. Special meetings arrive unbidden.' },
  11: { n: 'Master Illuminator', k: 'Spiritual vision, intuition, higher purpose', master: true, m: 'Master Number Day, the portals are wide open. A rare, intense day that can be either challenging or transcendent. Listen to your intuition. Something important is available to you if you are still enough to receive it.' },
  22: { n: 'Master Builder', k: 'Large scale vision, practical idealism, manifestation', master: true, m: 'Master Number Day, the portals are open. This carries the energy of four amplified to civilisational scale. Your practical idealism can take concrete form today. Major projects respond to clear, committed focus.' },
  33: { n: 'Master Teacher', k: 'Healing, compassionate leadership, selfless guidance', master: true, m: 'Master Number Day, the portals are open. An extraordinary day for compassionate service, healing, and teaching. Whatever you give freely today returns magnified.' },
  44: { n: 'Master Organiser', k: 'Systemic mastery, material achievement, divine structure', master: true, m: 'Master Number Day, the portals are open. Deep structural work and material achievement are supported. Pay close attention to intuition around business, money, and long term systems.' },
};

export const PY_ARC: Record<number, string> = {
  1: 'You are in Year 1 of a nine year cycle, the year of planting seeds. The themes you initiate now set the entire arc of the next decade. Independence, courage, and new beginnings are the watchwords. What you start matters more than what you finish.',
  2: 'Year 2 is the year of patience and relationship. The seeds you planted last year need tending, not harvesting. Partnerships, diplomacy, and gentle persistence move things forward faster than force.',
  3: 'Year 3 opens the channels of creative expression. Communication, social connection, and visible self expression are highlighted. This is often the year when earlier efforts become visible to others.',
  4: 'Year 4 demands that you build. Structure, discipline, and patient effort are the themes. This is the year to lay foundations rather than seek shortcuts. What you build now lasts.',
  5: 'Year 5 is the year of change, freedom, and expansion. The structures of Year 4 need to be tested and made more flexible. Expect the unexpected, and cultivate adaptability.',
  6: 'Year 6 is the year of responsibility, home, and relationship. Service, family, and care for others take centre stage. Beauty and harmony are yours to create this year.',
  7: 'Year 7 is the year of inner work, wisdom, and refinement. External achievement slows, inner development deepens. Research, study, solitude, and spiritual inquiry are highly productive.',
  8: 'Year 8 is the axis of material achievement and accountability. Power, money, and career are in sharp focus. This is the harvest year for the effort of the previous seven, results are visible and consequential.',
  9: 'Year 9 is the year of completion, release, and compassion. The nine year cycle draws to a close. What no longer serves must be released. Generosity, forgiveness, and endings that clear space for the new are the themes.',
  11: 'Master Year 11, Illumination. An extraordinarily intense year calling you toward your highest spiritual and creative potential. The tension between the mundane (2) and the transcendent (11) must be consciously held.',
  22: 'Master Year 22, The Master Builder. A year of potential civilisational impact. Your practical idealism can take form at scale. The tension between the local (4) and the universal (22) must be navigated with patience.',
  33: 'Master Year 33, The Master Teacher. A year of compassionate service at the highest level. What you give freely now has unusual reach and depth.',
  44: 'Master Year 44, Master Organiser. A year of systemic achievement. Material and spiritual mastery can be integrated.',
};
