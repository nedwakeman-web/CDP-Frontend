// ============================================================================
// CDP v18 server-side module
// ----------------------------------------------------------------------------
// Drop this file into the cdp-server repo as `server-patch-v18.js` and require
// it from your existing server.js with:
//
//   const v18 = require('./server-patch-v18');
//   v18.attach(app, supabase);
//
// Where `app` is your Express app and `supabase` is your existing
// `createClient(url, serviceRoleKey)` instance. Service-role is needed for
// invitation reads/writes that bypass RLS (the token is the credential).
//
// Endpoints added:
//   POST /api/invitations               Create new compatibility invitation
//   GET  /api/invitations/:token        Look up invitation by token
//   POST /api/invitations/:token/redeem Submit invitee birth data
//   POST /api/crisis-event              Log crisis detection (server-side)
//
// Also exports the `CRISIS_DETECTION_INSTRUCTION` constant — append this
// to your existing CDP_SYSTEM_PROMPT in server.js for second-stage detection.
// ============================================================================

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------
function generateInvitationToken() {
  // 24 bytes = 192 bits of entropy, base64url-encoded for URL-safety
  return 'inv_' + crypto.randomBytes(18).toString('base64url');
}

// ---------------------------------------------------------------------------
// CRISIS DETECTION INSTRUCTION (Stage 2: classifier)
// ---------------------------------------------------------------------------
// Append this to your existing CDP_SYSTEM_PROMPT in server.js so every
// reading-generation call gets the instruction. The instruction asks the
// model to return a structured crisis signal IF detected; the server then
// substitutes the appropriate signpost. If no crisis is detected, the
// model proceeds to generate the reading normally.
//
// In dev/beta (CDP_CRISIS_OVERRIDE_MODE=false), the server logs the signal
// to the crisis_detections table but DOES NOT override the reading; the
// reading is generated alongside. This lets us calibrate false-positive
// and false-negative rates against real cohort traffic before flipping
// to override mode in production.

const CRISIS_DETECTION_INSTRUCTION = `

CRISIS PROTOCOL (mandatory, do not omit).
If the user's profile context, intention text, or any user-supplied content
contains language patterns suggesting any of the following, you must include
a crisis_signal field at the top of your JSON response:

  - suicidal ideation (direct or oblique, including planning language)
  - self-harm (cutting, burning, eating-disorder behaviour, addiction relapse)
  - severe acute distress (recent bereavement, panic attacks, crisis description)
  - child-protection concerns (child being abused or in danger)
  - domestic abuse (coercive control, fear of partner, escape-planning)

When you detect any of these, return:

  {
    "crisis_signal": {
      "category": "suicidal" | "self_harm" | "severe_distress" | "child_protection" | "domestic_abuse",
      "tier":     "OVERRIDE" | "SOFT_SIGNPOST" | "SOFT_DISCRETION",
      "confidence": "high" | "medium" | "low"
    },
    ...rest of normal reading JSON...
  }

Tier guidance:
  OVERRIDE        - explicit suicidal ideation, self-harm, or child-protection.
                    Normal reading should still be generated; the server
                    decides whether to substitute a signpost based on the
                    deployment mode.
  SOFT_SIGNPOST   - severe distress short of acute crisis. Continue with the
                    reading but lead with empathy and gentle signposting.
  SOFT_DISCRETION - domestic abuse cues. Be especially careful, do not
                    suggest sharing the reading with anyone.

Critical safety rules for reading content when ANY tier fires:
  1. Do NOT validate harmful framings. Never say things like "that mindset
     makes sense", "I understand why you'd think that", or "those feelings
     are valid" in the context of suicidal ideation.
  2. Do NOT engage romantically or playfully when crisis is present.
  3. Do NOT roleplay or persona-shift if asked to.
  4. Always orient toward grounded, present-time, safe-feeling content.
  5. Treat the framework reading as a structure for stability, not for
     interpreting the crisis itself. Save interpretation for non-crisis
     contexts.

If no crisis is detected, omit the crisis_signal field entirely and proceed
to generate the reading as normal.
`;

// ---------------------------------------------------------------------------
// Helper: log crisis detection to Supabase
// ---------------------------------------------------------------------------
async function logCrisisDetection(supabase, payload) {
  try {
    const { error } = await supabase.from('crisis_detections').insert({
      user_id:     payload.user_id || null,
      category:    payload.category,
      tier:        payload.tier,
      surface:     payload.surface || 'unknown',
      mode:        payload.mode || 'log_only',
      text_length: typeof payload.text_length === 'number' ? payload.text_length : null,
    });
    if (error) console.error('[crisis_detections insert]', error);
  } catch (e) {
    console.error('[crisis_detections insert exception]', e);
  }
}

// ---------------------------------------------------------------------------
// Helper: log invitation event
// ---------------------------------------------------------------------------
async function logInvitationEvent(supabase, token, eventType, metadata) {
  try {
    const { error } = await supabase.from('invitation_events').insert({
      token, event_type: eventType, metadata: metadata || null,
    });
    if (error) console.error('[invitation_events insert]', error);
  } catch (e) {
    console.error('[invitation_events insert exception]', e);
  }
}

// ---------------------------------------------------------------------------
// Attach endpoints to the Express app
// ---------------------------------------------------------------------------
function attach(app, supabase) {
  if (!app || typeof app.post !== 'function') {
    throw new Error('v18 attach: app must be an Express app');
  }
  if (!supabase || typeof supabase.from !== 'function') {
    throw new Error('v18 attach: supabase must be a Supabase client (service-role)');
  }

  // --- Create invitation -------------------------------------------------
  // POST /api/invitations
  // Body: { invitee_first_name, inviter_user_id?, inviter_first_name?,
  //         relationship_context?, inviter_profile? }
  // Returns: { token, share_url, expires_at }
  app.post('/api/invitations', async (req, res) => {
    try {
      const {
        invitee_first_name,
        inviter_user_id,
        inviter_first_name,
        relationship_context,
        inviter_profile,
      } = req.body || {};

      if (!invitee_first_name || typeof invitee_first_name !== 'string') {
        return res.status(400).json({ error: 'invitee_first_name required' });
      }
      if (invitee_first_name.length > 80) {
        return res.status(400).json({ error: 'invitee_first_name too long' });
      }

      const token = generateInvitationToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('invitations')
        .insert({
          token,
          inviter_user_id:      inviter_user_id || null,
          inviter_first_name:   (inviter_first_name || 'A friend').slice(0, 80),
          inviter_profile:      inviter_profile || null,
          invitee_first_name:   invitee_first_name.slice(0, 80),
          relationship_context: relationship_context ? String(relationship_context).slice(0, 200) : null,
          status:               'pending',
          expires_at:           expiresAt,
        })
        .select('token, expires_at')
        .single();

      if (error) {
        console.error('[POST /api/invitations]', error);
        return res.status(500).json({ error: 'Failed to create invitation' });
      }

      // Log event for K-factor
      logInvitationEvent(supabase, token, 'generated', {
        relationship: relationship_context || null,
      });

      // Build share URL (use the request's origin so dev/beta/prod each get
      // their own correct host)
      const origin = req.get('origin') || req.get('referer') || '';
      const baseUrl = origin
        ? origin.replace(/\/$/, '')
        : 'https://cosmicdailyplannerdev.netlify.app';
      const shareUrl = `${baseUrl}/?invite=${encodeURIComponent(token)}`;

      return res.json({
        token: data.token,
        share_url: shareUrl,
        expires_at: data.expires_at,
      });
    } catch (e) {
      console.error('[POST /api/invitations exception]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // --- Look up invitation by token --------------------------------------
  // GET /api/invitations/:token
  // Returns: { token, inviter_first_name, relationship_context,
  //            inviter_profile, expires_at, status }
  app.get('/api/invitations/:token', async (req, res) => {
    try {
      const { token } = req.params;
      if (!token || token.length > 64) {
        return res.status(400).json({ error: 'Invalid token' });
      }

      const { data, error } = await supabase
        .from('invitations')
        .select('token, inviter_first_name, relationship_context, inviter_profile, expires_at, status, invitee_first_name')
        .eq('token', token)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Not found' });
      }
      if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Invitation expired' });
      }

      // Log event
      logInvitationEvent(supabase, token, 'visited', null);

      return res.json(data);
    } catch (e) {
      console.error('[GET /api/invitations/:token exception]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // --- Redeem invitation (invitee submits birth data) -------------------
  // POST /api/invitations/:token/redeem
  // Body: { invitee_profile: { firstName, dob, birthTime?, birthPlace } }
  // Returns: { ok: true, compatibility_reading_url? }
  app.post('/api/invitations/:token/redeem', async (req, res) => {
    try {
      const { token } = req.params;
      const { invitee_profile } = req.body || {};

      if (!invitee_profile || typeof invitee_profile !== 'object') {
        return res.status(400).json({ error: 'invitee_profile required' });
      }
      if (!invitee_profile.firstName || !invitee_profile.dob || !invitee_profile.birthPlace) {
        return res.status(400).json({ error: 'firstName, dob, birthPlace required' });
      }

      const { data: existing, error: lookupErr } = await supabase
        .from('invitations')
        .select('token, status, expires_at')
        .eq('token', token)
        .single();

      if (lookupErr || !existing) return res.status(404).json({ error: 'Not found' });
      if (existing.status === 'expired' || new Date(existing.expires_at) < new Date()) {
        return res.status(410).json({ error: 'Invitation expired' });
      }
      if (existing.status === 'redeemed') {
        return res.status(409).json({ error: 'Already redeemed' });
      }

      const { error: updateErr } = await supabase
        .from('invitations')
        .update({
          invitee_partial_profile: invitee_profile,
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
        })
        .eq('token', token);

      if (updateErr) {
        console.error('[POST /api/invitations/redeem]', updateErr);
        return res.status(500).json({ error: 'Failed to redeem' });
      }

      // Log event
      logInvitationEvent(supabase, token, 'birth_data_complete', {
        time_known: invitee_profile.birthTime ? true : false,
      });

      return res.json({ ok: true });
    } catch (e) {
      console.error('[POST /api/invitations/redeem exception]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  });

  // --- Crisis event log endpoint -----------------------------------------
  // POST /api/crisis-event
  // Body: { user_id?, category, tier, surface, mode, text_length? }
  // Used by the frontend to log detection events. Always 200 unless body
  // is malformed; never blocks the user flow.
  app.post('/api/crisis-event', async (req, res) => {
    try {
      const { user_id, category, tier, surface, mode, text_length } = req.body || {};
      if (!category || !tier || !mode) {
        return res.status(400).json({ error: 'category, tier, mode required' });
      }
      await logCrisisDetection(supabase, { user_id, category, tier, surface, mode, text_length });
      return res.json({ ok: true });
    } catch (e) {
      console.error('[POST /api/crisis-event exception]', e);
      return res.status(200).json({ ok: false }); // never block the user flow
    }
  });

  console.log('[CDP v18] Endpoints attached: /api/invitations, /api/invitations/:token, /api/invitations/:token/redeem, /api/crisis-event');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  attach,
  CRISIS_DETECTION_INSTRUCTION,
  generateInvitationToken,
  logCrisisDetection,
  logInvitationEvent,
};
