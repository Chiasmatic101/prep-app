'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, TrendingUp } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

type Card = {
  id: number
  face: string
  isFlipped: boolean
  isMatched: boolean
}

type GridPreset = 4 | 6

const ICONS = [
  '🍎','🍌','🍇','🍉','🍓','🍒','🍍','🥝','🥑',
  '🌙','⭐','⚡','🔥','❄️','🌈','💎','🎵','🎯',
  '🚀','🛰️','🧠','🎮','🎲','🎧','🕹️','🧩','📦',
  '🐱','🐶','🦊','🐼','🐸','🦄','🦋','🐢','🐙'
]

// Cognitive tracking interfaces
interface CardFlipEvent {
  timestamp: number
  cardId: number
  icon: string
  pairAttemptNumber: number
  timeSinceLastFlip: number
  visualExposureTime: number
  memoryLoad: number
}

interface PairAttempt {
  timestamp: number
  card1: { id: number; icon: string; position: number }
  card2: { id: number; icon: string; position: number }
  success: boolean
  reactionTime: number
  attemptNumber: number
  spatialDistance: number
  visualSimilarity: number
  seenBefore: boolean
}

interface VisualMemoryEvent {
  timestamp: number
  icon: string
  position: number
  recallDelay: number
  correctRecall: boolean
  distractorCount: number
  visualComplexity: number
}

interface RecognitionSpeedMetric {
  timestamp: number
  recognitionTime: number
  itemComplexity: number
  accuracyOnThisTrial: boolean
  confidenceLevel: number
}

interface InhibitionEvent {
  timestamp: number
  cardId: number
  wasAlreadyFlipped: boolean
  repeatedSelectionError: boolean
  inhibitionSuccess: boolean
}

interface AttentionMetric {
  timestamp: number
  focusedIcon: string
  distractorCount: number
  selectiveSuccess: boolean
  sustainedAttentionDuration: number
}

interface SessionData {
  sessionStart: number
  gridSize: number
  gamesCompleted: number
  
  visualShortTermMemory: {
    totalItemsPresented: number
    correctRecalls: number
    incorrectRecalls: number
    averageRecallDelay: number
    memoryCapacity: number
    decayRate: number
    visualRetentionScore: number
  }
  
  selectiveAttention: {
    totalAttentionTrials: number
    successfulFocus: number
    distractedAttempts: number
    attentionSustainability: number
    focusAccuracy: number
    averageDistractors: number
  }
  
  recognitionSpeed: {
    averageRecognitionTime: number
    fastestRecognition: number
    slowestRecognition: number
    speedAccuracyTradeoff: number
    processingEfficiency: number
  }
  
  inhibitionControl: {
    totalInhibitionTests: number
    successfulInhibitions: number
    repeatedSelectionErrors: number
    inhibitionScore: number
    impulsivityRate: number
  }
  
  performanceMetrics: {
    reactionTimePerPair: number
    movesToMatchRatio: number
    falseMatchErrors: number
    timeToCompletion: number
    scoreEfficiency: number
    overallAccuracy: number
  }
  
  spatialMemory: {
    averageSpatialDistance: number
    spatialAccuracy: number
    positionRecallSuccess: number
  }
  
  detailedLogs: {
    cardFlips: CardFlipEvent[]
    pairAttempts: PairAttempt[]
    visualMemory: VisualMemoryEvent[]
    recognitionSpeed: RecognitionSpeedMetric[]
    inhibitionEvents: InhibitionEvent[]
    attentionMetrics: AttentionMetric[]
  }
}

const flipVariants = {
  initial: { rotateY: 0 },
  flipped: { rotateY: 180 },
}

const faceVariants = {
  hidden: { rotateY: 0, opacity: 1 },
  shown:  { rotateY: 180, opacity: 1 },
}

const backVariants = {
  hidden: { rotateY: 180, opacity: 0 },
  shown:  { rotateY: 0, opacity: 1 },
}

export default function MemoryMatchGame() {
  const [grid, setGrid] = useState<GridPreset>(6)
  const totalCards = grid * grid
  const pairCount = totalCards / 2

  const [deck, setDeck] = useState<Card[]>([])
  const [firstPick, setFirstPick] = useState<Card | null>(null)
  const [secondPick, setSecondPick] = useState<Card | null>(null)
  const [locked, setLocked] = useState(false)

  const [moves, setMoves] = useState(0)
  const [matches, setMatches] = useState(0)
  const [score, setScore] = useState(0)

  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [showStats, setShowStats] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [message, setMessage] = useState<string>('')

  // Firebase state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Cognitive tracking
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionStart: Date.now(),
    gridSize: grid,
    gamesCompleted: 0,
    visualShortTermMemory: {
      totalItemsPresented: 0,
      correctRecalls: 0,
      incorrectRecalls: 0,
      averageRecallDelay: 0,
      memoryCapacity: 0,
      decayRate: 0,
      visualRetentionScore: 0
    },
    selectiveAttention: {
      totalAttentionTrials: 0,
      successfulFocus: 0,
      distractedAttempts: 0,
      attentionSustainability: 0,
      focusAccuracy: 0,
      averageDistractors: 0
    },
    recognitionSpeed: {
      averageRecognitionTime: 0,
      fastestRecognition: 0,
      slowestRecognition: 0,
      speedAccuracyTradeoff: 0,
      processingEfficiency: 0
    },
    inhibitionControl: {
      totalInhibitionTests: 0,
      successfulInhibitions: 0,
      repeatedSelectionErrors: 0,
      inhibitionScore: 0,
      impulsivityRate: 0
    },
    performanceMetrics: {
      reactionTimePerPair: 0,
      movesToMatchRatio: 0,
      falseMatchErrors: 0,
      timeToCompletion: 0,
      scoreEfficiency: 0,
      overallAccuracy: 0
    },
    spatialMemory: {
      averageSpatialDistance: 0,
      spatialAccuracy: 0,
      positionRecallSuccess: 0
    },
    detailedLogs: {
      cardFlips: [],
      pairAttempts: [],
      visualMemory: [],
      recognitionSpeed: [],
      inhibitionEvents: [],
      attentionMetrics: []
    }
  })

  // Timing refs
  const gameStartTime = useRef<number>(0)
  const lastFlipTime = useRef<number>(0)
  const firstCardFlipTime = useRef<number>(0)
  const iconMemoryMap = useRef<Map<string, { firstSeen: number; viewings: number; positions: number[] }>>(new Map())
  const pairAttemptCount = useRef<number>(0)
  const flippedCardHistory = useRef<Set<number>>(new Set())

  // Firebase Auth
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

  const loadUserStats = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid)
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          if (data.memoryMatch) {
            setUserStats(data.memoryMatch)
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  const saveSessionToFirebase = async () => {
    const recognitionTimes = sessionData.detailedLogs.recognitionSpeed.map(r => r.recognitionTime)
    const pairAttempts = sessionData.detailedLogs.pairAttempts
    const correctAttempts = pairAttempts.filter(p => p.success).length
    const totalAttempts = pairAttempts.length
    
    const finalData = {
      ...sessionData,
      recognitionSpeed: {
        ...sessionData.recognitionSpeed,
        averageRecognitionTime: recognitionTimes.length > 0
          ? recognitionTimes.reduce((a, b) => a + b, 0) / recognitionTimes.length
          : 0,
        fastestRecognition: recognitionTimes.length > 0 ? Math.min(...recognitionTimes) : 0,
        slowestRecognition: recognitionTimes.length > 0 ? Math.max(...recognitionTimes) : 0
      },
      performanceMetrics: {
        ...sessionData.performanceMetrics,
        reactionTimePerPair: pairAttempts.filter(p => p.success).length > 0
          ? pairAttempts.filter(p => p.success).reduce((sum, p) => sum + p.reactionTime, 0) / 
            pairAttempts.filter(p => p.success).length
          : 0,
        movesToMatchRatio: matches > 0 ? moves / matches : 0,
        falseMatchErrors: pairAttempts.filter(p => !p.success).length,
        timeToCompletion: seconds,
        scoreEfficiency: matches > 0 ? score / matches : 0,
        overallAccuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0
      }
    }

    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('memoryMatchSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('memoryMatchSessions', JSON.stringify(updatedSessions))
      setMessage('💾 Saved to local storage')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setIsLoading(true)

    try {
      const userDocRef = doc(db, 'users', userId)
      
      await setDoc(userDocRef, {
        memoryMatch: {
          totalGamesPlayed: (userStats?.totalGamesPlayed || 0) + sessionData.gamesCompleted,
          averageAccuracy: calculateRunningAverage(
            userStats?.averageAccuracy || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.performanceMetrics.overallAccuracy
          ),
          averageRecognitionTime: calculateRunningAverage(
            userStats?.averageRecognitionTime || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.recognitionSpeed.averageRecognitionTime
          ),
          bestAccuracy: Math.max(
            userStats?.bestAccuracy || 0,
            finalData.performanceMetrics.overallAccuracy
          ),
          visualMemoryScore: calculateRunningAverage(
            userStats?.visualMemoryScore || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.visualShortTermMemory.visualRetentionScore
          ),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), finalData].slice(-10),
          cognitiveProfile: {
            visualShortTermMemory: finalData.visualShortTermMemory.memoryCapacity,
            selectiveAttention: finalData.selectiveAttention.focusAccuracy,
            recognitionSpeed: finalData.recognitionSpeed.averageRecognitionTime,
            inhibitionControl: finalData.inhibitionControl.inhibitionScore,
            spatialMemory: finalData.spatialMemory.spatialAccuracy
          }
        }
      }, { merge: true })

      await addDoc(collection(db, 'users', userId, 'memoryMatchSessions'), {
        gameType: 'memoryMatch',
        ...finalData,
        createdAt: new Date()
      })

      console.log('🧠 Memory Match session saved successfully')
      setMessage('✅ Session saved to cloud!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving session data:', error)
      const savedSessions = JSON.parse(localStorage.getItem('memoryMatchSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('memoryMatchSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const isComplete = matches === pairCount && pairCount > 0

  const difficultyLabel = useMemo(() => {
    if (grid === 4) return 'Quick'
    if (grid === 6) return 'Classic'
    return 'Custom'
  }, [grid])

  useEffect(() => {
    const raw = matches * 120 - moves * 3 - Math.floor(seconds * 0.5)
    setScore(Math.max(0, raw))
  }, [matches, moves, seconds])

  useEffect(() => {
    if (!started || isComplete) {
      if (timerRef.current) clearInterval(timerRef.current)
      if (isComplete && started) {
        // Auto-save on completion
        setTimeout(() => saveSessionToFirebase(), 1000)
        
        setSessionData(prev => ({
          ...prev,
          gamesCompleted: prev.gamesCompleted + 1
        }))
      }
      return
    }
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [started, isComplete])

  const buildDeck = (size: GridPreset): Card[] => {
    const needed = (size * size) / 2
    const faces = shuffle(ICONS).slice(0, needed)
    const doubled = shuffle([...faces, ...faces])
    return doubled.map((face, idx) => ({
      id: idx,
      face,
      isFlipped: false,
      isMatched: false,
    }))
  }

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const calculateSpatialDistance = (pos1: number, pos2: number, gridSize: number): number => {
    const row1 = Math.floor(pos1 / gridSize)
    const col1 = pos1 % gridSize
    const row2 = Math.floor(pos2 / gridSize)
    const col2 = pos2 % gridSize
    return Math.sqrt(Math.pow(row2 - row1, 2) + Math.pow(col2 - col1, 2))
  }

  const startNewGame = (size: GridPreset = grid) => {
    // Save before starting new game if there's data
    if (sessionData.detailedLogs.pairAttempts.length > 0) {
      saveSessionToFirebase()
    }
    
    setGrid(size)
    setDeck(buildDeck(size))
    setFirstPick(null)
    setSecondPick(null)
    setLocked(false)
    setMoves(0)
    setMatches(0)
    setScore(0)
    setSeconds(0)
    setStarted(false)
    pairAttemptCount.current = 0
    iconMemoryMap.current.clear()
    flippedCardHistory.current.clear()
    
    // Reset session data
    setSessionData({
      sessionStart: Date.now(),
      gridSize: size,
      gamesCompleted: 0,
      visualShortTermMemory: {
        totalItemsPresented: 0,
        correctRecalls: 0,
        incorrectRecalls: 0,
        averageRecallDelay: 0,
        memoryCapacity: 0,
        decayRate: 0,
        visualRetentionScore: 0
      },
      selectiveAttention: {
        totalAttentionTrials: 0,
        successfulFocus: 0,
        distractedAttempts: 0,
        attentionSustainability: 0,
        focusAccuracy: 0,
        averageDistractors: 0
      },
      recognitionSpeed: {
        averageRecognitionTime: 0,
        fastestRecognition: 0,
        slowestRecognition: 0,
        speedAccuracyTradeoff: 0,
        processingEfficiency: 0
      },
      inhibitionControl: {
        totalInhibitionTests: 0,
        successfulInhibitions: 0,
        repeatedSelectionErrors: 0,
        inhibitionScore: 0,
        impulsivityRate: 0
      },
      performanceMetrics: {
        reactionTimePerPair: 0,
        movesToMatchRatio: 0,
        falseMatchErrors: 0,
        timeToCompletion: 0,
        scoreEfficiency: 0,
        overallAccuracy: 0
      },
      spatialMemory: {
        averageSpatialDistance: 0,
        spatialAccuracy: 0,
        positionRecallSuccess: 0
      },
      detailedLogs: {
        cardFlips: [],
        pairAttempts: [],
        visualMemory: [],
        recognitionSpeed: [],
        inhibitionEvents: [],
        attentionMetrics: []
      }
    })
  }

  useEffect(() => {
    startNewGame(grid)
  }, [])

  const onFlip = (card: Card) => {
    if (locked || card.isMatched || card.isFlipped) return

    const now = Date.now()
    const timeSinceLastFlip = lastFlipTime.current ? now - lastFlipTime.current : 0

    // Track inhibition (repeated selection)
    const wasAlreadyFlipped = flippedCardHistory.current.has(card.id)
    const inhibitionEvent: InhibitionEvent = {
      timestamp: now,
      cardId: card.id,
      wasAlreadyFlipped,
      repeatedSelectionError: wasAlreadyFlipped && card.isMatched,
      inhibitionSuccess: !wasAlreadyFlipped
    }

    setSessionData(prev => ({
      ...prev,
      inhibitionControl: {
        ...prev.inhibitionControl,
        totalInhibitionTests: prev.inhibitionControl.totalInhibitionTests + 1,
        successfulInhibitions: prev.inhibitionControl.successfulInhibitions + (inhibitionEvent.inhibitionSuccess ? 1 : 0),
        repeatedSelectionErrors: prev.inhibitionControl.repeatedSelectionErrors + (inhibitionEvent.repeatedSelectionError ? 1 : 0),
        inhibitionScore: prev.inhibitionControl.totalInhibitionTests === 0 ? 100 :
          ((prev.inhibitionControl.successfulInhibitions + (inhibitionEvent.inhibitionSuccess ? 1 : 0)) / 
           (prev.inhibitionControl.totalInhibitionTests + 1)) * 100
      },
      detailedLogs: {
        ...prev.detailedLogs,
        inhibitionEvents: [...prev.detailedLogs.inhibitionEvents, inhibitionEvent]
      }
    }))

    flippedCardHistory.current.add(card.id)

    // Track icon memory
    if (!iconMemoryMap.current.has(card.face)) {
      iconMemoryMap.current.set(card.face, { firstSeen: now, viewings: 0, positions: [] })
    }
    const iconInfo = iconMemoryMap.current.get(card.face)!
    iconInfo.viewings++
    if (!iconInfo.positions.includes(card.id)) {
      iconInfo.positions.push(card.id)
    }

    // Calculate visual exposure time
    const visualExposureTime = timeSinceLastFlip
    const memoryLoad = iconMemoryMap.current.size / pairCount

    // Log card flip event
    const flipEvent: CardFlipEvent = {
      timestamp: now,
      cardId: card.id,
      icon: card.face,
      pairAttemptNumber: pairAttemptCount.current,
      timeSinceLastFlip,
      visualExposureTime,
      memoryLoad
    }

    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        cardFlips: [...prev.detailedLogs.cardFlips, flipEvent]
      }
    }))

    // Flip visually
    setDeck(prev =>
      prev.map(c => (c.id === card.id ? { ...c, isFlipped: true } : c))
    )

    if (!started) {
      setStarted(true)
      gameStartTime.current = now
    }

    if (!firstPick) {
      setFirstPick({ ...card, isFlipped: true })
      firstCardFlipTime.current = now
      lastFlipTime.current = now
      return
    }

    if (!secondPick) {
      setSecondPick({ ...card, isFlipped: true })
      setLocked(true)
      setMoves(m => m + 1)
      pairAttemptCount.current++

      const a = firstPick
      const b = { ...card, isFlipped: true }
      const reactionTime = now - firstCardFlipTime.current

      const spatialDistance = calculateSpatialDistance(a.id, b.id, grid)
      const seenBefore = 
        (iconMemoryMap.current.get(a.face)?.viewings || 0) > 1 ||
        (iconMemoryMap.current.get(b.face)?.viewings || 0) > 1

      const success = a.face === b.face

      // Visual similarity (for non-matches, how visually similar were they?)
      const visualSimilarity = success ? 1.0 : 0.3

      // Log pair attempt
      const pairAttempt: PairAttempt = {
        timestamp: now,
        card1: { id: a.id, icon: a.face, position: a.id },
        card2: { id: b.id, icon: b.face, position: b.id },
        success,
        reactionTime,
        attemptNumber: pairAttemptCount.current,
        spatialDistance,
        visualSimilarity,
        seenBefore
      }

      // Log visual memory event
      const recallDelay = now - (iconMemoryMap.current.get(a.face)?.firstSeen || now)
      const distractorCount = deck.filter(c => !c.isMatched && c.face !== a.face).length
      const memoryEvent: VisualMemoryEvent = {
        timestamp: now,
        icon: a.face,
        position: a.id,
        recallDelay,
        correctRecall: success,
        distractorCount,
        visualComplexity: iconMemoryMap.current.size
      }

      // Log recognition speed
      const recognitionMetric: RecognitionSpeedMetric = {
        timestamp: now,
        recognitionTime: reactionTime,
        itemComplexity: memoryLoad,
        accuracyOnThisTrial: success,
        confidenceLevel: seenBefore ? 0.8 : 0.5
      }

      // Log attention metric
      const attentionMetric: AttentionMetric = {
        timestamp: now,
        focusedIcon: a.face,
        distractorCount,
        selectiveSuccess: success,
        sustainedAttentionDuration: seconds
      }

      setSessionData(prev => ({
        ...prev,
        visualShortTermMemory: {
          ...prev.visualShortTermMemory,
          totalItemsPresented: prev.visualShortTermMemory.totalItemsPresented + 1,
          correctRecalls: prev.visualShortTermMemory.correctRecalls + (success ? 1 : 0),
          incorrectRecalls: prev.visualShortTermMemory.incorrectRecalls + (success ? 0 : 1),
          memoryCapacity: Math.max(prev.visualShortTermMemory.memoryCapacity, iconMemoryMap.current.size),
          visualRetentionScore: prev.visualShortTermMemory.totalItemsPresented === 0 ? (success ? 100 : 0) :
            ((prev.visualShortTermMemory.correctRecalls + (success ? 1 : 0)) / 
             (prev.visualShortTermMemory.totalItemsPresented + 1)) * 100
        },
        selectiveAttention: {
          ...prev.selectiveAttention,
          totalAttentionTrials: prev.selectiveAttention.totalAttentionTrials + 1,
          successfulFocus: prev.selectiveAttention.successfulFocus + (success ? 1 : 0),
          distractedAttempts: prev.selectiveAttention.distractedAttempts + (success ? 0 : 1),
          focusAccuracy: prev.selectiveAttention.totalAttentionTrials === 0 ? (success ? 100 : 0) :
            ((prev.selectiveAttention.successfulFocus + (success ? 1 : 0)) / 
             (prev.selectiveAttention.totalAttentionTrials + 1)) * 100
        },
        spatialMemory: {
          ...prev.spatialMemory,
          averageSpatialDistance: prev.detailedLogs.pairAttempts.length === 0 ? spatialDistance :
            (prev.spatialMemory.averageSpatialDistance * prev.detailedLogs.pairAttempts.length + spatialDistance) /
            (prev.detailedLogs.pairAttempts.length + 1),
          positionRecallSuccess: prev.spatialMemory.positionRecallSuccess + (success ? 1 : 0),
          spatialAccuracy: prev.detailedLogs.pairAttempts.length === 0 ? (success ? 100 : 0) :
            ((prev.spatialMemory.positionRecallSuccess + (success ? 1 : 0)) / 
             (prev.detailedLogs.pairAttempts.length + 1)) * 100
        },
        detailedLogs: {
          ...prev.detailedLogs,
          pairAttempts: [...prev.detailedLogs.pairAttempts, pairAttempt],
          visualMemory: [...prev.detailedLogs.visualMemory, memoryEvent],
          recognitionSpeed: [...prev.detailedLogs.recognitionSpeed, recognitionMetric],
          attentionMetrics: [...prev.detailedLogs.attentionMetrics, attentionMetric]
        }
      }))

      if (success) {
        setTimeout(() => {
          setDeck(prev =>
            prev.map(c =>
              c.face === a.face
                ? { ...c, isMatched: true }
                : c
            )
          )
          setMatches(x => x + 1)
          resetPicks()
        }, 350)
      } else {
        setTimeout(() => {
          setDeck(prev =>
            prev.map(c =>
              c.id === a.id || c.id === b.id ? { ...c, isFlipped: false } : c
            )
          )
          resetPicks()
        }, 900)
      }

      lastFlipTime.current = now
    }
  }

  const resetPicks = () => {
    setFirstPick(null)
    setSecondPick(null)
    setLocked(false)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white font-sans flex flex-col items-center p-6">
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Memory Match
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:text-base text-gray-300">
          <span className="px-2 py-1 rounded bg-white/5">{difficultyLabel}</span>
          <span>Grid: {grid}×{grid}</span>
          <span>•</span>
          <span>Moves: <span className="text-blue-300 font-semibold">{moves}</span></span>
          <span>•</span>
          <span>Time: <span className="text-purple-300 font-semibold">{formatTime(seconds)}</span></span>
          <span>•</span>
          <span>Score: <span className="text-pink-300 font-semibold">{score}</span></span>
          <span>•</span>
          <span>Pairs: <span className="text-green-300 font-semibold">{matches}/{pairCount}</span></span>
        </div>
      </div>

      {message && (
        <div className="mb-4 text-green-400 font-semibold">{message}</div>
      )}

      <div className="h-10 mb-4 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${started}-${matches}-${moves}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-gray-300"
          >
            {isComplete
              ? 'Nice! All pairs found 🎉'
              : !started
              ? 'Click any card to begin'
              : secondPick
              ? 'Checking...'
              : 'Find all the matching pairs!'}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => startNewGame(grid)}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
        >
          Reset
        </button>

        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-2 py-1">
          <span className="text-xs text-gray-300">Grid</span>
          <button
            onClick={() => startNewGame(4)}
            className={classNames(
              'px-3 py-1 rounded-md text-sm transition',
              grid === 4 ? 'bg-blue-600' : 'hover:bg-gray-700'
            )}
          >
            4×4
          </button>
          <button
            onClick={() => startNewGame(6)}
            className={classNames(
              'px-3 py-1 rounded-md text-sm transition',
              grid === 6 ? 'bg-blue-600' : 'hover:bg-gray-700'
            )}
          >
            6×6
          </button>
        </div>

        <button
          onClick={() => setShowStats(s => !s)}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
        >
          📊 Stats
        </button>

        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105 transition-transform font-semibold"
        >
          <Brain className="w-5 h-5" />
          {showMetrics ? 'Hide' : 'Show'} Cognitive Metrics
        </button>

        <button
          onClick={saveSessionToFirebase}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-105 transition-transform font-semibold disabled:opacity-50"
        >
          <TrendingUp className="w-5 h-5" />
          {isLoading ? 'Saving...' : 'Save Session'}
        </button>
      </div>

      <div
        className={classNames(
          'grid gap-3 md:gap-4',
          grid === 4 ? 'grid-cols-4' : 'grid-cols-6'
        )}
      >
        {deck.map(card => (
          <motion.button
            key={card.id}
            onClick={() => onFlip(card)}
            disabled={locked || card.isMatched}
            className={classNames(
              'relative rounded-xl w-20 h-28 md:w-24 md:h-32 border-2 focus:outline-none',
              'transition disabled:opacity-60 disabled:cursor-not-allowed',
              card.isMatched ? 'border-green-400/70' : 'border-gray-700'
            )}
            whileHover={locked || card.isMatched ? {} : { scale: 1.02 }}
            whileTap={locked || card.isMatched ? {} : { scale: 0.98 }}
            style={{ perspective: 1000 }}
          >
            <motion.div
              className="relative w-full h-full preserve-3d"
              animate={card.isFlipped || card.isMatched ? 'flipped' : 'initial'}
              variants={flipVariants}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              <motion.div
                className={classNames(
                  'absolute inset-0 backface-hidden rounded-xl',
                  'bg-gradient-to-br from-gray-800 to-gray-900',
                  'flex items-center justify-center border border-gray-700/70',
                  'shadow-[0_0_20px_rgba(0,0,0,0.35)]'
                )}
                variants={faceVariants}
                animate={card.isFlipped || card.isMatched ? 'hidden' : 'shown'}
                transition={{ duration: 0.28 }}
              >
                <div className="w-10 h-10 rounded-lg bg-white/5" />
              </motion.div>

              <motion.div
                className={classNames(
                  'absolute inset-0 backface-hidden rounded-xl rotateY-180',
                  'bg-gradient-to-br from-purple-600/30 to-pink-600/30',
                  'flex items-center justify-center border border-purple-500/50',
                  'shadow-[0_0_24px_rgba(168,85,247,0.35)] text-3xl md:text-4xl'
                )}
                variants={backVariants}
                animate={card.isFlipped || card.isMatched ? 'shown' : 'hidden'}
                transition={{ duration: 0.28 }}
              >
                <motion.span
                  animate={card.isMatched ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.35 }}
                >
                  {card.face}
                </motion.span>
              </motion.div>
            </motion.div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="mt-6 text-center"
          >
            <p className="text-lg text-gray-300">
              Completed in <span className="font-semibold text-purple-300">{moves}</span> moves,{' '}
              <span className="font-semibold text-purple-300">{formatTime(seconds)}</span>.
            </p>
            <p className="mt-1 text-xl font-bold text-pink-300">Score: {score}</p>
            <p className="mt-2 text-sm text-green-400">✅ Auto-saved to {userId ? 'cloud' : 'local storage'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cognitive Metrics Panel */}
      {showMetrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 w-full max-w-6xl bg-black/60 border border-purple-600/50 rounded-xl p-6"
        >
          <h3 className="text-2xl font-bold text-purple-400 mb-4 text-center">🧠 Visual Cognitive Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-blue-300 mb-2">👁️ Visual Short-Term Memory</h4>
              <div className="text-white">Items Presented: {sessionData.visualShortTermMemory.totalItemsPresented}</div>
              <div className="text-green-400">Correct: {sessionData.visualShortTermMemory.correctRecalls}</div>
              <div className="text-red-400">Incorrect: {sessionData.visualShortTermMemory.incorrectRecalls}</div>
              <div className="text-gray-300">Memory Capacity: {sessionData.visualShortTermMemory.memoryCapacity}</div>
              <div className="text-gray-300">
                Retention: {Math.round(sessionData.visualShortTermMemory.visualRetentionScore)}%
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-purple-300 mb-2">🎯 Selective Attention</h4>
              <div className="text-white">Trials: {sessionData.selectiveAttention.totalAttentionTrials}</div>
              <div className="text-green-400">Successful: {sessionData.selectiveAttention.successfulFocus}</div>
              <div className="text-red-400">Distracted: {sessionData.selectiveAttention.distractedAttempts}</div>
              <div className="text-gray-300">
                Focus Accuracy: {Math.round(sessionData.selectiveAttention.focusAccuracy)}%
              </div>
              <div className="text-gray-300">
                Avg Distractors: {sessionData.detailedLogs.attentionMetrics.length > 0
                  ? Math.round(sessionData.detailedLogs.attentionMetrics.reduce((a, b) => a + b.distractorCount, 0) / sessionData.detailedLogs.attentionMetrics.length)
                  : 0}
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-pink-300 mb-2">⚡ Recognition Speed</h4>
              <div className="text-white">Recognitions: {sessionData.detailedLogs.recognitionSpeed.length}</div>
              <div className="text-gray-300">
                Avg: {sessionData.detailedLogs.recognitionSpeed.length > 0
                  ? Math.round(sessionData.detailedLogs.recognitionSpeed.reduce((a, b) => a + b.recognitionTime, 0) / sessionData.detailedLogs.recognitionSpeed.length)
                  : 0}ms
              </div>
              <div className="text-gray-300">
                Fastest: {sessionData.detailedLogs.recognitionSpeed.length > 0
                  ? Math.min(...sessionData.detailedLogs.recognitionSpeed.map(r => r.recognitionTime))
                  : 0}ms
              </div>
              <div className="text-gray-300">
                Slowest: {sessionData.detailedLogs.recognitionSpeed.length > 0
                  ? Math.max(...sessionData.detailedLogs.recognitionSpeed.map(r => r.recognitionTime))
                  : 0}ms
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-yellow-300 mb-2">🛡️ Inhibition Control</h4>
              <div className="text-white">Tests: {sessionData.inhibitionControl.totalInhibitionTests}</div>
              <div className="text-green-400">Successful: {sessionData.inhibitionControl.successfulInhibitions}</div>
              <div className="text-red-400">Repeated Errors: {sessionData.inhibitionControl.repeatedSelectionErrors}</div>
              <div className="text-gray-300">
                Inhibition Score: {Math.round(sessionData.inhibitionControl.inhibitionScore)}%
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-green-300 mb-2">📊 Performance Metrics</h4>
              <div className="text-white">
                Accuracy: {sessionData.detailedLogs.pairAttempts.length > 0
                  ? Math.round((sessionData.detailedLogs.pairAttempts.filter(p => p.success).length / sessionData.detailedLogs.pairAttempts.length) * 100)
                  : 0}%
              </div>
              <div className="text-gray-300">
                Avg Match Time: {sessionData.detailedLogs.pairAttempts.filter(p => p.success).length > 0
                  ? Math.round(sessionData.detailedLogs.pairAttempts.filter(p => p.success).reduce((a, b) => a + b.reactionTime, 0) / sessionData.detailedLogs.pairAttempts.filter(p => p.success).length)
                  : 0}ms
              </div>
              <div className="text-gray-300">
                Moves/Match: {matches > 0 ? (moves / matches).toFixed(2) : '0.00'}
              </div>
              <div className="text-red-400">
                False Matches: {sessionData.detailedLogs.pairAttempts.filter(p => !p.success).length}
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-orange-300 mb-2">🗺️ Spatial Memory</h4>
              <div className="text-white">
                Avg Distance: {sessionData.spatialMemory.averageSpatialDistance.toFixed(2)} units
              </div>
              <div className="text-gray-300">
                Spatial Accuracy: {Math.round(sessionData.spatialMemory.spatialAccuracy)}%
              </div>
              <div className="text-green-400">
                Position Recalls: {sessionData.spatialMemory.positionRecallSuccess}
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4 md:col-span-2 lg:col-span-1">
              <h4 className="font-bold text-indigo-300 mb-2">👤 User Progress</h4>
              {userId && userStats ? (
                <>
                  <div className="text-white">Games: {userStats.totalGamesPlayed || 0}</div>
                  <div className="text-green-400">Best Accuracy: {Math.round(userStats.bestAccuracy || 0)}%</div>
                  <div className="text-gray-300">Avg Speed: {Math.round(userStats.averageRecognitionTime || 0)}ms</div>
                  <div className="text-gray-300">Memory Score: {Math.round(userStats.visualMemoryScore || 0)}%</div>
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
            <div className="mt-4 p-4 bg-white/10 rounded-lg">
              <h4 className="font-semibold text-purple-400 mb-2 text-center">🏆 Personal Best</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{userStats.totalGamesPlayed || 0}</div>
                  <div className="text-gray-300">Games Played</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.bestAccuracy || 0)}%</div>
                  <div className="text-gray-300">Best Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.averageAccuracy || 0)}%</div>
                  <div className="text-gray-300">Avg Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.averageRecognitionTime || 0)}ms</div>
                  <div className="text-gray-300">Avg Speed</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.visualMemoryScore || 0)}%</div>
                  <div className="text-gray-300">Memory Score</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Stats Panel */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowStats(false)}
          >
            <motion.div
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Session Stats
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span>Grid</span><span>{grid}×{grid}</span></div>
                <div className="flex justify-between"><span>Moves</span><span>{moves}</span></div>
                <div className="flex justify-between"><span>Time</span><span>{formatTime(seconds)}</span></div>
                <div className="flex justify-between"><span>Score</span><span>{score}</span></div>
                <div className="flex justify-between"><span>Pairs Found</span><span>{matches}/{pairCount}</span></div>
                <div className="flex justify-between"><span>Status</span><span>{isComplete ? 'Completed 🎉' : 'In progress'}</span></div>
              </div>
              <button
                className="mt-6 w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
                onClick={() => setShowStats(false)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}