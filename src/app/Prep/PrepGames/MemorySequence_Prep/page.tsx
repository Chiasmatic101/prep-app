'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import classNames from 'classnames'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface Card {
  id: number
  number: number
  revealed: boolean
  correctIndex: number
}

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
}

interface UserStats {
  bestLevel: number
  totalSessionsPlayed: number
  totalSequencesCompleted: number
  totalPlayTime: number
  averageReactionTime: number
  averageAccuracy: number
  bestStreak: number
  lastPlayed: string
  sessions: any[]
  cognitiveProfile: {
    workingMemoryCapacity: number
    processingSpeed: number
    attentionSustained: number
    executiveControl: number
    learningEfficiency: number
  }
}

interface SessionData {
  sessionOverview: {
    sessionStart: number
    sessionEnd: number
    totalSessionDuration: number
    gameType: string
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
    totalPlayTime: number
  }
  cognitiveMetrics: {
    workingMemorySpan: number
    processingSpeed: number
    reactionTimeVariability: number
    errorRate: number
    learningCurve: number
    attentionStability: number
  }
  detailedLogs: {
    reactionTimes: number[]
    levelProgression: Array<{ level: number; attempts: number; completed: boolean }>
    errorPattern: {
      totalErrors: number
      errorRate: number
      consistencyIndex: number
    }
    performanceOverTime: Array<{ attempt: number; reactionTime: number; timestamp: number }>
  }
}

interface PerformanceLevel {
  level: string
  color: string
  emoji: string
}

export default function EnhancedMemoryGame() {
  const router = useRouter()
  const [level, setLevel] = useState<number>(3) // Start at level 3 for teens
  const [cards, setCards] = useState<Card[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [locked, setLocked] = useState<boolean>(true)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [isFlipping, setIsFlipping] = useState<boolean>(false)
  const [showStats, setShowStats] = useState<boolean>(false)
  const [gameStarted, setGameStarted] = useState<boolean>(false)
  
  const [metrics, setMetrics] = useState<CognitiveMetrics>({
    totalPlayTime: 0,
    averageReactionTime: 0,
    reactionTimes: [],
    maxLevelReached: 3,
    totalResets: 0,
    correctSequences: 0,
    incorrectSequences: 0,
    currentStreak: 0,
    bestStreak: 0,
    startTime: Date.now(),
    levelStartTime: Date.now()
  })

  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')

  const firstClickTimeRef = useRef<number | null>(null)
  const levelStartTimeRef = useRef<number>(Date.now())

  // Simplified Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)
      } else {
        setUserId(null)
      }
    })
    
    return () => unsubscribe()
  }, [])

  // Auto-load user stats when userId changes
  useEffect(() => {
    if (!userId) {
      setUserStats(null)
      return
    }

    const userDocRef = doc(db, 'users', userId)
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        if (data?.memoryGame) {
          setUserStats(data.memoryGame as UserStats)
        }
      } else {
        setUserStats(null)
      }
    }, (error) => {
      console.error('Error listening to user stats:', error)
      setUserStats(null)
    })

    return () => unsubscribe()
  }, [userId])

  // Save session data to Firestore
  const saveSessionData = async (sessionMetrics: SessionData) => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('memorySessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10) // Keep last 10 sessions
      localStorage.setItem('memorySessions', JSON.stringify(updatedSessions))
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

      // Update user's game stats
      await setDoc(userDocRef, {
        memoryGame: {
          bestLevel: Math.max(maxLevel, userStats?.bestLevel || 0),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalSequencesCompleted: (userStats?.totalSequencesCompleted || 0) + sessionMetrics.performance.correctSequences,
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
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), sessionMetrics].slice(-10), // Keep last 10 sessions
          cognitiveProfile: {
            workingMemoryCapacity: maxLevel,
            processingSpeed: avgReactionTime,
            attentionSustained: sessionDuration,
            executiveControl: accuracy,
            learningEfficiency: sessionMetrics.performance.currentStreak
          }
        }
      }, { merge: true })

      // Save detailed session data in separate collection
      await addDoc(collection(db, 'users', userId, 'gameSessionsDetailed'), {
        userId,
        gameType: 'memoryChallenge',
        ...sessionMetrics,
        createdAt: new Date()
      })

      console.log('Memory game session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data. Your progress may not be synced.')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('memorySessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10)
      localStorage.setItem('memorySessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to calculate running average
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
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
        gameType: 'memoryChallenge'
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
        totalPlayTime: totalDuration
      },
      cognitiveMetrics: {
        workingMemorySpan: metrics.maxLevelReached,
        processingSpeed: metrics.averageReactionTime,
        reactionTimeVariability: calculateReactionTimeVariability(),
        errorRate: Math.round(100 - accuracy),
        learningCurve: calculateLearningCurve(),
        attentionStability: calculateAttentionStability()
      },
      detailedLogs: {
        reactionTimes: metrics.reactionTimes,
        levelProgression: generateLevelProgression(),
        errorPattern: generateErrorPattern(),
        performanceOverTime: generatePerformanceOverTime()
      }
    }
  }

  // Helper functions for cognitive analysis
  const calculateReactionTimeVariability = (): number => {
    if (metrics.reactionTimes.length < 2) return 0
    const mean = metrics.averageReactionTime
    const variance = metrics.reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - mean, 2), 0) / metrics.reactionTimes.length
    return Math.round(Math.sqrt(variance))
  }

  const calculateLearningCurve = (): number => {
    const totalAttempts = metrics.correctSequences + metrics.incorrectSequences
    if (totalAttempts === 0) return 0
    return Math.round((metrics.maxLevelReached / totalAttempts) * 100)
  }

  const calculateAttentionStability = (): number => {
    if (metrics.reactionTimes.length < 3) return 100
    const recentRTs = metrics.reactionTimes.slice(-5)
    const avgRecent = recentRTs.reduce((a, b) => a + b, 0) / recentRTs.length
    const stability = 100 - Math.min(100, Math.abs(avgRecent - metrics.averageReactionTime) / metrics.averageReactionTime * 100)
    return Math.round(stability)
  }

  const generateLevelProgression = (): Array<{ level: number; attempts: number; completed: boolean }> => {
    // Simplified level progression tracking
    return Array.from({ length: metrics.maxLevelReached - 2 }, (_, i) => ({
      level: i + 3,
      attempts: 1, // Simplified
      completed: true
    }))
  }

  const generateErrorPattern = () => {
    return {
      totalErrors: metrics.incorrectSequences,
      errorRate: metrics.correctSequences + metrics.incorrectSequences > 0 ? 
        (metrics.incorrectSequences / (metrics.correctSequences + metrics.incorrectSequences)) * 100 : 0,
      consistencyIndex: metrics.currentStreak > 0 ? Math.min(100, metrics.currentStreak * 10) : 0
    }
  }

  const generatePerformanceOverTime = (): Array<{ attempt: number; reactionTime: number; timestamp: number }> => {
    return metrics.reactionTimes.map((rt, index) => ({
      attempt: index + 1,
      reactionTime: rt,
      timestamp: metrics.startTime + (index * 5000) // Estimated
    }))
  }

  // Auto-save when returning to game selection
  const handleReturnToGameSelection = async (): Promise<void> => {
    if (gameStarted && (metrics.correctSequences > 0 || metrics.incorrectSequences > 0)) {
      const sessionData = generateSessionData()
      await saveSessionData(sessionData)
    }
    router.push('/Prep/PrepGames/GameSelection')
  }

  // Auto-save when exiting game
  const handleEndSession = async (): Promise<void> => {
    if (gameStarted && (metrics.correctSequences > 0 || metrics.incorrectSequences > 0)) {
      const sessionData = generateSessionData()
      await saveSessionData(sessionData)
    }
    setGameStarted(false)
    // Reset metrics for new session
    setMetrics({
      totalPlayTime: 0,
      averageReactionTime: 0,
      reactionTimes: [],
      maxLevelReached: 3,
      totalResets: 0,
      correctSequences: 0,
      incorrectSequences: 0,
      currentStreak: 0,
      bestStreak: 0,
      startTime: Date.now(),
      levelStartTime: Date.now()
    })
    setLevel(3)
  }

  useEffect(() => {
    if (gameStarted) {
      startNewLevel()
    }
  }, [level, gameStarted])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (gameStarted && !locked) {
      interval = setInterval(() => {
        setMetrics(prev => ({
          ...prev,
          totalPlayTime: Date.now() - prev.startTime
        }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [gameStarted, locked])

  function startGame(): void {
    setGameStarted(true)
    setSaveError('')
    setMetrics(prev => ({
      ...prev,
      startTime: Date.now(),
      levelStartTime: Date.now()
    }))
    levelStartTimeRef.current = Date.now()
  }

  function startNewLevel(): void {
    setFeedback(null)
    setUserInput([])
    setLocked(true)
    setIsFlipping(false)
    firstClickTimeRef.current = null
    levelStartTimeRef.current = Date.now()
    
    const newCards = Array.from({ length: level }, (_, i) => ({
      id: i,
      number: i + 1,
      revealed: true,
      correctIndex: i
    }))
    
    const shuffled = shuffle([...newCards])
    setCards(shuffled)
    
    // Show cards for study time (adaptive based on level)
    const studyTime = Math.max(2000, level * 300) // More time for higher levels
    setTimeout(() => {
      setIsFlipping(true)
      setTimeout(() => {
        setCards(shuffled.map(card => ({ ...card, revealed: false })))
        setLocked(false)
        setIsFlipping(false)
        levelStartTimeRef.current = Date.now() // Reset timer when input becomes available
      }, 600)
    }, studyTime)
  }

  function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  function handleCardClick(card: Card): void {
    if (locked || userInput.includes(card.number) || isFlipping) return
    
    const clickTime = Date.now()
    
    // Record first click reaction time
    if (firstClickTimeRef.current === null) {
      firstClickTimeRef.current = clickTime - levelStartTimeRef.current
    }
    
    const updatedInput = [...userInput, card.number]
    setUserInput(updatedInput)
    
    if (updatedInput.length === level) {
      const totalReactionTime = clickTime - levelStartTimeRef.current
      const isCorrect = updatedInput.every((val, idx) => val === idx + 1)
      
      setMetrics(prev => {
        const newReactionTimes = [...prev.reactionTimes, totalReactionTime]
        const newAverageReactionTime = newReactionTimes.reduce((a, b) => a + b, 0) / newReactionTimes.length
        const newCurrentStreak = isCorrect ? prev.currentStreak + 1 : 0
        const newBestStreak = Math.max(prev.bestStreak, newCurrentStreak)
        
        return {
          ...prev,
          reactionTimes: newReactionTimes,
          averageReactionTime: newAverageReactionTime,
          maxLevelReached: Math.max(prev.maxLevelReached, level),
          correctSequences: isCorrect ? prev.correctSequences + 1 : prev.correctSequences,
          incorrectSequences: isCorrect ? prev.incorrectSequences : prev.incorrectSequences + 1,
          currentStreak: newCurrentStreak,
          bestStreak: newBestStreak,
          totalResets: isCorrect ? prev.totalResets : prev.totalResets + 1
        }
      })
      
      setFeedback(isCorrect ? 'correct' : 'wrong')
      setLocked(true)
      
      setTimeout(() => {
        if (isCorrect) {
          setLevel(l => Math.min(l + 1, 25)) // Increased cap for teens
        } else {
          setLevel(3) // Reset to level 3
        }
      }, 2000) // Longer feedback time
    }
  }

  const getGridLayout = (): { cols: string; size: string } => {
    if (level <= 4) return { cols: 'grid-cols-2', size: 'w-24 h-32 sm:w-28 sm:h-36' }
    if (level <= 6) return { cols: 'grid-cols-3', size: 'w-20 h-28 sm:w-24 sm:h-32' }
    if (level <= 9) return { cols: 'grid-cols-3', size: 'w-18 h-24 sm:w-20 sm:h-28' }
    if (level <= 12) return { cols: 'grid-cols-4', size: 'w-16 h-22 sm:w-18 sm:h-24' }
    if (level <= 16) return { cols: 'grid-cols-4', size: 'w-14 h-20 sm:w-16 sm:h-22' }
    return { cols: 'grid-cols-5', size: 'w-12 h-18 sm:w-14 sm:h-20' }
  }

  const getTextSize = (): string => {
    if (level <= 6) return 'text-2xl sm:text-3xl'
    if (level <= 12) return 'text-xl sm:text-2xl'
    return 'text-lg sm:text-xl'
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  const getPerformanceLevel = (): PerformanceLevel => {
    if (metrics.maxLevelReached >= 20) return { level: 'Elite', color: 'text-purple-400', emoji: '🏆' }
    if (metrics.maxLevelReached >= 15) return { level: 'Expert', color: 'text-yellow-400', emoji: '⭐' }
    if (metrics.maxLevelReached >= 10) return { level: 'Advanced', color: 'text-blue-400', emoji: '🎯' }
    if (metrics.maxLevelReached >= 7) return { level: 'Intermediate', color: 'text-green-400', emoji: '📈' }
    return { level: 'Beginner', color: 'text-gray-400', emoji: '🌱' }
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
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
            Memory Challenge
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Test your working memory and cognitive speed!
          </p>
          
          {userId && userStats && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3 text-blue-400">Your Progress</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{userStats.bestLevel || 3}</div>
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
                  <div className="text-2xl font-bold text-purple-400">{userStats.totalSessionsPlayed || 0}</div>
                  <div className="text-gray-400">Sessions</div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold mb-3 text-blue-400">How it works:</h2>
            <ul className="space-y-2 text-gray-300">
              <li>• Memorize the sequence of numbers shown</li>
              <li>• Click the cards in order from 1 to N</li>
              <li>• Each level adds one more number</li>
              <li>• Your reaction time and accuracy are measured</li>
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
              Start Challenge 🚀
            </motion.button>
            
            <button
              onClick={handleReturnToGameSelection}
              className="px-6 py-4 bg-gray-600/80 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-200"
            >
              🏠 Return to Game Selection
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Memory Challenge
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
      <div className="flex gap-4 mb-6 text-sm text-gray-400">
        <span>Streak: {metrics.currentStreak}</span>
        <span>•</span>
        <span>Time: {formatTime(metrics.totalPlayTime)}</span>
        <span>•</span>
        <span>Accuracy: {metrics.correctSequences + metrics.incorrectSequences > 0 ? 
          Math.round((metrics.correctSequences / (metrics.correctSequences + metrics.incorrectSequences)) * 100) : 0}%</span>
      </div>

      <p className="text-gray-400 text-sm mb-6">
        {locked && !feedback ? `Study the sequence... (${Math.max(2, Math.ceil((2000 + level * 300) / 1000))}s)` : 
         locked ? '' : 'Click cards in order 1, 2, 3...'}
      </p>

      <div className={`grid ${getGridLayout().cols} gap-2 sm:gap-4 mb-8 max-w-4xl mx-auto`}>
        {cards.map(card => {
          const isClicked = userInput.includes(card.number)
          const isCorrectSequence = feedback === 'correct'
          const isWrongSequence = feedback === 'wrong'
          
          return (
            <div
              key={card.id}
              className={`${getGridLayout().size} relative`}
              style={{ perspective: '1000px' }}
            >
              <motion.div
                className="relative w-full h-full cursor-pointer"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ 
                  rotateY: card.revealed ? 0 : 180,
                  scale: isClicked ? 0.95 : 1
                }}
                transition={{ 
                  rotateY: { duration: 0.6, ease: "easeInOut" },
                  scale: { duration: 0.1 }
                }}
                onClick={() => handleCardClick(card)}
                whileHover={{ scale: locked || isFlipping ? 1 : 1.05 }}
              >
                {/* Front face */}
                <div 
                  className={classNames(
                    'absolute inset-0 w-full h-full rounded-lg flex items-center justify-center font-bold border-2',
                    'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 text-white shadow-lg',
                    getTextSize()
                  )}
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)'
                  }}
                >
                  {card.number}
                </div>
                
                {/* Back face */}
                <div 
                  className={classNames(
                    'absolute inset-0 w-full h-full rounded-lg flex items-center justify-center font-bold border-2 shadow-lg',
                    getTextSize(),
                    {
                      'bg-gradient-to-br from-green-500 to-green-600 border-green-400': isClicked && isCorrectSequence,
                      'bg-gradient-to-br from-red-500 to-red-600 border-red-400': isClicked && isWrongSequence,
                      'bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500': !isClicked,
                    }
                  )}
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  ?
                </div>
              </motion.div>
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={classNames('text-xl font-semibold px-6 py-3 rounded-lg mb-4', {
              'text-green-400 bg-green-900/20 border border-green-500/30': feedback === 'correct',
              'text-red-400 bg-red-900/20 border border-red-500/30': feedback === 'wrong'
            })}
          >
            {feedback === 'correct' ? 
              `🎉 Perfect! ${firstClickTimeRef.current ? `(${(firstClickTimeRef.current / 1000).toFixed(1)}s)` : ''} Next level...` : 
              '❌ Wrong sequence! Try again...'}
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-gray-800 rounded-lg p-6 max-w-md w-full"
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
                  <span>Avg Reaction Time:</span>
                  <span className="font-semibold">
                    {metrics.averageReactionTime ? (metrics.averageReactionTime / 1000).toFixed(1) : '0'}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Play Time:</span>
                  <span className="font-semibold">{formatTime(metrics.totalPlayTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy:</span>
                  <span className="font-semibold">
                    {metrics.correctSequences + metrics.incorrectSequences > 0 ? 
                      Math.round((metrics.correctSequences / (metrics.correctSequences + metrics.incorrectSequences)) * 100) : 0}%
                  </span>
                </div>
                {userId && userStats && (
                  <>
                    <hr className="border-gray-600 my-4" />
                    <div className="text-center text-blue-400 font-semibold mb-2">Personal Best</div>
                    <div className="flex justify-between">
                      <span>Best Level Ever:</span>
                      <span className="font-semibold text-yellow-400">{userStats.bestLevel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sessions Played:</span>
                      <span className="font-semibold">{userStats.totalSessionsPlayed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Accuracy:</span>
                      <span className="font-semibold">{Math.round(userStats.averageAccuracy)}%</span>
                    </div>
                  </>
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

      <div className="mt-4 text-center text-gray-400 text-sm max-w-md mb-6">
        {level >= 15 && (
          <p className="text-yellow-400 font-semibold">🔥 Expert Level! Your memory skills are impressive!</p>
        )}
        {level === 25 && (
          <p className="text-purple-400 font-bold">👑 MAXIMUM LEVEL! You're a cognitive champion!</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 flex-wrap justify-center">
        <button
          onClick={() => setShowStats(!showStats)}
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors font-semibold"
        >
          📊 View Cognitive Metrics
        </button>
        
        <button
          onClick={handleEndSession}
          className="px-6 py-3 bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors font-semibold"
        >
          🏁 End Session
        </button>
        
        <button
          onClick={handleReturnToGameSelection}
          className="px-6 py-3 bg-gray-600/80 hover:bg-gray-600 rounded-lg transition-colors font-semibold"
        >
          🏠 Return to Game Selection
        </button>
      </div>
    </div>
  )
}