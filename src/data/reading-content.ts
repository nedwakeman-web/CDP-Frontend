/**
 * CDP Vessel, data layer: harvested reading content.
 *
 * Authored content lifted verbatim from the production monolith (app.html), the
 * two month build, and cleaned to house style. Nothing here is recreated; it is
 * pulled forward so the surfaces are never thinner than the monolith. Three
 * tables live here, all symbolic or empirical as labelled in use:
 *   NUM_TIME   the symbolic numerology guidance for each number across morning,
 *              afternoon, and evening. The Tradition telescope for the windows.
 *   NUM_NEURO  the neuroscience grounded guidance for the same number and window.
 *              The Science telescope for the windows, mechanisms named, not faked.
 *   SEAL_ARCH  the standing archetype of each Dreamspell solar seal.
 * Master numbers 11, 22, 33, 44 are carried with their own entries, never reduced.
 *
 * House style holds here, in code and comments alike: no em dashes, no en dashes,
 * no exclamation marks, no spaced hyphen patterns.
 */

export interface NumTime { morning: string; afternoon: string; evening: string; }

/** Symbolic numerology guidance per number, by window of the day. Tradition voice. */
export const NUM_TIME: Record<number, NumTime> = {
  1: { morning: "Morning calls for bold initiation. Begin something; assert your direction.", afternoon: "Afternoon sustains the initiating impulse. Push independently through resistance.", evening: "Evening: reflect on what you started and what true leadership asks of you." },
  2: { morning: "Morning asks for deep listening. Collaborate, do not compete.", afternoon: "Afternoon favours sensitive negotiations and partnership decisions.", evening: "Evening is for tending relationships, what balance needs restoring?" },
  3: { morning: "Morning overflows with creative potential. Speak, write, create, the channel is open.", afternoon: "Afternoon sustains expressive momentum. Ideas multiply with sharing.", evening: "Evening calls for joyful communication, connect, share what is alive in you." },
  4: { morning: "Morning energy is grounded and methodical. Lay foundations, build systems.", afternoon: "Afternoon rewards steady focus. Practical effort accumulates.", evening: "Evening consolidates what was built. Honour the discipline of the day." },
  5: { morning: "Morning sparks restlessness. Stay adaptable; the unexpected is the gift.", afternoon: "Afternoon accelerates change. Navigate rather than control.", evening: "Evening asks: what does freedom mean right now? Release rigidity." },
  6: { morning: "Morning centres on care and responsibility. Home and relationship call for attention.", afternoon: "Afternoon sustains the energy of service and harmony.", evening: "Evening is deeply relational. Tend to those who matter most." },
  7: { morning: "Morning is introspective and quiet. Inner work and research are rewarded.", afternoon: "Afternoon opens the philosophical channel. Question beneath the surface.", evening: "Evening is for silence and contemplation. Answers come inward." },
  8: { morning: "Morning carries authority and material weight. Decisions today have consequence.", afternoon: "Afternoon amplifies executive capacity. Speak clearly, act decisively.", evening: "Evening is for taking stock, what has been built, what has been earned?" },
  9: { morning: "Morning is open and cosmic. Special encounters and completions arrive unbidden.", afternoon: "Afternoon calls for generosity and letting go of what is finished.", evening: "Evening is for release. Close cycles, forgive, prepare for what is next." },
  11: { morning: "Master Morning, spiritual insight and high intuition before the noise of the day begins.", afternoon: "Master Afternoon, unusual clarity and vision. What is offered is rare.", evening: "Master Evening, integration of the day's revelations. Be still enough to receive." },
  22: { morning: "Master Morning, practical idealism at its peak. Major projects respond to clear focus.", afternoon: "Master Afternoon, civilisational-scale energy. Build with deep intention.", evening: "Master Evening, reflect on what you are truly building over the long arc." },
  33: { morning: "Master Morning, compassionate service and healing are amplified.", afternoon: "Master Afternoon, teach, guide, and give freely.", evening: "Master Evening, what has your generosity created today?" },
  44: { morning: "Master Morning, structural clarity and material achievement are supported.", afternoon: "Master Afternoon, deep systems thinking opens. Attend to business and money.", evening: "Master Evening, review the architecture of your long-term vision." },
};

/** Neuroscience grounded guidance per number, by window of the day. Science voice, mechanisms named. */
export const NUM_NEURO: Record<number, NumTime> = {
  1: { morning: "Salience network primed for initiation. Begin with clear intention.", afternoon: "Sustained dopaminergic drive. Execute on what you started.", evening: "Reward circuitry review. What did your brain code as genuinely worthwhile today?" },
  2: { morning: "Social cognition networks attuned. Listen before asserting.", afternoon: "Insular cortex reads emotional tone with precision. Trust somatic signals.", evening: "Oxytocin cycles favour connection and repair. Tend close relationships." },
  3: { morning: "Default Mode Network creativity window. Novel associations form freely.", afternoon: "Verbal fluency peaks with cortical arousal. Express and synthesise.", evening: "Limbic tagging of creative output. Journal before sleep consolidates it." },
  4: { morning: "Prefrontal executive function sharpest in the morning cortisol window.", afternoon: "Sustained attention favoured. Batch routine work to avoid decision fatigue.", evening: "Hippocampus files structured learning. Review systems, not outcomes." },
  5: { morning: "Novelty-seeking circuitry primed. Disrupting routine activates learning.", afternoon: "Adaptive flexibility is prefrontal. Channel change into calculated pivots.", evening: "Default mode integrates disparate experiences. Notice what surprised you." },
  6: { morning: "Caregiving activates medial prefrontal cortex and releases oxytocin.", afternoon: "Prosocial behaviour peaks at moderate cortisol. Lead with attuned presence.", evening: "Ventral vagal activation supported by warm social connection. Rest here." },
  7: { morning: "Theta brainwave activity accessible before cortical noise rises. Be still.", afternoon: "Lateral prefrontal activation sustained through focused inquiry. Go deep.", evening: "Gamma-band integration occurs in quiet evenings. Protect this window." },
  8: { morning: "High-arousal decision-making sharpest at morning cortisol peak.", afternoon: "Reward anticipation circuitry active. Use for high-stakes communication.", evening: "Parasympathetic review. What did your nervous system signal mattered most?" },
  9: { morning: "Striatal completion circuitry primed. Close unfinished loops first.", afternoon: "Compassionate engagement sustainable when regulated. Give from calm ground.", evening: "Default mode integrates the cycle of the day. Release judgement." },
  11: { morning: "Interoceptive sensitivity heightened. Intuition as predictive processing.", afternoon: "Wider predictive priors active. Unusual connections and foresight available.", evening: "Integration of heightened signal. What arrived that bypassed ordinary filters?" },
  22: { morning: "Executive and default mode networks in rare co-activation. Build vision.", afternoon: "Prefrontal-parietal coordination supports large-scale systems thinking.", evening: "Complex structural learning needs consolidation. Set intention before rest." },
  33: { morning: "Limbic empathy circuits at scale. Caregiving and teaching are supported.", afternoon: "Oxytocin and serotonin loops sustain generosity. Resource your calm first.", evening: "Altruism is intrinsically rewarding neurochemically. Notice what that felt like." },
  44: { morning: "Executive architecture and basal ganglia efficiency both primed. Build.", afternoon: "Expert pattern recognition at full capacity for complex strategic work.", evening: "Structural review. What did you build or move toward today? Reinforce intent." },
};

/**
 * Dreamspell seal archetypes, the standing identity of each solar seal, harvested
 * verbatim from the monolith sealArchData and cleaned to house style. This is the
 * archetype layer that sits beside the daily seal hook, the who of the seal beside
 * the what of the day. Symbolic, Dreamspell after Arguelles 1987.
 */
export const SEAL_ARCH: Record<string, string> = {
  "Dragon": "The Nurturer, called to protect, initiate, and hold space for what is being born",
  "Wind": "The Communicator, natural channel for ideas, words, and connection across minds",
  "Night": "The Dreamer, gifts in intuition, abundance thinking, and deep inner knowing",
  "Seed": "The Developer, natural capacity to identify potential and cultivate growth over time",
  "Serpent": "The Embodied Knower, instinctive intelligence; wisdom that arrives through the body",
  "World-Bridger": "The Transformer, called to facilitate endings, transitions, and threshold crossings",
  "Hand": "The Healer, natural capacity to complete, heal, and bring things to right conclusion",
  "Star": "The Artist, sees beauty as a form of intelligence; creates coherence through aesthetic",
  "Moon": "The Flow Master, moves with natural cycles; facilitates emotional intelligence and flow",
  "Dog": "The Heart-Centred Leader, loyalty, love, and service as the primary compass",
  "Monkey": "The Sacred Trickster, playful intelligence that sees through illusion to deeper truth",
  "Human": "The Free Agent, strong individual will; here to exercise discernment and authentic choice",
  "Skywalker": "The Explorer, expands possibility and horizon; connects earth and sky",
  "Wizard": "The Receptive Channel, enchants through presence; natural capacity for magical alignment",
  "Eagle": "The Visionary, sees the large pattern; gifts in strategic and creative vision",
  "Warrior": "The Intelligence Officer, questions fearlessly; strategic and disciplined",
  "Earth": "The Navigator, reads signs and synchronicities; grounds higher intelligence into practical reality",
  "Mirror": "The Reflector, shows others themselves; gifts in clarity, truth-telling, and discernment",
  "Storm": "The Catalyst, disrupts stagnation; natural agent of transformation and renewal",
  "Sun": "The Enlightener, life-force distilled; called to illuminate and radiate universal fire",
};
