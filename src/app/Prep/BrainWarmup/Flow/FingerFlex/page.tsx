'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// TypeScript interfaces
interface WordTrial {
  wordIndex: number
  originalWord: string
  scrambledWord: string
  letterIndex: number
  letter: string
  reactionTime: number
  accuracy: boolean
  letterShowTime: number
  keyPressTime: number
  userSequence: string[]
  isWordComplete: boolean
}

interface CompletedWord {
  wordIndex: number
  originalWord: string
  scrambledWord: string
  completionTime: number
  totalLetters: number
  errors: number
  avgLetterTime: number
}

interface GameStats {
  totalWords: number
  completedWords: number
  totalLetters: number
  correctLetters: number
  accuracy: number
  avgReactionTime: number
  fastestLetterTime: number
  slowestLetterTime: number
  avgWordTime: number
  fastestWordTime: number
  totalErrors: number
  wordsPerMinute: number
}

interface SessionMetrics {
  sessionId: string
  gameType: 'wordUnscramble'
  startTime: number
  endTime: number
  totalDuration: number
  stats: GameStats
  trials: WordTrial[]
  completedWords: CompletedWord[]
  cognitiveProfile: {
    sequentialProcessing: number
    wordRecognition: number
    speedUnderPressure: number
  }
}

interface UserStats {
  bestWordsCompleted: number
  bestAvgWordTime: number
  bestAccuracy: number
  averageWordsPerMinute: number
  totalSessionsPlayed: number
  totalWordsCompleted: number
  overallAccuracy: number
  lastPlayed: string
  sessions: any[]
}

// 8-letter words for the game
const WORDS = [
  'ELEPHANT', 'COMPUTER', 'KEYBOARD', 'MOUNTAIN', 'STANDARD', 'FUNCTION', 'RESEARCH', 'HOSPITAL',
  'BUILDING', 'CREATIVE', 'LANGUAGE', 'PRACTICE', 'STRENGTH', 'LEARNING', 'CAMPAIGN', 'NATIONAL',
  'PLATFORM', 'SECURITY', 'SOLUTION', 'BIRTHDAY', 'CHAMPION', 'FESTIVAL', 'GARDENER', 'INTERNET',
  'JOURNEY', 'KINDNESS', 'LOCATION', 'MEDICINE', 'NOVEMBER', 'OVERVIEW', 'PRODUCER', 'QUESTION',
  'REPUBLIC', 'SCISSORS', 'TRANSFER', 'UMBRELLA', 'VACATION', 'WORKSHOP', 'YOURSELF', 'ZEPPELIN',
  'SANDWICH', 'TREASURE', 'BASEBALL', 'CALENDAR', 'DAUGHTER', 'ENVELOPE', 'FOOTBALL', 'GRAPHICS',
  'HARDWARE', 'INFINITE', 'JUDGMENT', 'KEYBOARD', 'LAUGHTER', 'MAGAZINE', 'NOTEBOOK', 'OPTIMIZE',
  'PASSWORD', 'QUARTERS', 'RAINFALL', 'SUNSHINE', 'TOGETHER', 'UNIVERSE', 'VIOLENCE', 'WATERFALL'
]

const GAME_DURATION = 30000 // 30 seconds

export default function WordUnscrambleGame() {
  const router = useRouter()
  
  // Game State
  const [gameState, setGameState] = useState<'waiting' | 'ready' | 'playing' | 'complete'>('waiting')
  const [countdown, setCountdown] = useState<number>(3)
  const [timeRemaining, setTimeRemaining] = useState<number>(30)
  const [showMetrics, setShowMetrics] = useState<boolean>(false)
  
  // Word Game Data
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0)
  const [currentWord, setCurrentWord] = useState<string>('')
  const [scrambledWord, setScrambledWord] = useState<string>('')
  const [userSequence, setUserSequence] = useState<string[]>([])
  const [trials, setTrials] = useState<WordTrial[]>([])
  const [completedWords, setCompletedWords] = useState<CompletedWord[]>([])
  const [currentWordStartTime, setCurrentWordStartTime] = useState<number>(0)
  const [usedWords, setUsedWords] = useState<string[]>([])
  
  // Session Data
  const [sessionData, setSessionData] = useState<SessionMetrics>({
    sessionId: `word_unscramble_${Date.now()}`,
    gameType: 'wordUnscramble',
    startTime: Date.now(),
    endTime: 0,
    totalDuration: 0,
    stats: {
      totalWords: 0,
      completedWords: 0,
      totalLetters: 0,
      correctLetters: 0,
      accuracy: 0,
      avgReactionTime: 0,
      fastestLetterTime: Infinity,
      slowestLetterTime: 0,
      avgWordTime: 0,
      fastestWordTime: Infinity,
      totalErrors: 0,
      wordsPerMinute: 0
    },
    trials: [],
    completedWords: [],
    cognitiveProfile: {
      sequentialProcessing: 0,
      wordRecognition: 0,
      speedUnderPressure: 0
    }
  })
  
  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')
  
  // Refs
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null)
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
          if (data.wordUnscrambleGame) {
            setUserStats(data.wordUnscrambleGame as UserStats)
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
      const savedSessions = JSON.parse(localStorage.getItem('wordUnscrambleSessions') || '[]')
      const updatedSessions = [...savedSessions, metrics].slice(-10)
      localStorage.setItem('wordUnscrambleSessions', JSON.stringify(updatedSessions))
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      await setDoc(userDocRef, {
        wordUnscrambleGame: {
          bestWordsCompleted: Math.max(metrics.stats.completedWords, userStats?.bestWordsCompleted || 0),
          bestAvgWordTime: userStats?.bestAvgWordTime ? 
            Math.min(metrics.stats.avgWordTime, userStats.bestAvgWordTime) : 
            metrics.stats.avgWordTime,
          bestAccuracy: Math.max(metrics.stats.accuracy, userStats?.bestAccuracy || 0),
          averageWordsPerMinute: calculateRunningAverage(
            userStats?.averageWordsPerMinute || 0,
            userStats?.totalSessionsPlayed || 0,
            metrics.stats.wordsPerMinute
          ),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalWordsCompleted: (userStats?.totalWordsCompleted || 0) + metrics.stats.completedWords,
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

      console.log('Word Unscramble session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('wordUnscrambleSessions') || '[]')
      const updatedSessions = [...savedSessions, metrics].slice(-10)
      localStorage.setItem('wordUnscrambleSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  // Scramble word function
  const scrambleWord = (word: string): string => {
    const letters = word.split('')
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[letters[i], letters[j]] = [letters[j], letters[i]]
    }
    return letters.join('')
  }

  // Setup new word
  const setupNewWord = useCallback(() => {
    // Select a word that hasn't been used yet
    const availableWords = WORDS.filter(word => !usedWords.includes(word))
    let selectedWord: string
    
    if (availableWords.length === 0) {
      // If all words used, reset and pick from full list
      setUsedWords([])
      selectedWord = WORDS[Math.floor(Math.random() * WORDS.length)]
    } else {
      selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)]
    }
    
    setCurrentWord(selectedWord)
    setScrambledWord(scrambleWord(selectedWord))
    setUserSequence([])
    setCurrentWordStartTime(Date.now())
    setUsedWords(prev => [...prev, selectedWord])
  }, [usedWords])

  // Calculate game statistics
  const calculateStats = (): GameStats => {
    const correctTrials = trials.filter(t => t.accuracy)
    const reactionTimes = correctTrials.map(t => t.reactionTime)
    const wordTimes = completedWords.map(w => w.completionTime)
    
    return {
      totalWords: currentWordIndex + (userSequence.length > 0 ? 1 : 0),
      completedWords: completedWords.length,
      totalLetters: trials.length,
      correctLetters: correctTrials.length,
      accuracy: (correctTrials.length / Math.max(trials.length, 1)) * 100,
      avgReactionTime: reactionTimes.length > 0 ? reactionTimes.reduce((sum, time) => sum + time, 0) / reactionTimes.length : 0,
      fastestLetterTime: reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0,
      slowestLetterTime: reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0,
      avgWordTime: wordTimes.length > 0 ? wordTimes.reduce((sum, time) => sum + time, 0) / wordTimes.length : 0,
      fastestWordTime: wordTimes.length > 0 ? Math.min(...wordTimes) : 0,
      totalErrors: trials.filter(t => !t.accuracy).length,
      wordsPerMinute: completedWords.length * 2 // 30 seconds = 0.5 minutes, so multiply by 2
    }
  }

  // Start Game
  const startGame = useCallback(() => {
    setGameState('ready')
    setCountdown(3)
    setTrials([])
    setCompletedWords([])
    setCurrentWordIndex(0)
    setUsedWords([])
    
    // Setup first word
    setupNewWord()
    
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
  }, [setupNewWord])

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
  }

  const completeGame = () => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current)
    
    setGameState('complete')
    
    // Calculate final stats
    const finalStats = calculateStats()
    const cognitiveProfile = {
      sequentialProcessing: (finalStats.completedWords / Math.max(finalStats.totalWords, 1)) * 100,
      wordRecognition: finalStats.accuracy,
      speedUnderPressure: Math.max(0, 100 - (finalStats.avgWordTime / 100))
    }
    
    const finalSessionData: SessionMetrics = {
      ...sessionData,
      endTime: Date.now(),
      totalDuration: Date.now() - gameStartTime.current,
      stats: finalStats,
      trials: trials,
      completedWords: completedWords,
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
    if (gameState !== 'playing' || !currentWord) return
    
    const pressedKey = event.key.toUpperCase()
    if (!/^[A-Z]$/.test(pressedKey)) return
    
    const currentTime = Date.now()
    const nextRequiredLetter = currentWord[userSequence.length]
    const isCorrect = pressedKey === nextRequiredLetter
    
    // Calculate reaction time from when this letter position became active
    const letterPositionStartTime = userSequence.length === 0 ? currentWordStartTime : 
      (trials.filter(t => t.accuracy && t.letterIndex === userSequence.length - 1 && t.wordIndex === currentWordIndex).length > 0 ? 
        trials.filter(t => t.accuracy && t.letterIndex === userSequence.length - 1 && t.wordIndex === currentWordIndex)[0].keyPressTime : 
        currentWordStartTime)
    
    const trial: WordTrial = {
      wordIndex: currentWordIndex,
      originalWord: currentWord,
      scrambledWord: scrambledWord,
      letterIndex: userSequence.length,
      letter: pressedKey,
      reactionTime: currentTime - letterPositionStartTime,
      accuracy: isCorrect,
      letterShowTime: letterPositionStartTime,
      keyPressTime: currentTime,
      userSequence: [...userSequence],
      isWordComplete: false
    }
    
    setTrials(prev => [...prev, trial])
    
    if (isCorrect) {
      const newSequence = [...userSequence, pressedKey]
      setUserSequence(newSequence)
      
      // Check if word is complete
      if (newSequence.length === currentWord.length) {
        completeCurrentWord()
      }
    }
    // If incorrect, don't advance - player must enter the correct letter for this position
  }, [gameState, currentWord, userSequence, currentWordIndex, currentWordStartTime, scrambledWord, trials])

  const completeCurrentWord = () => {
    const wordCompletionTime = Date.now() - currentWordStartTime
    const wordTrials = trials.filter(t => t.wordIndex === currentWordIndex)
    const errors = wordTrials.filter(t => !t.accuracy).length
    const avgLetterTime = wordTrials.length > 0 ? 
      wordTrials.reduce((sum, t) => sum + t.reactionTime, 0) / wordTrials.length : 0
    
    const completedWord: CompletedWord = {
      wordIndex: currentWordIndex,
      originalWord: currentWord,
      scrambledWord: scrambledWord,
      completionTime: wordCompletionTime,
      totalLetters: currentWord.length,
      errors: errors,
      avgLetterTime: avgLetterTime
    }
    
    setCompletedWords(prev => [...prev, completedWord])
    setCurrentWordIndex(prev => prev + 1)
    
    // Only setup next word if game is still playing (time hasn't run out)
    if (gameState === 'playing' && timeRemaining > 0) {
      setupNewWord()
    }
  }

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
    }
  }, [])

  const exportMetrics = () => {
    const dataStr = JSON.stringify(sessionData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `word-unscramble-session-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const resetGame = () => {
    setGameState('waiting')
    setCurrentWord('')
    setScrambledWord('')
    setTimeRemaining(30)
    setTrials([])
    setCompletedWords([])
    setCurrentWordIndex(0)
    setUserSequence([])
    setUsedWords([])
    setSessionData({
      sessionId: `word_unscramble_${Date.now()}`,
      gameType: 'wordUnscramble',
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      stats: {
        totalWords: 0,
        completedWords: 0,
        totalLetters: 0,
        correctLetters: 0,
        accuracy: 0,
        avgReactionTime: 0,
        fastestLetterTime: Infinity,
        slowestLetterTime: 0,
        avgWordTime: 0,
        fastestWordTime: Infinity,
        totalErrors: 0,
        wordsPerMinute: 0
      },
      trials: [],
      completedWords: [],
      cognitiveProfile: {
        sequentialProcessing: 0,
        wordRecognition: 0,
        speedUnderPressure: 0
      }
    })
    setSaveError('')
  }

  const handleReturnToGameSelection = async () => {
    // Clean up any timers
    if (gameTimerRef.current) clearInterval(gameTimerRef.current)
    
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

  const getRemainingLetters = () => {
    return currentWord.slice(userSequence.length).split('')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 text-gray-900 font-sans flex flex-col items-center justify-center p-6">
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
        <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-500 bg-clip-text text-transparent">
          Word Unscramble Sprint 🔤⚡
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-purple-700">
            {gameState === 'waiting' ? 'Ready to Start' : 
             gameState === 'ready' ? 'Get Ready!' : 
             gameState === 'playing' ? 'Unscramble Words!' :
             'Game Complete'}
          </span>
          <div className="w-48 h-3 bg-white/50 rounded-full overflow-hidden border border-white/30">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${getProgressPercentage()}%` }} />
          </div>
          <span className="text-sm text-purple-600">{Math.round(getProgressPercentage())}%</span>
        </div>

        <div className="flex gap-4 justify-center items-center text-sm text-gray-600 mt-2">
          {gameState === 'playing' && (
            <>
              <span>Words: {completedWords.length}</span>
              <span>Time: {timeRemaining}s</span>
              <span>Progress: {userSequence.length}/{currentWord.length}</span>
            </>
          )}
          {gameState === 'complete' && (
            <>
              <span>Words: {completedWords.length}</span>
              <span>Accuracy: {Math.round(sessionData.stats.accuracy)}%</span>
              <span>WPM: {sessionData.stats.wordsPerMinute}</span>
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
            <h2 className="text-3xl font-bold mb-6">Ready to Unscramble?</h2>
            <div className="mb-6 text-gray-700 space-y-2">
              <p className="text-lg">🔤 Unscramble 8-letter words as fast as possible</p>
              <p className="text-lg">⚡ Type letters in the correct order for 30 seconds</p>
            </div>
            <button 
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              🚀 Start Game
            </button>
          </div>
        )}

        {/* Ready State */}
        {gameState === 'ready' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-purple-600 mb-4">Get Ready!</h2>
            <p className="text-lg text-gray-700 mb-2">Unscramble words by typing letters in correct order</p>
            <div className="text-4xl font-bold text-gray-800 mb-4 tracking-widest">{scrambledWord}</div>
            <div className="text-6xl font-bold text-purple-600">{countdown}</div>
          </div>
        )}

        {/* Playing State */}
        {gameState === 'playing' && (
          <div className="text-center">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-purple-600 mb-2">🔤 Word {currentWordIndex + 1}</h3>
              <div className="text-lg text-gray-600">
                Time: {timeRemaining}s | Words Complete: {completedWords.length}
              </div>
            </div>
            
            {/* Scrambled Word */}
            <div className="mb-6">
              <p className="text-lg text-gray-700 mb-2">Scrambled:</p>
              <div className="text-4xl font-bold text-gray-800 tracking-widest">{scrambledWord}</div>
            </div>
            
            {/* User Progress */}
            <div className="mb-6">
              <p className="text-lg text-gray-700 mb-2">Your Progress:</p>
              <div className="flex justify-center gap-2 mb-4">
                {currentWord.split('').map((letter, index) => (
                  <div key={index} className={`w-12 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-bold transition-all duration-300
                    ${index < userSequence.length ? 'bg-green-200 border-green-500 text-green-800 scale-110' : 
                      index === userSequence.length ? 'bg-purple-200 border-purple-500 text-purple-800 animate-pulse' :
                      'bg-white/50 border-gray-300 text-gray-400'}`}>
                    {index < userSequence.length ? userSequence[index] : 
                     index === userSequence.length ? '?' : '·'}
                  </div>
                ))}
              </div>
              <div className="text-lg text-gray-600">
                Progress: {userSequence.length}/{currentWord.length} 
                {trials.filter(t => !t.accuracy && t.wordIndex === currentWordIndex).length > 0 && (
                  <span className="text-red-600 ml-2">
                    ({trials.filter(t => !t.accuracy && t.wordIndex === currentWordIndex).length} errors)
                  </span>
                )}
              </div>
            </div>
            
            {/* Next Required Letter */}
            {userSequence.length < currentWord.length && (
              <div className="mb-4">
                <p className="text-lg text-gray-700 mb-2">Type this letter:</p>
                <div className="text-8xl font-bold text-purple-600 animate-bounce drop-shadow-lg">
                  {currentWord[userSequence.length]}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Must be correct to advance to next letter
                </p>
              </div>
            )}
            
            {/* Remaining Letters */}
            <div className="text-sm text-gray-600">
              Remaining: {getRemainingLetters().join(' ')}
            </div>
          </div>
        )}

        {/* Complete State */}
        {gameState === 'complete' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-purple-600 mb-4">🎉 Game Complete!</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-purple-600">{completedWords.length}</div>
                <div className="text-sm text-gray-600">Words Complete</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-pink-600">
                  {Math.round(sessionData.stats.accuracy)}%
                </div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-600">
                  {sessionData.stats.wordsPerMinute}
                </div>
                <div className="text-sm text-gray-600">Words/Min</div>
              </div>
              <div className="bg-white/40 rounded-lg p-4">
                <div className="text-3xl font-bold text-orange-600">
                  {Math.round(sessionData.stats.avgWordTime / 1000)}s
                </div>
                <div className="text-sm text-gray-600">Avg Word Time</div>
              </div>
            </div>

            {/* Completed Words Summary */}
            {completedWords.length > 0 && (
              <div className="mb-6 p-4 bg-white/20 rounded-lg">
                <h4 className="font-semibold text-purple-600 mb-2">Words Completed:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  {completedWords.map((word, index) => (
                    <div key={index} className="bg-white/30 rounded p-2">
                      <div className="font-bold">{word.originalWord}</div>
                      <div className="text-xs text-gray-600">{(word.completionTime / 1000).toFixed(1)}s</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              onClick={resetGame}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 mr-4"
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
          <h3 className="font-bold text-purple-700 mb-4 text-center">🧠 Word Unscramble Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-6">
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">Word Performance</h4>
              <div>Completed: {sessionData.stats.completedWords}</div>
              <div>Total Words: {sessionData.stats.totalWords}</div>
              <div>Completion Rate: {Math.round((sessionData.stats.completedWords / Math.max(sessionData.stats.totalWords, 1)) * 100)}%</div>
              <div>Words/Min: {sessionData.stats.wordsPerMinute}</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-pink-600 mb-2">Letter Performance</h4>
              <div>Total Letters: {sessionData.stats.totalLetters}</div>
              <div>Correct: {sessionData.stats.correctLetters}</div>
              <div>Accuracy: {Math.round(sessionData.stats.accuracy)}%</div>
              <div>Errors: {sessionData.stats.totalErrors}</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">Timing</h4>
              <div>Avg Letter: {Math.round(sessionData.stats.avgReactionTime)}ms</div>
              <div>Fastest Letter: {sessionData.stats.fastestLetterTime}ms</div>
              <div>Avg Word: {Math.round(sessionData.stats.avgWordTime / 1000)}s</div>
              <div>Fastest Word: {sessionData.stats.fastestWordTime !== Infinity ? Math.round(sessionData.stats.fastestWordTime / 1000) + 's' : 'N/A'}</div>
            </div>
            
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-orange-600 mb-2">User Progress</h4>
              {userId && userStats ? (
                <>
                  <div>Best Words: {userStats.bestWordsCompleted}</div>
                  <div>Best Accuracy: {Math.round(userStats.bestAccuracy)}%</div>
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
              <h4 className="font-semibold text-purple-600 mb-3 text-center">🧠 Cognitive Profile</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.sequentialProcessing)}%</div>
                  <div className="text-gray-600">Sequential Processing</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.wordRecognition)}%</div>
                  <div className="text-gray-600">Word Recognition</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(sessionData.cognitiveProfile.speedUnderPressure)}%</div>
                  <div className="text-gray-600">Speed Under Pressure</div>
                </div>
              </div>
            </div>
          )}

          {/* Completed Words Breakdown */}
          {completedWords.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-purple-600 mb-3 text-center">📝 Words Completed</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {completedWords.map((word, index) => (
                  <div key={index} className="bg-white/20 rounded-lg p-3">
                    <div className="font-semibold text-center mb-2">Word {index + 1}</div>
                    <div className="text-xs space-y-1">
                      <div><strong>Original:</strong> {word.originalWord}</div>
                      <div><strong>Scrambled:</strong> {word.scrambledWord}</div>
                      <div><strong>Time:</strong> {(word.completionTime / 1000).toFixed(1)}s</div>
                      <div><strong>Errors:</strong> {word.errors}</div>
                      <div><strong>Avg Letter:</strong> {Math.round(word.avgLetterTime)}ms</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Stats Comparison */}
          {userId && userStats && (
            <div className="mt-4 p-4 bg-white/20 rounded-lg">
              <h4 className="font-semibold text-purple-600 mb-2 text-center">🏆 Personal Best Comparison</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg">{userStats.bestWordsCompleted}</div>
                  <div className="text-gray-600">Best Words</div>
                  <div className="text-xs text-purple-500">
                    vs {completedWords.length} today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.bestAccuracy)}%</div>
                  <div className="text-gray-600">Best Accuracy</div>
                  <div className="text-xs text-purple-500">
                    vs {Math.round(sessionData.stats.accuracy)}% today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.averageWordsPerMinute)}</div>
                  <div className="text-gray-600">Avg WPM</div>
                  <div className="text-xs text-purple-500">
                    vs {sessionData.stats.wordsPerMinute} today
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{userStats.totalSessionsPlayed}</div>
                  <div className="text-gray-600">Total Sessions</div>
                  <div className="text-xs text-purple-500">
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
          <h3 className="font-bold text-purple-700 mb-2">🎮 How to Play</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p>• Scrambled 8-letter words appear on screen</p>
            <p>• Type the letters in the correct order to unscramble each word</p>
            <p>• You must type the correct letter to advance to the next position</p>
            <p>• Complete as many words as possible in 30 seconds</p>
            <p>• New words appear automatically when you finish one</p>
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