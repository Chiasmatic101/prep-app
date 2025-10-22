'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// TypeScript interfaces
interface Trial {
  trialNumber: number
  letter: string
  reactionTime: number
  accuracy: boolean
  letterShowTime: number
  keyPressTime: number
  anticipation: boolean
  missedLetter: boolean
}

interface GameStats {
  totalTrials: number
  correctResponses: number
  accuracy: number
  avgReactionTime: number
  fastestTime: number
  slowestTime: number
  trialsPerSecond: number
  anticipations: number
  missedLetters: number
}

interface SessionMetrics {
  sessionId: string
  gameType: 'reactionTap'
  startTime: number
  endTime: number
  totalDuration: number
  stats: GameStats
  trials: Trial[]
  cognitiveProfile: {
    rapidProcessingSpeed: number
    sustainedAttention: number
    accuracyUnderPressure: number
  }
}

interface UserStats {
  bestScore: number
  bestAvgReactionTime: number
  averageReactionTime: number
  totalSessionsPlayed: number
  totalTrialsCompleted: number
  overallAccuracy: number
  lastPlayed: string
  sessions: any[]
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

const GAME_DURATION = 30000 // 30 seconds
const LETTER_DISPLAY_TIME = 800 // How long each letter stays on screen
const ANTICIPATION_THRESHOLD = 100 // ms

export default function ReactionTapGame() {
  const router = useRouter()
  
  // Game State
  const [gameState, setGameState] = useState<'waiting' | 'ready' | 'playing' | 'complete'>('waiting')
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [countdown, setCountdown] = useState<number>(3)
  const [timeRemaining, setTimeRemaining] = useState<number>(30)
  const [showMetrics, setShowMetrics] = useState<boolean>(false)
  
  // Game Data
  const [trials, setTrials] = useState<Trial[]>([])
  const [score, setScore] = useState<number>(0)
  const [letterShowTime, setLetterShowTime] = useState<number>(0)
  
  // Session Data
  const [sessionData, setSessionData] = useState<SessionMetrics>({
    sessionId: `reaction_tap_${Date.now()}`,
    gameType: 'reactionTap',
    startTime: Date.now(),
    endTime: 0,
    totalDuration: 0,
    stats: {
      totalTrials: 0,
      correctResponses: 0,
      accuracy: 0,
      avgReactionTime: 0,
      fastestTime: 0,
      slowestTime: 0,
      trialsPerSecond: 0,
      anticipations: 0,
      missedLetters: 0
    },
    trials: [],
    cognitiveProfile: {
      rapidProcessingSpeed: 0,
      sustainedAttention: 0,
      accuracyUnderPressure: 0
    }
  })
  
  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')
  
  // Refs
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const letterTimerRef = useRef<NodeJS.Timeout | null>(null)
  const gameStartTime = useRef<number>(0)

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
          if (data.reactionTapGame) {
            setUserStats(data.reactionTapGame as UserStats)
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
      const savedSessions = JSON.parse(localStorage.getItem('reactionTapSessions') || '[]')
      const updatedSessions = [...savedSessions, metrics].slice(-10)
      localStorage.setItem('reactionTapSessions', JSON.stringify(updatedSessions))
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      await setDoc(userDocRef, {
        reactionTapGame: {
          bestScore: Math.max(metrics.stats.correctResponses, userStats?.bestScore || 0),
          bestAvgReactionTime: userStats?.bestAvgReactionTime ? 
            Math.min(metrics.stats.avgReactionTime, userStats.bestAvgReactionTime) : 
            metrics.stats.avgReactionTime,
          averageReactionTime: calculateRunningAverage(
            userStats?.averageReactionTime || 0,
            userStats?.totalSessionsPlayed || 0,
            metrics.stats.avgReactionTime
          ),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalTrialsCompleted: (userStats?.totalTrialsCompleted || 0) + metrics.stats.totalTrials,
          overallAccuracy: calculateRunningAverage(
            userStats?.overallAccuracy || 0,
            userStats?.totalSessionsPlayed || 0,
            metrics.stats.accuracy
          ),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), metrics].slice(-10)
        }
      }, { merge: true })

      // Save detailed session data
      await addDoc(collection(db, 'gameSessionsDetailed'), {
        userId,
        ...metrics,
        createdAt: new Date()
      })

      console.log('Reaction Tap session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('reactionTapSessions') || '[]')
      const updatedSessions = [...savedSessions, metrics].slice(-10)
      localStorage.setItem('reactionTapSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  // Calculate game statistics
  const calculateStats = (): GameStats => {
    const correctTrials = trials.filter(t => t.accuracy)
    const reactionTimes = correctTrials.map(t => t.reactionTime)
    
    return {
      totalTrials: trials.length,
      correctResponses: correctTrials.length,
      accuracy: (correctTrials.length / Math.max(trials.length, 1)) * 100,
      avgReactionTime: reactionTimes.length > 0 ? reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length : 0,
      fastestTime: reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0,
      slowestTime: reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0,
      trialsPerSecond: trials.length / 30,
      anticipations: trials.filter(t => t.anticipation).length,
      missedLetters: trials.filter(t => t.missedLetter).length
    }
  }

  // Start Game
  const startGame = useCallback(() => {
    setGameState('ready')
    setCountdown(3)
    setTrials([])
    setScore(0)
    
    // Countdown
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          beginGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const beginGame = () => {
    setGameState('playing')
    gameStartTime.current = Date.now()
    setTimeRemaining(30)
    
    // Start the 30-second timer
    gameTimerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          completeGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // Show first letter
    showNextLetter()
  }

  const showNextLetter = () => {
    const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)]
    setCurrentLetter(randomLetter)
    setLetterShowTime(Date.now())
    
    // Auto-advance to next letter after display time
    letterTimerRef.current = setTimeout(() => {
      if (gameState === 'playing') {
        // Mark as missed if not pressed
        const missedTrial: Trial = {
          trialNumber: trials.length + 1,
          letter: randomLetter,
          reactionTime: 0,
          accuracy: false,
          letterShowTime: letterShowTime,
          keyPressTime: 0,
          anticipation: false,
          missedLetter: true
        }
        setTrials(prev => [...prev, missedTrial])
        showNextLetter()
      }
    }, LETTER_DISPLAY_TIME)
  }

  const completeGame = () => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current)
    if (letterTimerRef.current) clearTimeout(letterTimerRef.current)
    
    setGameState('complete')
    
    // Calculate final stats
    const finalStats = calculateStats()
    const cognitiveProfile = {
      rapidProcessingSpeed: finalStats.trialsPerSecond * 10,
      sustainedAttention: Math.max(0, 100 - finalStats.missedLetters * 5),
      accuracyUnderPressure: finalStats.accuracy
    }
    
    const finalSessionData: SessionMetrics = {
      ...sessionData,
      endTime: Date.now(),
      totalDuration: Date.now() - gameStartTime.current,
      stats: finalStats,
      trials: trials,
      cognitiveProfile
    }
    
    setSessionData(finalSessionData)
    
    // Auto-save session
    setTimeout(async () => {
      await saveSessionData(finalSessionData)
    }, 1000)
  }

  // Handle key press
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState !== 'playing' || !currentLetter) return
    
    const pressedKey = event.key.toUpperCase()
    const keyPressTime = Date.now()
    const reactionTime = keyPressTime - letterShowTime
    
    // Clear the letter timer since user responded
    if (letterTimerRef.current) {
      clearTimeout(letterTimerRef.current)
      letterTimerRef.current = null
    }
    
    const isAnticipation = reactionTime < ANTICIPATION_THRESHOLD
    const isCorrect = pressedKey === currentLetter && !isAnticipation
    
    const trial: Trial = {
      trialNumber: trials.length + 1,
      letter: currentLetter,
      reactionTime,
      accuracy: isCorrect,
      letterShowTime,
      keyPressTime,
      anticipation: isAnticipation,
      missedLetter: false
    }
    
    setTrials(prev => [...prev, trial])
    
    if (isCorrect) {
      setScore(prev => prev + 1)
    }
    
    // Show next letter
    showNextLetter()
  }, [gameState, currentLetter, letterShowTime, trials])

  // Keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
      if (gameTimerRef.current) clearInterval(gameTimerRef.current)
      if (letterTimerRef.current) clearTimeout(letterTimerRef.current)
    }
  }, [])

  const exportMetrics = () => {
    const dataStr = JSON.stringify(sessionData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `reaction-tap-session-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const resetGame = () => {
    setGameState('waiting')
    setCurrentLetter('')
    setTimeRemaining(30)
    setTrials([])
    setScore(0)
    setSessionData({
      sessionId: `reaction_tap_${Date.now()}`,
      gameType: 'reactionTap',
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      stats: {
        totalTrials: 0,
        correctResponses: 0,
        accuracy: 0,
        avgReactionTime: 0,
        fastestTime: 0,
        slowestTime: 0,
        trialsPerSecond: 0,
        anticipations: 0,
        missedLetters: 0
      },
      trials: [],
      cognitiveProfile: {
        rapidProcessingSpeed: 0,
        sustainedAttention: 0,
        accuracyUnderPressure: 0
      }
    })
    setSaveError('')
  }

  const handleReturnToGameSelection = async () => {
    // Clean up any timers
    if (gameTimerRef.current) clearInterval(gameTimerRef.current)
    if (letterTimerRef.current) clearTimeout(letterTimerRef.current)
    
    // Save session if there's any data
    if (trials.length > 0) {
      await saveSessionData(sessionData)
    }
    
    router.push('/Prep/PrepGames/GameSelection')
  }

  const getProgressPercentage = () => {
    if (gameState === 'waiting') return 0
    if (gameState === 'ready') return 10
    if (gameState === 'playing') return 50 + ((30 - timeRemaining) / 30) * 40
    return 100
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-100 via-blue-100 to-purple-100 text-gray-900 font-sans flex flex-col items-center justify-center p-6">
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
        <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-green-600 via-blue-600 to-purple-500 bg-clip-text text-transparent">
          Reaction Tap Test ⚡🎯
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-blue-700">
            {gameState === 'waiting' ? 'Ready to Start' : 
             gameState === 'ready' ? 'Get Ready!' : 
             gameState === 'playing' ? 'Tap the Letters!' :
             'Game Complete'}
          </span>
          <div className="w-48 h-3 bg-white/50 rounded-full overflow-hidden border border-white/30">
            <div className="h-full bg-gradient-to-r from-green-500 to-purple-500 transition-all duration-500" style={{ width: `${getProgressPercentage()}%` }} />
          </div>
          <span className="text-sm text-blue-600">{Math.round(getProgressPercentage())}%</span>
        </div>

        <div className="flex gap-4 justify-center items-center text-sm text-gray-600 mt-2">
          {gameState === 'playing' && (
            <>
              <span>Score: {score}</span>
              <span>Time: {timeRemaining}s</span>
              <span>Trials: {trials.length}</span>
            </>
          )}
          {gameState === 'complete' && (
            <>
              <span>Final Score: {score}</span>
              <span>Accuracy: {Math.round(sessionData.stats.accuracy)}%</span>
              <span>Avg Reaction: {Math.round(sessionData.stats.avgReactionTime)}ms</span>
            </>
          )}
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
        
        {/* Waiting State */}
        {gameState === 'waiting' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-6">Ready for the Challenge?</h2>
            <div className="mb-6 text-gray-700 space-y-2">
              <p className="text-lg">🎯 Tap letters as fast as possible for 30 seconds</p>
              <p className="text-lg">⚡ React quickly but don't anticipate!</p>
            </div>
            <button 
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              🚀 Start Game
            </button>
          </div>
        )}

        {/* Ready State */}
        {gameState === 'ready' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-green-600 mb-4">Get Ready!</h2>
            <p className="text-lg text-gray-700 mb-6">Tap each letter as quickly as possible</p>
            <div className="text-6xl font-bold text-blue-600">{countdown}</div>
          </div>
        )}

        {/* Playing State */}
        {gameState === 'playing' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-2xl font-bold text-green-600 mb-2">⏱️ {timeRemaining}s remaining</div>
              <div className="text-lg text-gray-600">Score: {score}</div>
            </div>
            <div className="text-9xl font-bold text-blue-600 animate-pulse mb-4">
              {currentLetter}
            </div>
            <p className="text-xl text-gray-700">Press this letter!</p>
          </div>
        )}

        {/* Complete State */}
        {gameState === 'complete' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-green-600 mb-4">🎉 Game Complete!</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-600">{score}</div>
                <div className="text-sm text-gray-600">Letters Tapped</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-600">
                  {Math.round(sessionData.stats.avgReactionTime)}ms
                </div>
                <div className="text-sm text-gray-600">Avg Reaction</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-purple-600">
                  {Math.round(sessionData.stats.accuracy)}%
                </div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-orange-600">
                  {sessionData.stats.fastestTime}ms
                </div>
                <div className="text-sm text-gray-600">Fastest</div>
              </div>
            </div>
            
            <button 
              onClick={resetGame}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-purple-600 hover:from-green-500 hover:to-purple-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 mr-4"
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
          disabled={gameState === 'playing'}
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
          <h3 className="font-bold text-blue-700 mb-4 text-center">🧠 Reaction Tap Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-6">
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-green-600 mb-2">Performance</h4>
              <div>Score: {sessionData.stats.correctResponses}</div>
              <div>Rate: {sessionData.stats.trialsPerSecond.toFixed(1)}/s</div>
              <div>Accuracy: {Math.round(sessionData.stats.accuracy)}%</div>
              <div>Total Trials: {sessionData.stats.totalTrials}</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">Reaction Times</h4>
              <div>Average: {Math.round(sessionData.stats.avgReactionTime)}ms</div>
              <div>Fastest: {sessionData.stats.fastestTime}ms</div>
              <div>Slowest: {sessionData.stats.slowestTime}ms</div>
              <div>Range: {sessionData.stats.slowestTime - sessionData.stats.fastestTime}ms</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">Errors</h4>
              <div>Anticipations: {sessionData.stats.anticipations}</div>
              <div>Missed: {sessionData.stats.missedLetters}</div>
              <div>Incorrect: {sessionData.stats.totalTrials - sessionData.stats.correctResponses - sessionData.stats.missedLetters}</div>
              <div>Error Rate: {Math.round((1 - sessionData.stats.accuracy / 100) * 100)}%</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-orange-600 mb-2">User Progress</h4>
              {userId && userStats ? (
                <>
                  <div>Best Score: {userStats.bestScore}</div>
                  <div>Best Avg: {Math.round(userStats.bestAvgReactionTime)}ms</div>
                  <div>Sessions: {userStats.totalSessionsPlayed}</div>
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
          {trials.length > 0 && (
            <div className="bg-white/20 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-600 mb-3 text-center">🧠 Cognitive Profile</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg">{sessionData.cognitiveProfile.rapidProcessingSpeed.toFixed(1)}</div>
                  <div className="text-gray-600">Rapid Processing Speed</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.sustainedAttention)}%</div>
                  <div className="text-gray-600">Sustained Attention</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.accuracyUnderPressure)}%</div>
                  <div className="text-gray-600">Accuracy Under Pressure</div>
                </div>
              </div>
            </div>
          )}

          {/* User Stats Comparison */}
          {userId && userStats && (
            <div className="mt-4 p-4 bg-white/20 rounded-lg">
              <h4 className="font-semibold text-blue-600 mb-2 text-center">🏆 Personal Best Comparison</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg">{userStats.bestScore}</div>
                  <div className="text-gray-600">Best Score</div>
                  <div className="text-xs text-blue-500">
                    vs {score} today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.bestAvgReactionTime)}ms</div>
                  <div className="text-gray-600">Best Avg Time</div>
                  <div className="text-xs text-blue-500">
                    vs {Math.round(sessionData.stats.avgReactionTime)}ms today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.averageReactionTime)}ms</div>
                  <div className="text-gray-600">Overall Avg</div>
                  <div className="text-xs text-blue-500">
                    across all sessions
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{userStats.totalSessionsPlayed}</div>
                  <div className="text-gray-600">Total Sessions</div>
                  <div className="text-xs text-blue-500">
                    +1 today
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 max-w-2xl text-center">
        <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-4">
          <h3 className="font-bold text-blue-700 mb-2">🎮 How to Play</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p>• Letters appear one at a time for 30 seconds</p>
            <p>• Press each letter on your keyboard as quickly as possible</p>
            <p>• Don't anticipate - wait for the letter to appear!</p>
            <p>• Try to maximize both speed and accuracy</p>
          </div>
          {!userId && (
            <p className="text-xs text-orange-600 mt-2">
              💡 Sign in to save your progress and compare with previous sessions!
            </p>
          )}
        </div>
      </div>
    </main>
  )
}