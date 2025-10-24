'use client'

import React, { useState, useEffect, useRef } from 'react'

// Mock game components for the assessment
const ProcessingSpeedTest = ({ 
  onComplete, 
  timeLeft, 
  isActive, 
  startTimer, 
  onDataUpdate 
}: { 
  onComplete: () => void;
  timeLeft: number;
  isActive: boolean;
  startTimer: () => void;
  onDataUpdate: (data: any) => void;
}) => {
  const [score, setScore] = useState(0)
  const [currentSymbol, setCurrentSymbol] = useState('')
  const [targetSymbol, setTargetSymbol] = useState('')
  const [correctHits, setCorrectHits] = useState(0)
  const [falseAlarms, setFalseAlarms] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
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
      // Send final data when time runs out
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
      onDataUpdate(testData)
    }
  }, [timeLeft, testStarted])
  
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
        // Record missed target (no click within time window)
        const reactionTime = Date.now() - symbolStartTime
        setReactionTimes(prev => [...prev, reactionTime])
      }
      setCurrentSymbol('')
      setTimeout(showNextSymbol, 200)
    }, 800)
  }
  
  const handleClick = () => {
    if (!currentSymbol || !testStarted) return
    
    const reactionTime = Date.now() - (Date.now() - 800) // Approximate symbol show time
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
        <p className="text-lg">Target: <span className="text-4xl text-blue-400">{targetSymbol}</span> ({getTargetName()})</p>
        <p className="text-sm opacity-75">Click the green button when you see the target symbol</p>
      </div>
      
      <div className="mb-8">
        <div className="text-8xl font-bold h-24 flex items-center justify-center">
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

const WorkingMemoryTest = ({ 
  onComplete, 
  timeLeft, 
  isActive, 
  startTimer, 
  onDataUpdate 
}: { 
  onComplete: () => void;
  timeLeft: number;
  isActive: boolean;
  startTimer: () => void;
  onDataUpdate: (data: any) => void;
}) => {
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [currentNumber, setCurrentNumber] = useState(null)
  const [phase, setPhase] = useState('showing')
  const [level, setLevel] = useState(3)
  const [score, setScore] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [sequenceStartTime, setSequenceStartTime] = useState(Date.now())
  
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
      onDataUpdate(testData)
    }
  }, [timeLeft, testStarted])
  
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
    setSequenceStartTime(Date.now())
    showSequence(newSequence)
  }
  
  const showSequence = async (seq: number[]) => {
    for (let i = 0; i < seq.length; i++) {
      setCurrentNumber(seq[i])
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCurrentNumber(null)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    setPhase('input')
    setSequenceStartTime(Date.now()) // Reset timer for input phase
  }
  
  const handleNumberClick = (num) => {
    if (phase !== 'input') return
    
    const clickTime = Date.now()
    const reactionTime = clickTime - sequenceStartTime
    
    const newInput = [...userInput, num]
    setUserInput(newInput)
    setReactionTimes(prev => [...prev, reactionTime])
    
    if (newInput.length === sequence.length) {
      const correct = newInput.every((num, idx) => num === sequence[idx])
      setAttempts(prev => prev + 1)
      
      if (correct) {
        setScore(prev => prev + 1)
        setLevel(prev => Math.min(prev + 1, 8))
      } else {
        setLevel(prev => Math.max(prev - 1, 2))
      }
      
      setTimeout(() => {
        startNewSequence()
      }, 1000)
    } else {
      // Update sequence start time for next click
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
          <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto mb-6">
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="aspect-square bg-white/20 hover:bg-white/30 rounded-lg font-bold text-xl"
              >
                {num}
              </button>
            ))}
          </div>
          <div className="text-lg">
            Progress: {userInput.join('-')} ({userInput.length}/{sequence.length})
          </div>
        </div>
      )}
      
      <div className="text-lg">Score: {score} | Level: {level}</div>
    </div>
  )
}

const AttentionTest = ({ 
  onComplete, 
  timeLeft, 
  isActive, 
  startTimer, 
  onDataUpdate 
}: { 
  onComplete: () => void;
  timeLeft: number;
  isActive: boolean;
  startTimer: () => void;
  onDataUpdate: (data: any) => void;
}) => {
  const [grid, setGrid] = useState([])
  const [targetPositions, setTargetPositions] = useState(new Set())
  const [selectedPositions, setSelectedPositions] = useState(new Set())
  const [phase, setPhase] = useState('showing') // 'showing', 'recall', 'feedback'
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(1)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  
  useEffect(() => {
    if (isActive && testStarted && phase === 'showing') {
      startNewRound()
    }
  }, [isActive, testStarted])
  
  const handleStartTest = () => {
    setShowInstructions(false)
    setTestStarted(true)
    if (startTimer) startTimer()
  }
  
  const startNewRound = () => {
    const gridSize = 16
    const numTargets = Math.min(3 + Math.floor(round / 2), 6)
    
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
    }, 2000)
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
    const wasCorrect = accuracy >= 0.7
    setIsCorrect(wasCorrect)
    setPhase('feedback')
    
    if (wasCorrect) {
      setScore(prev => prev + 1)
      setRound(prev => prev + 1)
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

const ProblemSolvingTest = ({ onComplete, timeLeft, isActive, startTimer }) => {
  const [board, setBoard] = useState(Array(9).fill(null))
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [gameState, setGameState] = useState('playing') // 'playing', 'won', 'lost', 'draw'
  const [score, setScore] = useState(0)
  const [gamesPlayed, setGamesPlayed] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [difficulty, setDifficulty] = useState(1) // 1 = easy, 2 = medium, 3 = hard
  
  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ]
  
  useEffect(() => {
    if (isActive && testStarted && !isPlayerTurn && gameState === 'playing') {
      const timer = setTimeout(() => {
        makeAIMove()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isPlayerTurn, gameState, isActive, testStarted])
  
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
      // Easy: Random moves with occasional good moves
      if (Math.random() < 0.3) {
        move = getBestMove(currentBoard, 'O') || emptySquares[Math.floor(Math.random() * emptySquares.length)]
      } else {
        move = emptySquares[Math.floor(Math.random() * emptySquares.length)]
      }
    } else if (difficulty === 2) {
      // Medium: Mix of good moves and random
      if (Math.random() < 0.7) {
        move = getBestMove(currentBoard, 'O') || emptySquares[Math.floor(Math.random() * emptySquares.length)]
      } else {
        move = emptySquares[Math.floor(Math.random() * emptySquares.length)]
      }
    } else {
      // Hard: Always try to make the best move
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
    
    // Check if AI can win
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [boardState[a], boardState[b], boardState[c]]
      if (values.filter(v => v === player).length === 2 && values.includes(null)) {
        return combo[values.indexOf(null)]
      }
    }
    
    // Check if AI needs to block player
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [boardState[a], boardState[b], boardState[c]]
      if (values.filter(v => v === opponent).length === 2 && values.includes(null)) {
        return combo[values.indexOf(null)]
      }
    }
    
    // Take center if available
    if (boardState[4] === null) return 4
    
    // Take corners
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
    setGamesPlayed(prev => prev + 1)
    
    if (winner === 'X') {
      setScore(prev => prev + 1)
      setGameState('won')
      // Increase difficulty after wins
      if (difficulty < 3 && score > 0 && score % 2 === 1) {
        setDifficulty(prev => prev + 1)
      }
    } else if (winner === 'O') {
      setGameState('lost')
    } else {
      setGameState('draw')
      setScore(prev => prev + 0.5) // Half point for draws
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
              square === 'X' ? 'text-blue-400' : square === 'O' ? 'text-red-400' : 'text-white/50'
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

const assessmentStages = [
  {
    id: 'processing-speed',
    title: 'Processing Speed',
    subtitle: 'Quick symbol detection to measure your mental processing speed',
    component: ProcessingSpeedTest,
    duration: 30,
    color: 'from-blue-500 to-cyan-500',
    cognitive_domain: 'Processing Speed'
  },
  {
    id: 'working-memory',
    title: 'Working Memory',
    subtitle: 'Number sequence recall to assess your working memory capacity',
    component: WorkingMemoryTest,
    duration: 30,
    color: 'from-purple-500 to-pink-500',
    cognitive_domain: 'Working Memory'
  },
  {
    id: 'attention',
    title: 'Visual Attention',
    subtitle: 'Spatial attention and visual memory assessment',
    component: AttentionTest,
    duration: 30,
    color: 'from-green-500 to-teal-500',
    cognitive_domain: 'Attention'
  },
  {
    id: 'problem-solving',
    title: 'Problem Solving',
    subtitle: 'Strategic thinking through Tic-Tac-Toe gameplay',
    component: ProblemSolvingTest,
    duration: 30,
    color: 'from-orange-500 to-red-500',
    cognitive_domain: 'Problem Solving'
  }
]

export default function CognitiveAssessmentFlow({ onComplete }) {
  const [currentStage, setCurrentStage] = useState(0)
  const [timeLeft, setTimeLeft] = useState(assessmentStages[0].duration)
  const [isActive, setIsActive] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [isStarted, setIsStarted] = useState(false)
  const [results, setResults] = useState([])
  const [sessionData, setSessionData] = useState({})
  const [userId, setUserId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  
  const timerRef = useRef(null)
  const sessionStartTime = useRef(Date.now())
  const totalDuration = assessmentStages.reduce((sum, stage) => sum + stage.duration, 0)
  const elapsedTime = assessmentStages.slice(0, currentStage).reduce((sum, stage) => sum + stage.duration, 0) + 
    (assessmentStages[currentStage]?.duration - timeLeft)

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null)
    })
    return () => unsubscribe()
  }, [])

  // Import Firebase modules
  useEffect(() => {
    // This would normally be imported at the top, but for this example we'll reference them
    if (typeof window !== 'undefined') {
      // Firebase modules would be available here
    }
  }, [])

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    } else if (timeLeft === 0 && isActive) {
      handleStageComplete()
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeLeft, isActive])

  // Handle test data updates from individual test components
  const handleTestDataUpdate = (testData) => {
    setSessionData(prev => ({
      ...prev,
      [assessmentStages[currentStage].id]: testData
    }))
  }

  // Save session data to Firebase/localStorage
  const saveSessionData = async (completeSessionData) => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('cognitiveAssessmentSessions') || '[]')
      const updatedSessions = [...savedSessions, completeSessionData].slice(-10)
      localStorage.setItem('cognitiveAssessmentSessions', JSON.stringify(updatedSessions))
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      // This would use your Firebase setup - using placeholder structure from your examples
      const userDocRef = doc(db, 'users', userId)
      
      // Save to user's main document
      await setDoc(userDocRef, {
        cognitiveAssessment: {
          lastCompleted: new Date().toISOString(),
          totalAssessments: 1, // Would increment existing value
          bestScores: extractBestScores(completeSessionData),
          lastSession: completeSessionData.sessionOverview
        }
      }, { merge: true })

      // Save detailed session data
      await addDoc(collection(db, 'users', userId, 'cognitiveAssessmentSessions'), {
        ...completeSessionData,
        createdAt: new Date()
      })

      console.log('Cognitive assessment session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data. Your progress may not be synced.')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('cognitiveAssessmentSessions') || '[]')
      const updatedSessions = [...savedSessions, completeSessionData].slice(-10)
      localStorage.setItem('cognitiveAssessmentSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const extractBestScores = (sessionData) => {
    return {
      processingSpeed: sessionData.processingSpeed?.score || 0,
      workingMemory: sessionData.workingMemory?.maxLevel || 0,
      attention: sessionData.attention?.accuracy || 0,
      problemSolving: sessionData.problemSolving?.winRate || 0
    }
  }

  const calculateCognitiveProfile = () => {
    const profile = {}
    
    // Processing Speed metrics
    if (sessionData.processingSpeed) {
      const ps = sessionData.processingSpeed
      profile.processingSpeed = {
        score: ps.score,
        accuracy: ps.accuracy,
        avgReactionTime: ps.averageReactionTime,
        percentile: calculatePercentile('processingSpeed', ps.score)
      }
    }

    // Working Memory metrics
    if (sessionData.workingMemory) {
      const wm = sessionData.workingMemory
      profile.workingMemory = {
        maxLevel: wm.maxLevel,
        accuracy: wm.accuracy,
        capacity: wm.maxLevel,
        percentile: calculatePercentile('workingMemory', wm.maxLevel)
      }
    }

    // Attention metrics
    if (sessionData.attention) {
      const att = sessionData.attention
      profile.attention = {
        accuracy: att.accuracy,
        maxRound: att.maxRound,
        sustainability: att.totalRounds,
        percentile: calculatePercentile('attention', att.accuracy)
      }
    }

    // Problem Solving metrics
    if (sessionData.problemSolving) {
      const ps = sessionData.problemSolving
      profile.problemSolving = {
        winRate: ps.winRate,
        finalDifficulty: ps.finalDifficulty,
        adaptability: ps.finalDifficulty,
        percentile: calculatePercentile('problemSolving', ps.winRate)
      }
    }

    return profile
  }

  const calculatePercentile = (domain, score) => {
    // Simplified percentile calculation - in reality this would use normative data
    const norms = {
      processingSpeed: { mean: 15, sd: 5 },
      workingMemory: { mean: 5, sd: 1.5 },
      attention: { mean: 75, sd: 15 },
      problemSolving: { mean: 50, sd: 20 }
    }
    
    const norm = norms[domain]
    if (!norm) return 50
    
    const zScore = (score - norm.mean) / norm.sd
    return Math.max(1, Math.min(99, Math.round(50 + (zScore * 15))))
  }

  const handleStageComplete = () => {
    setIsActive(false)
    
    const stageResults = {
      stage: assessmentStages[currentStage].id,
      domain: assessmentStages[currentStage].cognitive_domain,
      completed: true,
      timeSpent: assessmentStages[currentStage].duration - timeLeft,
      data: sessionData[assessmentStages[currentStage].id] || {}
    }
    
    setResults(prev => [...prev, stageResults])
    
    if (currentStage < assessmentStages.length - 1) {
      setShowTransition(true)
      
      setTimeout(() => {
        setCurrentStage(prev => prev + 1)
        setTimeLeft(assessmentStages[currentStage + 1].duration)
        setShowTransition(false)
        setIsActive(false)
      }, 3000)
    } else {
      // Assessment complete - compile and save all data
      setTimeout(async () => {
        const completeSessionData = {
          sessionOverview: {
            sessionStart: sessionStartTime.current,
            sessionEnd: Date.now(),
            totalDuration: Date.now() - sessionStartTime.current,
            assessmentType: 'cognitive_baseline',
            stagesCompleted: assessmentStages.length
          },
          cognitiveProfile: calculateCognitiveProfile(),
          detailedResults: sessionData,
          rawResults: results,
          metadata: {
            version: '1.0',
            deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
            timestamp: new Date().toISOString()
          }
        }
        
        await saveSessionData(completeSessionData)
        
        if (onComplete) {
          onComplete(completeSessionData)
        }
      }, 2000)
    }
  }

  const startAssessment = () => {
    setIsStarted(true)
    sessionStartTime.current = Date.now()
  }

  const startStageTimer = () => {
    setIsActive(true)
  }

  const renderCurrentTest = () => {
    const stage = assessmentStages[currentStage]
    const TestComponent = stage.component
    
    return (
      <TestComponent
        onComplete={handleStageComplete}
        timeLeft={timeLeft}
        isActive={isActive}
        startTimer={startStageTimer}
        onDataUpdate={handleTestDataUpdate}
      />
    )
  }

  if (!isStarted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl text-white">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Cognitive Assessment
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Let's establish your cognitive baseline across key mental abilities. This comprehensive assessment takes about {Math.round(totalDuration / 60)} minutes.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {assessmentStages.map((stage, index) => (
              <div key={stage.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{stage.title}</h3>
                  <span className="text-sm opacity-75">{Math.round(stage.duration / 60)}min</span>
                </div>
                <p className="text-sm opacity-75">{stage.cognitive_domain}</p>
              </div>
            ))}
          </div>

          <div className="mb-8 p-6 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
            <h2 className="text-lg font-semibold mb-3">What to Expect:</h2>
            <ul className="text-left space-y-2 text-sm opacity-90">
              <li>• Four different cognitive tests measuring distinct mental abilities</li>
              <li>• Each test begins with clear instructions and examples</li>
              <li>• Each test adapts to your performance level automatically</li>
              <li>• Take your time - accuracy is more important than speed</li>
              <li>• Results establish your personalized training baseline</li>
              <li>• No preparation needed - just do your best</li>
            </ul>
          </div>
          
          <button
            onClick={startAssessment}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white text-xl font-semibold shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
          >
            Begin Assessment
          </button>
        </div>
      </main>
    )
  }

  if (showTransition) {
    const nextStage = assessmentStages[currentStage + 1]
    return (
      <main className={`min-h-screen bg-gradient-to-br ${nextStage.color} flex items-center justify-center p-6 text-white`}>
        <div className="text-center">
          <div className="text-6xl mb-4">✨</div>
          <h2 className="text-4xl font-bold mb-4">Great Work!</h2>
          <h3 className="text-2xl font-semibold mb-2">Next: {nextStage.title}</h3>
          <p className="text-lg opacity-90 mb-6">{nextStage.subtitle}</p>
          
          <div className="text-sm opacity-75">
            <div>Progress: {currentStage + 1} of {assessmentStages.length} tests complete</div>
            <div className="mt-2">Estimated time remaining: {Math.round((totalDuration - elapsedTime) / 60)} minutes</div>
          </div>
          
          <div className="mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      </main>
    )
  }

  if (currentStage >= assessmentStages.length) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 flex items-center justify-center p-6">
        <div className="text-center text-white">
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-teal-400 bg-clip-text text-transparent">
            Assessment Complete!
          </h1>
          <p className="text-xl mb-8 opacity-90">
            Excellent work! Your cognitive baseline has been established across all four key domains.
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto text-sm">
            <div className="bg-white/10 rounded-lg p-3 border border-white/20">
              <div className="font-bold">⚡ Processing Speed</div>
              <div className="text-green-400">Measured</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 border border-white/20">
              <div className="font-bold">🧠 Working Memory</div>
              <div className="text-green-400">Measured</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 border border-white/20">
              <div className="font-bold">👁️ Attention</div>
              <div className="text-green-400">Measured</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 border border-white/20">
              <div className="font-bold">🧩 Problem Solving</div>
              <div className="text-green-400">Measured</div>
            </div>
          </div>
          
          <div className="text-sm opacity-75 mb-6">
            Your personalized training program is now being prepared based on these results.
          </div>
          
          <button
            onClick={() => onComplete && onComplete(results)}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-500 rounded-full text-white text-xl font-semibold shadow-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200 transform hover:scale-105"
          >
            View Results
          </button>
        </div>
      </main>
    )
  }

  const stage = assessmentStages[currentStage]
  const progress = (elapsedTime / totalDuration) * 100

  return (
    <main className={`min-h-screen bg-gradient-to-br ${stage.color} text-white`}>
      <div className="p-4 border-b border-white/20">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">{stage.title}</h1>
              <p className="text-sm opacity-90">{stage.subtitle}</p>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-75">Time Remaining</div>
              <div className="text-xl font-mono">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
          
          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-white/60 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs opacity-75">
            <span>Test {currentStage + 1} of {assessmentStages.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        {renderCurrentTest()}
      </div>
    </main>
  )
}
