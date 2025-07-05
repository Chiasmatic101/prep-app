'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Level {
  name: string;
  tests: number;
  description: string;
}

const LEVELS: Level[] = [
  { name: 'Basic Reaction', tests: 5, description: 'Tap when you see the green light' },
  { name: 'Processing Speed', tests: 4, description: 'Tap the correct shape when it appears' },
  { name: 'Inhibition Control', tests: 8, description: 'Only tap green lights, ignore blue distractors' }
]

const SHAPES: string[] = ['circle', 'square', 'triangle']

type GameState = 'introStart' | 'intro' | 'target_display' | 'waiting' | 'ready' | 'react' | 'result' | 'complete'

export default function ReactionTimeGame() {
  const router = useRouter()
  const [gameState, setGameState] = useState<GameState>('introStart')
  const [level, setLevel] = useState<number>(1)
  const [currentTest, setCurrentTest] = useState<number>(0)
  const [redLights, setRedLights] = useState<boolean[]>([false, false, false, false, false])
  const [showGreen, setShowGreen] = useState<boolean>(false)
  const [showBlueDistractor, setShowBlueDistractor] = useState<boolean>(false)
  const [currentShapes, setCurrentShapes] = useState<string[]>([])
  const [targetShape, setTargetShape] = useState<string>('circle')
  const [reactionTime, setReactionTime] = useState<number>(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [errors, setErrors] = useState<number>(0)
  const [message, setMessage] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const timeouts = useRef<NodeJS.Timeout[]>([])

  const clearAllTimeouts = useCallback((): void => {
    timeouts.current.forEach(t => clearTimeout(t))
    timeouts.current = []
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimeouts()
  }, [clearAllTimeouts])

  useEffect(() => {
    if (gameState === 'intro' && !isProcessing) {
      showLevelIntro()
    }
  }, [gameState, level])

  const showLevelIntro = (): void => {
    if (isProcessing) return
    setIsProcessing(true)
    clearAllTimeouts()
    setGameState('intro')
    setMessage(`Level ${level}: ${LEVELS[level - 1].name}`)
    
    timeouts.current.push(setTimeout(() => {
      setMessage(LEVELS[level - 1].description)
      timeouts.current.push(setTimeout(() => {
        if (level === 2) {
          showTargetShape()
        } else {
          setMessage('Get ready...')
          timeouts.current.push(setTimeout(() => {
            startTest()
          }, 1000))
        }
      }, 2000))
    }, 2000))
  }

  const showTargetShape = (): void => {
    clearAllTimeouts()
    const newTarget = SHAPES[Math.floor(Math.random() * SHAPES.length)]
    setTargetShape(newTarget)
    setGameState('target_display')
    setMessage(`Remember this shape: ${newTarget.toUpperCase()}`)
    
    timeouts.current.push(setTimeout(() => {
      setMessage('Get ready to find it...')
      timeouts.current.push(setTimeout(() => {
        startTest()
      }, 1500))
    }, 3000))
  }

  const startTest = (): void => {
    clearAllTimeouts()
    setGameState('waiting')
    setMessage('Get ready...')
    setShowGreen(false)
    setShowBlueDistractor(false)
    setReactionTime(0)
    setRedLights([false, false, false, false, false])
    setIsProcessing(false)

    if (level === 2) {
      // Ensure target shape is included and shuffle properly
      const shapeOptions = [targetShape]
      const nonTargets = SHAPES.filter(s => s !== targetShape)
      
      // Add random non-target shapes
      while (shapeOptions.length < 3) {
        const randomShape = nonTargets[Math.floor(Math.random() * nonTargets.length)]
        if (!shapeOptions.includes(randomShape)) {
          shapeOptions.push(randomShape)
        }
      }
      
      // Fisher-Yates shuffle
      for (let i = shapeOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shapeOptions[i], shapeOptions[j]] = [shapeOptions[j], shapeOptions[i]]
      }
      setCurrentShapes(shapeOptions)
    }

    activateRedLights()
  }

  const activateRedLights = (): void => {
    const delays = [0, 800, 1600, 2400, 3200]
    delays.forEach((delay, index) => {
      timeouts.current.push(setTimeout(() => {
        setRedLights(prev => {
          const newLights = [...prev]
          newLights[index] = true
          return newLights
        })
        if (index === 4) {
          timeouts.current.push(setTimeout(() => {
            prepareGreenLight()
          }, 800))
        }
      }, delay))
    })
  }

  const prepareGreenLight = (): void => {
    setRedLights([false, false, false, false, false])
    const delay = 1000 + Math.random() * 3000
    timeouts.current.push(setTimeout(() => {
      if (level === 3 && Math.random() < 0.4) {
        showDistractor()
      } else {
        showGreenLight()
      }
    }, delay))
  }

  const showDistractor = (): void => {
    setShowBlueDistractor(true)
    setMessage('Ignore the blue!')
    timeouts.current.push(setTimeout(() => {
      setShowBlueDistractor(false)
      timeouts.current.push(setTimeout(() => {
        showGreenLight()
      }, 500 + Math.random() * 1000))
    }, 800))
  }

  const showGreenLight = (): void => {
    setGameState('react')
    setShowGreen(true)
    setStartTime(Date.now())
    setMessage(level === 2 ? `Find the ${targetShape.toUpperCase()}!` : 'TAP NOW!')
  }

  const handleTap = (tappedShape?: string): void => {
    if (isProcessing) return
    
    const now = Date.now()
    if (gameState === 'intro' || gameState === 'target_display') return

    if (gameState === 'waiting') {
      setMessage('FALSE START! Wait for green light')
      setErrors(prev => prev + 1)
      setGameState('result')
      setIsProcessing(true)
      
      timeouts.current.push(setTimeout(() => {
        if (errors + 1 >= 3) {
          navigateToNext()
        } else {
          clearAllTimeouts()
          if (level === 2) {
            showTargetShape()
          } else {
            startTest()
          }
        }
      }, 2000))
      return
    }

    if (showBlueDistractor) {
      setMessage('INHIBITION FAILURE! Ignore blue lights')
      setErrors(prev => prev + 1)
      setShowBlueDistractor(false)
      setGameState('result')
      setIsProcessing(true)
      
      timeouts.current.push(setTimeout(() => {
        if (errors + 1 >= 3) {
          navigateToNext()
        } else {
          clearAllTimeouts()
          startTest()
        }
      }, 2000))
      return
    }

    if (showGreen && gameState === 'react') {
      const reactionMs = now - startTime
      
      if (level === 2 && (!tappedShape || tappedShape !== targetShape)) {
        setMessage(`WRONG! Target was ${targetShape.toUpperCase()}`)
        setErrors(prev => prev + 1)
        setShowGreen(false)
        setGameState('result')
        setIsProcessing(true)
        
        timeouts.current.push(setTimeout(() => {
          if (errors + 1 >= 3) {
            navigateToNext()
          } else {
            clearAllTimeouts()
            showTargetShape()
          }
        }, 2000))
        return
      }

      setReactionTime(reactionMs)
      setReactionTimes(prev => [...prev, reactionMs])
      setGameState('result')
      setShowGreen(false)
      setMessage(`${reactionMs}ms - ${getRankMessage(reactionMs)}`)
      setIsProcessing(true)

      timeouts.current.push(setTimeout(() => {
        const nextTest = currentTest + 1
        if (nextTest >= LEVELS[level - 1].tests) {
          if (level >= LEVELS.length) {
            setGameState('complete')
            setMessage('All levels complete! Moving to next page...')
            timeouts.current.push(setTimeout(() => navigateToNext(), 2000))
          } else {
            setLevel(prev => prev + 1)
            setCurrentTest(0)
            setReactionTimes([])
            setErrors(0)
            setGameState('intro')
            setIsProcessing(false)
          }
        } else {
          setCurrentTest(nextTest)
          clearAllTimeouts()
          if (level === 2) {
            showTargetShape()
          } else {
            startTest()
          }
        }
      }, 2000))
    }
  }

  const getRankMessage = (time: number): string => {
    if (time < 200) return 'INCREDIBLE!'
    if (time < 250) return 'AMAZING!'
    if (time < 300) return 'EXCELLENT!'
    if (time < 350) return 'VERY GOOD!'
    if (time < 400) return 'GOOD!'
    if (time < 500) return 'Average'
    return 'Keep practicing!'
  }

  const navigateToNext = (): void => {
    clearAllTimeouts()
    router.push('/info_pages/ageandgender')
  }

  const renderShape = (shape: string, size: string = 'w-16 h-16'): React.ReactElement | null => {
    const baseClasses = `${size} border-2 border-white mx-2 cursor-pointer hover:bg-white hover:bg-opacity-20 transition-colors`
    
    switch (shape) {
      case 'circle':
        return (
          <div 
            className={`${baseClasses} rounded-full`}
            onClick={() => handleTap(shape)}
          />
        )
      case 'square':
        return (
          <div 
            className={`${baseClasses} rounded-none`}
            onClick={() => handleTap(shape)}
          />
        )
      case 'triangle':
        return (
          <div 
            className={`${baseClasses} rounded-none`}
            style={{
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
              border: 'none',
              backgroundColor: 'transparent',
              borderTop: '32px solid white',
              borderLeft: '32px solid transparent',
              borderRight: '32px solid transparent',
              width: '0',
              height: '0'
            }}
            onClick={() => handleTap(shape)}
          />
        )
      default:
        return null
    }
  }

  const currentLevelData: Level | undefined = LEVELS[level - 1]
  const progress: number = currentLevelData ? (currentTest / currentLevelData.tests) * 100 : 0

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6">
      {gameState === 'introStart' ? (
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-6 text-green-400">Reaction Time Test</h1>
          <p className="mb-8 text-gray-300 text-lg leading-relaxed">
            We are now going to test your <span className="text-blue-400 font-semibold">reaction time</span>, <span className="text-blue-400 font-semibold">processing speed</span>, and <span className="text-blue-400 font-semibold">inhibition control</span>.
          </p>
          <div className="mb-8 text-left bg-gray-900 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4 text-green-400">Test Overview:</h3>
            {LEVELS.map((lvl, idx) => (
              <div key={idx} className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{lvl.name}</span>
                  <span className="text-sm text-gray-400">{lvl.tests} tests</span>
                </div>
                <p className="text-sm text-gray-300">{lvl.description}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setGameState('intro')}
            className="px-8 py-4 bg-green-600 rounded-lg hover:bg-green-500 transition-all text-white text-xl font-semibold transform hover:scale-105"
          >
            Start Test
          </button>
        </div>
      ) : (
        <div className="text-center max-w-4xl w-full">
          <h1 className="text-3xl font-bold mb-4">Reaction Time Test</h1>
          
          {/* Progress indicators */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-8 text-lg mb-4">
              <span className="text-blue-400 font-semibold">Level: {level}/{LEVELS.length}</span>
              <span className="text-green-400 font-semibold">Test: {currentTest + 1}/{LEVELS[level - 1]?.tests || 1}</span>
              {errors > 0 && <span className="text-red-400 font-semibold">Errors: {errors}/3</span>}
            </div>
            
            {/* Progress bar */}
            <div className="w-full max-w-md mx-auto bg-gray-700 rounded-full h-2 mb-4">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="mb-8 text-gray-300 text-center text-lg min-h-[2rem]">{message}</p>

          {/* Game area */}
          <div className="min-h-[400px] flex flex-col items-center justify-center">
            {/* Red lights sequence */}
            {gameState === 'waiting' && (
              <div className="flex gap-4 mb-8">
                {redLights.map((isActive, index) => (
                  <div
                    key={index}
                    className={`w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                      isActive ? 'bg-red-500 border-red-500' : 'border-gray-600'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Main reaction area */}
            <div className="flex flex-col items-center justify-center">
              {/* Green light for basic reaction and inhibition */}
              {(level === 1 || level === 3) && showGreen && (
                <div
                  className="w-32 h-32 bg-green-500 rounded-full cursor-pointer hover:bg-green-400 transition-colors flex items-center justify-center text-2xl font-bold animate-pulse"
                  onClick={() => handleTap()}
                >
                  TAP!
                </div>
              )}

              {/* Blue distractor */}
              {showBlueDistractor && (
                <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center text-2xl font-bold animate-pulse">
                  DON'T TAP!
                </div>
              )}

              {/* Shape selection for processing speed */}
              {level === 2 && showGreen && currentShapes.length > 0 && (
                <div className="flex items-center justify-center gap-8">
                  {currentShapes.map((shape, index) => (
                    <div key={index} className="flex flex-col items-center">
                      {renderShape(shape, 'w-20 h-20')}
                      <span className="mt-2 text-sm capitalize">{shape}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Target shape display */}
              {gameState === 'target_display' && (
                <div className="flex flex-col items-center">
                  <div className="mb-4 text-2xl font-bold">Target Shape:</div>
                  {renderShape(targetShape, 'w-24 h-24')}
                  <div className="mt-4 text-lg capitalize font-semibold">{targetShape}</div>
                </div>
              )}
            </div>

            {/* Results display */}
            {gameState === 'result' && reactionTime > 0 && (
              <div className="text-center mt-8">
                <div className="text-3xl font-bold text-green-400 mb-2">{reactionTime}ms</div>
                <div className="text-xl">{getRankMessage(reactionTime)}</div>
                {reactionTimes.length > 1 && (
                  <div className="mt-4 text-sm text-gray-400">
                    Average: {Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)}ms
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 text-sm text-gray-400 max-w-md mx-auto">
            {level === 1 && "Wait for the green light, then tap it as quickly as possible!"}
            {level === 2 && "Remember the target shape, then find and tap it when the options appear!"}
            {level === 3 && "Tap green lights only - ignore any blue distractors!"}
          </div>
        </div>
      )}
    </main>
  )
}