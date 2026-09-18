/**
 * Habit Analytics & Insights Engine
 * Pure analytics functions for longitudinal sleep and nap tracking
 * per SSD Section 7 (FR-12), Section 13, and Section 20 (Success Metrics).
 */

class AnalyticsEngine {
  /**
   * Computes comprehensive statistics from nap and sleep logs.
   * @param {Array<Object>} napLogs
   * @param {Array<Object>} [sleepLogs=[]]
   * @returns {Object} statistics and insights
   */
  static computeSummary(napLogs = [], sleepLogs = []) {
    if (!napLogs || napLogs.length === 0) {
      return {
        totalNaps: 0,
        averageNapDurationMinutes: 0,
        averageNighttimeSleepHours: 7.0,
        commitmentProtectionRatePercent: 100,
        averageSnoozeCount: 0,
        urgencyTriggerRatePercent: 0,
        dangerZoneOverrideCount: 0,
        categoryBreakdown: {
          POWER_NAP: 0,
          SHORT_NAP: 0,
          FULL_CYCLE: 0
        },
        insights: [
          'Complete your first nap session to unlock personalized sleep habits and commitment protection trends.'
        ]
      };
    }

    const totalNaps = napLogs.length;

    // 1. Average Nap Duration
    const totalDuration = napLogs.reduce((sum, log) => {
      const dur = log.actualDurationMinutes || log.recommendedDurationMinutes || 0;
      return sum + dur;
    }, 0);
    const averageNapDurationMinutes = Math.round(totalDuration / totalNaps);

    // 2. Commitment Protection Rate (% of naps ending before or at commitmentTime - wakeBuffer)
    let protectedCount = 0;
    let urgencyCount = 0;
    let dangerZoneOverrides = 0;
    let totalSnoozes = 0;
    const categoryCounts = {
      POWER_NAP: 0,
      SHORT_NAP: 0,
      FULL_CYCLE: 0
    };

    napLogs.forEach(log => {
      const actualWake = log.actualWakeTime || log.scheduledWakeTime;
      const commitment = log.commitmentTime;
      const bufferMs = (log.wakeBufferMinutes || 15) * 60000;
      const deadline = commitment - bufferMs;

      // Nap protected commitment if user woke up on or before the deadline
      if (actualWake <= deadline + 60000) { // 1 min grace tolerance
        protectedCount++;
      }

      if (log.urgencyTriggered) {
        urgencyCount++;
      }

      if (log.dangerZoneOverridden) {
        dangerZoneOverrides++;
      }

      totalSnoozes += (log.snoozeCount || 0);

      const cat = log.category || 'POWER_NAP';
      if (categoryCounts[cat] !== undefined) {
        categoryCounts[cat]++;
      }
    });

    const commitmentProtectionRatePercent = Math.round((protectedCount / totalNaps) * 100);
    const urgencyTriggerRatePercent = Math.round((urgencyCount / totalNaps) * 100);
    const averageSnoozeCount = parseFloat((totalSnoozes / totalNaps).toFixed(1));

    // 3. Average Nighttime Sleep
    let avgNightSleep = 7.0;
    if (sleepLogs && sleepLogs.length > 0) {
      const totalNightSleep = sleepLogs.reduce((acc, curr) => acc + (curr.durationHours || 7), 0);
      avgNightSleep = parseFloat((totalNightSleep / sleepLogs.length).toFixed(1));
    }

    // 4. Generate Science-Backed Habit Insights
    const insights = this._generateInsights({
      totalNaps,
      averageNapDurationMinutes,
      commitmentProtectionRatePercent,
      averageSnoozeCount,
      urgencyTriggerRatePercent,
      dangerZoneOverrides,
      categoryCounts
    });

    return {
      totalNaps,
      averageNapDurationMinutes,
      averageNighttimeSleepHours: avgNightSleep,
      commitmentProtectionRatePercent,
      averageSnoozeCount,
      urgencyTriggerRatePercent,
      dangerZoneOverrideCount: dangerZoneOverrides,
      categoryBreakdown: categoryCounts,
      insights
    };
  }

  static _generateInsights(stats) {
    const list = [];

    // Protection Insight
    if (stats.commitmentProtectionRatePercent >= 90) {
      list.push(`🎯 Flawless commitment protection: ${stats.commitmentProtectionRatePercent}% of your naps finished on or before your wake buffer.`);
    } else {
      list.push(`⚠️ Commitment protection is at ${stats.commitmentProtectionRatePercent}%. Consider expanding your preparation buffer by 5 minutes.`);
    }

    // Duration Insight
    if (stats.averageNapDurationMinutes <= 25) {
      list.push(`⚡ Optimal Power Napper: Your ${stats.averageNapDurationMinutes}-minute average nap duration prevents deep slow-wave sleep inertia.`);
    } else if (stats.averageNapDurationMinutes >= 75) {
      list.push(`🔄 Deep Restorative Focus: You frequently utilize 90-minute full cycle naps to compensate for nighttime sleep deficits.`);
    }

    // Snooze Insight
    if (stats.averageSnoozeCount <= 0.5) {
      list.push(`⏰ High Wake Discipline: You average only ${stats.averageSnoozeCount} snoozes per session.`);
    } else {
      list.push(`💤 Snooze Reliance: You average ${stats.averageSnoozeCount} snoozes per session. Setting your alarm volume higher can assist immediate waking.`);
    }

    // Danger Zone Insight
    if (stats.dangerZoneOverrides > 0) {
      list.push(`🌙 Late Nap Caution: You have overridden ${stats.dangerZoneOverrides} Danger Zone warnings. Remember that naps after 5 PM can disrupt nocturnal adenosine accumulation.`);
    }

    return list;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AnalyticsEngine };
}
