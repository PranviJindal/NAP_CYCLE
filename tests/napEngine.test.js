const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateNapRecommendation } = require('../src/engine/napEngine');
const { validateNapContext } = require('../src/engine/validator');

test('Validation - past commitment time should be rejected', () => {
  const now = new Date();
  now.setHours(14, 0, 0, 0);
  const past = new Date(now.getTime() - 30 * 60000); // 30 mins ago
  
  const validation = validateNapContext({
    currentTime: now,
    commitmentTime: past
  });
  assert.equal(validation.isValid, false);
  assert.ok(validation.errors.some(e => e.includes('future')));

  const result = calculateNapRecommendation({
    currentTime: now,
    commitmentTime: past
  });
  assert.equal(result.status, 'INVALID');
  assert.equal(result.durationMinutes, 0);
});

test('Validation - negative sleep or excessive buffer rejected', () => {
  const now = new Date();
  now.setHours(14, 0, 0, 0);
  const commitment = new Date(now.getTime() + 60 * 60000);

  const res1 = validateNapContext({
    currentTime: now,
    commitmentTime: commitment,
    nighttimeSleepHours: -2
  });
  assert.equal(res1.isValid, false);

  const res2 = validateNapContext({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 150 // max 120
  });
  assert.equal(res2.isValid, false);
});

test('Insufficient window (< 15 mins available after buffer) returns SKIP', () => {
  const now = new Date();
  now.setHours(14, 0, 0, 0);
  // Commitment in 20 minutes, with 15 min buffer => 5 min window
  const commitment = new Date(now.getTime() + 20 * 60000);

  const result = calculateNapRecommendation({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15
  });

  assert.equal(result.status, 'SKIP');
  assert.equal(result.durationMinutes, 0);
  assert.equal(result.availableWindowMinutes, 5);
  assert.ok(result.explanation.includes('Insufficient time window'));
});

test('Exact 15 min available window returns 15-minute micro nap', () => {
  const now = new Date();
  now.setHours(14, 0, 0, 0);
  // Commitment in 30 minutes, 15 min buffer => 15 min available window
  const commitment = new Date(now.getTime() + 30 * 60000);

  const result = calculateNapRecommendation({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15
  });

  assert.equal(result.status, 'RECOMMENDED');
  assert.equal(result.category, 'SHORT_NAP');
  assert.equal(result.durationMinutes, 15);
  assert.equal(result.sleepInertiaRisk, 'LOW');
});

test('Standard window returns 20-minute Power Nap (Gold standard)', () => {
  const now = new Date();
  now.setHours(14, 0, 0, 0); // 2:00 PM local
  // Commitment in 60 minutes, 15 min buffer => 45 min available
  const commitment = new Date(now.getTime() + 60 * 60000);

  const result = calculateNapRecommendation({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15,
    nighttimeSleepHours: 7.5,
    typicalBedtimeHour: 23
  });

  assert.equal(result.status, 'RECOMMENDED');
  assert.equal(result.category, 'POWER_NAP');
  assert.equal(result.durationMinutes, 20);
  assert.equal(result.sleepInertiaRisk, 'LOW');
  assert.equal(result.availableWindowMinutes, 45);
  assert.equal(result.isInDangerZone, false);
  
  const scheduledWake = new Date(result.scheduledWakeTime);
  assert.equal(scheduledWake.getTime(), now.getTime() + 20 * 60000);
});

test('Ample window + sleep debt (< 6.5h) returns 90-minute Full Cycle Nap', () => {
  const now = new Date();
  now.setHours(13, 0, 0, 0); // 1:00 PM local
  // Commitment in 2.5 hours (150 min), 15 min buffer => 135 min available
  const commitment = new Date(now.getTime() + 150 * 60000);

  const result = calculateNapRecommendation({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15,
    nighttimeSleepHours: 5.0, // High sleep debt
    typicalBedtimeHour: 23
  });

  assert.equal(result.status, 'RECOMMENDED');
  assert.equal(result.category, 'FULL_CYCLE');
  assert.equal(result.durationMinutes, 90);
  assert.equal(result.sleepInertiaRisk, 'MEDIUM');
  assert.equal(result.isInDangerZone, false);
  assert.ok(result.explanation.includes('90-minute nap covers slow-wave sleep and REM'));
});

test('Danger Zone detected when nap is within 6 hours of bedtime', () => {
  // Current time: 18:30 (6:30 PM), bedtime: 23:00 (11:00 PM) => 4.5 hours until bedtime
  const now = new Date();
  now.setHours(18, 30, 0, 0);
  const commitment = new Date(now.getTime() + 120 * 60000); // 8:30 PM

  const result = calculateNapRecommendation({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15,
    typicalBedtimeHour: 23,
    nighttimeSleepHours: 4.5 // Even with sleep debt, should NOT give 90m in Danger Zone!
  });

  assert.equal(result.status, 'CAUTION');
  assert.equal(result.isInDangerZone, true);
  assert.ok(result.dangerZoneReason.includes('within 6 hours of bedtime'));
  assert.equal(result.durationMinutes, 20); // Restricted to short power nap
});

test('Recent meal timing adds digestion consideration note', () => {
  const now = new Date();
  now.setHours(14, 0, 0, 0);
  const mealTime = new Date(now.getTime() - 20 * 60000); // 20 mins ago
  const commitment = new Date(now.getTime() + 60 * 60000);

  const result = calculateNapRecommendation({
    currentTime: now,
    commitmentTime: commitment,
    lastMealTime: mealTime
  });

  assert.ok(result.explanation.includes('Digestion note'));
});
