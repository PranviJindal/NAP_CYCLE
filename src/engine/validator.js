/**
 * Input Validator for Nap Calculator Context
 * Validates user inputs according to SSD requirements and boundary constraints.
 */

function validateNapContext(input) {
  const errors = [];
  const warnings = [];

  if (!input) {
    return { isValid: false, errors: ['No input context provided.'], warnings: [] };
  }

  // 1. Commitment Time
  if (!input.commitmentTime) {
    errors.push('Next commitment time is required.');
  } else {
    const commitmentDate = new Date(input.commitmentTime);
    if (isNaN(commitmentDate.getTime())) {
      errors.push('Commitment time is not a valid date.');
    } else {
      const now = input.currentTime ? new Date(input.currentTime) : new Date();
      if (commitmentDate.getTime() <= now.getTime()) {
        errors.push('Commitment time must be in the future.');
      }
    }
  }

  // 2. Wake Buffer
  if (input.wakeBufferMinutes !== undefined && input.wakeBufferMinutes !== null) {
    const buffer = Number(input.wakeBufferMinutes);
    if (isNaN(buffer) || buffer < 0 || buffer > 120) {
      errors.push('Wake buffer must be between 0 and 120 minutes.');
    } else if (buffer < 10) {
      warnings.push('A preparation buffer under 10 minutes may not leave enough time to recover from sleep inertia before your commitment.');
    }
  }

  // 3. Nighttime Sleep Duration
  if (input.nighttimeSleepHours !== undefined && input.nighttimeSleepHours !== null) {
    const sleep = Number(input.nighttimeSleepHours);
    if (isNaN(sleep) || sleep < 0 || sleep > 24) {
      errors.push('Nighttime sleep duration must be between 0 and 24 hours.');
    } else if (sleep < 5) {
      warnings.push('Significant sleep deprivation detected (< 5h). A daytime nap is strongly recommended, but adequate nighttime sleep remains essential.');
    } else if (sleep > 11) {
      warnings.push('High nighttime sleep reported (> 11h). Consider whether a daytime nap will disrupt your circadian rhythm.');
    }
  }

  // 4. Typical Bedtime
  if (input.typicalBedtimeHour !== undefined && input.typicalBedtimeHour !== null) {
    const bedtime = Number(input.typicalBedtimeHour);
    if (isNaN(bedtime) || bedtime < 0 || bedtime > 23) {
      errors.push('Bedtime hour must be an integer between 0 and 23.');
    }
  }

  // 5. Last Meal Time
  if (input.lastMealTime) {
    const mealDate = new Date(input.lastMealTime);
    if (isNaN(mealDate.getTime())) {
      errors.push('Last meal time is not a valid date.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateNapContext };
}
