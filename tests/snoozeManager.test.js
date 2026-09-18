const test = require('node:test');
const assert = require('node:assert/strict');
const { SnoozeManager } = require('../src/services/snoozeManager');

test('Snooze allowed when within count and buffer limits', () => {
  const now = new Date('2026-09-18T14:00:00Z').getTime();
  // Commitment at 14:30, 15m buffer => buffer starts at 14:15.
  const commitment = new Date('2026-09-18T14:30:00Z').getTime();

  const result = SnoozeManager.evaluateSnooze({
    currentSnoozeCount: 0,
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15,
    snoozeIntervalMinutes: 5,
    maxSnoozes: 2
  });

  assert.equal(result.allowed, true);
  assert.equal(result.isTrimmed, false);
  assert.equal(result.actualSnoozeMinutes, 5);
  assert.equal(result.remainingSnoozes, 1);
  assert.equal(result.newWakeTime, now + 5 * 60000);
});

test('Snooze rejected when max snooze count is exceeded', () => {
  const now = new Date('2026-09-18T14:00:00Z').getTime();
  const commitment = new Date('2026-09-18T14:30:00Z').getTime();

  const result = SnoozeManager.evaluateSnooze({
    currentSnoozeCount: 2, // Max is 2
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15,
    maxSnoozes: 2
  });

  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('Maximum snooze limit reached'));
  assert.equal(result.remainingSnoozes, 0);
});

test('Snooze rejected when already inside commitment preparation buffer', () => {
  // Commitment at 14:30, 15 min buffer => Buffer starts at 14:15
  // Current time is 14:16 (inside buffer!)
  const now = new Date('2026-09-18T14:16:00Z').getTime();
  const commitment = new Date('2026-09-18T14:30:00Z').getTime();

  const result = SnoozeManager.evaluateSnooze({
    currentSnoozeCount: 0,
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15
  });

  assert.equal(result.allowed, false);
  assert.ok(result.reason.includes('preparation buffer has already begun'));
});

test('Snooze trimmed to buffer ceiling when standard 5m exceeds buffer boundary', () => {
  // Commitment at 14:30, 15 min buffer => Buffer starts at 14:15
  // Current time is 14:12 (3 minutes left before buffer)
  const now = new Date('2026-09-18T14:12:00Z').getTime();
  const commitment = new Date('2026-09-18T14:30:00Z').getTime();

  const result = SnoozeManager.evaluateSnooze({
    currentSnoozeCount: 0,
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15,
    snoozeIntervalMinutes: 5
  });

  assert.equal(result.allowed, true);
  assert.equal(result.isTrimmed, true);
  assert.equal(result.actualSnoozeMinutes, 3);
  assert.equal(result.newWakeTime, new Date('2026-09-18T14:15:00Z').getTime());
});

test('Urgency Escalation State triggers when time to commitment is inside threshold', () => {
  // Commitment in 12 minutes, buffer is 15 minutes => inside buffer threshold
  const now = new Date('2026-09-18T14:18:00Z').getTime();
  const commitment = new Date('2026-09-18T14:30:00Z').getTime();

  const urgency = SnoozeManager.checkUrgencyState({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15
  });

  assert.equal(urgency.isUrgent, true);
  assert.equal(urgency.minutesUntilCommitment, 12);
  assert.ok(urgency.reason.includes('URGENCY ALERT'));
});

test('Urgency Escalation State is false when safely before threshold', () => {
  // Commitment in 40 minutes, buffer is 15 minutes
  const now = new Date('2026-09-18T14:00:00Z').getTime();
  const commitment = new Date('2026-09-18T14:40:00Z').getTime();

  const urgency = SnoozeManager.checkUrgencyState({
    currentTime: now,
    commitmentTime: commitment,
    wakeBufferMinutes: 15
  });

  assert.equal(urgency.isUrgent, false);
  assert.equal(urgency.reason, null);
});
