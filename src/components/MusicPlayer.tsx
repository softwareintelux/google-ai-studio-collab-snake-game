import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Sparkles, Activity, Layers } from 'lucide-react';
import { Track } from '../types';
import { synthEngine, TRACK_PRESETS } from '../utils/synth';

interface MusicPlayerProps {
  onStepChange?: (step: number) => void;
}

export default function MusicPlayer({ onStepChange }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [volume, setVolume] = useState(0.4);
  const [tempo, setTempo] = useState(120);
  
  // Custom custom state to allow editing the sequencer steps!
  const [customTracks, setCustomTracks] = useState<Track[]>(() => {
    // Clone preset deep copy to allow editing
    return JSON.parse(JSON.stringify(TRACK_PRESETS)) as Track[];
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Sync internal track with engine presets
  useEffect(() => {
    synthEngine.onStepTrigger = (step) => {
      setCurrentStep(step);
      if (onStepChange) {
        onStepChange(step);
      }
    };

    // Initialize initial values
    setTempo(synthEngine.getTempo());
    setVolume(synthEngine.getVolume());
    setIsPlaying(synthEngine.isEnginePlaying());
    setCurrentTrackIndex(synthEngine.getCurrentTrackIndex());

    return () => {
      // Cleanup
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [onStepChange]);

  // Handle active track change
  const selectTrack = (index: number) => {
    setCurrentTrackIndex(index);
    const selectedTrack = customTracks[index];
    setTempo(selectedTrack.bpm);
    
    // Set note blueprints inside the engine dynamically
    TRACK_PRESETS[index].notes = selectedTrack.notes;
    synthEngine.setTempo(selectedTrack.bpm);

    if (isPlaying) {
      synthEngine.start(index);
    }
  };

  // Toggle Play/Pause
  const handleTogglePlay = () => {
    // If starting for first time, inject the active notes
    TRACK_PRESETS[currentTrackIndex].notes = customTracks[currentTrackIndex].notes;
    
    const nextPlayState = synthEngine.togglePlay(currentTrackIndex);
    setIsPlaying(nextPlayState);
  };

  // Change Track next/previous
  const handleNextTrack = () => {
    const nextIdx = (currentTrackIndex + 1) % customTracks.length;
    selectTrack(nextIdx);
  };

  const handlePrevTrack = () => {
    const prevIdx = (currentTrackIndex - 1 + customTracks.length) % customTracks.length;
    selectTrack(prevIdx);
  };

  // Handle volume sliders
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    synthEngine.setVolume(vol);
  };

  // Handle speed sliders
  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bpm = parseInt(e.target.value, 10);
    setTempo(bpm);
    synthEngine.setTempo(bpm);
  };

  // Toggle notes in sequence
  const toggleNotes = (row: 'bass' | 'melody' | 'drums', stepIdx: number) => {
    const updated = [...customTracks];
    const track = updated[currentTrackIndex];
    if (row === 'drums') {
      track.notes.drums[stepIdx] = !track.notes.drums[stepIdx];
    } else {
      // Toggle note off vs standard preset defaults if active
      if (track.notes[row][stepIdx] > 0) {
        track.notes[row][stepIdx] = 0;
      } else {
        // Toggle on: re-assign base MIDI notes appropriate to track style
        if (row === 'bass') {
          const bassRef = TRACK_PRESETS[currentTrackIndex].notes.bass.find(n => n > 0) || 45;
          track.notes.bass[stepIdx] = bassRef;
        } else {
          const melRef = TRACK_PRESETS[currentTrackIndex].notes.melody.find(n => n > 0) || 64;
          track.notes.melody[stepIdx] = melRef;
        }
      }
    }
    setCustomTracks(updated);
    // Push updates immediately into audio engine arrays
    TRACK_PRESETS[currentTrackIndex].notes = track.notes;
  };

  // Canvas visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 400;
    canvas.height = 70;

    const analyser = synthEngine.getAnalyserNode();
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const render = () => {
      // Resize dynamically
      if (canvas.parentElement && canvas.width !== canvas.parentElement.clientWidth) {
        canvas.width = canvas.parentElement.clientWidth;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Draw background
      ctx.fillStyle = 'rgba(10, 10, 15, 0.35)'; // Slight trail for neon blur glow
      ctx.fillRect(0, 0, width, height);

      // Accent colors
      const trackColorsMap: { [key: string]: string } = {
        emerald: '#10b981',
        cyan: '#06b6d4',
        magenta: '#d946ef'
      };
      
      const themeColor = trackColorsMap[customTracks[currentTrackIndex].color] || '#10b981';

      if (synthEngine.isEnginePlaying() && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const barWidth = (width / analyser.frequencyBinCount) * 1.5;
        let x = 0;

        for (let i = 0; i < analyser.frequencyBinCount; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const barHeight = percent * height * 0.9;
          
          // Outer glow
          ctx.shadowBlur = 10;
          ctx.shadowColor = themeColor;
          
          ctx.fillStyle = themeColor;
          // Render thin vertical neon columns
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
          
          // Draw connecting peak oscillations
          if (i === 0) {
            ctx.moveTo(x, height - barHeight - 2);
          } else {
            ctx.lineTo(x, height - barHeight - 2);
          }

          x += barWidth;
        }
        
        ctx.shadowBlur = 0; // reset
      } else {
        // Draw elegant mock oscilloscope heartbeat wave on standby
        ctx.shadowBlur = 5;
        ctx.shadowColor = themeColor;
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const sliceWidth = width / 100;
        let x = 0;
        const time = Date.now() * 0.004;

        for (let i = 0; i < 100; i++) {
          // Add rhythmic synth vibration wave pattern
          const sine = Math.sin(i * 0.15 - time) * Math.cos(i * 0.1 + time * 0.5);
          const y = (height / 2) + sine * (isPlaying ? 15 : 6);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [currentTrackIndex, isPlaying, customTracks]);

  const activeTrack = customTracks[currentTrackIndex];

  // Helper arrays for step rows
  const stepIndices = Array.from({ length: 16 }, (_, i) => i);

  return (
    <div id="cyber-deck" className="bg-[#0b0c10] border border-gray-800 rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col h-full justify-between">
      {/* Background glow overlay */}
      <div className={`absolute top-0 right-0 w-48 h-48 bg-${activeTrack.color}-500/5 blur-[80px] pointer-events-none`} />
      
      {/* 1. Header Information */}
      <div id="deck-header" className="flex items-start justify-between border-b border-gray-900 pb-3 mb-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-gray-500 uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            SYNTH WAVE GENERATOR v2.5
          </span>
          <h2 className="text-xl font-display font-medium tracking-tight text-white mt-1 flex items-center gap-2">
            <Music className="w-5 h-5 text-cyan-400" />
            {activeTrack.title}
          </h2>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            {activeTrack.description}
          </p>
        </div>
        
        {/* Track Tag badge */}
        <span className={`px-2.5 py-1 text-[11px] font-mono font-bold tracking-wider rounded-md uppercase bg-${activeTrack.color}-500/10 border border-${activeTrack.color}-500/20 text-${activeTrack.color}-400`}>
          {activeTrack.genre}
        </span>
      </div>

      {/* 2. Audio Wave Visualizer Block */}
      <div id="visualizer-container" className="bg-[#030406] border border-gray-900 rounded-lg p-2.5 mb-4 relative">
        <canvas ref={canvasRef} className="w-full rounded block" />
        
        {/* Absolute indicators */}
        <div className="absolute right-3.5 top-2 flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((b) => (
              <span 
                key={b} 
                className={`w-1 h-3 rounded-full transition-all duration-200 ${
                  isPlaying && (currentStep % 4 === b) 
                    ? `bg-${activeTrack.color}-400 scale-y-125` 
                    : 'bg-gray-800'
                }`} 
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            {isPlaying ? 'ACTIVE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* 3. Playlist / Track Selector Tray */}
      <div id="playlist-list" className="space-y-2 mb-4">
        <span className="text-[10px] font-mono tracking-widest text-gray-500 uppercase block mb-1">
          CHOOSE SOUND VECTOR
        </span>
        <div className="grid grid-cols-3 gap-2">
          {customTracks.map((tr, index) => {
            const isCurrent = currentTrackIndex === index;
            return (
              <button
                key={tr.id}
                id={`track-btn-${tr.id}`}
                onClick={() => selectTrack(index)}
                className={`p-2.5 rounded-lg border text-left transition-all duration-300 relative group flex flex-col justify-between ${
                  isCurrent
                    ? `bg-[#0f111a] border-${tr.color}-500/40 text-${tr.color}-400 shadow-[0_0_12px_rgba(0,0,0,0.6)]`
                    : 'bg-[#050608] border-gray-900 text-gray-400 hover:border-gray-800 hover:text-gray-300'
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className="text-xs font-display font-medium tracking-wide truncate max-w-[80px]">
                    {tr.title.split(' ')[0]}
                  </span>
                  <Sparkles className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                    isCurrent ? `text-${tr.color}-400 opacity-100` : 'text-gray-600'
                  }`} />
                </div>
                <span className="text-[10px] font-mono text-gray-500 mt-2">
                  {tr.bpm} BPM
                </span>
                
                {/* Active strip */}
                {isCurrent && (
                  <span className={`absolute bottom-0 left-2 right-2 h-0.5 bg-${tr.color}-500 rounded-t`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Interactive Sequencer Grid */}
      <div id="sequencer-matrix" className="bg-[#030406] border border-gray-950 rounded-lg p-3 mb-4 flex-grow flex flex-col justify-center">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-mono tracking-widest text-gray-500 uppercase flex items-center gap-1">
            <Layers className="w-3 h-3" />
            SYNTH SEQUENCER STEPS (16/16)
          </span>
          <span className="text-[9px] font-mono text-gray-500 italic">
            *Click cells below to compose*
          </span>
        </div>

        <div className="flex flex-col gap-1.5 font-mono text-xs w-full">
          {/* Row 1: Melody Notes (High range) */}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] font-bold text-cyan-500 font-display">MEL</span>
            <div className="grid grid-cols-16 gap-1 w-full">
              {stepIndices.map((i) => {
                const isActive = activeTrack.notes.melody[i] > 0;
                const isCurrentPlayStep = currentStep === i && isPlaying;
                return (
                  <button
                    key={`mel-${i}`}
                    id={`cell-mel-${i}`}
                    onClick={() => toggleNotes('melody', i)}
                    className={`h-5 rounded-sm transition-all duration-150 relative ${
                      isActive 
                        ? `bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] border border-cyan-400/50` 
                        : 'bg-gray-900 border border-gray-950 hover:bg-gray-800'
                    } ${isCurrentPlayStep ? 'scale-y-125 border-white border z-10' : ''}`}
                    title={`Melody step ${i + 1}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Row 2: Bass notes */}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] font-bold text-emerald-500 font-display">BAS</span>
            <div className="grid grid-cols-16 gap-1 w-full">
              {stepIndices.map((i) => {
                const isActive = activeTrack.notes.bass[i] > 0;
                const isCurrentPlayStep = currentStep === i && isPlaying;
                return (
                  <button
                    key={`bass-${i}`}
                    id={`cell-bass-${i}`}
                    onClick={() => toggleNotes('bass', i)}
                    className={`h-5 rounded-sm transition-all duration-150 relative ${
                      isActive 
                        ? `bg-emerald-500 shadow-[0_0_8px_rgba(16,181,129,0.8)] border border-emerald-400/50` 
                        : 'bg-gray-900 border border-gray-950 hover:bg-gray-800'
                    } ${isCurrentPlayStep ? 'scale-y-125 border-white border z-10' : ''}`}
                    title={`Bass step ${i + 1}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Row 3: Beats / Percussion */}
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[10px] font-bold text-magenta-500 font-display">BEA</span>
            <div className="grid grid-cols-16 gap-1 w-full">
              {stepIndices.map((i) => {
                const isActive = activeTrack.notes.drums[i];
                const isCurrentPlayStep = currentStep === i && isPlaying;
                return (
                  <button
                    key={`drum-${i}`}
                    id={`cell-drum-${i}`}
                    onClick={() => toggleNotes('drums', i)}
                    className={`h-5 rounded-sm transition-all duration-150 relative ${
                      isActive 
                        ? `bg-magenta-500 shadow-[0_0_8px_rgba(217,70,239,0.8)] border border-magenta-400/50` 
                        : 'bg-gray-900 border border-gray-950 hover:bg-gray-800'
                    } ${isCurrentPlayStep ? 'scale-y-125 border-white border z-10' : ''}`}
                    title={`Drum beat trigger step ${i + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Playhead slider marker */}
        <div className="flex items-center gap-2 mt-1">
          <div className="w-8 shrink-0" />
          <div className="grid grid-cols-16 gap-1 w-full text-center">
            {stepIndices.map((i) => (
              <span 
                key={`idx-${i}`} 
                className={`text-[9px] font-mono ${
                  currentStep === i && isPlaying ? `text-${activeTrack.color}-400 font-bold` : 'text-gray-700'
                }`}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Analog Synthesizer Sliders & Control buttons */}
      <div id="deck-synth-sliders" className="border-t border-gray-900 pt-4 mt-2">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Slider A: Volume */}
          <div className="space-y-1.5 select-none">
            <div className="flex justify-between items-center text-[10px] font-mono text-gray-500">
              <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> GAIN</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              id="gain-range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full h-1 bg-gray-900 rounded-lg appearance-none cursor-pointer outline-none accent-cyan-500"
            />
          </div>

          {/* Slider B: Tempo BPM */}
          <div className="space-y-1.5 select-none">
            <div className="flex justify-between items-center text-[10px] font-mono text-gray-500">
              <span>TEMPO</span>
              <span>{tempo} BPM</span>
            </div>
            <input
              type="range"
              id="tempo-range"
              min="60"
              max="200"
              step="5"
              value={tempo}
              onChange={handleTempoChange}
              className="w-full h-1 bg-gray-900 rounded-lg appearance-none cursor-pointer outline-none accent-cyan-500"
            />
          </div>
        </div>

        {/* Play/Pause Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              id="prev-track"
              onClick={handlePrevTrack}
              className="p-3 bg-gray-950 border border-gray-800 rounded-lg hover:bg-gray-900 text-gray-400 hover:text-white transition-colors"
              title="Previous Track"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              id="next-track"
              onClick={handleNextTrack}
              className="p-3 bg-gray-950 border border-gray-800 rounded-lg hover:bg-gray-900 text-gray-400 hover:text-white transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <button
            id="play-pause-btn"
            onClick={handleTogglePlay}
            className={`px-8 py-3.5 rounded-lg flex items-center justify-center gap-3 font-display font-semibold text-sm uppercase transition-all duration-300 shadow-${activeTrack.color}-500/10 cursor-pointer ${
              isPlaying
                ? `bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]`
                : `bg-${activeTrack.color}-500 hover:bg-${activeTrack.color}-400 text-black font-extrabold shadow-[0_0_15px_rgba(0,0,0,0.3)]`
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current text-white" />
                PAUSE SYNTH
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-black" />
                PLAY RETRO BEAT
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
