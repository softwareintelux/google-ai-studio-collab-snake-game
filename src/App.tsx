import { useState } from 'react';
import { Gamepad2, Radio, Terminal, Compass, Disc, ShieldQuestion } from 'lucide-react';
import SnakeGame from './components/SnakeGame';
import MusicPlayer from './components/MusicPlayer';

export default function App() {
  const [musicStep, setMusicStep] = useState(0);

  // Triggered when synthesizer scheduler advances steps
  const handleMusicStepChange = (step: number) => {
    setMusicStep(step);
  };

  // Determine pulse animation speed on ambient background details depending on rhythm step beats
  const isDownbeat = musicStep % 4 === 0;

  return (
    <div className="min-h-screen bg-[#030406] text-gray-200 select-none font-sans relative overflow-x-hidden p-3 md:p-6 flex flex-col justify-between">
      
      {/* Dynamic Ambient neon space dust backdrop */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-950/20 via-[#030406] to-black" />
      
      {/* 2D Cyber grid floor mesh that sweeps and vibrates dynamically to the music downs */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035] transition-opacity duration-150 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, #10b981 1px, transparent 1px),
            linear-gradient(to bottom, #10b981 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: isDownbeat ? 'scale(1.008) translateY(2px)' : 'scale(1)',
          opacity: isDownbeat ? 0.06 : 0.035
        }}
      />

      {/* 1. Dashboard Global Header */}
      <header id="global-header" className="relative z-10 w-full max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center bg-[#07080c]/60 border border-gray-900 rounded-xl p-4 gap-4 mb-6 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center relative">
            <Disc className={`w-5 h-5 text-cyan-400 ${isDownbeat ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full" />
          </div>
          
          <div>
            <span className="text-[9px] font-mono tracking-[0.2em] text-[#06b6d4] uppercase block font-bold">
              HYBRID RETRO TERMINAL
            </span>
            <h1 className="text-xl font-display font-black tracking-tight text-white flex items-center gap-2">
              CYBERBEAT <span className="text-cyan-400">ARCADE</span>
            </h1>
          </div>
        </div>

        {/* Live system telemetries */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[9px] text-gray-500 uppercase">SYNAPSIS NETWORK</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE [LIVE_NODE_3]
            </span>
          </div>
          
          <div className="hidden sm:flex flex-col text-right border-l border-gray-900 pl-4">
            <span className="text-[9px] text-gray-500 uppercase">SYS REVOLUTION</span>
            <span className="text-gray-300">STEP CLK: <span className="text-cyan-400 font-bold">{musicStep + 1}</span></span>
          </div>
          
          <div className="flex flex-col text-right border-l border-gray-900 pl-4">
            <span className="text-[9px] text-gray-500 uppercase">SYSTEM CORE TIME</span>
            <span className="text-magenta-400 font-bold">UTC {new Date().toISOString().substring(11, 19)}</span>
          </div>
        </div>
      </header>

      {/* 2. Main Content Split Panel Cockpit */}
      <main id="dashboard-deck" className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow items-stretch my-auto">
        
        {/* Left pane: Snake Game Arcade Machine (Spans 5 Columns) */}
        <section id="pane-snake-arcade" className="lg:col-span-5 flex flex-col h-full justify-center">
          <div className="flex items-center gap-2 mb-2 px-1 select-none">
            <Gamepad2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display font-semibold text-sm tracking-wide text-white uppercase">
              GRID TERMINAL CABINET
            </h3>
          </div>
          <SnakeGame currentMusicStep={musicStep} />
        </section>

        {/* Right pane: Synthesizer Board & Controls (Spans 7 Columns) */}
        <section id="pane-synth-deck" className="lg:col-span-7 flex flex-col h-full justify-center">
          <div className="flex items-center gap-2 mb-2 px-1 select-none">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h3 className="font-display font-semibold text-sm tracking-wide text-white uppercase">
              MODULAR SEQUENCER DECK
            </h3>
          </div>
          <MusicPlayer onStepChange={handleMusicStepChange} />
        </section>

      </main>

      {/* 3. Global Dashboard Footer branding */}
      <footer id="global-footer" className="relative z-10 w-full max-w-7xl mx-auto mt-6 border-t border-gray-900 pt-3 flex flex-col sm:flex-row justify-between items-center text-[11px] font-mono text-gray-500 gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-gray-600" />
          <span>CYBER SYNTH® RETRO arcade solutions - ALL CHANNELS STABILIZED</span>
        </div>
        
        <div className="flex gap-4">
          <span className="hover:text-cyan-400 transition-colors">V: 1.0.4-LITE</span>
          <span className="text-gray-700">|</span>
          <span className="hover:text-emerald-400 transition-colors flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" />
            HTML5 MATRIX AUDIO ENGINE
          </span>
        </div>
      </footer>
      
    </div>
  );
}
