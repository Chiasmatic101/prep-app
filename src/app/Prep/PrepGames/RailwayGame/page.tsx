'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// =============================
// Tunable constants
// =============================
const WIDTH = 720
const HEIGHT = 360
const PADDING_X = 40
const TRACK_Y_TOP = HEIGHT / 2 - 40 // AI track (top)
const TRACK_Y_BOTTOM = HEIGHT / 2 + 40 // Player track (bottom)

const AMPLITUDE = 250 // px (peak side-to-side of AI)
const BASE_SPEED = 0.4 // radians/sec baseline - slow start
const SPEED_GROWTH = 0.05 // +5% per second (gentle ramp)
const SYNC_ZONE = 30 // px
const MAX_DISTANCE = 150 // px (lose when farther than this)

const INPUT_SPEED = 420 // px/sec (player direct control)

const PALETTE = {
  bg: '#0b1220',
  track: '#2a3347',
  safe: '#5e8a6b',
  warn: '#bda355',
  risk: '#a35a58',
  player: '#2a5b90',
  ai: '#b94a48',
  textMain: '#d7deea',
  textSubtle: '#9aa8bf'
}

interface SyncEvent {
  timestamp: number
  phaseLag: number
  distance: number
  inSync: boolean
}

interface MotionChangeEvent {
  timestamp: number
  directionChange: 'left' | 'right' | 'none'
  reactionLatency: number
  playerResponse: boolean
}

interface DriftEvent {
  timestamp: number
  driftRate: number
  duration: number
  recoveryTime: number
}

interface AdaptationEvent {
  timestamp: number
  speedFactor: number
  adaptationQuality: number
  errorRate: number
}

interface SessionData {
  sessionStart: number
  sessionDuration: number
  finalScore: number
  
  sensoriomotorSync: {
    averagePhaseLag: number
    syncAccuracy: number
    peakSyncDuration: number
    totalSyncTime: number
    syncRate: number
  }
  
  sustainedAttention: {
    attentionScore: number
    focusDuration: number
    attentionLapses: number
    consistencyScore: number
  }
  
  rhythmPerception: {
    rhythmAccuracy: number
    timingPrecision: number
    anticipationScore: number
    beatMatchingQuality: number
  }
  
  errorMonitoring: {
    totalErrors: number
    errorRecoveryTime: number
    selfCorrectionRate: number
    errorAwareness: number
  }
  
  processingSpeed: {
    averageReactionTime: number
    adaptationSpeed: number
    motorResponseTime: number
    cognitiveFlexibility: number
  }
  
  detailedLogs: {
    syncEvents: SyncEvent[]
    motionChanges: MotionChangeEvent[]
    driftEvents: DriftEvent[]
    adaptationEvents: AdaptationEvent[]
  }
}

export default function TrainMirrorGame() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameOver'>('menu')
  const [leaderX, setLeaderX] = useState<number>(0)
  const [playerX, setPlayerX] = useState<number>(0)
  const [score, setScore] = useState<number>(0)
  const [perfect, setPerfect] = useState<boolean>(false)
  const [showMetrics, setShowMetrics] = useState(false)

  const [sessionData, setSessionData] = useState<SessionData>({
    sessionStart: Date.now(),
    sessionDuration: 0,
    finalScore: 0,
    sensoriomotorSync: {
      averagePhaseLag: 0,
      syncAccuracy: 0,
      peakSyncDuration: 0,
      totalSyncTime: 0,
      syncRate: 0
    },
    sustainedAttention: {
      attentionScore: 100,
      focusDuration: 0,
      attentionLapses: 0,
      consistencyScore: 100
    },
    rhythmPerception: {
      rhythmAccuracy: 100,
      timingPrecision: 100,
      anticipationScore: 100,
      beatMatchingQuality: 100
    },
    errorMonitoring: {
      totalErrors: 0,
      errorRecoveryTime: 0,
      selfCorrectionRate: 100,
      errorAwareness: 100
    },
    processingSpeed: {
      averageReactionTime: 0,
      adaptationSpeed: 100,
      motorResponseTime: 0,
      cognitiveFlexibility: 100
    },
    detailedLogs: {
      syncEvents: [],
      motionChanges: [],
      driftEvents: [],
      adaptationEvents: []
    }
  })

  const leaderXRef = useRef(0)
  const playerXRef = useRef(0)
  const elapsedRef = useRef(0)
  const lastTimeRef = useRef<number>(0)
  const rafRef = useRef<number>()

  const keys = useRef<{ up: boolean; down: boolean }>({ up: false, down: false })
  
  // Cognitive tracking refs
  const lastSyncState = useRef(false)
  const syncStartTime = useRef(0)
  const currentSyncDuration = useRef(0)
  const totalSyncTime = useRef(0)
  const lastDirection = useRef<'left' | 'right' | 'none'>('none')
  const lastMotionChangeTime = useRef(0)
  const lastPlayerAction = useRef(0)
  const driftStartTime = useRef(0)
  const isDrifting = useRef(false)
  const errorCount = useRef(0)
  const lastErrorTime = useRef(0)

  const USABLE = WIDTH - PADDING_X * 2
  const centerX = PADDING_X + USABLE / 2

  const startGame = () => {
    leaderXRef.current = centerX
    playerXRef.current = centerX
    setLeaderX(centerX)
    setPlayerX(centerX)

    setGameState('playing')
    setScore(0)
    setPerfect(true)

    elapsedRef.current = 0
    lastTimeRef.current = performance.now()
    
    // Reset tracking
    lastSyncState.current = false
    syncStartTime.current = 0
    currentSyncDuration.current = 0
    totalSyncTime.current = 0
    lastDirection.current = 'none'
    lastMotionChangeTime.current = 0
    lastPlayerAction.current = 0
    driftStartTime.current = 0
    isDrifting.current = false
    errorCount.current = 0
    lastErrorTime.current = 0

    setSessionData({
      sessionStart: Date.now(),
      sessionDuration: 0,
      finalScore: 0,
      sensoriomotorSync: {
        averagePhaseLag: 0,
        syncAccuracy: 0,
        peakSyncDuration: 0,
        totalSyncTime: 0,
        syncRate: 0
      },
      sustainedAttention: {
        attentionScore: 100,
        focusDuration: 0,
        attentionLapses: 0,
        consistencyScore: 100
      },
      rhythmPerception: {
        rhythmAccuracy: 100,
        timingPrecision: 100,
        anticipationScore: 100,
        beatMatchingQuality: 100
      },
      errorMonitoring: {
        totalErrors: 0,
        errorRecoveryTime: 0,
        selfCorrectionRate: 100,
        errorAwareness: 100
      },
      processingSpeed: {
        averageReactionTime: 0,
        adaptationSpeed: 100,
        motorResponseTime: 0,
        cognitiveFlexibility: 100
      },
      detailedLogs: {
        syncEvents: [],
        motionChanges: [],
        driftEvents: [],
        adaptationEvents: []
      }
    })

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const now = performance.now()
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!keys.current.up && !keys.current.down) {
          lastPlayerAction.current = now
        }
      }
      if (e.key === 'ArrowUp') keys.current.up = true
      if (e.key === 'ArrowDown') keys.current.down = true
      if ((gameState === 'menu' || gameState === 'gameOver') && e.key === ' ') startGame()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') keys.current.up = false
      if (e.key === 'ArrowDown') keys.current.down = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [gameState])

  const loop = (now: number) => {
    const dt = Math.min(0.032, (now - lastTimeRef.current) / 1000)
    lastTimeRef.current = now

    elapsedRef.current += dt
    const speedFactor = 1 + SPEED_GROWTH * Math.max(0, elapsedRef.current - 3)
    const omega = BASE_SPEED * speedFactor

    // Predictive AI motion
    const L = centerX + AMPLITUDE * Math.sin((elapsedRef.current + 0.15) * omega)
    const prevLeaderX = leaderXRef.current
    leaderXRef.current = L

    // Detect AI direction change
    const currentDirection: 'left' | 'right' | 'none' = 
      L < prevLeaderX ? 'left' : L > prevLeaderX ? 'right' : 'none'
    
    if (currentDirection !== 'none' && currentDirection !== lastDirection.current) {
      const reactionLatency = lastPlayerAction.current > 0 
        ? lastPlayerAction.current - lastMotionChangeTime.current 
        : 0
      
      const motionChange: MotionChangeEvent = {
        timestamp: now,
        directionChange: currentDirection,
        reactionLatency,
        playerResponse: lastPlayerAction.current > lastMotionChangeTime.current
      }
      
      setSessionData(prev => ({
        ...prev,
        detailedLogs: {
          ...prev.detailedLogs,
          motionChanges: [...prev.detailedLogs.motionChanges, motionChange]
        }
      }))
      
      lastDirection.current = currentDirection
      lastMotionChangeTime.current = now
    }

    // Direct position control
    if (keys.current.up) playerXRef.current += INPUT_SPEED * dt
    if (keys.current.down) playerXRef.current -= INPUT_SPEED * dt

    playerXRef.current = clamp(playerXRef.current, PADDING_X, PADDING_X + USABLE)

    setLeaderX(leaderXRef.current)
    setPlayerX(playerXRef.current)

    const dx = Math.abs(leaderXRef.current - playerXRef.current)
    const phaseLag = leaderXRef.current - playerXRef.current
    const inSync = dx <= SYNC_ZONE
    setPerfect(inSync)

    // Track sync events
    const syncEvent: SyncEvent = {
      timestamp: now,
      phaseLag,
      distance: dx,
      inSync
    }
    
    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        syncEvents: [...prev.detailedLogs.syncEvents, syncEvent]
      }
    }))

    // Track sync duration
    if (inSync) {
      if (!lastSyncState.current) {
        syncStartTime.current = now
        currentSyncDuration.current = 0
      } else {
        currentSyncDuration.current = now - syncStartTime.current
      }
      totalSyncTime.current += dt
      setScore(s => s + dt * 5)
    } else {
      if (lastSyncState.current && currentSyncDuration.current > 0) {
        setSessionData(prev => ({
          ...prev,
          sensoriomotorSync: {
            ...prev.sensoriomotorSync,
            peakSyncDuration: Math.max(prev.sensoriomotorSync.peakSyncDuration, currentSyncDuration.current)
          }
        }))
      }
      currentSyncDuration.current = 0
    }
    
    lastSyncState.current = inSync

    // Track drift events
    if (dx > SYNC_ZONE && !isDrifting.current) {
      driftStartTime.current = now
      isDrifting.current = true
      errorCount.current++
    } else if (dx <= SYNC_ZONE && isDrifting.current) {
      const driftDuration = now - driftStartTime.current
      const recoveryTime = now - lastErrorTime.current
      const driftRate = dx / Math.max(driftDuration, 0.001)
      
      const driftEvent: DriftEvent = {
        timestamp: now,
        driftRate,
        duration: driftDuration,
        recoveryTime
      }
      
      setSessionData(prev => ({
        ...prev,
        detailedLogs: {
          ...prev.detailedLogs,
          driftEvents: [...prev.detailedLogs.driftEvents, driftEvent]
        }
      }))
      
      isDrifting.current = false
      lastErrorTime.current = now
    }

    // Track adaptation to speed changes
    if (Math.floor(elapsedRef.current) % 5 === 0 && elapsedRef.current > 3) {
      const recentSyncs = sessionData.detailedLogs.syncEvents.slice(-50)
      const avgDistance = recentSyncs.length > 0
        ? recentSyncs.reduce((sum, e) => sum + e.distance, 0) / recentSyncs.length
        : dx
      
      const adaptationQuality = Math.max(0, 100 - (avgDistance / SYNC_ZONE) * 100)
      const errorRate = errorCount.current / Math.max(elapsedRef.current, 1)
      
      const adaptationEvent: AdaptationEvent = {
        timestamp: now,
        speedFactor,
        adaptationQuality,
        errorRate
      }
      
      setSessionData(prev => ({
        ...prev,
        detailedLogs: {
          ...prev.detailedLogs,
          adaptationEvents: [...prev.detailedLogs.adaptationEvents, adaptationEvent]
        }
      }))
    }

    if (elapsedRef.current > 1 && dx > MAX_DISTANCE) {
      endGame()
      return
    }

    rafRef.current = requestAnimationFrame(loop)
  }

  const endGame = () => {
    const sessionDuration = elapsedRef.current * 1000
    const syncEvents = sessionData.detailedLogs.syncEvents
    const motionChanges = sessionData.detailedLogs.motionChanges
    const driftEvents = sessionData.detailedLogs.driftEvents
    const adaptationEvents = sessionData.detailedLogs.adaptationEvents
    
    // Calculate final metrics
    const avgPhaseLag = syncEvents.length > 0
      ? syncEvents.reduce((sum, e) => sum + Math.abs(e.phaseLag), 0) / syncEvents.length
      : 0
    
    const syncAccuracy = syncEvents.length > 0
      ? (syncEvents.filter(e => e.inSync).length / syncEvents.length) * 100
      : 0
    
    const avgReactionTime = motionChanges.length > 0
      ? motionChanges.reduce((sum, e) => sum + e.reactionLatency, 0) / motionChanges.length
      : 0
    
    const avgRecoveryTime = driftEvents.length > 0
      ? driftEvents.reduce((sum, e) => sum + e.recoveryTime, 0) / driftEvents.length
      : 0
    
    const attentionLapses = driftEvents.length
    const selfCorrectionRate = driftEvents.length > 0
      ? (driftEvents.filter(e => e.recoveryTime < 2000).length / driftEvents.length) * 100
      : 100
    
    const adaptationSpeed = adaptationEvents.length > 0
      ? adaptationEvents.reduce((sum, e) => sum + e.adaptationQuality, 0) / adaptationEvents.length
      : 100
    
    setSessionData(prev => ({
      ...prev,
      sessionDuration,
      finalScore: score,
      sensoriomotorSync: {
        averagePhaseLag: avgPhaseLag,
        syncAccuracy,
        peakSyncDuration: prev.sensoriomotorSync.peakSyncDuration,
        totalSyncTime: totalSyncTime.current * 1000,
        syncRate: (totalSyncTime.current / elapsedRef.current) * 100
      },
      sustainedAttention: {
        attentionScore: Math.max(0, 100 - attentionLapses * 5),
        focusDuration: sessionDuration,
        attentionLapses,
        consistencyScore: syncAccuracy
      },
      rhythmPerception: {
        rhythmAccuracy: syncAccuracy,
        timingPrecision: Math.max(0, 100 - (avgPhaseLag / SYNC_ZONE) * 100),
        anticipationScore: motionChanges.filter(m => m.playerResponse).length / Math.max(motionChanges.length, 1) * 100,
        beatMatchingQuality: Math.max(0, 100 - (avgPhaseLag / SYNC_ZONE) * 50)
      },
      errorMonitoring: {
        totalErrors: errorCount.current,
        errorRecoveryTime: avgRecoveryTime,
        selfCorrectionRate,
        errorAwareness: selfCorrectionRate
      },
      processingSpeed: {
        averageReactionTime: avgReactionTime,
        adaptationSpeed,
        motorResponseTime: avgReactionTime,
        cognitiveFlexibility: adaptationSpeed
      }
    }))
    
    setGameState('gameOver')
  }

  const exportMetrics = () => {
    const metrics = {
      sessionOverview: {
        sessionStart: sessionData.sessionStart,
        sessionEnd: Date.now(),
        sessionDuration: sessionData.sessionDuration,
        finalScore: sessionData.finalScore
      },
      cognitiveProfile: {
        sensoriomotorSync: sessionData.sensoriomotorSync,
        sustainedAttention: sessionData.sustainedAttention,
        rhythmPerception: sessionData.rhythmPerception,
        errorMonitoring: sessionData.errorMonitoring,
        processingSpeed: sessionData.processingSpeed
      },
      detailedData: sessionData
    }
    
    const dataStr = JSON.stringify(metrics, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `train-mirror-session-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  const beatPhase = (() => {
    const t = elapsedRef.current
    const speedFactor = 1 + SPEED_GROWTH * Math.max(0, t - 3)
    const omega = BASE_SPEED * speedFactor
    return Math.sin(t * omega)
  })()
  const beatScale = 0.85 + 0.25 * (0.5 + 0.5 * beatPhase)
  const beatColor = perfect ? PALETTE.safe : PALETTE.textSubtle

  const dx = Math.abs(leaderX - playerX)
  const trackColor = dx < SYNC_ZONE ? PALETTE.safe : dx > MAX_DISTANCE * 0.8 ? PALETTE.risk : PALETTE.warn

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PALETTE.bg, color: PALETTE.textMain }}>
      <AnimatePresence mode="wait">
        {gameState === 'menu' && (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center p-6">
            <h1 className="text-4xl font-bold mb-4 tracking-tight">Train Mirror</h1>
            <p className="text-base mb-8" style={{ color: PALETTE.textSubtle }}>Stay in rhythm with the lead train. Mirror its motion to keep sync.</p>
            <button onClick={startGame} className="px-6 py-3 rounded-xl" style={{ backgroundColor: '#1f2a3a', color: PALETTE.textMain }}>Start</button>
            <p className="mt-3 text-sm" style={{ color: PALETTE.textSubtle }}>↑ accelerate · ↓ brake · Space to start</p>
            <p className="mt-6 text-xs" style={{ color: PALETTE.textSubtle }}>🧠 Cognitive tracking enabled: Sensorimotor sync, rhythm perception, and adaptation measured!</p>
          </motion.div>
        )}

        {gameState === 'playing' && (
          <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
            <div className="mb-3" style={{ height: 26 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  margin: '0 auto',
                  borderRadius: '9999px',
                  transform: `scale(${beatScale})`,
                  transition: 'transform 120ms linear',
                  backgroundColor: beatColor,
                  boxShadow: perfect ? '0 0 20px rgba(94,138,107,0.45)' : '0 0 10px rgba(154,168,191,0.25)'
                }}
              />
            </div>

            <svg width={WIDTH} height={HEIGHT} className="rounded-xl">
              <rect x={PADDING_X} y={TRACK_Y_TOP - 4} width={WIDTH - PADDING_X * 2} height={8} fill={PALETTE.track} />
              <rect x={PADDING_X} y={TRACK_Y_BOTTOM - 4} width={WIDTH - PADDING_X * 2} height={8} fill={PALETTE.track} />

              <motion.rect x={leaderX - 40} y={TRACK_Y_TOP - 20} width={80} height={40} rx={6} fill={PALETTE.ai} />
              <motion.rect x={playerX - 40} y={TRACK_Y_BOTTOM - 20} width={80} height={40} rx={6} fill={PALETTE.player} />
            </svg>

            <div className="mt-5 text-center">
              <div className="text-lg font-semibold" style={{ color: trackColor }}>
                {dx <= SYNC_ZONE ? 'Perfect Sync' : dx > MAX_DISTANCE * 0.8 ? 'Drifting…' : 'Keep the rhythm'}
              </div>
              <div className="text-sm mt-1" style={{ color: PALETTE.textSubtle }}>
                Score: {Math.floor(score)} · Sync Time: {Math.floor(totalSyncTime.current)}s · Errors: {errorCount.current}
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'gameOver' && (
          <motion.div key="over" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
            <div className="relative z-10 text-center p-6 rounded-xl mb-6" style={{ backgroundColor: '#121826', boxShadow: '0 12px 50px rgba(0,0,0,0.45)' }}>
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#f1d7d6' }}>You lost sync</h3>
              <p className="text-sm mb-5" style={{ color: PALETTE.textSubtle }}>Final score: <span style={{ color: PALETTE.safe }}>{Math.floor(score)}</span></p>
              
              <div className="flex gap-3 mb-4">
                <button onClick={startGame} className="px-6 py-3 rounded-xl" style={{ backgroundColor: '#1f2a3a', color: PALETTE.textMain }}>Try Again</button>
                <button onClick={() => setShowMetrics(!showMetrics)} className="px-6 py-3 rounded-xl" style={{ backgroundColor: '#2a3347', color: PALETTE.textMain }}>
                  {showMetrics ? 'Hide' : 'Show'} Metrics
                </button>
                <button onClick={exportMetrics} className="px-6 py-3 rounded-xl" style={{ backgroundColor: PALETTE.safe, color: '#fff' }}>
                  Export JSON
                </button>
              </div>
              
              <p className="mt-3 text-xs" style={{ color: PALETTE.textSubtle }}>Press Space to restart</p>
            </div>

            {showMetrics && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl p-6 rounded-xl"
                style={{ backgroundColor: '#121826' }}
              >
                <h3 className="text-2xl font-bold mb-4 text-center" style={{ color: PALETTE.textMain }}>🧠 Cognitive Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#1f2a3a' }}>
                    <h4 className="font-semibold mb-2" style={{ color: PALETTE.safe }}>🎯 Sensorimotor Sync</h4>
                    <div style={{ color: PALETTE.textMain }}>Avg Phase Lag: {sessionData.sensoriomotorSync.averagePhaseLag.toFixed(1)}px</div>
                    <div style={{ color: PALETTE.textMain }}>Sync Accuracy: {sessionData.sensoriomotorSync.syncAccuracy.toFixed(0)}%</div>
                    <div style={{ color: PALETTE.textMain }}>Peak Duration: {(sessionData.sensoriomotorSync.peakSyncDuration / 1000).toFixed(1)}s</div>
                    <div style={{ color: PALETTE.textMain }}>Sync Rate: {sessionData.sensoriomotorSync.syncRate.toFixed(0)}%</div>
                  </div>
                  
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#1f2a3a' }}>
                    <h4 className="font-semibold mb-2" style={{ color: PALETTE.warn }}>👁️ Sustained Attention</h4>
                    <div style={{ color: PALETTE.textMain }}>Attention Score: {sessionData.sustainedAttention.attentionScore.toFixed(0)}%</div>
                    <div style={{ color: PALETTE.textMain }}>Focus Duration: {(sessionData.sustainedAttention.focusDuration / 1000).toFixed(1)}s</div>
                    <div style={{ color: PALETTE.textMain }}>Lapses: {sessionData.sustainedAttention.attentionLapses}</div>
                    <div style={{ color: PALETTE.textMain }}>Consistency: {sessionData.sustainedAttention.consistencyScore.toFixed(0)}%</div>
                  </div>
                  
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#1f2a3a' }}>
                    <h4 className="font-semibold mb-2" style={{ color: PALETTE.player }}>🎵 Rhythm Perception</h4>
                    <div style={{ color: PALETTE.textMain }}>Rhythm Accuracy: {sessionData.rhythmPerception.rhythmAccuracy.toFixed(0)}%</div>
                    <div style={{ color: PALETTE.textMain }}>Timing Precision: {sessionData.rhythmPerception.timingPrecision.toFixed(0)}%</div>
                    <div style={{ color: PALETTE.textMain }}>Anticipation: {sessionData.rhythmPerception.anticipationScore.toFixed(0)}%</div>
                    <div style={{ color: PALETTE.textMain }}>Beat Matching: {sessionData.rhythmPerception.beatMatchingQuality.toFixed(0)}%</div>
                  </div>
                  
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#1f2a3a' }}>
                    <h4 className="font-semibold mb-2" style={{ color: PALETTE.risk }}>⚠️ Error Monitoring</h4>
                    <div style={{ color: PALETTE.textMain }}>Total Errors: {sessionData.errorMonitoring.totalErrors}</div>
                    <div style={{ color: PALETTE.textMain }}>Recovery Time: {sessionData.errorMonitoring.errorRecoveryTime.toFixed(0)}ms</div>
                    <div style={{ color: PALETTE.textMain }}>Self-Correction: {sessionData.errorMonitoring.selfCorrectionRate.toFixed(0)}%</div>
                    <div style={{ color: PALETTE.textMain }}>Awareness: {sessionData.errorMonitoring.errorAwareness.toFixed(0)}%</div>
                  </div>
                  
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#1f2a3a' }}>
                    <h4 className="font-semibold mb-2" style={{ color: PALETTE.ai }}>⚡ Processing Speed</h4>
                    <div style={{ color: PALETTE.textMain }}>Avg Reaction: {sessionData.processingSpeed.averageReactionTime.toFixed(0)}ms</div>
                    <div style={{ color: PALETTE.textMain }}>Adaptation Speed: {sessionData.processingSpeed.adaptationSpeed.toFixed(0)}%</div>
                    <div style={{ color: PALETTE.textMain }}>Motor Response: {sessionData.processingSpeed.motorResponseTime.toFixed(0)}ms</div>
                    <div style={{ color: PALETTE.textMain }}>Flexibility: {sessionData.processingSpeed.cognitiveFlexibility.toFixed(0)}%</div>
                  </div>
                  
                  <div className="p-4 rounded-lg" style={{ backgroundColor: '#1f2a3a' }}>
                    <h4 className="font-semibold mb-2" style={{ color: PALETTE.textMain }}>📊 Summary</h4>
                    <div style={{ color: PALETTE.textMain }}>Final Score: {Math.floor(sessionData.finalScore)}</div>
                    <div style={{ color: PALETTE.textMain }}>Duration: {(sessionData.sessionDuration / 1000).toFixed(1)}s</div>
                    <div style={{ color: PALETTE.textMain }}>Total Sync: {(sessionData.sensoriomotorSync.totalSyncTime / 1000).toFixed(1)}s</div>
                    <div style={{ color: PALETTE.textMain }}>Motion Changes: {sessionData.detailedLogs.motionChanges.length}</div>
                  </div>
                </div>
                
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: '#1f2a3a' }}>
                  <h4 className="font-semibold mb-2 text-center" style={{ color: PALETTE.textMain }}>📈 Detailed Analysis</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
                    <div>
                      <div className="font-bold text-lg" style={{ color: PALETTE.safe }}>
                        {sessionData.detailedLogs.syncEvents.filter(e => e.inSync).length}
                      </div>
                      <div style={{ color: PALETTE.textSubtle }}>Sync Events</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg" style={{ color: PALETTE.warn }}>
                        {sessionData.detailedLogs.driftEvents.length}
                      </div>
                      <div style={{ color: PALETTE.textSubtle }}>Drift Events</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg" style={{ color: PALETTE.player }}>
                        {sessionData.detailedLogs.motionChanges.filter(m => m.playerResponse).length}
                      </div>
                      <div style={{ color: PALETTE.textSubtle }}>Successful Responses</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg" style={{ color: PALETTE.risk }}>
                        {sessionData.detailedLogs.adaptationEvents.length}
                      </div>
                      <div style={{ color: PALETTE.textSubtle }}>Adaptation Points</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
