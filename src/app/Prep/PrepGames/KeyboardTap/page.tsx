'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// TypeScript interfaces
interface TrialData {
  trialNumber: number
  letter: string
  correctKey: string
  pressedKey: string | null
  reactionTime: number | null
  accuracy: boolean
  letterShowTime: number
  keyPressTime: number | null
  anticipation: boolean
  falseStart: boolean
  timeout: boolean
  gameState: GameState
}

interface GameState {
  round: number
  difficulty: string
  totalTrials: number
  completedTrials: number
  currentStreak: number
  avgReactionTime: number
}

interface SessionMetrics {
  sessionId: string
  gameType: 'reactionTime'
  startTime: number
  endTime: number
  totalDuration: number
  rounds: RoundData[]
  overallStats: OverallStats
  cognitiveProfile: CognitiveProfile
}

interface RoundData {
  round: number
  difficulty: string
  trials: TrialData[]
  stats: RoundStats
}

interface RoundStats {
  totalTrials: number
  correctResponses: number
  accuracy: number
  avgReactionTime: number
  fastestTime: number
  slowestTime: number
  anticipations: number
  falseStarts: number
  timeouts: number
  consistency: number
}

interface OverallStats {
  totalTrials: number
  totalCorrect: number
  overallAccuracy: number
  avgReactionTime: number
  bestReactionTime: number
  worstReactionTime: number
  totalAnticipations: number
  totalFalseStarts: number
  totalTimeouts: number
  performanceImprovement: number
}

interface CognitiveProfile {
  averageProcessingSpeed: number
  attentionStability: number
  impulsivityScore: number
  consistencyRating: number
  fatigueEffect: number
  learningCurve: number
}

interface UserStats {
  bestReactionTime: number
  averageReactionTime: number
  totalSessionsPlayed: number
  totalTrialsCompleted: number
  overallAccuracy: number
  bestAccuracy: number
  lastPlayed: string
  sessions: any[]
  cognitiveProfile: CognitiveProfile
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
const DIFFICULTIES = {
  easy: { trialsPerRound: 10, timeoutMs: 2000, name: 'Easy' },
  medium: { trialsPerRound: 15, timeoutMs: 1500, name: 'Medium' },
  hard: { trialsPerRound: 20, timeoutMs: 1000, name: 'Hard' }
}

export default function ReactionTimeGame() {
  const router = useRouter()
  
  // Game State
  const [gameState, setGameState] = useState<'waiting' | 'ready' | 'showing' | 'responding' | 'feedback' | 'completed'>('waiting')
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [currentTrial, setCurrentTrial] = useState<number>(1)
  const [currentRound, setCurrentRound] = useState<number>(1)
  const [difficulty, setDifficulty] = useState<keyof typeof DIFFICULTIES>('easy')
  const [showMetrics, setShowMetrics] = useState<boolean>(false)
  
  // Timing
  const [letterShowTime, setLetterShowTime] = useState<number>(0)
  const [reactionTime, setReactionTime] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<number>(3)
  
  // Session Data
  const [sessionData, setSessionData] = useState<SessionMetrics>({
    sessionId: `reaction_${Date.now()}`,
    gameType: 'reactionTime',
    startTime: Date.now(),
    endTime: 0,
    totalDuration: 0,
    rounds: [],
    overallStats: {
      totalTrials: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
      avgReactionTime: 0,
      bestReactionTime: Infinity,
      worstReactionTime: 0,
      totalAnticipations: 0,
      totalFalseStarts: 0,
      totalTimeouts: 0,
      performanceImprovement: 0
    },
    cognitiveProfile: {
      averageProcessingSpeed: 0,
      attentionStability: 0,
      impulsivityScore: 0,
      consistencyRating: 0,
      fatigueEffect: 0,
      learningCurve: 0
    }
  })
  
  // Current Round Data
  const [currentRoundData, setCurrentRoundData] = useState<TrialData[]>([])
  
  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')
  
  // Refs
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const gameStarted = useRef<boolean>(false)

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
          if (data.reactionTimeGame) {
            setUserStats(data.reactionTimeGame as UserStats)
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  // Save session data to Firestore
  const saveSessionData = async (metrics: SessionMetrics) => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('reactionTimeSessions') || '[]')
      const updatedSessions = [...savedSessions, metrics].slice(-10)
      localStorage.setItem('reactionTimeSessions', JSON.stringify(updatedSessions))
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      // Calculate updated user stats
      const avgReactionTime = metrics.overallStats.avgReactionTime
      const accuracy = metrics.overallStats.overallAccuracy
      const bestTime = metrics.overallStats.bestReactionTime

      await setDoc(userDocRef, {
        reactionTimeGame: {
          bestReactionTime: Math.min(bestTime, userStats?.bestReactionTime || Infinity),
          averageReactionTime: calculateRunningAverage(
            userStats?.averageReactionTime || 0,
            userStats?.totalSessionsPlayed || 0,
            avgReactionTime
          ),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalTrialsCompleted: (userStats?.totalTrialsCompleted || 0) + metrics.overallStats.totalTrials,
          overallAccuracy: calculateRunningAverage(
            userStats?.overallAccuracy || 0,
            userStats?.totalSessionsPlayed || 0,
            accuracy
          ),
          bestAccuracy: Math.max(accuracy, userStats?.bestAccuracy || 0),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), metrics].slice(-10),
          cognitiveProfile: metrics.cognitiveProfile
        }
      }, { merge: true })

      // Save detailed session data
      await addDoc(collection(db, 'gameSessionsDetailed'), {
        userId,
        ...metrics,
        createdAt: new Date()
      })

      console.log('Reaction Time session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('reactionTimeSessions') || '[]')
      const updatedSessions = [...savedSessions, metrics].slice(-10)
      localStorage.setItem('reactionTimeSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  // Start a new round
  const startRound = useCallback(() => {
    setGameState('ready')
    setCurrentTrial(1)
    setCurrentRoundData([])
    setCountdown(3)
    gameStarted.current = false
    
    // Countdown
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          startTrial()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  // Start a single trial
  const startTrial = useCallback(() => {
    if (currentTrial > DIFFICULTIES[difficulty].trialsPerRound) {
      completeRound()
      return
    }

    gameStarted.current = true
    setGameState('showing')
    
    // Random delay before showing letter (1-4 seconds)
    const delay = Math.random() * 3000 + 1000
    
    timeoutRef.current = setTimeout(() => {
      const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)]
      setCurrentLetter(randomLetter)
      setLetterShowTime(Date.now())
      setGameState('responding')
      
      // Set timeout for trial
      timeoutRef.current = setTimeout(() => {
        if (gameStarted.current) {
          handleTimeout()
        }
      }, DIFFICULTIES[difficulty].timeoutMs)
    }, delay)
  }, [currentTrial, difficulty])

  // Handle key press
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!gameStarted.current || gameState !== 'responding') {
      if (gameState === 'showing' && gameStarted.current) {
        // False start - pressed before letter appeared
        handleFalseStart()
      }
      return
    }

    const pressedKey = event.key.toUpperCase()
    const keyPressTime = Date.now()
    const reactionTimeMs = keyPressTime - letterShowTime
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    // Check for anticipation (too fast, likely guessing)
    const isAnticipation = reactionTimeMs < 100
    const isCorrect = pressedKey === currentLetter && !isAnticipation
    
    setReactionTime(reactionTimeMs)
    
    // Record trial data
    const trialData: TrialData = {
      trialNumber: currentTrial,
      letter: currentLetter,
      correctKey: currentLetter,
      pressedKey,
      reactionTime: reactionTimeMs,
      accuracy: isCorrect,
      letterShowTime,
      keyPressTime,
      anticipation: isAnticipation,
      falseStart: false,
      timeout: false,
      gameState: {
        round: currentRound,
        difficulty: DIFFICULTIES[difficulty].name,
        totalTrials: DIFFICULTIES[difficulty].trialsPerRound,
        completedTrials: currentTrial,
        currentStreak: calculateCurrentStreak(),
        avgReactionTime: calculateCurrentAverage()
      }
    }
    
    setCurrentRoundData(prev => [...prev, trialData])
    showFeedback(isCorrect, reactionTimeMs, isAnticipation)
  }, [gameState, currentLetter, letterShowTime, currentTrial, currentRound, difficulty])

  const handleFalseStart = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    const trialData: TrialData = {
      trialNumber: currentTrial,
      letter: currentLetter,
      correctKey: currentLetter,
      pressedKey: null,
      reactionTime: null,
      accuracy: false,
      letterShowTime: 0,
      keyPressTime: Date.now(),
      anticipation: false,
      falseStart: true,
      timeout: false,
      gameState: {
        round: currentRound,
        difficulty: DIFFICULTIES[difficulty].name,
        totalTrials: DIFFICULTIES[difficulty].trialsPerRound,
        completedTrials: currentTrial,
        currentStreak: 0,
        avgReactionTime: calculateCurrentAverage()
      }
    }
    
    setCurrentRoundData(prev => [...prev, trialData])
    showFeedback(false, null, false, 'False Start!')
  }

  const handleTimeout = () => {
    gameStarted.current = false
    
    const trialData: TrialData = {
      trialNumber: currentTrial,
      letter: currentLetter,
      correctKey: currentLetter,
      pressedKey: null,
      reactionTime: null,
      accuracy: false,
      letterShowTime,
      keyPressTime: null,
      anticipation: false,
      falseStart: false,
      timeout: true,
      gameState: {
        round: currentRound,
        difficulty: DIFFICULTIES[difficulty].name,
        totalTrials: DIFFICULTIES[difficulty].trialsPerRound,
        completedTrials: currentTrial,
        currentStreak: 0,
        avgReactionTime: calculateCurrentAverage()
      }
    }
    
    setCurrentRoundData(prev => [...prev, trialData])
    showFeedback(false, null, false, 'Too Slow!')
  }

  const showFeedback = (correct: boolean, time: number | null, anticipation: boolean, customMessage?: string) => {
    setGameState('feedback')
    gameStarted.current = false
    
    setTimeout(() => {
      setCurrentTrial(prev => prev + 1)
      setCurrentLetter('')
      setReactionTime(null)
      startTrial()
    }, 1500)
  }

  const calculateCurrentStreak = (): number => {
    let streak = 0
    for (let i = currentRoundData.length - 1; i >= 0; i--) {
      if (currentRoundData[i].accuracy) {
        streak++
      } else {
        break
      }
    }
    return streak
  }

  const calculateCurrentAverage = (): number => {
    const validTimes = currentRoundData
      .filter(trial => trial.reactionTime && trial.accuracy)
      .map(trial => trial.reactionTime!)
    
    if (validTimes.length === 0) return 0
    return validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length
  }

  const completeRound = () => {
    const roundStats = calculateRoundStats(currentRoundData)
    
    const roundData: RoundData = {
      round: currentRound,
      difficulty: DIFFICULTIES[difficulty].name,
      trials: currentRoundData,
      stats: roundStats
    }
    
    setSessionData(prev => ({
      ...prev,
      rounds: [...prev.rounds, roundData],
      overallStats: calculateOverallStats([...prev.rounds, roundData])
    }))
    
    if (currentRound >= 3) {
      completeSession()
    } else {
      setCurrentRound(prev => prev + 1)
      setGameState('waiting')
    }
  }

  const calculateRoundStats = (trials: TrialData[]): RoundStats => {
    const validTrials = trials.filter(t => t.reactionTime && t.accuracy)
    const reactionTimes = validTrials.map(t => t.reactionTime!)
    
    return {
      totalTrials: trials.length,
      correctResponses: trials.filter(t => t.accuracy).length,
      accuracy: (trials.filter(t => t.accuracy).length / trials.length) * 100,
      avgReactionTime: reactionTimes.length > 0 ? reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length : 0,
      fastestTime: reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0,
      slowestTime: reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0,
      anticipations: trials.filter(t => t.anticipation).length,
      falseStarts: trials.filter(t => t.falseStart).length,
      timeouts: trials.filter(t => t.timeout).length,
      consistency: calculateConsistency(reactionTimes)
    }
  }

  const calculateConsistency = (times: number[]): number => {
    if (times.length < 2) return 100
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length
    const stdDev = Math.sqrt(variance)
    return Math.max(0, 100 - (stdDev / avg * 100))
  }

  const calculateOverallStats = (rounds: RoundData[]): OverallStats => {
    const allTrials = rounds.flatMap(round => round.trials)
    const validTrials = allTrials.filter(t => t.reactionTime && t.accuracy)
    const reactionTimes = validTrials.map(t => t.reactionTime!)
    
    return {
      totalTrials: allTrials.length,
      totalCorrect: allTrials.filter(t => t.accuracy).length,
      overallAccuracy: (allTrials.filter(t => t.accuracy).length / allTrials.length) * 100,
      avgReactionTime: reactionTimes.length > 0 ? reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length : 0,
      bestReactionTime: reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0,
      worstReactionTime: reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0,
      totalAnticipations: allTrials.filter(t => t.anticipation).length,
      totalFalseStarts: allTrials.filter(t => t.falseStart).length,
      totalTimeouts: allTrials.filter(t => t.timeout).length,
      performanceImprovement: rounds.length > 1 ? 
        ((rounds[rounds.length - 1].stats.avgReactionTime - rounds[0].stats.avgReactionTime) / rounds[0].stats.avgReactionTime) * -100 : 0
    }
  }

  const calculateCognitiveProfile = (rounds: RoundData[]): CognitiveProfile => {
    const overallStats = calculateOverallStats(rounds)
    
    return {
      averageProcessingSpeed: 1000 / (overallStats.avgReactionTime || 1000),
      attentionStability: Math.max(0, 100 - overallStats.totalTimeouts * 10),
      impulsivityScore: (overallStats.totalAnticipations + overallStats.totalFalseStarts) * 10,
      consistencyRating: rounds.length > 0 ? rounds.reduce((sum, round) => sum + round.stats.consistency, 0) / rounds.length : 0,
      fatigueEffect: rounds.length > 1 ? 
        ((rounds[rounds.length - 1].stats.avgReactionTime - rounds[0].stats.avgReactionTime) / rounds[0].stats.avgReactionTime) * 100 : 0,
      learningCurve: overallStats.performanceImprovement * -1
    }
  }

  const completeSession = async () => {
    const endTime = Date.now()
    const finalSessionData: SessionMetrics = {
      ...sessionData,
      endTime,
      totalDuration: endTime - sessionData.startTime,
      cognitiveProfile: calculateCognitiveProfile(sessionData.rounds)
    }
    
    setSessionData(finalSessionData)
    setGameState('completed')
    
    // Auto-save session
    await saveSessionData(finalSessionData)
  }

  const exportMetrics = () => {
    const dataStr = JSON.stringify(sessionData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `reaction-time-session-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const resetGame = () => {
    setCurrentRound(1)
    setCurrentTrial(1)
    setGameState('waiting')
    setCurrentRoundData([])
    setSessionData({
      sessionId: `reaction_${Date.now()}`,
      gameType: 'reactionTime',
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      rounds: [],
      overallStats: {
        totalTrials: 0,
        totalCorrect: 0,
        overallAccuracy: 0,
        avgReactionTime: 0,
        bestReactionTime: Infinity,
        worstReactionTime: 0,
        totalAnticipations: 0,
        totalFalseStarts: 0,
        totalTimeouts: 0,
        performanceImprovement: 0
      },
      cognitiveProfile: {
        averageProcessingSpeed: 0,
        attentionStability: 0,
        impulsivityScore: 0,
        consistencyRating: 0,
        fatigueEffect: 0,
        learningCurve: 0
      }
    })
    setSaveError('')
  }

  const handleReturnToGameSelection = async () => {
    // Clean up any timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Save session if there's any data
    if (sessionData.rounds.length > 0) {
      await saveSessionData(sessionData)
    }
    
    router.push('/Prep/PrepGames/GameSelection')
  }

  // Keyboard event listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only respond to letter keys
      if (/^[a-zA-Z]$/.test(event.key)) {
        handleKeyPress(event)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyPress])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getFeedbackMessage = () => {
    if (gameState !== 'feedback') return ''
    
    const lastTrial = currentRoundData[currentRoundData.length - 1]
    if (!lastTrial) return ''
    
    if (lastTrial.falseStart) return '❌ False Start! Wait for the letter!'
    if (lastTrial.timeout) return '⏰ Too Slow! Be faster!'
    if (lastTrial.anticipation) return '⚡ Too Fast! Don\'t guess!'
    if (lastTrial.accuracy) {
      const time = lastTrial.reactionTime!
      if (time < 200) return '🚀 Lightning Fast!'
      if (time < 300) return '⚡ Very Fast!'
      if (time < 500) return '✅ Good!'
      return '👍 Correct!'
    }
    return '❌ Wrong Key!'
  }

  const progress = currentRound > 3 ? 100 : ((currentRound - 1) / 3) * 100

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 text-gray-900 font-sans flex flex-col items-center justify-center p-6">
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

      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-500 bg-clip-text text-transparent">
          Reaction Time Test ⚡
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-blue-700">Round {currentRound}/3</span>
          <div className="w-32 h-3 bg-white/50 rounded-full overflow-hidden border border-white/30">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-blue-600">{Math.round(progress)}%</span>
        </div>

        <div className="flex gap-4 justify-center items-center mb-4">
          <select 
            value={difficulty} 
            onChange={(e) => setDifficulty(e.target.value as keyof typeof DIFFICULTIES)}
            className="px-4 py-2 rounded-lg bg-white/70 border border-white/50"
            disabled={gameState !== 'waiting' && gameState !== 'completed'}
          >
            <option value="easy">Easy (2s timeout)</option>
            <option value="medium">Medium (1.5s timeout)</option>
            <option value="hard">Hard (1s timeout)</option>
          </select>
        </div>

        <div className="flex gap-4 justify-center items-center text-sm text-gray-600 mt-2">
          <span>Trial: {currentTrial}/{DIFFICULTIES[difficulty].trialsPerRound}</span>
          <span>Accuracy: {Math.round((currentRoundData.filter(t => t.accuracy).length / Math.max(currentRoundData.length, 1)) * 100)}%</span>
          <span>Avg: {Math.round(calculateCurrentAverage())}ms</span>
          <span>Streak: {calculateCurrentStreak()}</span>
          {userId && userStats && (
            <span className="text-green-600">✅ Synced</span>
          )}
          {!userId && (
            <span className="text-orange-600">📱 Local</span>
          )}
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-white/30 backdrop-blur-sm border border-white/40 rounded-3xl p-12 shadow-xl mb-8 min-h-96 flex flex-col items-center justify-center">
        {gameState === 'waiting' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to test your reflexes?</h2>
            <p className="text-gray-700 mb-6">Press the letter that appears as quickly as possible!</p>
            <button 
              onClick={startRound}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              🚀 Start Round {currentRound}
            </button>
          </div>
        )}

        {gameState === 'ready' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-blue-600 mb-4">Get Ready!</h2>
            <div className="text-6xl font-bold text-purple-600">{countdown}</div>
          </div>
        )}

        {gameState === 'showing' && (
          <div className="text-center">
            <p className="text-xl text-gray-600 mb-8">Wait for the letter...</p>
            <div className="w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse"></div>
          </div>
        )}

        {gameState === 'responding' && (
          <div className="text-center">
            <p className="text-xl text-gray-600 mb-8">Press this key!</p>
            <div className="text-8xl font-bold text-purple-600 animate-bounce">
              {currentLetter}
            </div>
            {reactionTime && (
              <p className="text-lg text-blue-600 mt-4">{reactionTime}ms</p>
            )}
          </div>
        )}

        {gameState === 'feedback' && (
          <div className="text-center">
            <div className="text-4xl mb-4">{getFeedbackMessage()}</div>
            {reactionTime && (
              <div className="text-2xl font-bold text-blue-600">{reactionTime}ms</div>
            )}
          </div>
        )}

        {gameState === 'completed' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-6 text-green-600">🎉 Session Complete!</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{Math.round(sessionData.overallStats.avgReactionTime)}ms</div>
                <div className="text-sm text-gray-600">Average Time</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{Math.round(sessionData.overallStats.overallAccuracy)}%</div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{Math.round(sessionData.overallStats.bestReactionTime)}ms</div>
                <div className="text-sm text-gray-600">Best Time</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">{sessionData.overallStats.totalTrials}</div>
                <div className="text-sm text-gray-600">Total Trials</div>
              </div>
            </div>
            <button 
              onClick={resetGame}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 mr-4"
            >
              🔄 Play Again
            </button>
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4 flex-wrap justify-center mb-6">
        <button 
          onClick={resetGame} 
          className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
          disabled={gameState === 'responding' || gameState === 'showing'}
        >
          🔄 Reset Game
        </button>
        <button 
          onClick={() => setShowMetrics(!showMetrics)} 
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          📊 {showMetrics ? 'Hide' : 'Show'} Metrics
        </button>
        <button 
          onClick={exportMetrics} 
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
          📄 Export JSON
        </button>
        <button
          className="px-6 py-3 bg-gray-600/80 hover:bg-gray-600 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
          onClick={handleReturnToGameSelection}
        >
          🏠 Return to Game Selection
        </button>
      </div>

      {/* Metrics Panel */}
      {showMetrics && (
        <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-6 mb-6 max-w-4xl w-full">
          <h3 className="font-bold text-blue-700 mb-4 text-center">⚡ Reaction Time Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-6">
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">Current Round</h4>
              <div>Trial: {currentTrial}/{DIFFICULTIES[difficulty].trialsPerRound}</div>
              <div>Correct: {currentRoundData.filter(t => t.accuracy).length}</div>
              <div>Avg Time: {Math.round(calculateCurrentAverage())}ms</div>
              <div>Streak: {calculateCurrentStreak()}</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">Session Stats</h4>
              <div>Rounds: {sessionData.rounds.length}/3</div>
              <div>Total Trials: {sessionData.overallStats.totalTrials}</div>
              <div>Accuracy: {Math.round(sessionData.overallStats.overallAccuracy)}%</div>
              <div>Best: {Math.round(sessionData.overallStats.bestReactionTime)}ms</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">Error Analysis</h4>
              <div>False Starts: {sessionData.overallStats.totalFalseStarts}</div>
              <div>Anticipations: {sessionData.overallStats.totalAnticipations}</div>
              <div>Timeouts: {sessionData.overallStats.totalTimeouts}</div>
              <div>Improvement: {Math.round(sessionData.overallStats.performanceImprovement)}%</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">User Progress</h4>
              {userId && userStats ? (
                <>
                  <div>Best Ever: {Math.round(userStats.bestReactionTime)}ms</div>
                  <div>Sessions: {userStats.totalSessionsPlayed}</div>
                  <div>Avg Accuracy: {Math.round(userStats.overallAccuracy)}%</div>
                  <div>Synced: ✅</div>
                </>
              ) : (
                <>
                  <div>Not Signed In</div>
                  <div>Local Storage</div>
                  <div>Sign in to sync</div>
                  <div>progress!</div>
                </>
              )}
            </div>
          </div>

          {/* Cognitive Profile */}
          {sessionData.rounds.length > 0 && (
            <div className="bg-white/20 rounded-lg p-4">
              <h4 className="font-semibold text-blue-600 mb-3 text-center">🧠 Cognitive Profile</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg">{sessionData.cognitiveProfile.averageProcessingSpeed.toFixed(1)}</div>
                  <div className="text-gray-600">Processing Speed</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.attentionStability)}%</div>
                  <div className="text-gray-600">Attention Stability</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.impulsivityScore)}</div>
                  <div className="text-gray-600">Impulsivity Score</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.consistencyRating)}%</div>
                  <div className="text-gray-600">Consistency</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{sessionData.cognitiveProfile.fatigueEffect.toFixed(1)}%</div>
                  <div className="text-gray-600">Fatigue Effect</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{sessionData.cognitiveProfile.learningCurve.toFixed(1)}%</div>
                  <div className="text-gray-600">Learning Curve</div>
                </div>
              </div>
            </div>
          )}

          {/* Round by Round Breakdown */}
          {sessionData.rounds.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-blue-600 mb-3 text-center">📈 Round Performance</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sessionData.rounds.map((round, index) => (
                  <div key={index} className="bg-white/20 rounded-lg p-3">
                    <div className="font-semibold text-center mb-2">Round {round.round} ({round.difficulty})</div>
                    <div className="text-xs space-y-1">
                      <div>Accuracy: {Math.round(round.stats.accuracy)}%</div>
                      <div>Avg Time: {Math.round(round.stats.avgReactionTime)}ms</div>
                      <div>Best: {Math.round(round.stats.fastestTime)}ms</div>
                      <div>Consistency: {Math.round(round.stats.consistency)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Stats Comparison */}
          {userId && userStats && (
            <div className="mt-4 p-4 bg-white/20 rounded-lg">
              <h4 className="font-semibold text-blue-600 mb-2 text-center">🏆 Personal Best Comparison</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.bestReactionTime)}ms</div>
                  <div className="text-gray-600">All-Time Best</div>
                  <div className="text-xs text-blue-500">
                    vs {Math.round(sessionData.overallStats.bestReactionTime)}ms today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.averageReactionTime)}ms</div>
                  <div className="text-gray-600">Overall Average</div>
                  <div className="text-xs text-blue-500">
                    vs {Math.round(sessionData.overallStats.avgReactionTime)}ms today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.bestAccuracy)}%</div>
                  <div className="text-gray-600">Best Accuracy</div>
                  <div className="text-xs text-blue-500">
                    vs {Math.round(sessionData.overallStats.overallAccuracy)}% today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{userStats.totalTrialsCompleted}</div>
                  <div className="text-gray-600">Total Trials</div>
                  <div className="text-xs text-blue-500">
                    +{sessionData.overallStats.totalTrials} today
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 max-w-md text-center">
        <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-4">
          <h3 className="font-bold text-blue-700 mb-2">⌨️ How to Play</h3>
          <p className="text-sm text-gray-700 mb-2">
            A letter will appear on screen. Press that letter key as quickly as possible!
          </p>
          <div className="text-xs text-gray-600 space-y-1">
            <div>• Wait for the letter to appear - don't guess!</div>
            <div>• Press the correct key as fast as you can</div>
            <div>• Avoid false starts and timeouts</div>
            <div>• Complete 3 rounds to finish the session</div>
          </div>
          {!userId && (
            <p className="text-xs text-orange-600 mt-2">
              💡 Sign in to save your progress and track improvements over time!
            </p>
          )}
        </div>
      </div>
    </main>
  )
}