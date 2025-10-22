'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import classNames from 'classnames'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const gridSize = 2 // 2x2 grid
const totalTiles = gridSize * gridSize
const maxLevel = 12 // Increased for teens
const maxErrors = 3 // More forgiving for teens

interface CognitiveMetrics {
  totalPlayTime: number
  averageReactionTime: number
  reactionTimes: number[]
  maxLevelReached: number
  totalResets: number
  correctSequences: number
  incorrectSequences: number
  currentStreak: number
  bestStreak: number
  startTime: number
  levelStartTime: number
  accuracyByLevel: { [key: number]: number }
  patternRecallScore: number
}

interface UserStats {
  bestLevel: number
  totalSessionsPlayed: number
  totalPatternsCompleted: number
  totalPlayTime: number
  averageReactionTime: number
  averageAccuracy: number
  bestStreak: number
  bestPatternScore: number
  lastPlayed: string
  sessions: any[]
  cognitiveProfile: {
    visualMemorySpan: number
    patternRecognition: number
    sequentialProcessing: number
    visualAttention: number
    spatialMemory: number
  }
}

interface SessionData {
  sessionOverview: {
    sessionStart: number
    sessionEnd: number
    totalSessionDuration: number
    gameType: string
    completionStatus: string
  }
  performance: {
    maxLevelReached: number
    currentLevel: number
    correctSequences: number
    incorrectSequences: number
    totalResets: number
    currentStreak: number
    bestStreak: number
    accuracy: number
    averageReactionTime: number
    patternRecallScore: number
    totalPlayTime: number
    errorRate: number
  }
  cognitiveMetrics: {
    visualMemorySpan: number
    sequentialProcessing: number
    spatialMemory: number
    patternRecognition: number
    accuracyByLevel: { [key: number]: number }
    reactionTimeConsistency: number
    learningEfficiency: number
    attentionSustained: number
  }
  detailedLogs: {
    reactionTimes: number[]
    levelProgression: Array<{ level: number; accuracy: number; completed: boolean }>
    errorPattern: {
      totalErrors: number
      errorRate: number
      resetFrequency: number
      consistencyIndex: number
    }
    performanceOverTime: Array<{ attempt: number; reactionTime: number; timestamp: number; level: number }>
    spatialSequences: {
      maxSequenceLength: number
      spatialComplexity: number
      memorySpan: number
      visualProcessingSpeed: number
      spatialAccuracy: number
    }
  }
}

interface PerformanceLevel {
  level: string
  color: string
  emoji: string
}

export default function EnhancedMemoryTestPage() {
  const router = useRouter()
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [activeTile, setActiveTile] = useState<number | null>(null)
  const [isShowingSequence, setIsShowingSequence] = useState<boolean>(false)
  const [level, setLevel] = useState<number>(1)
  const [errors, setErrors] = useState<number>(0)
  const [message, setMessage] = useState<string>('Get ready to watch the pattern')
  const [resetCount, setResetCount] = useState<number>(0)
  const [gameState, setGameState] = useState<'waiting' | 'showing' | 'playing' | 'complete'>('waiting')
  const [showStats, setShowStats] = useState<boolean>(false)
  const [gameStarted, setGameStarted] = useState<boolean>(false)

  const [metrics, setMetrics] = useState<CognitiveMetrics>({
    totalPlayTime: 0,
    averageReactionTime: 0,
    reactionTimes: [],
    maxLevelReached: 1,
    totalResets: 0,
    correctSequences: 0,
    incorrectSequences: 0,
    currentStreak: 0,
    bestStreak: 0,
    startTime: Date.now(),
    levelStartTime: Date.now(),
    accuracyByLevel: {},
    patternRecallScore: 0
  })

  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')

  const levelStartTimeRef = useRef<number>(Date.now())
  const firstClickTimeRef = useRef<number | null>(null)

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
          if (data.patternMemoryGame) {
            setUserStats(data.patternMemoryGame as UserStats)
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  // Save session data to Firestore
  const saveSessionData = async (sessionMetrics: SessionData) => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('patternMemorySessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10) // Keep last 10 sessions
      localStorage.setItem('patternMemorySessions', JSON.stringify(updatedSessions))
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      // Calculate session stats
      const sessionDuration = sessionMetrics.sessionOverview.totalSessionDuration
      const avgReactionTime = sessionMetrics.performance.averageReactionTime
      const maxLevel = sessionMetrics.performance.maxLevelReached
      const accuracy = sessionMetrics.performance.accuracy
      const patternScore = sessionMetrics.performance.patternRecallScore

      // Update user's game stats
      await setDoc(userDocRef, {
        patternMemoryGame: {
          bestLevel: Math.max(maxLevel, userStats?.bestLevel || 0),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalPatternsCompleted: (userStats?.totalPatternsCompleted || 0) + sessionMetrics.performance.correctSequences,
          totalPlayTime: (userStats?.totalPlayTime || 0) + sessionDuration,
          averageReactionTime: calculateRunningAverage(
            userStats?.averageReactionTime || 0,
            userStats?.totalSessionsPlayed || 0,
            avgReactionTime
          ),
          averageAccuracy: calculateRunningAverage(
            userStats?.averageAccuracy || 0,
            userStats?.totalSessionsPlayed || 0,
            accuracy
          ),
          bestStreak: Math.max(sessionMetrics.performance.bestStreak, userStats?.bestStreak || 0),
          bestPatternScore: Math.max(patternScore, userStats?.bestPatternScore || 0),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), sessionMetrics].slice(-10), // Keep last 10 sessions
          cognitiveProfile: {
            visualMemorySpan: maxLevel,
            patternRecognition: patternScore,
            sequentialProcessing: avgReactionTime,
            visualAttention: accuracy,
            spatialMemory: calculateSpatialMemoryScore(sessionMetrics)
          }
        }
      }, { merge: true })

      // Save detailed session data in separate collection
     await addDoc(collection(db, 'users', userId, 'gameSessionsDetailed'), {
        userId,
        gameType: 'patternMemory',
        ...sessionMetrics,
        createdAt: new Date()
      })

      console.log('Pattern memory session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data. Your progress may not be synced.')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('patternMemorySessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10)
      localStorage.setItem('patternMemorySessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to calculate running average
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  // Helper function to calculate spatial memory score
  const calculateSpatialMemoryScore = (sessionMetrics: SessionData): number => {
    const levelWeights = Object.entries(sessionMetrics.cognitiveMetrics.accuracyByLevel || {})
    if (levelWeights.length === 0) return 0
    
    return Math.round(levelWeights.reduce((sum, [level, accuracy]) => {
      return sum + (parseInt(level) * (accuracy as number) / 100)
    }, 0))
  }

  // Generate session data for saving
  const generateSessionData = (): SessionData => {
    const sessionEnd = Date.now()
    const totalDuration = sessionEnd - metrics.startTime
    const accuracy = metrics.correctSequences + metrics.incorrectSequences > 0 ? 
      (metrics.correctSequences / (metrics.correctSequences + metrics.incorrectSequences)) * 100 : 0

    return {
      sessionOverview: {
        sessionStart: metrics.startTime,
        sessionEnd,
        totalSessionDuration: totalDuration,
        gameType: 'patternMemory',
        completionStatus: gameState === 'complete' ? 'completed' : 'incomplete'
      },
      performance: {
        maxLevelReached: metrics.maxLevelReached,
        currentLevel: level,
        correctSequences: metrics.correctSequences,
        incorrectSequences: metrics.incorrectSequences,
        totalResets: metrics.totalResets,
        currentStreak: metrics.currentStreak,
        bestStreak: metrics.bestStreak,
        accuracy: Math.round(accuracy),
        averageReactionTime: Math.round(metrics.averageReactionTime),
        patternRecallScore: metrics.patternRecallScore,
        totalPlayTime: totalDuration,
        errorRate: Math.round(100 - accuracy)
      },
      cognitiveMetrics: {
        visualMemorySpan: metrics.maxLevelReached,
        sequentialProcessing: metrics.averageReactionTime,
        spatialMemory: calculateSpatialMemoryIndex(),
        patternRecognition: metrics.patternRecallScore,
        accuracyByLevel: metrics.accuracyByLevel,
        reactionTimeConsistency: calculateReactionTimeConsistency(),
        learningEfficiency: calculateLearningEfficiency(),
        attentionSustained: totalDuration
      },
      detailedLogs: {
        reactionTimes: metrics.reactionTimes,
        levelProgression: generateLevelProgression(),
        errorPattern: generateErrorPattern(),
        performanceOverTime: generatePerformanceOverTime(),
        spatialSequences: generateSpatialSequenceAnalysis()
      }
    }
  }

  // Helper functions for cognitive analysis
  const calculateSpatialMemoryIndex = (): number => {
    const levelAccuracies = Object.entries(metrics.accuracyByLevel)
    if (levelAccuracies.length === 0) return 0
    
    return Math.round(levelAccuracies.reduce((sum, [level, accuracy]) => {
      return sum + (parseInt(level) * accuracy / 100)
    }, 0))
  }

  const calculateReactionTimeConsistency = (): number => {
    if (metrics.reactionTimes.length < 2) return 100
    const mean = metrics.averageReactionTime
    const variance = metrics.reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / metrics.reactionTimes.length
    const cv = Math.sqrt(variance) / mean // Coefficient of variation
    return Math.round(Math.max(0, 100 - (cv * 100)))
  }

  const calculateLearningEfficiency = (): number => {
    if (metrics.maxLevelReached <= 1) return 0
    const totalAttempts = metrics.correctSequences + metrics.incorrectSequences + metrics.totalResets
    return Math.round((metrics.maxLevelReached / Math.max(totalAttempts, 1)) * 100)
  }

  const generateLevelProgression = (): Array<{ level: number; accuracy: number; completed: boolean }> => {
    return Object.entries(metrics.accuracyByLevel).map(([level, accuracy]) => ({
      level: parseInt(level),
      accuracy: Math.round(accuracy),
      completed: accuracy > 0
    }))
  }

  const generateErrorPattern = () => {
    return {
      totalErrors: metrics.incorrectSequences,
      errorRate: metrics.correctSequences + metrics.incorrectSequences > 0 ? 
        (metrics.incorrectSequences / (metrics.correctSequences + metrics.incorrectSequences)) * 100 : 0,
      resetFrequency: metrics.totalResets,
      consistencyIndex: metrics.currentStreak > 0 ? Math.min(100, metrics.currentStreak * 20) : 0
    }
  }

  const generatePerformanceOverTime = (): Array<{ attempt: number; reactionTime: number; timestamp: number; level: number }> => {
    return metrics.reactionTimes.map((rt, index) => ({
      attempt: index + 1,
      reactionTime: rt,
      timestamp: metrics.startTime + (index * 8000), // Estimated based on sequence timing
      level: Math.min(index + 1, maxLevel)
    }))
  }

  const generateSpatialSequenceAnalysis = () => {
    return {
      maxSequenceLength: metrics.maxLevelReached,
      spatialComplexity: metrics.maxLevelReached * totalTiles,
      memorySpan: metrics.maxLevelReached,
      visualProcessingSpeed: metrics.averageReactionTime,
      spatialAccuracy: Object.values(metrics.accuracyByLevel).length > 0 ? 
        Object.values(metrics.accuracyByLevel).reduce((a, b) => a + b, 0) / Object.values(metrics.accuracyByLevel).length : 0
    }
  }

  // Auto-save when returning to game selection or completing
  const handleReturnToGameSelection = async (): Promise<void> => {
    if (gameStarted && (metrics.correctSequences > 0 || metrics.incorrectSequences > 0)) {
      const sessionData = generateSessionData()
      await saveSessionData(sessionData)
    }
    router.push('/Prep/PrepGames/GameSelection')
  }

  // Auto-save when game completes
  const handleGameComplete = async (destination: string): Promise<void> => {
    if (gameStarted && (metrics.correctSequences > 0 || metrics.incorrectSequences > 0)) {
      const sessionData = generateSessionData()
      await saveSessionData(sessionData)
    }
    router.push(destination)
  }

  useEffect(() => {
    if (gameStarted) {
      setTimeout(() => startNewLevel(1), 1000)
    }
  }, [gameStarted])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (gameStarted && gameState === 'playing') {
      interval = setInterval(() => {
        setMetrics(prev => ({
          ...prev,
          totalPlayTime: Date.now() - prev.startTime
        }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [gameStarted, gameState])

  const startGame = (): void => {
    setGameStarted(true)
    setSaveError('')
    setMetrics(prev => ({
      ...prev,
      startTime: Date.now()
    }))
  }

  const startNewLevel = (newLevel: number): void => {
    const newSequence = Array.from({ length: newLevel }, () => Math.floor(Math.random() * totalTiles))
    setSequence(newSequence)
    setUserInput([])
    setIsShowingSequence(true)
    setGameState('showing')
    setMessage(`Level ${newLevel} - Watch the pattern`)
    firstClickTimeRef.current = null
    levelStartTimeRef.current = Date.now()
    
    // Update max level reached
    setMetrics(prev => ({
      ...prev,
      maxLevelReached: Math.max(prev.maxLevelReached, newLevel),
      levelStartTime: Date.now()
    }))
    
    // Small delay before starting sequence
    setTimeout(() => playSequence(newSequence), 500)
  }

  const playSequence = async (seq: number[]): Promise<void> => {
    for (let i = 0; i < seq.length; i++) {
      setActiveTile(seq[i])
      await new Promise((res) => setTimeout(res, 800))
      setActiveTile(null)
      await new Promise((res) => setTimeout(res, 400))
    }
    setIsShowingSequence(false)
    setGameState('playing')
    setMessage('Now repeat the pattern')
    levelStartTimeRef.current = Date.now() // Reset timer for input phase
  }

  const handleTileClick = (index: number): void => {
    if (isShowingSequence || activeTile !== null || gameState !== 'playing') return

    const clickTime = Date.now()
    if (firstClickTimeRef.current === null) {
      firstClickTimeRef.current = clickTime - levelStartTimeRef.current
    }

    const newInput = [...userInput, index]
    setUserInput(newInput)

    // Check if the current input is correct
    if (sequence[newInput.length - 1] !== index) {
      const totalReactionTime = clickTime - levelStartTimeRef.current
      const newErrorCount = errors + 1
      setErrors(newErrorCount)
      
      // Update metrics for incorrect sequence
      setMetrics(prev => {
        const newReactionTimes = [...prev.reactionTimes, totalReactionTime]
        const newAccuracy = prev.accuracyByLevel[level] || 0
        
        return {
          ...prev,
          reactionTimes: newReactionTimes,
          averageReactionTime: newReactionTimes.reduce((a, b) => a + b, 0) / newReactionTimes.length,
          incorrectSequences: prev.incorrectSequences + 1,
          currentStreak: 0,
          accuracyByLevel: {
            ...prev.accuracyByLevel,
            [level]: Math.max(0, newAccuracy - 20) // Penalty for wrong answer
          }
        }
      })
      
      if (newErrorCount >= maxErrors) {
        setMessage('Maximum errors reached. Moving to next section...')
        setGameState('complete')
        setTimeout(() => handleGameComplete('/info_pages/cognition_preference'), 2000)
      } else {
        setMessage(`Incorrect! ${maxErrors - newErrorCount} attempt${maxErrors - newErrorCount === 1 ? '' : 's'} remaining...`)
        setTimeout(() => {
          setLevel(1)
          setErrors(0)
          startNewLevel(1)
        }, 1500)
      }
      return
    }

    // Check if sequence is complete
    if (newInput.length === sequence.length) {
      const totalReactionTime = clickTime - levelStartTimeRef.current
      
      // Update metrics for correct sequence
      setMetrics(prev => {
        const newReactionTimes = [...prev.reactionTimes, totalReactionTime]
        const newCurrentStreak = prev.currentStreak + 1
        const newBestStreak = Math.max(prev.bestStreak, newCurrentStreak)
        const currentAccuracy = prev.accuracyByLevel[level] || 0
        
        return {
          ...prev,
          reactionTimes: newReactionTimes,
          averageReactionTime: newReactionTimes.reduce((a, b) => a + b, 0) / newReactionTimes.length,
          correctSequences: prev.correctSequences + 1,
          currentStreak: newCurrentStreak,
          bestStreak: newBestStreak,
          accuracyByLevel: {
            ...prev.accuracyByLevel,
            [level]: Math.min(100, currentAccuracy + (100 / sequence.length)) // Award points based on sequence length
          },
          patternRecallScore: prev.patternRecallScore + (level * 10) // Bonus points for longer sequences
        }
      })
      
      if (sequence.length === maxLevel) {
        setMessage('Excellent! All levels complete! Moving to next section...')
        setGameState('complete')
        setTimeout(() => handleGameComplete('/info_pages/yourcognition'), 2000)
        return
      }
      
      setMessage(`Perfect! ${firstClickTimeRef.current ? `(${(firstClickTimeRef.current / 1000).toFixed(1)}s)` : ''} Get ready for the next round...`)
      setTimeout(() => {
        const nextLevel = level + 1
        setLevel(nextLevel)
        setErrors(0)
        startNewLevel(nextLevel)
      }, 1500)
    }
  }

  const resetGame = (): void => {
    const newResetCount = resetCount + 1
    setResetCount(newResetCount)
    
    setMetrics(prev => ({
      ...prev,
      totalResets: prev.totalResets + 1
    }))
    
    if (newResetCount > 4) { // More attempts for teens
      setMessage('Moving to next section...')
      setGameState('complete')
      setTimeout(() => handleGameComplete('/info_pages/yourcognition'), 2000)
      return
    }
    
    setLevel(1)
    setErrors(0)
    setUserInput([])
    setActiveTile(null)
    setGameState('waiting')
    setMessage('Get ready to watch the pattern')
    setTimeout(() => startNewLevel(1), 1000)
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  const getPerformanceLevel = (): PerformanceLevel => {
    if (metrics.maxLevelReached >= 10) return { level: 'Elite', color: 'text-purple-400', emoji: '🏆' }
    if (metrics.maxLevelReached >= 8) return { level: 'Expert', color: 'text-yellow-400', emoji: '⭐' }
    if (metrics.maxLevelReached >= 6) return { level: 'Advanced', color: 'text-blue-400', emoji: '🎯' }
    if (metrics.maxLevelReached >= 4) return { level: 'Intermediate', color: 'text-green-400', emoji: '📈' }
    return { level: 'Beginner', color: 'text-gray-400', emoji: '🌱' }
  }

  if (!gameStarted) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
        {/* Loading and Error indicators */}
        {isLoading && (
          <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            💾 Saving session data...
          </div>
        )}
        
        {saveError && (
          <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            ⚠️ {saveError}
          </div>
        )}

        <div className="text-center max-w-2xl">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Pattern Memory Test
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Test your visual memory and pattern recognition skills!
          </p>
          
          {userId && userStats && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3 text-blue-400">Your Progress</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{userStats.bestLevel || 1}</div>
                  <div className="text-gray-400">Best Level</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{userStats.bestStreak || 0}</div>
                  <div className="text-gray-400">Best Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{Math.round(userStats.averageAccuracy || 0)}%</div>
                  <div className="text-gray-400">Avg Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{userStats.bestPatternScore || 0}</div>
                  <div className="text-gray-400">Best Score</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold mb-3 text-blue-400">How it works:</h2>
            <ul className="space-y-2 text-gray-300">
              <li>• Watch as tiles light up in sequence</li>
              <li>• Repeat the exact pattern by clicking the tiles</li>
              <li>• Each level adds one more step to remember</li>
              <li>• Your memory span and reaction time are measured</li>
              {!userId && (
                <li className="text-orange-400">• Sign in to save your progress!</li>
              )}
            </ul>
          </div>
          
          <div className="flex gap-4 justify-center">
            <motion.button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-white font-semibold text-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Test 🧠
            </motion.button>
            
            <button
              onClick={handleReturnToGameSelection}
              className="px-6 py-4 bg-gray-600/80 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-200"
            >
              🏠 Return to Game Selection
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white font-sans flex flex-col items-center justify-center p-6">
      {/* Loading and Error indicators */}
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          💾 Saving session data...
        </div>
      )}
      
      {saveError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          ⚠️ {saveError}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Pattern Memory Test
        </h1>
        <div className="flex items-center justify-center gap-4 text-lg">
          <span>Level {level}</span>
          <span className="text-gray-400">•</span>
          <span className={getPerformanceLevel().color}>
            {getPerformanceLevel().emoji} {getPerformanceLevel().level}
          </span>
          {userId && <span className="text-green-400">• ✅ Synced</span>}
          {!userId && <span className="text-orange-400">• 📱 Local</span>}
        </div>
      </div>

      {/* Live stats bar */}
      <div className="flex gap-4 mb-4 text-sm text-gray-400">
        <span>Streak: {metrics.currentStreak}</span>
        <span>•</span>
        <span>Time: {formatTime(metrics.totalPlayTime)}</span>
        <span>•</span>
        <span>Accuracy: {metrics.correctSequences + metrics.incorrectSequences > 0 ? 
          Math.round((metrics.correctSequences / (metrics.correctSequences + metrics.incorrectSequences)) * 100) : 0}%</span>
      </div>

      <div className="mb-8 text-gray-300 text-center h-12 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p 
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            {message}
          </motion.p>
        </AnimatePresence>
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {Array.from({ length: totalTiles }, (_, idx) => (
          <motion.div
            key={idx}
            onClick={() => handleTileClick(idx)}
            className={classNames(
              'w-28 h-28 rounded-lg cursor-pointer transition-all duration-200 border-2',
              {
                'bg-blue-500 border-blue-400 scale-95 shadow-lg': activeTile === idx,
                'bg-green-600 border-green-400': userInput.includes(idx) && activeTile !== idx,
                'bg-gray-800 border-gray-600 hover:bg-gray-700 hover:border-gray-500': 
                  !userInput.includes(idx) && activeTile !== idx,
                'cursor-not-allowed': isShowingSequence || gameState !== 'playing'
              }
            )}
            whileHover={isShowingSequence || gameState !== 'playing' ? {} : { scale: 1.05 }}
            whileTap={isShowingSequence || gameState !== 'playing' ? {} : { scale: 0.95 }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-4 mb-8 h-20 justify-center">
        <div className="flex gap-4 items-center">
          <button
            onClick={resetGame}
            disabled={gameState === 'complete'}
            className="px-6 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Test
          </button>
          
          <button
            onClick={handleReturnToGameSelection}
            className="px-6 py-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-lg transition-all duration-200"
          >
            🏠 Return to Game Selection
          </button>
          
          <div className="text-sm text-gray-400 flex items-center">
            Errors: {errors}/{maxErrors}
          </div>
        </div>
      </div>

      {/* Level indicator */}
      <div className="mb-8 h-8 flex items-center justify-center">
        <div className="flex gap-1">
          {Array.from({ length: maxLevel }, (_, i) => (
            <motion.div
              key={i}
              className={classNames('w-3 h-3 rounded-full', {
                'bg-green-500': i < level - 1,
                'bg-blue-500': i === level - 1,
                'bg-gray-600': i >= level
              })}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
            />
          ))}
        </div>
      </div>

      {/* Stats button */}
      <button
        onClick={() => setShowStats(!showStats)}
        className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors font-semibold"
      >
        📊 View Cognitive Metrics
      </button>

      {/* Detailed Stats Panel */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowStats(false)}
          >
            <motion.div
              className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 text-center">Cognitive Metrics</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Max Level:</span>
                  <span className="font-semibold">{metrics.maxLevelReached}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Streak:</span>
                  <span className="font-semibold">{metrics.currentStreak}</span>
                </div>
                <div className="flex justify-between">
                  <span>Best Streak:</span>
                  <span className="font-semibold">{metrics.bestStreak}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Resets:</span>
                  <span className="font-semibold">{metrics.totalResets}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pattern Recall Score:</span>
                  <span className="font-semibold">{metrics.patternRecallScore}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Reaction Time:</span>
                  <span className="font-semibold">
                    {metrics.averageReactionTime ? (metrics.averageReactionTime / 1000).toFixed(1) : '0'}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Test Time:</span>
                  <span className="font-semibold">{formatTime(metrics.totalPlayTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Overall Accuracy:</span>
                  <span className="font-semibold">
                    {metrics.correctSequences + metrics.incorrectSequences > 0 ? 
                      Math.round((metrics.correctSequences / (metrics.correctSequences + metrics.incorrectSequences)) * 100) : 0}%
                  </span>
                </div>
                
                {/* Performance by level */}
                {Object.keys(metrics.accuracyByLevel).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <h3 className="text-sm font-semibold mb-2 text-blue-400">Performance by Level:</h3>
                    {Object.entries(metrics.accuracyByLevel).map(([level, accuracy]) => (
                      <div key={level} className="flex justify-between text-sm">
                        <span>Level {level}:</span>
                        <span>{Math.round(accuracy)}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Personal bests if logged in */}
                {userId && userStats && (
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <h3 className="text-sm font-semibold mb-2 text-green-400">Personal Bests:</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Best Level Ever:</span>
                        <span className="font-semibold text-yellow-400">{userStats.bestLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Best Pattern Score:</span>
                        <span className="font-semibold">{userStats.bestPatternScore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sessions Played:</span>
                        <span className="font-semibold">{userStats.totalSessionsPlayed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Accuracy:</span>
                        <span className="font-semibold">{Math.round(userStats.averageAccuracy)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowStats(false)}
                className="w-full mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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