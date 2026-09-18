/**
 * Alarm Audio Synthesizer
 * Uses Web Audio API to create pure, melodious wake-up chimes AND escalating urgency sirens.
 * 100% offline, zero audio asset downloads, reliable cross-browser.
 */

class AlarmAudioSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.isUrgent = false;
    this.intervalId = null;
  }

  _initContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Plays a soothing chime note
  playChimeNote(freq = 523.25, duration = 0.8, delay = 0) {
    this._initContext();
    if (!this.audioCtx) return;

    setTimeout(() => {
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        // Gentle envelope: quick attack, smooth exponential decay
        gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, this.audioCtx.currentTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (e) {
        console.warn('Audio playback error:', e);
      }
    }, delay * 1000);
  }

  // Play a full melodious wake chime sequence
  playWakeSequence() {
    // Pentatonic scale notes: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      this.playChimeNote(freq, 1.2, idx * 0.22);
    });
  }

  // Starts looping wake-up alarm until dismissed
  startAlarm() {
    if (this.isPlaying && !this.isUrgent) return;
    this.stopAlarm();
    this._initContext();
    this.isPlaying = true;
    this.isUrgent = false;

    // Immediately play first sequence
    this.playWakeSequence();

    // Repeat every 2.0 seconds
    this.intervalId = setInterval(() => {
      if (this.isPlaying && !this.isUrgent) {
        this.playWakeSequence();
      }
    }, 2000);
  }

  // Plays sharp dual-tone urgency warning beep
  playUrgencyBeep() {
    this._initContext();
    if (!this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      // Rapid alternating siren frequency: 880 Hz to 1320 Hz
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.linearRampToValueAtTime(1320, now + 0.15);
      osc.frequency.linearRampToValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {
      console.warn('Urgency audio error:', e);
    }
  }

  // Starts escalating urgency alarm (sharper, faster, continuous)
  startUrgencyAlarm() {
    if (this.isUrgent && this.isPlaying) return;
    this.stopAlarm();
    this._initContext();
    this.isPlaying = true;
    this.isUrgent = true;

    this.playUrgencyBeep();
    this.intervalId = setInterval(() => {
      if (this.isPlaying && this.isUrgent) {
        this.playUrgencyBeep();
      }
    }, 500); // Fast 500ms pulsing urgency alert
  }

  // Stops and silences the alarm
  stopAlarm() {
    this.isPlaying = false;
    this.isUrgent = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Export singleton instance
const alarmAudio = new AlarmAudioSynthesizer();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { alarmAudio, AlarmAudioSynthesizer };
}
