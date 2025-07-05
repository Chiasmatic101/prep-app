'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// TypeScript interfaces
interface LevelConfig {
  tubes: number
  ballsPerColor: number
}

interface MoveLog {
  from: number
  to: number
  ballsTransferred: number
  color: string
  timestamp: number
  timeSinceLastAction: number
  isBacktrack: boolean
  gameStateBefore: CognitiveLoad
  moveNumber: number
}

interface InvalidClick {
  tube: number
  reason: string
  timestamp: number
  fromColor?: string
  toColor?: string
  gameState: CognitiveLoad
}

interface HesitationTime {
  duration: number
  timestamp: number
  actionType: string
}

interface PlanningPause {
  duration: number
  timestamp: number
  gameState: CognitiveLoad
}

interface BacktrackMove {
  from: number
  to: number
  timestamp: number
  moveNumber: number
}

interface ErrorPattern {
  errorType: string
  fromTube: number
  toTube: number
  attemptedColor: string
  targetColor: string | null
  timestamp: number
  gameState: CognitiveLoad
}

interface FocusChange {
  from: number | null
  to: number
  timestamp: number
}

interface CognitiveLoad {
  colorComplexity: number
  mixedTubes: number
  totalBalls: number
  emptyTubes: number
  loadScore: number
}

interface TubeSelection {
  tube: number
  timestamp: number
  timeSinceLastAction: number
  selectedTube: number | null
}

interface ResetEvent {
  level: number
  timestamp: number
  sessionTime: number
}

interface LevelData {
  level: number
  levelConfig: [number, number]
  completed: boolean
  timing: {
    startTime: number
    endTime: number
    durationMs: number
    durationSeconds: string
    sessionTime: number
  }
  performance: {
    totalMoves: number
    optimalMoves: number
    efficiency: string
    invalidClicks: number
    resets: number
  }
  cognitive: {
    hesitations: number
    avgHesitationTime: string
    planningPauses: number
    backtrackMoves: number
    errorPatterns: number
    focusChanges: number
    avgCognitiveLoad: string
  }
  detailedLogs: {
    moves: MoveLog[]
    invalidClicks: InvalidClick[]
    hesitations: HesitationTime[]
    planningPauses: PlanningPause[]
    backtrackMoves: BacktrackMove[]
    errorPatterns: ErrorPattern[]
    focusChanges: FocusChange[]
    cognitiveLoadProgression: CognitiveLoad[]
  }
}

interface SessionStats {
  totalMoves: number
  totalInvalidClicks: number
  totalHesitations: number
  totalPlanningPauses: number
  totalBacktracks: number
  totalErrors: number
}

interface SessionData {
  levels: LevelData[]
  resets: ResetEvent[]
  sessionStart: number
  currentSessionStats: SessionStats
}

interface UserStats {
  bestLevel: number
  totalSessionsPlayed: number
  totalLevelsCompleted: number
  totalMoves: number
  averageEfficiency: number
  averageHesitationTime: number
  averageSolveTime: number
  lastPlayed: string
  sessions: any[]
  cognitiveProfile: {
    planningTendency: number
    errorProneness: number
    backtrackTendency: number
    focusStability: number
    overallEfficiency: string
  }
}

// Level configuration: [tubes, ballsPerColor]
const levelConfig: [number, number][] = [
  [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
]

const generateLevel = (level: number): string[][] => {
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1]
  const [tubeCount, ballsPerColor] = config

  // Better color count calculation - ensure adequate empty tubes for strategy
  const colorCount = Math.max(2, Math.min(tubeCount - 2, Math.floor((tubeCount - 2) * 0.75)))
  const colors = Array.from({ length: colorCount }, (_, i) =>
    `hsl(${(i * 360) / colorCount}, 85%, 60%)`
  )

  const allBalls: string[] = []
  for (const color of colors) {
    for (let i = 0; i < ballsPerColor; i++) {
      allBalls.push(color)
    }
  }

  // Multiple shuffles for better randomization
  for (let shuffle = 0; shuffle < 3; shuffle++) {
    for (let i = allBalls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[allBalls[i], allBalls[j]] = [allBalls[j], allBalls[i]]
    }
  }

  const tubes: string[][] = Array.from({ length: tubeCount }, () => [])
  const fillableTubes = tubeCount - 2
  let ballIndex = 0

  // Smart distribution to prevent accidental sorting
  while (ballIndex < allBalls.length) {
    for (let t = 0; t < fillableTubes && ballIndex < allBalls.length; t++) {
      if (tubes[t].length < 4) {
        const ballToAdd = allBalls[ballIndex]
        const currentTube = tubes[t]
        
        // Avoid creating tubes with too many same-colored balls
        if (currentTube.length >= 2) {
          const sameColorCount = currentTube.filter(ball => ball === ballToAdd).length
          
          if (sameColorCount >= 2) {
            // Try to place in a different tube first
            let placed = false
            for (let alt = 0; alt < fillableTubes; alt++) {
              if (alt !== t && tubes[alt].length < 4) {
                const altSameCount = tubes[alt].filter(ball => ball === ballToAdd).length
                if (altSameCount < 2) {
                  tubes[alt].push(ballToAdd)
                  ballIndex++
                  placed = true
                  break
                }
              }
            }
            if (!placed) {
              tubes[t].push(ballToAdd)
              ballIndex++
            }
          } else {
            tubes[t].push(ballToAdd)
            ballIndex++
          }
        } else {
          tubes[t].push(ballToAdd)
          ballIndex++
        }
      }
    }
  }

  // Additional validation and forced mixing
  let attemptCount = 0
  while (attemptCount < 10) {
    let hasProblems = false
    
    for (let i = 0; i < fillableTubes; i++) {
      const tube = tubes[i]
      const isSorted = tube.length === 4 && tube.every(color => color === tube[0])
      
      if (isSorted) {
        hasProblems = true
        // Find another tube to swap with
        for (let j = 0; j < fillableTubes; j++) {
          if (j !== i && tubes[j].length > 0) {
            const ballA = tube.pop()
            const ballB = tubes[j].pop()
            if (ballA && ballB && ballA !== ballB) {
              tube.push(ballB)
              tubes[j].push(ballA)
              break
            } else {
              if (ballA) tube.push(ballA)
              if (ballB) tubes[j].push(ballB)
            }
          }
        }
      }
    }
    
    if (!hasProblems) break
    attemptCount++
  }

  const alreadySolved = tubes.every(tube =>
    tube.length === 0 || (tube.length === 4 && tube.every(color => color === tube[0]))
  )

  return alreadySolved ? generateLevel(level) : tubes
}

export default function ColorSortGame() {
  const router = useRouter()
  const [tubes, setTubes] = useState<string[][]>([])
  const [selectedTube, setSelectedTube] = useState<number | null>(null)
  const [level, setLevel] = useState<number>(1)
  const [completed, setCompleted] = useState<boolean>(false)
  const [moves, setMoves] = useState<number>(0)
  const [message, setMessage] = useState<string>('Sort the colors into separate tubes! 🎨')
  const [showMetrics, setShowMetrics] = useState<boolean>(false)

  // Core Cognitive Metrics - Current Level
  const [startTime, setStartTime] = useState<number | null>(null)
  const [endTime, setEndTime] = useState<number | null>(null)
  const [moveLog, setMoveLog] = useState<MoveLog[]>([])
  const [invalidClicks, setInvalidClicks] = useState<InvalidClick[]>([])
  const [tubeSelections, setTubeSelections] = useState<TubeSelection[]>([])
  
  // Advanced Cognitive Metrics - Current Level
  const [hesitationTimes, setHesitationTimes] = useState<HesitationTime[]>([])
  const [backtrackMoves, setBacktrackMoves] = useState<BacktrackMove[]>([])
  const [planningPauses, setPlanningPauses] = useState<PlanningPause[]>([])
  const [errorPatterns, setErrorPatterns] = useState<ErrorPattern[]>([])
  const [focusChanges, setFocusChanges] = useState<FocusChange[]>([])
  const [cognitiveLoad, setCognitiveLoad] = useState<CognitiveLoad[]>([])
  
  // Session-wide Persistent Data (survives level changes)
  const [sessionData, setSessionData] = useState<SessionData>({
    levels: [], // Array of completed level data
    resets: [],
    sessionStart: Date.now(),
    currentSessionStats: {
      totalMoves: 0,
      totalInvalidClicks: 0,
      totalHesitations: 0,
      totalPlanningPauses: 0,
      totalBacktracks: 0,
      totalErrors: 0
    }
  })

  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')
  
  const lastActionTime = useRef<number>(Date.now())
  const sessionStartTime = useRef<number>(Date.now())
  const pauseThreshold = 3000 // 3 seconds pause indicates planning
  const hesitationThreshold = 1500 // 1.5 seconds hesitation

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
          if (data.colorSortGame) {
            setUserStats(data.colorSortGame as UserStats)
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  // Save session data to Firestore
  const saveSessionData = async (sessionMetrics: any) => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('colorSortSessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10) // Keep last 10 sessions
      localStorage.setItem('colorSortSessions', JSON.stringify(updatedSessions))
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      // Calculate session stats
      const completedLevels = sessionMetrics.levelByLevelData.filter((l: any) => l.completed)
      const avgEfficiency = completedLevels.length > 0 ? 
        completedLevels.reduce((sum: number, l: any) => sum + parseFloat(l.performance.efficiency || '0'), 0) / completedLevels.length : 0
      const avgHesitation = sessionMetrics.cognitiveProfile.avgHesitationTime
      const totalSolveTime = completedLevels.reduce((sum: number, l: any) => sum + l.timing.durationMs, 0)

      // Update user's game stats
      await setDoc(userDocRef, {
        colorSortGame: {
          bestLevel: Math.max(sessionMetrics.sessionOverview.currentLevel, userStats?.bestLevel || 0),
          totalSessionsPlayed: (userStats?.totalSessionsPlayed || 0) + 1,
          totalLevelsCompleted: (userStats?.totalLevelsCompleted || 0) + completedLevels.length,
          totalMoves: (userStats?.totalMoves || 0) + sessionMetrics.sessionOverview.sessionStats.totalMoves,
          averageEfficiency: calculateRunningAverage(
            userStats?.averageEfficiency || 0,
            userStats?.totalSessionsPlayed || 0,
            avgEfficiency
          ),
          averageHesitationTime: calculateRunningAverage(
            userStats?.averageHesitationTime || 0,
            userStats?.totalSessionsPlayed || 0,
            avgHesitation
          ),
          averageSolveTime: calculateRunningAverage(
            userStats?.averageSolveTime || 0,
            userStats?.totalLevelsCompleted || 0,
            totalSolveTime / Math.max(completedLevels.length, 1)
          ),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), sessionMetrics].slice(-10), // Keep last 10 sessions
          cognitiveProfile: {
            planningTendency: sessionMetrics.cognitiveProfile.planningFrequency,
            errorProneness: sessionMetrics.cognitiveProfile.errorProneness,
            backtrackTendency: sessionMetrics.cognitiveProfile.backtrackTendency,
            focusStability: sessionMetrics.cognitiveProfile.focusStability,
            overallEfficiency: sessionMetrics.cognitiveProfile.overallEfficiency
          }
        }
      }, { merge: true })

      // Save detailed session data in separate collection
      await addDoc(collection(db, 'gameSessionsDetailed'), {
        userId,
        gameType: 'colorSort',
        ...sessionMetrics,
        createdAt: new Date()
      })

      console.log('Color Sort session saved successfully')
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data. Your progress may not be synced.')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('colorSortSessions') || '[]')
      const updatedSessions = [...savedSessions, sessionMetrics].slice(-10)
      localStorage.setItem('colorSortSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to calculate running average
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  useEffect(() => { 
    resetLevel() 
    if (level === 1) {
      sessionStartTime.current = Date.now()
      setSessionData(prev => ({ ...prev, sessionStart: Date.now() }))
    }
  }, [level])

  const resetLevel = () => {
    const now = Date.now()
    
    // Save current level data before reset (if we have data)
    if (startTime && moveLog.length > 0) {
      saveLevelData(false) // Save as incomplete
    }
    
    setTubes(generateLevel(level))
    setCompleted(false)
    setSelectedTube(null)
    setMoves(0)
    setMessage('Sort the colors into separate tubes! 🎨')
    setSaveError('')
    
    // Reset timing metrics
    setStartTime(now)
    setEndTime(null)
    lastActionTime.current = now
    
    // Reset cognitive metrics for new level
    setMoveLog([])
    setInvalidClicks([])
    setTubeSelections([])
    setHesitationTimes([])
    setBacktrackMoves([])
    setPlanningPauses([])
    setErrorPatterns([])
    setFocusChanges([])
    setCognitiveLoad([])
    
    // Track reset event in session data
    setSessionData(prev => ({
      ...prev,
      resets: [...prev.resets, { 
        level, 
        timestamp: now,
        sessionTime: now - prev.sessionStart 
      }]
    }))
  }

  const calculateCognitiveLoad = (): CognitiveLoad => {
    const uniqueColors = new Set<string>()
    tubes.forEach(tube => tube.forEach(ball => uniqueColors.add(ball)))
    const mixedTubes = tubes.filter(tube => {
      const colors = new Set(tube)
      return colors.size > 1 && tube.length > 0
    }).length
    
    return {
      colorComplexity: uniqueColors.size,
      mixedTubes,
      totalBalls: tubes.flat().length,
      emptyTubes: tubes.filter(tube => tube.length === 0).length,
      loadScore: (uniqueColors.size * 2) + (mixedTubes * 3) + (tubes.length - tubes.filter(tube => tube.length === 0).length)
    }
  }

  const detectBacktrack = (fromTube: number, toTube: number): boolean => {
    const recentMoves = moveLog.slice(-3)
    const isBacktrack = recentMoves.some(move => 
      move.from === toTube && move.to === fromTube
    )
    return isBacktrack
  }

  const handleTubeClick = (index: number) => {
    if (completed) return
    
    const now = Date.now()
    const timeSinceLastAction = now - lastActionTime.current
    
    // Track hesitation and planning pauses
    if (timeSinceLastAction > hesitationThreshold) {
      setHesitationTimes(prev => [...prev, {
        duration: timeSinceLastAction,
        timestamp: now,
        actionType: selectedTube === null ? 'initial_selection' : 'target_selection'
      }])
    }
    
    if (timeSinceLastAction > pauseThreshold) {
      setPlanningPauses(prev => [...prev, {
        duration: timeSinceLastAction,
        timestamp: now,
        gameState: calculateCognitiveLoad()
      }])
    }

    // Track tube selections
    setTubeSelections(prev => [...prev, {
      tube: index,
      timestamp: now,
      timeSinceLastAction,
      selectedTube: selectedTube
    }])

    // Track focus changes
    setFocusChanges(prev => [...prev, {
      from: selectedTube,
      to: index,
      timestamp: now
    }])

    if (selectedTube === null) {
      if (tubes[index].length === 0) {
        setInvalidClicks(prev => [...prev, {
          tube: index,
          reason: 'Empty source tube',
          timestamp: now,
          gameState: calculateCognitiveLoad()
        }])
        return
      }
      setSelectedTube(index)
      setMessage('Now select a tube to pour into! ✨')
    } else {
      if (selectedTube === index) {
        setSelectedTube(null)
        setMessage('Sort the colors into separate tubes! 🎨')
        lastActionTime.current = now
        return
      }

      const fromTube = [...tubes[selectedTube]]
      const toTube = [...tubes[index]]
      
      if (fromTube.length === 0) {
        setInvalidClicks(prev => [...prev, {
          tube: selectedTube,
          reason: 'Empty source tube',
          timestamp: now,
          gameState: calculateCognitiveLoad()
        }])
        setSelectedTube(null)
        setMessage('Sort the colors into separate tubes! 🎨')
        lastActionTime.current = now
        return
      }

      const topColor = fromTube[fromTube.length - 1]
      const canPour = toTube.length === 0 ||
        (toTube.length < 4 && toTube[toTube.length - 1] === topColor)

      if (canPour) {
        // Check for backtrack behavior
        const isBacktrack = detectBacktrack(selectedTube, index)
        if (isBacktrack) {
          setBacktrackMoves(prev => [...prev, {
            from: selectedTube,
            to: index,
            timestamp: now,
            moveNumber: moves + 1
          }])
        }

        let ballsToMove = 0
        for (let i = fromTube.length - 1; i >= 0; i--) {
          if (fromTube[i] === topColor && toTube.length + ballsToMove < 4) {
            ballsToMove++
          } else {
            break
          }
        }
        
        const ballsToTransfer = fromTube.splice(-ballsToMove, ballsToMove)
        toTube.push(...ballsToTransfer)
        const newTubes = [...tubes]
        newTubes[selectedTube] = fromTube
        newTubes[index] = toTube
        setTubes(newTubes)
        setMoves(moves + 1)
        
        // Log successful move
        setMoveLog(prev => [...prev, {
          from: selectedTube,
          to: index,
          ballsTransferred: ballsToMove,
          color: topColor,
          timestamp: now,
          timeSinceLastAction,
          isBacktrack,
          gameStateBefore: calculateCognitiveLoad(),
          moveNumber: moves + 1
        }])
        
        // Update cognitive load
        setCognitiveLoad(prev => [...prev, calculateCognitiveLoad()])
        
        checkCompletion(newTubes)
        setMessage('Nice move! Keep going! 🚀')
      } else {
        // Track error patterns
        setErrorPatterns(prev => [...prev, {
          errorType: 'color_mismatch',
          fromTube: selectedTube,
          toTube: index,
          attemptedColor: topColor,
          targetColor: toTube.length > 0 ? toTube[toTube.length - 1] : null,
          timestamp: now,
          gameState: calculateCognitiveLoad()
        }])
        
        setInvalidClicks(prev => [...prev, {
          tube: index,
          reason: 'Color mismatch - cannot stack different colors',
          timestamp: now,
          fromColor: topColor,
          toColor: toTube.length > 0 ? toTube[toTube.length - 1] : 'empty',
          gameState: calculateCognitiveLoad()
        }])
        
        setMessage('Oops! Colors must match to stack 💡')
      }
      setSelectedTube(null)
    }
    
    lastActionTime.current = now
  }

  const saveLevelData = (isCompleted = true): LevelData => {
    const now = Date.now()
    const levelData: LevelData = {
      level,
      levelConfig: levelConfig[level - 1],
      completed: isCompleted,
      timing: {
        startTime: startTime!,
        endTime: isCompleted ? (endTime || now) : now,
        durationMs: (isCompleted ? (endTime || now) : now) - startTime!,
        durationSeconds: (((isCompleted ? (endTime || now) : now) - startTime!) / 1000).toFixed(2),
        sessionTime: now - sessionData.sessionStart
      },
      performance: {
        totalMoves: isCompleted ? moves + 1 : moves,
        optimalMoves: calculateOptimalMoves(),
        efficiency: isCompleted ? ((calculateOptimalMoves() / (moves + 1)) * 100).toFixed(1) + '%' : 'N/A',
        invalidClicks: invalidClicks.length,
        resets: sessionData.resets.filter(r => r.level === level).length
      },
      cognitive: {
        hesitations: hesitationTimes.length,
        avgHesitationTime: hesitationTimes.length > 0 ? 
          (hesitationTimes.reduce((sum, h) => sum + h.duration, 0) / hesitationTimes.length).toFixed(0) + 'ms' : '0ms',
        planningPauses: planningPauses.length,
        backtrackMoves: backtrackMoves.length,
        errorPatterns: errorPatterns.length,
        focusChanges: focusChanges.length,
        avgCognitiveLoad: cognitiveLoad.length > 0 ? 
          (cognitiveLoad.reduce((sum, cl) => sum + cl.loadScore, 0) / cognitiveLoad.length).toFixed(1) : '0'
      },
      detailedLogs: {
        moves: moveLog,
        invalidClicks,
        hesitations: hesitationTimes,
        planningPauses,
        backtrackMoves,
        errorPatterns,
        focusChanges,
        cognitiveLoadProgression: cognitiveLoad
      }
    }
    
    // Update session data
    setSessionData(prev => ({
      ...prev,
      levels: [...prev.levels.filter(l => l.level !== level), levelData], // Replace if exists
      currentSessionStats: {
        totalMoves: prev.currentSessionStats.totalMoves + (isCompleted ? moves + 1 : moves),
        totalInvalidClicks: prev.currentSessionStats.totalInvalidClicks + invalidClicks.length,
        totalHesitations: prev.currentSessionStats.totalHesitations + hesitationTimes.length,
        totalPlanningPauses: prev.currentSessionStats.totalPlanningPauses + planningPauses.length,
        totalBacktracks: prev.currentSessionStats.totalBacktracks + backtrackMoves.length,
        totalErrors: prev.currentSessionStats.totalErrors + errorPatterns.length
      }
    }))
    
    return levelData
  }

  const checkCompletion = (currentTubes: string[][]) => {
    const isComplete = currentTubes.every(tube =>
      tube.length === 0 || (tube.length === 4 && tube.every(ball => ball === tube[0]))
    )
    
    if (isComplete) {
      const now = Date.now()
      setCompleted(true)
      setEndTime(now)
      
      // Save the completed level data
      saveLevelData(true)
      
      if (level >= levelConfig.length) {
        setMessage('🎊 Amazing! All levels complete!')
        // Auto-save session when all levels are completed
        setTimeout(async () => {
          await saveCurrentSession()
        }, 1000)
      } else {
        setMessage('🌟 Level complete! Get ready for the next challenge...')
        setTimeout(() => { setLevel(level + 1) }, 1500)
      }
    }
  }

  const calculateOptimalMoves = (): number => {
    // Simplified optimal move calculation - in reality this is complex
    const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1]
    const [tubeCount, ballsPerColor] = config
    const colorCount = Math.max(2, Math.min(tubeCount - 2, Math.floor((tubeCount - 2) * 0.75)))
    return colorCount * ballsPerColor * 0.7 // Rough estimate
  }

  const nextLevel = async () => {
    if (level < levelConfig.length) {
      // Save session data before moving to next level
      await saveCurrentSession()
      setLevel(level + 1)
    }
  }

  const handleReturnToGameSelection = async () => {
    // Save session data before leaving
    await saveCurrentSession()
    router.push('/Prep/PrepGames/GameSelection')
  }

  const saveCurrentSession = async () => {
    // Save current level data if in progress
    if (startTime && (moveLog.length > 0 || invalidClicks.length > 0)) {
      saveLevelData(completed)
    }
    
    // Generate session metrics and save to Firestore
    const allMetrics = {
      sessionOverview: {
        sessionStart: sessionData.sessionStart,
        sessionEnd: Date.now(),
        totalSessionDuration: Date.now() - sessionData.sessionStart,
        currentLevel: level,
        levelsCompleted: sessionData.levels.filter(l => l.completed).length,
        totalResets: sessionData.resets.length,
        sessionStats: sessionData.currentSessionStats
      },
      cognitiveProfile: {
        avgHesitationTime: sessionData.levels.length > 0 ? 
          sessionData.levels.reduce((sum, l) => sum + (l.cognitive.hesitations || 0), 0) / sessionData.levels.length : 0,
        planningFrequency: sessionData.currentSessionStats.totalPlanningPauses,
        errorProneness: sessionData.currentSessionStats.totalErrors,
        backtrackTendency: sessionData.currentSessionStats.totalBacktracks,
        focusStability: sessionData.levels.reduce((sum, l) => sum + (l.cognitive.focusChanges || 0), 0),
        overallEfficiency: sessionData.levels.length > 0 ?
          sessionData.levels.filter(l => l.completed).reduce((sum, l) => sum + parseFloat(l.performance.efficiency || '0'), 0) / sessionData.levels.filter(l => l.completed).length + '%' : 'N/A'
      },
      levelByLevelData: sessionData.levels,
      sessionEvents: {
        resets: sessionData.resets,
        currentLevelData: {
          level,
          currentMoves: moves,
          currentInvalidClicks: invalidClicks.length,
          currentHesitations: hesitationTimes.length,
          inProgress: !completed
        }
      },
      rawDataSummary: {
        totalDataPoints: sessionData.levels.reduce((sum, l) => 
          sum + l.detailedLogs.moves.length + l.detailedLogs.invalidClicks.length + 
          l.detailedLogs.hesitations.length + l.detailedLogs.planningPauses.length, 0),
        dataIntegrity: 'All cognitive events tracked and preserved across levels'
      }
    }
    
    console.log("📊 Auto-saving Color Sort Session Data:", allMetrics)
    await saveSessionData(allMetrics)
  }

  const exportMetrics = () => {
    // Save current level data if in progress
    if (startTime && (moveLog.length > 0 || invalidClicks.length > 0)) {
      saveLevelData(completed)
    }
    
    const allMetrics = {
      sessionOverview: {
        sessionStart: sessionData.sessionStart,
        sessionEnd: Date.now(),
        totalSessionDuration: Date.now() - sessionData.sessionStart,
        currentLevel: level,
        levelsCompleted: sessionData.levels.filter(l => l.completed).length,
        totalResets: sessionData.resets.length,
        sessionStats: sessionData.currentSessionStats
      },
      cognitiveProfile: {
        avgHesitationTime: sessionData.levels.length > 0 ? 
          sessionData.levels.reduce((sum, l) => sum + (l.cognitive.hesitations || 0), 0) / sessionData.levels.length : 0,
        planningFrequency: sessionData.currentSessionStats.totalPlanningPauses,
        errorProneness: sessionData.currentSessionStats.totalErrors,
        backtrackTendency: sessionData.currentSessionStats.totalBacktracks,
        focusStability: sessionData.levels.reduce((sum, l) => sum + (l.cognitive.focusChanges || 0), 0),
        overallEfficiency: sessionData.levels.length > 0 ?
          sessionData.levels.filter(l => l.completed).reduce((sum, l) => sum + parseFloat(l.performance.efficiency || '0'), 0) / sessionData.levels.filter(l => l.completed).length + '%' : 'N/A'
      },
      levelByLevelData: sessionData.levels,
      sessionEvents: {
        resets: sessionData.resets,
        currentLevelData: {
          level,
          currentMoves: moves,
          currentInvalidClicks: invalidClicks.length,
          currentHesitations: hesitationTimes.length,
          inProgress: !completed
        }
      },
      rawDataSummary: {
        totalDataPoints: sessionData.levels.reduce((sum, l) => 
          sum + l.detailedLogs.moves.length + l.detailedLogs.invalidClicks.length + 
          l.detailedLogs.hesitations.length + l.detailedLogs.planningPauses.length, 0),
        dataIntegrity: 'All cognitive events tracked and preserved across levels'
      }
    }
    
    // Export JSON file for local download
    const dataStr = JSON.stringify(allMetrics, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `color-sort-session-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    
    console.log("📊 Exported Session Data (Local Download):", allMetrics)
  }

  const progress = (level / levelConfig.length) * 100

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 text-gray-900 font-sans flex flex-col items-center justify-center p-6">
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
        <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
          Color Sort Challenge 🧠
        </h1>
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="text-lg font-semibold text-purple-700">Level {level}</span>
          <div className="w-32 h-3 bg-white/50 rounded-full overflow-hidden border border-white/30">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm text-purple-600">{Math.round(progress)}%</span>
        </div>
        <p className="text-lg text-gray-700 font-medium">{message}</p>
        <div className="flex gap-4 justify-center items-center text-sm text-gray-600 mt-2">
          <span>Moves: {moves}</span>
          <span>Invalid: {invalidClicks.length}</span>
          <span>Hesitations: {hesitationTimes.length}</span>
          <span>Backtracks: {backtrackMoves.length}</span>
          <span>Session: {sessionData.levels.filter(l => l.completed).length} levels</span>
          {userId && userStats && (
            <span className="text-green-600">✅ Synced</span>
          )}
          {!userId && (
            <span className="text-orange-600">📱 Local</span>
          )}
        </div>
      </div>

      <div className="bg-white/30 backdrop-blur-sm border border-white/40 rounded-3xl p-8 shadow-xl mb-8">
        <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: `repeat(${Math.min(tubes.length, 8)}, minmax(0, 1fr))` }}>
          {tubes.map((tube, index) => (
            <div key={index} onClick={() => handleTubeClick(index)}
              className={`w-20 h-40 border-3 rounded-2xl overflow-hidden cursor-pointer flex flex-col-reverse justify-start items-center transition-all duration-300
                transform hover:scale-105 active:scale-95 bg-white/20 backdrop-blur-sm
                ${selectedTube === index ? 'border-purple-500 shadow-lg shadow-purple-400/50 scale-105'
                : 'border-white/50 hover:border-pink-400/70 hover:shadow-lg hover:shadow-pink-300/30'}`}>
              {tube.map((color, ballIndex) => (
                <div key={ballIndex} className="w-16 h-9 my-0.5 rounded-xl border-2 border-white/30 shadow-sm transition-all duration-200"
                  style={{ backgroundColor: color, boxShadow: `inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.1)` }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 flex-wrap justify-center mb-6">
        <button onClick={resetLevel} className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
          🔄 Reset Level
        </button>
        <button onClick={() => setShowMetrics(!showMetrics)} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
          📊 {showMetrics ? 'Hide' : 'Show'} Metrics
        </button>
        <button onClick={exportMetrics} className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
          📄 Export JSON
        </button>
        {completed && level < levelConfig.length && (
          <button onClick={nextLevel} className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95">
            🚀 Next Level
          </button>
        )}
        <button
          className="px-6 py-3 bg-gray-600/80 hover:bg-gray-600 text-white rounded-full font-semibold shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
          onClick={handleReturnToGameSelection}
        >
          🏠 Return to Game Selection
        </button>
      </div>

      {showMetrics && (
        <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-6 mb-6 max-w-4xl">
          <h3 className="font-bold text-purple-700 mb-4 text-center">🧠 Cognitive Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">Current Level</h4>
              <div>Moves: {moves}</div>
              <div>Invalid: {invalidClicks.length}</div>
              <div>Hesitations: {hesitationTimes.length}</div>
              <div>Resets: {sessionData.resets.filter(r => r.level === level).length}</div>
            </div>
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">Session Stats</h4>
              <div>Levels Done: {sessionData.levels.filter(l => l.completed).length}</div>
              <div>Total Moves: {sessionData.currentSessionStats.totalMoves}</div>
              <div>Total Errors: {sessionData.currentSessionStats.totalErrors}</div>
              <div>Session Time: {Math.floor((Date.now() - sessionData.sessionStart) / 60000)}m</div>
            </div>
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">Cognitive Load</h4>
              <div>Planning: {planningPauses.length}</div>
              <div>Focus Changes: {focusChanges.length}</div>
              <div>Backtracks: {backtrackMoves.length}</div>
              <div>Load Score: {cognitiveLoad.length > 0 ? 
                (cognitiveLoad[cognitiveLoad.length - 1]?.loadScore || 0).toFixed(1) : '0'}</div>
            </div>
            <div className="bg-white/30 rounded-lg p-3">
              <h4 className="font-semibold text-purple-600 mb-2">User Progress</h4>
              {userId && userStats ? (
                <>
                  <div>Best Level: {userStats.bestLevel || 0}</div>
                  <div>Sessions: {userStats.totalSessionsPlayed || 0}</div>
                  <div>Avg Efficiency: {Math.round(userStats.averageEfficiency || 0)}%</div>
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
          
          {userId && userStats && (
            <div className="mt-4 p-4 bg-white/20 rounded-lg">
              <h4 className="font-semibold text-purple-600 mb-2 text-center">🏆 Personal Stats</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg">{userStats.bestLevel || 0}</div>
                  <div className="text-gray-600">Best Level</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{userStats.totalLevelsCompleted || 0}</div>
                  <div className="text-gray-600">Levels Completed</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.averageEfficiency || 0)}%</div>
                  <div className="text-gray-600">Avg Efficiency</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg">{Math.round(userStats.averageHesitationTime || 0)}ms</div>
                  <div className="text-gray-600">Avg Hesitation</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 max-w-md text-center">
        <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-4">
          <h3 className="font-bold text-purple-700 mb-2">💡 Pro Tips</h3>
          <p className="text-sm text-gray-700">
            Only matching colors can stack together. Use empty tubes strategically to organize your moves!
          </p>
          {!userId && (
            <p className="text-xs text-orange-600 mt-2">
              💡 Sign in to save your progress and track cognitive improvements!
            </p>
          )}
        </div>
      </div>
    </main>
  )
}