'use client'

import React, { useState, useEffect, useRef } from 'react';

const TopDownRacer = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu');
  const [currentLap, setCurrentLap] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bestTime, setBestTime] = useState(null);
  const [speed, setSpeed] = useState(0);

  const gameRef = useRef({
    car: {
      x: 400,
      y: 500,
      angle: -Math.PI / 2,
      velocity: 0,
      width: 20,
      height: 30
    },
    keys: {},
    lastTime: 0,
    startTime: 0,
    lapStartTime: 0,
    crossedStart: false,
    ghost: [],
    ghostCar: null,
    recording: []
  });

  // Separate useEffect for keyboard events - no dependencies
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', ' '].includes(e.key)) {
        e.preventDefault();
      }
      gameRef.current.keys[e.key] = true;
      
      if (e.key === ' ') {
        setGameState(prev => {
          if (prev === 'menu') {
            // Start game
            gameRef.current.car = {
              x: 400,
              y: 500,
              angle: -Math.PI / 2,
              velocity: 0,
              width: 20,
              height: 30
            };
            gameRef.current.startTime = Date.now();
            gameRef.current.lapStartTime = Date.now();
            gameRef.current.crossedStart = false;
            gameRef.current.recording = [];
            setCurrentLap(1);
            setCurrentTime(0);
            return 'playing';
          } else if (prev === 'finished') {
            return 'menu';
          }
          return prev;
        });
      }
    };

    const handleKeyUp = (e) => {
      gameRef.current.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game loop useEffect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationId;

    const drawTrack = () => {
      ctx.fillStyle = '#2d5016';
      ctx.fillRect(0, 0, 800, 600);

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(50, 50, 700, 500);

      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(100, 100, 600, 400);

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(250, 200, 300, 200);

      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          ctx.fillRect(100 + i * 60, 480, 60, 20);
        }
      }
      
      ctx.fillStyle = '#000000';
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 1) {
          ctx.fillRect(100 + i * 60, 480, 60, 20);
        }
      }
    };

    const drawCar = (car, color = '#ff0000') => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      
      ctx.fillStyle = color;
      ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-car.width / 4, -car.height / 2 - 5, car.width / 2, 5);
      
      ctx.restore();
    };

    const checkCollision = (car) => {
      const corners = [
        { x: car.x + Math.cos(car.angle) * car.height / 2, y: car.y + Math.sin(car.angle) * car.height / 2 },
        { x: car.x - Math.cos(car.angle) * car.height / 2, y: car.y - Math.sin(car.angle) * car.height / 2 },
        { x: car.x + Math.cos(car.angle + Math.PI / 2) * car.width / 2, y: car.y + Math.sin(car.angle + Math.PI / 2) * car.width / 2 },
        { x: car.x + Math.cos(car.angle - Math.PI / 2) * car.width / 2, y: car.y + Math.sin(car.angle - Math.PI / 2) * car.width / 2 }
      ];

      for (let corner of corners) {
        if (corner.x < 100 || corner.x > 700 || corner.y < 100 || corner.y > 500) {
          return true;
        }
        
        if (corner.x > 250 && corner.x < 550 && corner.y > 200 && corner.y < 400) {
          return true;
        }
      }
      
      return false;
    };

    const checkStartLine = (car) => {
      if (car.y > 480 && car.y < 500 && car.x > 100 && car.x < 700) {
        if (!gameRef.current.crossedStart && currentLap > 0) {
          const lapTime = Date.now() - gameRef.current.lapStartTime;
          
          if (currentLap >= 3) {
            setGameState('finished');
            if (!bestTime || lapTime < bestTime) {
              setBestTime(lapTime);
              gameRef.current.ghost = [...gameRef.current.recording];
            }
          } else {
            setCurrentLap(currentLap + 1);
            gameRef.current.lapStartTime = Date.now();
          }
          
          gameRef.current.crossedStart = true;
          gameRef.current.recording = [];
        }
      } else {
        gameRef.current.crossedStart = false;
      }
    };

    const updateCar = () => {
      const car = gameRef.current.car;
      const keys = gameRef.current.keys;
      
      const acceleration = 0.3;
      const turnSpeed = 0.05;
      const friction = 0.95;
      const maxSpeed = 8;

      if (keys['ArrowUp'] || keys['w']) {
        car.velocity += acceleration;
      }
      if (keys['ArrowDown'] || keys['s']) {
        car.velocity -= acceleration * 0.7;
      }

      car.velocity *= friction;

      if (car.velocity > maxSpeed) car.velocity = maxSpeed;
      if (car.velocity < -maxSpeed * 0.5) car.velocity = -maxSpeed * 0.5;

      if (Math.abs(car.velocity) > 0.5) {
        if (keys['ArrowLeft'] || keys['a']) {
          car.angle -= turnSpeed * (car.velocity / maxSpeed);
        }
        if (keys['ArrowRight'] || keys['d']) {
          car.angle += turnSpeed * (car.velocity / maxSpeed);
        }
      }

      const oldX = car.x;
      const oldY = car.y;

      car.x += Math.cos(car.angle) * car.velocity;
      car.y += Math.sin(car.angle) * car.velocity;

      if (checkCollision(car)) {
        car.x = oldX;
        car.y = oldY;
        car.velocity *= -0.5;
      }

      if (gameState === 'playing') {
        gameRef.current.recording.push({
          x: car.x,
          y: car.y,
          angle: car.angle,
          time: Date.now() - gameRef.current.lapStartTime
        });
      }

      setSpeed(Math.abs(car.velocity));

      checkStartLine(car);
    };

    const updateGhost = () => {
      if (gameRef.current.ghost.length === 0) return;
      
      const elapsed = Date.now() - gameRef.current.lapStartTime;
      const ghostData = gameRef.current.ghost.find((g, i) => {
        return g.time >= elapsed && (i === 0 || gameRef.current.ghost[i - 1].time < elapsed);
      });
      
      if (ghostData) {
        gameRef.current.ghostCar = ghostData;
      }
    };

    const gameLoop = () => {
      ctx.clearRect(0, 0, 800, 600);
      drawTrack();

      if (gameState === 'menu') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MICRO RACER', 400, 250);
        ctx.font = '24px Arial';
        ctx.fillText('Press SPACE to Start', 400, 320);
        ctx.font = '18px Arial';
        ctx.fillText('Arrow Keys or WASD to Drive', 400, 360);
        ctx.fillText('Complete 3 Laps!', 400, 390);
        if (bestTime) {
          ctx.fillText(`Best Time: ${(bestTime / 1000).toFixed(2)}s`, 400, 430);
        }
      } else if (gameState === 'playing') {
        updateCar();
        updateGhost();
        
        if (gameRef.current.ghostCar) {
          drawCar(gameRef.current.ghostCar, 'rgba(100, 100, 255, 0.5)');
        }
        
        drawCar(gameRef.current.car);
        
        setCurrentTime(Date.now() - gameRef.current.lapStartTime);
      } else if (gameState === 'finished') {
        drawCar(gameRef.current.car);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(200, 200, 400, 200);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('RACE COMPLETE!', 400, 260);
        ctx.font = '24px Arial';
        ctx.fillText(`Time: ${(currentTime / 1000).toFixed(2)}s`, 400, 310);
        if (bestTime) {
          ctx.fillText(`Best: ${(bestTime / 1000).toFixed(2)}s`, 400, 345);
        }
        ctx.font = '18px Arial';
        ctx.fillText('Press SPACE to Restart', 400, 380);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [gameState, currentLap, currentTime, bestTime]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="mb-4 text-white">
        <div className="flex gap-8 text-xl">
          <div>Lap: {currentLap}/3</div>
          <div>Time: {(currentTime / 1000).toFixed(2)}s</div>
          <div>Speed: {speed.toFixed(1)}</div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-4 border-gray-700 rounded-lg shadow-2xl"
      />
      <div className="mt-4 text-gray-400 text-sm">
        {gameState === 'playing' && 'Drive with Arrow Keys or WASD'}
      </div>
    </div>
  );
};

export default TopDownRacer;