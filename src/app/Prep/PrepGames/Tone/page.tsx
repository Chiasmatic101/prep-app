'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, TrendingUp } from 'lucide-react'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

type GridPreset = 4 | 6

type Card = {
  id: number
  tone: number
  isFlipped: boolean
  isMatched: boolean
}

const TONES = [
  261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00,
  415.30, 440.00, 466.16, 493.88, 523.25, 554.37, 587.33, 622.25,
  659.25, 698.46,
]

// Cognitive tracking interfaces
interface CardFlipEvent {
  timestamp: number
  cardId: number
  tone: number
  pairAttemptNumber: number
  timeSinceLastFlip: number
  currentlyFlippedCards: number
  memoryLoad: number
}

interface PairAttempt {
  timestamp: number
  card1: { id: number; tone: number }
  card2: { id: number; tone: number }
  success: boolean
  reactionTime: number
  attemptNumber: number
  tonesHeardBefore: boolean
  audioDiscriminationDifficulty: number
}

interface AuditoryMemoryEvent {
  timestamp: number
  tone: number
  recallDelay: number
  correctRecall: boolean
  interferenceLevel: number
}

interface ProcessingSpeedMetric {
  timestamp: number
  decisionTime: number
  complexityLevel: number
  accuracyOnThisTrial: boolean
}

interface AttentionMetric {
  timestamp: number
  focusedTone: number
  distractorCount: number
  selectiveSuccess: boolean
  responseLatency: number
}

interface SessionData {
  sessionStart: number
  gridSize: number
  gamesCompleted: number
  
  auditoryWorkingMemory: {
    totalTonesPresentedPairs: number
    correctRecalls: number
    incorrectRecalls: number
    averageRecallDelay: number
    memorySpan: number
    decayRate: number
  }
  
  auditoryDiscrimination: {
    totalComparisons: number
    correctDiscriminations: number
    incorrectDiscriminations: number
    averageFrequencyDifference: number
    discriminationThreshold: number
    confusionMatrix: Record<string, number>
  }
  
  processingSpeed: {
    averageDecisionTime: number
    fastestDecision: number
    slowestDecision: number
    speedAccuracyTradeoff: number
    processingEfficiency: number
  }
  
  selectiveAttention: {
    totalAttentionTrials: number
    successfulFocus: number
    distractionsResisted: number
    attentionSustainability: number
    focusAccuracy: number
  }
  
  pairedAssociationMemory: {
    totalPairs: number
    firstAttemptMatches: number
    repeatedAttemptMatches: number
    falseAlarms: number
    associationStrength: number
    learningCurve: number[]
  }
  
  performanceMetrics: {
    accuracy: number
    falseAlarmRate: number
    averageTimeToMatch: number
    movesToMatchRatio: number
    toneRecognitionErrorRate: number
    overallEfficiency: number
  }
  
  detailedLogs: {
    cardFlips: CardFlipEvent[]
    pairAttempts: PairAttempt[]
    auditoryMemory: AuditoryMemoryEvent[]
    processingSpeed: ProcessingSpeedMetric[]
    attentionMetrics: AttentionMetric[]
  }
}

const flipVariants = {
  initial: { rotateY: 0 },
  flipped: { rotateY: 180 },
}

const faceVariants = {
  hidden: { rotateY: 0, opacity: 1 },
  shown: { rotateY: 180, opacity: 1 },
}

const backVariants = {
  hidden: { rotateY: 180, opacity: 0 },
  shown: { rotateY: 0, opacity: 1 },
}

export default function SoundMatchGame() {
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

  const [muted, setMuted] = useState(false)
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
    auditoryWorkingMemory: {
      totalTonesPresentedPairs: 0,
      correctRecalls: 0,
      incorrectRecalls: 0,
      averageRecallDelay: 0,
      memorySpan: 0,
      decayRate: 0
    },
    auditoryDiscrimination: {
      totalComparisons: 0,
      correctDiscriminations: 0,
      incorrectDiscriminations: 0,
      averageFrequencyDifference: 0,
      discriminationThreshold: 0,
      confusionMatrix: {}
    },
    processingSpeed: {
      averageDecisionTime: 0,
      fastestDecision: 0,
      slowestDecision: 0,
      speedAccuracyTradeoff: 0,
      processingEfficiency: 0
    },
    selectiveAttention: {
      totalAttentionTrials: 0,
      successfulFocus: 0,
      distractionsResisted: 0,
      attentionSustainability: 0,
      focusAccuracy: 0
    },
    pairedAssociationMemory: {
      totalPairs: 0,
      firstAttemptMatches: 0,
      repeatedAttemptMatches: 0,
      falseAlarms: 0,
      associationStrength: 0,
      learningCurve: []
    },
    performanceMetrics: {
      accuracy: 0,
      falseAlarmRate: 0,
      averageTimeToMatch: 0,
      movesToMatchRatio: 0,
      toneRecognitionErrorRate: 0,
      overallEfficiency: 0
    },
    detailedLogs: {
      cardFlips: [],
      pairAttempts: [],
      auditoryMemory: [],
      processingSpeed: [],
      attentionMetrics: []
    }
  })

  // Timing refs
  const gameStartTime = useRef<number>(0)
  const lastFlipTime = useRef<number>(0)
  const firstCardFlipTime = useRef<number>(0)
  const toneMemoryMap = useRef<Map<number, { firstHeard: number; hearings: number }>>(new Map())
  const pairAttemptCount = useRef<number>(0)

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)

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
          if (data.soundMatch) {
            setUserStats(data.soundMatch)
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
    const processingTimes = sessionData.detailedLogs.processingSpeed.map(p => p.decisionTime)
    const pairAttempts = sessionData.detailedLogs.pairAttempts
    const correctAttempts = pairAttempts.filter(p => p.success).length
    const totalAttempts = pairAttempts.length
    
    const finalData = {
      ...sessionData,
      processingSpeed: {
        ...sessionData.processingSpeed,
        averageDecisionTime: processingTimes.length > 0
          ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
          : 0,
        fastestDecision: processingTimes.length > 0 ? Math.min(...processingTimes) : 0,
        slowestDecision: processingTimes.length > 0 ? Math.max(...processingTimes) : 0
      },
      performanceMetrics: {
        ...sessionData.performanceMetrics,
        accuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
        falseAlarmRate: totalAttempts > 0 
          ? (sessionData.pairedAssociationMemory.falseAlarms / totalAttempts) * 100 
          : 0,
        averageTimeToMatch: pairAttempts.filter(p => p.success).length > 0
          ? pairAttempts.filter(p => p.success).reduce((sum, p) => sum + p.reactionTime, 0) / 
            pairAttempts.filter(p => p.success).length
          : 0,
        movesToMatchRatio: matches > 0 ? moves / matches : 0,
        toneRecognitionErrorRate: sessionData.auditoryDiscrimination.totalComparisons > 0
          ? (sessionData.auditoryDiscrimination.incorrectDiscriminations / 
             sessionData.auditoryDiscrimination.totalComparisons) * 100
          : 0
      }
    }

    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('soundMatchSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('soundMatchSessions', JSON.stringify(updatedSessions))
      setMessage('💾 Saved to local storage')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setIsLoading(true)

    try {
      const userDocRef = doc(db, 'users', userId)
      
      await setDoc(userDocRef, {
        soundMatch: {
          totalGamesPlayed: (userStats?.totalGamesPlayed || 0) + sessionData.gamesCompleted,
          averageAccuracy: calculateRunningAverage(
            userStats?.averageAccuracy || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.performanceMetrics.accuracy
          ),
          averageDecisionTime: calculateRunningAverage(
            userStats?.averageDecisionTime || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.processingSpeed.averageDecisionTime
          ),
          bestAccuracy: Math.max(
            userStats?.bestAccuracy || 0,
            finalData.performanceMetrics.accuracy
          ),
          auditoryMemoryScore: calculateRunningAverage(
            userStats?.auditoryMemoryScore || 0,
            userStats?.totalGamesPlayed || 0,
            (finalData.auditoryWorkingMemory.correctRecalls / 
             Math.max(finalData.auditoryWorkingMemory.totalTonesPresentedPairs, 1)) * 100
          ),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), finalData].slice(-10),
          cognitiveProfile: {
            auditoryWorkingMemory: finalData.auditoryWorkingMemory.memorySpan,
            auditoryDiscrimination: finalData.auditoryDiscrimination.discriminationThreshold,
            processingSpeed: finalData.processingSpeed.averageDecisionTime,
            selectiveAttention: finalData.selectiveAttention.focusAccuracy,
            pairedAssociation: finalData.pairedAssociationMemory.associationStrength
          }
        }
      }, { merge: true })

      await addDoc(collection(db, 'users', userId, 'soundMatchSessions'), {
        gameType: 'soundMatch',
        ...finalData,
        createdAt: new Date()
      })

      console.log('🧠 Sound Match session saved successfully')
      setMessage('✅ Session saved to cloud!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving session data:', error)
      const savedSessions = JSON.parse(localStorage.getItem('soundMatchSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('soundMatchSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const ensureAudio = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      audioCtxRef.current = new Ctx()
      masterGainRef.current = audioCtxRef.current.createGain()
      masterGainRef.current.gain.value = muted ? 0 : 0.25
      masterGainRef.current.connect(audioCtxRef.current.destination)
    } else {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = muted ? 0 : 0.25
      }
    }
  }

  const playTone = (frequency: number, duration = 0.5) => {
    if (muted) return
    ensureAudio()
    const ctx = audioCtxRef.current!
    const master = masterGainRef.current!

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)

    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + Math.max(0.05, duration))

    osc.connect(gain)
    gain.connect(master)

    osc.start()
    osc.stop(ctx.currentTime + Math.max(0.08, duration + 0.02))
  }

  const playSuccess = () => {
    if (muted) return
    ensureAudio()
    playTone(880, 0.12)
    setTimeout(() => playTone(1175, 0.12), 120)
  }

  const playMiss = () => {
    if (muted) return
    ensureAudio()
    playTone(196, 0.12)
  }

  const isComplete = matches === pairCount && pairCount > 0

  const difficultyLabel = useMemo(() => {
    if (grid === 4) return 'Quick (Audio)'
    if (grid === 6) return 'Classic (Audio)'
    return 'Custom (Audio)'
  }, [grid])

  useEffect(() => {
    const raw = matches * 140 - moves * 3 - Math.floor(seconds * 0.5)
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
    const tones = shuffle([...TONES]).slice(0, needed)
    const doubled = shuffle([...tones, ...tones])
    return doubled.map((tone, idx) => ({
      id: idx,
      tone,
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
    toneMemoryMap.current.clear()
    
    // Reset session data
    setSessionData({
      sessionStart: Date.now(),
      gridSize: size,
      gamesCompleted: 0,
      auditoryWorkingMemory: {
        totalTonesPresentedPairs: 0,
        correctRecalls: 0,
        incorrectRecalls: 0,
        averageRecallDelay: 0,
        memorySpan: 0,
        decayRate: 0
      },
      auditoryDiscrimination: {
        totalComparisons: 0,
        correctDiscriminations: 0,
        incorrectDiscriminations: 0,
        averageFrequencyDifference: 0,
        discriminationThreshold: 0,
        confusionMatrix: {}
      },
      processingSpeed: {
        averageDecisionTime: 0,
        fastestDecision: 0,
        slowestDecision: 0,
        speedAccuracyTradeoff: 0,
        processingEfficiency: 0
      },
      selectiveAttention: {
        totalAttentionTrials: 0,
        successfulFocus: 0,
        distractionsResisted: 0,
        attentionSustainability: 0,
        focusAccuracy: 0
      },
      pairedAssociationMemory: {
        totalPairs: 0,
        firstAttemptMatches: 0,
        repeatedAttemptMatches: 0,
        falseAlarms: 0,
        associationStrength: 0,
        learningCurve: []
      },
      performanceMetrics: {
        accuracy: 0,
        falseAlarmRate: 0,
        averageTimeToMatch: 0,
        movesToMatchRatio: 0,
        toneRecognitionErrorRate: 0,
        overallEfficiency: 0
      },
      detailedLogs: {
        cardFlips: [],
        pairAttempts: [],
        auditoryMemory: [],
        processingSpeed: [],
        attentionMetrics: []
      }
    })
  }

  useEffect(() => {
    startNewGame(grid)
  }, [])

  const onFlip = (card: Card) => {
    if (locked || card.isMatched || card.isFlipped) return

    ensureAudio()
    const now = Date.now()
    const timeSinceLastFlip = lastFlipTime.current ? now - lastFlipTime.current : 0

    // Track tone memory
    if (!toneMemoryMap.current.has(card.tone)) {
      toneMemoryMap.current.set(card.tone, { firstHeard: now, hearings: 0 })
    }
    const toneInfo = toneMemoryMap.current.get(card.tone)!
    toneInfo.hearings++

    // Calculate memory load
    const currentlyFlipped = deck.filter(c => c.isFlipped && !c.isMatched).length
    const memoryLoad = toneMemoryMap.current.size / pairCount

    // Log card flip event
    const flipEvent: CardFlipEvent = {
      timestamp: now,
      cardId: card.id,
      tone: card.tone,
      pairAttemptNumber: pairAttemptCount.current,
      timeSinceLastFlip,
      currentlyFlippedCards: currentlyFlipped,
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

    playTone(card.tone)

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

      // Calculate frequency difference for auditory discrimination
      const freqDiff = Math.abs(a.tone - b.tone)
      const tonesHeardBefore = 
        (toneMemoryMap.current.get(a.tone)?.hearings || 0) > 1 ||
        (toneMemoryMap.current.get(b.tone)?.hearings || 0) > 1

      // Auditory discrimination difficulty (closer frequencies = harder)
      const discriminationDifficulty = 1 / (1 + freqDiff / 100)

      const success = a.tone === b.tone

      // Log pair attempt
      const pairAttempt: PairAttempt = {
        timestamp: now,
        card1: { id: a.id, tone: a.tone },
        card2: { id: b.id, tone: b.tone },
        success,
        reactionTime,
        attemptNumber: pairAttemptCount.current,
        tonesHeardBefore,
        audioDiscriminationDifficulty: discriminationDifficulty
      }

      // Log auditory memory event
      const recallDelay = now - (toneMemoryMap.current.get(a.tone)?.firstHeard || now)
      const memoryEvent: AuditoryMemoryEvent = {
        timestamp: now,
        tone: a.tone,
        recallDelay,
        correctRecall: success,
        interferenceLevel: toneMemoryMap.current.size
      }

      // Log processing speed
      const processingMetric: ProcessingSpeedMetric = {
        timestamp: now,
        decisionTime: reactionTime,
        complexityLevel: memoryLoad,
        accuracyOnThisTrial: success
      }

      // Log attention metric
      const attentionMetric: AttentionMetric = {
        timestamp: now,
        focusedTone: a.tone,
        distractorCount: deck.filter(c => !c.isMatched && c.tone !== a.tone).length,
        selectiveSuccess: success,
        responseLatency: reactionTime
      }

      setSessionData(prev => ({
        ...prev,
        auditoryWorkingMemory: {
          ...prev.auditoryWorkingMemory,
          totalTonesPresentedPairs: prev.auditoryWorkingMemory.totalTonesPresentedPairs + 1,
          correctRecalls: prev.auditoryWorkingMemory.correctRecalls + (success ? 1 : 0),
          incorrectRecalls: prev.auditoryWorkingMemory.incorrectRecalls + (success ? 0 : 1),
          memorySpan: Math.max(prev.auditoryWorkingMemory.memorySpan, toneMemoryMap.current.size)
        },
        auditoryDiscrimination: {
          ...prev.auditoryDiscrimination,
          totalComparisons: prev.auditoryDiscrimination.totalComparisons + 1,
          correctDiscriminations: prev.auditoryDiscrimination.correctDiscriminations + (success ? 1 : 0),
          incorrectDiscriminations: prev.auditoryDiscrimination.incorrectDiscriminations + (success ? 0 : 1),
          averageFrequencyDifference: prev.auditoryDiscrimination.totalComparisons === 0 
            ? freqDiff 
            : (prev.auditoryDiscrimination.averageFrequencyDifference * prev.auditoryDiscrimination.totalComparisons + freqDiff) / 
              (prev.auditoryDiscrimination.totalComparisons + 1),
          discriminationThreshold: Math.min(
            prev.auditoryDiscrimination.discriminationThreshold || Infinity,
            success ? freqDiff : prev.auditoryDiscrimination.discriminationThreshold || Infinity
          )
        },
        selectiveAttention: {
          ...prev.selectiveAttention,
          totalAttentionTrials: prev.selectiveAttention.totalAttentionTrials + 1,
          successfulFocus: prev.selectiveAttention.successfulFocus + (success ? 1 : 0),
          focusAccuracy: prev.selectiveAttention.totalAttentionTrials === 0
            ? (success ? 100 : 0)
            : ((prev.selectiveAttention.successfulFocus + (success ? 1 : 0)) / 
               (prev.selectiveAttention.totalAttentionTrials + 1)) * 100
        },
        pairedAssociationMemory: {
          ...prev.pairedAssociationMemory,
          totalPairs: prev.pairedAssociationMemory.totalPairs + 1,
          firstAttemptMatches: tonesHeardBefore ? prev.pairedAssociationMemory.firstAttemptMatches : 
            prev.pairedAssociationMemory.firstAttemptMatches + (success ? 1 : 0),
          repeatedAttemptMatches: tonesHeardBefore && success ? 
            prev.pairedAssociationMemory.repeatedAttemptMatches + 1 : 
            prev.pairedAssociationMemory.repeatedAttemptMatches,
          falseAlarms: success ? prev.pairedAssociationMemory.falseAlarms : 
            prev.pairedAssociationMemory.falseAlarms + 1,
          learningCurve: [...prev.pairedAssociationMemory.learningCurve, success ? 1 : 0]
        },
        detailedLogs: {
          ...prev.detailedLogs,
          pairAttempts: [...prev.detailedLogs.pairAttempts, pairAttempt],
          auditoryMemory: [...prev.detailedLogs.auditoryMemory, memoryEvent],
          processingSpeed: [...prev.detailedLogs.processingSpeed, processingMetric],
          attentionMetrics: [...prev.detailedLogs.attentionMetrics, attentionMetric]
        }
      }))

      if (success) {
        setTimeout(() => {
          setDeck(prev =>
            prev.map(c =>
              c.tone === a.tone ? { ...c, isMatched: true } : c
            )
          )
          setMatches(x => x + 1)
          playSuccess()
          resetPicks()
          if (navigator.vibrate) navigator.vibrate(20)
        }, 280)
      } else {
        setTimeout(() => {
          setDeck(prev =>
            prev.map(c =>
              c.id === a.id || c.id === b.id ? { ...c, isFlipped: false } : c
            )
          )
          playMiss()
          resetPicks()
          if (navigator.vibrate) navigator.vibrate(8)
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
          Sound Match
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
          <span>•</span>
          <button
            onClick={() => {
              setMuted(m => !m)
              if (masterGainRef.current) {
                masterGainRef.current.gain.value = !muted ? 0 : 0.25
              }
            }}
            className={classNames(
              'px-2 py-1 rounded border',
              muted ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-blue-500/50 bg-blue-500/10 text-blue-200'
            )}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 text-green-400 font-semibold">{message}</div>
      )}

      <div className="h-10 mb-4 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${started}-${matches}-${moves}-${muted}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-gray-300"
          >
            {isComplete
              ? 'Great ear! All pairs matched 🎉'
              : !started
              ? 'Flip any card to hear its tone'
              : secondPick
              ? 'Listening...'
              : 'Match pairs by sound only'}
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
                  'shadow-[0_0_24px_rgba(168,85,247,0.35)]'
                )}
                variants={backVariants}
                animate={card.isFlipped || card.isMatched ? 'shown' : 'hidden'}
                transition={{ duration: 0.28 }}
              >
                <motion.div
                  className="w-3 h-3 rounded-full bg-white/40"
                  animate={card.isFlipped && !card.isMatched ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.4, repeat: card.isFlipped && !card.isMatched ? Infinity : 0 }}
                />
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
          <h3 className="text-2xl font-bold text-purple-400 mb-4 text-center">🧠 Auditory Cognitive Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-blue-300 mb-2">🎵 Auditory Working Memory</h4>
              <div className="text-white">Tone Pairs: {sessionData.auditoryWorkingMemory.totalTonesPresentedPairs}</div>
              <div className="text-green-400">Correct: {sessionData.auditoryWorkingMemory.correctRecalls}</div>
              <div className="text-red-400">Incorrect: {sessionData.auditoryWorkingMemory.incorrectRecalls}</div>
              <div className="text-gray-300">Memory Span: {sessionData.auditoryWorkingMemory.memorySpan}</div>
              <div className="text-gray-300">
                Accuracy: {sessionData.auditoryWorkingMemory.totalTonesPresentedPairs > 0 
                  ? Math.round((sessionData.auditoryWorkingMemory.correctRecalls / sessionData.auditoryWorkingMemory.totalTonesPresentedPairs) * 100) 
                  : 0}%
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-purple-300 mb-2">🎧 Auditory Discrimination</h4>
              <div className="text-white">Comparisons: {sessionData.auditoryDiscrimination.totalComparisons}</div>
              <div className="text-green-400">Correct: {sessionData.auditoryDiscrimination.correctDiscriminations}</div>
              <div className="text-red-400">Incorrect: {sessionData.auditoryDiscrimination.incorrectDiscriminations}</div>
              <div className="text-gray-300">
                Avg Freq Diff: {Math.round(sessionData.auditoryDiscrimination.averageFrequencyDifference)}Hz
              </div>
              <div className="text-gray-300">
                Accuracy: {sessionData.auditoryDiscrimination.totalComparisons > 0
                  ? Math.round((sessionData.auditoryDiscrimination.correctDiscriminations / sessionData.auditoryDiscrimination.totalComparisons) * 100)
                  : 0}%
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-pink-300 mb-2">⚡ Processing Speed</h4>
              <div className="text-white">Decisions: {sessionData.detailedLogs.processingSpeed.length}</div>
              <div className="text-gray-300">
                Avg: {sessionData.detailedLogs.processingSpeed.length > 0
                  ? Math.round(sessionData.detailedLogs.processingSpeed.reduce((a, b) => a + b.decisionTime, 0) / sessionData.detailedLogs.processingSpeed.length)
                  : 0}ms
              </div>
              <div className="text-gray-300">
                Fastest: {sessionData.detailedLogs.processingSpeed.length > 0
                  ? Math.min(...sessionData.detailedLogs.processingSpeed.map(p => p.decisionTime))
                  : 0}ms
              </div>
              <div className="text-gray-300">
                Slowest: {sessionData.detailedLogs.processingSpeed.length > 0
                  ? Math.max(...sessionData.detailedLogs.processingSpeed.map(p => p.decisionTime))
                  : 0}ms
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-yellow-300 mb-2">🎯 Selective Attention</h4>
              <div className="text-white">Trials: {sessionData.selectiveAttention.totalAttentionTrials}</div>
              <div className="text-green-400">Successful: {sessionData.selectiveAttention.successfulFocus}</div>
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
              <h4 className="font-bold text-green-300 mb-2">🔗 Paired Association Memory</h4>
              <div className="text-white">Total Pairs: {sessionData.pairedAssociationMemory.totalPairs}</div>
              <div className="text-green-400">1st Attempt: {sessionData.pairedAssociationMemory.firstAttemptMatches}</div>
              <div className="text-yellow-400">Repeated: {sessionData.pairedAssociationMemory.repeatedAttemptMatches}</div>
              <div className="text-red-400">False Alarms: {sessionData.pairedAssociationMemory.falseAlarms}</div>
              <div className="text-gray-300">
                Learning Rate: {sessionData.pairedAssociationMemory.learningCurve.length > 0
                  ? Math.round((sessionData.pairedAssociationMemory.learningCurve.filter(x => x === 1).length / sessionData.pairedAssociationMemory.learningCurve.length) * 100)
                  : 0}%
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-orange-300 mb-2">📊 Performance Metrics</h4>
              <div className="text-white">
                Accuracy: {sessionData.detailedLogs.pairAttempts.length > 0
                  ? Math.round((sessionData.detailedLogs.pairAttempts.filter(p => p.success).length / sessionData.detailedLogs.pairAttempts.length) * 100)
                  : 0}%
              </div>
              <div className="text-gray-300">
                False Alarm Rate: {sessionData.detailedLogs.pairAttempts.length > 0
                  ? Math.round((sessionData.pairedAssociationMemory.falseAlarms / sessionData.detailedLogs.pairAttempts.length) * 100)
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
            </div>

            <div className="bg-white/10 rounded-lg p-4 md:col-span-2 lg:col-span-1">
              <h4 className="font-bold text-indigo-300 mb-2">👤 User Progress</h4>
              {userId && userStats ? (
                <>
                  <div className="text-white">Games: {userStats.totalGamesPlayed || 0}</div>
                  <div className="text-green-400">Best Accuracy: {Math.round(userStats.bestAccuracy || 0)}%</div>
                  <div className="text-gray-300">Avg Decision: {Math.round(userStats.averageDecisionTime || 0)}ms</div>
                  <div className="text-gray-300">Memory Score: {Math.round(userStats.auditoryMemoryScore || 0)}%</div>
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
                  <div className="font-bold text-lg text-white">{Math.round(userStats.averageDecisionTime || 0)}ms</div>
                  <div className="text-gray-300">Avg Speed</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.auditoryMemoryScore || 0)}%</div>
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
                <div className="flex justify-between"><span>Audio</span><span>{muted ? 'Muted' : 'On'}</span></div>
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