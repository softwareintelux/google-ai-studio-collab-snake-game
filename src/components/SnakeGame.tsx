import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, ShieldAlert, Trophy, ShieldCheck, Zap, HelpCircle } from 'lucide-react';
import { GameState, Position, Direction } from '../types';
import { synthEngine } from '../utils/synth';

interface SnakeGameProps {
  currentMusicStep: number;
}

const GRID_SIZE = 20; // 20x20 cells
const CANVAS_SIZE = 400; // pixels

export default function SnakeGame({ currentMusicStep }: SnakeGameProps) {
  // Game states
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [glitchFood, setGlitchFood] = useState<Position | null>(null);
  const [direction, setDirection] = useState<Direction>('UP');
  const [nextDirection, setNextDirection] = useState<Direction>('UP');
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('snake_high_score') || '0', 10),
    isGameOver: false,
    isPaused: false,
    hasStarted: false,
    speed: 100, // Speed in ms (Normal default)
    classicMode: true, // Classic: Wrap borders. False: Collide borders
  });

  const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'INSANE'>('NORMAL');
  const [showHelp, setShowHelp] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameIntervalRef = useRef<number | null>(null);

  // Generate random food coordinates away from the snake body
  const generateFoodPosition = useCallback((currentSnake: Position[]): Position => {
    while (true) {
      const x = Math.floor(Math.random() * GRID_SIZE);
      const y = Math.floor(Math.random() * GRID_SIZE);
      
      const onSnake = currentSnake.some(cell => cell.x === x && cell.y === y);
      if (!onSnake) {
        return { x, y };
      }
    }
  }, []);

  // Sync state difficulty values with tick speed
  const adjustDifficulty = (diff: 'EASY' | 'NORMAL' | 'INSANE') => {
    setDifficulty(diff);
    let speed = 120;
    if (diff === 'EASY') speed = 160;
    if (diff === 'INSANE') speed = 65;
    
    setGameState(prev => ({ ...prev, speed }));
  };

  // Setup / reset game assets
  const resetGame = () => {
    const initialSnake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ];
    const newFood = generateFoodPosition(initialSnake);
    
    setSnake(initialSnake);
    setFood(newFood);
    setGlitchFood(null);
    setDirection('UP');
    setNextDirection('UP');
    setGameState(prev => ({
      ...prev,
      score: 0,
      isGameOver: false,
      isPaused: false,
      hasStarted: true
    }));
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent standard browser viewport scrolling when actively playing
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
      if (gameState.hasStarted && !gameState.isGameOver && arrowKeys.includes(e.key)) {
        e.preventDefault();
      }

      if (!gameState.hasStarted || gameState.isGameOver) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (direction !== 'DOWN') setNextDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (direction !== 'UP') setNextDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (direction !== 'RIGHT') setNextDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (direction !== 'LEFT') setNextDirection('RIGHT');
          break;
        case ' ': // Spacebar pause
          setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction, gameState.hasStarted, gameState.isGameOver]);

  // Main game tick engine loops
  useEffect(() => {
    if (!gameState.hasStarted || gameState.isPaused || gameState.isGameOver) {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
        gameIntervalRef.current = null;
      }
      return;
    }

    const gameTick = () => {
      setSnake(prevSnake => {
        const head = prevSnake[0];
        const activeDir = nextDirection;
        setDirection(activeDir);

        let newHead: Position = { ...head };
        switch (activeDir) {
          case 'UP': newHead.y -= 1; break;
          case 'DOWN': newHead.y += 1; break;
          case 'LEFT': newHead.x -= 1; break;
          case 'RIGHT': newHead.x += 1; break;
        }

        // Boundary cross checks
        if (gameState.classicMode) {
          // Wrap borders
          if (newHead.x < 0) newHead.x = GRID_SIZE - 1;
          if (newHead.x >= GRID_SIZE) newHead.x = 0;
          if (newHead.y < 0) newHead.y = GRID_SIZE - 1;
          if (newHead.y >= GRID_SIZE) newHead.y = 0;
        } else {
          // Crashing wall leads to immediate game over
          if (
            newHead.x < 0 || 
            newHead.x >= GRID_SIZE || 
            newHead.y < 0 || 
            newHead.y >= GRID_SIZE
          ) {
            triggerGameOver();
            return prevSnake;
          }
        }

        // Body bite check
        const selfBite = prevSnake.some(cell => cell.x === newHead.x && cell.y === newHead.y);
        if (selfBite) {
          triggerGameOver();
          return prevSnake;
        }

        const updatedSnake = [newHead, ...prevSnake];

        // Food collision check
        let ateRegular = newHead.x === food.x && newHead.y === food.y;
        let ateGlitch = glitchFood && newHead.x === glitchFood.x && newHead.y === glitchFood.y;

        if (ateRegular) {
          // Play classic synthesized eat chime
          synthEngine.playEatBeep();
          
          const newScore = gameState.score + 10;
          
          // Periodically spawn golden "AI core glitch" special pixels
          const rollGlitch = Math.random() < 0.25; // 25% chance of spawning bonus Core glitch
          if (rollGlitch && !glitchFood) {
            setGlitchFood(generateFoodPosition(updatedSnake));
          }

          setFood(generateFoodPosition(updatedSnake));
          updateScores(newScore);
        } else if (ateGlitch) {
          // Larger, heavier bass bonus audio grab
          synthEngine.playEatBeep();
          // Delay briefly to trigger double sound arpeggiation cascade
          setTimeout(() => synthEngine.playEatBeep(), 60);

          const newScore = gameState.score + 35; // Generous glitch bonus point value
          setGlitchFood(null);
          updateScores(newScore);
        } else {
          // Regular snake movement (remove tail edge element)
          updatedSnake.pop();
        }

        return updatedSnake;
      });
    };

    gameIntervalRef.current = window.setInterval(gameTick, gameState.speed);

    return () => {
      if (gameIntervalRef.current) {
        clearInterval(gameIntervalRef.current);
      }
    };
  }, [gameState.hasStarted, gameState.isPaused, gameState.isGameOver, gameState.speed, gameState.classicMode, nextDirection, food, glitchFood, generateFoodPosition]);

  // Handle Score and HighScore persistent saves
  const updateScores = (newScore: number) => {
    setGameState(prev => {
      const nextHighScore = Math.max(prev.highScore, newScore);
      if (nextHighScore > prev.highScore) {
        localStorage.setItem('snake_high_score', nextHighScore.toString());
      }
      return {
        ...prev,
        score: newScore,
        highScore: nextHighScore,
      };
    });
  };

  const triggerGameOver = () => {
    synthEngine.playGameOverSound();
    setGameState(prev => ({
      ...prev,
      isGameOver: true
    }));
  };

  // Render Canvas Board Graphics
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed internal coordinates
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const cellPixelSize = CANVAS_SIZE / GRID_SIZE;

    // Clear board with dark scanline background grid
    ctx.fillStyle = '#020204';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 1. Draw Arcade Grid wires (pulses in opacity on the music step beats!)
    const beatPulseMultiplier = (currentMusicStep % 4 === 0) ? 0.09 : 0.045;
    ctx.lineWidth = 1;
    for (let i = 0; i < GRID_SIZE; i++) {
      // Columns wires
      ctx.strokeStyle = `rgba(16, 185, 129, ${beatPulseMultiplier})`;
      ctx.beginPath();
      ctx.moveTo(i * cellPixelSize, 0);
      ctx.lineTo(i * cellPixelSize, CANVAS_SIZE);
      ctx.stroke();

      // Row lines
      ctx.beginPath();
      ctx.moveTo(0, i * cellPixelSize);
      ctx.lineTo(CANVAS_SIZE, i * cellPixelSize);
      ctx.stroke();
    }

    // 2. Render target glitch bonus core food (Pulsing Fuchsia Magenta star block)
    if (glitchFood) {
      const pulseSize = 2 + Math.abs(Math.sin(Date.now() * 0.015)) * 3.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#d946ef';
      ctx.fillStyle = '#d946ef';
      
      ctx.fillRect(
        glitchFood.x * cellPixelSize + (cellPixelSize - (cellPixelSize - 2)) / 2,
        glitchFood.y * cellPixelSize + (cellPixelSize - (cellPixelSize - 2)) / 2,
        cellPixelSize - 2,
        cellPixelSize - 2
      );
      
      // Paint bright white central overlay core
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        glitchFood.x * cellPixelSize + (cellPixelSize - (cellPixelSize - 6)) / 2,
        glitchFood.y * cellPixelSize + (cellPixelSize - (cellPixelSize - 6)) / 2,
        cellPixelSize - 6,
        cellPixelSize - 6
      );
      ctx.shadowBlur = 0; // reset
    }

    // 3. Draw regular food (Vibrant Pulsing Cherry cyber pill)
    const foodPulse = (currentMusicStep % 4 === 0) ? 2.5 : 0;
    ctx.shadowBlur = 10 + foodPulse;
    ctx.shadowColor = '#ed1c24';
    ctx.fillStyle = '#ff2a5f';
    ctx.beginPath();
    const radius = (cellPixelSize - 3) / 2;
    const centerX = food.x * cellPixelSize + radius + 1.5;
    const centerY = food.y * cellPixelSize + radius + 1.5;
    ctx.arc(centerX, centerY, radius + (foodPulse * 0.2), 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0; // reset

    // 4. Render glowing Snake vector
    snake.forEach((part, index) => {
      const isHead = index === 0;
      
      if (isHead) {
        // Glowing cyan brain core
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#06b6d4';
        ctx.fillStyle = '#06b6d4';
        
        ctx.fillRect(
          part.x * cellPixelSize + 1,
          part.y * cellPixelSize + 1,
          cellPixelSize - 2,
          cellPixelSize - 2
        );
        
        // Render stylized retro high-contrast helmet eyes
        ctx.fillStyle = '#ffffff';
        const eyeOffset = 3;
        const eyeDim = 3;
        if (direction === 'UP' || direction === 'DOWN') {
          // Left wing eye, right wing eye
          ctx.fillRect(part.x * cellPixelSize + eyeOffset, part.y * cellPixelSize + 8, eyeDim, eyeDim);
          ctx.fillRect(part.x * cellPixelSize + cellPixelSize - eyeOffset - eyeDim, part.y * cellPixelSize + 8, eyeDim, eyeDim);
        } else {
          // Top vertical eyes
          ctx.fillRect(part.x * cellPixelSize + 8, part.y * cellPixelSize + eyeOffset, eyeDim, eyeDim);
          ctx.fillRect(part.x * cellPixelSize + 8, part.y * cellPixelSize + cellPixelSize - eyeOffset - eyeDim, eyeDim, eyeDim);
        }
        ctx.shadowBlur = 0;
      } else {
        // Body segment elements: progressive fade trailing effect
        const alphaFraction = Math.max(0.2, 1 - (index / snake.length));
        ctx.fillStyle = `rgba(16, 185, 129, ${alphaFraction})`;
        
        // Slightly contract size towards end of tail
        const scaleTailFactor = Math.max(0.65, 1 - (index / snake.length) * 0.3);
        const dimension = (cellPixelSize - 2) * scaleTailFactor;
        const offset = (cellPixelSize - dimension) / 2;

        ctx.fillRect(
          part.x * cellPixelSize + offset,
          part.y * cellPixelSize + offset,
          dimension,
          dimension
        );
      }
    });

  }, [snake, food, glitchFood, direction, gameState.classicMode, currentMusicStep]);

  return (
    <div id="arcade-terminal" className="bg-[#0b0c10] border border-gray-800 rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] relative flex flex-col justify-between items-center w-full h-[610px] crt-overlay crt-scan">
      
      {/* 1. Terminal Top Header bar */}
      <div className="w-full flex justify-between items-center border-b border-gray-900 pb-2.5 mb-2.5 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative" />
          <span className="text-[11px] font-mono font-bold tracking-widest text-emerald-400">ARCADE CABINET 01</span>
        </div>

        {/* High / Current scores displays */}
        <div className="flex gap-4 font-mono">
          <div className="text-right">
            <span className="text-[9px] text-gray-500 block">HI SCORE</span>
            <span className="text-[#06b6d4] font-bold text-sm tracking-widest flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5" />
              {gameState.highScore}
            </span>
          </div>
          <div className="text-right border-l border-gray-900 pl-4">
            <span className="text-[9px] text-gray-500 block">SCORE</span>
            <span className="text-[#d946ef] font-bold text-sm tracking-widest">
              {gameState.score}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Primary Play Canvas Area */}
      <div className="relative border-4 border-gray-950 bg-[#020204] rounded-lg shadow-[0_0_25px_rgba(0,0,0,0.6)] overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="w-[380px] h-[380px] md:w-[400px] md:h-[400px] block transition-transform duration-150" />
        
        {/* GAME SCREEN OVERLAYS */}
        {/* A. Not Started Overlay */}
        {!gameState.hasStarted && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm z-30 select-none">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Zap className="w-8 h-8 text-emerald-400 animate-pulse" />
            </div>
            
            <h1 className="text-2xl font-display font-extrabold tracking-wider text-white">
              SNAKE CHIPS
            </h1>
            <p className="text-xs text-gray-400 mt-2 max-w-xs leading-relaxed">
              Use arrow keys or WASD to navigate. Synthesizer sound guides will trigger as you play!
            </p>

            <button
              id="start-game-btn"
              onClick={resetGame}
              className="mt-6 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-display font-extrabold text-sm uppercase rounded shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all cursor-pointer"
            >
              INSERT TOKEN (PLAY)
            </button>
          </div>
        )}

        {/* B. Game Over Overlay */}
        {gameState.isGameOver && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xs z-30 select-none">
            <ShieldAlert className="w-12 h-12 text-rose-500 mb-2 animate-bounce" />
            <h2 className="text-3xl font-display font-black tracking-widest text-rose-600">
              GAME OVER
            </h2>
            <div className="mt-3 text-gray-300 font-mono text-sm">
              FINAL SCORE: <span className="text-[#d946ef] font-bold">{gameState.score}</span>
            </div>
            {gameState.score >= gameState.highScore && gameState.score > 0 && (
              <span className="text-xs text-amber-400 font-mono mt-1 flex items-center gap-1.5 animate-pulse">
                🏆 NEW PERSONAL BEST RECORD!
              </span>
            )}
            
            <button
              id="retry-game-btn"
              onClick={resetGame}
              className="mt-6 px-10 py-3 bg-rose-600 hover:bg-rose-500 text-white font-display font-semibold text-sm uppercase rounded shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              TRY AGAIN
            </button>
          </div>
        )}

        {/* C. Paused Overlay */}
        {gameState.isPaused && !gameState.isGameOver && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-30 select-none">
            <h2 className="text-2xl font-display font-medium tracking-widest text-[#06b6d4] animate-pulse">
              GAME PAUSED
            </h2>
            <p className="text-[11px] font-mono text-gray-500 mt-1">
              Press SPACEBAR or CLICK RESUME
            </p>
            <button
              id="resume-btn"
              onClick={() => setGameState(prev => ({ ...prev, isPaused: false }))}
              className="mt-4 px-6 py-2 bg-[#06b6d4] hover:bg-[#22d3ee] text-black font-display font-medium text-xs uppercase rounded cursor-pointer"
            >
              RESUME SYSTEM
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Terminal Controls & Config Dash */}
      <div className="w-full flex flex-col gap-3 mt-3">
        
        {/* Row A: Level Speed Difficulties & Grid Cross Options */}
        <div className="grid grid-cols-2 gap-3">
          {/* Difficulty Selection */}
          <div className="bg-[#030406] border border-gray-900 rounded p-2.5 flex flex-col justify-between">
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
              CORE VOLTAGE (SPEED)
            </span>
            <div className="flex gap-1">
              {(['EASY', 'NORMAL', 'INSANE'] as const).map((lvl) => (
                <button
                  key={lvl}
                  id={`difficulty-${lvl.toLowerCase()}`}
                  onClick={() => adjustDifficulty(lvl)}
                  disabled={gameState.hasStarted && !gameState.isGameOver}
                  className={`text-[10px] font-mono py-1 rounded w-full border font-bold ${
                    difficulty === lvl
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-transparent border-transparent text-gray-600 hover:text-gray-400 disabled:opacity-30'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Wall Crossing boundary select */}
          <div className="bg-[#030406] border border-gray-900 rounded p-2.5 flex flex-col justify-between">
            <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider block mb-1 flex items-center justify-between">
              GRID COLLISION
              {gameState.classicMode ? (
                <span className="text-cyan-400 flex items-center gap-0.5 text-[8px] uppercase">
                  <ShieldCheck className="w-3 h-3" /> SAFE
                </span>
              ) : (
                <span className="text-rose-500 flex items-center gap-0.5 text-[8px] uppercase">
                  <ShieldAlert className="w-3 h-3" /> CORPSE
                </span>
              )}
            </span>
            <button
              id="toggle-boundary"
              onClick={() => setGameState(prev => ({ ...prev, classicMode: !prev.classicMode }))}
              disabled={gameState.hasStarted && !gameState.isGameOver}
              className={`text-[10px] font-mono py-1.5 rounded border text-center font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 ${
                gameState.classicMode 
                  ? 'bg-[#0f121d] border-cyan-500/30 text-cyan-400' 
                  : 'bg-transparent border-gray-900 text-gray-400 hover:border-gray-800'
              }`}
            >
              {gameState.classicMode ? 'WRAP AROUND ON' : 'CRASH DIRECT WALLS'}
            </button>
          </div>
        </div>

        {/* Keyboard layout visualizer */}
        <div className="flex items-center justify-between bg-[#040508] border border-gray-950 px-3 py-2 rounded-lg text-gray-500 text-[10px] font-mono">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            CONTROLS: WASD / ARA KEYBOARDS
          </span>
          <span className="flex items-center gap-3">
            <span>[SPACE] PAUSE</span>
            {gameState.hasStarted && (
              <button 
                id="reset-arcade-btn"
                onClick={resetGame} 
                className="text-rose-500 font-bold hover:text-rose-400"
              >
                KILL GAME
              </button>
            )}
          </span>
        </div>

      </div>
    </div>
  );
}
