import { Track } from '../types';

// Convert MIDI notes to frequency
export const midiToFreq = (note: number | null): number => {
  if (note === null || note <= 0) return 0;
  return 440 * Math.pow(2, (note - 69) / 12);
};

export const TRACK_PRESETS: Track[] = [
  {
    id: 'cyber-grid',
    title: 'Cyber Grid (Retro Electro)',
    genre: 'Synthwave',
    bpm: 125,
    description: 'A heavy driving bassline and high-speed neon arpeggios ideal for hyper-focus.',
    color: 'emerald',
    notes: {
      bass: [45, 45, 48, 45, 43, 43, 45, 0, 45, 45, 52, 50, 48, 47, 45, 0],
      melody: [57, 60, 64, 67, 64, 60, 69, 67, 64, 69, 72, 71, 67, 64, 60, 62],
      drums: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    }
  },
  {
    id: 'neon-horizon',
    title: 'Neon Horizon (Melodic Chill)',
    genre: 'Ambient Synth',
    bpm: 104,
    description: 'Drifting chord progressions reminiscent of scanning endless digital landscapes.',
    color: 'cyan',
    notes: {
      bass: [38, 38, 38, 38, 41, 41, 41, 41, 43, 43, 43, 43, 45, 45, 45, 45],
      melody: [62, 65, 69, 72, 74, 69, 62, 0, 65, 69, 72, 77, 74, 69, 65, 0],
      drums: [true, true, false, true, true, true, false, true, true, true, false, true, true, true, false, true],
    }
  },
  {
    id: 'voxel-glitch',
    title: 'Voxel Glitch (Arcade 8-Bit)',
    genre: 'Chiptune',
    bpm: 140,
    description: 'Frenetic, nostalgic square wave melodies that sound like classic retro platforms.',
    color: 'magenta',
    notes: {
      bass: [48, 55, 48, 55, 50, 57, 50, 57, 52, 59, 52, 59, 53, 60, 53, 60],
      melody: [72, 74, 76, 79, 81, 79, 76, 72, 84, 81, 79, 76, 79, 81, 84, 86],
      drums: [true, false, false, true, false, false, true, false, true, false, false, true, false, false, true, true],
    }
  }
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private primaryGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  
  private currentTrackIndex = 0;
  private isPlaying = false;
  private currentStep = 0;
  private bpm = 120;
  private volumeValue = 0.4;
  
  private nextStepTime = 0.0;
  private timerId: number | null = null;
  private scheduledSteps: Map<number, number> = new Map(); // Step index mapped to system trigger time
  
  // Callback when a step triggers (for UI updates)
  public onStepTrigger: (step: number) => void = () => {};

  constructor() {
    // Lazy loaded context to avoid browser warnings
  }

  public init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API not supported in this environment.");
      return;
    }
    
    this.ctx = new AudioContextClass();
    this.primaryGain = this.ctx.createGain();
    this.primaryGain.gain.setValueAtTime(this.volumeValue, this.ctx.currentTime);
    
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128; // Keep it low for crisp frequency bin visualizer
    
    // Connections: Synth Nodes -> Analyser -> PrimaryGain -> Destination
    this.analyser.connect(this.primaryGain);
    this.primaryGain.connect(this.ctx.destination);
  }

  public getAnalyserNode(): AnalyserNode | null {
    this.init();
    return this.analyser;
  }

  public start(trackIndex: number) {
    this.init();
    if (!this.ctx) return;
    
    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.currentTrackIndex = trackIndex;
    this.bpm = TRACK_PRESETS[trackIndex].bpm;
    this.isPlaying = true;
    
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    
    if (this.timerId !== null) {
      cancelAnimationFrame(this.timerId);
    }
    
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      cancelAnimationFrame(this.timerId);
      this.timerId = null;
    }
  }

  public pause() {
    this.isPlaying = false;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  public resume() {
    this.init();
    if (!this.ctx) return;
    
    this.ctx.resume();
    this.isPlaying = true;
    
    this.nextStepTime = this.ctx.currentTime + 0.05;
    if (this.timerId !== null) {
      cancelAnimationFrame(this.timerId);
    }
    this.scheduler();
  }

  public togglePlay(trackIndex: number): boolean {
    this.init();
    if (this.isPlaying && this.currentTrackIndex === trackIndex) {
      this.stop();
      return false;
    } else {
      this.start(trackIndex);
      return true;
    }
  }

  public setVolume(vol: number) {
    this.volumeValue = Math.max(0, Math.min(1, vol));
    if (this.primaryGain && this.ctx) {
      this.primaryGain.gain.setTargetAtTime(this.volumeValue, this.ctx.currentTime, 0.02);
    }
  }

  public getVolume(): number {
    return this.volumeValue;
  }

  public setTempo(tempo: number) {
    this.bpm = Math.max(60, Math.min(220, tempo));
  }

  public getTempo(): number {
    return this.bpm;
  }

  public getCurrentStepNumber(): number {
    return this.currentStep;
  }

  public getCurrentTrack(): Track {
    return TRACK_PRESETS[this.currentTrackIndex];
  }

  public getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }

  public isEnginePlaying(): boolean {
    return this.isPlaying;
  }

  // Scheduler loops using RequestAnimationFrame to guarantee accurate timing
  private scheduler() {
    if (!this.ctx || !this.isPlaying) return;
    
    const scheduleAheadTime = 0.1; // trigger nodes 100ms in advance
    
    while (this.nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
    
    this.timerId = requestAnimationFrame(() => this.scheduler());
  }

  private advanceStep() {
    const secondsPerBeat = 60.0 / this.bpm;
    const stepDuration = secondsPerBeat / 4.0; // 16th notes
    this.nextStepTime += stepDuration;
    
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleStep(step: number, time: number) {
    if (!this.ctx || !this.analyser) return;

    const track = TRACK_PRESETS[this.currentTrackIndex];
    
    // UI steps callback execution synchronized with audio time
    const cueDelta = time - this.ctx.currentTime;
    setTimeout(() => {
      if (this.isPlaying && this.currentTrackIndex === TRACK_PRESETS.indexOf(track)) {
        this.onStepTrigger(step);
      }
    }, Math.max(0, cueDelta * 1000));

    // 1. Play Synthesized Bass Note
    const bassNote = track.notes.bass[step];
    if (bassNote && bassNote > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(midiToFreq(bassNote), time);
      
      // Lowpass Filter sweep for punchy synth bass
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, time);
      filter.frequency.exponentialRampToValueAtTime(800, time + 0.1);
      
      // Bass envelope
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.35, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.analyser);
      
      osc.start(time);
      osc.stop(time + 0.28);
    }

    // 2. Play Synthesized Lead/Melody
    const melodyNote = track.notes.melody[step];
    if (melodyNote && melodyNote > 0) {
      const oscMelody = this.ctx.createOscillator();
      const gainMelody = this.ctx.createGain();
      const delay = this.ctx.createDelay();
      const feedback = this.ctx.createGain();
      
      // Determine synth type depending on track
      if (this.currentTrackIndex === 2) {
        oscMelody.type = 'square'; // 8-bit classic chip sound
      } else {
        oscMelody.type = 'triangle'; // Warm retro synth
      }
      
      oscMelody.frequency.setValueAtTime(midiToFreq(melodyNote), time);
      
      gainMelody.gain.setValueAtTime(0, time);
      gainMelody.gain.linearRampToValueAtTime(0.2, time + 0.01);
      gainMelody.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
      
      // Retro tape-delay setup for melodic space echo
      delay.delayTime.setValueAtTime(0.18, time);
      feedback.gain.setValueAtTime(0.40, time);
      
      oscMelody.connect(gainMelody);
      
      // Send main signal to analyzer
      gainMelody.connect(this.analyser);
      
      // Route delay feedback loop
      gainMelody.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      feedback.connect(this.analyser); // connect feedback echoes back into visualizer
      
      oscMelody.start(time);
      oscMelody.stop(time + 0.40);
    }

    // 3. Play Drum Element (Punchy kicks & White noise high-hats)
    const drumTrigger = track.notes.drums[step];
    if (drumTrigger) {
      if (step % 4 === 0) {
        // Kick Drum Synthesis
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        
        kickOsc.frequency.setValueAtTime(150, time);
        kickOsc.frequency.exponentialRampToValueAtTime(45, time + 0.08);
        
        kickGain.gain.setValueAtTime(0, time);
        kickGain.gain.linearRampToValueAtTime(0.5, time + 0.01);
        kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        
        kickOsc.connect(kickGain);
        kickGain.connect(this.analyser);
        
        kickOsc.start(time);
        kickOsc.stop(time + 0.15);
      } else {
        // High-Hats White Noise Simulator Click
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = noiseBuffer;
        
        const noiseGain = this.ctx.createGain();
        const bandpass = this.ctx.createBiquadFilter();
        
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(8000, time);
        
        noiseGain.gain.setValueAtTime(0, time);
        noiseGain.gain.linearRampToValueAtTime(0.08, time + 0.005);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
        
        noiseNode.connect(bandpass);
        bandpass.connect(noiseGain);
        noiseGain.connect(this.analyser);
        
        noiseNode.start(time);
        noiseNode.stop(time + 0.05);
      }
    }
  }

  // Triggered when eating food
  public playEatBeep() {
    this.init();
    if (!this.ctx || !this.analyser) return;

    const soundTime = this.ctx.currentTime;
    
    // Play two rapid ascending square wave synth bloops (retro feel)
    [0, 1].forEach((idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      osc.type = 'square';
      const noteFreq = idx === 0 ? 880 : 1320; // A5 then E6
      const triggerTime = soundTime + idx * 0.07;
      
      osc.frequency.setValueAtTime(noteFreq, triggerTime);
      
      gain.gain.setValueAtTime(0, triggerTime);
      gain.gain.linearRampToValueAtTime(0.25, triggerTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, triggerTime + 0.12);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination); // Play directly to output to bypass any audio visualizer mud
      
      osc.start(triggerTime);
      osc.stop(triggerTime + 0.15);
    });
  }

  // Triggered when hitting walls or body
  public playGameOverSound() {
    this.init();
    if (!this.ctx) return;

    const soundTime = this.ctx.currentTime;
    
    // Desolating power-down landing synth swipe
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      
      const startFreq = 260 - (i * 30);
      const endFreq = 60 - (i * 10);
      const duration = 0.5;
      const triggerTime = soundTime + (i * 0.04);
      
      osc.frequency.setValueAtTime(startFreq, triggerTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, triggerTime + duration);
      
      gain.gain.setValueAtTime(0, triggerTime);
      gain.gain.linearRampToValueAtTime(0.2, triggerTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, triggerTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(triggerTime);
      osc.stop(triggerTime + duration + 0.05);
    }
  }
}

// Singleton global instance of audio engine to keep states unified
export const synthEngine = new AudioEngine();
