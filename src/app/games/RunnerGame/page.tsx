"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';

type GameState = 'ready' | 'playing' | 'gameOver';

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  isJumping: boolean;
  canDoubleJump: boolean;
  isDoubleJumping: boolean;
  color: string;
  rotation: number;
}

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  colorName: string;
  isTarget: boolean;
}

interface Keys {
  [key: string]: boolean;
}

const RunnerGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const keysRef = useRef<Keys>({});
  
  // Game state
  const [gameState, setGameState] = useState<GameState>('ready');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  
  // Color system
  const gameColors: string[] = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899']; // Blue, Green, Orange, Pink
  const colorNames: string[] = ['Blue', 'Green', 'Orange', 'Pink'];
  const [playerColor, setPlayerColor] = useState<string>('#3B82F6'); // Start with blue
  const [playerColorName, setPlayerColorName] = useState<string>('Blue');
  const lastColorChangeRef = useRef<number>(Date.now());
  const colorChangeDuration: number = 10000; // 10 seconds
  
  // Game objects
  const playerRef = useRef<Player>({
    x: 100,
    y: 300,
    width: 40,
    height: 40,
    velocityY: 0,
    isJumping: false,
    canDoubleJump: false,
    isDoubleJumping: false,
    color: '#3B82F6',
    rotation: 0
  });
  
  const obstaclesRef = useRef<Obstacle[]>([]);
  const gameSpeedRef = useRef<number>(4);
  const lastObstacleRef = useRef<number>(0);
  const groundY: number = 340;
  const particlesRef = useRef<TrailParticle[]>([]);
  const sparkParticlesRef = useRef<SparkParticle[]>([]);
  
  // Game constants
  const GRAVITY: number = 0.8;
  const JUMP_FORCE: number = -16; // Negative = jump up
  const MIN_OBSTACLE_DISTANCE: number = 250;
  const MAX_OBSTACLE_DISTANCE: number = 400;
  
  // Particle classes
  class TrailParticle {
    x: number;
    y: number;
    size: number;
    opacity: number;
    maxAge: number;
    age: number;
    color: string;

    constructor(x: number, y: number, isDoubleJump: boolean = false) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 8 + 4;
      this.opacity = 0.9;
      this.maxAge = 30 + Math.random() * 15;
      this.age = 0;
      this.color = isDoubleJump ? '#EC4899' : playerColor;
    }
    
    update(): void {
      this.age++;
      this.opacity = (1 - (this.age / this.maxAge)) * 0.9;
      this.size *= 0.96;
      this.x -= 2;
    }
    
    shouldRemove(): boolean {
      return this.age >= this.maxAge || this.opacity <= 0.1;
    }
  }
  
  class SparkParticle {
    x: number;
    y: number;
    color: string;
    velocityX: number;
    velocityY: number;
    size: number;
    opacity: number;
    maxAge: number;
    age: number;

    constructor(x: number, y: number, color: string) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * 2 * Math.PI;
      const speed = 3 + Math.random() * 6;
      this.velocityX = Math.cos(angle) * speed;
      this.velocityY = Math.sin(angle) * speed;
      this.size = 4 + Math.random() * 6;
      this.opacity = 1.0;
      this.maxAge = 30 + Math.random() * 20;
      this.age = 0;
    }
    
    update(): void {
      this.age++;
      this.x += this.velocityX;
      this.y += this.velocityY;
      this.velocityY += 0.3; // gravity
      this.velocityX *= 0.98; // air resistance
      this.velocityY *= 0.98;
      this.opacity = (1 - (this.age / this.maxAge));
      this.size *= 0.96;
    }
    
    shouldRemove(): boolean {
      return this.age >= this.maxAge || this.opacity <= 0.1 || this.size <= 1;
    }
  }
  
  // Initialize game
  const initGame = useCallback((): void => {
    const player = playerRef.current;
    player.x = 100;
    player.y = 300; // Fixed: Set to proper ground position
    player.velocityY = 0;
    player.isJumping = false;
    player.canDoubleJump = false;
    player.isDoubleJumping = false;
    player.rotation = 0;
    player.color = '#3B82F6'; // Ensure player object color is set
    
    obstaclesRef.current = [];
    gameSpeedRef.current = 4;
    lastObstacleRef.current = 0;
    particlesRef.current = [];
    sparkParticlesRef.current = [];
    setScore(0);
    
    // Reset color system
    setPlayerColor('#3B82F6'); // Start with blue
    setPlayerColorName('Blue');
    lastColorChangeRef.current = Date.now();
  }, []);
  
  // Change player color (main game only)
  const changePlayerColor = useCallback((): void => {
    const randomIndex = Math.floor(Math.random() * gameColors.length);
    const newColor = gameColors[randomIndex];
    const newColorName = colorNames[randomIndex];
    
    setPlayerColor(newColor);
    setPlayerColorName(newColorName);
    playerRef.current.color = newColor;
    lastColorChangeRef.current = Date.now();
  }, []);
  
  // Check if colors match
  const colorsMatch = useCallback((color1: string, color2: string): boolean => {
    return color1 === color2;
  }, []);
  
  // Handle jump
  const jump = useCallback((): void => {
    const player = playerRef.current;
    
    if (gameState !== 'playing') return;
    
    if (!player.isJumping) {
      // First jump
      player.velocityY = JUMP_FORCE;
      player.isJumping = true;
      player.canDoubleJump = true;
      player.isDoubleJumping = false;
    } else if (player.canDoubleJump && !player.isDoubleJumping) {
      // Double jump
      player.velocityY = JUMP_FORCE * 0.8; // Slightly weaker double jump
      player.isDoubleJumping = true;
      player.canDoubleJump = false;
    }
  }, [gameState]);
  
  // Generate obstacles
  const generateObstacle = useCallback((canvasWidth: number): void => {
    const obstacles = obstaclesRef.current;
    const lastObstacle = obstacles[obstacles.length - 1];
    
    const shouldSpawn = !lastObstacle || 
      (canvasWidth - lastObstacle.x > MIN_OBSTACLE_DISTANCE + Math.random() * (MAX_OBSTACLE_DISTANCE - MIN_OBSTACLE_DISTANCE));
    
    if (shouldSpawn) {
      const obstacleHeight = 50 + Math.random() * 40;
      const obstacleWidth = 35;
      
      let obstacleColor: string, obstacleColorName: string, isTarget: boolean;
      
      // Main game: mix of targets and obstacles
      if (Math.random() < 0.5) {
        // 50% chance for colored targets
        isTarget = true;
        if (Math.random() < 0.6) {
          // 60% chance to match player color (collect these)
          obstacleColor = playerColor;
          obstacleColorName = playerColorName;
        } else {
          // 40% chance to be different color (jump over these)
          const otherColors = gameColors.filter(c => c !== playerColor);
          const randomIndex = Math.floor(Math.random() * otherColors.length);
          obstacleColor = otherColors[randomIndex];
          obstacleColorName = colorNames[gameColors.indexOf(obstacleColor)];
        }
      } else {
        // 50% chance for red obstacles (always jump over)
        obstacleColor = '#EF4444';
        obstacleColorName = 'Red';
        isTarget = false;
      }
      
      obstacles.push({
        x: canvasWidth + 50,
        y: groundY - obstacleHeight, // Fixed: Position obstacles properly on ground
        width: obstacleWidth,
        height: obstacleHeight,
        color: obstacleColor,
        colorName: obstacleColorName,
        isTarget: isTarget
      });
    }
  }, [gameState, playerColor, playerColorName]);
  
  // Check collision
  const checkCollision = useCallback((rect1: Player, rect2: Obstacle): boolean => {
    const playerLeft = rect1.x;
    const playerRight = rect1.x + rect1.width;
    const playerTop = rect1.y - rect1.height;
    const playerBottom = rect1.y;
    
    const obstacleLeft = rect2.x;
    const obstacleRight = rect2.x + rect2.width;
    const obstacleTop = rect2.y;
    const obstacleBottom = rect2.y + rect2.height;
    
    return playerLeft < obstacleRight &&
           playerRight > obstacleLeft &&
           playerTop < obstacleBottom &&
           playerBottom > obstacleTop;
  }, []);
  
  // Create spark effect
  const createSparks = useCallback((x: number, y: number, color: string): void => {
    const sparks = sparkParticlesRef.current;
    for (let i = 0; i < 12; i++) {
      sparks.push(new SparkParticle(x, y, color));
    }
  }, []);
  
  // Update game logic
  const updateGame = useCallback((): void => {
    if (gameState !== 'playing') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const player = playerRef.current;
    const obstacles = obstaclesRef.current;
    
    // Update player physics
    player.velocityY += GRAVITY;
    player.y += player.velocityY;
    
    // Ground collision (prevent going below ground)
    if (player.y >= 300) { // Fixed: Proper ground level check
      player.y = 300;
      player.velocityY = 0;
      player.isJumping = false;
      player.canDoubleJump = false;
      player.isDoubleJumping = false;
      player.rotation = 0;
    }
    
    // Update player rotation when jumping
    if (player.isJumping) {
      player.rotation += 0.2;
      if (player.rotation > 2 * Math.PI) {
        player.rotation = 0;
      }
    }
    
    // Update player color
    player.color = playerColor;
    
    // Check for color changes in main game
    const now = Date.now();
    if (now - lastColorChangeRef.current >= colorChangeDuration) {
      changePlayerColor();
    }
    
    // Generate obstacles
    generateObstacle(canvas.width);
    
    // Update trail particles
    const trails = particlesRef.current;
    if (Math.random() < 0.3) {
      trails.push(new TrailParticle(
        player.x + player.width / 2,
        player.y - player.height / 2,
        player.isDoubleJumping
      ));
    }
    
    // Update and clean particles
    particlesRef.current = trails.filter(particle => {
      particle.update();
      return !particle.shouldRemove();
    });
    
    // Update spark particles
    sparkParticlesRef.current = sparkParticlesRef.current.filter(particle => {
      particle.update();
      return !particle.shouldRemove();
    });
    
    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.x -= gameSpeedRef.current;
      
      // Check collision
      if (checkCollision(player, obstacle)) {
        // Check color matching
        if (obstacle.isTarget && colorsMatch(obstacle.color, playerColor)) {
          // Correct color match - collect target
          createSparks(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, obstacle.color);
          setScore(prev => prev + 50);
          obstacles.splice(i, 1);
          continue;
        } else {
          // Wrong color or red obstacle - game over
          setGameState('gameOver');
          setHighScore(prev => Math.max(prev, score));
          return;
        }
      }
      
      // Remove off-screen obstacles and update score
      if (obstacle.x + obstacle.width < 0) {
        obstacles.splice(i, 1);
        
        if (!obstacle.isTarget) {
          setScore(prev => prev + 10); // Points for avoiding obstacles
        }
      }
    }
    
    // Increase game speed based on score
    gameSpeedRef.current = 4 + Math.floor(score / 100) * 0.5;
  }, [gameState, score, playerColor, playerColorName, changePlayerColor, generateObstacle, checkCollision, colorsMatch, createSparks]);
  
  // Render game
  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const player = playerRef.current;
    const obstacles = obstaclesRef.current;
    
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1b3a');
    gradient.addColorStop(0.5, '#2d1b69');
    gradient.addColorStop(1, '#42307d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw moving background particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 30; i++) {
      const x = (i * 50 + (Date.now() * 0.05) % canvas.width) % canvas.width;
      const y = 50 + (i * 20) % (canvas.height - 100);
      ctx.fillRect(x, y, 2, 2);
    }
    
    // Draw ground
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    
    // Draw ground line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, groundY - 2, canvas.width, 2);
    
    // Draw trail particles
    particlesRef.current.forEach(particle => {
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Draw spark particles
    sparkParticlesRef.current.forEach(particle => {
      ctx.globalAlpha = particle.opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow effect
      ctx.globalAlpha = particle.opacity * 0.3;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Draw player with rotation
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y - player.height / 2);
    ctx.rotate(player.rotation);
    
    // Player glow effect
    ctx.shadowColor = player.color;
    ctx.shadowBlur = player.isJumping ? 20 : 10;
    
    ctx.fillStyle = player.color;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    // Player eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-player.width / 2 + 8, -player.height / 2 + 8, 6, 6);
    ctx.fillRect(-player.width / 2 + 26, -player.height / 2 + 8, 6, 6);
    
    // Double jump indicator
    if (player.canDoubleJump) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-player.width / 2 + 4, -player.height / 2 + 4, player.width - 8, player.height - 8);
    }
    
    ctx.restore();
    
    // Draw obstacles
    obstacles.forEach(obstacle => {
      // Obstacle glow
      ctx.shadowColor = obstacle.color;
      ctx.shadowBlur = 15;
      
      ctx.fillStyle = obstacle.color;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      
      // Highlight for targets
      if (obstacle.isTarget) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(obstacle.x + 2, obstacle.y + 2, obstacle.width - 4, obstacle.height - 4);
      }
    });
    
    ctx.shadowBlur = 0;
    
    // Draw UI
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 40);
    ctx.fillText(`Speed: ${gameSpeedRef.current.toFixed(1)}x`, 20, 70);
    ctx.fillText(`High Score: ${highScore}`, canvas.width - 200, 40);
    
    // Color indicator in main game
    const timeLeft = Math.max(0, colorChangeDuration - (Date.now() - lastColorChangeRef.current));
    ctx.fillStyle = playerColor;
    ctx.fillRect(canvas.width - 120, 60, 100, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(playerColorName, canvas.width - 115, 80);
    ctx.font = '12px Arial';
    ctx.fillText(`${Math.ceil(timeLeft / 1000)}s`, canvas.width - 115, 95);
    
    // Game state overlays
    if (gameState === 'ready') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('COLOR RUNNER', canvas.width / 2, canvas.height / 2 - 60);
      
      ctx.font = 'bold 20px Arial';
      ctx.fillText('Match colors to collect targets!', canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillText('Jump over everything else!', canvas.width / 2, canvas.height / 2 + 10);
      
      ctx.font = 'bold 18px Arial';
      ctx.fillText('Your color changes every 10 seconds', canvas.width / 2, canvas.height / 2 + 40);
      
      ctx.fillText('Press SPACE or CLICK to start', canvas.width / 2, canvas.height / 2 + 70);
      ctx.textAlign = 'left';
    }
    
    if (gameState === 'gameOver') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 - 20);
      ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, canvas.height / 2 + 10);
      ctx.fillText('Press ENTER to restart', canvas.width / 2, canvas.height / 2 + 50);
      ctx.textAlign = 'left';
    }
  }, [gameState, score, highScore, playerColor, playerColorName]);
  
  // Game loop
  const gameLoop = useCallback((): void => {
    updateGame();
    render();
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [updateGame, render]);
  
  // Start game
  const startGame = useCallback((): void => {
    initGame();
    setGameState('playing');
  }, [initGame]);
  
  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = true;
      
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
      
      if (e.code === 'Enter') {
        e.preventDefault();
        if (gameState === 'ready' || gameState === 'gameOver') {
          startGame();
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent): void => {
      keysRef.current[e.code] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [jump, startGame, gameState]);
  
  // Handle canvas click
  const handleCanvasClick = useCallback((): void => {
    if (gameState === 'playing') {
      jump();
    } else if (gameState === 'ready' || gameState === 'gameOver') {
      startGame();
    }
  }, [gameState, jump, startGame]);
  
  // Initialize canvas and start game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = 800;
    canvas.height = 400;
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameLoop]);
  
  return (
    <div className="flex flex-col items-center space-y-4">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="border-4 border-gray-800 rounded-lg cursor-pointer bg-gradient-to-b from-purple-900 to-purple-700"
        style={{ imageRendering: 'pixelated' }}
      />
      
      <div className="flex space-x-4">
        <button
          onClick={startGame}
          disabled={gameState === 'playing'}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {gameState === 'ready' ? 'Start Game' : 
           gameState === 'playing' ? 'Playing...' : 'Restart'}
        </button>
        
        <button
          onClick={jump}
          disabled={gameState !== 'playing'}
          className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Jump
        </button>
      </div>
      
      <div className="text-center text-gray-600 max-w-2xl">
        <p className="font-semibold text-lg mb-2">Color Runner Game</p>
        <p className="mb-1"><strong>Objective:</strong> Jump over obstacles that DON'T match your color</p>
        <p className="mb-1"><strong>Collect:</strong> Targets that match your current color for bonus points</p>
        <p className="mb-1"><strong>Red obstacles:</strong> Always jump over these!</p>
        <p className="text-sm"><strong>Controls:</strong> SPACE or CLICK to jump • ENTER to start/restart</p>
        <p className="text-sm">Your color changes every 10 seconds!</p>
      </div>
    </div>
  );
};

export default RunnerGame;