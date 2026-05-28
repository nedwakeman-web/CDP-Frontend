/**
 * CDP Vessel Composer Endpoint
 * ============================
 *
 * Paste this into cdp-server/server.js, anywhere in the route registration
 * block. It depends only on Express (already in cdp-server) and the
 * @anthropic-ai/sdk package (already in cdp-server, used by /api/reading).
 * If you prefer fetch directly to the Anthropic HTTP API, the body shape is
 * the same and the swap is mechanical.
 *
 * Environment required:
 *   ANTHROPIC_API_KEY      already set in Railway
 *   ANTHROPIC_MODEL        defaults to 'claude-sonnet-4-6' if unset
 *
 * Surface contract (client posts):
 *   POST /api/vessel/compose
 *   {
 *     kind: 'firstHold' | 'park' | 'respond' | 'depth' | 'meet',
 *     lens: 'tradition' | 'science' | 'everyday',
 *     intention?: { id, text, kind, anchor, summary, touches: [...] },
 *     person_text?: string,           // for respond
 *     intentions?: [...],             // for meet
 *     brightest_id?: string|null,     // for meet
 *   }
 *
 * Returns:
 *   { text: string, summary?: string }
 *
 * Failure modes return HTTP 5xx with a brief JSON error. The client treats
 * any non-OK response as a signal to fall back to the LocalOrchestrator
 * placeholder, so the surface never breaks even when the model is down.
 */

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const VESSEL_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

// ----- discipline shared across all lenses --------------------------------

const VESSEL_DISCIPLINE = `You are the composer behind CDP, the Cosmic Daily Planner. CDP is a place a person returns to over time to hold what they are carrying, met by a surface that knows them, with depth available on demand. You compose touches: short recognitions when a person first holds something, brief reflective continuations when they tend an open thread, the single line that meets them on the home, and longer composed depth when they reach for it.

Discipline that holds across every lens:
- The user is the source of their own authority. You bring orientation, not instruction. Never prescribe.
- Every symbolic claim is labelled symbolic, offered as orientation rather than instruction.
- Every empirical claim names its authority when one applies. Use named researchers and years where you are confident.
- Do not fake coordinates you do not have. If natal data or day-specific coordinates are not provided to you, speak in the general register of the chosen lens. Do not invent specific transit positions, specific Kin numbers, specific personal-year calculations, or named moon-phase windows for a particular date.
- Meet what they actually said. Do not generalise to a template. Quote a fragment of their own language back to them when it lands.
- Do not use em-dashes or en-dashes. Do not use exclamation marks. Do not use a therapist register where it does not belong.
- The honest no is in your repertoire. If a request is outside what you can helpfully serve, name that.
- Length: short touches are 2 to 4 sentences. The home meet line is one sentence, occasionally two. Depth is 6 to 10 paragraphs, 800 to 1500 words.`;

const LENS_VOICES = {
  tradition: `Voice for this composition: TRADITION. Symbolic register. The language of holding, timing, presence, archetypal pattern. Draws on numerology, Western astrology, Mayan calendrics, lunar cycles. Labels each claim as symbolic. Names sources when they apply: Tarnas, Greene, Aveni, the Law of Time, the Pythagorean lineage. Speak with the calm of contemplative tradition, not the breathlessness of pop astrology.`,
  science: `Voice for this composition: SCIENCE. Empirical register. Grounded in cognitive and affective neuroscience, attachment, clinical psychology. Cites named authorities, with year, when relevant: Zeigarnik 1927 on open loops, Masicampo and Baumeister 2011 on sufficient holds, Walker 2017 on consolidation, Cajochen and Schmidt 2024 on circadian cognition, Barrett 2017 on constructed emotion, Clark 2016 on predictive processing, Porges 2011 on neuroception, Siegel 2020 on interpersonal neurobiology. Includes sceptical counterweights where contested. Scholarly, precise, not pedantic.`,
  everyday: `Voice for this composition: EVERYDAY. Plain English bridge between the other two voices. Direct, warm, not therapist-y. Names what is symbolic and what is empirical without jargon. The reader holds both registers lightly and the voice meets them there.`,
};

// ----- prompt builders per kind -------------------------------------------

function describeAnchor(anchor) {
  if (!anchor) return 'none';
  if (anchor.date) return `${anchor.label}, ${anchor.date}`;
  return anchor.label;
}

function touchesBlock(touches) {
  if (!Array.isArray(touches) || touches.length === 0) return '(no prior touches)';
  return touches.map(t => `[${t.role}${t.depth ? ', depth' : ''}${t.lens ? ', ' + t.lens : ''}] ${t.text}`).join('\n');
}

function intentionsBlock(intentions) {
  if (!Array.isArray(intentions) || intentions.length === 0) return '(nothing currently held)';
  return intentions.map((i, idx) => {
    const anchor = i.anchor ? ` [anchor: ${describeAnchor(i.anchor)}]` : '';
    return `${idx + 1}. ${i.text}${anchor} (${i.kind || 'acute'})`;
  }).join('\n');
}

function buildUserPrompt(body) {
  const { kind, lens, intention, person_text, intentions, brightest_id } = body;

  switch (kind) {
    case 'firstHold':
      return `The user has just held this concern: "${intention.text}"
Anchor: ${describeAnchor(intention.anchor)}
Kind: ${intention.kind}

Compose the first-hold touch. 2 to 4 sentences. Meet them with recognition, not analysis. End with one line of orientation that names the next presence the concern asks of them. The composed text will sit beside their own words in the thread, so do not echo their wording back as a quote unless it sharpens recognition.`;

    case 'park':
      return `The user is parking this concern so it can recede from active attention: "${intention.text}"

Compose the park touch. 2 to 3 sentences. Name the hold as sufficient. Give permission for the concern to set down. In the Science voice, cite Masicampo and Baumeister 2011 on the sufficient-hold effect. In Tradition, name the symbolic act of setting down. In Everyday, plain language for both at once.`;

    case 'respond':
      return `The user is tending an open thread.
The thread is about: "${intention.text}"
Anchor: ${describeAnchor(intention.anchor)}
The conversation so far:
${touchesBlock(intention.touches)}

The user has just added: "${person_text}"

Compose a reflective continuation. 2 to 4 sentences. Meet what they just said in the context of the thread's shape. Draw on prior touches when relevant. Do not summarise the thread; continue it.`;

    case 'depth':
      return `The user has summoned depth on this concern: "${intention.text}"
Anchor: ${describeAnchor(intention.anchor)}
Kind: ${intention.kind}
The thread's shape so far:
${touchesBlock(intention.touches)}

Compose a longer reading on this specific concern. 6 to 10 paragraphs, 800 to 1500 words. Integrate the relevant frame(s) of the chosen lens around what they are actually holding. Cite named authorities where empirical. Label symbolic claims as symbolic. End with an orienting paragraph that does not prescribe.`;

    case 'meet': {
      const brightestText = (() => {
        if (!brightest_id || !Array.isArray(intentions)) return null;
        const b = intentions.find((_, i) => i === 0);
        return b ? b.text : null;
      })();
      return `The user has just opened the vessel. They are currently holding:
${intentionsBlock(intentions)}
${brightestText ? `Brightest right now: "${brightestText}"` : ''}

Compose the home meet line. One sentence, occasionally two. Name what is bright and, if relevant, what is approaching. Do not list. Recognise. The line will sit at the top of the home as the calm reflection of what they are carrying.`;
    }

    default:
      throw new Error(`Unknown composition kind: ${kind}`);
  }
}

function maxTokensFor(kind) {
  if (kind === 'depth') return 4000;
  if (kind === 'meet') return 200;
  return 600;
}

// ----- the route ---------------------------------------------------------

function registerVesselCompose(app) {
  app.post('/api/vessel/compose', async (req, res) => {
    const body = req.body || {};
    const { kind, lens } = body;

    // Lightweight validation. Anything malformed is a 400 so the client
    // falls back to local rather than retrying indefinitely.
    const validKinds = ['firstHold', 'park', 'respond', 'depth', 'meet'];
    const validLenses = ['tradition', 'science', 'everyday'];
    if (!validKinds.includes(kind)) {
      return res.status(400).json({ error: 'invalid kind' });
    }
    if (!validLenses.includes(lens)) {
      return res.status(400).json({ error: 'invalid lens' });
    }
    if (kind !== 'meet' && (!body.intention || typeof body.intention.text !== 'string')) {
      return res.status(400).json({ error: 'intention.text required' });
    }
    if (kind === 'respond' && typeof body.person_text !== 'string') {
      return res.status(400).json({ error: 'person_text required for respond' });
    }
    if (kind === 'meet' && !Array.isArray(body.intentions)) {
      return res.status(400).json({ error: 'intentions array required for meet' });
    }

    const system = `${VESSEL_DISCIPLINE}\n\n${LENS_VOICES[lens]}`;
    let userPrompt;
    try {
      userPrompt = buildUserPrompt(body);
    } catch (e) {
      return res.status(400).json({ error: String(e.message || e) });
    }

    const startedAt = Date.now();
    try {
      const result = await anthropic.messages.create({
        model: VESSEL_MODEL,
        max_tokens: maxTokensFor(kind),
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text = (result.content || [])
        .filter(b => b && b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();

      if (!text) {
        return res.status(502).json({ error: 'empty composition' });
      }

      // Light post-composition audit: scrub stray em/en dashes if the model
      // produced any despite the discipline. The client cannot help here.
      const cleaned = text
        .replace(/\u2014/g, ', ')
        .replace(/\u2013/g, ', ');

      // Summary is the same as text for short composition kinds. For depth,
      // the summary is the first sentence so the home cue refreshes sensibly.
      let summary;
      if (kind === 'depth') {
        const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned.slice(0, 160);
        summary = firstSentence.trim();
      } else if (kind === 'firstHold' || kind === 'park' || kind === 'respond') {
        summary = cleaned.length > 200 ? cleaned.slice(0, 200).trim() + '...' : cleaned;
      }

      const ms = Date.now() - startedAt;
      console.log(`[vessel/compose] kind=${kind} lens=${lens} ms=${ms} chars=${cleaned.length}`);

      return res.json({ text: cleaned, ...(summary ? { summary } : {}) });

    } catch (e) {
      const ms = Date.now() - startedAt;
      console.error(`[vessel/compose] kind=${kind} lens=${lens} ms=${ms} ERROR`, e && e.message);
      return res.status(502).json({ error: 'composition failed' });
    }
  });
}

module.exports = { registerVesselCompose };

// ---- to wire in cdp-server/server.js, add at the top of the routes block:
//
//   const { registerVesselCompose } = require('./vessel-compose');
//   registerVesselCompose(app);
//
// and ensure CORS allows the alpha/beta/main frontend origins, which the
// existing server config already does for the reading endpoint.
