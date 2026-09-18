const test = require('node:test');
const assert = require('node:assert/strict');
const { AnalyticsEngine } = require('../src/engine/analyticsEngine');

test('AnalyticsEngine handles empty logs gracefully', () => {
  const summary = AnalyticsEngine.computeSummary([]);
  assert.equal(summary.totalNaps, 0);
  assert.equal(summary.averageNapDurationMinutes, 0);
  assert.equal(summary.commitmentProtectionRatePercent, 100);
  assert.ok(summary.insights.length > 0);
});

test('AnalyticsEngine computes correct averages and protection rates', () => {
  const baseTime = new Date('2026-09-18T14:00:00Z').getTime();

  const mockLogs = [
    {
      id: '1',
      actualDurationMinutes: 20,
      actualWakeTime: baseTime + 20 * 60000,
      commitmentTime: baseTime + 60 * 60000,
      wakeBufferMinutes: 15,
      snoozeCount: 0,
      category: 'POWER_NAP',
      urgencyTriggered: false,
      dangerZoneOverridden: false
    },
    {
      id: '2',
      actualDurationMinutes: 30,
      actualWakeTime: baseTime + 45 * 60000, // On the dot: 60 - 15 = 45m
      commitmentTime: baseTime + 60 * 60000,
      wakeBufferMinutes: 15,
      snoozeCount: 1,
      category: 'POWER_NAP',
      urgencyTriggered: true,
      dangerZoneOverridden: true
    },
    {
      id: '3',
      actualDurationMinutes: 90,
      actualWakeTime: baseTime + 105 * 60000, // Overshot! Deadline was 120 - 15 = 105m + 10m buffer breach
      commitmentTime: baseTime + 110 * 60000,
      wakeBufferMinutes: 15,
      snoozeCount: 2,
      category: 'FULL_CYCLE',
      urgencyTriggered: true,
      dangerZoneOverridden: false
    }
  ];

  const summary = AnalyticsEngine.computeSummary(mockLogs);

  // Total Naps
  assert.equal(summary.totalNaps, 3);
  
  // Average Duration: (20 + 30 + 90) / 3 = 46.66 => 47 mins
  assert.equal(summary.averageNapDurationMinutes, 47);

  // Snooze Count Average: (0 + 1 + 2) / 3 = 1.0
  assert.equal(summary.averageSnoozeCount, 1.0);

  // Urgency Trigger Rate: 2 out of 3 = 67%
  assert.equal(summary.urgencyTriggerRatePercent, 67);

  // Danger Zone Overrides: 1
  assert.equal(summary.dangerZoneOverrideCount, 1);

  // Category breakdown
  assert.equal(summary.categoryBreakdown.POWER_NAP, 2);
  assert.equal(summary.categoryBreakdown.FULL_CYCLE, 1);
  assert.equal(summary.categoryBreakdown.SHORT_NAP, 0);

  // Insights generated
  assert.ok(summary.insights.some(i => i.includes('Danger Zone')));
});
