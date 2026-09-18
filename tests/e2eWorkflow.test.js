const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateNapRecommendation } = require('../src/engine/napEngine');
const { validateNapContext } = require('../src/engine/validator');
const { SnoozeManager } = require('../src/services/snoozeManager');
const { AnalyticsEngine } = require('../src/engine/analyticsEngine');
const { FirebaseService } = require('../src/services/firebaseService');

// Polyfill localStorage for Node test runner
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

test('End-to-End Workflow: Context -> Recommendation -> Nap -> Snooze -> Urgency -> Firestore Sync -> Analytics', async () => {
  const fb = new FirebaseService();
  const user = await fb.signUpWithEmailPassword('student@college.edu', 'password123', 'College Student');

  // Step 1: User Context
  const now = new Date();
  now.setHours(14, 0, 0, 0); // 2:00 PM local
  const commitment = new Date(now.getTime() + 60 * 60000); // 3:00 PM (60 min later)

  const context = {
    currentTime: now,
    commitmentTime: commitment,
    commitmentTitle: 'Computer Science Lab',
    wakeBufferMinutes: 15,
    nighttimeSleepHours: 7.0,
    typicalBedtimeHour: 23
  };

  // Step 2: Validate
  const validation = validateNapContext(context);
  assert.equal(validation.isValid, true);

  // Step 3: Calculate Recommendation
  const rec = calculateNapRecommendation(context);
  assert.equal(rec.status, 'RECOMMENDED');
  assert.equal(rec.category, 'POWER_NAP');
  assert.equal(rec.durationMinutes, 20);

  // Step 4: Active Session Start
  let scheduledWake = new Date(rec.scheduledWakeTime).getTime();
  let snoozeCount = 0;

  // Step 5: Alarm triggers when now reaches scheduled wake (2:20 PM)
  const alarmTriggerTime = scheduledWake;

  // Step 6: User clicks Snooze (+5 min)
  const snooze1 = SnoozeManager.evaluateSnooze({
    currentSnoozeCount: snoozeCount,
    currentTime: alarmTriggerTime,
    commitmentTime: commitment.getTime(),
    wakeBufferMinutes: 15,
    snoozeIntervalMinutes: 5,
    maxSnoozes: 2
  });
  assert.equal(snooze1.allowed, true);
  snoozeCount++;
  scheduledWake = snooze1.newWakeTime; // 2:25 PM

  // Step 7: Check urgency when time reaches 2:48 PM (Commitment at 3:00 PM, buffer 15m => deadline was 2:45 PM)
  const urgentTime = new Date(now.getTime() + 48 * 60000).getTime();
  const urgencyState = SnoozeManager.checkUrgencyState({
    currentTime: urgentTime,
    commitmentTime: commitment.getTime(),
    wakeBufferMinutes: 15
  });
  assert.equal(urgencyState.isUrgent, true);

  // Step 8: Complete Nap and create log
  const napLog = {
    id: 'nap_e2e_1',
    date: '2026-09-18',
    startTime: now.getTime(),
    scheduledWakeTime: scheduledWake,
    actualWakeTime: urgentTime,
    recommendedDurationMinutes: rec.durationMinutes,
    actualDurationMinutes: 48,
    commitmentTitle: context.commitmentTitle,
    commitmentTime: commitment.getTime(),
    wakeBufferMinutes: context.wakeBufferMinutes,
    category: rec.category,
    dangerZoneTriggered: rec.isInDangerZone,
    dangerZoneOverridden: false,
    snoozeCount: snoozeCount,
    urgencyTriggered: urgencyState.isUrgent
  };

  // Step 9: Sync to Firestore under authenticated user
  const syncResult = await fb.saveNapLog(napLog);
  assert.equal(syncResult.success, true);

  const storedLogs = await fb.getUserNapLogs(user.uid);
  assert.equal(storedLogs.length, 1);
  assert.equal(storedLogs[0].commitmentTitle, 'Computer Science Lab');
  assert.equal(storedLogs[0].snoozeCount, 1);
  assert.equal(storedLogs[0].urgencyTriggered, true);

  // Step 10: Compute Analytics Dashboard Summary
  const summary = AnalyticsEngine.computeSummary(storedLogs);
  assert.equal(summary.totalNaps, 1);
  assert.equal(summary.averageNapDurationMinutes, 48);
  assert.equal(summary.averageSnoozeCount, 1.0);
  assert.equal(summary.urgencyTriggerRatePercent, 100);
  assert.ok(summary.insights.length > 0);
});
