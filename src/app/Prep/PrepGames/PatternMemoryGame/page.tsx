'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
  recallLatency: number
}

interface HesitationEvent {
  round: number
  duration: number
  timestamp: number
  phase: 'viewing' | 'recalling'
  cellPosition: number
}

interface ErrorPattern {
  round: number
  errorType: 'order' | 'selection' | 'omission'
  expectedPosition: number
  userSelection: number
  timestamp: number
}

interface AttentionEvent {
  round: number
  timestamp: number
  focusDuration: number
  distractionDetected: boolean
}

interface RecallLatencyEvent {
  round: number
  timestamp: number
  latency: number
  cellIndex: number
  isCorrect: boolean
}

interface SessionData {
  sessionStart: number
  maxPatternReached: number
  totalRounds: number
  totalCorrect: number
  
  visualWorkingMemory: {
    currentCapacity: number
    maxCapacity: number
    averageCapacity: number
    retentionRate: number
    spatialAccuracy: number
  }
  
  shortTermRecall: {
    immediateRecallAccuracy: number
    recallSpeed: number
    decayRate: number
    consistencyScore: number
  }
  
  patternRecognition: {
    overallAccuracy: number
    spatialPatternScore: number
    sequenceRecognition: number
    visualDiscrimination: number
  }
  
  attentionSpan: {
    sustainedAttentionScore: number
    attentionLapses: number
    focusDuration: number
    distractionResistance: number
  }
  
  recallLatency: {
    averageLatency: number
    hesitationFrequency: number
    averageHesitationDuration: number
    retrievalEfficiency: number
  }
  
  detailedLogs: {
    attempts: PatternAttempt[]
    hesitations: HesitationEvent[]
    errors: ErrorPattern[]
    attentionEvents: AttentionEvent[]
    recallLatencyEvents: RecallLatencyEvent[]
  }
}

export default function PatternMemoryGame() {
  const router = useRouter()
  const [grid, setGrid] = useState<boolean[]>(Array(16).fill(false))
  const [distractorGrid, setDistractorGrid] = useState<boolean[]>(Array(16).fill(false))
  const [targetPattern, setTargetPattern] = useState<number[]>([])
  const [userPattern, setUserPattern] = useState<number[]>([])
  const [phase, setPhase] = useState<'showing' | 'recall' | 'feedback' | 'distraction'>('showing')
  const [patternSize, setPatternSize] = useState(2)
  const [round, setRound] = useState(1)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  
  const [attempts, setAttempts] = useState<PatternAttempt[]>([])
  const [hesitations, setHesitations] = useState<HesitationEvent[]>([])
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([])
  const [roundStartTime, setRoundStartTime] = useState(Date.now())
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionStart: Date.now(),
    maxPatternReached: 2,
    totalRounds: 0,
    totalCorrect: 0,
    visualWorkingMemory: {
      currentCapacity: 2,
      maxCapacity: 2,
      averageCapacity: 2,
      retentionRate: 100,
      spatialAccuracy: 100
    },
    shortTermRecall: {
      immediateRecallAccuracy: 100,
      recallSpeed: 0,
      decayRate: 0,
      consistencyScore: 100
    },
    patternRecognition: {
      overallAccuracy: 100,
      spatialPatternScore: 100,
      sequenceRecognition: 100,
      visualDiscrimination: 100
    },
    attentionSpan: {
      sustainedAttentionScore: 100,
      attentionLapses: 0,
      focusDuration: 0,
      distractionResistance: 100
    },
    recallLatency: {
      averageLatency: 0,
      hesitationFrequency: 0,
      averageHesitationDuration: 0,
      retrievalEfficiency: 100
    },
    detailedLogs: {
      attempts: [],
      hesitations: [],
      errors: [],
      attentionEvents: [],
      recallLatencyEvents: []
    }
  })
  
  const [userId, setUserId] = useState<string | null>(null)
  const [showMetrics, setShowMetrics] = useState(false)
  
  const lastActionTime = useRef(Date.now())
  const sessionStartTime = useRef(Date.now())
  const patternShowTime = useRef(Date.now())
  const recallStartTime = useRef(Date.now())
  const hesitationThreshold = 1500
  const cellClickTimes = useRef<number[]>([])

  useEffect(() => {
    if (phase === 'showing' && targetPattern.length === 0) {
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
    cellClickTimes.current = []
    
    showPattern(newPattern)
  }

  const showPattern = async (pattern: number[]) => {
    const patternStartTime = Date.now()
    const newGrid = Array(16).fill(false)
    
    // Show the target pattern in yellow
    for (let i = 0; i < pattern.length; i++) {
      newGrid[pattern[i]] = true
      setGrid([...newGrid])
      setDistractorGrid(Array(16).fill(false))
      await new Promise(resolve => setTimeout(resolve, 800))
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
    setGrid(Array(16).fill(false))
    
    // Add distraction phase for rounds > 14
    if (round > 14) {
      await new Promise(resolve => setTimeout(resolve, 300))
      setPhase('distraction')
      
      // Show 2-3 random blue cells as distractors
      const numDistractors = Math.floor(Math.random() * 2) + 2
      const distractorCells: number[] = []
      
      while (distractorCells.length < numDistractors) {
        const cell = Math.floor(Math.random() * 16)
        if (!pattern.includes(cell) && !distractorCells.includes(cell)) {
          distractorCells.push(cell)
        }
      }
      
      // Flash distractor cells in blue
      for (let i = 0; i < distractorCells.length; i++) {
        const distractorGridTemp = Array(16).fill(false)
        distractorGridTemp[distractorCells[i]] = true
        setDistractorGrid([...distractorGridTemp])
        await new Promise(resolve => setTimeout(resolve, 600))
      }
      
      setDistractorGrid(Array(16).fill(false))
    }
    
    const focusDuration = Date.now() - patternStartTime
    const attentionEvent: AttentionEvent = {
      round,
      timestamp: Date.now(),
      focusDuration,
      distractionDetected: round > 14
    }
    
    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        attentionEvents: [...prev.detailedLogs.attentionEvents, attentionEvent]
      }
    }))
    
    await new Promise(resolve => setTimeout(resolve, 300))
    setPhase('recall')
    recallStartTime.current = Date.now()
    lastActionTime.current = Date.now()
  }

  const handleCellClick = (index: number) => {
    if (phase !== 'recall') return
    
    const now = Date.now()
    const timeSinceLastAction = now - lastActionTime.current
    const recallLatency = now - recallStartTime.current
    
    if (timeSinceLastAction > hesitationThreshold) {
      const hesitationEvent: HesitationEvent = {
        round,
        duration: timeSinceLastAction,
        timestamp: now,
        phase: 'recalling',
        cellPosition: userPattern.length
      }
      
      setHesitations(prev => [...prev, hesitationEvent])
      
      setSessionData(prev => ({
        ...prev,
        attentionSpan: {
          ...prev.attentionSpan,
          attentionLapses: prev.attentionSpan.attentionLapses + 1
        },
        recallLatency: {
          ...prev.recallLatency,
          hesitationFrequency: prev.recallLatency.hesitationFrequency + 1
        },
        detailedLogs: {
          ...prev.detailedLogs,
          hesitations: [...prev.detailedLogs.hesitations, hesitationEvent]
        }
      }))
    }
    
    const isCorrectCell = targetPattern.includes(index)
    const latencyEvent: RecallLatencyEvent = {
      round,
      timestamp: now,
      latency: recallLatency,
      cellIndex: index,
      isCorrect: isCorrectCell
    }
    
    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        recallLatencyEvents: [...prev.detailedLogs.recallLatencyEvents, latencyEvent]
      }
    }))
    
    cellClickTimes.current.push(timeSinceLastAction)
    
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
    const recallLatency = now - recallStartTime.current
    const hesitationTime = hesitations
      .filter(h => h.round === round)
      .reduce((sum, h) => sum + h.duration, 0)
    
    let correctSelections = 0
    let spatialErrors = 0
    
    userPattern.forEach(cell => {
      if (targetPattern.includes(cell)) {
        correctSelections++
      } else {
        spatialErrors++
      }
    })
    
    const accuracy = targetPattern.length > 0 ? (correctSelections / targetPattern.length) * 100 : 0
    const isCorrectAnswer = correctSelections === targetPattern.length && userPattern.length === targetPattern.length
    
    setIsCorrect(isCorrectAnswer)
    setPhase('feedback')
    
    userPattern.forEach((cell, idx) => {
      if (!targetPattern.includes(cell)) {
        const errorEvent: ErrorPattern = {
          round,
          errorType: 'selection',
          expectedPosition: -1,
          userSelection: cell,
          timestamp: now
        }
        setErrorPatterns(prev => [...prev, errorEvent])
        
        setSessionData(prev => ({
          ...prev,
          detailedLogs: {
            ...prev.detailedLogs,
            errors: [...prev.detailedLogs.errors, errorEvent]
          }
        }))
      }
    })
    
    targetPattern.forEach((cell, idx) => {
      if (!userPattern.includes(cell)) {
        const errorEvent: ErrorPattern = {
          round,
          errorType: 'omission',
          expectedPosition: idx,
          userSelection: -1,
          timestamp: now
        }
        setErrorPatterns(prev => [...prev, errorEvent])
        
        setSessionData(prev => ({
          ...prev,
          detailedLogs: {
            ...prev.detailedLogs,
            errors: [...prev.detailedLogs.errors, errorEvent]
          }
        }))
      }
    })
    
    setSessionData(prev => {
      const allAttempts = [...attempts, { 
        round, patternSize, correct: isCorrectAnswer, 
        userPattern, targetPattern, accuracy, timestamp: now, 
        reactionTime, hesitationTime, recallLatency 
      }]
      
      const totalAttempts = allAttempts.length
      const correctAttempts = allAttempts.filter(a => a.correct).length
      
      const allLatencies = prev.detailedLogs.recallLatencyEvents.map(e => e.latency)
      const avgLatency = allLatencies.length > 0 
        ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length 
        : recallLatency
      
      const allHesitations = prev.detailedLogs.hesitations
      const avgHesitationDuration = allHesitations.length > 0
        ? allHesitations.reduce((sum, h) => sum + h.duration, 0) / allHesitations.length
        : 0
      
      const attentionEvents = prev.detailedLogs.attentionEvents
      const totalFocusDuration = attentionEvents.reduce((sum, e) => sum + e.focusDuration, 0)
      
      return {
        ...prev,
        maxPatternReached: Math.max(prev.maxPatternReached, patternSize),
        visualWorkingMemory: {
          currentCapacity: patternSize,
          maxCapacity: Math.max(prev.visualWorkingMemory.maxCapacity, patternSize),
          averageCapacity: ((prev.visualWorkingMemory.averageCapacity * (totalAttempts - 1)) + patternSize) / totalAttempts,
          retentionRate: (correctAttempts / totalAttempts) * 100,
          spatialAccuracy: accuracy
        },
        shortTermRecall: {
          immediateRecallAccuracy: accuracy,
          recallSpeed: recallLatency / targetPattern.length,
          decayRate: spatialErrors > 0 ? (spatialErrors / targetPattern.length) * 100 : 0,
          consistencyScore: Math.max(0, 100 - (spatialErrors * 20))
        },
        patternRecognition: {
          overallAccuracy: (correctAttempts / totalAttempts) * 100,
          spatialPatternScore: accuracy,
          sequenceRecognition: correctSelections === targetPattern.length ? 100 : (correctSelections / targetPattern.length) * 100,
          visualDiscrimination: Math.max(0, 100 - (spatialErrors * 15))
        },
        attentionSpan: {
          sustainedAttentionScore: Math.max(0, 100 - (prev.attentionSpan.attentionLapses * 5)),
          attentionLapses: prev.attentionSpan.attentionLapses,
          focusDuration: totalFocusDuration,
          distractionResistance: Math.max(0, 100 - (prev.attentionSpan.attentionLapses * 3))
        },
        recallLatency: {
          averageLatency: avgLatency,
          hesitationFrequency: prev.recallLatency.hesitationFrequency,
          averageHesitationDuration: avgHesitationDuration,
          retrievalEfficiency: Math.max(0, 100 - (avgLatency / 100))
        }
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
      hesitationTime,
      recallLatency
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
      }
    } else {
      setStreak(0)
      if (patternSize > 2) {
        setPatternSize(prev => prev - 1)
      }
    }
    
    setTimeout(() => {
      setRound(prev => prev + 1)
      setTargetPattern([])
      startNewRound()
    }, 2000)
  }

  const exportMetrics = () => {
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
        visualWorkingMemory: sessionData.visualWorkingMemory,
        shortTermRecall: sessionData.shortTermRecall,
        patternRecognition: sessionData.patternRecognition,
        attentionSpan: sessionData.attentionSpan,
        recallLatency: sessionData.recallLatency
      },
      detailedData: {
        ...sessionData,
        attempts,
        hesitations,
        errors: errorPatterns
      }
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
    setTargetPattern([])
    setAttempts([])
    setHesitations([])
    setErrorPatterns([])
    cellClickTimes.current = []
    setSessionData({
      sessionStart: Date.now(),
      maxPatternReached: 2,
      totalRounds: 0,
      totalCorrect: 0,
      visualWorkingMemory: {
        currentCapacity: 2,
        maxCapacity: 2,
        averageCapacity: 2,
        retentionRate: 100,
        spatialAccuracy: 100
      },
      shortTermRecall: {
        immediateRecallAccuracy: 100,
        recallSpeed: 0,
        decayRate: 0,
        consistencyScore: 100
      },
      patternRecognition: {
        overallAccuracy: 100,
        spatialPatternScore: 100,
        sequenceRecognition: 100,
        visualDiscrimination: 100
      },
      attentionSpan: {
        sustainedAttentionScore: 100,
        attentionLapses: 0,
        focusDuration: 0,
        distractionResistance: 100
      },
      recallLatency: {
        averageLatency: 0,
        hesitationFrequency: 0,
        averageHesitationDuration: 0,
        retrievalEfficiency: 100
      },
      detailedLogs: {
        attempts: [],
        hesitations: [],
        errors: [],
        attentionEvents: [],
        recallLatencyEvents: []
      }
    })
    sessionStartTime.current = Date.now()
    startNewRound()
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-100 via-teal-100 to-cyan-100 text-gray-900 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-green-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
          Pattern Memory Challenge 🧩
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-teal-700">Round {round}</span>
          <span className="text-lg font-semibold text-cyan-700">Pattern Size: {patternSize}</span>
          {round > 14 && (
            <span className="text-lg font-semibold text-blue-600 animate-pulse">🔵 Distraction Mode!</span>
          )}
        </div>
        <div className="flex gap-6 justify-center text-sm text-gray-600 flex-wrap">
          <span className="bg-green-200 px-3 py-1 rounded-full">Score: {score}</span>
          <span className="bg-yellow-200 px-3 py-1 rounded-full">Streak: {streak}</span>
          <span className="bg-purple-200 px-3 py-1 rounded-full">Best: {bestStreak}</span>
          <span className="bg-blue-200 px-3 py-1 rounded-full">Lapses: {sessionData.attentionSpan.attentionLapses}</span>
        </div>
        <p className="text-lg text-gray-700 mt-4 font-medium">
          {phase === 'showing' ? '👀 Watch the pattern...' : 
           phase === 'distraction' ? '🔵 Ignore these blue cells!' :
           phase === 'recall' ? '🧠 Click the cells that lit up!' : 
           isCorrect ? '✅ Correct!' : '❌ Not quite!'}
        </p>
        {round > 14 && phase === 'distraction' && (
          <p className="text-sm text-blue-600 mt-2 font-semibold">
            ⚠️ Don't memorize the blue cells!
          </p>
        )}
      </div>

      <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-3xl p-8 shadow-xl mb-8">
        <div className="grid grid-cols-4 gap-3 w-80">
          {grid.map((isActive, index) => {
            const isDistractor = distractorGrid[index]
            return (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                className={`aspect-square rounded-2xl font-bold text-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 border-2 ${
                  phase === 'showing' && isActive ? 'bg-yellow-400 border-yellow-500 animate-pulse' :
                  phase === 'distraction' && isDistractor ? 'bg-blue-500 border-blue-600 animate-pulse' :
                  phase === 'recall' && isActive ? 'bg-teal-400 border-teal-500' :
                  phase === 'feedback' && targetPattern.includes(index) && userPattern.includes(index) ? 'bg-green-400 border-green-500' :
                  phase === 'feedback' && targetPattern.includes(index) && !userPattern.includes(index) ? 'bg-red-400 border-red-500' :
                  phase === 'feedback' && !targetPattern.includes(index) && userPattern.includes(index) ? 'bg-orange-400 border-orange-500' :
                  'bg-white/60 hover:bg-white/80 border-gray-300'
                }`}
                disabled={phase !== 'recall'}
              />
            )
          })}
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
        <div className="bg-white/30 backdrop-blur-sm border border-white/40 rounded-2xl p-6 max-w-6xl w-full">
          <h3 className="font-bold text-teal-700 mb-4 text-center text-2xl">🧠 Cognitive Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-green-600 mb-2">👁️ Visual Working Memory</h4>
              <div>Current: {sessionData.visualWorkingMemory.currentCapacity}</div>
              <div>Max: {sessionData.visualWorkingMemory.maxCapacity}</div>
              <div>Avg: {sessionData.visualWorkingMemory.averageCapacity.toFixed(1)}</div>
              <div>Retention: {sessionData.visualWorkingMemory.retentionRate.toFixed(0)}%</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-teal-600 mb-2">⚡ Short-Term Recall</h4>
              <div>Accuracy: {sessionData.shortTermRecall.immediateRecallAccuracy.toFixed(0)}%</div>
              <div>Speed: {sessionData.shortTermRecall.recallSpeed.toFixed(0)}ms/item</div>
              <div>Decay: {sessionData.shortTermRecall.decayRate.toFixed(0)}%</div>
              <div>Consistency: {sessionData.shortTermRecall.consistencyScore.toFixed(0)}%</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-cyan-600 mb-2">🎯 Pattern Recognition</h4>
              <div>Overall: {sessionData.patternRecognition.overallAccuracy.toFixed(0)}%</div>
              <div>Spatial: {sessionData.patternRecognition.spatialPatternScore.toFixed(0)}%</div>
              <div>Sequence: {sessionData.patternRecognition.sequenceRecognition.toFixed(0)}%</div>
              <div>Discrimination: {sessionData.patternRecognition.visualDiscrimination.toFixed(0)}%</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-blue-600 mb-2">👀 Attention Span</h4>
              <div>Score: {sessionData.attentionSpan.sustainedAttentionScore.toFixed(0)}%</div>
              <div>Lapses: {sessionData.attentionSpan.attentionLapses}</div>
              <div>Focus: {(sessionData.attentionSpan.focusDuration / 1000).toFixed(1)}s</div>
              <div>Resistance: {sessionData.attentionSpan.distractionResistance.toFixed(0)}%</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-indigo-600 mb-2">⏱️ Recall Latency</h4>
              <div>Avg: {sessionData.recallLatency.averageLatency.toFixed(0)}ms</div>
              <div>Hesitations: {sessionData.recallLatency.hesitationFrequency}</div>
              <div>Avg Hesitation: {sessionData.recallLatency.averageHesitationDuration.toFixed(0)}ms</div>
              <div>Efficiency: {sessionData.recallLatency.retrievalEfficiency.toFixed(0)}%</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">📊 Performance</h4>
              <div>Rounds: {attempts.length}</div>
              <div>Correct: {attempts.filter(a => a.correct).length}</div>
              <div>Accuracy: {attempts.length > 0 ? ((attempts.filter(a => a.correct).length / attempts.length) * 100).toFixed(0) : 0}%</div>
              <div>Best Streak: {bestStreak}</div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-white/20 rounded-lg">
            <h4 className="font-semibold text-teal-600 mb-2 text-center">📈 Error Analysis</h4>
            <div className="grid grid-cols-3 gap-4 text-xs text-center">
              <div>
                <div className="font-bold text-lg text-red-600">
                  {errorPatterns.filter(e => e.errorType === 'selection').length}
                </div>
                <div className="text-gray-600">Wrong Selection</div>
              </div>
              <div>
                <div className="font-bold text-lg text-orange-600">
                  {errorPatterns.filter(e => e.errorType === 'omission').length}
                </div>
                <div className="text-gray-600">Omissions</div>
              </div>
              <div>
                <div className="font-bold text-lg text-yellow-600">
                  {errorPatterns.filter(e => e.errorType === 'order').length}
                </div>
                <div className="text-gray-600">Order Errors</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-white/20 rounded-lg">
            <h4 className="font-semibold text-cyan-600 mb-2 text-center">⏱️ Timing Analysis</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-center">
              <div>
                <div className="font-bold text-lg text-blue-600">
                  {Math.floor((Date.now() - sessionData.sessionStart) / 60000)}m
                </div>
                <div className="text-gray-600">Session Time</div>
              </div>
              <div>
                <div className="font-bold text-lg text-green-600">
                  {hesitations.length}
                </div>
                <div className="text-gray-600">Total Hesitations</div>
              </div>
              <div>
                <div className="font-bold text-lg text-teal-600">
                  {attempts.length > 0 ? 
                    (attempts.reduce((sum, a) => sum + a.reactionTime, 0) / attempts.length / 1000).toFixed(1) : 0}s
                </div>
                <div className="text-gray-600">Avg Reaction</div>
              </div>
              <div>
                <div className="font-bold text-lg text-cyan-600">
                  {attempts.length > 0 ? 
                    (attempts.reduce((sum, a) => sum + a.recallLatency, 0) / attempts.length / 1000).toFixed(1) : 0}s
                </div>
                <div className="text-gray-600">Avg Recall</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 max-w-md text-center">
        <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-4">
          <h3 className="font-bold text-teal-700 mb-2">💡 How to Play</h3>
          <p className="text-sm text-gray-700">
            Watch the pattern of cells light up, then click the same cells you saw. 
            The pattern gets larger as you improve! After level 14, blue distraction cells will appear - ignore them!
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