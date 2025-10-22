'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Import Firebase modules - adjust these paths to match your project structure
const firebaseAvailable = (() => {
  try {
    return typeof window !== 'undefined'
  } catch {
    return false
  }
})()

// Placeholder Firebase functions if not available
const mockFirebase = {
  db: null,
  auth: null,
  onAuthStateChanged: () => () => {},
  doc: () => ({}),
  setDoc: async () => {},
  collection: () => ({}),
  addDoc: async () => {}
}

// Updated ProcessingSpeedTest with consistent icon sizes
const ProcessingSpeedTest = ({ onComplete, timeLeft, isActive, startTimer, onDataUpdate }) => {
  const [score, setScore] = useState(0)
  const [currentSymbol, setCurrentSymbol] = useState('')
  const [targetSymbol, setTargetSymbol] = useState('')
  const [correctHits, setCorrectHits] = useState(0)
  const [falseAlarms, setFalseAlarms] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [reactionTimes, setReactionTimes] = useState([])
  const [levelStartTime, setLevelStartTime] = useState(Date.now())
  
  const symbols = ['■', '★', '●', '◆', '▲', '⬟']
  const symbolNames = ['Square', 'Star', 'Circle', 'Diamond', 'Triangle', 'Pentagon']
  
  useEffect(() => {
    if (isActive && testStarted && !currentSymbol) {
      const target = symbols[Math.floor(Math.random() * symbols.length)]
      setTargetSymbol(target)
      showNextSymbol()
    }
  }, [isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      const testData = {
        testType: 'processingSpeed',
        totalSymbols: correctHits + falseAlarms,
        correctHits,
        falseAlarms,
        accuracy: correctHits + falseAlarms > 0 ? (correctHits / (correctHits + falseAlarms)) * 100 : 0,
        score,
        averageReactionTime: reactionTimes.length > 0 ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length : 0,
        reactionTimes: [...reactionTimes],
        completed: true
      }
      if (onDataUpdate) onDataUpdate(testData)
    }
  }, [timeLeft, testStarted, correctHits, falseAlarms, score, reactionTimes])
  
  const handleStartTest = () => {
    setShowInstructions(false)
    setTestStarted(true)
    setLevelStartTime(Date.now())
    if (startTimer) startTimer()
  }
  
  const showNextSymbol = () => {
    const symbolStartTime = Date.now()
    const symbol = symbols[Math.floor(Math.random() * symbols.length)]
    setCurrentSymbol(symbol)
    
    setTimeout(() => {
      if (symbol === targetSymbol) {
        const reactionTime = Date.now() - symbolStartTime
        setReactionTimes(prev => [...prev, reactionTime])
      }
      setCurrentSymbol('')
      setTimeout(showNextSymbol, 150)
    }, 600)
  }
  
  const handleClick = () => {
    if (!currentSymbol || !testStarted) return
    
    const reactionTime = Date.now() - (Date.now() - 800)
    setReactionTimes(prev => [...prev, reactionTime])
    
    if (currentSymbol === targetSymbol) {
      setScore(prev => prev + 1)
      setCorrectHits(prev => prev + 1)
    } else {
      setFalseAlarms(prev => prev + 1)
    }
  }
  
  const getTargetName = () => {
    const index = symbols.indexOf(targetSymbol)
    return index !== -1 ? symbolNames[index] : 'Symbol'
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6">Processing Speed Test</h3>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 text-left">
          <h4 className="text-xl font-semibold mb-4">Instructions:</h4>
          <ul className="space-y-3 text-lg">
            <li>• You will see a target symbol at the top of the screen</li>
            <li>• Various symbols will flash quickly in the center</li>
            <li>• Click the GREEN button only when you see the target symbol</li>
            <li>• Don't click for any other symbols</li>
            <li>• Work as quickly and accurately as possible</li>
          </ul>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h4 className="text-lg font-semibold mb-4">Example:</h4>
          <p className="mb-4">If your target is: <span className="text-4xl text-blue-400 mx-2">★</span> (Star)</p>
          <p>Click the button only when you see the star symbol flash</p>
        </div>
        
        <button
          onClick={handleStartTest}
          className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xl"
        >
          Start Test
        </button>
      </div>
    )
  }
  
  return (
    <div className="text-center">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2">Processing Speed Test</h3>
        <p className="text-lg">Target: <span className="text-6xl text-blue-400">{targetSymbol}</span> ({getTargetName()})</p>
        <p className="text-sm opacity-75">Click the green button when you see the target symbol</p>
      </div>
      
      <div className="mb-8">
        <div className="text-6xl font-bold h-24 flex items-center justify-center">
          {currentSymbol}
        </div>
      </div>
      
      <div className="flex justify-center mb-4">
        <button
          onClick={handleClick}
          className="px-12 py-6 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xl"
          disabled={!currentSymbol}
        >
          CLICK
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto text-sm">
        <div className="bg-white/20 rounded-lg p-2">
          <div className="font-bold text-green-400">{correctHits}</div>
          <div className="opacity-75">Correct</div>
        </div>
        <div className="bg-white/20 rounded-lg p-2">
          <div className="font-bold text-red-400">{falseAlarms}</div>
          <div className="opacity-75">Errors</div>
        </div>
        <div className="bg-white/20 rounded-lg p-2">
          <div className="font-bold text-blue-400">{score}</div>
          <div className="opacity-75">Score</div>
        </div>
      </div>
    </div>
  )
}

// Updated WorkingMemoryTest with visual feedback
const WorkingMemoryTest = ({ onComplete, timeLeft, isActive, startTimer, onDataUpdate }) => {
  const [sequence, setSequence] = useState([])
  const [userInput, setUserInput] = useState([])
  const [currentNumber, setCurrentNumber] = useState(null)
  const [phase, setPhase] = useState('showing')
  const [level, setLevel] = useState(3)
  const [score, setScore] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [reactionTimes, setReactionTimes] = useState([])
  const [sequenceStartTime, setSequenceStartTime] = useState(Date.now())
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  
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
        totalAttempts: attempts,
        correctSequences: score,
        accuracy: attempts > 0 ? (score / attempts) * 100 : 0,
        averageReactionTime: reactionTimes.length > 0 ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length : 0,
        reactionTimes: [...reactionTimes],
        finalLevel: level,
        completed: true
      }
      if (onDataUpdate) onDataUpdate(testData)
    }
  }, [timeLeft, testStarted, score, attempts, level, reactionTimes])
  
  const handleStartTest = () => {
    setShowInstructions(false)
    setTestStarted(true)
    if (startTimer) startTimer()
  }
  
  const startNewSequence = () => {
    const newSequence = Array.from({ length: level }, () => Math.floor(Math.random() * 9) + 1)
    setSequence(newSequence)
    setUserInput([])
    setPhase('showing')
    setShowFeedback(false)
    setIsCorrect(null)
    setSequenceStartTime(Date.now())
    showSequence(newSequence)
  }
  
  const showSequence = async (seq) => {
    for (let i = 0; i < seq.length; i++) {
      setCurrentNumber(seq[i])
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCurrentNumber(null)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    setPhase('input')
    setSequenceStartTime(Date.now())
  }
  
  const handleNumberClick = (num) => {
    if (phase !== 'input' || showFeedback) return
    
    const clickTime = Date.now()
    const reactionTime = clickTime - sequenceStartTime
    
    const newInput = [...userInput, num]
    setUserInput(newInput)
    setReactionTimes(prev => [...prev, reactionTime])
    
    if (newInput.length === sequence.length) {
      const correct = newInput.every((num, idx) => num === sequence[idx])
      setAttempts(prev => prev + 1)
      setIsCorrect(correct)
      setShowFeedback(true)
      
      if (correct) {
        setScore(prev => prev + 1)
        setLevel(prev => Math.min(prev + 1, 8))
      } else {
        setLevel(prev => Math.max(prev - 1, 2))
      }
      
      setTimeout(() => {
        startNewSequence()
      }, 1500)
    } else {
      setSequenceStartTime(clickTime)
    }
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6">Working Memory Test</h3>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 text-left">
          <h4 className="text-xl font-semibold mb-4">Instructions:</h4>
          <ul className="space-y-3 text-lg">
            <li>• Watch as numbers appear one by one on screen</li>
            <li>• Remember the sequence in the correct order</li>
            <li>• After the sequence ends, click the numbers in the same order</li>
            <li>• The test starts with 3 numbers and adapts based on your performance</li>
            <li>• Focus and try to remember as many as possible</li>
          </ul>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h4 className="text-lg font-semibold mb-4">Example:</h4>
          <p className="mb-2">If you see: <span className="text-2xl text-blue-400 mx-1">7</span> → <span className="text-2xl text-blue-400 mx-1">3</span> → <span className="text-2xl text-blue-400 mx-1">9</span></p>
          <p>Then click: 7, then 3, then 9</p>
        </div>
        
        <button
          onClick={handleStartTest}
          className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xl"
        >
          Start Test
        </button>
      </div>
    )
  }
  
  return (
    <div className="text-center">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2">Working Memory Test</h3>
        <p className="text-sm opacity-75">Remember the sequence, then click numbers in order</p>
      </div>
      
      {phase === 'showing' && (
        <div className="mb-8">
          <div className="text-8xl font-bold h-32 flex items-center justify-center text-blue-400">
            {currentNumber}
          </div>
          <p className="text-lg">Watch the sequence... (Level {level})</p>
        </div>
      )}
      
      {phase === 'input' && (
        <div className="mb-8">
          {showFeedback && (
            <div className={`text-4xl font-bold mb-6 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
            </div>
          )}
          
          <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto mb-6">
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className={`aspect-square bg-white/20 hover:bg-white/30 rounded-lg font-bold text-xl transition-colors ${
                  showFeedback ? 'cursor-not-allowed opacity-50' : ''
                }`}
                disabled={showFeedback}
              >
                {num}
              </button>
            ))}
          </div>
          <div className="text-lg">
            Progress: {userInput.map((num, idx) => (
              <span key={idx} className={
                showFeedback 
                  ? num === sequence[idx] 
                    ? 'text-green-400' 
                    : 'text-red-400'
                  : ''
              }>
                {num}{idx < userInput.length - 1 ? '-' : ''}
              </span>
            ))} ({userInput.length}/{sequence.length})
          </div>
        </div>
      )}
      
      <div className="text-lg">Score: {score} | Level: {level}</div>
    </div>
  )
}

// AttentionTest component (unchanged)
const AttentionTest = ({ onComplete, timeLeft, isActive, startTimer, onDataUpdate }) => {
  const [grid, setGrid] = useState([])
  const [targetPositions, setTargetPositions] = useState(new Set())
  const [selectedPositions, setSelectedPositions] = useState(new Set())
  const [phase, setPhase] = useState('showing')
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [totalAttempts, setTotalAttempts] = useState(0)
  
  useEffect(() => {
    if (isActive && testStarted && phase === 'showing') {
      startNewRound()
    }
  }, [isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      const testData = {
        testType: 'attention',
        totalRounds: totalAttempts,
        correctRounds: score,
        accuracy: totalAttempts > 0 ? (score / totalAttempts) * 100 : 0,
        maxRound: round - 1,
        averageSelectionAccuracy: totalAttempts > 0 ? (score / totalAttempts) * 100 : 0,
        completed: true
      }
      if (onDataUpdate) onDataUpdate(testData)
    }
  }, [timeLeft, testStarted, score, totalAttempts, round])

  const handleStartTest = () => {
    setShowInstructions(false)
    setTestStarted(true)
    if (startTimer) startTimer()
  }
  
  const startNewRound = () => {
    const gridSize = 16
    const numTargets = Math.min(2 + Math.floor(round / 3), 4)
    
    const newTargetPositions = new Set()
    while (newTargetPositions.size < numTargets) {
      newTargetPositions.add(Math.floor(Math.random() * gridSize))
    }
    
    setTargetPositions(newTargetPositions)
    setSelectedPositions(new Set())
    setPhase('showing')
    setIsCorrect(null)
    
    setTimeout(() => {
      setPhase('recall')
    }, 2500)
  }
  
  const handleCellClick = (index) => {
    if (phase !== 'recall') return
    
    const newSelected = new Set(selectedPositions)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedPositions(newSelected)
  }
  
  const submitAnswer = () => {
    let correct = 0
    targetPositions.forEach(pos => {
      if (selectedPositions.has(pos)) correct++
    })
    
    const accuracy = correct / targetPositions.size
    const wasCorrect = accuracy >= 0.5
    setIsCorrect(wasCorrect)
    setPhase('feedback')
    setTotalAttempts(prev => prev + 1)
    
    if (wasCorrect) {
      setScore(prev => prev + 1)
      setRound(prev => prev + 1)
    }
    
    if (onDataUpdate) {
      const newTotalAttempts = totalAttempts + 1
      const newScore = wasCorrect ? score + 1 : score
      
      onDataUpdate({
        testType: 'attention',
        totalRounds: newTotalAttempts,
        correctRounds: newScore,
        accuracy: newTotalAttempts > 0 ? (newScore / newTotalAttempts) * 100 : 0,
        maxRound: round,
        averageSelectionAccuracy: newTotalAttempts > 0 ? (newScore / newTotalAttempts) * 100 : 0,
        completed: false
      })
    }
    
    setTimeout(() => {
      if (isActive) {
        startNewRound()
      }
    }, 1500)
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6">Visual Attention Test</h3>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 text-left">
          <h4 className="text-xl font-semibold mb-4">Instructions:</h4>
          <ul className="space-y-3 text-lg">
            <li>• You'll see a 4x4 grid of squares</li>
            <li>• Some squares will be highlighted in yellow for 2 seconds</li>
            <li>• Remember which squares were highlighted</li>
            <li>• After they disappear, click on the squares that were highlighted</li>
            <li>• Click "Submit" when you've selected all the squares you remember</li>
            <li>• You'll see feedback after each round showing if you were correct</li>
          </ul>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <div className="text-lg font-semibold mb-2">Tips:</div>
          <p>• You can click squares multiple times to toggle selection</p>
          <p>• Selected squares will turn blue</p>
          <p>• Try to be as accurate as possible</p>
        </div>
        
        <button
          onClick={handleStartTest}
          className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xl"
        >
          Start Test
        </button>
      </div>
    )
  }
  
  return (
    <div className="text-center">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2">Visual Attention Test</h3>
        <p className="text-sm opacity-75">
          {phase === 'showing' 
            ? 'Remember the highlighted squares' 
            : phase === 'recall'
            ? 'Click the squares that were highlighted'
            : 'Feedback'
          }
        </p>
      </div>
      
      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto mb-6">
        {Array.from({ length: 16 }, (_, index) => (
          <button
            key={index}
            onClick={() => handleCellClick(index)}
            className={`aspect-square rounded-lg font-bold transition-colors ${
              phase === 'showing' && targetPositions.has(index)
                ? 'bg-yellow-400'
                : phase === 'feedback' && targetPositions.has(index)
                ? selectedPositions.has(index)
                  ? 'bg-green-400'
                  : 'bg-red-400/70'
                : phase === 'feedback' && selectedPositions.has(index) && !targetPositions.has(index)
                ? 'bg-red-400'
                : phase === 'recall' && selectedPositions.has(index)
                ? 'bg-blue-400'
                : 'bg-white/20 hover:bg-white/30'
            }`}
            disabled={phase === 'showing' || phase === 'feedback'}
          />
        ))}
      </div>
      
      {phase === 'recall' && (
        <button
          onClick={submitAnswer}
          className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold mb-4"
        >
          Submit ({selectedPositions.size} selected)
        </button>
      )}
      
      {phase === 'feedback' && (
        <div className="mb-4">
          <div className={`text-2xl font-bold mb-2 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <p className="text-sm opacity-75">
            Green squares were correct targets, red squares show mistakes
          </p>
        </div>
      )}
      
      <div className="text-lg">Score: {score} | Round: {round}</div>
    </div>
  )
}

// ProblemSolvingTest component (unchanged, included for completeness)
const ProblemSolvingTest = ({ onComplete, timeLeft, isActive, startTimer, onDataUpdate }) => {
  const [board, setBoard] = useState(Array(9).fill(null))
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [gameState, setGameState] = useState('playing')
  const [score, setScore] = useState(0)
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [difficulty, setDifficulty] = useState(1)
  const [wins, setWins] = useState(0)
  const [draws, setDraws] = useState(0)
  const [losses, setLosses] = useState(0)
  
  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ]
  
  useEffect(() => {
    if (isActive && testStarted && !isPlayerTurn && gameState === 'playing') {
      const timer = setTimeout(() => {
        makeAIMove()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isPlayerTurn, gameState, isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      const testData = {
        testType: 'problemSolving',
        totalGames: gamesPlayed,
        wins,
        draws,
        losses,
        winRate: gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0,
        finalDifficulty: difficulty,
        score,
        completed: true
      }
      if (onDataUpdate) onDataUpdate(testData)
    }
  }, [timeLeft, testStarted, gamesPlayed, wins, draws, losses, difficulty, score])
  
  const handleStartTest = () => {
    setShowInstructions(false)
    setTestStarted(true)
    if (startTimer) startTimer()
  }
  
  const checkWinner = (boardState) => {
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
        return boardState[a]
      }
    }
    return boardState.includes(null) ? null : 'draw'
  }
  
  const getEmptySquares = (boardState) => {
    return boardState.map((square, index) => square === null ? index : null).filter(val => val !== null)
  }
  
  const makeAIMove = () => {
    const currentBoard = [...board]
    const emptySquares = getEmptySquares(currentBoard)
    
    if (emptySquares.length === 0) return
    
    let move
    
    if (difficulty === 1) {
      if (Math.random() < 0.3) {
        move = getBestMove(currentBoard, 'O') || emptySquares[Math.floor(Math.random() * emptySquares.length)]
      } else {
        move = emptySquares[Math.floor(Math.random() * emptySquares.length)]
      }
    } else if (difficulty === 2) {
      if (Math.random() < 0.7) {
        move = getBestMove(currentBoard, 'O') || emptySquares[Math.floor(Math.random() * emptySquares.length)]
      } else {
        move = emptySquares[Math.floor(Math.random() * emptySquares.length)]
      }
    } else {
      move = getBestMove(currentBoard, 'O') || emptySquares[Math.floor(Math.random() * emptySquares.length)]
    }
    
    const newBoard = [...currentBoard]
    newBoard[move] = 'O'
    setBoard(newBoard)
    
    const winner = checkWinner(newBoard)
    if (winner) {
      handleGameEnd(winner)
    } else {
      setIsPlayerTurn(true)
    }
  }
  
  const getBestMove = (boardState, player) => {
    const opponent = player === 'X' ? 'O' : 'X'
    
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [boardState[a], boardState[b], boardState[c]]
      if (values.filter(v => v === player).length === 2 && values.includes(null)) {
        return combo[values.indexOf(null)]
      }
    }
    
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [boardState[a], boardState[b], boardState[c]]
      if (values.filter(v => v === opponent).length === 2 && values.includes(null)) {
        return combo[values.indexOf(null)]
      }
    }
    
    if (boardState[4] === null) return 4
    
    const corners = [0, 2, 6, 8]
    const availableCorners = corners.filter(corner => boardState[corner] === null)
    if (availableCorners.length > 0) {
      return availableCorners[Math.floor(Math.random() * availableCorners.length)]
    }
    
    return null
  }
  
  const handleSquareClick = (index) => {
    if (!isPlayerTurn || board[index] !== null || gameState !== 'playing') return
    
    const newBoard = [...board]
    newBoard[index] = 'X'
    setBoard(newBoard)
    
    const winner = checkWinner(newBoard)
    if (winner) {
      handleGameEnd(winner)
    } else {
      setIsPlayerTurn(false)
    }
  }
  
  const handleGameEnd = (winner) => {
    const newGamesPlayed = gamesPlayed + 1
    setGamesPlayed(newGamesPlayed)
    
    if (winner === 'X') {
      setScore(prev => prev + 1)
      setWins(prev => prev + 1)
      setGameState('won')
      if (difficulty < 3 && score > 0 && score % 2 === 1) {
        setDifficulty(prev => prev + 1)
      }
    } else if (winner === 'O') {
      setLosses(prev => prev + 1)
      setGameState('lost')
    } else {
      setScore(prev => prev + 0.5)
      setDraws(prev => prev + 1)
      setGameState('draw')
    }
    
    if (onDataUpdate) {
      const newWins = winner === 'X' ? wins + 1 : wins
      const newDraws = winner === 'draw' ? draws + 1 : draws
      const newLosses = winner === 'O' ? losses + 1 : losses
      const newScore = winner === 'X' ? score + 1 : winner === 'draw' ? score + 0.5 : score
      
      onDataUpdate({
        testType: 'problemSolving',
        totalGames: newGamesPlayed,
        wins: newWins,
        draws: newDraws,
        losses: newLosses,
        winRate: newGamesPlayed > 0 ? (newWins / newGamesPlayed) * 100 : 0,
        finalDifficulty: difficulty,
        score: newScore,
        completed: false
      })
    }
    
    setTimeout(() => {
      startNewGame()
    }, 2000)
  }
  
  const startNewGame = () => {
    setBoard(Array(9).fill(null))
    setIsPlayerTurn(true)
    setGameState('playing')
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6">Problem Solving Test</h3>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 text-left">
          <h4 className="text-xl font-semibold mb-4">Instructions:</h4>
          <ul className="space-y-3 text-lg">
            <li>• Play Tic-Tac-Toe against the AI</li>
            <li>• You are X, the AI is O</li>
            <li>• Click on empty squares to make your moves</li>
            <li>• Try to get three X's in a row (horizontal, vertical, or diagonal)</li>
            <li>• The AI will get smarter as you win more games</li>
            <li>• Score points for wins and draws</li>
          </ul>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h4 className="text-lg font-semibold mb-4">Scoring:</h4>
          <p>• Win = 1 point</p>
          <p>• Draw = 0.5 points</p>
          <p>• Loss = 0 points</p>
          <p>• AI difficulty increases as you improve</p>
        </div>
        
        <button
          onClick={handleStartTest}
          className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-xl"
        >
          Start Test
        </button>
      </div>
    )
  }
  
  return (
    <div className="text-center">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2">Problem Solving Test</h3>
        <p className="text-sm opacity-75">
          {gameState === 'playing' 
            ? isPlayerTurn 
              ? 'Your turn - Click a square'
              : 'AI is thinking...'
            : gameState === 'won'
            ? '🎉 You Won!'
            : gameState === 'lost'
            ? '😔 You Lost'
            : '🤝 Draw!'
          }
        </p>
      </div>
      
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-6">
        {board.map((square, index) => (
          <button
            key={index}
            onClick={() => handleSquareClick(index)}
            className={`aspect-square bg-white/20 hover:bg-white/30 rounded-lg font-bold text-3xl transition-colors ${
              !isPlayerTurn || square !== null || gameState !== 'playing' 
                ? 'cursor-not-allowed opacity-70' 
                : 'hover:bg-white/40'
            } ${
              square === 'X' ? 'text-blue-400' : square === 'O' ? 'text-green-200' : 'text-white/50'
            }`}
            disabled={!isPlayerTurn || square !== null || gameState !== 'playing'}
          >
            {square || ''}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto text-sm">
        <div className="bg-white/20 rounded-lg p-2">
          <div className="font-bold text-blue-400">{score}</div>
          <div className="opacity-75">Score</div>
        </div>
        <div className="bg-white/20 rounded-lg p-2">
          <div className="font-bold text-purple-400">{gamesPlayed}</div>
          <div className="opacity-75">Games</div>
        </div>
        <div className="bg-white/20 rounded-lg p-2">
          <div className="font-bold text-orange-400">{difficulty}</div>
          <div className="opacity-75">Level</div>
        </div>
      </div>
    </div>
  )
}