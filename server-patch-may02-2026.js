// server.js patch
// Cosmic Daily Planner: new endpoints for the May 02 2026 dev deploy.
//
// Add this file to cdp-server alongside server.js.
// In server.js, add at the top after express init:
//
//     const cdpRoutes = require('./server-patch-may02-2026');
//     cdpRoutes.registerRoutes(app, { astroService, supabase, resend });
//
// Where:
//   app           = your existing Express app
//   astroService  = the existing service that wraps Swiss Ephemeris and USNO
//   supabase      = the existing Supabase client (for analytics + feedback storage)
//   resend        = the existing Resend mail client (for feedback notifications)
//
// All endpoints CORS-enabled assuming the existing CORS middleware is mounted upstream.

'use strict';

const bestDay = require('./best-day');

function registerRoutes(app, deps) {
  const { astroService, supabase, resend } = deps || {};

  if (!astroService) {
    throw new Error('astroService is required (Swiss Ephemeris + USNO + Kin engine)');
  }

  // ---------------------------------------------------------------
  // /api/best-day (POST)
  // Body: { userProfile, intent, monthStart, monthEnd, weights?, topN? }
  // ---------------------------------------------------------------
  app.post('/api/best-day', bestDay.makeHandler({ astroService }));

  // ---------------------------------------------------------------
  // /api/month-data (GET)
  // Query: start=YYYY-MM-DD, end=YYYY-MM-DD
  // Returns: { days: { 'YYYY-MM-DD': { kin, tone, seal, isGAP, moonPhase, moonPhaseLabel, isBlackMoon, isShivaMoon, transits } } }
  // ---------------------------------------------------------------
  app.get('/api/month-data', async (req, res) => {
    try {
      const { start, end } = req.query;
      if (!start || !end) return res.status(400).json({ error: 'start and end required' });

      const days = {};
      const startDate = new Date(start + 'T00:00:00Z');
      const endDate = new Date(end + 'T00:00:00Z');

      const promises = [];
      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateIso = d.toISOString().slice(0, 10);
        promises.push((async () => {
          try {
            const [moonData, kinData] = await Promise.all([
              astroService.getMoonPhase(dateIso),
              astroService.getKin(dateIso)
            ]);
            days[dateIso] = {
              kin: kinData.kin,
              tone: kinData.tone,
              seal: kinData.seal,
              isGAP: kinData.isGAP,
              moonPhase: moonData.phase,
              moonPhaseLabel: humanMoonPhase(moonData),
              isBlackMoon: moonData.isBlackMoon,
              isShivaMoon: moonData.isShivaMoon,
              illumination: moonData.illumination
            };
          } catch (err) {
            days[dateIso] = { error: err.message };
          }
        })());
      }
      await Promise.all(promises);
      res.json({ start, end, days });
    } catch (err) {
      console.error('month-data error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------
  // /api/day-data (GET)
  // Query: date=YYYY-MM-DD, optional natal=base64-json
  // ---------------------------------------------------------------
  app.get('/api/day-data', async (req, res) => {
    try {
      const { date, natal } = req.query;
      if (!date) return res.status(400).json({ error: 'date required' });
      let natalObj = {};
      if (natal) {
        try { natalObj = JSON.parse(Buffer.from(natal, 'base64').toString('utf-8')); }
        catch (e) { /* ignore */ }
      }
      const [moonData, kinData, transits] = await Promise.all([
        astroService.getMoonPhase(date),
        astroService.getKin(date),
        astroService.getTransits(date, natalObj)
      ]);
      res.json({
        date,
        kin: kinData.kin,
        tone: kinData.tone,
        seal: kinData.seal,
        isGAP: kinData.isGAP,
        moonPhase: moonData.phase,
        moonPhaseLabel: humanMoonPhase(moonData),
        isBlackMoon: moonData.isBlackMoon,
        isShivaMoon: moonData.isShivaMoon,
        illumination: moonData.illumination,
        transits: transits || []
      });
    } catch (err) {
      console.error('day-data error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------
  // /api/feedback (POST)
  // Body: { category, rating, text, email, page, env, ts }
  // Stores in Supabase analytics + emails oracle@cosmicdailyplanner.com
  // ---------------------------------------------------------------
  app.post('/api/feedback', async (req, res) => {
    try {
      const { category, rating, text, email, page, env, ts } = req.body || {};
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'feedback text required' });
      }

      const record = {
        event: 'feedback_sent',
        category: category || 'other',
        rating: rating ? Number(rating) : null,
        text: text.trim().slice(0, 5000),
        user_email: email && email.includes('@') ? email.trim().slice(0, 200) : null,
        page: page || null,
        env: env || 'unknown',
        ts: ts || new Date().toISOString()
      };

      // 1. Persist to Supabase
      if (supabase) {
        try {
          await supabase.from('analytics').insert([{
            event_type: 'feedback_sent',
            payload: record,
            created_at: new Date().toISOString()
          }]);
        } catch (err) {
          console.warn('supabase feedback insert failed:', err);
        }
      }

      // 2. Email oracle@cosmicdailyplanner.com
      if (resend) {
        try {
          await resend.emails.send({
            from: 'Cosmic Daily Planner <oracle@cosmicdailyplanner.com>',
            to: 'oracle@cosmicdailyplanner.com',
            subject: '[' + (record.env || 'cdp') + '] Feedback: ' + record.category + (record.rating ? ' (' + record.rating + '/5)' : ''),
            text:
              'New feedback received\n\n' +
              'Category: ' + record.category + '\n' +
              'Rating: ' + (record.rating || 'skipped') + '\n' +
              'Page: ' + (record.page || '(unknown)') + '\n' +
              'Env: ' + record.env + '\n' +
              'Time: ' + record.ts + '\n' +
              'Email: ' + (record.user_email || '(not provided)') + '\n\n' +
              'Text:\n' + record.text + '\n'
          });
        } catch (err) {
          console.warn('resend feedback email failed:', err);
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('feedback error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------
  // /api/test-kin (GET)
  // Diagnostic endpoint: confirms Kin anchor is correct.
  // /api/test-kin?date=2024-07-08  must return { kin: 1, ... }
  // ---------------------------------------------------------------
  app.get('/api/test-kin', async (req, res) => {
    try {
      const date = req.query.date || '2024-07-08';
      const k = await astroService.getKin(date);
      const expected = (date === '2024-07-08') ? 1 : null;
      res.json({
        date,
        kin: k.kin,
        tone: k.tone,
        seal: k.seal,
        isGAP: k.isGAP,
        anchorCheck: expected !== null ? (k.kin === expected ? 'PASS' : 'FAIL: expected ' + expected) : 'no expected value'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

function humanMoonPhase(moonData) {
  if (moonData.isBlackMoon) return 'Black Moon (two days before New Moon)';
  if (moonData.isShivaMoon) return 'Shiva Moon (two days after New Moon)';
  const map = {
    new: 'New Moon',
    waxing_crescent: 'Waxing Crescent',
    first_quarter: 'First Quarter',
    waxing_gibbous: 'Waxing Gibbous',
    full: 'Full Moon',
    waning_gibbous: 'Waning Gibbous',
    last_quarter: 'Last Quarter',
    waning_crescent: 'Waning Crescent'
  };
  return map[moonData.phase] || moonData.phase || 'Unknown';
}

module.exports = { registerRoutes, humanMoonPhase };
