"use client"

import React, { useRef, useEffect, useState } from "react"
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface Player {
  x: number
  y: number
  vy: number
  vx: number
  color: string
  health: number
  maxHealth: number
  controls?: { jump: string; shoot: string; left: string; right: string }
  facingRight: boolean
  shootCooldown: number
  lastPlatformId: string | null
  alive: boolean
  respawnTimer: number
  characterType: 'brain' | 'frog'
}

interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  owner: number
  bounces: number
  projectileType: 'normal' | 'frog'
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

interface Platform {
  x: number
  y: number
  width: number
  height: number
  hits: number
  maxHits: number
  ownerSide: 'left' | 'right' | 'neutral'
  id: string
  hasCoin?: boolean
}

interface Coin {
  x: number
  y: number
  platformId: string
  collected: boolean
  type: 'gold' | 'black' | 'heart'
}

interface ReactionTimeEvent {
  timestamp: number
  threatType: 'enemy_spawn' | 'projectile_incoming' | 'platform_collapse' | 'health_low'
  threatPosition: { x: number; y: number }
  responseTime: number
  responseType: 'jump' | 'shoot' | 'move' | 'none'
  playerPosition: { x: number; y: number }
  contextualLoad: number
}

interface MovementEvent {
  timestamp: number
  inputType: 'jump' | 'left' | 'right' | 'shoot'
  latency: number
  playerVelocity: { vx: number; vy: number }
  situationalContext: string
}

interface ShotAccuracy {
  timestamp: number
  shotPosition: { x: number; y: number }
  targetPosition: { x: number; y: number }
  distance: number
  hit: boolean
  aimDeviation: number
  timeSinceLastShot: number
  movementState: 'stationary' | 'moving' | 'jumping'
}

interface ModeSwitch {
  timestamp: number
  fromMode: 'offensive' | 'defensive' | 'neutral'
  toMode: 'offensive' | 'defensive' | 'neutral'
  switchLatency: number
  healthPercent: number
  enemyDistance: number
  reason: string
}

interface EnvironmentScan {
  timestamp: number
  coinCollected: boolean
  coinType?: 'gold' | 'black' | 'heart'
  timeSinceCoinSpawn: number
  platformsDestroyed: number
  heightGained: number
  scanEfficiency: number
}

interface SurvivalSegment {
  startTime: number
  endTime: number
  duration: number
  heightAchieved: number
  damageReceived: number
  damageDealt: number
  coinsCollected: number
  platformsDestroyed: number
  deaths: number
}

interface CognitiveLoadSnapshot {
  timestamp: number
  enemyDistance: number
  healthPercent: number
  hasAmmo: boolean
  platformStability: number
  heightPressure: number
  overallLoad: number
}

interface StrategicDecision {
  timestamp: number
  decisionType: 'coin_pursuit' | 'platform_destruction' | 'evasion' | 'engagement'
  contextualFactors: {
    health: number
    ammo: boolean
    enemyDistance: number
    platformCount: number
  }
  outcome: 'success' | 'failure' | 'neutral'
  decisionLatency: number
}

interface SessionData {
  sessionStart: number
  sessionEnd: number
  totalDuration: number
  maxHeight: number
  totalKills: number
  totalDeaths: number
  
  processingSpeed: {
    averageReactionTime: number
    fastestReaction: number
    slowestReaction: number
    reactionTimeProgression: number[]
  }
  
  spatialAwareness: {
    shotAccuracy: number
    averageAimDeviation: number
    environmentalScanEfficiency: number
    coinCollectionRate: number
    platformDestructionEfficiency: number
  }
  
  cognitiveFlexibility: {
    modeSwitches: number
    averageSwitchLatency: number
    adaptationScore: number
  }
  
  inhibitionControl: {
    impulsiveActions: number
    controlledActions: number
    inhibitionScore: number
  }
  
  strategicPlanning: {
    planningDepth: number
    decisionQuality: number
    resourceManagement: number
  }
  
  detailedLogs: {
    reactionTimes: ReactionTimeEvent[]
    movements: MovementEvent[]
    shotAccuracy: ShotAccuracy[]
    modeSwitches: ModeSwitch[]
    environmentScans: EnvironmentScan[]
    survivalSegments: SurvivalSegment[]
    cognitiveLoad: CognitiveLoadSnapshot[]
    strategicDecisions: StrategicDecision[]
  }
}

const BrainBattle: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [gameId, setGameId] = useState<number>(0)
  const [kills, setKills] = useState<number>(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [height, setHeight] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [canShoot, setCanShoot] = useState(false)
  const [shootTimeLeft, setShootTimeLeft] = useState(0)
  const [canShootBlack, setCanShootBlack] = useState(false)
  const [shootBlackTimeLeft, setShootBlackTimeLeft] = useState(0)
  const [aiCharacterType, setAiCharacterType] = useState<'brain' | 'frog'>('brain')
  const [aiAlive, setAiAlive] = useState(true)
  const [showMetrics, setShowMetrics] = useState(false)
  const [message, setMessage] = useState<string>('')

  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')

  // Cognitive Tracking State
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionStart: Date.now(),
    sessionEnd: 0,
    totalDuration: 0,
    maxHeight: 0,
    totalKills: 0,
    totalDeaths: 0,
    processingSpeed: {
      averageReactionTime: 0,
      fastestReaction: 0,
      slowestReaction: 0,
      reactionTimeProgression: []
    },
    spatialAwareness: {
      shotAccuracy: 0,
      averageAimDeviation: 0,
      environmentalScanEfficiency: 0,
      coinCollectionRate: 0,
      platformDestructionEfficiency: 0
    },
    cognitiveFlexibility: {
      modeSwitches: 0,
      averageSwitchLatency: 0,
      adaptationScore: 0
    },
    inhibitionControl: {
      impulsiveActions: 0,
      controlledActions: 0,
      inhibitionScore: 0
    },
    strategicPlanning: {
      planningDepth: 0,
      decisionQuality: 0,
      resourceManagement: 0
    },
    detailedLogs: {
      reactionTimes: [],
      movements: [],
      shotAccuracy: [],
      modeSwitches: [],
      environmentScans: [],
      survivalSegments: [],
      cognitiveLoad: [],
      strategicDecisions: []
    }
  })

  // Cognitive tracking refs
  const lastInputTime = useRef<number>(Date.now())
  const lastThreatTime = useRef<number>(0)
  const lastThreatPosition = useRef<{ x: number; y: number } | null>(null)
  const lastShotTime = useRef<number>(0)
  const currentMode = useRef<'offensive' | 'defensive' | 'neutral'>('neutral')
  const lastModeChangeTime = useRef<number>(Date.now())
  const coinSpawnTimes = useRef<Map<string, number>>(new Map())
  const currentSurvivalSegment = useRef<SurvivalSegment>({
    startTime: Date.now(),
    endTime: 0,
    duration: 0,
    heightAchieved: 0,
    damageReceived: 0,
    damageDealt: 0,
    coinsCollected: 0,
    platformsDestroyed: 0,
    deaths: 0
  })

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)
        loadUserStats(user.uid)
      } else {
        setUserId(null)
        setUserStats(null)
      }
    })
    return () => unsubscribe()
  }, [])

  // Load user stats from Firestore
  const loadUserStats = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid)
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          if (data.brainBattle) {
            setUserStats(data.brainBattle)
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  // Helper function to calculate running average
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  // Save session data to Firestore
  const saveSessionToFirebase = async () => {
    const now = Date.now()
    
    // Calculate aggregated metrics
    const reactionTimes = sessionData.detailedLogs.reactionTimes.map(r => r.responseTime)
    const shotAccuracy = sessionData.detailedLogs.shotAccuracy
    const hits = shotAccuracy.filter(s => s.hit).length
    const totalShots = shotAccuracy.length
    
    const finalData = {
      sessionEnd: now,
      totalDuration: now - sessionData.sessionStart,
      maxHeight: height,
      totalKills: kills,
      
      processingSpeed: {
        averageReactionTime: reactionTimes.length > 0 
          ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length 
          : 0,
        fastestReaction: reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0,
        slowestReaction: reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0,
        reactionTimeProgression: reactionTimes
      },
      
      spatialAwareness: {
        shotAccuracy: totalShots > 0 ? (hits / totalShots) * 100 : 0,
        averageAimDeviation: shotAccuracy.length > 0
          ? shotAccuracy.reduce((sum, s) => sum + Math.abs(s.aimDeviation), 0) / shotAccuracy.length
          : 0,
        environmentalScanEfficiency: sessionData.detailedLogs.environmentScans.length > 0
          ? sessionData.detailedLogs.environmentScans
              .filter(e => e.coinCollected)
              .reduce((sum, e) => sum + e.scanEfficiency, 0) / 
            Math.max(sessionData.detailedLogs.environmentScans.filter(e => e.coinCollected).length, 1)
          : 0,
        coinCollectionRate: sessionData.detailedLogs.environmentScans.filter(e => e.coinCollected).length,
        platformDestructionEfficiency: currentSurvivalSegment.current.platformsDestroyed
      },
      
      cognitiveFlexibility: {
        modeSwitches: sessionData.detailedLogs.modeSwitches.length,
        averageSwitchLatency: sessionData.detailedLogs.modeSwitches.length > 0
          ? sessionData.detailedLogs.modeSwitches.reduce((sum, m) => sum + m.switchLatency, 0) / 
            sessionData.detailedLogs.modeSwitches.length
          : 0,
        adaptationScore: sessionData.detailedLogs.modeSwitches.length / 
          Math.max(1, (now - sessionData.sessionStart) / 60000)
      },
      
      inhibitionControl: {
        impulsiveActions: sessionData.detailedLogs.movements.filter(m => m.latency < 200).length,
        controlledActions: sessionData.detailedLogs.movements.filter(m => m.latency >= 200).length,
        inhibitionScore: sessionData.detailedLogs.movements.length > 0
          ? sessionData.detailedLogs.movements.filter(m => m.latency >= 200).length / 
            sessionData.detailedLogs.movements.length * 100
          : 0
      },
      
      strategicPlanning: {
        planningDepth: sessionData.detailedLogs.strategicDecisions.length,
        decisionQuality: sessionData.detailedLogs.strategicDecisions.length > 0
          ? sessionData.detailedLogs.strategicDecisions.filter(d => d.outcome === 'success').length /
            sessionData.detailedLogs.strategicDecisions.length * 100
          : 0,
        resourceManagement: currentSurvivalSegment.current.coinsCollected / 
          Math.max(1, (now - sessionData.sessionStart) / 60000)
      },
      
      detailedLogs: sessionData.detailedLogs
    }

    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('brainBattleSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('brainBattleSessions', JSON.stringify(updatedSessions))
      setMessage('💾 Saved to local storage')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      // Update user's game stats
      await setDoc(userDocRef, {
        brainBattle: {
          bestHeight: Math.max(height, userStats?.bestHeight || 0),
          bestKills: Math.max(kills, userStats?.bestKills || 0),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalKills: (userStats?.totalKills || 0) + kills,
          averageReactionTime: calculateRunningAverage(
            userStats?.averageReactionTime || 0,
            userStats?.totalSessionsPlayed || 0,
            finalData.processingSpeed.averageReactionTime
          ),
          averageShotAccuracy: calculateRunningAverage(
            userStats?.averageShotAccuracy || 0,
            userStats?.totalSessionsPlayed || 0,
            finalData.spatialAwareness.shotAccuracy
          ),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), finalData].slice(-10),
          cognitiveProfile: {
            processingSpeed: finalData.processingSpeed.averageReactionTime,
            spatialAwareness: finalData.spatialAwareness.shotAccuracy,
            cognitiveFlexibility: finalData.cognitiveFlexibility.adaptationScore,
            inhibitionControl: finalData.inhibitionControl.inhibitionScore,
            strategicPlanning: finalData.strategicPlanning.decisionQuality
          }
        }
      }, { merge: true })

      await addDoc(collection(db, 'users', userId, 'brainBattleSessions'), {
        gameType: 'brainBattle',
        ...finalData,
        createdAt: new Date()
      })

      console.log('🧠 Brain Battle session saved successfully')
      setMessage('✅ Session saved to cloud!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data. Your progress may not be synced.')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('brainBattleSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('brainBattleSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const logReactionTime = (
    threatType: ReactionTimeEvent['threatType'],
    threatPos: { x: number; y: number },
    playerPos: { x: number; y: number },
    responseType: ReactionTimeEvent['responseType'],
    contextLoad: number
  ) => {
    const now = Date.now()
    const reactionTime = now - lastThreatTime.current
    
    if (reactionTime < 5000 && reactionTime > 0) {
      const event: ReactionTimeEvent = {
        timestamp: now,
        threatType,
        threatPosition: threatPos,
        responseTime: reactionTime,
        responseType,
        playerPosition: playerPos,
        contextualLoad: contextLoad
      }
      
      setSessionData(prev => ({
        ...prev,
        detailedLogs: {
          ...prev.detailedLogs,
          reactionTimes: [...prev.detailedLogs.reactionTimes, event]
        }
      }))
    }
  }

  const logMovement = (
    inputType: MovementEvent['inputType'],
    velocity: { vx: number; vy: number },
    context: string
  ) => {
    const now = Date.now()
    const latency = now - lastInputTime.current
    
    const event: MovementEvent = {
      timestamp: now,
      inputType,
      latency,
      playerVelocity: velocity,
      situationalContext: context
    }
    
    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        movements: [...prev.detailedLogs.movements, event]
      }
    }))
    
    lastInputTime.current = now
  }

  const logShotAccuracy = (
    shotPos: { x: number; y: number },
    targetPos: { x: number; y: number },
    hit: boolean,
    movementState: ShotAccuracy['movementState']
  ) => {
    const now = Date.now()
    const distance = Math.sqrt(
      Math.pow(targetPos.x - shotPos.x, 2) + 
      Math.pow(targetPos.y - shotPos.y, 2)
    )
    
    const aimDeviation = Math.atan2(
      targetPos.y - shotPos.y,
      targetPos.x - shotPos.x
    )
    
    const event: ShotAccuracy = {
      timestamp: now,
      shotPosition: shotPos,
      targetPosition: targetPos,
      distance,
      hit,
      aimDeviation,
      timeSinceLastShot: now - lastShotTime.current,
      movementState
    }
    
    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        shotAccuracy: [...prev.detailedLogs.shotAccuracy, event]
      }
    }))
    
    lastShotTime.current = now
  }

  const logModeSwitch = (
    newMode: 'offensive' | 'defensive' | 'neutral',
    healthPercent: number,
    enemyDistance: number,
    reason: string
  ) => {
    const now = Date.now()
    
    if (newMode !== currentMode.current) {
      const event: ModeSwitch = {
        timestamp: now,
        fromMode: currentMode.current,
        toMode: newMode,
        switchLatency: now - lastModeChangeTime.current,
        healthPercent,
        enemyDistance,
        reason
      }
      
      setSessionData(prev => ({
        ...prev,
        detailedLogs: {
          ...prev.detailedLogs,
          modeSwitches: [...prev.detailedLogs.modeSwitches, event]
        }
      }))
      
      currentMode.current = newMode
      lastModeChangeTime.current = now
    }
  }

  const logEnvironmentScan = (
    coinCollected: boolean,
    coinType: 'gold' | 'black' | 'heart' | undefined,
    platformId: string,
    platformsDestroyed: number,
    heightGained: number
  ) => {
    const now = Date.now()
    const spawnTime = coinSpawnTimes.current.get(platformId) || now
    
    const event: EnvironmentScan = {
      timestamp: now,
      coinCollected,
      coinType,
      timeSinceCoinSpawn: now - spawnTime,
      platformsDestroyed,
      heightGained,
      scanEfficiency: coinCollected ? (5000 / (now - spawnTime)) : 0
    }
    
    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        environmentScans: [...prev.detailedLogs.environmentScans, event]
      }
    }))
  }

  const logCognitiveLoad = (
    enemyDistance: number,
    healthPercent: number,
    hasAmmo: boolean,
    platformStability: number,
    heightPressure: number
  ) => {
    const now = Date.now()
    
    const overallLoad = 
      (1 - healthPercent) * 30 +
      (enemyDistance < 200 ? 25 : 0) +
      (hasAmmo ? 0 : 15) +
      (platformStability < 0.5 ? 20 : 0) +
      heightPressure * 10
    
    const snapshot: CognitiveLoadSnapshot = {
      timestamp: now,
      enemyDistance,
      healthPercent,
      hasAmmo,
      platformStability,
      heightPressure,
      overallLoad
    }
    
    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        cognitiveLoad: [...prev.detailedLogs.cognitiveLoad, snapshot]
      }
    }))
  }

  const exportSessionData = () => {
    saveSessionToFirebase()
    
    const now = Date.now()
    const reactionTimes = sessionData.detailedLogs.reactionTimes.map(r => r.responseTime)
    const shotAccuracy = sessionData.detailedLogs.shotAccuracy
    const hits = shotAccuracy.filter(s => s.hit).length
    const totalShots = shotAccuracy.length
    
    const finalData = {
      ...sessionData,
      sessionEnd: now,
      totalDuration: now - sessionData.sessionStart,
      maxHeight: height,
      totalKills: kills,
      
      processingSpeed: {
        averageReactionTime: reactionTimes.length > 0 
          ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length 
          : 0,
        fastestReaction: reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0,
        slowestReaction: reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0,
        reactionTimeProgression: reactionTimes
      },
      
      spatialAwareness: {
        shotAccuracy: totalShots > 0 ? (hits / totalShots) * 100 : 0,
        averageAimDeviation: shotAccuracy.length > 0
          ? shotAccuracy.reduce((sum, s) => sum + Math.abs(s.aimDeviation), 0) / shotAccuracy.length
          : 0,
        environmentalScanEfficiency: sessionData.detailedLogs.environmentScans.length > 0
          ? sessionData.detailedLogs.environmentScans
              .filter(e => e.coinCollected)
              .reduce((sum, e) => sum + e.scanEfficiency, 0) / 
            Math.max(sessionData.detailedLogs.environmentScans.filter(e => e.coinCollected).length, 1)
          : 0,
        coinCollectionRate: sessionData.detailedLogs.environmentScans.filter(e => e.coinCollected).length,
        platformDestructionEfficiency: currentSurvivalSegment.current.platformsDestroyed
      },
      
      cognitiveFlexibility: {
        modeSwitches: sessionData.detailedLogs.modeSwitches.length,
        averageSwitchLatency: sessionData.detailedLogs.modeSwitches.length > 0
          ? sessionData.detailedLogs.modeSwitches.reduce((sum, m) => sum + m.switchLatency, 0) / 
            sessionData.detailedLogs.modeSwitches.length
          : 0,
        adaptationScore: sessionData.detailedLogs.modeSwitches.length / 
          Math.max(1, (now - sessionData.sessionStart) / 60000)
      },
      
      inhibitionControl: {
        impulsiveActions: sessionData.detailedLogs.movements.filter(m => m.latency < 200).length,
        controlledActions: sessionData.detailedLogs.movements.filter(m => m.latency >= 200).length,
        inhibitionScore: sessionData.detailedLogs.movements.length > 0
          ? sessionData.detailedLogs.movements.filter(m => m.latency >= 200).length / 
            sessionData.detailedLogs.movements.length * 100
          : 0
      },
      
      strategicPlanning: {
        planningDepth: sessionData.detailedLogs.strategicDecisions.length,
        decisionQuality: sessionData.detailedLogs.strategicDecisions.length > 0
          ? sessionData.detailedLogs.strategicDecisions.filter(d => d.outcome === 'success').length /
            sessionData.detailedLogs.strategicDecisions.length * 100
          : 0,
        resourceManagement: currentSurvivalSegment.current.coinsCollected / 
          Math.max(1, (now - sessionData.sessionStart) / 60000)
      }
    }
    
    const dataStr = JSON.stringify(finalData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `brain-battle-session-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    
    console.log("🧠 Brain Battle Cognitive Metrics Exported:", finalData)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    
    const gravity = 0.4
    const canvasHeight = 480
    const mid = canvas.width / 2
    let cameraY = 0
    let currentHeight = 0
    const scrollSpeed = 0.4

    const players: Player[] = [
      { 
        x: 120, y: 400, vy: 0, vx: 0, color: "#ef4444", 
        health: 100, maxHealth: 100, facingRight: true, shootCooldown: 0,
        lastPlatformId: null, alive: true, respawnTimer: 0, characterType: 'brain'
      },
      { 
        x: 520, y: 400, vy: 0, vx: 0, color: "#3b82f6", 
        health: 100, maxHealth: 100, facingRight: false, shootCooldown: 0,
        controls: { jump: "ArrowUp", shoot: " ", left: "ArrowLeft", right: "ArrowRight" },
        lastPlatformId: null, alive: true, respawnTimer: 0, characterType: 'brain'
      },
    ]
    
    const projectiles: Projectile[] = []
    const particles: Particle[] = []
    const keys: Record<string, boolean> = {}
    const coins: Coin[] = []

    const platforms: Platform[] = []
    const segmentWidth = 60
    
    const generatePlatforms = (startY: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const y = startY - (i * 50)
        
        const leftPlatformCount = 1 + Math.floor(Math.random() * 3)
        const rightPlatformCount = 1 + Math.floor(Math.random() * 3)
        
        const leftPositions: number[] = []
        for (let j = 0; j < leftPlatformCount; j++) {
          let attempts = 0
          let validPosition = false
          let leftX = 0
          
          while (!validPosition && attempts < 20) {
            leftX = Math.random() * (mid - segmentWidth - 40) + 20
            validPosition = leftPositions.every(pos => Math.abs(pos - leftX) > segmentWidth + 20)
            attempts++
          }
          
          if (validPosition) {
            leftPositions.push(leftX)
            const hasCoin = Math.random() < 0.05
            const coinRoll = Math.random()
            const coinType: 'gold' | 'black' | 'heart' = 
              coinRoll < 0.20 ? 'heart' : (coinRoll < 0.55 ? 'gold' : 'black')
            const platformId = `left-${y}-${leftX}-${i}-${j}`
            platforms.push({ 
              x: leftX, y, width: segmentWidth, height: 15, 
              hits: 0, maxHits: 3, ownerSide: 'left',
              id: platformId,
              hasCoin
            })
            
            if (hasCoin) {
              coins.push({
                x: leftX + segmentWidth / 2,
                y: y - 20,
                platformId,
                collected: false,
                type: coinType
              })
              coinSpawnTimes.current.set(platformId, Date.now())
            }
          }
        }
        
        const rightPositions: number[] = []
        for (let j = 0; j < rightPlatformCount; j++) {
          let attempts = 0
          let validPosition = false
          let rightX = 0
          
          while (!validPosition && attempts < 20) {
            rightX = mid + Math.random() * (mid - segmentWidth - 40) + 20
            validPosition = rightPositions.every(pos => Math.abs(pos - rightX) > segmentWidth + 20)
            attempts++
          }
          
          if (validPosition) {
            rightPositions.push(rightX)
            const hasCoin = Math.random() < 0.12
            const coinRoll = Math.random()
            const coinType: 'gold' | 'black' | 'heart' = 
              coinRoll < 0.20 ? 'heart' : (coinRoll < 0.55 ? 'gold' : 'black')
            const platformId = `right-${y}-${rightX}-${i}-${j}`
            platforms.push({ 
              x: rightX, y, width: segmentWidth, height: 15, 
              hits: 0, maxHits: 3, ownerSide: 'right',
              id: platformId,
              hasCoin
            })
            
            if (hasCoin) {
              coins.push({
                x: rightX + segmentWidth / 2,
                y: y - 20,
                platformId,
                collected: false,
                type: coinType
              })
              coinSpawnTimes.current.set(platformId, Date.now())
            }
          }
        }
      }
    }

    let x = 0
    while (x < canvas.width) {
      platforms.push({ 
        x, y: 450, width: segmentWidth, height: 50, 
        hits: 0, maxHits: 999, ownerSide: 'neutral',
        id: `floor-${x}`
      })
      x += segmentWidth
    }
    
    generatePlatforms(330, 100)

    const keyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      keys[e.key] = true
    }
    const keyUp = (e: KeyboardEvent) => {
      e.preventDefault()
      keys[e.key] = false
    }
    window.addEventListener("keydown", keyDown)
    window.addEventListener("keyup", keyUp)

    let running = true
    let aiCooldown = 0
    let aiJumpCooldown = 0
    let aiStrategyTimer = 0
    let aiStrategy: 'aggressive' | 'defensive' | 'tricky' = 'aggressive'
    let playerShootTimer = 0
    let playerShootBlackTimer = 0
    let cognitiveLoadTimer = 0

    const respawnAI = () => {
      const ai = players[0]
      ai.alive = true
      ai.health = 100
      ai.x = 120
      ai.y = cameraY + 200
      ai.vy = 0
      ai.vx = 0
      ai.respawnTimer = 0
      ai.shootCooldown = 30
      
      ai.characterType = Math.random() < 0.5 ? 'brain' : 'frog'
      ai.color = ai.characterType === 'brain' ? '#ef4444' : '#22c55e'
      setAiCharacterType(ai.characterType)
      setAiAlive(true)
      
      lastThreatTime.current = Date.now()
      lastThreatPosition.current = { x: ai.x, y: ai.y }
      
      createExplosion(ai.x + 20, ai.y - 20, '#10b981')
    }

    const createExplosion = (x: number, y: number, color: string) => {
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 4
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 30 + Math.random() * 20,
          color
        })
      }
    }

    const drawBrain = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, facingRight: boolean, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x + 20, y - 20)
      if (!facingRight) ctx.scale(-1, 1)
      
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(0, -2, 20, 24, 0, 0, Math.PI * 2)
      ctx.fill()
      
      const gradient = ctx.createRadialGradient(-5, -5, 5, 0, 0, 25)
      gradient.addColorStop(0, 'rgba(255,255,255,0.3)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.2)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.ellipse(0, -2, 20, 24, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(0, -22)
      ctx.lineTo(0, 8)
      ctx.stroke()
      
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      
      for (let side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(side * 15, -5)
        ctx.bezierCurveTo(side * 12, -8, side * 8, -10, side * 3, -8)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 12, -18)
        ctx.bezierCurveTo(side * 10, -12, side * 8, -8, side * 6, -2)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 8, -20)
        ctx.bezierCurveTo(side * 6, -16, side * 5, -12, side * 4, -8)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 16, -12)
        ctx.bezierCurveTo(side * 14, -10, side * 12, -8, side * 10, -6)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 14, -16)
        ctx.bezierCurveTo(side * 12, -14, side * 10, -12, side * 8, -10)
        ctx.stroke()
        
        ctx.beginPath()
        ctx.moveTo(side * 12, 2)
        ctx.bezierCurveTo(side * 10, 4, side * 8, 5, side * 5, 5)
        ctx.stroke()
      }
      
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'
      
      for (let i = 0; i < 6; i++) {
        const offsetX = (i % 2 === 0 ? -1 : 1) * (8 + Math.random() * 8)
        const offsetY = -18 + i * 6
        ctx.beginPath()
        ctx.arc(offsetX, offsetY, 3 + Math.random() * 2, 0, Math.PI)
        ctx.stroke()
      }
      
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.ellipse(0, 20, 6, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(-7, 0, 4.5, 0, Math.PI * 2)
      ctx.arc(7, 0, 4.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(-6, -1, 1.5, 0, Math.PI * 2)
      ctx.arc(8, -1, 1.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'black'
      ctx.beginPath()
      ctx.arc(-6, 1, 2.5, 0, Math.PI * 2)
      ctx.arc(8, 1, 2.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.restore()
    }

    const drawFrog = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, facingRight: boolean, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x + 20, y - 20)
      if (!facingRight) ctx.scale(-1, 1)
      
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2)
      ctx.fill()
      
      const gradient = ctx.createRadialGradient(-5, -5, 5, 0, 0, 20)
      gradient.addColorStop(0, 'rgba(255,255,255,0.3)')
      gradient.addColorStop(1, 'rgba(0,0,0,0.15)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.ellipse(0, 0, 18, 16, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(-10, -8, 6, 7, 0, 0, Math.PI * 2)
      ctx.ellipse(10, -8, 6, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'white'
      ctx.beginPath()
      ctx.arc(-10, -10, 5, 0, Math.PI * 2)
      ctx.arc(10, -10, 5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.beginPath()
      ctx.arc(-9, -11, 2, 0, Math.PI * 2)
      ctx.arc(11, -11, 2, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'black'
      ctx.beginPath()
      ctx.arc(-9, -9, 3, 0, Math.PI * 2)
      ctx.arc(11, -9, 3, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(0, 2, 6, 0, Math.PI)
      ctx.stroke()
      
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.ellipse(-18, 8, 8, 5, -0.3, 0, Math.PI * 2)
      ctx.ellipse(18, 8, 8, 5, 0.3, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.restore()
    }

    const gameLoop = () => {
      if (!running) return

      cameraY -= scrollSpeed
      currentHeight = Math.floor(-cameraY / 10)
      setHeight(currentHeight)
      
      cognitiveLoadTimer++
      if (cognitiveLoadTimer >= 60) {
        const player = players[1]
        const enemy = players[0]
        const distance = Math.sqrt(
          Math.pow(enemy.x - player.x, 2) + 
          Math.pow(enemy.y - player.y, 2)
        )
        
        const visiblePlatforms = platforms.filter(p => {
          const screenY = p.y - cameraY
          return screenY > canvasHeight * 0.4 && screenY < canvasHeight
        })
        
        const playerPlatforms = visiblePlatforms.filter(p => 
          p.ownerSide === 'right' && p.hits < p.maxHits
        )
        
        logCognitiveLoad(
          distance,
          player.health / player.maxHealth,
          canShoot || canShootBlack,
          playerPlatforms.length / Math.max(visiblePlatforms.length, 1),
          currentHeight / 100
        )
        
        cognitiveLoadTimer = 0
      }
      
      if (playerShootTimer > 0) {
        playerShootTimer--
        setShootTimeLeft(Math.ceil(playerShootTimer / 60))
        setCanShoot(true)
      } else {
        setCanShoot(false)
        setShootTimeLeft(0)
      }

      if (playerShootBlackTimer > 0) {
        playerShootBlackTimer--
        setShootBlackTimeLeft(Math.ceil(playerShootBlackTimer / 60))
        setCanShootBlack(true)
      } else {
        setCanShootBlack(false)
        setShootBlackTimeLeft(0)
      }

      const lowestPlatform = platforms.reduce((min, p) => Math.min(min, p.y), 0)
      if (lowestPlatform > cameraY - 3500) {
        generatePlatforms(lowestPlatform, 100)
      }

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, '#1e1b4b')
      gradient.addColorStop(0.5, '#4c1d95')
      gradient.addColorStop(1, '#000000')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.shadowBlur = 20
      ctx.shadowColor = '#8b5cf6'
      ctx.fillStyle = '#8b5cf6'
      ctx.fillRect(mid - 2, 0, 4, canvas.height)
      ctx.shadowBlur = 0

      ctx.save()
      ctx.translate(0, -cameraY)

      platforms.forEach(platform => {
        const screenY = platform.y - cameraY
        
        if (screenY > canvasHeight * 0.4 && screenY < canvasHeight + 100) {
          const damagePercent = platform.hits / platform.maxHits
          
          ctx.fillStyle = 'rgba(0,0,0,0.3)'
          ctx.fillRect(platform.x + 2, platform.y + 2, platform.width, platform.height)
          
          const platGradient = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.height)
          
          if (platform.ownerSide === 'left') {
            if (damagePercent < 0.33) {
              platGradient.addColorStop(0, '#ef4444')
              platGradient.addColorStop(1, '#dc2626')
            } else if (damagePercent < 0.67) {
              platGradient.addColorStop(0, '#f97316')
              platGradient.addColorStop(1, '#ea580c')
            } else {
              platGradient.addColorStop(0, '#991b1b')
              platGradient.addColorStop(1, '#7f1d1d')
            }
          } else if (platform.ownerSide === 'right') {
            if (damagePercent < 0.33) {
              platGradient.addColorStop(0, '#3b82f6')
              platGradient.addColorStop(1, '#2563eb')
            } else if (damagePercent < 0.67) {
              platGradient.addColorStop(0, '#0ea5e9')
              platGradient.addColorStop(1, '#0284c7')
            } else {
              platGradient.addColorStop(0, '#1e3a8a')
              platGradient.addColorStop(1, '#1e40af')
            }
          } else {
            platGradient.addColorStop(0, '#6366f1')
            platGradient.addColorStop(1, '#4338ca')
          }
          
          ctx.fillStyle = platGradient
          ctx.fillRect(platform.x, platform.y, platform.width, platform.height)
          
          ctx.fillStyle = 'rgba(255,255,255,0.2)'
          ctx.fillRect(platform.x, platform.y, platform.width, 3)
          
          ctx.strokeStyle = damagePercent > 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.3)'
          ctx.lineWidth = 1
          ctx.strokeRect(platform.x, platform.y, platform.width, platform.height)
          
          if (damagePercent > 0.33) {
            ctx.strokeStyle = 'rgba(0,0,0,0.5)'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(platform.x + platform.width * 0.5, platform.y)
            ctx.lineTo(platform.x + platform.width * 0.5, platform.y + platform.height)
            ctx.stroke()
          }
          if (damagePercent > 0.67) {
            ctx.beginPath()
            ctx.moveTo(platform.x + platform.width * 0.3, platform.y)
            ctx.lineTo(platform.x + platform.width * 0.3, platform.y + platform.height)
            ctx.moveTo(platform.x + platform.width * 0.7, platform.y)
            ctx.lineTo(platform.x + platform.width * 0.7, platform.y + platform.height)
            ctx.stroke()
          }
        }
      })

      particles.forEach((p, idx) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.3
        p.life--
        
        if (p.life <= 0) {
          particles.splice(idx, 1)
        } else {
          ctx.globalAlpha = p.life / 50
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      })

      players.forEach((p, i) => {
        if (!p.alive) {
          p.respawnTimer++
          if (i === 0) {
            setAiAlive(false)
            if (p.respawnTimer >= 600) {
              respawnAI()
            }
          }
          return
        }

        p.vy += gravity
        p.y += p.vy
        p.x += p.vx
        p.vx *= 0.85
        
        const screenTop = cameraY + 40
        if (p.y < screenTop) {
          p.y = screenTop
          p.vy = Math.max(0, p.vy)
        }
        
        let onPlatform = false
        let currentPlatformId: string | null = null
        
        platforms.forEach((platform, platIdx) => {
          const screenY = platform.y - cameraY
          
          if (screenY > canvasHeight * 0.4 && screenY < canvasHeight) {
            if (
              p.x + 40 > platform.x &&
              p.x < platform.x + platform.width &&
              p.y > platform.y - 40 &&
              p.y < platform.y + platform.height &&
              p.vy >= 0
            ) {
              p.y = platform.y
              p.vy = 0
              onPlatform = true
              currentPlatformId = platform.id
              
              if (p.lastPlatformId !== platform.id && platform.maxHits < 999) {
                platform.hits++
                
                if (i === 1 && platform.ownerSide === 'right' && platform.hits >= platform.maxHits - 1) {
                  lastThreatTime.current = Date.now()
                  lastThreatPosition.current = { x: platform.x, y: platform.y }
                }
                
                if (platform.hits >= platform.maxHits) {
                  createExplosion(platform.x + platform.width / 2, platform.y, platform.ownerSide === 'left' ? '#ef4444' : '#3b82f6')
                  platforms.splice(platIdx, 1)
                  currentPlatformId = null
                  
                  if (i === 0) {
                    currentSurvivalSegment.current.platformsDestroyed++
                  }
                }
              }
            }
          }
        })
        
        if (onPlatform) {
          p.lastPlatformId = currentPlatformId
        } else {
          p.lastPlatformId = null
        }

        if (p.y > cameraY + canvasHeight) {
          const oldHealth = p.health
          p.health = 0
          p.alive = false
          p.respawnTimer = 0
          createExplosion(p.x + 20, p.y - 20, p.color)
          
          if (i === 0) {
            setKills(k => k + 1)
            currentSurvivalSegment.current.damageDealt += oldHealth
          } else {
            running = false
            setGameOver(true)
            currentSurvivalSegment.current.deaths++
          }
        }

        if (i === 1 && p.alive) {
          coins.forEach((coin) => {
            if (!coin.collected && 
                Math.abs(p.x + 20 - coin.x) < 25 &&
                Math.abs(p.y - 20 - coin.y) < 25) {
              coin.collected = true
              currentSurvivalSegment.current.coinsCollected++
              
              logEnvironmentScan(
                true,
                coin.type,
                coin.platformId,
                currentSurvivalSegment.current.platformsDestroyed,
                currentHeight
              )
              
              if (coin.type === 'gold') {
                playerShootTimer = 600
                createExplosion(coin.x, coin.y, '#fbbf24')
              } else if (coin.type === 'black') {
                playerShootBlackTimer = 600
                createExplosion(coin.x, coin.y, '#1f2937')
              } else if (coin.type === 'heart') {
                p.health = Math.min(p.maxHealth, p.health + p.maxHealth * 0.1)
                createExplosion(coin.x, coin.y, '#ec4899')
              }
            }
          })
        }

        if (p.shootCooldown > 0) p.shootCooldown--

        if (i === 0 && p.alive) {
          const target = players[1]
          if (!target.alive) {
            if (Math.random() < 0.05) {
              p.vx += (Math.random() - 0.5) * 1.0
            }
          } else {
            const distance = Math.abs(target.x - p.x)
            const verticalDistance = target.y - p.y
            
            aiStrategyTimer++
            if (aiStrategyTimer > 180) {
              const strategies: ('aggressive' | 'defensive' | 'tricky')[] = ['aggressive', 'defensive', 'tricky']
              aiStrategy = strategies[Math.floor(Math.random() * strategies.length)]
              aiStrategyTimer = 0
            }

            let targetPlatform = null
            let bestScore = -Infinity
            
            const visiblePlatforms = platforms.filter(platform => {
              const screenY = platform.y - cameraY
              return screenY > canvasHeight * 0.4 && screenY < canvasHeight
            })
            
            const floorsByY = new Map<number, Platform[]>()
            visiblePlatforms.forEach(platform => {
              if (!floorsByY.has(platform.y)) {
                floorsByY.set(platform.y, [])
              }
              floorsByY.get(platform.y)!.push(platform)
            })
            
            floorsByY.forEach((segments, floorY) => {
              if (floorY < p.y - 20) {
                const leftSegments = segments.filter(seg => seg.x < mid && seg.ownerSide === 'left')
                
                if (leftSegments.length > 0) {
                  let closestSegment = null
                  let minDist = Infinity
                  
                  leftSegments.forEach(seg => {
                    const segCenterX = seg.x + seg.width / 2
                    const dist = Math.abs(segCenterX - p.x)
                    if (dist < minDist) {
                      minDist = dist
                      closestSegment = seg
                    }
                  })
                  
                  if (closestSegment) {
                    const verticalDist = p.y - floorY
                    const horizontalDist = minDist
                    
                    let score = verticalDist * 1.5
                    score -= horizontalDist * 0.5
                    score += leftSegments.length * 10
                    
                    if (score > bestScore) {
                      bestScore = score
                      targetPlatform = closestSegment
                    }
                  }
                }
              }
            })

            if (targetPlatform) {
              targetPlatform = targetPlatform as Platform
              const platformCenterX = targetPlatform.x + targetPlatform.width / 2
              const horizontalOffset = platformCenterX - p.x
              const platformAbove = targetPlatform.y < p.y - 20
              
              if (Math.abs(horizontalOffset) > 10) {
                const moveSpeed = 0.6
                p.vx += horizontalOffset > 0 ? moveSpeed : -moveSpeed
              }
              
              if (onPlatform && aiJumpCooldown <= 0 && platformAbove) {
                const isAligned = Math.abs(horizontalOffset) < 60
                const shouldJumpUrgently = verticalDistance < -120
                
                if (isAligned || shouldJumpUrgently) {
                  p.vy = -10.5
                  aiJumpCooldown = 15
                  
                  if (Math.abs(horizontalOffset) > 20) {
                    p.vx += horizontalOffset > 0 ? 1.2 : -1.2
                  }
                }
              }
            } else {
              if (Math.random() < 0.1) {
                p.vx += (Math.random() - 0.5) * 1.0
              }
              
              if (onPlatform && aiJumpCooldown <= 0 && verticalDistance < -150) {
                p.vy = -10.5
                aiJumpCooldown = 20
              }
            }

            p.facingRight = target.x > p.x
            aiJumpCooldown--

            if (aiCooldown <= 0 && p.shootCooldown <= 0) {
              const inCombatRange = distance < 300 && Math.abs(verticalDistance) < 180
              
              const shouldShoot = 
                (inCombatRange && Math.random() < 0.15) ||
                (aiStrategy === 'aggressive' && distance < 280 && Math.abs(verticalDistance) < 150 && Math.random() < 0.12) ||
                (aiStrategy === 'tricky' && Math.random() < 0.08)
              
              if (shouldShoot) {
                const angle = Math.atan2(target.y - p.y, target.x - p.x)
                const spread = (Math.random() - 0.5) * 0.3
                
                lastThreatTime.current = Date.now()
                lastThreatPosition.current = { x: p.x, y: p.y }
                
                if (p.characterType === 'frog') {
                  const direction = p.facingRight ? 1 : -1
                  projectiles.push({
                    x: p.x + 20,
                    y: p.y - 20,
                    vx: direction * 10,
                    vy: 0,
                    owner: 0,
                    bounces: 0,
                    projectileType: 'frog'
                  })
                } else {
                  projectiles.push({
                    x: p.x + 20,
                    y: p.y - 20,
                    vx: Math.cos(angle + spread) * 8,
                    vy: Math.sin(angle + spread) * 8,
                    owner: 0,
                    bounces: 0,
                    projectileType: 'normal'
                  })
                }
                aiCooldown = 20 + Math.floor(Math.random() * 15)
                p.shootCooldown = 15
              }
            } else {
              aiCooldown--
            }
          }

          if (p.x < 20) p.x = 20
          if (p.x > mid - 60) p.x = mid - 60
        }

        if (i === 1 && p.alive) {
          const movementState = onPlatform ? 'stationary' : 'jumping'
          
          if (keys[p.controls!.left] && p.x > mid + 20) {
            p.vx -= 0.8
            p.facingRight = false
            logMovement('left', { vx: p.vx, vy: p.vy }, 
              `moving_left_health_${Math.round(p.health)}`)
            
            const enemy = players[0]
            const distToEnemy = Math.abs(enemy.x - p.x)
            if (distToEnemy < 200 && p.health < 50) {
              logModeSwitch('defensive', p.health / p.maxHealth, distToEnemy, 'retreating_low_health')
            }
          }
          if (keys[p.controls!.right] && p.x < canvas.width - 60) {
            p.vx += 0.8
            p.facingRight = true
            logMovement('right', { vx: p.vx, vy: p.vy },
              `moving_right_health_${Math.round(p.health)}`)
            
            const enemy = players[0]
            const distToEnemy = Math.abs(enemy.x - p.x)
            if (distToEnemy < 200 && (canShoot || canShootBlack)) {
              logModeSwitch('offensive', p.health / p.maxHealth, distToEnemy, 'advancing_with_ammo')
            }
          }
          if (keys[p.controls!.jump] && onPlatform) {
            p.vy = -12
            logMovement('jump', { vx: p.vx, vy: p.vy },
              `jumping_height_${currentHeight}`)
            
            if (lastThreatPosition.current && Date.now() - lastThreatTime.current < 2000) {
              logReactionTime(
                'platform_collapse',
                lastThreatPosition.current,
                { x: p.x, y: p.y },
                'jump',
                (100 - p.health) / 100
              )
            }
          }
          if (keys[p.controls!.shoot] && p.shootCooldown <= 0) {
            keys[p.controls!.shoot] = false
            const direction = p.facingRight ? 1 : -1
            const enemy = players[0]
            
            if (playerShootTimer > 0) {
              projectiles.push({
                x: p.x + 20,
                y: p.y - 20,
                vx: direction * 9,
                vy: 0,
                owner: 1,
                bounces: 0,
                projectileType: 'normal'
              })
              p.shootCooldown = 15
              
              logMovement('shoot', { vx: direction * 9, vy: 0 },
                `shooting_gold_distance_${Math.round(Math.abs(enemy.x - p.x))}`)
              
              logShotAccuracy(
                { x: p.x + 20, y: p.y - 20 },
                { x: enemy.x, y: enemy.y },
                false,
                movementState
              )
              
              const distToEnemy = Math.abs(enemy.x - p.x)
              logModeSwitch('offensive', p.health / p.maxHealth, distToEnemy, 'engaging_with_shot')
            } else if (playerShootBlackTimer > 0) {
              projectiles.push({
                x: p.x + 20,
                y: p.y - 20,
                vx: direction * 9,
                vy: 0,
                owner: 2,
                bounces: 0,
                projectileType: 'normal'
              })
              p.shootCooldown = 15
              
              logMovement('shoot', { vx: direction * 9, vy: 0 },
                `shooting_black_distance_${Math.round(Math.abs(enemy.x - p.x))}`)
              
              logShotAccuracy(
                { x: p.x + 20, y: p.y - 20 },
                { x: enemy.x, y: enemy.y },
                false,
                movementState
              )
            }
          }

          p.x = Math.max(mid + 20, Math.min(p.x, canvas.width - 60))
          
          if (p.health < 30 && p.health > 0) {
            if (Date.now() - lastThreatTime.current > 5000) {
              lastThreatTime.current = Date.now()
              lastThreatPosition.current = { x: p.x, y: p.y }
            }
          }
        }

        const alpha = !p.alive && i === 0 && p.respawnTimer > 540 
          ? 0.3 + 0.7 * Math.sin((p.respawnTimer - 540) * 0.2) 
          : 1
        
        if (p.characterType === 'frog') {
          drawFrog(ctx, p.x, p.y, p.color, p.facingRight, alpha)
        } else {
          drawBrain(ctx, p.x, p.y, p.color, p.facingRight, alpha)
        }

        if (p.alive) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)'
          ctx.fillRect(p.x - 5, p.y - 55, 50, 8)
          
          const healthPercent = p.health / p.maxHealth
          const healthColor = healthPercent > 0.5 ? '#10b981' : healthPercent > 0.25 ? '#f59e0b' : '#ef4444'
          ctx.fillStyle = healthColor
          ctx.fillRect(p.x - 5, p.y - 55, 50 * healthPercent, 8)
          
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth = 1
          ctx.strokeRect(p.x - 5, p.y - 55, 50, 8)
        }

        if (!p.alive && i === 0) {
          const secondsLeft = Math.ceil((600 - p.respawnTimer) / 60)
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.fillRect(p.x - 20, p.y - 70, 80, 30)
          ctx.fillStyle = '#10b981'
          ctx.font = 'bold 16px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`Respawn: ${secondsLeft}s`, p.x + 20, p.y - 48)
        }
      })

      projectiles.forEach((proj, idx) => {
        proj.x += proj.vx
        proj.y += proj.vy
        
        if (proj.projectileType === 'normal') {
          proj.vy += 0.2
        }

        let hitPlatform = false
        platforms.forEach((platform, platIdx) => {
          const screenY = platform.y - cameraY
          const isVisible = screenY > canvasHeight * 0.4 && screenY < canvasHeight
          
          if (isVisible &&
            proj.x > platform.x &&
            proj.x < platform.x + platform.width &&
            proj.y > platform.y &&
            proj.y < platform.y + platform.height
          ) {
            hitPlatform = true
            
            if (proj.projectileType === 'frog') {
              createExplosion(proj.x, proj.y, '#22c55e')
              createExplosion(platform.x + platform.width / 2, platform.y, '#ef4444')
              platforms.splice(platIdx, 1)
              
              if (proj.owner === 1) {
                currentSurvivalSegment.current.platformsDestroyed++
              }
            } else {
              const shouldDamage = 
                (proj.owner === 0 && platform.ownerSide === 'right') ||
                (proj.owner === 1 && platform.ownerSide === 'left')
              
              if (shouldDamage && proj.owner !== 2) {
                platform.hits++
                
                if (platform.hits >= platform.maxHits) {
                  createExplosion(proj.x, proj.y, '#8b5cf6')
                  createExplosion(platform.x + platform.width / 2, platform.y, '#ef4444')
                  platforms.splice(platIdx, 1)
                  
                  if (proj.owner === 1) {
                    currentSurvivalSegment.current.platformsDestroyed++
                  }
                } else {
                  createExplosion(proj.x, proj.y, '#f59e0b')
                }
              } else {
                createExplosion(proj.x, proj.y, '#8b5cf6')
              }
            }
            
            projectiles.splice(idx, 1)
            return
          }
        })
        
        if (hitPlatform) return

        if (proj.y > cameraY + canvasHeight + 100 || proj.y < cameraY - 100) {
          projectiles.splice(idx, 1)
          return
        }

        if (proj.projectileType === 'frog') {
          ctx.shadowBlur = 15
          ctx.shadowColor = '#22c55e'
          ctx.fillStyle = '#22c55e'
          ctx.beginPath()
          ctx.arc(proj.x, proj.y, 7, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          ctx.globalAlpha = 0.3
          ctx.fillStyle = '#16a34a'
          ctx.beginPath()
          ctx.arc(proj.x - proj.vx * 0.5, proj.y, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        } else {
          ctx.shadowBlur = 15
          ctx.shadowColor = proj.owner === 2 ? '#1f2937' : '#fbbf24'
          ctx.fillStyle = proj.owner === 2 ? '#1f2937' : '#fbbf24'
          ctx.beginPath()
          ctx.arc(proj.x, proj.y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          ctx.globalAlpha = 0.3
          ctx.fillStyle = proj.owner === 2 ? '#111827' : '#f59e0b'
          ctx.beginPath()
          ctx.arc(proj.x - proj.vx, proj.y - proj.vy, 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }

        players.forEach((p, i) => {
          if ((i !== proj.owner && proj.owner !== 2 && p.alive) || (proj.owner === 2 && i === 0 && p.alive)) {
            if (
              proj.x > p.x &&
              proj.x < p.x + 40 &&
              proj.y > p.y - 40 &&
              proj.y < p.y
            ) {
              const oldHealth = p.health
              p.health -= 15
              projectiles.splice(idx, 1)
              createExplosion(proj.x, proj.y, p.color)
              
              if ((proj.owner === 1 || proj.owner === 2) && i === 0) {
                const lastShot = sessionData.detailedLogs.shotAccuracy[sessionData.detailedLogs.shotAccuracy.length - 1]
                if (lastShot && Date.now() - lastShot.timestamp < 2000) {
                  setSessionData(prev => {
                    const updated = [...prev.detailedLogs.shotAccuracy]
                    updated[updated.length - 1] = { ...lastShot, hit: true }
                    return {
                      ...prev,
                      detailedLogs: { ...prev.detailedLogs, shotAccuracy: updated }
                    }
                  })
                }
                
                currentSurvivalSegment.current.damageDealt += 15
              }
              
              if (i === 1) {
                currentSurvivalSegment.current.damageReceived += 15
                
                logReactionTime(
                  'projectile_incoming',
                  { x: proj.x, y: proj.y },
                  { x: p.x, y: p.y },
                  'none',
                  (100 - oldHealth) / 100
                )
              }

              if (p.health <= 0) {
                p.alive = false
                p.respawnTimer = 0
                createExplosion(p.x + 20, p.y - 20, p.color)
                
                if (i === 0) {
                  setKills(k => k + 1)
                  currentSurvivalSegment.current.damageDealt += oldHealth
                } else {
                  running = false
                  setGameOver(true)
                  currentSurvivalSegment.current.deaths++
                }
              }
            }
          }
        })
      })

      ctx.restore()

      coins.forEach((coin) => {
        if (coin.collected) return
        
        const screenY = coin.y - cameraY
        if (screenY > 0 && screenY < canvasHeight) {
          const time = Date.now() / 1000
          const bounce = Math.sin(time * 3) * 3
          const rotation = time * 2
          
          ctx.save()
          ctx.translate(coin.x, screenY + bounce)
          ctx.rotate(rotation)
          
          if (coin.type === 'gold') {
            ctx.shadowBlur = 10
            ctx.shadowColor = '#fbbf24'
            ctx.fillStyle = '#fbbf24'
            ctx.beginPath()
            ctx.arc(0, 0, 8, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.fillStyle = '#f59e0b'
            ctx.beginPath()
            ctx.arc(0, 0, 6, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.shadowBlur = 0
            ctx.fillStyle = '#fbbf24'
            ctx.font = 'bold 10px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('$', 0, 0)
          } else if (coin.type === 'black') {
            ctx.shadowBlur = 10
            ctx.shadowColor = '#1f2937'
            ctx.fillStyle = '#1f2937'
            ctx.beginPath()
            ctx.arc(0, 0, 8, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.fillStyle = '#111827'
            ctx.beginPath()
            ctx.arc(0, 0, 6, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.shadowBlur = 0
            ctx.fillStyle = '#6b7280'
            ctx.font = 'bold 10px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('☠', 0, 0)
          } else {
            ctx.shadowBlur = 10
            ctx.shadowColor = '#ec4899'
            ctx.fillStyle = '#ec4899'
            ctx.beginPath()
            ctx.arc(0, 0, 8, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.fillStyle = '#db2777'
            ctx.beginPath()
            ctx.arc(0, 0, 6, 0, Math.PI * 2)
            ctx.fill()
            
            ctx.shadowBlur = 0
            ctx.fillStyle = '#fce7f3'
            ctx.font = 'bold 10px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('♥', 0, 0)
          }
          
          ctx.restore()
        }
      })

      if (running) requestAnimationFrame(gameLoop)
    }

    if (gameStarted && !gameOver) {
      gameLoop()
    }

    return () => {
      running = false
      window.removeEventListener("keydown", keyDown)
      window.removeEventListener("keyup", keyUp)
    }
  }, [gameId, gameStarted, gameOver])

  const resetGame = () => {
    if (gameStarted) {
      const now = Date.now()
      currentSurvivalSegment.current.endTime = now
      currentSurvivalSegment.current.duration = now - currentSurvivalSegment.current.startTime
      currentSurvivalSegment.current.heightAchieved = height
    }
    
    setKills(0)
    setHeight(0)
    setGameOver(false)
    setCanShoot(false)
    setShootTimeLeft(0)
    setCanShootBlack(false)
    setShootBlackTimeLeft(0)
    setAiCharacterType('brain')
    setAiAlive(true)
    setGameId(id => id + 1)
    setMessage('')
    setSaveError('')
    
    setSessionData({
      sessionStart: Date.now(),
      sessionEnd: 0,
      totalDuration: 0,
      maxHeight: 0,
      totalKills: 0,
      totalDeaths: 0,
      processingSpeed: {
        averageReactionTime: 0,
        fastestReaction: 0,
        slowestReaction: 0,
        reactionTimeProgression: []
      },
      spatialAwareness: {
        shotAccuracy: 0,
        averageAimDeviation: 0,
        environmentalScanEfficiency: 0,
        coinCollectionRate: 0,
        platformDestructionEfficiency: 0
      },
      cognitiveFlexibility: {
        modeSwitches: 0,
        averageSwitchLatency: 0,
        adaptationScore: 0
      },
      inhibitionControl: {
        impulsiveActions: 0,
        controlledActions: 0,
        inhibitionScore: 0
      },
      strategicPlanning: {
        planningDepth: 0,
        decisionQuality: 0,
        resourceManagement: 0
      },
      detailedLogs: {
        reactionTimes: [],
        movements: [],
        shotAccuracy: [],
        modeSwitches: [],
        environmentScans: [],
        survivalSegments: [],
        cognitiveLoad: [],
        strategicDecisions: []
      }
    })
    
    lastInputTime.current = Date.now()
    lastThreatTime.current = 0
    lastThreatPosition.current = null
    lastShotTime.current = 0
    currentMode.current = 'neutral'
    lastModeChangeTime.current = Date.now()
    coinSpawnTimes.current.clear()
    currentSurvivalSegment.current = {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      heightAchieved: 0,
      damageReceived: 0,
      damageDealt: 0,
      coinsCollected: 0,
      platformsDestroyed: 0,
      deaths: 0
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold text-white mb-2">
            Brain Battle: Endless Ascension
          </h1>
          <p className="text-gray-300">Survive and climb as high as you can!</p>
          {message && (
            <p className="text-green-400 font-semibold">{message}</p>
          )}
        </div>

        {!gameStarted ? (
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 text-center space-y-6">
            <div className="text-6xl">⬆️🧠</div>
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">How to Play</h2>
              <div className="text-left space-y-2 text-gray-300">
                <p>🎮 <strong>Move:</strong> Arrow Left/Right</p>
                <p>⬆️ <strong>Jump:</strong> Arrow Up</p>
                <p>🪙 <strong>Gold Coins:</strong> Destroy enemy platforms (lasts 10s)</p>
                <p>☠️ <strong>Black Coins:</strong> Only damage the enemy, not platforms (lasts 10s)</p>
                <p>💖 <strong>Hearts:</strong> Restore 10% health</p>
                <p>💥 <strong>Shoot:</strong> Spacebar (when you have a coin)</p>
                <p>🎯 <strong>Goal:</strong> Destroy enemy floor sections to make them fall!</p>
                <p className="text-red-400 text-sm mt-2 font-bold">⚠️ Screen auto-scrolls UP!</p>
                <p className="text-yellow-300 text-sm">🔨 Each floor segment takes 3 hits to destroy</p>
                <p className="text-blue-300 text-sm">🏆 Red = AI territory, Blue = Your territory</p>
                <p className="text-green-400 text-sm font-bold">♾️ Enemies respawn every 10 seconds - survive as long as you can!</p>
                <p className="text-green-300 text-sm">🐸 Watch out for the Frog - destroys platforms in one hit!</p>
                <p className="text-purple-300 text-sm mt-4">🧠 <strong>Cognitive tracking enabled:</strong> Your reaction time, accuracy, and strategic decisions are being measured!</p>
              </div>
            </div>
            <button
              onClick={() => setGameStarted(true)}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg text-white"
            >
              Start Battle 🚀
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-2xl">
                  {aiCharacterType === 'frog' ? '🐸' : '🤖'}
                </div>
                <div>
                  <div className="text-white font-bold">
                    {aiCharacterType === 'frog' ? 'AI Frog' : 'AI Brain'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {aiAlive ? 'Active' : 'Respawns in 10s'}
                  </div>
                </div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-white text-sm">Kills</div>
                <div className="text-3xl font-bold text-yellow-400">{kills}</div>
              </div>
              <div className="text-center space-y-1">
                <div className="text-white text-sm">Height</div>
                <div className="text-2xl font-bold text-green-400">{height}m</div>
              </div>
              {canShoot && (
                <div className="text-center">
                  <div className="text-white text-sm">Gold Shot</div>
                  <div className="text-2xl font-bold text-yellow-400">{shootTimeLeft}s</div>
                </div>
              )}
              {canShootBlack && (
                <div className="text-center">
                  <div className="text-white text-sm">Black Shot</div>
                  <div className="text-2xl font-bold text-gray-400">{shootBlackTimeLeft}s</div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-white font-bold text-right">Player</div>
                  <div className={`text-sm text-right ${canShoot || canShootBlack ? (canShoot ? 'text-yellow-400' : 'text-gray-400') : 'text-gray-400'}`}>
                    {canShoot ? '💥 Gold!' : canShootBlack ? '☠️ Black!' : '🪙 Find Coin'}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-2xl">
                  🧠
                </div>
              </div>
            </div>

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="border-4 border-purple-500/50 rounded-2xl w-full shadow-2xl"
                style={{ boxShadow: '0 0 50px rgba(139, 92, 246, 0.5)' }}
              />
              
              {isLoading && (
                <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-lg shadow-lg text-sm">
                  💾 Saving...
                </div>
              )}
              
              {saveError && (
                <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-lg shadow-lg text-sm">
                  ⚠️ {saveError}
                </div>
              )}
              
              {gameOver && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <div className="text-center space-y-4 p-8">
                    <div className="text-6xl mb-4">💀</div>
                    <div className="text-4xl font-bold text-white mb-2">
                      Game Over!
                    </div>
                    <div className="text-2xl text-yellow-400">
                      Kills: {kills}
                    </div>
                    <div className="text-2xl text-green-400">
                      Height: {height}m
                    </div>
                    <div className="mt-4 space-y-2">
                      <button
                        onClick={() => {
                          saveSessionToFirebase()
                          exportSessionData()
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-full text-lg font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 text-white mb-2 w-full"
                        disabled={isLoading}
                      >
                        {isLoading ? '💾 Saving...' : '💾 Save & Export Data'}
                      </button>
                      <button
                        onClick={resetGame}
                        className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 text-white w-full"
                      >
                        Try Again 🔄
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={resetGame}
                className="px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/30 transition-all duration-200 text-white font-semibold"
              >
                Restart Game
              </button>
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all duration-200 text-white font-semibold"
              >
                🧠 {showMetrics ? 'Hide' : 'Show'} Cognitive Metrics
              </button>
              <button
                onClick={() => {
                  saveSessionToFirebase()
                  exportSessionData()
                }}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl transition-all duration-200 text-white font-semibold"
                disabled={isLoading}
              >
                {isLoading ? '💾 Saving...' : '💾 Save Session'}
              </button>
              <button
                onClick={() => {
                  setGameStarted(false)
                  resetGame()
                }}
                className="px-6 py-3 bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/30 transition-all duration-200 text-white font-semibold"
              >
                Back to Menu
              </button>
            </div>

            {showMetrics && (
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                <h3 className="text-2xl font-bold text-white mb-4 text-center">🧠 Live Cognitive Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/10 rounded-xl p-4">
                    <h4 className="font-bold text-purple-300 mb-2">⚡ Processing Speed</h4>
                    <div className="text-white">Reactions: {sessionData.detailedLogs.reactionTimes.length}</div>
                    <div className="text-gray-300">Avg: {sessionData.detailedLogs.reactionTimes.length > 0 
                      ? Math.round(sessionData.detailedLogs.reactionTimes.reduce((a, b) => a + b.responseTime, 0) / sessionData.detailedLogs.reactionTimes.length) 
                      : 0}ms</div>
                    <div className="text-gray-300">Fastest: {sessionData.detailedLogs.reactionTimes.length > 0 
                      ? Math.min(...sessionData.detailedLogs.reactionTimes.map(r => r.responseTime)) 
                      : 0}ms</div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-4">
                    <h4 className="font-bold text-blue-300 mb-2">🎯 Spatial Awareness</h4>
                    <div className="text-white">Shots: {sessionData.detailedLogs.shotAccuracy.length}</div>
                    <div className="text-gray-300">Hits: {sessionData.detailedLogs.shotAccuracy.filter(s => s.hit).length}</div>
                    <div className="text-gray-300">Accuracy: {sessionData.detailedLogs.shotAccuracy.length > 0 
                      ? Math.round((sessionData.detailedLogs.shotAccuracy.filter(s => s.hit).length / sessionData.detailedLogs.shotAccuracy.length) * 100) 
                      : 0}%</div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-4">
                    <h4 className="font-bold text-green-300 mb-2">🔄 Cognitive Flexibility</h4>
                    <div className="text-white">Mode Switches: {sessionData.detailedLogs.modeSwitches.length}</div>
                    <div className="text-gray-300">Avg Switch: {sessionData.detailedLogs.modeSwitches.length > 0 
                      ? Math.round(sessionData.detailedLogs.modeSwitches.reduce((a, b) => a + b.switchLatency, 0) / sessionData.detailedLogs.modeSwitches.length) 
                      : 0}ms</div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-4">
                    <h4 className="font-bold text-yellow-300 mb-2">🛡️ Inhibition Control</h4>
                    <div className="text-white">Movements: {sessionData.detailedLogs.movements.length}</div>
                    <div className="text-gray-300">Impulsive: {sessionData.detailedLogs.movements.filter(m => m.latency < 200).length}</div>
                    <div className="text-gray-300">Controlled: {sessionData.detailedLogs.movements.filter(m => m.latency >= 200).length}</div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-4">
                    <h4 className="font-bold text-pink-300 mb-2">🗺️ Environment Scanning</h4>
                    <div className="text-white">Coins Found: {currentSurvivalSegment.current.coinsCollected}</div>
                    <div className="text-gray-300">Platforms Destroyed: {currentSurvivalSegment.current.platformsDestroyed}</div>
                    <div className="text-gray-300">Scans: {sessionData.detailedLogs.environmentScans.length}</div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-4">
                    <h4 className="font-bold text-red-300 mb-2">⚔️ Combat Stats</h4>
                    <div className="text-white">Damage Dealt: {currentSurvivalSegment.current.damageDealt}</div>
                    <div className="text-gray-300">Damage Taken: {currentSurvivalSegment.current.damageReceived}</div>
                    <div className="text-gray-300">Cognitive Load Samples: {sessionData.detailedLogs.cognitiveLoad.length}</div>
                  </div>

                  <div className="bg-white/10 rounded-xl p-4">
                    <h4 className="font-bold text-indigo-300 mb-2">👤 User Progress</h4>
                    {userId && userStats ? (
                      <>
                        <div className="text-white">Best Height: {userStats.bestHeight || 0}m</div>
                        <div className="text-gray-300">Best Kills: {userStats.bestKills || 0}</div>
                        <div className="text-gray-300">Sessions: {userStats.totalSessionsPlayed || 0}</div>
                        <div className="text-green-400 text-xs mt-1">✅ Synced</div>
                      </>
                    ) : (
                      <>
                        <div className="text-white">Not Signed In</div>
                        <div className="text-gray-300">Local Storage</div>
                        <div className="text-gray-300">Sign in to sync</div>
                        <div className="text-orange-400 text-xs mt-1">📱 Local</div>
                      </>
                    )}
                  </div>
                </div>
                
                {userId && userStats && (
                  <div className="mt-4 p-4 bg-white/20 rounded-lg">
                    <h4 className="font-semibold text-purple-600 mb-2 text-center">🏆 Personal Stats</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="text-center">
                        <div className="font-bold text-lg text-white">{userStats.bestHeight || 0}m</div>
                        <div className="text-gray-300">Best Height</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-white">{userStats.bestKills || 0}</div>
                        <div className="text-gray-300">Best Kills</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-white">{Math.round(userStats.averageReactionTime || 0)}ms</div>
                        <div className="text-gray-300">Avg Reaction</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-white">{Math.round(userStats.averageShotAccuracy || 0)}%</div>
                        <div className="text-gray-300">Avg Accuracy</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default BrainBattle
