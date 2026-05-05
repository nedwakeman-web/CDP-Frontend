// best-day.test.js
// Smoke tests for the Best Day engine. Run before shipping to dev.
// Usage: node best-day.test.js

const {
  findBestDays,
  numerologyLayers,
  reduceWithMaster,
  classifyIntent,
  INTENT_PROFILES,
  scoreDay
} = require('./best-day');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    pass++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    fail++;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || 'eq'}: expected ${b}, got ${a}`); }

// =====================================================================
console.log('\nNumerology reduction:');
// =====================================================================

test('reduceWithMaster keeps 11', () => eq(reduceWithMaster(11), 11));
test('reduceWithMaster keeps 22', () => eq(reduceWithMaster(22), 22));
test('reduceWithMaster keeps 44', () => eq(reduceWithMaster(44), 44));
test('reduceWithMaster reduces 19 to 1', () => eq(reduceWithMaster(19), 1));
test('reduceWithMaster reduces 17 to 8', () => eq(reduceWithMaster(17), 8));
test('reduceWithMaster reduces 9 to 9', () => eq(reduceWithMaster(9), 9));
test('reduceWithMaster handles large 38 to 11 (master kept)', () => eq(reduceWithMaster(38), 11));

// =====================================================================
console.log('\nThree-layer numerology for today (2 May 2026, PY 4):');
// =====================================================================

test('layers for 2026-05-02 with PY 4', () => {
  const l = numerologyLayers('2026-05-02', 4);
  // day = 0+2 = 2
  eq(l.day, 2, 'day layer');
  // dayMonth = 2 + 5 = 7
  eq(l.dayMonth, 7, 'dayMonth layer');
  // full = 2 + 5 + 4 = 11 (master)
  eq(l.full, 11, 'full integrated layer');
});

test('layers for 2026-05-08 with PY 4', () => {
  const l = numerologyLayers('2026-05-08', 4);
  eq(l.day, 8, 'day');
  eq(l.dayMonth, 4, '8+5=13->4');
  eq(l.full, 8, '8+5+4=17->8');
});

test('layers for 2026-12-31 with PY 4 (year wraparound check)', () => {
  const l = numerologyLayers('2026-12-31', 4);
  eq(l.day, 4, '3+1=4');
  eq(l.dayMonth, 7, '3+1+1+2=7');
  eq(l.full, 11, '4+3+4=11 (master kept)');
});

// =====================================================================
console.log('\nIntent classification:');
// =====================================================================

test('funding pitch classified', () => eq(classifyIntent('Best day for a funding pitch'), 'funding_pitch'));
test('investor meeting classified', () => eq(classifyIntent('investor meeting'), 'funding_pitch'));
test('first date classified', () => eq(classifyIntent('first date with someone new'), 'first_date'));
test('rest day classified', () => eq(classifyIntent('I need a rest day'), 'rest_retreat'));
test('launch classified', () => eq(classifyIntent('launching a new product'), 'creative_launch'));
test('unknown intent falls back to generic', () => eq(classifyIntent('walk the dog'), 'generic'));
test('empty intent returns generic', () => eq(classifyIntent(''), 'generic'));
test('null intent returns generic', () => eq(classifyIntent(null), 'generic'));

// =====================================================================
console.log('\nFull engine smoke test:');
// =====================================================================

// Mock astro service
const mockAstroService = {
  async getMoonPhase(dateIso) {
    // Simulate May 2026: new moon 27 May (so 25-26 May = Black Moon, 28-29 May = Shiva Moon)
    const d = new Date(dateIso + 'T00:00:00Z');
    const newMoon = new Date('2026-05-27T00:00:00Z');
    const dayDiff = Math.round((d - newMoon) / (1000 * 60 * 60 * 24));
    const isBlackMoon = dayDiff === -2 || dayDiff === -1;
    const isShivaMoon = dayDiff === 1 || dayDiff === 2;
    let phase = 'unknown';
    if (dayDiff === 0) phase = 'new';
    else if (dayDiff > 0 && dayDiff < 7) phase = 'waxing_crescent';
    else if (dayDiff >= 7 && dayDiff < 10) phase = 'first_quarter';
    else if (dayDiff >= 10 && dayDiff < 14) phase = 'waxing_gibbous';
    else if (dayDiff >= 14 && dayDiff < 17) phase = 'full';
    else if (dayDiff >= 17 && dayDiff < 22) phase = 'waning_gibbous';
    else if (dayDiff >= 22 && dayDiff < 25) phase = 'last_quarter';
    else if (dayDiff < 0 && dayDiff > -7) phase = 'waning_crescent';
    if (isShivaMoon) phase = 'shiva';
    if (isBlackMoon) phase = 'black';
    return { phase, illumination: 0.5, isBlackMoon, isShivaMoon };
  },
  async getKin(dateIso) {
    // Anchor 8 Jul 2024 = Kin 1
    // Dreamspell skips leap days (29 Feb), but for this mock we use simple modulo
    const anchor = new Date('2024-07-08T00:00:00Z');
    const d = new Date(dateIso + 'T00:00:00Z');
    const days = Math.round((d - anchor) / (1000 * 60 * 60 * 24));
    const kin = ((days % 260) + 260) % 260 + 1;
    const tone = ((kin - 1) % 13) + 1;
    const sealIdx = (kin - 1) % 20;
    const seals = ['dragon', 'wind', 'night', 'seed', 'serpent', 'worldbridger', 'hand', 'star',
                   'moon', 'dog', 'monkey', 'human', 'skywalker', 'wizard', 'eagle', 'warrior',
                   'earth', 'mirror', 'storm', 'sun'];
    // GAP days are a fixed pattern in Dreamspell. Mock: every 7th kin (placeholder).
    const isGAP = [22, 33, 44, 55, 66, 77, 121, 132, 143, 154, 165, 176].includes(kin);
    return { kin, tone, seal: seals[sealIdx], isGAP };
  },
  async getTransits(dateIso, natal) {
    // Simple mock: Jupiter trine Sun on a few specific dates in May 2026 (placeholder)
    const goodDates = ['2026-05-08', '2026-05-15', '2026-05-22'];
    const badDates = ['2026-05-04', '2026-05-19'];
    if (goodDates.includes(dateIso)) {
      return [{ planet: 'jupiter', aspect: 'trine', target: 'sun', orb: 1.2 }];
    }
    if (badDates.includes(dateIso)) {
      return [{ planet: 'saturn', aspect: 'square', target: 'sun', orb: 0.8 }];
    }
    return [];
  }
};

const userProfile = {
  dob: '1958-06-15',
  birthTime: '16:23',
  birthLocation: 'Holmes Chapel, UK',
  lifePath: 44,
  personalYear: 4,
  birthKin: 51,
  natal: { sun: 'gemini', moon: 'taurus' }
};

test('findBestDays returns three ranked days for a funding pitch in May 2026', async () => {
  const out = await findBestDays({
    userProfile,
    intent: 'Best day for a funding pitch this month',
    monthStart: '2026-05-01',
    monthEnd: '2026-05-31',
    astroService: mockAstroService,
    topN: 3
  });
  assert(out.intent.classified === 'funding_pitch', 'classified intent');
  assert(out.ranked.length === 3, 'returns top 3');
  assert(out.fullScan.length === 31, 'full scan covers month');
  // Ranked should be in decreasing total score order
  assert(out.ranked[0].totalScore >= out.ranked[1].totalScore, 'sorted desc');
  assert(out.ranked[1].totalScore >= out.ranked[2].totalScore, 'sorted desc');
  // Top day must have at least one reason
  assert(out.ranked[0].reasons.length > 0, 'has reasons');
  // Black Moon dates (25, 26 May) must NOT be in top 3 for funding intent
  const topDates = out.ranked.map(r => r.dateIso);
  assert(!topDates.includes('2026-05-25'), 'black moon excluded from top');
  assert(!topDates.includes('2026-05-26'), 'black moon excluded from top');
});

test('Black Moon dates score below average for funding intent', async () => {
  const out = await findBestDays({
    userProfile,
    intent: 'funding pitch',
    monthStart: '2026-05-25',
    monthEnd: '2026-05-26',
    astroService: mockAstroService,
    topN: 2
  });
  for (const r of out.ranked) {
    assert(r.totalScore < 60, `Black Moon should score below 60, got ${r.totalScore} on ${r.dateIso}`);
    assert(r.cautions.some(c => c.toLowerCase().includes('black moon')), 'black moon caution surfaced');
  }
});

test('Shiva Moon dates surface as reasons', async () => {
  const out = await findBestDays({
    userProfile,
    intent: 'creative launch',
    monthStart: '2026-05-28',
    monthEnd: '2026-05-29',
    astroService: mockAstroService,
    topN: 2
  });
  for (const r of out.ranked) {
    assert(r.reasons.some(c => c.toLowerCase().includes('shiva')), 'shiva moon reason surfaced');
  }
});

test('Convergence bonus fires when 3+ frameworks agree', async () => {
  // 8 May 2026: numerology day=8 (good for funding), Jupiter trine Sun (good), waxing-gibbous (good)
  const out = await findBestDays({
    userProfile,
    intent: 'funding pitch',
    monthStart: '2026-05-08',
    monthEnd: '2026-05-08',
    astroService: mockAstroService,
    topN: 1
  });
  const r = out.ranked[0];
  assert(r.convergenceBonus > 0, `convergence bonus should fire, got ${r.convergenceBonus}`);
});

// =====================================================================
console.log('\nResult:');
console.log(`  ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
