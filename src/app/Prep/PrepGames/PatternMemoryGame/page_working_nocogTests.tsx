'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface PatternAttempt {
  round: number
  patternSize: number
  correct: boolean
  userPattern: number[]
  targetPattern: number[]
  accuracy: number
  timestamp: number
  reactionTime: number
  hesitationTime: number
}

interface HesitationEvent {
  round: number
  duration: number
  timestamp: number
  phase: 'viewing' | 'recalling'
}

interface ErrorPattern {
  round: number
  errorType: 'order' | 'selection' | 'omission'
  expectedPosition: number
  userSelection: number
  timestamp: number
}

interface LevelData {
  level: number
  maxPatternSize: number
  roundsCompleted: number
  correctRounds: number
  timing: {
    startTime: number
    endTime: number
    totalDuration: number
  }
  performance: {
    accuracy: number
    avgReactionTime: number
    bestStreak: number
    memoryCapacity: number
  }
  cognitive: {
    avgHesitationTime: number
    totalHesitations: number
    errorRate: number
    patternRecognition: number
  }
  detailedLogs: {
    attempts: PatternAttempt[]
    hesitations: HesitationEvent[]
    errors: ErrorPattern[]
  }
}

interface SessionData {
  levels: LevelData[]
  sessionStart: number
  maxPatternReached: number
  totalRounds: number
  totalCorrect: number
}

export default function PatternMemoryGame() {
  const router = useRouter()
  const [grid, setGrid] = useState<boolean[]>(Array(16).fill(false))
  const [targetPattern, setTargetPattern] = useState<number[]>([])
  const [userPattern, setUserPattern] = useState<number[]>([])
  const [phase, setPhase] = useState<'showing' | 'recall' | 'feedback'>('showing')
  const [patternSize, setPatternSize] = useState(2)
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  
  // Cognitive tracking
  const [attempts, setAttempts] = useState<PatternAttempt[]>([])
  const [hesitations, setHesitations] = useState<HesitationEvent[]>([])
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([])
  const [roundStartTime, setRoundStartTime] = useState(Date.now())
  const [sessionData, setSessionData] = useState<SessionData>({
    levels: [],
    sessionStart: Date.now(),
    maxPatternReached: 2,
    totalRounds: 0,
    totalCorrect: 0
  })
  
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showMetrics, setShowMetrics] = useState(false)
  
  const lastActionTime = useRef(Date.now())
  const sessionStartTime = useRef(Date.now())
  const patternShowTime = useRef(Date.now())
  const hesitationThreshold = 1500

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (phase === 'showing') {
      startNewRound()
    }
  }, [])

  const startNewRound = () => {
    const now = Date.now()
    setRoundStartTime(now)
    lastActionTime.current = now
    patternShowTime.current = now
    
    const numCells = Math.min(patternSize, 8)
    const newPattern: number[] = []
    
    while (newPattern.length < numCells) {
      const cell = Math.floor(Math.random() * 16)
      if (!newPattern.includes(cell)) {
        newPattern.push(cell)
      }
    }
    
    setTargetPattern(newPattern)
    setUserPattern([])
    setPhase('showing')
    setIsCorrect(null)
    
    showPattern(newPattern)
  }

  const showPattern = async (pattern: number[]) => {
    const newGrid = Array(16).fill(false)
    
    for (let i = 0; i < pattern.length; i++) {
      newGrid[pattern[i]] = true
      setGrid([...newGrid])
      await new Promise(resolve => setTimeout(resolve, 800))
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
    setGrid(Array(16).fill(false))
    
    await new Promise(resolve => setTimeout(resolve, 300))
    setPhase('recall')
    lastActionTime.current = Date.now()
  }

  const handleCellClick = (index: number) => {
    if (phase !== 'recall') return
    
    const now = Date.now()
    const timeSinceLastAction = now - lastActionTime.current
    
    if (timeSinceLastAction > hesitationThreshold) {
      setHesitations(prev => [...prev, {
        round,
        duration: timeSinceLastAction,
        timestamp: now,
        phase: 'recalling'
      }])
    }
    
    const newUserPattern = [...userPattern]
    
    if (newUserPattern.includes(index)) {
      const idx = newUserPattern.indexOf(index)
      newUserPattern.splice(idx, 1)
    } else {
      newUserPattern.push(index)
    }
    
    setUserPattern(newUserPattern)
    
    const newGrid = Array(16).fill(false)
    newUserPattern.forEach(cell => newGrid[cell] = true)
    setGrid(newGrid)
    
    lastActionTime.current = now
  }

  const submitAnswer = () => {
    const now = Date.now()
    const reactionTime = now - roundStartTime
    const hesitationTime = hesitations
      .filter(h => h.round === round)
      .reduce((sum, h) => sum + h.duration, 0)
    
    let correctSelections = 0
    userPattern.forEach(cell => {
      if (targetPattern.includes(cell)) correctSelections++
    })
    
    const accuracy = targetPattern.length > 0 ? (correctSelections / targetPattern.length) * 100 : 0
    const isCorrectAnswer = accuracy >= 70 && userPattern.length === targetPattern.length
    
    setIsCorrect(isCorrectAnswer)
    setPhase('feedback')
    
    // Track errors
    userPattern.forEach((cell, idx) => {
      if (!targetPattern.includes(cell)) {
        setErrorPatterns(prev => [...prev, {
          round,
          errorType: 'selection',
          expectedPosition: -1,
          userSelection: cell,
          timestamp: now
        }])
      }
    })
    
    targetPattern.forEach((cell, idx) => {
      if (!userPattern.includes(cell)) {
        setErrorPatterns(prev => [...prev, {
          round,
          errorType: 'omission',
          expectedPosition: idx,
          userSelection: -1,
          timestamp: now
        }])
      }
    })
    
    const attempt: PatternAttempt = {
      round,
      patternSize,
      correct: isCorrectAnswer,
      userPattern: [...userPattern],
      targetPattern: [...targetPattern],
      accuracy,
      timestamp: now,
      reactionTime,
      hesitationTime
    }
    
    setAttempts(prev => [...prev, attempt])
    
    if (isCorrectAnswer) {
      setScore(prev => prev + 1)
      setStreak(prev => {
        const newStreak = prev + 1
        if (newStreak > bestStreak) setBestStreak(newStreak)
        return newStreak
      })
      
      if (round % 2 === 0 && patternSize < 8) {
        setPatternSize(prev => prev + 1)
        setSessionData(prev => ({
          ...prev,
          maxPatternReached: Math.max(prev.maxPatternReached, patternSize + 1)
        }))
      }
    } else {
      setStreak(0)
      if (patternSize > 2) {
        setPatternSize(prev => prev - 1)
      }
    }
    
    setTimeout(() => {
      if (round < 15) {
        setRound(prev => prev + 1)
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
      maxPatternSize: sessionData.maxPatternReached,
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
        avgReactionTime: attempts.length > 0 ?
          attempts.reduce((sum, a) => sum + a.reactionTime, 0) / attempts.length : 0,
        bestStreak,
        memoryCapacity: sessionData.maxPatternReached
      },
      cognitive: {
        avgHesitationTime: hesitations.length > 0 ?
          hesitations.reduce((sum, h) => sum + h.duration, 0) / hesitations.length : 0,
        totalHesitations: hesitations.length,
        errorRate: attempts.length > 0 ?
          (attempts.filter(a => !a.correct).length / attempts.length) * 100 : 0,
        patternRecognition: attempts.length > 0 ?
          attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length : 0
      },
      detailedLogs: {
        attempts,
        hesitations,
        errors: errorPatterns
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
        maxPatternSize: sessionData.maxPatternReached,
        totalRounds: attempts.length
      },
      performance: {
        score,
        accuracy: attempts.length > 0 ? 
          (attempts.filter(a => a.correct).length / attempts.length) * 100 : 0,
        bestStreak,
        memoryCapacity: sessionData.maxPatternReached
      },
      cognitiveProfile: {
        avgReactionTime: attempts.length > 0 ?
          attempts.reduce((sum, a) => sum + a.reactionTime, 0) / attempts.length : 0,
        avgHesitationTime: hesitations.length > 0 ?
          hesitations.reduce((sum, h) => sum + h.duration, 0) / hesitations.length : 0,
        patternRecognition: attempts.length > 0 ?
          attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length : 0,
        errorRate: attempts.length > 0 ?
          (errorPatterns.length / attempts.length) : 0
      },
      detailedData: sessionData
    }
    
    const dataStr = JSON.stringify(metrics, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `pattern-memory-session-${new Date().toISOString().split('T')[0]}.json`
    
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
    setPatternSize(2)
    setAttempts([])
    setHesitations([])
    setErrorPatterns([])
    setSessionData(prev => ({
      ...prev,
      sessionStart: Date.now(),
      maxPatternReached: 2
    }))
    sessionStartTime.current = Date.now()
    startNewRound()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-100 via-teal-100 to-cyan-100 text-gray-900 flex flex-col items-center justify-center p-6">
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          💾 Saving session data...
        </div>
      )}
      
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
          Pattern Memory Challenge 🧩
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-teal-700">Round {round}/15</span>
          <span className="text-lg font-semibold text-cyan-700">Pattern Size: {patternSize}</span>
        </div>
        <div className="flex gap-6 justify-center text-sm text-gray-600">
          <span className="bg-green-200 px-3 py-1 rounded-full">Score: {score}</span>
          <span className="bg-yellow-200 px-3 py-1 rounded-full">Streak: {streak}</span>
          <span className="bg-purple-200 px-3 py-1 rounded-full">Best: {bestStreak}</span>
          <span className="bg-blue-200 px-3 py-1 rounded-full">Hesitations: {hesitations.length}</span>
        </div>
        <p className="text-lg text-gray-700 mt-4 font-medium">
          {phase === 'showing' ? '👀 Watch the pattern...' : 
           phase === 'recall' ? '🧠 Click the cells that lit up!' : 
           isCorrect ? '✅ Correct!' : '❌ Not quite!'}
        </p>
      </div>

      <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-3xl p-8 shadow-xl mb-8">
        <div className="grid grid-cols-4 gap-3 w-80">
          {grid.map((isActive, index) => (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              className={`aspect-square rounded-2xl font-bold text-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 border-2 ${
                phase === 'showing' && isActive ? 'bg-yellow-400 border-yellow-500 animate-pulse' :
                phase === 'recall' && isActive ? 'bg-blue-400 border-blue-500' :
                phase === 'feedback' && targetPattern.includes(index) && userPattern.includes(index) ? 'bg-green-400 border-green-500' :
                phase === 'feedback' && targetPattern.includes(index) && !userPattern.includes(index) ? 'bg-red-400 border-red-500' :
                phase === 'feedback' && !targetPattern.includes(index) && userPattern.includes(index) ? 'bg-orange-400 border-orange-500' :
                'bg-white/60 hover:bg-white/80 border-gray-300'
              }`}
              disabled={phase !== 'recall'}
            />
          ))}
        </div>
        
        {phase === 'recall' && (
          <button
            onClick={submitAnswer}
            className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-400 hover:to-teal-400 text-white rounded-full font-semibold shadow-lg transition-all"
          >
            Submit ({userPattern.length} selected)
          </button>
        )}
      </div>

      <div className="flex gap-4 flex-wrap justify-center mb-6">
        <button onClick={resetGame} className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white rounded-full font-semibold shadow-lg transition-all">
          🔄 Reset Game
        </button>
        <button onClick={() => setShowMetrics(!showMetrics)} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-full font-semibold shadow-lg transition-all">
          📊 {showMetrics ? 'Hide' : 'Show'} Metrics
        </button>
        <button onClick={exportMetrics} className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-full font-semibold shadow-lg transition-all">
          📥 Export JSON
        </button>
        <button onClick={handleReturnToGameSelection} className="px-6 py-3 bg-gray-600/80 hover:bg-gray-600 text-white rounded-full font-semibold shadow-lg transition-all">
          🏠 Return to Games
        </button>
      </div>

      {showMetrics && (
        <div className="bg-white/30 backdrop-blur-sm border border-white/40 rounded-2xl p-6 max-w-4xl">
          <h3 className="font-bold text-teal-700 mb-4 text-center">🧠 Cognitive Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-green-600 mb-2">Performance</h4>
              <div>Rounds: {attempts.length}</div>
              <div>Correct: {attempts.filter(a => a.correct).length}</div>
              <div>Accuracy: {attempts.length > 0 ? ((attempts.filter(a => a.correct).length / attempts.length) * 100).toFixed(0) : 0}%</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-teal-600 mb-2">Memory Capacity</h4>
              <div>Current: {patternSize}</div>
              <div>Max Reached: {sessionData.maxPatternReached}</div>
              <div>Best Streak: {bestStreak}</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-cyan-600 mb-2">Cognitive Load</h4>
              <div>Hesitations: {hesitations.length}</div>
              <div>Avg Time: {hesitations.length > 0 ? 
                (hesitations.reduce((sum, h) => sum + h.duration, 0) / hesitations.length / 1000).toFixed(1) : 0}s</div>
              <div>Errors: {errorPatterns.length}</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">Pattern Recognition</h4>
              <div>Avg Accuracy: {attempts.length > 0 ? 
                (attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length).toFixed(0) : 0}%</div>
              <div>Session: {Math.floor((Date.now() - sessionData.sessionStart) / 60000)}m</div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}