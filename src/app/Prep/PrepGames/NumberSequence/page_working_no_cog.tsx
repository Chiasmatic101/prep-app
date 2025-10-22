'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface SequenceAttempt {
  round: number
  sequenceLength: number
  correct: boolean
  targetSequence: number[]
  userSequence: number[]
  accuracy: number
  timestamp: number
  totalTime: number
  inputSpeed: number
}

interface HesitationEvent {
  round: number
  duration: number
  timestamp: number
  digitPosition: number
}

interface ErrorDetail {
  round: number
  errorType: 'wrong_digit' | 'wrong_order' | 'omission'
  expectedDigit: number
  userDigit: number
  position: number
  timestamp: number
}

interface LevelData {
  level: number
  maxSequenceLength: number
  roundsCompleted: number
  correctRounds: number
  timing: {
    startTime: number
    endTime: number
    totalDuration: number
  }
  performance: {
    accuracy: number
    avgSequenceLength: number
    avgInputSpeed: number
    memorySpan: number
  }
  cognitive: {
    avgHesitationTime: number
    totalHesitations: number
    errorRate: number
    workingMemoryCapacity: number
  }
  detailedLogs: {
    attempts: SequenceAttempt[]
    hesitations: HesitationEvent[]
    errors: ErrorDetail[]
  }
}

interface SessionData {
  levels: LevelData[]
  sessionStart: number
  maxSequenceReached: number
  totalRounds: number
  totalCorrect: number
}

export default function NumberSequenceGame() {
  const router = useRouter()
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [currentNumber, setCurrentNumber] = useState<number | null>(null)
  const [phase, setPhase] = useState<'showing' | 'input' | 'feedback'>('showing')
  const [sequenceLength, setSequenceLength] = useState(3)
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  
  // Cognitive tracking
  const [attempts, setAttempts] = useState<SequenceAttempt[]>([])
  const [hesitations, setHesitations] = useState<HesitationEvent[]>([])
  const [errors, setErrors] = useState<ErrorDetail[]>([])
  const [roundStartTime, setRoundStartTime] = useState(Date.now())
  const [inputStartTime, setInputStartTime] = useState(Date.now())
  const [sessionData, setSessionData] = useState<SessionData>({
    levels: [],
    sessionStart: Date.now(),
    maxSequenceReached: 3,
    totalRounds: 0,
    totalCorrect: 0
  })
  
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showMetrics, setShowMetrics] = useState(false)
  
  const lastActionTime = useRef(Date.now())
  const sessionStartTime = useRef(Date.now())
  const hesitationThreshold = 2000

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (phase === 'showing' && sequence.length === 0) {
      startNewRound()
    }
  }, [])

  const startNewRound = () => {
    const now = Date.now()
    setRoundStartTime(now)
    lastActionTime.current = now
    
    const newSequence = Array.from(
      { length: sequenceLength }, 
      () => Math.floor(Math.random() * 9) + 1
    )
    
    setSequence(newSequence)
    setUserInput([])
    setPhase('showing')
    setIsCorrect(null)
    
    showSequence(newSequence)
  }

  const showSequence = async (seq: number[]) => {
    for (let i = 0; i < seq.length; i++) {
      setCurrentNumber(seq[i])
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCurrentNumber(null)
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    
    setPhase('input')
    setInputStartTime(Date.now())
    lastActionTime.current = Date.now()
  }

  const handleNumberClick = (num: number) => {
    if (phase !== 'input') return
    
    const now = Date.now()
    const timeSinceLastAction = now - lastActionTime.current
    const digitPosition = userInput.length
    
    if (timeSinceLastAction > hesitationThreshold) {
      setHesitations(prev => [...prev, {
        round,
        duration: timeSinceLastAction,
        timestamp: now,
        digitPosition
      }])
    }
    
    const newInput = [...userInput, num]
    setUserInput(newInput)
    
    // Check for immediate errors
    if (num !== sequence[digitPosition]) {
      setErrors(prev => [...prev, {
        round,
        errorType: 'wrong_digit',
        expectedDigit: sequence[digitPosition],
        userDigit: num,
        position: digitPosition,
        timestamp: now
      }])
    }
    
    // Check if sequence complete
    if (newInput.length === sequence.length) {
      setTimeout(() => {
        submitAnswer(newInput)
      }, 500)
    }
    
    lastActionTime.current = now
  }

  const submitAnswer = (finalInput: number[]) => {
    const now = Date.now()
    const totalTime = now - roundStartTime
    const inputSpeed = (now - inputStartTime) / finalInput.length
    
    let correctDigits = 0
    finalInput.forEach((digit, idx) => {
      if (digit === sequence[idx]) correctDigits++
    })
    
    const accuracy = (correctDigits / sequence.length) * 100
    const isCorrectAnswer = accuracy === 100
    
    setIsCorrect(isCorrectAnswer)
    setPhase('feedback')
    
    // Track detailed errors
    sequence.forEach((digit, idx) => {
      if (idx >= finalInput.length) {
        setErrors(prev => [...prev, {
          round,
          errorType: 'omission',
          expectedDigit: digit,
          userDigit: -1,
          position: idx,
          timestamp: now
        }])
      } else if (finalInput[idx] !== digit) {
        setErrors(prev => [...prev, {
          round,
          errorType: 'wrong_order',
          expectedDigit: digit,
          userDigit: finalInput[idx],
          position: idx,
          timestamp: now
        }])
      }
    })
    
    const attempt: SequenceAttempt = {
      round,
      sequenceLength,
      correct: isCorrectAnswer,
      targetSequence: [...sequence],
      userSequence: [...finalInput],
      accuracy,
      timestamp: now,
      totalTime,
      inputSpeed
    }
    
    setAttempts(prev => [...prev, attempt])
    
    if (isCorrectAnswer) {
      setScore(prev => prev + 1)
      setStreak(prev => {
        const newStreak = prev + 1
        if (newStreak > bestStreak) setBestStreak(newStreak)
        return newStreak
      })
      
      if (streak > 0 && streak % 2 === 0 && sequenceLength < 9) {
        setSequenceLength(prev => prev + 1)
        setSessionData(prev => ({
          ...prev,
          maxSequenceReached: Math.max(prev.maxSequenceReached, sequenceLength + 1)
        }))
      }
    } else {
      setStreak(0)
      if (sequenceLength > 3) {
        setSequenceLength(prev => prev - 1)
      }
    }
    
    setTimeout(() => {
      if (round < 15) {
        setRound(prev => prev + 1)
        setSequence([])
        startNewRound()
      } else {
        saveLevelData()
      }
    }, 2000)
  }

  const saveLevelData = () => {
    const now = Date.now()
    const levelData: LevelData = {
      level: 1,
      maxSequenceLength: sessionData.maxSequenceReached,
      roundsCompleted: attempts.length,
      correctRounds: attempts.filter(a => a.correct).length,
      timing: {
        startTime: sessionStartTime.current,
        endTime: now,
        totalDuration: now - sessionStartTime.current
      },
      performance: {
        accuracy: attempts.length > 0 ? 
          (attempts.filter(a => a.correct).length / attempts.length) * 100 : 0,
        avgSequenceLength: attempts.length > 0 ?
          attempts.reduce((sum, a) => sum + a.sequenceLength, 0) / attempts.length : 0,
        avgInputSpeed: attempts.length > 0 ?
          attempts.reduce((sum, a) => sum + a.inputSpeed, 0) / attempts.length : 0,
        memorySpan: sessionData.maxSequenceReached
      },
      cognitive: {
        avgHesitationTime: hesitations.length > 0 ?
          hesitations.reduce((sum, h) => sum + h.duration, 0) / hesitations.length : 0,
        totalHesitations: hesitations.length,
        errorRate: attempts.length > 0 ?
          (errors.length / (attempts.length * sequenceLength)) * 100 : 0,
        workingMemoryCapacity: sessionData.maxSequenceReached
      },
      detailedLogs: {
        attempts,
        hesitations,
        errors
      }
    }
    
    setSessionData(prev => ({
      ...prev,
      levels: [...prev.levels, levelData],
      totalRounds: prev.totalRounds + attempts.length,
      totalCorrect: prev.totalCorrect + attempts.filter(a => a.correct).length
    }))
  }

  const exportMetrics = () => {
    saveLevelData()
    
    const metrics = {
      sessionOverview: {
        sessionStart: sessionData.sessionStart,
        sessionEnd: Date.now(),
        totalDuration: Date.now() - sessionData.sessionStart,
        maxSequenceLength: sessionData.maxSequenceReached,
        totalRounds: attempts.length
      },
      performance: {
        score,
        accuracy: attempts.length > 0 ? 
          (attempts.filter(a => a.correct).length / attempts.length) * 100 : 0,
        bestStreak,
        workingMemorySpan: sessionData.maxSequenceReached
      },
      cognitiveProfile: {
        avgInputSpeed: attempts.length > 0 ?
          attempts.reduce((sum, a) => sum + a.inputSpeed, 0) / attempts.length : 0,
        avgHesitationTime: hesitations.length > 0 ?
          hesitations.reduce((sum, h) => sum + h.duration, 0) / hesitations.length : 0,
        workingMemoryCapacity: sessionData.maxSequenceReached,
        errorRate: attempts.length > 0 ?
          (errors.length / (attempts.length * sequenceLength)) * 100 : 0
      },
      detailedData: sessionData
    }
    
    const dataStr = JSON.stringify(metrics, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `number-sequence-session-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleReturnToGameSelection = () => {
    router.push('/Prep/PrepGames/GameSelection')
  }

  const resetGame = () => {
    setRound(1)
    setScore(0)
    setStreak(0)
    setSequenceLength(3)
    setSequence([])
    setAttempts([])
    setHesitations([])
    setErrors([])
    setSessionData(prev => ({
      ...prev,
      sessionStart: Date.now(),
      maxSequenceReached: 3
    }))
    sessionStartTime.current = Date.now()
    startNewRound()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-rose-100 text-gray-900 flex flex-col items-center justify-center p-6">
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          💾 Saving session data...
        </div>
      )}
      
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
          Number Sequence Memory 🔢
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-purple-700">Round {round}/15</span>
          <span className="text-lg font-semibold text-pink-700">Length: {sequenceLength}</span>
        </div>
        <div className="flex gap-6 justify-center text-sm text-gray-600">
          <span className="bg-green-200 px-3 py-1 rounded-full">Score: {score}</span>
          <span className="bg-yellow-200 px-3 py-1 rounded-full">Streak: {streak}</span>
          <span className="bg-purple-200 px-3 py-1 rounded-full">Best: {bestStreak}</span>
          <span className="bg-blue-200 px-3 py-1 rounded-full">Hesitations: {hesitations.length}</span>
        </div>
        <p className="text-lg text-gray-700 mt-4 font-medium">
          {phase === 'showing' ? '👀 Watch the numbers...' : 
           phase === 'input' ? '🧠 Enter the sequence in order!' : 
           isCorrect ? '✅ Perfect!' : '❌ Try again!'}
        </p>
      </div>

      <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-3xl p-8 shadow-xl mb-8 min-h-[400px] flex items-center justify-center">
        {phase === 'showing' && (
          <div className="flex flex-col items-center justify-center w-full">
            <div className="text-9xl font-bold text-purple-600 animate-pulse h-32 w-32 flex items-center justify-center mb-8">
              {currentNumber}
            </div>
            <div className="h-20"></div>
          </div>
        )}
        
        {phase === 'input' && (
          <div className="w-full max-w-xs mx-auto">
            <div className="text-center mb-6">
              <div className="text-2xl font-mono text-gray-700 flex items-center justify-center gap-2 bg-white/50 rounded-xl h-16 w-64 mx-auto">
  {userInput.length > 0 ? (
    <div className="flex justify-center gap-2">
      {userInput.map((num, idx) => (
        <span key={idx} className="bg-purple-200 px-4 py-2 rounded-lg">
          {num}
        </span>
      ))}
    </div>
  ) : (
    <span className="text-gray-400">Enter sequence...</span>
  )}
</div>

              <div className="text-sm text-gray-500 mt-2 h-6">
                {userInput.length} / {sequence.length} digits
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  className="aspect-square bg-white/60 hover:bg-white/80 rounded-2xl font-bold text-3xl transition-all duration-200 transform hover:scale-105 active:scale-95 border-2 border-purple-300 hover:border-purple-500 text-purple-700"
                  disabled={userInput.length >= sequence.length}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {phase === 'feedback' && (
          <div className="space-y-4">
            <div className={`text-3xl font-bold text-center ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {isCorrect ? '🎉 Correct!' : '😔 Incorrect'}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-purple-200/50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">Target Sequence</div>
                <div className="font-mono text-xl font-bold text-purple-700">
                  {sequence.join(' - ')}
                </div>
              </div>
              <div className="bg-pink-200/50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">Your Sequence</div>
                <div className="font-mono text-xl font-bold text-pink-700">
                  {userInput.join(' - ')}
                </div>
              </div>
            </div>
            
            <div className="text-center text-lg">
              Accuracy: {attempts.length > 0 ? attempts[attempts.length - 1].accuracy.toFixed(0) : 0}%
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-wrap justify-center mb-6">
        <button onClick={resetGame} className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
          🔄 Reset Game
        </button>
        <button onClick={() => setShowMetrics(!showMetrics)} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
          📊 {showMetrics ? 'Hide' : 'Show'} Metrics
        </button>
        <button onClick={exportMetrics} className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
          📥 Export JSON
        </button>
        <button onClick={handleReturnToGameSelection} className="px-6 py-3 bg-gray-600/80 hover:bg-gray-600 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
          🏠 Return to Games
        </button>
      </div>

      {showMetrics && (
        <div className="bg-white/30 backdrop-blur-sm border border-white/40 rounded-2xl p-6 max-w-4xl">
          <h3 className="font-bold text-purple-700 mb-4 text-center">🧠 Cognitive Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">Performance</h4>
              <div>Rounds: {attempts.length}</div>
              <div>Correct: {attempts.filter(a => a.correct).length}</div>
              <div>Accuracy: {attempts.length > 0 ? ((attempts.filter(a => a.correct).length / attempts.length) * 100).toFixed(0) : 0}%</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-pink-600 mb-2">Memory Span</h4>
              <div>Current: {sequenceLength}</div>
              <div>Max Reached: {sessionData.maxSequenceReached}</div>
              <div>Best Streak: {bestStreak}</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-rose-600 mb-2">Cognitive Load</h4>
              <div>Hesitations: {hesitations.length}</div>
              <div>Avg Time: {hesitations.length > 0 ? 
                (hesitations.reduce((sum, h) => sum + h.duration, 0) / hesitations.length / 1000).toFixed(1) : 0}s</div>
              <div>Errors: {errors.length}</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-indigo-600 mb-2">Processing Speed</h4>
              <div>Avg Input: {attempts.length > 0 ? 
                (attempts.reduce((sum, a) => sum + a.inputSpeed, 0) / attempts.length / 1000).toFixed(1) : 0}s/digit</div>
              <div>Session: {Math.floor((Date.now() - sessionData.sessionStart) / 60000)}m</div>
              <div>Capacity: {sessionData.maxSequenceReached}</div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-white/20 rounded-lg">
            <h4 className="font-semibold text-purple-600 mb-2 text-center">📈 Error Analysis</h4>
            <div className="grid grid-cols-3 gap-4 text-xs text-center">
              <div>
                <div className="font-bold text-lg text-red-600">
                  {errors.filter(e => e.errorType === 'wrong_digit').length}
                </div>
                <div className="text-gray-600">Wrong Digits</div>
              </div>
              <div>
                <div className="font-bold text-lg text-orange-600">
                  {errors.filter(e => e.errorType === 'wrong_order').length}
                </div>
                <div className="text-gray-600">Wrong Order</div>
              </div>
              <div>
                <div className="font-bold text-lg text-yellow-600">
                  {errors.filter(e => e.errorType === 'omission').length}
                </div>
                <div className="text-gray-600">Omissions</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 max-w-md text-center">
        <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-4">
          <h3 className="font-bold text-purple-700 mb-2">💡 How to Play</h3>
          <p className="text-sm text-gray-700">
            Watch the numbers appear one by one, then enter them in the same order. 
            The sequence gets longer as you improve! Test your working memory capacity.
          </p>
          {!userId && (
            <p className="text-xs text-orange-600 mt-2">
              💡 Sign in to save your progress and track memory improvements!
            </p>
          )}
        </div>
      </div>
    </main>
  )
}