'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import {
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'

// =====================================================
// ================  TEST 1: Processing Speed ==========
// =====================================================
const ProcessingSpeedTest = ({
  timeLeft,
  isActive,
  startTimer,
  onDataUpdate,
}: {
  timeLeft: number
  isActive: boolean
  startTimer: () => void
  onDataUpdate: (data: any) => void
}) => {
  const [score, setScore] = useState(0)
  const [currentSymbol, setCurrentSymbol] = useState<string>('')
  const [targetSymbol, setTargetSymbol] = useState<string>('')
  const [correctHits, setCorrectHits] = useState(0)
  const [falseAlarms, setFalseAlarms] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [buttonPressed, setButtonPressed] = useState(false)

  const symbols = ['■', '★', '●', '◆', '▲', '⬟']
  const symbolNames = ['Square', 'Star', 'Circle', 'Diamond', 'Triangle', 'Pentagon']
  const symbolStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (isActive && testStarted && !currentSymbol) {
      const target = symbols[Math.floor(Math.random() * symbols.length)]
      setTargetSymbol(target)
      showNextSymbol()
    }
  }, [isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      const payload = {
        testType: 'processingSpeed',
        totalSymbols: correctHits + falseAlarms,
        correctHits,
        falseAlarms,
        accuracy:
          correctHits + falseAlarms > 0
            ? (correctHits / (correctHits + falseAlarms)) * 100
            : 0,
        score,
        averageReactionTime:
          reactionTimes.length > 0
            ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
            : 0,
        reactionTimes: [...reactionTimes],
        completed: true,
      }
      onDataUpdate?.(payload)
    }
  }, [timeLeft, testStarted, correctHits, falseAlarms, score, reactionTimes])

  const handleStart = () => {
    setShowInstructions(false)
    setTestStarted(true)
    startTimer?.()
  }

  const showNextSymbol = () => {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)]
    symbolStartRef.current = Date.now()
    setCurrentSymbol(symbol)

    setTimeout(() => {
      if (symbol === targetSymbol && symbolStartRef.current) {
        const elapsed = Date.now() - symbolStartRef.current
        setReactionTimes((prev) => [...prev, elapsed])
      }
      setCurrentSymbol('')
      symbolStartRef.current = null
      setTimeout(showNextSymbol, 150)
    }, 600)
  }

  const handleClick = () => {
    if (!currentSymbol || !testStarted) return
    
    setButtonPressed(true)
    setTimeout(() => setButtonPressed(false), 150)
    
    if (currentSymbol === targetSymbol) {
      if (symbolStartRef.current) {
        const elapsed = Date.now() - symbolStartRef.current
        setReactionTimes((prev) => [...prev, elapsed])
      }
      setScore((p) => p + 1)
      setCorrectHits((p) => p + 1)
    } else {
      setFalseAlarms((p) => p + 1)
    }
  }

  const getTargetName = () => {
    const i = symbols.indexOf(targetSymbol)
    return i !== -1 ? symbolNames[i] : 'Symbol'
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Processing Speed Test
        </h3>
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-8 text-left border border-white/30 shadow-xl">
          <h4 className="text-xl font-semibold mb-4 text-gray-800">Instructions:</h4>
          <ul className="space-y-3 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="mr-2 text-blue-500">•</span>
              Watch for the target shown at the top
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-500">•</span>
              When the same symbol flashes, click the GREEN button
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-blue-500">•</span>
              Be fast and accurate
            </li>
          </ul>
        </div>
        <button
          onClick={handleStart}
          className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold text-xl shadow-lg transform transition-all hover:scale-105"
        >
          Start Test
        </button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2 text-gray-800">Processing Speed Test</h3>
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm rounded-xl p-4 inline-block border border-blue-300/30">
          <p className="text-lg text-gray-700">
            Target:{' '}
            <span className="text-6xl text-blue-500 drop-shadow-lg">{targetSymbol}</span>
            <span className="block text-sm mt-2 text-gray-600">({getTargetName()})</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center mb-8">
        <div className={`text-8xl font-bold w-32 h-32 flex items-center justify-center bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm rounded-2xl border-2 border-white/40 shadow-xl transition-all ${
          currentSymbol ? 'scale-110 shadow-2xl' : 'scale-100'
        }`}>
          <span className={`transition-all ${currentSymbol ? 'animate-pulse' : ''}`}>
            {currentSymbol}
          </span>
        </div>
      </div>

      <button
        onClick={handleClick}
        className={`px-12 py-6 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-semibold text-xl shadow-lg transform transition-all ${
          buttonPressed ? 'scale-95' : 'hover:scale-105'
        } ${!currentSymbol ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={!currentSymbol}
      >
        CLICK
      </button>

      <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto text-sm mt-6">
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-xl p-3 border border-green-300/30">
          <div className="font-bold text-2xl text-green-600">{correctHits}</div>
          <div className="text-gray-600">Correct</div>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl p-3 border border-red-300/30">
          <div className="font-bold text-2xl text-red-600">{falseAlarms}</div>
          <div className="text-gray-600">Errors</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm rounded-xl p-3 border border-blue-300/30">
          <div className="font-bold text-2xl text-blue-600">{score}</div>
          <div className="text-gray-600">Score</div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ================  TEST 2: Working Memory ============
// =====================================================
const WorkingMemoryTest = ({
  timeLeft,
  isActive,
  startTimer,
  onDataUpdate,
}: {
  timeLeft: number
  isActive: boolean
  startTimer: () => void
  onDataUpdate: (data: any) => void
}) => {
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [currentNumber, setCurrentNumber] = useState<number | null>(null)
  const [phase, setPhase] = useState<'instructions' | 'showing' | 'input'>('instructions')
  const [level, setLevel] = useState(3)
  const [score, setScore] = useState(0)
  const [testStarted, setTestStarted] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean>(false)
  const [pressedButton, setPressedButton] = useState<number | null>(null)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const seqStartRef = useRef<number>(Date.now())
  const attemptsRef = useRef<number>(0)

  useEffect(() => {
    if (isActive && testStarted && sequence.length === 0) {
      startNewSequence()
    }
  }, [isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      const testData = {
        testType: 'workingMemory',
        maxLevel: level,
        totalAttempts: attemptsRef.current,
        correctSequences: score,
        accuracy: attemptsRef.current > 0 ? (score / attemptsRef.current) * 100 : 0,
        averageReactionTime:
          reactionTimes.length > 0
            ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
            : 0,
        reactionTimes: [...reactionTimes],
        finalLevel: level,
        completed: true,
      }
      onDataUpdate?.(testData)
    }
  }, [timeLeft, testStarted, score, level, reactionTimes])

  const handleStart = () => {
    setPhase('showing')
    setTestStarted(true)
    startTimer?.()
  }

  const startNewSequence = () => {
    const newSeq = Array.from({ length: level }, () => Math.floor(Math.random() * 9) + 1)
    setSequence(newSeq)
    setUserInput([])
    setPhase('showing')
    showSequence(newSeq)
  }

  const showSequence = async (seq: number[]) => {
    for (let i = 0; i < seq.length; i++) {
      setCurrentNumber(seq[i])
      await wait(1000)
      setCurrentNumber(null)
      await wait(200)
    }
    setPhase('input')
    seqStartRef.current = Date.now()
  }

  const handleNumberClick = (n: number) => {
    if (phase !== 'input') return
    
    setPressedButton(n)
    setTimeout(() => setPressedButton(null), 200)
    
    const clickTime = Date.now() - seqStartRef.current
    setReactionTimes((p) => [...p, clickTime])
    const next = [...userInput, n]
    setUserInput(next)

    if (next.length === sequence.length) {
      attemptsRef.current += 1
      const ok = next.every((v, i) => v === sequence[i])
      setIsCorrect(ok)
      setShowFeedback(true)

      if (ok) {
        setScore((p) => p + 1)
        setLevel((p) => Math.min(p + 1, 8))
      } else {
        setLevel((p) => Math.max(p - 1, 2))
      }

      setTimeout(() => {
        setShowFeedback(false)
        startNewSequence()
      }, 1200)
    } else {
      seqStartRef.current = Date.now()
    }
  }

  if (phase === 'instructions') {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Working Memory Test
        </h3>
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-8 text-left border border-white/30 shadow-xl">
          <h4 className="text-xl font-semibold mb-4 text-gray-800">Instructions:</h4>
          <ul className="space-y-3 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="mr-2 text-purple-500">•</span>
              Watch the numbers appear one by one
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-purple-500">•</span>
              Remember the sequence
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-purple-500">•</span>
              Click them back in the same order
            </li>
          </ul>
        </div>
        <button
          onClick={handleStart}
          className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold text-xl shadow-lg transform transition-all hover:scale-105"
        >
          Start Test
        </button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <h3 className="text-2xl font-bold mb-4 text-gray-800">Working Memory Test</h3>

      {phase === 'showing' && (
        <div className="mb-6">
          <div className="text-8xl font-bold h-32 flex items-center justify-center">
            <span className={`bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent transition-all ${
              currentNumber ? 'scale-110 animate-pulse' : 'scale-100'
            }`}>
              {currentNumber}
            </span>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {sequence.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i <= sequence.indexOf(currentNumber || 0)
                    ? 'bg-purple-500'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'input' && (
        <>
          <div className="mb-6">
            <div className="flex justify-center gap-2 mb-4 min-h-[40px]">
              {userInput.map((num, i) => (
                <span
                  key={i}
                  className="text-2xl font-bold bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-lg px-3 py-1 border border-purple-300/30 animate-fadeIn"
                >
                  {num}
                </span>
              ))}
              {userInput.length < sequence.length && (
                <span className="text-2xl text-gray-400 animate-pulse">_</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => handleNumberClick(n)}
                  className={`aspect-square bg-gradient-to-br from-white/40 to-white/20 backdrop-blur-sm hover:from-white/50 hover:to-white/30 rounded-xl font-bold text-2xl border border-white/40 shadow-lg transform transition-all ${
                    pressedButton === n
                      ? 'scale-95 bg-gradient-to-br from-purple-500/40 to-pink-500/40 shadow-inner'
                      : 'hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Progress: {userInput.length}/{sequence.length}
            </p>
          </div>
        </>
      )}

      {showFeedback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`text-5xl font-bold animate-bounce ${
            isCorrect ? 'text-green-500' : 'text-red-500'
          }`}>
            {isCorrect ? '✓ Correct!' : '✗ Try Again'}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4">
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-purple-300/30">
          <span className="text-sm text-gray-600">Score:</span>
          <span className="ml-2 font-bold text-purple-600">{score}</span>
        </div>
        <div className="bg-gradient-to-br from-indigo-500/20 to-blue-500/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-indigo-300/30">
          <span className="text-sm text-gray-600">Level:</span>
          <span className="ml-2 font-bold text-indigo-600">{level}</span>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ================  TEST 3: Visual Attention ==========
// =====================================================
const AttentionTest = ({
  timeLeft,
  isActive,
  startTimer,
  onDataUpdate,
}: {
  timeLeft: number
  isActive: boolean
  startTimer: () => void
  onDataUpdate: (data: any) => void
}) => {
  const [targetPositions, setTargetPositions] = useState<Set<number>>(new Set())
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set())
  const [phase, setPhase] = useState<'instructions' | 'showing' | 'recall' | 'feedback'>(
    'instructions'
  )
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [testStarted, setTestStarted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [totalAttempts, setTotalAttempts] = useState(0)

  useEffect(() => {
    if (isActive && testStarted && phase === 'showing') {
      startNewRound()
    }
  }, [isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      onDataUpdate?.({
        testType: 'attention',
        totalRounds: totalAttempts,
        correctRounds: score,
        accuracy: totalAttempts > 0 ? (score / totalAttempts) * 100 : 0,
        maxRound: round - 1,
        averageSelectionAccuracy: totalAttempts > 0 ? (score / totalAttempts) * 100 : 0,
        completed: true,
      })
    }
  }, [timeLeft, testStarted, score, totalAttempts, round])

  const handleStart = () => {
    setPhase('showing')
    setTestStarted(true)
    startTimer?.()
  }

  const startNewRound = () => {
    const gridSize = 16
    const numTargets = Math.min(2 + Math.floor(round / 3), 4)
    const newTargets = new Set<number>()
    while (newTargets.size < numTargets) newTargets.add(Math.floor(Math.random() * gridSize))
    setTargetPositions(newTargets)
    setSelectedPositions(new Set())
    setPhase('showing')
    setIsCorrect(null)
    setTimeout(() => setPhase('recall'), 2500)
  }

  const toggleCell = (i: number) => {
    if (phase !== 'recall') return
    const next = new Set(selectedPositions)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelectedPositions(next)
  }

  const submit = () => {
    let correct = 0
    targetPositions.forEach((pos) => {
      if (selectedPositions.has(pos)) correct += 1
    })
    const wasCorrect = correct / targetPositions.size >= 0.5
    setIsCorrect(wasCorrect)
    setPhase('feedback')
    setTotalAttempts((p) => p + 1)
    if (wasCorrect) {
      setScore((p) => p + 1)
      setRound((p) => p + 1)
    }

    onDataUpdate?.({
      testType: 'attention',
      totalRounds: totalAttempts + 1,
      correctRounds: wasCorrect ? score + 1 : score,
      accuracy:
        totalAttempts + 1 > 0 ? ((wasCorrect ? score + 1 : score) / (totalAttempts + 1)) * 100 : 0,
      maxRound: round,
      averageSelectionAccuracy:
        totalAttempts + 1 > 0
          ? ((wasCorrect ? score + 1 : score) / (totalAttempts + 1)) * 100
          : 0,
      completed: false,
    })

    setTimeout(() => {
      if (isActive) startNewRound()
    }, 1500)
  }

  if (phase === 'instructions') {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
          Visual Attention Test
        </h3>
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-8 text-left border border-white/30 shadow-xl">
          <h4 className="text-xl font-semibold mb-4 text-gray-800">Instructions:</h4>
          <ul className="space-y-3 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="mr-2 text-green-500">•</span>
              Watch which squares light up yellow
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-green-500">•</span>
              Remember their positions
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-green-500">•</span>
              Click those same squares when prompted
            </li>
          </ul>
        </div>
        <button
          onClick={handleStart}
          className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-xl font-semibold text-xl shadow-lg transform transition-all hover:scale-105"
        >
          Start Test
        </button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2 text-gray-800">Visual Attention Test</h3>
        <div className={`inline-block px-4 py-2 rounded-xl text-sm font-medium ${
          phase === 'showing'
            ? 'bg-yellow-500/20 text-yellow-700 border border-yellow-300/30'
            : phase === 'recall'
            ? 'bg-blue-500/20 text-blue-700 border border-blue-300/30'
            : 'bg-gray-500/20 text-gray-700 border border-gray-300/30'
        }`}>
          {phase === 'showing'
            ? '👀 Watch the highlighted squares'
            : phase === 'recall'
            ? '🎯 Select the highlighted squares'
            : '💭 Feedback'}
        </div>
      </div>

      <div className="inline-block bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/40 shadow-xl">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }, (_, i) => {
            const isTarget = targetPositions.has(i)
            const isSelected = selectedPositions.has(i)
            
            let className = 'aspect-square rounded-lg transition-all transform '
            
            if (phase === 'showing' && isTarget) {
              className += 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg scale-105 animate-pulse'
            } else if (phase === 'feedback' && isTarget) {
              className += isSelected
                ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-md'
                : 'bg-gradient-to-br from-red-400/70 to-pink-500/70 shadow-md animate-shake'
            } else if (phase === 'feedback' && isSelected && !isTarget) {
              className += 'bg-gradient-to-br from-red-500 to-rose-500 shadow-md animate-shake'
            } else if (phase === 'recall' && isSelected) {
              className += 'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-md scale-95'
            } else {
              className += 'bg-gradient-to-br from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 hover:scale-105 hover:shadow-md'
            }
            
            return (
              <button
                key={i}
                onClick={() => toggleCell(i)}
                className={className}
                disabled={phase !== 'recall'}
                style={{ width: '60px', height: '60px' }}
              />
            )
          })}
        </div>
      </div>

      {phase === 'recall' && (
        <div className="mt-6">
          <button
            onClick={submit}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-xl font-semibold shadow-lg transform transition-all hover:scale-105"
          >
            Submit ({selectedPositions.size} selected)
          </button>
        </div>
      )}

      {phase === 'feedback' && (
        <div className="mt-6">
          <div
            className={`text-2xl font-bold mb-2 ${
              isCorrect ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <p className="text-sm text-gray-600">
            {isCorrect 
              ? 'Great job! Moving to the next round.'
              : 'Green = correct targets, Red = mistakes'}
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-teal-500/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-green-300/30">
          <span className="text-sm text-gray-600">Score:</span>
          <span className="ml-2 font-bold text-green-600">{score}</span>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-amber-500/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-orange-300/30">
          <span className="text-sm text-gray-600">Round:</span>
          <span className="ml-2 font-bold text-orange-600">{round}</span>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ================  TEST 4: Problem Solving ===========
// =====================================================
const ProblemSolvingTest = ({
  timeLeft,
  isActive,
  startTimer,
  onDataUpdate,
}: {
  timeLeft: number
  isActive: boolean
  startTimer: () => void
  onDataUpdate: (data: any) => void
}) => {
  const [board, setBoard] = useState<(null | 'X' | 'O')[]>(Array(9).fill(null))
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [score, setScore] = useState(0)
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [difficulty, setDifficulty] = useState(1)
  const [wins, setWins] = useState(0)
  const [draws, setDraws] = useState(0)
  const [losses, setLosses] = useState(0)
  const [testStarted, setTestStarted] = useState(false)
  const [hoveredSquare, setHoveredSquare] = useState<number | null>(null)
  
  const winningCombos = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]

  useEffect(() => {
    if (isActive && testStarted && !isPlayerTurn && gameState === 'playing') {
      const t = setTimeout(() => makeAIMove(), 500)
      return () => clearTimeout(t)
    }
  }, [isPlayerTurn, gameState, isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      onDataUpdate?.({
        testType: 'problemSolving',
        totalGames: gamesPlayed,
        wins,
        draws,
        losses,
        winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
        finalDifficulty: difficulty,
        score,
        completed: true,
      })
    }
  }, [timeLeft, testStarted, gamesPlayed, wins, draws, losses, difficulty, score])

  const handleStart = () => {
    setTestStarted(true)
    startTimer?.()
  }

  const getWinner = (b: (null | 'X' | 'O')[]) => {
    for (const [a, c, d] of winningCombos) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
    }
    return b.includes(null) ? null : 'draw'
  }

  const empties = (b: (null | 'X' | 'O')[]) =>
    b.map((v, i) => (v === null ? i : null)).filter((x) => x !== null) as number[]

  const bestMove = (b: (null | 'X' | 'O')[], p: 'X' | 'O') => {
    const opp = p === 'X' ? 'O' : 'X'
    for (const [a, c, d] of winningCombos) {
      const vals = [b[a], b[c], b[d]]
      if (vals.filter((v) => v === p).length === 2 && vals.includes(null)) {
        return [a, c, d][vals.indexOf(null)]
      }
    }
    for (const [a, c, d] of winningCombos) {
      const vals = [b[a], b[c], b[d]]
      if (vals.filter((v) => v === opp).length === 2 && vals.includes(null)) {
        return [a, c, d][vals.indexOf(null)]
      }
    }
    if (b[4] === null) return 4
    const corners = [0, 2, 6, 8].filter((i) => b[i] === null)
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)]
    const empty = empties(b)
    return empty.length ? empty[Math.floor(Math.random() * empty.length)] : null
  }

  const makeAIMove = () => {
    const b = [...board]
    const empty = empties(b)
    if (!empty.length) return
    let move: number | null = null

    if (difficulty === 1) {
      move =
        Math.random() < 0.3
          ? bestMove(b, 'O') ?? empty[Math.floor(Math.random() * empty.length)]
          : empty[Math.floor(Math.random() * empty.length)]
    } else if (difficulty === 2) {
      move =
        Math.random() < 0.7
          ? bestMove(b, 'O') ?? empty[Math.floor(Math.random() * empty.length)]
          : empty[Math.floor(Math.random() * empty.length)]
    } else {
      move = bestMove(b, 'O') ?? empty[Math.floor(Math.random() * empty.length)]
    }

    if (move == null) return
    b[move] = 'O'
    setBoard(b)
    const winner = getWinner(b)
    if (winner) endGame(winner)
    else setIsPlayerTurn(true)
  }

  const clickSquare = (i: number) => {
    if (!isPlayerTurn || board[i] !== null || gameState !== 'playing') return
    const b = [...board]
    b[i] = 'X'
    setBoard(b)
    const winner = getWinner(b)
    if (winner) endGame(winner)
    else setIsPlayerTurn(false)
  }

  const endGame = (winner: 'X' | 'O' | 'draw' | null) => {
    const played = gamesPlayed + 1
    setGamesPlayed(played)
    if (winner === 'X') {
      setScore((p) => p + 1)
      setWins((p) => p + 1)
      setGameState('won')
      if (difficulty < 3 && (score + 1) % 2 === 1) setDifficulty((p) => p + 1)
    } else if (winner === 'O') {
      setLosses((p) => p + 1)
      setGameState('lost')
    } else {
      setDraws((p) => p + 1)
      setScore((p) => p + 0.5)
      setGameState('draw')
    }

    onDataUpdate?.({
      testType: 'problemSolving',
      totalGames: played,
      wins: winner === 'X' ? wins + 1 : wins,
      draws: winner === 'draw' ? draws + 1 : draws,
      losses: winner === 'O' ? losses + 1 : losses,
      winRate: played > 0 ? ((winner === 'X' ? wins + 1 : wins) / played) * 100 : 0,
      finalDifficulty: difficulty,
      score:
        winner === 'X' ? score + 1 : winner === 'draw' ? score + 0.5 : score,
      completed: false,
    })

    setTimeout(() => {
      setBoard(Array(9).fill(null))
      setIsPlayerTurn(true)
      setGameState('playing')
    }, 1600)
  }

  if (!testStarted) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
          Problem Solving Test
        </h3>
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-6 mb-8 text-left border border-white/30 shadow-xl">
          <h4 className="text-xl font-semibold mb-4 text-gray-800">Instructions:</h4>
          <ul className="space-y-3 text-lg text-gray-700">
            <li className="flex items-start">
              <span className="mr-2 text-orange-500">•</span>
              Play Tic-Tac-Toe against the AI
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-orange-500">•</span>
              You are X, try to get three in a row
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-orange-500">•</span>
              AI gets tougher as you win more games
            </li>
          </ul>
        </div>
        <button
          onClick={handleStart}
          className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-semibold text-xl shadow-lg transform transition-all hover:scale-105"
        >
          Start Test
        </button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2 text-gray-800">Problem Solving Test</h3>
        <div className={`inline-block px-4 py-2 rounded-xl text-sm font-medium ${
          gameState === 'playing'
            ? isPlayerTurn
              ? 'bg-blue-500/20 text-blue-700 border border-blue-300/30'
              : 'bg-gray-500/20 text-gray-700 border border-gray-300/30 animate-pulse'
            : gameState === 'won'
            ? 'bg-green-500/20 text-green-700 border border-green-300/30'
            : gameState === 'lost'
            ? 'bg-red-500/20 text-red-700 border border-red-300/30'
            : 'bg-yellow-500/20 text-yellow-700 border border-yellow-300/30'
        }`}>
          {gameState === 'playing'
            ? isPlayerTurn
              ? '🎯 Your turn - pick a square'
              : '🤖 AI is thinking...'
            : gameState === 'won'
            ? '🎉 You Won!'
            : gameState === 'lost'
            ? '😔 You Lost'
            : '🤝 Draw!'}
        </div>
      </div>

      <div className="inline-block bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/40 shadow-xl">
        <div className="grid grid-cols-3 gap-2">
          {board.map((v, i) => (
            <button
              key={i}
              onClick={() => clickSquare(i)}
              onMouseEnter={() => setHoveredSquare(i)}
              onMouseLeave={() => setHoveredSquare(null)}
              className={`aspect-square rounded-xl font-bold text-4xl transition-all transform ${
                !isPlayerTurn || v !== null || gameState !== 'playing'
                  ? 'cursor-not-allowed'
                  : 'hover:scale-105'
              } ${
                v === null
                  ? hoveredSquare === i && isPlayerTurn && gameState === 'playing'
                    ? 'bg-gradient-to-br from-blue-400/30 to-indigo-400/30 shadow-lg'
                    : 'bg-gradient-to-br from-gray-200 to-gray-300 shadow-md'
                  : v === 'X'
                  ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-lg'
                  : 'bg-gradient-to-br from-green-400 to-teal-500 text-white shadow-lg'
              }`}
              disabled={!isPlayerTurn || v !== null || gameState !== 'playing'}
              style={{ width: '80px', height: '80px' }}
            >
              {v || ''}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 max-w-xs mx-auto">
        <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm rounded-xl p-3 border border-blue-300/30">
          <div className="font-bold text-2xl text-blue-600">{score}</div>
          <div className="text-sm text-gray-600">Score</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-xl p-3 border border-purple-300/30">
          <div className="font-bold text-2xl text-purple-600">{gamesPlayed}</div>
          <div className="text-sm text-gray-600">Games</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-xl p-3 border border-orange-300/30">
          <div className="font-bold text-2xl text-orange-600">{difficulty}</div>
          <div className="text-sm text-gray-600">Level</div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// =================== FLOW CONTROLLER =================
// =====================================================

type StageSpec = {
  id: string
  title: string
  subtitle: string
  duration: number
  color: string
  cognitive_domain: string
  component: React.ComponentType<{
    timeLeft: number
    isActive: boolean
    startTimer: () => void
    onDataUpdate: (data: any) => void
  }>
}

const assessmentStages: StageSpec[] = [
  {
    id: 'processing-speed',
    title: 'Processing Speed',
    subtitle: 'Quick symbol detection to measure your mental processing speed',
    component: ProcessingSpeedTest,
    duration: 45,
    color: 'from-blue-500 to-cyan-500',
    cognitive_domain: 'Processing Speed',
  },
  {
    id: 'working-memory',
    title: 'Working Memory',
    subtitle: 'Number sequence recall to assess your working memory capacity',
    component: WorkingMemoryTest,
    duration: 30,
    color: 'from-purple-500 to-pink-500',
    cognitive_domain: 'Working Memory',
  },
  {
    id: 'attention',
    title: 'Visual Attention',
    subtitle: 'Spatial attention and visual memory assessment',
    component: AttentionTest,
    duration: 45,
    color: 'from-green-500 to-teal-500',
    cognitive_domain: 'Attention',
  },
  {
    id: 'problem-solving',
    title: 'Problem Solving',
    subtitle: 'Strategic thinking via Tic-Tac-Toe gameplay',
    component: ProblemSolvingTest,
    duration: 30,
    color: 'from-orange-500 to-red-500',
    cognitive_domain: 'Problem Solving',
  },
]

async function createAssessmentSession(userId: string) {
  const ref = await addDoc(collection(db, 'users', userId, 'cognitivePerformance'), {
    type: 'onboardingAssessment',
    startedAt: serverTimestamp(),
    completedAt: null,
    summary: {},
  })
  return ref.id
}

async function updateAssessmentSession(
  userId: string,
  sessionId: string,
  data: Record<string, any>
) {
  const ref = doc(db, 'users', userId, 'cognitivePerformance', sessionId)
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

// Add CSS animations
const animationStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  
  .animate-shake {
    animation: shake 0.3s ease-in-out;
  }
`

export default function CognitiveAssessmentFlow() {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number>(assessmentStages[0].duration)
  const [isActive, setIsActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const user = auth.currentUser

  useEffect(() => {
    // Inject animation styles
    const style = document.createElement('style')
    style.textContent = animationStyles
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

 
  useEffect(() => {
    if (!isActive) return
    if (stageTimerRef.current) clearInterval(stageTimerRef.current)
    stageTimerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(stageTimerRef.current as NodeJS.Timeout)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => {
      if (stageTimerRef.current) clearInterval(stageTimerRef.current)
    }
  }, [isActive])

  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      setIsActive(false)
      setTimeout(() => goNext(), 600)
    }
  }, [timeLeft, isActive])

  const startTimer = async () => {
  // Create session on first test start if it doesn't exist
  if (!sessionId && user?.uid) {
    const id = await createAssessmentSession(user.uid)
    setSessionId(id)
  }
  setIsActive(true)
}

  const ActiveComponent = assessmentStages[currentStage].component

  const handleStageData = async (partial: any) => {
  if (!user?.uid) return
  
  // Create session if it doesn't exist yet
  let currentSessionId = sessionId
  if (!currentSessionId) {
    currentSessionId = await createAssessmentSession(user.uid)
    setSessionId(currentSessionId)
  }
  
  setSaving(true)
  try {
    await updateAssessmentSession(user.uid, currentSessionId, {
      [`stages.${assessmentStages[currentStage].id}`]: partial,
    })
  } finally {
    setSaving(false)
  }
}

 const goNext = async () => {
  if (currentStage < assessmentStages.length - 1) {
    const next = currentStage + 1
    setCurrentStage(next)
    setTimeLeft(assessmentStages[next].duration)
    setIsActive(false)
    await wait(200)
  } else {
    // ✅ Final stage completed
    if (user?.uid && sessionId) {
      await updateAssessmentSession(user.uid, sessionId, {
        completedAt: serverTimestamp(),
        completed: true,  // Add explicit flag
      })
    }
    router.push('/Prep/AboutMePage')
  }
}

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-100 font-sans text-gray-900 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Cognitive Onboarding
          </h1>
          <p className="text-lg text-gray-700 mt-2">Quick assessment across four core abilities</p>
        </header>

        <section className="rounded-3xl shadow-2xl p-8 bg-white/70 backdrop-blur-xl border border-white/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {assessmentStages[currentStage].title}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {assessmentStages[currentStage].subtitle}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-extrabold tabular-nums bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {timeLeft}s
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Time left</div>
            </div>
          </div>

          <div className="rounded-2xl p-6 bg-gradient-to-br from-white/50 to-white/30 backdrop-blur-sm border border-white/50 shadow-inner">
            <ActiveComponent
              timeLeft={timeLeft}
              isActive={isActive}
              startTimer={startTimer}
              onDataUpdate={handleStageData}
            />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Stage <span className="font-semibold">{currentStage + 1}</span> of{' '}
              <span className="font-semibold">{assessmentStages.length}</span>
              {saving && <span className="ml-3 text-indigo-600 animate-pulse">• saving…</span>}
            </div>

            <div className="flex gap-3">
              {!isActive && timeLeft === assessmentStages[currentStage].duration && (
                <button
                  onClick={() => setIsActive(true)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-lg transform transition-all hover:scale-105"
                >
                  Start Test
                </button>
              )}
              <button
                onClick={goNext}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold shadow-lg transform transition-all hover:scale-105"
              >
                {currentStage < assessmentStages.length - 1 ? 'Skip →' : 'Finish ✓'}
              </button>
            </div>
          </div>
        </section>

        <div className="mt-8 flex items-center justify-center gap-3">
          {assessmentStages.map((stage, i) => (
            <div
              key={stage.id}
              className={`h-2 rounded-full transition-all ${
                i === currentStage
                  ? 'w-12 bg-gradient-to-r ' + stage.color
                  : i < currentStage
                  ? 'w-8 bg-gray-400'
                  : 'w-8 bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}