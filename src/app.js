/**
 * Science-Backed Nap Calculator - Main Application Controller (P1 + P2 + P3)
 * Handles user interactions, state transitions, live timer, alarm audio,
 * Danger Zone override flow, controlled snooze, urgency escalation, Firebase sync,
 * and Longitudinal Habit Analytics Dashboard.
 */

(function () {
  // References to external dependencies
  const engine = typeof calculateNapRecommendation !== 'undefined' 
    ? calculateNapRecommendation 
    : (window.calculateNapRecommendation || null);
    
  const validator = typeof validateNapContext !== 'undefined'
    ? validateNapContext
    : (window.validateNapContext || null);

  const storage = typeof StorageService !== 'undefined'
    ? StorageService
    : (window.StorageService || null);

  const audio = typeof alarmAudio !== 'undefined'
    ? alarmAudio
    : (window.alarmAudio || null);

  const snoozeMgr = typeof SnoozeManager !== 'undefined'
    ? SnoozeManager
    : (window.SnoozeManager || null);

  const fbService = typeof firebaseService !== 'undefined'
    ? firebaseService
    : (window.firebaseService || null);

  const analytics = typeof AnalyticsEngine !== 'undefined'
    ? AnalyticsEngine
    : (window.AnalyticsEngine || null);

  // Application State
  const state = {
    currentScreen: 'HOME', // 'HOME' | 'RECOMMENDATION' | 'ALARM' | 'DASHBOARD'
    now: new Date(),
    formData: {
      commitmentTitle: 'Afternoon Lecture',
      commitmentTimeStr: '',
      wakeBufferMinutes: 15,
      nighttimeSleepHours: 7.0,
      typicalBedtimeHour: 23,
      lastMealMinutesAgo: null
    },
    recommendation: null,
    activeSession: null,
    timerId: null,
    isRinging: false,
    isUrgent: false,
    authMode: 'SIGN_IN' // 'SIGN_IN' | 'REGISTER'
  };

  // Helper: Format Date to hh:mm A
  function formatTime(date) {
    if (!date) return '--:--';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Helper: Format Date to ISO string suitable for datetime-local input (YYYY-MM-DDTHH:mm)
  function toDateTimeLocalString(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  }

  // Initialize Default Inputs
  function initDefaults() {
    const prefs = storage ? storage.getPreferences() : {};
    state.formData.wakeBufferMinutes = prefs.wakeBufferMinutes || 15;
    state.formData.nighttimeSleepHours = prefs.nighttimeSleepHours || 7.0;
    state.formData.typicalBedtimeHour = prefs.typicalBedtimeHour || 23;

    // Default commitment time: 1 hour from right now
    const defaultCommitment = new Date(Date.now() + 60 * 60000);
    state.formData.commitmentTimeStr = toDateTimeLocalString(defaultCommitment);
  }

  // DOM Elements Cache
  let dom = {};

  function cacheDom() {
    dom = {
      liveClock: document.getElementById('liveClock'),
      circadianStatus: document.getElementById('circadianStatus'),
      syncIndicator: document.getElementById('syncIndicator'),
      authHeaderBtn: document.getElementById('authHeaderBtn'),
      authHeaderName: document.getElementById('authHeaderName'),
      
      // Navigation
      navTabCalc: document.getElementById('navTabCalc'),
      navTabDash: document.getElementById('navTabDash'),

      // Screens
      screenHome: document.getElementById('screenHome'),
      screenRecommendation: document.getElementById('screenRecommendation'),
      screenAlarm: document.getElementById('screenAlarm'),
      screenDashboard: document.getElementById('screenDashboard'),

      // Home Inputs
      inputTitle: document.getElementById('inputCommitmentTitle'),
      inputTime: document.getElementById('inputCommitmentTime'),
      sliderBuffer: document.getElementById('sliderBuffer'),
      bufferDisplay: document.getElementById('bufferDisplay'),
      sliderSleep: document.getElementById('sliderSleep'),
      sleepDisplay: document.getElementById('sleepDisplay'),
      sliderBedtime: document.getElementById('sliderBedtime'),
      bedtimeDisplay: document.getElementById('bedtimeDisplay'),
      selectMeal: document.getElementById('selectMeal'),
      homeErrorBox: document.getElementById('homeErrorBox'),
      btnCalculate: document.getElementById('btnCalculate'),
      btnTestAudio: document.getElementById('btnTestAudio'),

      // Preset buttons
      presetButtons: document.querySelectorAll('.preset-btn'),

      // Recommendation Screen Elements
      recCategoryTag: document.getElementById('recCategoryTag'),
      recDurationHero: document.getElementById('recDurationHero'),
      recDangerBanner: document.getElementById('recDangerBanner'),
      recDangerReason: document.getElementById('recDangerReason'),
      recTimelineNow: document.getElementById('recTimelineNow'),
      recTimelineWake: document.getElementById('recTimelineWake'),
      recTimelineCommitment: document.getElementById('recTimelineCommitment'),
      recInertiaBadge: document.getElementById('recInertiaBadge'),
      recExplanation: document.getElementById('recExplanation'),
      btnStartNap: document.getElementById('btnStartNap'),
      btnBackToHome: document.getElementById('btnBackToHome'),

      // Alarm Screen Elements
      alarmCommitmentName: document.getElementById('alarmCommitmentName'),
      alarmCommitmentDetails: document.getElementById('alarmCommitmentDetails'),
      alarmCountdownDigits: document.getElementById('alarmCountdownDigits'),
      timerProgressCircle: document.getElementById('timerProgressCircle'),
      alarmStatusSubtext: document.getElementById('alarmStatusSubtext'),
      btnDismissAlarm: document.getElementById('btnDismissAlarm'),
      btnSnoozeAlarm: document.getElementById('btnSnoozeAlarm'),
      alarmRingBanner: document.getElementById('alarmRingBanner'),
      alarmUrgencyBanner: document.getElementById('alarmUrgencyBanner'),
      alarmUrgencyText: document.getElementById('alarmUrgencyText'),

      // Simulation tool buttons
      btnSimFastForward: document.getElementById('btnSimFastForward'),
      btnSimTriggerAlarm: document.getElementById('btnSimTriggerAlarm'),
      btnSimTriggerUrgency: document.getElementById('btnSimTriggerUrgency'),

      // Danger Zone Modal Elements
      dangerZoneModal: document.getElementById('dangerZoneModal'),
      btnCloseDangerModal: document.getElementById('btnCloseDangerModal'),
      btnDangerSkip: document.getElementById('btnDangerSkip'),
      btnDangerOverride: document.getElementById('btnDangerOverride'),

      // Auth Modal Elements
      authModal: document.getElementById('authModal'),
      btnCloseAuthModal: document.getElementById('btnCloseAuthModal'),
      authSignedInView: document.getElementById('authSignedInView'),
      authSignedOutView: document.getElementById('authSignedOutView'),
      authUserName: document.getElementById('authUserName'),
      authUserEmail: document.getElementById('authUserEmail'),
      btnSignOut: document.getElementById('btnSignOut'),
      tabSignIn: document.getElementById('tabSignIn'),
      tabRegister: document.getElementById('tabRegister'),
      groupDisplayName: document.getElementById('groupDisplayName'),
      authInputName: document.getElementById('authInputName'),
      authInputEmail: document.getElementById('authInputEmail'),
      authInputPassword: document.getElementById('authInputPassword'),
      btnAuthSubmit: document.getElementById('btnAuthSubmit'),
      btnGoogleAuth: document.getElementById('btnGoogleAuth'),
      authErrorMsg: document.getElementById('authErrorMsg'),

      // Dashboard Elements (P3)
      statProtectionRate: document.getElementById('statProtectionRate'),
      statAvgDuration: document.getElementById('statAvgDuration'),
      statSnoozeFreq: document.getElementById('statSnoozeFreq'),
      statTotalNaps: document.getElementById('statTotalNaps'),
      catSegmentPower: document.getElementById('catSegmentPower'),
      catSegmentCycle: document.getElementById('catSegmentCycle'),
      catSegmentMicro: document.getElementById('catSegmentMicro'),
      dashboardInsightsList: document.getElementById('dashboardInsightsList'),
      dashboardHistoryList: document.getElementById('dashboardHistoryList'),
      btnLoadDemoData: document.getElementById('btnLoadDemoData'),
      btnClearHistory: document.getElementById('btnClearHistory')
    };
  }

  // Live Clock Update
  function updateLiveClock() {
    state.now = new Date();
    if (dom.liveClock) {
      dom.liveClock.textContent = state.now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    const currentDecHour = state.now.getHours() + state.now.getMinutes() / 60;
    if (dom.circadianStatus) {
      if (currentDecHour >= 13.0 && currentDecHour <= 15.5) {
        dom.circadianStatus.className = 'circadian-pill optimal';
        dom.circadianStatus.innerHTML = '<span class="pulse-dot"></span> Optimal Circadian Nap Window (1-3:30 PM)';
      } else if (state.now.getHours() >= 17) {
        dom.circadianStatus.className = 'circadian-pill';
        dom.circadianStatus.innerHTML = '🌙 Late Daytime (Bedtime Proximity Zone)';
      } else {
        dom.circadianStatus.className = 'circadian-pill';
        dom.circadianStatus.innerHTML = '☀️ Standard Daytime Window';
      }
    }
  }

  // Switch Screen View
  function showScreen(screenName) {
    state.currentScreen = screenName;
    dom.screenHome.style.display = screenName === 'HOME' ? 'flex' : 'none';
    dom.screenRecommendation.style.display = screenName === 'RECOMMENDATION' ? 'flex' : 'none';
    dom.screenAlarm.style.display = screenName === 'ALARM' ? 'flex' : 'none';
    dom.screenDashboard.style.display = screenName === 'DASHBOARD' ? 'flex' : 'none';

    // Update Nav bar active styling
    if (screenName === 'DASHBOARD') {
      dom.navTabDash.classList.add('active');
      dom.navTabCalc.classList.remove('active');
      renderDashboard();
    } else {
      dom.navTabCalc.classList.add('active');
      dom.navTabDash.classList.remove('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Handle Calculate Action
  function handleCalculate() {
    const commitmentTime = new Date(dom.inputTime.value);
    const commitmentTitle = dom.inputTitle.value.trim() || 'Next Commitment';
    const wakeBufferMinutes = parseInt(dom.sliderBuffer.value, 10);
    const nighttimeSleepHours = parseFloat(dom.sliderSleep.value);
    const typicalBedtimeHour = parseInt(dom.sliderBedtime.value, 10);

    let lastMealTime = null;
    const mealDelta = dom.selectMeal.value;
    if (mealDelta && mealDelta !== 'none') {
      const minsAgo = parseInt(mealDelta, 10);
      lastMealTime = new Date(Date.now() - minsAgo * 60000);
    }

    const context = {
      currentTime: state.now,
      commitmentTime,
      commitmentTitle,
      wakeBufferMinutes,
      nighttimeSleepHours,
      typicalBedtimeHour,
      lastMealTime
    };

    if (validator) {
      const validation = validator(context);
      if (!validation.isValid) {
        dom.homeErrorBox.style.display = 'block';
        dom.homeErrorBox.innerHTML = `<strong>Input Error:</strong> ${validation.errors.join('<br>')}`;
        return;
      }
    }

    dom.homeErrorBox.style.display = 'none';

    if (storage) {
      storage.savePreferences({
        wakeBufferMinutes,
        typicalBedtimeHour,
        nighttimeSleepHours
      });
    }

    const recommendation = engine(context);
    state.recommendation = recommendation;

    renderRecommendation(recommendation);
    showScreen('RECOMMENDATION');
  }

  // Render Recommendation Details
  function renderRecommendation(rec) {
    if (rec.status === 'SKIP') {
      dom.recCategoryTag.textContent = 'NO NAP RECOMMENDED';
      dom.recCategoryTag.style.background = 'rgba(251, 113, 133, 0.2)';
      dom.recCategoryTag.style.color = '#fb7185';
      dom.recDurationHero.innerHTML = `0 <span class="rec-duration-unit">min</span>`;
      dom.btnStartNap.style.display = 'none';
    } else {
      dom.recCategoryTag.textContent = rec.category.replace('_', ' ');
      dom.recCategoryTag.style.background = 'rgba(56, 189, 248, 0.2)';
      dom.recCategoryTag.style.color = '#38bdf8';
      dom.recDurationHero.innerHTML = `${rec.durationMinutes} <span class="rec-duration-unit">min nap</span>`;
      dom.btnStartNap.style.display = 'flex';
    }

    if (rec.isInDangerZone) {
      dom.recDangerBanner.style.display = 'flex';
      dom.recDangerReason.textContent = rec.dangerZoneReason;
    } else {
      dom.recDangerBanner.style.display = 'none';
    }

    dom.recTimelineNow.textContent = formatTime(rec.startTime);
    dom.recTimelineWake.textContent = formatTime(rec.scheduledWakeTime);
    dom.recTimelineCommitment.textContent = formatTime(rec.commitmentTime);

    dom.recInertiaBadge.textContent = `Sleep Inertia Risk: ${rec.sleepInertiaRisk}`;
    dom.recInertiaBadge.style.color = rec.sleepInertiaRisk === 'LOW' ? '#34d399' : '#fbbf24';

    dom.recExplanation.textContent = rec.explanation;
  }

  // Start Nap Interceptor: Checks Danger Zone modal first
  function handleStartNapClick() {
    if (!state.recommendation || state.recommendation.durationMinutes <= 0) return;

    if (state.recommendation.isInDangerZone) {
      dom.dangerZoneModal.style.display = 'flex';
    } else {
      executeStartNap(false);
    }
  }

  // Execute Nap Session Start
  function executeStartNap(dangerZoneOverridden = false) {
    dom.dangerZoneModal.style.display = 'none';

    const session = {
      startTime: Date.now(),
      scheduledWakeTime: Date.now() + state.recommendation.durationMinutes * 60000,
      totalDurationMinutes: state.recommendation.durationMinutes,
      commitmentTitle: state.recommendation.commitmentTitle,
      commitmentTime: new Date(state.recommendation.commitmentTime).getTime(),
      wakeBufferMinutes: state.recommendation.wakeBufferMinutes,
      category: state.recommendation.category,
      dangerZoneTriggered: state.recommendation.isInDangerZone,
      dangerZoneOverridden,
      snoozeCount: 0,
      maxSnoozes: 2,
      urgencyTriggered: false
    };

    state.activeSession = session;
    if (storage) {
      storage.saveActiveSession(session);
    }

    initActiveAlarm(session);
    showScreen('ALARM');
  }

  // Initialize Active Alarm and Countdown loop
  function initActiveAlarm(session) {
    dom.alarmCommitmentName.textContent = session.commitmentTitle;
    dom.alarmCommitmentDetails.textContent = `At ${formatTime(session.commitmentTime)} (${session.wakeBufferMinutes}m wake buffer)`;

    dom.alarmRingBanner.style.display = 'none';
    dom.alarmUrgencyBanner.style.display = 'none';
    dom.screenAlarm.classList.remove('alarm-ringing-card');
    dom.screenAlarm.classList.remove('urgency-pulsing');
    state.isRinging = false;
    state.isUrgent = false;

    updateSnoozeButtonState();

    if (state.timerId) {
      clearInterval(state.timerId);
    }

    updateAlarmTick();
    state.timerId = setInterval(updateAlarmTick, 1000);
  }

  // Update Snooze button label and enabled status
  function updateSnoozeButtonState() {
    if (!state.activeSession) return;
    const remainingSnoozes = Math.max(0, (state.activeSession.maxSnoozes || 2) - state.activeSession.snoozeCount);

    if (state.isUrgent) {
      dom.btnSnoozeAlarm.disabled = true;
      dom.btnSnoozeAlarm.innerHTML = '<span>🚫 Snooze Locked (Urgent)</span>';
      return;
    }

    if (remainingSnoozes <= 0) {
      dom.btnSnoozeAlarm.disabled = true;
      dom.btnSnoozeAlarm.innerHTML = '<span>🔒 Snooze Limit Reached</span>';
    } else {
      dom.btnSnoozeAlarm.disabled = false;
      dom.btnSnoozeAlarm.innerHTML = `<span>💤 Snooze +5m (${remainingSnoozes} left)</span>`;
    }
  }

  // Ticking function for Active Nap (Countdown + Urgency Escalation check)
  function updateAlarmTick() {
    if (!state.activeSession) return;

    const nowMs = Date.now();
    const remainingMs = state.activeSession.scheduledWakeTime - nowMs;
    const totalDurationMs = state.activeSession.totalDurationMinutes * 60000;

    // Check Urgency Escalation State (P2)
    if (snoozeMgr) {
      const urgency = snoozeMgr.checkUrgencyState({
        currentTime: nowMs,
        commitmentTime: state.activeSession.commitmentTime,
        wakeBufferMinutes: state.activeSession.wakeBufferMinutes
      });

      if (urgency.isUrgent && !state.isUrgent) {
        state.isUrgent = true;
        state.activeSession.urgencyTriggered = true;
        triggerUrgencyEscalation(urgency.minutesUntilCommitment);
      } else if (state.isUrgent) {
        dom.alarmUrgencyText.textContent = `Only ${urgency.minutesUntilCommitment}m remaining before ${state.activeSession.commitmentTitle}! Snooze locked.`;
      }
    }

    if (remainingMs <= 0) {
      // Countdown reached zero -> Trigger Alarm!
      dom.alarmCountdownDigits.textContent = '00:00';
      setProgress(1.0);
      triggerWakeAlarm();
      return;
    }

    // Calculate mm:ss
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    dom.alarmCountdownDigits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Progress (0 to 1)
    const elapsedMs = totalDurationMs - remainingMs;
    const progress = Math.min(1.0, Math.max(0, elapsedMs / totalDurationMs));
    setProgress(progress);

    const wakeTimeStr = formatTime(state.activeSession.scheduledWakeTime);
    dom.alarmStatusSubtext.textContent = `Scheduled wake-up at ${wakeTimeStr}`;
  }

  // Set circular SVG progress
  function setProgress(progress) {
    if (!dom.timerProgressCircle) return;
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;
    dom.timerProgressCircle.style.strokeDasharray = `${circumference}`;
    dom.timerProgressCircle.style.strokeDashoffset = `${offset}`;
  }

  // Trigger Normal Wake Alarm
  function triggerWakeAlarm() {
    if (state.isRinging) return;
    state.isRinging = true;

    dom.alarmRingBanner.style.display = 'flex';
    dom.screenAlarm.classList.add('alarm-ringing-card');
    dom.alarmStatusSubtext.textContent = '🔔 Time to wake up! Buffering for your commitment.';

    if (!state.isUrgent && audio) {
      audio.startAlarm();
    }
  }

  // Trigger Urgency Escalation Alarm (P2)
  function triggerUrgencyEscalation(minutesRemaining) {
    dom.alarmUrgencyBanner.style.display = 'flex';
    dom.alarmUrgencyText.textContent = `Only ${minutesRemaining}m remaining before ${state.activeSession.commitmentTitle}! Snooze locked.`;
    dom.screenAlarm.classList.add('urgency-pulsing');
    updateSnoozeButtonState();

    if (audio) {
      audio.startUrgencyAlarm();
    }
  }

  // Handle Controlled Snooze (P2)
  function handleSnooze() {
    if (!state.activeSession || !snoozeMgr) return;

    const evaluation = snoozeMgr.evaluateSnooze({
      currentSnoozeCount: state.activeSession.snoozeCount,
      currentTime: Date.now(),
      commitmentTime: state.activeSession.commitmentTime,
      wakeBufferMinutes: state.activeSession.wakeBufferMinutes,
      snoozeIntervalMinutes: 5,
      maxSnoozes: state.activeSession.maxSnoozes || 2
    });

    if (!evaluation.allowed) {
      alert(evaluation.reason);
      updateSnoozeButtonState();
      return;
    }

    state.activeSession.snoozeCount += 1;
    state.activeSession.scheduledWakeTime = evaluation.newWakeTime;
    
    if (audio) {
      audio.stopAlarm();
    }
    state.isRinging = false;
    dom.alarmRingBanner.style.display = 'none';
    dom.screenAlarm.classList.remove('alarm-ringing-card');

    if (storage) {
      storage.saveActiveSession(state.activeSession);
    }

    if (evaluation.isTrimmed) {
      alert(`⚠️ ${evaluation.note}`);
    }

    updateSnoozeButtonState();
    updateAlarmTick();
  }

  // Dismiss / Wake Up (P1 + P2 Firestore logging)
  async function dismissAlarm() {
    if (audio) {
      audio.stopAlarm();
    }

    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }

    if (state.activeSession) {
      const napLogEntry = {
        id: 'nap_' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        startTime: state.activeSession.startTime,
        scheduledWakeTime: state.activeSession.scheduledWakeTime,
        actualWakeTime: Date.now(),
        recommendedDurationMinutes: state.activeSession.totalDurationMinutes,
        actualDurationMinutes: Math.round((Date.now() - state.activeSession.startTime) / 60000),
        commitmentTitle: state.activeSession.commitmentTitle,
        commitmentTime: state.activeSession.commitmentTime,
        wakeBufferMinutes: state.activeSession.wakeBufferMinutes,
        category: state.activeSession.category,
        dangerZoneTriggered: Boolean(state.activeSession.dangerZoneTriggered),
        dangerZoneOverridden: Boolean(state.activeSession.dangerZoneOverridden),
        snoozeCount: state.activeSession.snoozeCount || 0,
        urgencyTriggered: Boolean(state.activeSession.urgencyTriggered)
      };

      if (storage) {
        storage.saveNapLog(napLogEntry);
        storage.clearActiveSession();
      }

      if (fbService) {
        fbService.saveNapLog(napLogEntry).then(res => {
          if (res && res.offlineQueued) {
            dom.syncIndicator.innerHTML = '<span>⚡ Offline Queued</span>';
          } else {
            dom.syncIndicator.innerHTML = '<span>☁️ Synced to Cloud</span>';
          }
        });
      }
    }

    state.activeSession = null;
    state.isRinging = false;
    state.isUrgent = false;
    showScreen('HOME');
  }

  // ---- DASHBOARD & ANALYTICS (P3) ---- //

  function renderDashboard() {
    if (!analytics || !storage) return;

    const logs = storage.getNapLogs();
    const summary = analytics.computeSummary(logs);

    // Update Top Stat Tiles
    dom.statProtectionRate.textContent = `${summary.commitmentProtectionRatePercent}%`;
    dom.statAvgDuration.textContent = `${summary.averageNapDurationMinutes}m`;
    dom.statSnoozeFreq.textContent = `${summary.averageSnoozeCount}`;
    dom.statTotalNaps.textContent = `${summary.totalNaps}`;

    // Update Category Distribution Bar
    const totalCount = summary.totalNaps || 1;
    const powerPct = Math.round(((summary.categoryBreakdown.POWER_NAP || 0) / totalCount) * 100);
    const cyclePct = Math.round(((summary.categoryBreakdown.FULL_CYCLE || 0) / totalCount) * 100);
    const microPct = Math.round(((summary.categoryBreakdown.SHORT_NAP || 0) / totalCount) * 100);

    dom.catSegmentPower.style.width = `${summary.totalNaps === 0 ? 100 : powerPct}%`;
    dom.catSegmentCycle.style.width = `${cyclePct}%`;
    dom.catSegmentMicro.style.width = `${microPct}%`;

    // Render Insights
    dom.dashboardInsightsList.innerHTML = summary.insights.map(item => `
      <div style="display: flex; align-items: flex-start; gap: 6px;">
        <span>•</span>
        <span>${item}</span>
      </div>
    `).join('');

    // Render Recent Nap History List
    if (logs.length === 0) {
      dom.dashboardHistoryList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px;">
          No nap history recorded yet. Complete a nap or click "Load Demo Data" above!
        </div>
      `;
    } else {
      dom.dashboardHistoryList.innerHTML = logs.map(log => {
        const dateStr = log.date || new Date(log.startTime).toLocaleDateString();
        const duration = log.actualDurationMinutes || log.recommendedDurationMinutes || 20;
        
        let badgesHtml = '';
        badgesHtml += `<span class="tag-badge">${log.category || 'POWER_NAP'}</span>`;
        if (log.snoozeCount > 0) {
          badgesHtml += `<span class="tag-badge snooze">💤 ${log.snoozeCount}x Snooze</span>`;
        }
        if (log.dangerZoneOverridden) {
          badgesHtml += `<span class="tag-badge danger">⚠️ Danger Zone Override</span>`;
        }
        if (log.urgencyTriggered) {
          badgesHtml += `<span class="tag-badge urgent">🚨 Urgent Wake</span>`;
        }

        return `
          <div class="history-card">
            <div class="history-header">
              <div class="history-title">${log.commitmentTitle || 'Commitment'}</div>
              <div class="history-date">${dateStr}</div>
            </div>
            <div class="history-body">
              <div class="history-duration">${duration} min nap</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                Woke at ${formatTime(log.actualWakeTime || log.scheduledWakeTime)}
              </div>
            </div>
            <div class="history-badges">
              ${badgesHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Evaluator Helper: Inject Demo Data (P3)
  function loadDemoHistory() {
    if (!storage) return;

    const baseNow = Date.now();
    const demoLogs = [
      {
        id: 'demo_1',
        date: 'Today',
        startTime: baseNow - 25 * 60000,
        scheduledWakeTime: baseNow - 5 * 60000,
        actualWakeTime: baseNow - 5 * 60000,
        recommendedDurationMinutes: 20,
        actualDurationMinutes: 20,
        commitmentTitle: 'Algorithms & Data Structures Class',
        commitmentTime: baseNow + 10 * 60000,
        wakeBufferMinutes: 15,
        category: 'POWER_NAP',
        dangerZoneTriggered: false,
        dangerZoneOverridden: false,
        snoozeCount: 0,
        urgencyTriggered: false
      },
      {
        id: 'demo_2',
        date: 'Yesterday',
        startTime: baseNow - (24 * 3600000 + 35 * 60000),
        scheduledWakeTime: baseNow - (24 * 3600000 + 10 * 60000),
        actualWakeTime: baseNow - (24 * 3600000 + 5 * 60000),
        recommendedDurationMinutes: 20,
        actualDurationMinutes: 25,
        commitmentTitle: 'Physics Lab Session',
        commitmentTime: baseNow - (24 * 3600000 - 10 * 60000),
        wakeBufferMinutes: 15,
        category: 'POWER_NAP',
        dangerZoneTriggered: false,
        dangerZoneOverridden: false,
        snoozeCount: 1,
        urgencyTriggered: true
      },
      {
        id: 'demo_3',
        date: '2 days ago',
        startTime: baseNow - (48 * 3600000 + 95 * 60000),
        scheduledWakeTime: baseNow - (48 * 3600000 + 5 * 60000),
        actualWakeTime: baseNow - (48 * 3600000 + 5 * 60000),
        recommendedDurationMinutes: 90,
        actualDurationMinutes: 90,
        commitmentTitle: 'Study Group Meeting',
        commitmentTime: baseNow - (48 * 3600000 - 20 * 60000),
        wakeBufferMinutes: 20,
        category: 'FULL_CYCLE',
        dangerZoneTriggered: false,
        dangerZoneOverridden: false,
        snoozeCount: 0,
        urgencyTriggered: false
      },
      {
        id: 'demo_4',
        date: '3 days ago',
        startTime: baseNow - (72 * 3600000 + 20 * 60000),
        scheduledWakeTime: baseNow - 72 * 3600000,
        actualWakeTime: baseNow - 72 * 3600000,
        recommendedDurationMinutes: 20,
        actualDurationMinutes: 20,
        commitmentTitle: 'Campus Evening Workshop',
        commitmentTime: baseNow - (72 * 3600000 - 15 * 60000),
        wakeBufferMinutes: 15,
        category: 'POWER_NAP',
        dangerZoneTriggered: true,
        dangerZoneOverridden: true,
        snoozeCount: 0,
        urgencyTriggered: false
      }
    ];

    demoLogs.forEach(item => storage.saveNapLog(item));
    renderDashboard();
  }

  function clearNapHistory() {
    if (confirm('Are you sure you want to clear all recorded nap sessions?')) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('nap_calc_nap_logs');
      }
      renderDashboard();
    }
  }

  // ---- AUTH & USER FLOW (P2) ---- //

  function updateAuthHeader(user) {
    if (user) {
      dom.authHeaderName.textContent = user.displayName || user.email.split('@')[0];
      dom.authHeaderBtn.style.borderColor = 'var(--accent-cyan)';
    } else {
      dom.authHeaderName.textContent = 'Guest (Sign In)';
      dom.authHeaderBtn.style.borderColor = 'var(--border-color)';
    }
  }

  function openAuthModal() {
    const user = fbService ? fbService.getCurrentUser() : null;
    if (user) {
      dom.authSignedInView.style.display = 'flex';
      dom.authSignedOutView.style.display = 'none';
      dom.authUserName.textContent = user.displayName || 'User';
      dom.authUserEmail.textContent = user.email;
    } else {
      dom.authSignedInView.style.display = 'none';
      dom.authSignedOutView.style.display = 'flex';
      setAuthMode('SIGN_IN');
    }
    dom.authModal.style.display = 'flex';
  }

  function closeAuthModal() {
    dom.authModal.style.display = 'none';
    dom.authErrorMsg.style.display = 'none';
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    dom.authErrorMsg.style.display = 'none';
    if (mode === 'SIGN_IN') {
      dom.tabSignIn.classList.add('active');
      dom.tabRegister.classList.remove('active');
      dom.groupDisplayName.style.display = 'none';
      dom.btnAuthSubmit.textContent = 'Sign In';
    } else {
      dom.tabSignIn.classList.remove('active');
      dom.tabRegister.classList.add('active');
      dom.groupDisplayName.style.display = 'flex';
      dom.btnAuthSubmit.textContent = 'Create Account';
    }
  }

  async function handleAuthSubmit() {
    const email = dom.authInputEmail.value.trim();
    const password = dom.authInputPassword.value;
    const name = dom.authInputName.value.trim();

    dom.authErrorMsg.style.display = 'none';

    try {
      if (state.authMode === 'REGISTER') {
        await fbService.signUpWithEmailPassword(email, password, name);
      } else {
        await fbService.signInWithEmailPassword(email, password);
      }
      closeAuthModal();
    } catch (err) {
      dom.authErrorMsg.style.display = 'block';
      dom.authErrorMsg.textContent = err.message || 'Authentication error';
    }
  }

  async function handleGoogleAuth() {
    try {
      await fbService.signInWithGoogle();
      closeAuthModal();
    } catch (err) {
      dom.authErrorMsg.style.display = 'block';
      dom.authErrorMsg.textContent = err.message || 'Google Auth error';
    }
  }

  async function handleSignOut() {
    if (fbService) {
      await fbService.signOut();
    }
    closeAuthModal();
  }

  // Setup Event Handlers
  function bindEvents() {
    // Top Navigation Tabs (P3)
    dom.navTabCalc.addEventListener('click', () => showScreen('HOME'));
    dom.navTabDash.addEventListener('click', () => showScreen('DASHBOARD'));

    // Dashboard Tools (P3)
    if (dom.btnLoadDemoData) {
      dom.btnLoadDemoData.addEventListener('click', loadDemoHistory);
    }
    if (dom.btnClearHistory) {
      dom.btnClearHistory.addEventListener('click', clearNapHistory);
    }

    // Sliders Readout Update
    dom.sliderBuffer.addEventListener('input', (e) => {
      dom.bufferDisplay.textContent = `${e.target.value} min`;
    });

    dom.sliderSleep.addEventListener('input', (e) => {
      dom.sleepDisplay.textContent = `${parseFloat(e.target.value).toFixed(1)} hrs`;
    });

    dom.sliderBedtime.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      dom.bedtimeDisplay.textContent = `${val > 12 ? val - 12 : val}:00 ${val >= 12 ? 'PM' : 'AM'}`;
    });

    // Preset Time Buttons
    dom.presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const offsetMins = parseInt(btn.getAttribute('data-mins'), 10);
        const target = new Date(Date.now() + offsetMins * 60000);
        dom.inputTime.value = toDateTimeLocalString(target);
      });
    });

    // Calculate Button
    dom.btnCalculate.addEventListener('click', handleCalculate);

    // Audio Test Chime
    if (dom.btnTestAudio) {
      dom.btnTestAudio.addEventListener('click', () => {
        if (audio) audio.playWakeSequence();
      });
    }

    // Recommendation Actions
    dom.btnStartNap.addEventListener('click', handleStartNapClick);
    dom.btnBackToHome.addEventListener('click', () => showScreen('HOME'));

    // Danger Zone Modal Actions (P2)
    dom.btnCloseDangerModal.addEventListener('click', () => {
      dom.dangerZoneModal.style.display = 'none';
    });
    dom.btnDangerSkip.addEventListener('click', () => {
      dom.dangerZoneModal.style.display = 'none';
      showScreen('HOME');
    });
    dom.btnDangerOverride.addEventListener('click', () => {
      executeStartNap(true);
    });

    // Alarm Screen Actions (P1 + P2)
    dom.btnDismissAlarm.addEventListener('click', dismissAlarm);
    dom.btnSnoozeAlarm.addEventListener('click', handleSnooze);

    // Auth Header and Modal Actions (P2)
    dom.authHeaderBtn.addEventListener('click', openAuthModal);
    dom.btnCloseAuthModal.addEventListener('click', closeAuthModal);
    dom.tabSignIn.addEventListener('click', () => setAuthMode('SIGN_IN'));
    dom.tabRegister.addEventListener('click', () => setAuthMode('REGISTER'));
    dom.btnAuthSubmit.addEventListener('click', handleAuthSubmit);
    dom.btnGoogleAuth.addEventListener('click', handleGoogleAuth);
    dom.btnSignOut.addEventListener('click', handleSignOut);

    // Simulation Tools
    if (dom.btnSimFastForward) {
      dom.btnSimFastForward.addEventListener('click', () => {
        if (!state.activeSession) return;
        state.activeSession.scheduledWakeTime = Date.now() + 5000;
        updateAlarmTick();
      });
    }

    if (dom.btnSimTriggerAlarm) {
      dom.btnSimTriggerAlarm.addEventListener('click', () => {
        triggerWakeAlarm();
      });
    }

    if (dom.btnSimTriggerUrgency) {
      dom.btnSimTriggerUrgency.addEventListener('click', () => {
        if (!state.activeSession) return;
        state.isUrgent = true;
        state.activeSession.urgencyTriggered = true;
        triggerUrgencyEscalation(5);
      });
    }
  }

  // Restore Active Session if user refreshed page
  function restoreSessionIfActive() {
    if (!storage) return;
    const existing = storage.getActiveSession();
    if (existing && existing.scheduledWakeTime) {
      state.activeSession = existing;
      initActiveAlarm(existing);
      showScreen('ALARM');
    }
  }

  // Initialization
  function init() {
    cacheDom();
    initDefaults();

    dom.inputTime.value = state.formData.commitmentTimeStr;
    dom.sliderBuffer.value = state.formData.wakeBufferMinutes;
    dom.bufferDisplay.textContent = `${state.formData.wakeBufferMinutes} min`;
    dom.sliderSleep.value = state.formData.nighttimeSleepHours;
    dom.sleepDisplay.textContent = `${state.formData.nighttimeSleepHours.toFixed(1)} hrs`;
    dom.sliderBedtime.value = state.formData.typicalBedtimeHour;
    dom.bedtimeDisplay.textContent = `11:00 PM`;

    bindEvents();
    updateLiveClock();
    setInterval(updateLiveClock, 1000);

    // Subscribe to Auth changes
    if (fbService) {
      fbService.onAuthStateChanged((user) => {
        updateAuthHeader(user);
      });
    }

    restoreSessionIfActive();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
