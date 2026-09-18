/**
 * Science-Backed Nap Optimization Engine
 * Pure, deterministic rule-based calculation module.
 * 
 * Based on Sleep Science Principles:
 * 1. Power Nap (15-20 min): Stage 1 & 2 NREM sleep; boosts alertness & cognition without slow-wave sleep inertia.
 * 2. Short Nap (25-30 min): Moderate recovery, minimal grogginess if woke before deep sleep.
 * 3. Full Cycle Nap (90 min): Complete sleep cycle (NREM 1-3 + REM); recommended only for high sleep debt with ample window.
 * 4. Danger Zone: Within 6 hours of bedtime or late evening; risks nighttime sleep onset insomnia.
 * 5. Circadian Postprandial Dip: 1:00 PM - 3:30 PM is biologically optimal for daytime sleepiness.
 */

/**
 * Validates and calculates a science-backed nap recommendation.
 * @param {Object} context
 * @param {Date|string|number} [context.currentTime] - Current local time (default: now)
 * @param {Date|string|number} context.commitmentTime - Target future commitment time
 * @param {string} [context.commitmentTitle] - Title/name of commitment (e.g. "Team Meeting")
 * @param {number} [context.wakeBufferMinutes=15] - Wake/prep buffer before commitment
 * @param {number} [context.nighttimeSleepHours=7] - Previous night's sleep duration in hours
 * @param {number} [context.typicalBedtimeHour=23] - User's typical bedtime in 24h format (default 23:00)
 * @param {Date|string|number|null} [context.lastMealTime=null] - Approximate time of last meal
 * @returns {Object} recommendation
 */
function calculateNapRecommendation(context) {
  if (!context || !context.commitmentTime) {
    throw new Error('Commitment time is required for nap calculation.');
  }

  const now = context.currentTime ? new Date(context.currentTime) : new Date();
  const commitment = new Date(context.commitmentTime);
  const wakeBuffer = Number.isFinite(context.wakeBufferMinutes) ? Math.max(0, context.wakeBufferMinutes) : 15;
  const nighttimeSleep = Number.isFinite(context.nighttimeSleepHours) ? Math.max(0, context.nighttimeSleepHours) : 7.0;
  const bedtimeHour = Number.isFinite(context.typicalBedtimeHour) ? context.typicalBedtimeHour : 23;
  const commitmentTitle = (context.commitmentTitle && context.commitmentTitle.trim()) || 'Next Commitment';

  // 1. Time Difference & Available Window
  const totalDiffMs = commitment.getTime() - now.getTime();
  const totalAvailableMinutes = Math.floor(totalDiffMs / 60000);
  const napWindowMinutes = totalAvailableMinutes - wakeBuffer;

  // Validation: Commitment in the past
  if (totalDiffMs <= 0) {
    return {
      status: 'INVALID',
      durationMinutes: 0,
      category: 'NONE',
      startTime: now.toISOString(),
      scheduledWakeTime: now.toISOString(),
      commitmentTime: commitment.toISOString(),
      commitmentTitle,
      wakeBufferMinutes: wakeBuffer,
      availableWindowMinutes: 0,
      isInDangerZone: false,
      dangerZoneReason: null,
      sleepInertiaRisk: 'LOW',
      explanation: 'The specified commitment time is in the past. Please select a future commitment.'
    };
  }

  // 2. Insufficient time check
  if (napWindowMinutes < 15) {
    return {
      status: 'SKIP',
      durationMinutes: 0,
      category: 'NONE',
      startTime: now.toISOString(),
      scheduledWakeTime: now.toISOString(),
      commitmentTime: commitment.toISOString(),
      commitmentTitle,
      wakeBufferMinutes: wakeBuffer,
      availableWindowMinutes: Math.max(0, napWindowMinutes),
      isInDangerZone: false,
      dangerZoneReason: null,
      sleepInertiaRisk: 'LOW',
      explanation: `Insufficient time window (${Math.max(0, napWindowMinutes)} mins available after reserving your ${wakeBuffer}-min preparation buffer). Scientific naps require at least 15 minutes to reach restorative light sleep without risking missed commitments.`
    };
  }

  // 3. Danger Zone Evaluation
  // Evaluate distance to expected bedtime.
  const todayBedtime = new Date(now);
  todayBedtime.setHours(bedtimeHour, 0, 0, 0);
  if (todayBedtime.getTime() <= now.getTime()) {
    // Bedtime is early tomorrow morning (e.g. 1 AM)
    todayBedtime.setDate(todayBedtime.getDate() + 1);
  }

  const hoursUntilBedtime = (todayBedtime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isLateAfternoonOrEvening = now.getHours() >= 17 || hoursUntilBedtime < 6.0;
  
  let isInDangerZone = false;
  let dangerZoneReason = null;

  if (isLateAfternoonOrEvening) {
    isInDangerZone = true;
    dangerZoneReason = `Napping within 6 hours of bedtime (bedtime at ${String(bedtimeHour).padStart(2, '0')}:00) diminishes homeostatic sleep pressure (adenosine accumulation), which may delay nighttime sleep onset and cause insomnia.`;
  }

  // 4. Circadian Window Check (Postprandial dip: 13:00 to 15:30)
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const isOptimalCircadian = currentHour >= 13.0 && currentHour <= 15.5;

  // 5. Select Optimal Duration Category
  let category = 'POWER_NAP';
  let durationMinutes = 20;
  let sleepInertiaRisk = 'LOW';
  let scientificNotes = [];

  if (napWindowMinutes >= 105 && nighttimeSleep < 6.5 && !isInDangerZone) {
    // 90-minute Full Sleep Cycle
    category = 'FULL_CYCLE';
    durationMinutes = 90;
    sleepInertiaRisk = 'MEDIUM';
    scientificNotes.push(
      `High sleep debt detected (${nighttimeSleep}h sleep last night) with ample window before your commitment. A 90-minute nap covers slow-wave sleep and REM, allowing you to wake up at a natural cycle boundary.`
    );
  } else if (napWindowMinutes >= 25) {
    // 20-minute Power Nap (Gold standard for daytime alertness)
    category = 'POWER_NAP';
    durationMinutes = 20;
    sleepInertiaRisk = 'LOW';
    scientificNotes.push(
      'A 20-minute power nap restores alertness, motor performance, and working memory while keeping you within light Stage 1/2 sleep to avoid groggy sleep inertia.'
    );
  } else {
    // Micro Nap (15 minutes)
    category = 'SHORT_NAP';
    durationMinutes = 15;
    sleepInertiaRisk = 'LOW';
    scientificNotes.push(
      `A tight window is available (${napWindowMinutes} mins). A focused 15-minute rest helps reduce cognitive fatigue while strictly safeguarding your ${wakeBuffer}-min buffer.`
    );
  }

  // Danger Zone override adjustments
  if (isInDangerZone) {
    // In danger zone, keep nap strictly short (max 15-20 min) if user insists on napping
    if (durationMinutes > 20) {
      durationMinutes = 20;
      category = 'POWER_NAP';
      sleepInertiaRisk = 'LOW';
    }
    scientificNotes.push('⚠️ Danger Zone active: Limited to a short power nap to minimize nighttime sleep disruption.');
  }

  // Circadian note
  if (isOptimalCircadian) {
    scientificNotes.push('Biologically aligned: You are in the natural afternoon circadian dip (1:00 PM – 3:30 PM), ensuring rapid sleep onset.');
  }

  // Meal timing consideration
  if (context.lastMealTime) {
    const meal = new Date(context.lastMealTime);
    const minsSinceMeal = Math.floor((now.getTime() - meal.getTime()) / 60000);
    if (minsSinceMeal >= 0 && minsSinceMeal < 45) {
      scientificNotes.push('Digestion note: Last meal was recent; an elevated or semi-reclined resting posture will prevent gastroesophageal discomfort.');
    }
  }

  // Calculate target wake-up time
  const scheduledWakeTime = new Date(now.getTime() + durationMinutes * 60000);

  // Status determined by Danger Zone
  const status = isInDangerZone ? 'CAUTION' : 'RECOMMENDED';

  return {
    status,
    durationMinutes,
    category,
    startTime: now.toISOString(),
    scheduledWakeTime: scheduledWakeTime.toISOString(),
    commitmentTime: commitment.toISOString(),
    commitmentTitle,
    wakeBufferMinutes: wakeBuffer,
    availableWindowMinutes: napWindowMinutes,
    isInDangerZone,
    dangerZoneReason,
    sleepInertiaRisk,
    explanation: scientificNotes.join(' ')
  };
}

// Support both CommonJS and ES Module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateNapRecommendation };
}
