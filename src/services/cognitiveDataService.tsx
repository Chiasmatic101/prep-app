'use client'

import React, { useState, useEffect, useRef } from 'react'

// Type definitions
interface GameComponentProps {
  onComplete: () => void;
  timeLeft: number;
  isActive: boolean;
  startTimer: () => void;
  onDataUpdate: (data: any) => void;
}

interface CognitiveDataServiceProps {
  onComplete?: (data: any) => void;
}

interface AssessmentStage {
  id: string;
  title: string;
  subtitle: string;
  component: React.ComponentType<GameComponentProps>;
  duration: number;
  cognitive_domain: string;
  color: string;
}

// Mock game components for the assessment
const ProcessingSpeedTest = ({ 
  onComplete, 
  timeLeft, 
  isActive, 
  startTimer, 
  onDataUpdate 
}: GameComponentProps) => {
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
        const reactionTime = Date.now() - symbolStartTime
        setReactionTimes(prev => [...prev, reactionTime])
      }
      setCurrentSymbol('')
      setTimeout(showNextSymbol, 200)
    }, 800)
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
}: GameComponentProps) => {
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [currentNumber, setCurrentNumber] = useState<number | null>(null)
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
        finalLevel: level,
        score,
        totalAttempts: attempts,
        averageReactionTime: reactionTimes.length > 0 ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length : 0,
        accuracy: attempts > 0 ? (score / attempts) * 100 : 0,
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
    const newSeq = Array.from({ length: level }, () => Math.floor(Math.random() * 9) + 1)
    setSequence(newSeq)
    setUserInput([])
    setPhase('showing')
    setSequenceStartTime(Date.now())
    showSequence(newSeq)
  }
  
  const showSequence = async (seq: number[]) => {
    for (let i = 0; i < seq.length; i++) {
      setCurrentNumber(seq[i])
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCurrentNumber(null)
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    setPhase('recall')
  }
  
  const handleNumberClick = (num: number) => {
    if (phase !== 'recall') return
    
    const newInput = [...userInput, num]
    setUserInput(newInput)
    
    if (newInput.length === sequence.length) {
      const recallTime = Date.now() - sequenceStartTime
      setReactionTimes(prev => [...prev, recallTime])
      setAttempts(prev => prev + 1)
      
      const correct = newInput.every((n, i) => n === sequence[i])
      
      if (correct) {
        setScore(prev => prev + 1)
        setLevel(prev => prev + 1)
        setPhase('correct')
      } else {
        setLevel(prev => Math.max(3, prev - 1))
        setPhase('incorrect')
      }
      
      setTimeout(() => {
        if (timeLeft > 0) {
          startNewSequence()
        }
      }, 1500)
    }
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6">Working Memory Test</h3>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 text-left">
          <h4 className="text-xl font-semibold mb-4">Instructions:</h4>
          <ul className="space-y-3 text-lg">
            <li>• Watch a sequence of numbers flash on screen</li>
            <li>• After the sequence, reproduce it from memory</li>
            <li>• Sequences get longer as you progress</li>
            <li>• Focus and try to remember the exact order</li>
          </ul>
        </div>
        
        <button
          onClick={handleStartTest}
          className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xl"
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
        <p className="text-sm opacity-75">Level: {level} | Score: {score}</p>
      </div>
      
      {phase === 'showing' && (
        <div className="mb-8">
          <p className="text-lg mb-4">Watch carefully...</p>
          <div className="text-9xl font-bold h-32 flex items-center justify-center">
            {currentNumber}
          </div>
        </div>
      )}
      
      {phase === 'recall' && (
        <div>
          <p className="text-lg mb-4">Enter the sequence ({userInput.length}/{sequence.length})</p>
          <div className="text-4xl font-bold mb-8 h-16 flex items-center justify-center">
            {userInput.join(' ')}
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                className="aspect-square text-2xl font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {phase === 'correct' && (
        <div className="text-4xl font-bold text-green-400">✓ Correct!</div>
      )}
      
      {phase === 'incorrect' && (
        <div className="text-4xl font-bold text-red-400">✗ Try Again</div>
      )}
    </div>
  )
}

const AttentionTest = ({ 
  onComplete, 
  timeLeft, 
  isActive, 
  startTimer, 
  onDataUpdate 
}: GameComponentProps) => {
  const [gridSize] = useState(5)
  const [level, setLevel] = useState(3)
  const [targetPositions, setTargetPositions] = useState<Set<number>>(new Set())
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set())
  const [phase, setPhase] = useState('showing')
  const [score, setScore] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [accuracyScores, setAccuracyScores] = useState<number[]>([])
  
  useEffect(() => {
    if (isActive && testStarted && targetPositions.size === 0) {
      startNewRound()
    }
  }, [isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      const testData = {
        testType: 'attention',
        finalLevel: level,
        score,
        totalAttempts: attempts,
        averageAccuracy: accuracyScores.length > 0 ? accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length : 0,
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
  
  const startNewRound = () => {
    const positions = new Set<number>()
    while (positions.size < level) {
      positions.add(Math.floor(Math.random() * (gridSize * gridSize)))
    }
    setTargetPositions(positions)
    setSelectedPositions(new Set())
    setPhase('showing')
    
    setTimeout(() => {
      setPhase('recall')
    }, 2000)
  }
  
  const handleCellClick = (index: number) => {
    if (phase !== 'recall') return
    
    const newSelected = new Set(selectedPositions)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedPositions(newSelected)
  }
  
  const handleSubmit = () => {
    setAttempts(prev => prev + 1)
    
    let correct = 0
    targetPositions.forEach(pos => {
      if (selectedPositions.has(pos)) correct++
    })
    
    const accuracy = correct / targetPositions.size
    setAccuracyScores(prev => [...prev, accuracy])
    
    if (accuracy >= 0.7) {
      setScore(prev => prev + 1)
      setLevel(prev => prev + 1)
      setPhase('correct')
    } else {
      setLevel(prev => Math.max(3, prev - 1))
      setPhase('incorrect')
    }
    
    setTimeout(() => {
      if (timeLeft > 0) {
        startNewRound()
      }
    }, 1500)
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6">Attention Test</h3>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 text-left">
          <h4 className="text-xl font-semibold mb-4">Instructions:</h4>
          <ul className="space-y-3 text-lg">
            <li>• A grid will appear with highlighted squares</li>
            <li>• Remember which squares are highlighted</li>
            <li>• After they disappear, click the squares you remember</li>
            <li>• More squares will be added as you progress</li>
          </ul>
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
        <h3 className="text-2xl font-bold mb-2">Attention Test</h3>
        <p className="text-sm opacity-75">
          {phase === 'showing' && 'Remember the highlighted squares'}
          {phase === 'recall' && `Select ${level} squares`}
          {phase === 'correct' && '✓ Correct!'}
          {phase === 'incorrect' && '✗ Try Again'}
        </p>
      </div>
      
      <div 
        className="grid gap-2 max-w-md mx-auto mb-6"
        style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, index) => {
          const isTarget = targetPositions.has(index)
          const isSelected = selectedPositions.has(index)
          const showTarget = phase === 'showing' || phase === 'correct' || phase === 'incorrect'
          
          return (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              disabled={phase !== 'recall'}
              className={`aspect-square rounded-lg border-2 transition-colors ${
                showTarget && isTarget
                  ? 'bg-green-500 border-green-600'
                  : isSelected
                  ? 'bg-blue-500 border-blue-600'
                  : 'bg-white/20 border-white/30 hover:bg-white/30'
              }`}
            />
          )
        })}
      </div>
      
      {phase === 'recall' && (
        <button
          onClick={handleSubmit}
          className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold"
        >
          Submit ({selectedPositions.size}/{level})
        </button>
      )}
      
      <div className="mt-6 text-sm">
        Level: {level} | Score: {score}
      </div>
    </div>
  )
}

const ProblemSolvingTest = ({ 
  onComplete, 
  timeLeft, 
  isActive, 
  startTimer, 
  onDataUpdate 
}: GameComponentProps) => {
  const [currentPuzzle, setCurrentPuzzle] = useState(0)
  const [score, setScore] = useState(0)
  const [showInstructions, setShowInstructions] = useState(true)
  const [testStarted, setTestStarted] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [solveTimes, setSolveTimes] = useState<number[]>([])
  const [puzzleStartTime, setPuzzleStartTime] = useState(Date.now())
  
  const puzzles = [
    {
      question: "If 2 + 2 = 4, and 3 + 3 = 6, what does 4 + 4 equal?",
      options: [6, 7, 8, 9],
      correct: 2
    },
    {
      question: "Complete the pattern: 2, 4, 6, 8, __",
      options: [9, 10, 11, 12],
      correct: 1
    },
    {
      question: "If A = 1, B = 2, C = 3, what does D equal?",
      options: [3, 4, 5, 6],
      correct: 1
    },
    {
      question: "Which shape comes next: ○, □, ○, □, __",
      options: ['○', '□', '△', '◇'],
      correct: 0
    },
    {
      question: "What number comes next: 1, 1, 2, 3, 5, __",
      options: [6, 7, 8, 9],
      correct: 2
    }
  ]
  
  useEffect(() => {
    if (isActive && testStarted) {
      setPuzzleStartTime(Date.now())
    }
  }, [currentPuzzle, isActive, testStarted])

  useEffect(() => {
    if (timeLeft === 0 && testStarted) {
      const testData = {
        testType: 'problemSolving',
        totalPuzzles: puzzles.length,
        score,
        attempts,
        accuracy: attempts > 0 ? (score / attempts) * 100 : 0,
        averageSolveTime: solveTimes.length > 0 ? solveTimes.reduce((a, b) => a + b, 0) / solveTimes.length : 0,
        completed: true
      }
      onDataUpdate(testData)
    }
  }, [timeLeft, testStarted])
  
  const handleStartTest = () => {
    setShowInstructions(false)
    setTestStarted(true)
    setPuzzleStartTime(Date.now())
    if (startTimer) startTimer()
  }
  
  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex)
    const solveTime = Date.now() - puzzleStartTime
    setSolveTimes(prev => [...prev, solveTime])
    setAttempts(prev => prev + 1)
    
    if (answerIndex === puzzles[currentPuzzle].correct) {
      setScore(prev => prev + 1)
    }
    
    setTimeout(() => {
      setSelectedAnswer(null)
      if (currentPuzzle < puzzles.length - 1) {
        setCurrentPuzzle(prev => prev + 1)
        setPuzzleStartTime(Date.now())
      } else {
        setCurrentPuzzle(0)
        setPuzzleStartTime(Date.now())
      }
    }, 1500)
  }

  if (showInstructions) {
    return (
      <div className="text-center max-w-2xl mx-auto">
        <h3 className="text-3xl font-bold mb-6">Problem Solving Test</h3>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8 text-left">
          <h4 className="text-xl font-semibold mb-4">Instructions:</h4>
          <ul className="space-y-3 text-lg">
            <li>• Solve logic puzzles and pattern recognition problems</li>
            <li>• Read each question carefully</li>
            <li>• Click your answer choice</li>
            <li>• Work as quickly and accurately as you can</li>
          </ul>
        </div>
        
        <button
          onClick={handleStartTest}
          className="px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-semibold text-xl"
        >
          Start Test
        </button>
      </div>
    )
  }
  
  const puzzle = puzzles[currentPuzzle]
  
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2">Problem Solving Test</h3>
        <p className="text-sm opacity-75">Question {currentPuzzle + 1} of {puzzles.length} | Score: {score}</p>
      </div>
      
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 mb-8">
        <p className="text-2xl font-semibold mb-8">{puzzle.question}</p>
        
        <div className="grid grid-cols-2 gap-4">
          {puzzle.options.map((option, index) => {
            const isSelected = selectedAnswer === index
            const isCorrect = index === puzzle.correct
            const showResult = selectedAnswer !== null
            
            return (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={selectedAnswer !== null}
                className={`p-6 text-xl font-semibold rounded-lg border-2 transition-all ${
                  showResult
                    ? isCorrect
                      ? 'bg-green-500 border-green-600 text-white'
                      : isSelected
                      ? 'bg-red-500 border-red-600 text-white'
                      : 'bg-white/10 border-white/20'
                    : 'bg-white/10 border-white/20 hover:bg-white/20'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Main Cognitive Data Service Component
export const CognitiveDataService: React.FC<CognitiveDataServiceProps> = ({ onComplete }) => {
  const [currentStage, setCurrentStage] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [isStarted, setIsStarted] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  
  const sessionStartTime = useRef(Date.now())
  const sessionData = useRef<any[]>([])
  
  const assessmentStages: AssessmentStage[] = [
    {
      id: 'processing',
      title: 'Processing Speed',
      subtitle: 'How quickly you process information',
      component: ProcessingSpeedTest,
      duration: 60,
      cognitive_domain: 'Processing Speed',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'memory',
      title: 'Working Memory',
      subtitle: 'Your ability to hold and manipulate information',
      component: WorkingMemoryTest,
      duration: 90,
      cognitive_domain: 'Working Memory',
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'attention',
      title: 'Attention',
      subtitle: 'Your focus and concentration ability',
      component: AttentionTest,
      duration: 90,
      cognitive_domain: 'Attention',
      color: 'from-green-500 to-emerald-500'
    },
    {
      id: 'problem',
      title: 'Problem Solving',
      subtitle: 'Your logical reasoning and pattern recognition',
      component: ProblemSolvingTest,
      duration: 90,
      cognitive_domain: 'Problem Solving',
      color: 'from-orange-500 to-red-500'
    }
  ]
  
  const totalDuration = assessmentStages.reduce((sum, stage) => sum + stage.duration, 0)
  
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1)
        setElapsedTime(prev => prev + 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (timeLeft === 0 && isActive) {
      handleStageComplete()
    }
  }, [timeLeft, isActive])
  
  const calculateCognitiveProfile = () => {
    return {
      processingSpeed: results[0]?.score || 0,
      workingMemory: results[1]?.score || 0,
      attention: results[2]?.score || 0,
      problemSolving: results[3]?.score || 0
    }
  }
  
  const saveSessionData = async (data: any) => {
    console.log('Saving session data:', data)
  }
  
  const handleStageComplete = () => {
    setIsActive(false)
    
    if (currentStage < assessmentStages.length - 1) {
      setShowTransition(true)
      
      setTimeout(() => {
        setCurrentStage(prev => prev + 1)
        setShowTransition(false)
      }, 3000)
    } else {
      setTimeout(async () => {
        const completeSessionData = {
          sessionInfo: {
            sessionStart: sessionStartTime.current,
            sessionEnd: Date.now(),
            totalDuration: Date.now() - sessionStartTime.current,
            assessmentType: 'cognitive_baseline',
            stagesCompleted: assessmentStages.length
          },
          cognitiveProfile: calculateCognitiveProfile(),
          detailedResults: sessionData.current,
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
    setTimeLeft(assessmentStages[currentStage].duration)
    setIsActive(true)
  }

  const handleTestDataUpdate = (data: any) => {
    sessionData.current.push(data)
    setResults(prev => [...prev, data])
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
