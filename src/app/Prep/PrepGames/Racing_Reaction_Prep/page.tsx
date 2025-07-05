'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import React from 'react';

const LEVELS = [
  { name: 'Basic Reaction', tests: 5, description: 'Tap when you see the green light' },
  { name: 'Processing Speed', tests: 4, description: 'Tap the correct shape when it appears' },
  { name: 'Inhibition Control', tests: 8, description: 'Only tap green lights, ignore blue distractors' }
]

const SHAPES = ['circle', 'square', 'triangle'] as const

type GameState = 'introStart' | 'intro' | 'target_display' | 'waiting' | 'ready' | 'react' | 'result' | 'complete'
type ShapeType = typeof SHAPES[number]

interface CognitiveMetrics {
  sessionStart: number
  totalPlayTime: number
  reactionTimesByLevel: { [key: number]: number[] }
  errorsByLevel: { [key: number]: number }
  falseStartsByLevel: { [key: number]: number }
  inhibitionFailuresByLevel: { [key: number]: number }
  processingSpeedErrors: number
  averageReactionTimeByLevel: { [key: number]: number }
  bestReactionTimeByLevel: { [key: number]: number }
  consistencyScoreByLevel: { [key: number]: number }
  completedLevels: number
  totalTests: number
  overallAccuracy: number
}

interface UserStats {
  bestReactionTime: number
  totalSessionsPlayed: number
  totalTestsCompleted: number
  totalPlayTime: number
  averageReactionTime: number
  averageAccuracy: number
  levelsCompleted: number
  lastPlayed: string
  sessions: any[]
  cognitiveProfile: {
    basicReactionTime: number
    processingSpeed: number
    inhibitionControl: number
    cognitiveFlexibility: number
    attentionalControl: number
  }
}

interface SessionData {
  sessionOverview: {
    sessionStart: number
    sessionEnd: number
    totalSessionDuration: number
    gameType: string
    completionStatus: string
  }
  performance: {
    completedLevels: number
    totalTests: number
    totalErrors: number
    overallAccuracy: number
    averageReactionTime: number
    bestReactionTime: number
    reactionTimesByLevel: { [key: number]: number[] }
    averageReactionTimeByLevel: { [key: number]: number }
    bestReactionTimeByLevel: { [key: number]: number }
    consistencyScoreByLevel: { [key: number]: number }
  }
  cognitiveMetrics: {
    basicReactionTime: number
    processingSpeed: number
    inhibitionControl: number
    cognitiveFlexibility: number
    attentionalControl: number
    errorAnalysis: {
      falseStarts: { [key: number]: number }
      inhibitionFailures: { [key: number]: number }
      processingErrors: number
      totalErrorRate: number
    }
  }
  detailedLogs: {
    levelByLevelPerformance: Array<{
      level: number
      name: string
      averageRT: number
      bestRT: number
      testsCompleted: number
      errors: number
      accuracy: number
    }>
    reactionTimeProgression: Array<{
      level: number
      attempt: number
      reactionTime: number
      timestamp: number
    }>
    errorPattern: {
      falseStartsByLevel: { [key: number]: number }
      inhibitionFailuresByLevel: { [key: number]: number }
      processingSpeedErrors: number
      impulsivityIndex: number
      inhibitionIndex: number
    }
    performanceConsistency: Array<{
      level: number
      consistency: number
      variability: number
    }>
  }
}

export default function ReactionTimeGame() {
  const router = useRouter()
  const [gameState, setGameState] = useState<GameState>('introStart')
  const [level, setLevel] = useState<number>(1)
  const [currentTest, setCurrentTest] = useState<number>(0)
  const [redLights, setRedLights] = useState<boolean[]>([false, false, false, false, false])
  const [showGreen, setShowGreen] = useState<boolean>(false)
  const [showBlueDistractor, setShowBlueDistractor] = useState<boolean>(false)
  const [currentShapes, setCurrentShapes] = useState<string[]>([])
  const [targetShape, setTargetShape] = useState<ShapeType>('circle')
  const [reactionTime, setReactionTime] = useState<number>(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [errors, setErrors] = useState<number>(0)
  const [message, setMessage] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  // Cognitive metrics tracking
  const [metrics, setMetrics] = useState<CognitiveMetrics>({
    sessionStart: Date.now(),
    totalPlayTime: 0,
    reactionTimesByLevel: {},
    errorsByLevel: {},
    falseStartsByLevel: {},
    inhibitionFailuresByLevel: {},
    processingSpeedErrors: 0,
    averageReactionTimeByLevel: {},
    bestReactionTimeByLevel: {},
    consistencyScoreByLevel: {},
    completedLevels: 0,
    totalTests: 0,
    overallAccuracy: 0
  })

  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')

  const timeouts = useRef<NodeJS.Timeout[]>([])

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
          if (data.reactionTimeGame) {
            setUserStats(data.reactionTimeGame as UserStats)
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  // Save session data to Firestore
  const saveSessionData = async (sessionMetrics: SessionData) => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('reactionTimeSessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10) // Keep last 10 sessions
      localStorage.setItem('reactionTimeSessions', JSON.stringify(updatedSessions))
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      // Calculate session stats
      const sessionDuration = sessionMetrics.sessionOverview.totalSessionDuration
      const overallRT = sessionMetrics.performance.averageReactionTime
      const accuracy = sessionMetrics.performance.overallAccuracy
      const bestRT = sessionMetrics.performance.bestReactionTime

      // Update user's game stats
      await setDoc(userDocRef, {
        reactionTimeGame: {
          bestReactionTime: Math.min(bestRT, userStats?.bestReactionTime || Infinity),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalTestsCompleted: (userStats?.totalTestsCompleted || 0) + sessionMetrics.performance.totalTests,
          totalPlayTime: (userStats?.totalPlayTime || 0) + sessionDuration,
          averageReactionTime: calculateRunningAverage(
            userStats?.averageReactionTime || 0,
            userStats?.totalSessionsPlayed || 0,
            overallRT
          ),
          averageAccuracy: calculateRunningAverage(
            userStats?.averageAccuracy || 0,
            userStats?.totalSessionsPlayed || 0,
            accuracy
          ),
          levelsCompleted: Math.max(sessionMetrics.performance.completedLevels, userStats?.levelsCompleted || 0),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), sessionMetrics].slice(-10), // Keep last 10 sessions
          cognitiveProfile: {
            basicReactionTime: sessionMetrics.cognitiveMetrics.basicReactionTime,
            processingSpeed: sessionMetrics.cognitiveMetrics.processingSpeed,
            inhibitionControl: sessionMetrics.cognitiveMetrics.inhibitionControl,
            cognitiveFlexibility: sessionMetrics.cognitiveMetrics.cognitiveFlexibility,
            attentionalControl: sessionMetrics.cognitiveMetrics.attentionalControl
          }
        }
      }, { merge: true })

      // Save detailed session data in separate collection
      await addDoc(collection(db, 'gameSessionsDetailed'), {
        userId,
        gameType: 'reactionTime',
        ...sessionMetrics,
        createdAt: new Date()
      })

      console.log('Reaction time session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data. Your progress may not be synced.')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('reactionTimeSessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10)
      localStorage.setItem('reactionTimeSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to calculate running average
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  // Generate session data for saving
  const generateSessionData = (): SessionData => {
    const sessionEnd = Date.now()
    const totalDuration = sessionEnd - metrics.sessionStart

    // Calculate comprehensive metrics
    const allReactionTimes = Object.values(metrics.reactionTimesByLevel).flat()
    const totalErrors = Object.values(metrics.errorsByLevel).reduce((sum, errors) => sum + errors, 0) +
                       Object.values(metrics.falseStartsByLevel).reduce((sum, errors) => sum + errors, 0) +
                       Object.values(metrics.inhibitionFailuresByLevel).reduce((sum, errors) => sum + errors, 0) +
                       metrics.processingSpeedErrors

    const overallAccuracy = metrics.totalTests > 0 ? 
      ((metrics.totalTests - totalErrors) / metrics.totalTests) * 100 : 0

    return {
      sessionOverview: {
        sessionStart: metrics.sessionStart,
        sessionEnd,
        totalSessionDuration: totalDuration,
        gameType: 'reactionTime',
        completionStatus: metrics.completedLevels === LEVELS.length ? 'completed' : 'incomplete'
      },
      performance: {
        completedLevels: metrics.completedLevels,
        totalTests: metrics.totalTests,
        totalErrors,
        overallAccuracy: Math.round(overallAccuracy),
        averageReactionTime: allReactionTimes.length > 0 ? 
          Math.round(allReactionTimes.reduce((a, b) => a + b, 0) / allReactionTimes.length) : 0,
        bestReactionTime: allReactionTimes.length > 0 ? Math.min(...allReactionTimes) : 0,
        reactionTimesByLevel: metrics.reactionTimesByLevel,
        averageReactionTimeByLevel: metrics.averageReactionTimeByLevel,
        bestReactionTimeByLevel: metrics.bestReactionTimeByLevel,
        consistencyScoreByLevel: metrics.consistencyScoreByLevel
      },
      cognitiveMetrics: {
        basicReactionTime: calculateBasicReactionTime(),
        processingSpeed: calculateProcessingSpeed(),
        inhibitionControl: calculateInhibitionControl(),
        cognitiveFlexibility: calculateCognitiveFlexibility(),
        attentionalControl: calculateAttentionalControl(),
        errorAnalysis: {
          falseStarts: metrics.falseStartsByLevel,
          inhibitionFailures: metrics.inhibitionFailuresByLevel,
          processingErrors: metrics.processingSpeedErrors,
          totalErrorRate: (totalErrors / Math.max(metrics.totalTests, 1)) * 100
        }
      },
      detailedLogs: {
        levelByLevelPerformance: generateLevelAnalysis(),
        reactionTimeProgression: generateRTProgression(),
        errorPattern: generateErrorPattern(),
        performanceConsistency: generateConsistencyAnalysis()
      }
    }
  }

  // Cognitive analysis helper functions
  const calculateBasicReactionTime = (): number => {
    const level1Times = metrics.reactionTimesByLevel[1] || []
    return level1Times.length > 0 ? 
      Math.round(level1Times.reduce((a, b) => a + b, 0) / level1Times.length) : 0
  }

  const calculateProcessingSpeed = (): number => {
    const level2Times = metrics.reactionTimesByLevel[2] || []
    const baseRT = calculateBasicReactionTime()
    const avgLevel2 = level2Times.length > 0 ? 
      level2Times.reduce((a, b) => a + b, 0) / level2Times.length : 0
    
    return baseRT > 0 ? Math.round(avgLevel2 - baseRT) : Math.round(avgLevel2)
  }

  const calculateInhibitionControl = (): number => {
    const inhibitionFailures = metrics.inhibitionFailuresByLevel[3] || 0
    const level3Tests = metrics.reactionTimesByLevel[3]?.length || 0
    const totalLevel3Tests = level3Tests + inhibitionFailures
    
    return totalLevel3Tests > 0 ? 
      Math.round(((totalLevel3Tests - inhibitionFailures) / totalLevel3Tests) * 100) : 100
  }

  const calculateCognitiveFlexibility = (): number => {
    const level2Errors = metrics.processingSpeedErrors
    const level2Tests = (metrics.reactionTimesByLevel[2]?.length || 0) + level2Errors
    
    return level2Tests > 0 ? 
      Math.round(((level2Tests - level2Errors) / level2Tests) * 100) : 100
  }

  const calculateAttentionalControl = (): number => {
    const falseStarts = Object.values(metrics.falseStartsByLevel).reduce((sum, errors) => sum + errors, 0)
    return Math.max(0, 100 - (falseStarts * 10)) // Penalty for false starts
  }

  const generateLevelAnalysis = () => {
    return LEVELS.map((level, index) => {
      const levelNum = index + 1
      const times = metrics.reactionTimesByLevel[levelNum] || []
      const errors = (metrics.errorsByLevel[levelNum] || 0) + 
                    (metrics.falseStartsByLevel[levelNum] || 0) + 
                    (metrics.inhibitionFailuresByLevel[levelNum] || 0)
      
      return {
        level: levelNum,
        name: level.name,
        averageRT: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
        bestRT: times.length > 0 ? Math.min(...times) : 0,
        testsCompleted: times.length,
        errors,
        accuracy: (times.length + errors) > 0 ? 
          Math.round((times.length / (times.length + errors)) * 100) : 0
      }
    })
  }

  const generateRTProgression = () => {
    const allTimes = Object.entries(metrics.reactionTimesByLevel)
      .flatMap(([level, times]) => 
        times.map((time, index) => ({
          level: parseInt(level),
          attempt: index + 1,
          reactionTime: time,
          timestamp: metrics.sessionStart + (index * 10000) // Estimated
        }))
      )
    return allTimes
  }

  const generateErrorPattern = () => {
    return {
      falseStartsByLevel: metrics.falseStartsByLevel,
      inhibitionFailuresByLevel: metrics.inhibitionFailuresByLevel,
      processingSpeedErrors: metrics.processingSpeedErrors,
      impulsivityIndex: Object.values(metrics.falseStartsByLevel).reduce((sum, errors) => sum + errors, 0),
      inhibitionIndex: Object.values(metrics.inhibitionFailuresByLevel).reduce((sum, errors) => sum + errors, 0)
    }
  }

  const generateConsistencyAnalysis = () => {
    return Object.entries(metrics.reactionTimesByLevel).map(([level, times]) => {
      if (times.length < 2) return { level: parseInt(level), consistency: 100, variability: 0 }
      
      const mean = times.reduce((a, b) => a + b, 0) / times.length
      const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length
      const cv = Math.sqrt(variance) / mean // Coefficient of variation
      const consistency = Math.max(0, 100 - (cv * 100))
      
      return {
        level: parseInt(level),
        consistency: Math.round(consistency),
        variability: Math.round(Math.sqrt(variance))
      }
    })
  }

  // Auto-save when completing or returning to game selection
  const handleReturnToGameSelection = async (): Promise<void> => {
    if (metrics.totalTests > 0) {
      const sessionData = generateSessionData()
      await saveSessionData(sessionData)
    }
    router.push('/Prep/PrepGames/GameSelection')
  }

  // Auto-save when test completes
  const handleTestComplete = async (): Promise<void> => {
    if (metrics.totalTests > 0) {
      const sessionData = generateSessionData()
      await saveSessionData(sessionData)
    }
  }

  const clearAllTimeouts = useCallback(() => {
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

  // Update metrics when starting game
  useEffect(() => {
    if (gameState !== 'introStart') {
      setMetrics(prev => ({
        ...prev,
        totalPlayTime: Date.now() - prev.sessionStart
      }))
    }
  }, [gameState])

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
      
      // Track false start in metrics
      setMetrics(prev => ({
        ...prev,
        falseStartsByLevel: {
          ...prev.falseStartsByLevel,
          [level]: (prev.falseStartsByLevel[level] || 0) + 1
        },
        totalTests: prev.totalTests + 1
      }))
      
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
      
      // Track inhibition failure in metrics
      setMetrics(prev => ({
        ...prev,
        inhibitionFailuresByLevel: {
          ...prev.inhibitionFailuresByLevel,
          [level]: (prev.inhibitionFailuresByLevel[level] || 0) + 1
        },
        totalTests: prev.totalTests + 1
      }))
      
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
        
        // Track processing speed error
        setMetrics(prev => ({
          ...prev,
          processingSpeedErrors: prev.processingSpeedErrors + 1,
          totalTests: prev.totalTests + 1
        }))
        
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

      // Successful reaction - update metrics
      setReactionTime(reactionMs)
      setReactionTimes(prev => [...prev, reactionMs])
      
      setMetrics(prev => {
        const newLevelTimes = [...(prev.reactionTimesByLevel[level] || []), reactionMs]
        const avgRT = newLevelTimes.reduce((a, b) => a + b, 0) / newLevelTimes.length
        const bestRT = Math.min(...newLevelTimes)
        
        // Calculate consistency score
        const mean = avgRT
        const variance = newLevelTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / newLevelTimes.length
        const cv = Math.sqrt(variance) / mean
        const consistency = Math.max(0, 100 - (cv * 100))
        
        return {
          ...prev,
          reactionTimesByLevel: {
            ...prev.reactionTimesByLevel,
            [level]: newLevelTimes
          },
          averageReactionTimeByLevel: {
            ...prev.averageReactionTimeByLevel,
            [level]: Math.round(avgRT)
          },
          bestReactionTimeByLevel: {
            ...prev.bestReactionTimeByLevel,
            [level]: bestRT
          },
          consistencyScoreByLevel: {
            ...prev.consistencyScoreByLevel,
            [level]: Math.round(consistency)
          },
          totalTests: prev.totalTests + 1
        }
      })
      
      setGameState('result')
      setShowGreen(false)
      setMessage(`${reactionMs}ms - ${getRankMessage(reactionMs)}`)
      setIsProcessing(true)

      timeouts.current.push(setTimeout(() => {
        const nextTest = currentTest + 1
        if (nextTest >= LEVELS[level - 1].tests) {
          // Level completed
          setMetrics(prev => ({
            ...prev,
            completedLevels: Math.max(prev.completedLevels, level)
          }))
          
          if (level >= LEVELS.length) {
            setGameState('complete')
            setMessage('All levels complete! Returning to Game Selection...')
            timeouts.current.push(setTimeout(async () => {
              await handleTestComplete()
              navigateToNext()
            }, 2000))
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
    router.push('/Prep/PrepGames/GameSelection')
  }

  const renderShape = (shape: string, size: string = 'w-16 h-16'): JSX.Element | null => {
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

  const currentLevelData = LEVELS[level - 1]
  const progress = currentLevelData ? (currentTest / currentLevelData.tests) * 100 : 0

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6">
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

      {gameState === 'introStart' ? (
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-6 text-green-400">Reaction Time Test</h1>
          <p className="mb-8 text-gray-300 text-lg leading-relaxed">
            We are now going to test your <span className="text-blue-400 font-semibold">reaction time</span>, <span className="text-blue-400 font-semibold">processing speed</span>, and <span className="text-blue-400 font-semibold">inhibition control</span>.
          </p>
          
          {userId && userStats && (
            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold mb-3 text-green-400">Your Best Performance</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{userStats.bestReactionTime || 0}ms</div>
                  <div className="text-gray-400">Best Reaction Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{Math.round(userStats.averageAccuracy || 0)}%</div>
                  <div className="text-gray-400">Avg Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{userStats.levelsCompleted || 0}/{LEVELS.length}</div>
                  <div className="text-gray-400">Levels Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{userStats.totalSessionsPlayed || 0}</div>
                  <div className="text-gray-400">Sessions</div>
                </div>
              </div>
            </div>
          )}

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
            {!userId && (
              <p className="text-orange-400 text-sm mt-4">💡 Sign in to save your cognitive performance data!</p>
            )}
          </div>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setGameState('intro')}
              className="px-8 py-4 bg-green-600 rounded-lg hover:bg-green-500 transition-all text-white text-xl font-semibold transform hover:scale-105"
            >
              Start Test
            </button>
            
            <button
              onClick={handleReturnToGameSelection}
              className="px-6 py-4 bg-gray-600/80 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all duration-200"
            >
              🏠 Return to Game Selection
            </button>
          </div>
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
              {userId && <span className="text-green-400">✅ Synced</span>}
              {!userId && <span className="text-orange-400">📱 Local</span>}
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

          {/* Return to Game Selection button during gameplay */}
          <div className="mt-6">
            <button
              onClick={handleReturnToGameSelection}
              className="px-6 py-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-lg transition-all duration-200"
            >
              🏠 Return to Game Selection
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
