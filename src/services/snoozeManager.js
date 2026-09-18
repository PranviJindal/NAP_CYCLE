/**
 * Controlled Snooze & Urgency Escalation Manager
 * 
 * Rules:
 * 1. Configurable snooze interval (default 5 minutes).
 * 2. Strict maximum snooze limit (default 2 snoozes).
 * 3. Commitment Buffer Hard Ceiling: User cannot snooze past (commitmentTime - wakeBufferMinutes).
 * 4. Urgency Escalation: When (commitmentTime - now) <= urgencyThresholdMinutes (default: wakeBufferMinutes or 10 min),
 *    triggers an escalating urgency alarm and disables further snoozing.
 */

const DEFAULT_CONFIG = {
  snoozeIntervalMinutes: 5,
  maxSnoozes: 2,
  urgencyThresholdMinutes: 10 // Minutes before commitment when urgency triggers
};

class SnoozeManager {
  /**
   * Evaluates if a snooze is allowed and calculates the new wake time.
   * @param {Object} params
   * @param {number} params.currentSnoozeCount - Number of times already snoozed
   * @param {Date|number} params.currentTime - Current time
   * @param {Date|number} params.commitmentTime - Target commitment time
   * @param {number} [params.wakeBufferMinutes=15] - Wake/prep buffer before commitment
   * @param {number} [params.snoozeIntervalMinutes=5] - Desired snooze length
   * @param {number} [params.maxSnoozes=2] - Max allowed snoozes
   * @returns {Object} { allowed: boolean, reason?: string, newWakeTime?: number, remainingSnoozes: number }
   */
  static evaluateSnooze({
    currentSnoozeCount = 0,
    currentTime = Date.now(),
    commitmentTime,
    wakeBufferMinutes = 15,
    snoozeIntervalMinutes = DEFAULT_CONFIG.snoozeIntervalMinutes,
    maxSnoozes = DEFAULT_CONFIG.maxSnoozes
  }) {
    const nowMs = typeof currentTime === 'number' ? currentTime : new Date(currentTime).getTime();
    const commitmentMs = typeof commitmentTime === 'number' ? commitmentTime : new Date(commitmentTime).getTime();
    const bufferMs = wakeBufferMinutes * 60000;
    const hardCeilingMs = commitmentMs - bufferMs;

    const remainingSnoozes = Math.max(0, maxSnoozes - currentSnoozeCount);

    // Rule 1: Max Snooze Count reached
    if (currentSnoozeCount >= maxSnoozes) {
      return {
        allowed: false,
        reason: `Maximum snooze limit reached (${maxSnoozes}/${maxSnoozes}). Further snoozing is locked to protect your commitment.`,
        remainingSnoozes: 0
      };
    }

    // Rule 2: Already inside or past commitment buffer
    if (nowMs >= hardCeilingMs) {
      return {
        allowed: false,
        reason: `Cannot snooze: your ${wakeBufferMinutes}-minute preparation buffer has already begun!`,
        remainingSnoozes
      };
    }

    // Rule 3: Proposed snooze would encroach upon the hard buffer ceiling
    const proposedWakeMs = nowMs + snoozeIntervalMinutes * 60000;
    if (proposedWakeMs > hardCeilingMs) {
      const minutesUntilBuffer = Math.floor((hardCeilingMs - nowMs) / 60000);
      if (minutesUntilBuffer < 2) {
        return {
          allowed: false,
          reason: `Insufficient time remaining before your preparation buffer starts (${minutesUntilBuffer} min left). Snooze denied.`,
          remainingSnoozes
        };
      }
      // Allow a trimmed micro-snooze if at least 2 minutes remain
      return {
        allowed: true,
        isTrimmed: true,
        newWakeTime: hardCeilingMs,
        actualSnoozeMinutes: minutesUntilBuffer,
        remainingSnoozes: remainingSnoozes - 1,
        note: `Snooze shortened to ${minutesUntilBuffer} mins to strictly respect your ${wakeBufferMinutes}-min commitment buffer.`
      };
    }

    // Standard valid snooze
    return {
      allowed: true,
      isTrimmed: false,
      newWakeTime: proposedWakeMs,
      actualSnoozeMinutes: snoozeIntervalMinutes,
      remainingSnoozes: remainingSnoozes - 1
    };
  }

  /**
   * Checks whether the active session has entered the Urgency Escalation State.
   * @param {Object} params
   * @param {Date|number} params.currentTime
   * @param {Date|number} params.commitmentTime
   * @param {number} [params.wakeBufferMinutes=15]
   * @param {boolean} [params.isAlarmActive=false]
   * @returns {Object} { isUrgent: boolean, minutesUntilCommitment: number, reason?: string }
   */
  static checkUrgencyState({
    currentTime = Date.now(),
    commitmentTime,
    wakeBufferMinutes = 15,
    isAlarmActive = false
  }) {
    const nowMs = typeof currentTime === 'number' ? currentTime : new Date(currentTime).getTime();
    const commitmentMs = typeof commitmentTime === 'number' ? commitmentTime : new Date(commitmentTime).getTime();
    const remainingMs = commitmentMs - nowMs;
    const minutesUntilCommitment = Math.max(0, Math.floor(remainingMs / 60000));

    // Urgency triggers if:
    // 1. Time remaining until commitment is less than or equal to the wake buffer + 2 minutes
    // 2. Or minutes until commitment is <= 10 min
    const thresholdMinutes = Math.max(wakeBufferMinutes, DEFAULT_CONFIG.urgencyThresholdMinutes);
    const isUrgent = remainingMs <= thresholdMinutes * 60000;

    return {
      isUrgent,
      minutesUntilCommitment,
      thresholdMinutes,
      reason: isUrgent 
        ? `⚠️ URGENCY ALERT: Only ${minutesUntilCommitment} minutes remaining before your commitment! Buffer is depleted.`
        : null
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SnoozeManager, DEFAULT_CONFIG };
}
