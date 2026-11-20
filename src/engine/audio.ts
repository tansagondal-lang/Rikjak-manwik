import { AudioSettings } from '../types/game';

class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private driftNoiseGain: GainNode | null = null;
  private settings: AudioSettings = {
    muted: false,
    masterVolume: 0.75,
    engineVolume: 0.55,
    sfxVolume: 0.8,
  };
  private initialized = false;
  private engineActive = false;

  public updateSettings(next: AudioSettings): void {
    this.settings = { ...next };
    this.applyVolumes();
  }

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.engineGain = ctx.createGain();
      this.sfxGain = ctx.createGain();

      this.engineGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      // Engine continuous synthesizer (lightweight dual saw/triangle + lowpass)
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineFilter.Q.value = 2.2;

      const engineMix = ctx.createGain();
      engineMix.gain.value = 0;

      this.engineOscA = ctx.createOscillator();
      this.engineOscA.type = 'sawtooth';
      this.engineOscA.frequency.value = 55;

      this.engineOscB = ctx.createOscillator();
      this.engineOscB.type = 'triangle';
      this.engineOscB.frequency.value = 110;

      this.engineOscA.connect(this.engineFilter);
      this.engineOscB.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);

      this.engineOscA.start();
      this.engineOscB.start();

      // Drift tire screech noise generator (tiny 1-second buffer reused)
      const bufferSize = ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      noiseSrc.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1400;
      bandpass.Q.value = 3.5;

      this.driftNoiseGain = ctx.createGain();
      this.driftNoiseGain.gain.value = 0;

      noiseSrc.connect(bandpass);
      bandpass.connect(this.driftNoiseGain);
      this.driftNoiseGain.connect(this.sfxGain);
      noiseSrc.start();

      this.initialized = true;
      this.applyVolumes();
    } catch {
      // Audio unavailable
    }
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.engineGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.03);
    this.engineGain.gain.setTargetAtTime(
      this.engineActive ? this.settings.engineVolume * 0.22 : 0,
      now,
      0.04,
    );
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.03);
  }

  public setEngineRunning(active: boolean): void {
    this.engineActive = active;
    if (!this.initialized && active) {
      this.unlock();
    }
    this.applyVolumes();
  }

  public updateEngine(speedRatio: number, isDrifting: boolean): void {
    if (!this.initialized || !this.ctx || !this.engineOscA || !this.engineOscB || !this.engineFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1.2, speedRatio));
    // Simulated 4-gear RPM cadence
    const gearMod = ((clamped * 3.6) % 1) * 0.45 + clamped * 0.65;
    const baseFreq = 52 + gearMod * 125;

    this.engineOscA.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOscB.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(240 + clamped * 950, now, 0.05);

    if (this.driftNoiseGain) {
      const targetScreech = this.engineActive && isDrifting && clamped > 0.25 ? 0.09 : 0;
      this.driftNoiseGain.gain.setTargetAtTime(targetScreech, now, 0.04);
    }
  }

  public playCountdownBeep(isGo: boolean): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isGo ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.36 : 0.18));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.38 : 0.2));
  }

  public playLapChime(isFinal: boolean): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const notes = isFinal ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playBump(intensity = 0.6): void {
    if (!this.ctx || !this.sfxGain || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    gain.gain.setValueAtTime(Math.min(0.35, intensity * 0.3), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }
}

export const audioEngine = new ProceduralAudioEngine();
