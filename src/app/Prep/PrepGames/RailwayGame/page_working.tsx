'use client'

import React, { useEffect, useRef, useState } from 'react'

const getCircularPosition = (t: number, radius = 120) => {
  const angle = 2 * Math.PI * t
  const x = radius * Math.cos(angle)
  const y = radius * Math.sin(angle)
  return { x, y }
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))

export default function TrainChaseGame() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu')
  const [leaderT, setLeaderT] = useState(0)
  const [followerT, setFollowerT] = useState(0)
  const [followerSpeed, setFollowerSpeed] = useState(0)
  const [status, setStatus] = useState<'safe' | 'crashed'>('safe')
  
  const leaderSpeedRef = useRef(0.2)
  const targetLeaderSpeed = useRef(0.2)
  const animationRef = useRef<number>()
  const speedAdjustRef = useRef<number>()
  const erraticTimer = useRef<number>()
  
  // Make leader movement more erratic with frequent micro-adjustments
  useEffect(() => {
    if (gameState !== 'playing') return
    
    // Major speed changes every 1.5-3 seconds
    const majorInterval = setInterval(() => {
      targetLeaderSpeed.current = 0.05 + Math.random() * 0.4 // Wider speed range
    }, 1500 + Math.random() * 1500)
    
    // Minor erratic adjustments every 200-600ms
    const erraticInterval = setInterval(() => {
      const currentSpeed = targetLeaderSpeed.current
      const variation = (Math.random() - 0.5) * 0.15 // Random variation
      targetLeaderSpeed.current = clamp(currentSpeed + variation, 0.05, 0.45)
    }, 200 + Math.random() * 400)
    
    return () => {
      clearInterval(majorInterval)
      clearInterval(erraticInterval)
    }
  }, [gameState])
  
  // Faster leader speed transitions for more erratic behavior
  useEffect(() => {
    if (gameState !== 'playing') return
    
    const adjustSpeed = () => {
      // Increased transition speed for more erratic movement
      leaderSpeedRef.current += (targetLeaderSpeed.current - leaderSpeedRef.current) * 0.06
      speedAdjustRef.current = requestAnimationFrame(adjustSpeed)
    }
    adjustSpeed()
    
    return () => {
      if (speedAdjustRef.current) cancelAnimationFrame(speedAdjustRef.current)
    }
  }, [gameState])
  
  // Main game loop
  useEffect(() => {
    if (gameState !== 'playing') return
    
    let lastTime = performance.now()
    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000
      lastTime = now
      
      setLeaderT(prev => (prev + leaderSpeedRef.current * delta) % 1)
      
      // Only update follower position if speed > 0
      setFollowerT(prev => {
        if (followerSpeed > 0) {
          return (prev + followerSpeed * delta) % 1
        }
        return prev // Train stops completely when speed is 0
      })
      
      // Much faster deceleration for more responsive controls
      setFollowerSpeed(prev => Math.max(0, prev - 0.15 * delta))
      
      animationRef.current = requestAnimationFrame(loop)
    }
    
    animationRef.current = requestAnimationFrame(loop)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [gameState, followerSpeed])
  
  // Check for collision only
  useEffect(() => {
    if (gameState !== 'playing') return
    
    const dist = Math.abs(leaderT - followerT)
    const adjusted = Math.min(dist, 1 - dist)
    
    // Only check for collision, not distance
    if (adjusted < 0.03) {
      setStatus('crashed')
      setGameState('gameOver')
    } else {
      setStatus('safe')
    }
  }, [leaderT, followerT, gameState])
  
  // More responsive keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') {
        if (e.key === ' ' && (gameState === 'menu' || gameState === 'gameOver')) {
          startGame()
        }
        return
      }
      
      if (e.key === 'ArrowUp') {
        // Much more responsive acceleration
        setFollowerSpeed(s => clamp(s + 0.15, 0, 0.6))
      }
      if (e.key === 'ArrowDown') {
        // More responsive deceleration
        setFollowerSpeed(s => clamp(s - 0.12, 0, 0.6))
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState])
  
  const startGame = () => {
    setGameState('playing')
    setLeaderT(0.2)
    setFollowerT(0)
    setFollowerSpeed(0)
    setStatus('safe')
    leaderSpeedRef.current = 0.2
    targetLeaderSpeed.current = 0.2
  }
  
  const { x: leaderX, y: leaderY } = getCircularPosition(leaderT)
  const { x: followerX, y: followerY } = getCircularPosition(followerT)
  
  const distance = Math.min(Math.abs(leaderT - followerT), 1 - Math.abs(leaderT - followerT))
  
  // Calculate rotation angle based on position on circle
  const getRotation = (t: number) => {
    return (2 * Math.PI * t + Math.PI / 2) * (180 / Math.PI) // Convert to degrees and adjust for proper orientation
  }
  
  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <h1 className="text-5xl font-bold mb-8">🚂 Train Chase 🚃</h1>
        
        <div className="bg-gray-800 rounded-lg p-8 max-w-md">
          <div className="space-y-4 mb-8">
            <p className="text-lg">Follow the red train around the circle!</p>
            <div className="space-y-2 text-gray-300">
              <p>🚂 Red train - Changes speed erratically</p>
              <p>🚃 Blue train - Your train (control with arrows)</p>
              <p>⬆️ Press UP arrow to speed up</p>
              <p>⬇️ Press DOWN arrow to slow down</p>
              <p>💥 Don't crash into the red train!</p>
            </div>
          </div>
          
          <button
            onClick={startGame}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-lg transition-colors"
          >
            START GAME
          </button>
          <p className="text-center mt-4 text-gray-400">or press SPACE</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8">🚂 Train Chase 🚃</h1>
      
      <svg width={400} height={400} className="border border-gray-700 rounded-lg">
        <g transform="translate(200,200)">
          {/* Railway track - changes color based on distance */}
          <circle
            cx={0}
            cy={0}
            r={120}
            fill="none"
            stroke={distance < 0.08 ? '#dc2626' : distance > 0.25 ? '#eab308' : '#16a34a'}
            strokeWidth={6}
            className="transition-colors duration-300"
          />
          <circle
            cx={0}
            cy={0}
            r={118}
            fill="none"
            stroke={distance < 0.08 ? '#991b1b' : distance > 0.25 ? '#ca8a04' : '#15803d'}
            strokeWidth={2}
            className="transition-colors duration-300"
          />
          <circle
            cx={0}
            cy={0}
            r={122}
            fill="none"
            stroke={distance < 0.08 ? '#991b1b' : distance > 0.25 ? '#ca8a04' : '#15803d'}
            strokeWidth={2}
            className="transition-colors duration-300"
          />
          
          {/* Connection line between trains */}
          <line
            x1={leaderX}
            y1={leaderY}
            x2={followerX}
            y2={followerY}
            stroke={distance < 0.08 ? '#ef4444' : distance > 0.25 ? '#eab308' : '#10b981'}
            strokeWidth={1}
            opacity={0.3}
            strokeDasharray="4,4"
          />
          
          {/* Red leader train */}
          <g transform={`translate(${leaderX}, ${leaderY}) rotate(${getRotation(leaderT)})`}>
            <rect x={-12} y={-6} width={24} height={12} fill="#dc2626" rx={2} />
            <rect x={-10} y={-4} width={6} height={8} fill="#991b1b" rx={1} />
            <rect x={4} y={-4} width={6} height={8} fill="#991b1b" rx={1} />
            <circle cx={-8} cy={4} r={2} fill="#374151" />
            <circle cx={0} cy={4} r={2} fill="#374151" />
            <circle cx={8} cy={4} r={2} fill="#374151" />
            <rect x={10} y={-2} width={4} height={4} fill="#fbbf24" />
            <text x={0} y={2} textAnchor="middle" fontSize="8" fill="white">🚂</text>
          </g>
          
          {/* Blue follower train */}
          <g transform={`translate(${followerX}, ${followerY}) rotate(${getRotation(followerT)})`}>
            <rect x={-12} y={-6} width={24} height={12} fill="#2563eb" rx={2} />
            <rect x={-10} y={-4} width={6} height={8} fill="#1d4ed8" rx={1} />
            <rect x={4} y={-4} width={6} height={8} fill="#1d4ed8" rx={1} />
            <circle cx={-8} cy={4} r={2} fill="#374151" />
            <circle cx={0} cy={4} r={2} fill="#374151" />
            <circle cx={8} cy={4} r={2} fill="#374151" />
            <rect x={10} y={-2} width={4} height={4} fill="#fbbf24" />
            <text x={0} y={2} textAnchor="middle" fontSize="8" fill="white">🚃</text>
          </g>
        </g>
      </svg>
      
      <div className="mt-8 text-center">
        <p className="text-lg mb-2">Your Speed: {(followerSpeed * 100).toFixed(0)}%</p>
        <div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${(followerSpeed / 0.6) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-1">
          {followerSpeed === 0 ? 'Stopped at Station' : followerSpeed < 0.1 ? 'Leaving Station' : followerSpeed < 0.3 ? 'Cruising' : followerSpeed < 0.45 ? 'Express Speed' : 'High Speed Rail'}
        </p>
      </div>
      
      <div className={`mt-4 text-lg font-bold ${
        distance < 0.08 ? 'text-red-500' : 
        distance > 0.25 ? 'text-yellow-500' : 
        'text-green-500'
      }`}>
        {distance < 0.08 ? '⚠️ Collision Risk!' : 
         distance > 0.25 ? '🔍 Train Far Ahead' : 
         '✅ Safe Following Distance'}
      </div>
      
      <p className="mt-4 text-gray-400">Use ↑↓ arrows to control throttle</p>
      
      {gameState === 'gameOver' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <h2 className="text-3xl font-bold mb-4 text-red-500">💥 Train Crash!</h2>
            <p className="text-xl mb-6">Your train collided with the leader!</p>
            <button
              onClick={startGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold transition-colors"
            >
              RESTART JOURNEY
            </button>
            <p className="mt-4 text-gray-400">or press SPACE</p>
          </div>
        </div>
      )}
    </div>
  )
}