'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, TrendingUp } from 'lucide-react'

interface MoveLog {
  position: number
  player: 'X' | 'O'
  timestamp: number
  timeSinceLastMove: number
  moveNumber: number
  gameState: string[]
  isStrategic: boolean
  moveType: 'offensive' | 'defensive' | 'neutral'
  boardContext: {
    activeBoardIndex: number | null
    availableBoards: number
    macroThreatLevel: number
  }
}

interface GameResult {
  gameNumber: number
  outcome: 'win' | 'loss' | 'draw'
  totalMoves: number
  duration: number
  difficulty: number
  playerMoves: number
  strategicMoves: number
  defensiveMoves: number
  offensiveMoves: number
  adaptiveScore: number
}

interface HesitationTime {
  duration: number
  timestamp: number
  moveNumber: number
  complexity: number
}

interface CognitiveShift {
  timestamp: number
  fromStrategy: 'offensive' | 'defensive' | 'neutral'
  toStrategy: 'offensive' | 'defensive' | 'neutral'
  shiftLatency: number
  contextChange: string
}

interface InhibitionEvent {
  timestamp: number
  avoided: boolean
  impulsiveMove: boolean
  consideredAlternatives: number
}

interface WorkingMemoryLoad {
  timestamp: number
  activeBoardsCount: number
  threatsTracked: number
  opportunitiesTracked: number
  overallLoad: number
}

interface SessionData {
  sessionStart: number
  currentDifficulty: number
  totalGames: number
  totalWins: number
  totalLosses: number
  totalDraws: number
  
  executiveFunction: {
    planningDepth: number
    strategicConsistency: number
    goalMaintenance: number
    averagePlanningTime: number
  }
  
  inhibitionControl: {
    totalInhibitionTests: number
    successfulInhibitions: number
    impulsiveActions: number
    inhibitionScore: number
  }
  
  cognitiveFlexibility: {
    strategyShifts: number
    averageShiftLatency: number
    adaptationEfficiency: number
    contextSwitchingSuccess: number
  }
  
  decisionMaking: {
    averageDecisionTime: number
    decisionQuality: number
    strategicMoveRatio: number
    offensiveDefensiveBalance: number
    errorRate: number
  }
  
  workingMemory: {
    averageMemoryLoad: number
    maxMemoryLoad: number
    memoryEfficiency: number
    trackingAccuracy: number
  }
  
  performance: {
    winRate: number
    avgMovesPerGame: number
    avgGameDuration: number
    difficultyProgression: number[]
  }
  
  detailedLogs: {
    games: GameResult[]
    moves: MoveLog[]
    hesitations: HesitationTime[]
    cognitiveShifts: CognitiveShift[]
    inhibitionEvents: InhibitionEvent[]
    workingMemorySnapshots: WorkingMemoryLoad[]
  }
}

export default function TicTacToeGame() {
  const router = useRouter()

  const [macroBoard, setMacroBoard] = useState<string[]>(Array(9).fill(''))
  const [localBoards, setLocalBoards] = useState<string[][]>(
    Array(9).fill(null).map(() => Array(9).fill(''))
  )
  const [activeBoard, setActiveBoard] = useState<number | null>(null)
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [difficulty, setDifficulty] = useState(1)
  const [currentGame, setCurrentGame] = useState(1)
  const [score, setScore] = useState({ wins: 0, losses: 0, draws: 0 })
  const [showInfoScreen, setShowInfoScreen] = useState(true)
  const [showMetrics, setShowMetrics] = useState(false)
  const [message, setMessage] = useState<string>('')

  // Firebase state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Cognitive tracking
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionStart: Date.now(),
    currentDifficulty: 1,
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
    executiveFunction: {
      planningDepth: 0,
      strategicConsistency: 0,
      goalMaintenance: 0,
      averagePlanningTime: 0
    },
    inhibitionControl: {
      totalInhibitionTests: 0,
      successfulInhibitions: 0,
      impulsiveActions: 0,
      inhibitionScore: 0
    },
    cognitiveFlexibility: {
      strategyShifts: 0,
      averageShiftLatency: 0,
      adaptationEfficiency: 0,
      contextSwitchingSuccess: 0
    },
    decisionMaking: {
      averageDecisionTime: 0,
      decisionQuality: 0,
      strategicMoveRatio: 0,
      offensiveDefensiveBalance: 0,
      errorRate: 0
    },
    workingMemory: {
      averageMemoryLoad: 0,
      maxMemoryLoad: 0,
      memoryEfficiency: 0,
      trackingAccuracy: 0
    },
    performance: {
      winRate: 0,
      avgMovesPerGame: 0,
      avgGameDuration: 0,
      difficultyProgression: []
    },
    detailedLogs: {
      games: [],
      moves: [],
      hesitations: [],
      cognitiveShifts: [],
      inhibitionEvents: [],
      workingMemorySnapshots: []
    }
  })

  const lastActionTime = useRef(Date.now())
  const gameStartTime = useRef(Date.now())
  const hesitationThreshold = 2000
  const lastStrategy = useRef<'offensive' | 'defensive' | 'neutral'>('neutral')
  const lastStrategyChangeTime = useRef(Date.now())

  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ]

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

  const loadUserStats = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid)
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          if (data.ultimateTicTacToe) {
            setUserStats(data.ultimateTicTacToe)
          }
        }
      })
      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  const saveSessionToFirebase = async () => {
    const hesitations = sessionData.detailedLogs.hesitations
    const moves = sessionData.detailedLogs.moves
    const games = sessionData.detailedLogs.games
    
    const finalData = {
      ...sessionData,
      executiveFunction: {
        ...sessionData.executiveFunction,
        averagePlanningTime: hesitations.length > 0
          ? hesitations.reduce((sum, h) => sum + h.duration, 0) / hesitations.length
          : 0,
        strategicConsistency: moves.length > 0
          ? (moves.filter(m => m.isStrategic).length / moves.length) * 100
          : 0
      },
      decisionMaking: {
        ...sessionData.decisionMaking,
        averageDecisionTime: moves.length > 0
          ? moves.reduce((sum, m) => sum + m.timeSinceLastMove, 0) / moves.length
          : 0,
        decisionQuality: moves.length > 0
          ? (moves.filter(m => m.isStrategic).length / moves.length) * 100
          : 0,
        strategicMoveRatio: moves.length > 0
          ? (moves.filter(m => m.isStrategic).length / moves.length)
          : 0,
        offensiveDefensiveBalance: moves.length > 0
          ? (moves.filter(m => m.moveType === 'offensive').length / 
             Math.max(moves.filter(m => m.moveType === 'defensive').length, 1))
          : 1
      },
      performance: {
        winRate: games.length > 0 ? (games.filter(g => g.outcome === 'win').length / games.length) * 100 : 0,
        avgMovesPerGame: games.length > 0
          ? games.reduce((sum, g) => sum + g.playerMoves, 0) / games.length
          : 0,
        avgGameDuration: games.length > 0
          ? games.reduce((sum, g) => sum + g.duration, 0) / games.length
          : 0,
        difficultyProgression: games.map(g => g.difficulty)
      }
    }

    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('ultimateTTTSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('ultimateTTTSessions', JSON.stringify(updatedSessions))
      setMessage('💾 Saved to local storage')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setIsLoading(true)

    try {
      const userDocRef = doc(db, 'users', userId)
      
      await setDoc(userDocRef, {
        ultimateTicTacToe: {
          totalGamesPlayed: (userStats?.totalGamesPlayed || 0) + games.length,
          totalWins: (userStats?.totalWins || 0) + games.filter(g => g.outcome === 'win').length,
          winRate: calculateRunningAverage(
            userStats?.winRate || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.performance.winRate
          ),
          averageDecisionTime: calculateRunningAverage(
            userStats?.averageDecisionTime || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.decisionMaking.averageDecisionTime
          ),
          strategicConsistency: calculateRunningAverage(
            userStats?.strategicConsistency || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.executiveFunction.strategicConsistency
          ),
          highestDifficulty: Math.max(userStats?.highestDifficulty || 0, difficulty),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), finalData].slice(-10),
          cognitiveProfile: {
            executiveFunction: finalData.executiveFunction.strategicConsistency,
            inhibitionControl: finalData.inhibitionControl.inhibitionScore,
            cognitiveFlexibility: finalData.cognitiveFlexibility.adaptationEfficiency,
            decisionQuality: finalData.decisionMaking.decisionQuality,
            workingMemory: finalData.workingMemory.memoryEfficiency
          }
        }
      }, { merge: true })

      await addDoc(collection(db, 'users', userId, 'ultimateTTTSessions'), {
        gameType: 'ultimateTicTacToe',
        ...finalData,
        createdAt: new Date()
      })

      console.log('🧠 Ultimate Tic-Tac-Toe session saved successfully')
      setMessage('✅ Session saved to cloud!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving session data:', error)
      const savedSessions = JSON.parse(localStorage.getItem('ultimateTTTSessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('ultimateTTTSessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isPlayerTurn && gameState === 'playing') {
      const timer = setTimeout(() => makeAIMove(), Math.max(800 - difficulty * 120, 200))
      return () => clearTimeout(timer)
    }
  }, [isPlayerTurn, gameState, difficulty])

  const checkWinner = (boardState: string[]): string | null => {
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
        return boardState[a]
      }
    }
    return boardState.includes('') ? null : 'draw'
  }

  const checkMacroWinner = (macro: string[]): 'X' | 'O' | 'draw' | null => {
    const sanitized = macro.map(v => (v === 'X' || v === 'O') ? v : '')
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      if (sanitized[a] && sanitized[a] === sanitized[b] && sanitized[a] === sanitized[c]) {
        return sanitized[a] as 'X' | 'O'
      }
    }
    const allClosed = macro.every(v => v !== '')
    return allClosed ? 'draw' : null
  }

  const getEmptyCells = (local: string[]): number[] =>
    local.map((v, i) => (v === '' ? i : -1)).filter(i => i !== -1)

  const analyzeMoveType = (cellIndex: number, local: string[]): 'offensive' | 'defensive' | 'neutral' => {
    const test = [...local]
    test[cellIndex] = 'X'
    if (checkWinner(test) === 'X') return 'offensive'
    
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [local[a], local[b], local[c]]
      if (values.filter(v => v === 'O').length === 2 && values.includes('')) {
        if (combo.includes(cellIndex)) return 'defensive'
      }
    }
    return 'neutral'
  }

  const isStrategicMove = (cellIndex: number, local: string[]): boolean => {
    if (cellIndex === 4) return true
    if ([0, 2, 6, 8].includes(cellIndex)) return true
    const t = analyzeMoveType(cellIndex, local)
    return t === 'offensive' || t === 'defensive'
  }

  const calculateMacroThreatLevel = (macro: string[]): number => {
    let threats = 0
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [macro[a], macro[b], macro[c]]
      if (values.filter(v => v === 'O').length === 2 && values.filter(v => v === '' || v === 'D').length === 1) {
        threats++
      }
    }
    return threats
  }

  const calculateWorkingMemoryLoad = (): WorkingMemoryLoad => {
    const activeBoardsCount = macroBoard.filter(m => m === '').length
    const threatsTracked = calculateMacroThreatLevel(macroBoard)
    let opportunitiesTracked = 0
    
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [macroBoard[a], macroBoard[b], macroBoard[c]]
      if (values.filter(v => v === 'X').length === 2 && values.filter(v => v === '' || v === 'D').length === 1) {
        opportunitiesTracked++
      }
    }
    
    const overallLoad = (activeBoardsCount * 0.3) + (threatsTracked * 2) + (opportunitiesTracked * 2)
    
    return {
      timestamp: Date.now(),
      activeBoardsCount,
      threatsTracked,
      opportunitiesTracked,
      overallLoad
    }
  }

  const getBestLocalMove = (local: string[], player: 'X' | 'O'): number | null => {
    const opponent = player === 'X' ? 'O' : 'X'
    
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [local[a], local[b], local[c]]
      if (values.filter(v => v === player).length === 2 && values.includes('')) {
        return combo[values.indexOf('')]
      }
    }
    
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [local[a], local[b], local[c]]
      if (values.filter(v => v === opponent).length === 2 && values.includes('')) {
        return combo[values.indexOf('')]
      }
    }
    
    if (local[4] === '') return 4
    
    const corners = [0, 2, 6, 8].filter(i => local[i] === '')
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)]
    
    const empties = getEmptyCells(local)
    return empties.length ? empties[Math.floor(Math.random() * empties.length)] : null
  }

  const isBoardPlayable = (boardIndex: number): boolean =>
    macroBoard[boardIndex] === '' && localBoards[boardIndex].some(c => c === '')

  const handleSquareClick = (boardIndex: number, cellIndex: number) => {
    if (!isPlayerTurn || gameState !== 'playing') return
    if (localBoards[boardIndex][cellIndex] !== '') return
    if (activeBoard !== null && activeBoard !== boardIndex) return

    const now = Date.now()
    const timeSinceLastMove = now - lastActionTime.current
    
    // Track hesitation
    if (timeSinceLastMove > hesitationThreshold) {
      const memoryLoad = calculateWorkingMemoryLoad()
      setSessionData(prev => ({
        ...prev,
        detailedLogs: {
          ...prev.detailedLogs,
          hesitations: [...prev.detailedLogs.hesitations, {
            duration: timeSinceLastMove,
            timestamp: now,
            moveNumber: prev.detailedLogs.moves.filter(m => m.player === 'X').length + 1,
            complexity: memoryLoad.overallLoad
          }]
        }
      }))
    }

    // Track inhibition (quick vs deliberate)
    const isImpulsive = timeSinceLastMove < 1000
    const inhibitionEvent: InhibitionEvent = {
      timestamp: now,
      avoided: !isImpulsive,
      impulsiveMove: isImpulsive,
      consideredAlternatives: Math.floor(timeSinceLastMove / 500)
    }

    setSessionData(prev => ({
      ...prev,
      inhibitionControl: {
        ...prev.inhibitionControl,
        totalInhibitionTests: prev.inhibitionControl.totalInhibitionTests + 1,
        successfulInhibitions: prev.inhibitionControl.successfulInhibitions + (inhibitionEvent.avoided ? 1 : 0),
        impulsiveActions: prev.inhibitionControl.impulsiveActions + (inhibitionEvent.impulsiveMove ? 1 : 0),
        inhibitionScore: prev.inhibitionControl.totalInhibitionTests === 0 ? 100 :
          ((prev.inhibitionControl.successfulInhibitions + (inhibitionEvent.avoided ? 1 : 0)) / 
           (prev.inhibitionControl.totalInhibitionTests + 1)) * 100
      },
      detailedLogs: {
        ...prev.detailedLogs,
        inhibitionEvents: [...prev.detailedLogs.inhibitionEvents, inhibitionEvent]
      }
    }))

    // Place X
    const updatedLocals = [...localBoards]
    updatedLocals[boardIndex] = [...updatedLocals[boardIndex]]
    updatedLocals[boardIndex][cellIndex] = 'X'

    const localResult = checkWinner(updatedLocals[boardIndex])
    let updatedMacro = [...macroBoard]
    if (localResult === 'X') {
      updatedMacro[boardIndex] = 'X'
    } else if (localResult === 'O') {
      updatedMacro[boardIndex] = 'O'
    } else if (localResult === 'draw') {
      updatedMacro[boardIndex] = 'D'
    }

    // Analyze move
    const moveType = analyzeMoveType(cellIndex, localBoards[boardIndex])
    const strategic = isStrategicMove(cellIndex, localBoards[boardIndex])
    const macroThreat = calculateMacroThreatLevel(updatedMacro)
    const availableBoards = updatedMacro.filter(m => m === '').length
    
    // Track cognitive shift
    if (moveType !== lastStrategy.current) {
      const shift: CognitiveShift = {
        timestamp: now,
        fromStrategy: lastStrategy.current,
        toStrategy: moveType,
        shiftLatency: now - lastStrategyChangeTime.current,
        contextChange: `Macro threat level: ${macroThreat}`
      }
      
      setSessionData(prev => ({
        ...prev,
        cognitiveFlexibility: {
          ...prev.cognitiveFlexibility,
          strategyShifts: prev.cognitiveFlexibility.strategyShifts + 1
        },
        detailedLogs: {
          ...prev.detailedLogs,
          cognitiveShifts: [...prev.detailedLogs.cognitiveShifts, shift]
        }
      }))
      
      lastStrategy.current = moveType
      lastStrategyChangeTime.current = now
    }

    // Track working memory
    const memorySnapshot = calculateWorkingMemoryLoad()
    setSessionData(prev => ({
      ...prev,
      workingMemory: {
        ...prev.workingMemory,
        maxMemoryLoad: Math.max(prev.workingMemory.maxMemoryLoad, memorySnapshot.overallLoad)
      },
      detailedLogs: {
        ...prev.detailedLogs,
        workingMemorySnapshots: [...prev.detailedLogs.workingMemorySnapshots, memorySnapshot]
      }
    }))

    // Log move
    const moveLog: MoveLog = {
      position: boardIndex * 9 + cellIndex,
      player: 'X',
      timestamp: now,
      timeSinceLastMove,
      moveNumber: sessionData.detailedLogs.moves.filter(m => m.player === 'X').length + 1,
      gameState: updatedMacro,
      isStrategic: strategic,
      moveType,
      boardContext: {
        activeBoardIndex: activeBoard,
        availableBoards,
        macroThreatLevel: macroThreat
      }
    }

    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        moves: [...prev.detailedLogs.moves, moveLog]
      }
    }))

    setLocalBoards(updatedLocals)
    setMacroBoard(updatedMacro)

    const macroResult = checkMacroWinner(updatedMacro)
    if (macroResult) {
      if (macroResult === 'X') handleGameEnd('X', updatedMacro)
      else if (macroResult === 'O') handleGameEnd('O', updatedMacro)
      else handleGameEnd(null, updatedMacro)
      lastActionTime.current = now
      return
    }

    const nextTarget = isBoardPlayable(cellIndex) ? cellIndex : null
    setActiveBoard(nextTarget)
    setIsPlayerTurn(false)
    lastActionTime.current = now
  }

  const makeAIMove = () => {
    if (gameState !== 'playing') return

    let targetBoard = activeBoard
    if (targetBoard === null || !isBoardPlayable(targetBoard)) {
      const candidates = [...Array(9).keys()].filter(i => isBoardPlayable(i))
      if (candidates.length === 0) return
      targetBoard = candidates[Math.floor(Math.random() * candidates.length)]
    }

    const local = [...localBoards[targetBoard]]
    const intelligence = Math.min(0.2 + difficulty * 0.2, 1)
    let move: number | null
    if (Math.random() < intelligence) {
      move = getBestLocalMove(local, 'O')
    } else {
      const empties = getEmptyCells(local)
      move = empties.length ? empties[Math.floor(Math.random() * empties.length)] : null
    }
    if (move === null) {
      const fallbacks = [...Array(9).keys()].filter(i => isBoardPlayable(i))
      if (!fallbacks.length) return
      const fb = fallbacks[Math.floor(Math.random() * fallbacks.length)]
      const emptyCells = getEmptyCells(localBoards[fb])
      if (!emptyCells.length) return
      targetBoard = fb
      move = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    }

    const updatedLocals = [...localBoards]
    updatedLocals[targetBoard] = [...updatedLocals[targetBoard]]
    updatedLocals[targetBoard][move] = 'O'

    const localResult = checkWinner(updatedLocals[targetBoard])
    let updatedMacro = [...macroBoard]
    if (localResult === 'X') {
      updatedMacro[targetBoard] = 'X'
    } else if (localResult === 'O') {
      updatedMacro[targetBoard] = 'O'
    } else if (localResult === 'draw') {
      updatedMacro[targetBoard] = 'D'
    }

    const now = Date.now()
    const aiLog: MoveLog = {
      position: targetBoard * 9 + move,
      player: 'O',
      timestamp: now,
      timeSinceLastMove: now - lastActionTime.current,
      moveNumber: sessionData.detailedLogs.moves.length + 1,
      gameState: updatedMacro,
      isStrategic: false,
      moveType: 'neutral',
      boardContext: {
        activeBoardIndex: activeBoard,
        availableBoards: updatedMacro.filter(m => m === '').length,
        macroThreatLevel: calculateMacroThreatLevel(updatedMacro)
      }
    }

    setSessionData(prev => ({
      ...prev,
      detailedLogs: {
        ...prev.detailedLogs,
        moves: [...prev.detailedLogs.moves, aiLog]
      }
    }))

    setLocalBoards(updatedLocals)
    setMacroBoard(updatedMacro)

    const macroResult = checkMacroWinner(updatedMacro)
    if (macroResult) {
      if (macroResult === 'X') handleGameEnd('X', updatedMacro)
      else if (macroResult === 'O') handleGameEnd('O', updatedMacro)
      else handleGameEnd(null, updatedMacro)
      return
    }

    const nextTarget = isBoardPlayable(move) ? move : null
    setActiveBoard(nextTarget)
    setIsPlayerTurn(true)
    lastActionTime.current = now
  }

  const handleGameEnd = (winner: 'X' | 'O' | null, finalMacro: string[]) => {
    const now = Date.now()
    const gameDuration = now - gameStartTime.current
    const playerMoves = sessionData.detailedLogs.moves.filter(m => m.player === 'X').length + (winner === 'X' ? 1 : 0)
    const strategicMoves = sessionData.detailedLogs.moves.filter(m => m.player === 'X' && m.isStrategic).length
    const defensiveMoves = sessionData.detailedLogs.moves.filter(m => m.player === 'X' && m.moveType === 'defensive').length
    const offensiveMoves = sessionData.detailedLogs.moves.filter(m => m.player === 'X' && m.moveType === 'offensive').length

    let outcome: 'win' | 'loss' | 'draw'
    if (winner === 'X') {
      outcome = 'win'
      setScore(prev => ({ ...prev, wins: prev.wins + 1 }))
      setGameState('won')
      if (currentGame % 3 === 0 && difficulty < 10) {
        setDifficulty(prev => prev + 1)
      }
    } else if (winner === 'O') {
      outcome = 'loss'
      setScore(prev => ({ ...prev, losses: prev.losses + 1 }))
      setGameState('lost')
    } else {
      outcome = 'draw'
      setScore(prev => ({ ...prev, draws: prev.draws + 1 }))
      setGameState('draw')
    }

    const adaptiveScore = (strategicMoves / Math.max(playerMoves, 1)) * 100

    const gameResult: GameResult = {
      gameNumber: currentGame,
      outcome,
      totalMoves: sessionData.detailedLogs.moves.length + 1,
      duration: gameDuration,
      difficulty,
      playerMoves,
      strategicMoves,
      defensiveMoves,
      offensiveMoves,
      adaptiveScore
    }

    setSessionData(prev => ({
      ...prev,
      totalGames: prev.totalGames + 1,
      totalWins: prev.totalWins + (outcome === 'win' ? 1 : 0),
      totalLosses: prev.totalLosses + (outcome === 'loss' ? 1 : 0),
      totalDraws: prev.totalDraws + (outcome === 'draw' ? 1 : 0),
      detailedLogs: {
        ...prev.detailedLogs,
        games: [...prev.detailedLogs.games, gameResult]
      }
    }))

    // Auto-save after each game
    setTimeout(() => {
      saveSessionToFirebase()
    }, 500)

    setTimeout(() => {
      startNewGame()
    }, 2000)
  }

  const startNewGame = () => {
    setMacroBoard(Array(9).fill(''))
    setLocalBoards(Array(9).fill(null).map(() => Array(9).fill('')))
    setActiveBoard(null)
    setIsPlayerTurn(true)
    setGameState('playing')
    setCurrentGame(prev => prev + 1)
    gameStartTime.current = Date.now()
    lastActionTime.current = Date.now()
    lastStrategy.current = 'neutral'
  }

  const handleReturnToGameSelection = () => {
    // Save before leaving
    if (sessionData.detailedLogs.games.length > 0) {
      saveSessionToFirebase()
    }
    router.push('/Prep/PrepGames/GameSelection')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 text-gray-900 flex flex-col items-center justify-center p-6">
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          💾 Saving...
        </div>
      )}

      {message && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {message}
        </div>
      )}

      <AnimatePresence>
        {showInfoScreen && (
          <motion.div
            key="info-screen"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="bg-white rounded-3xl shadow-2xl max-w-md mx-4 p-8 text-center relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="text-3xl font-extrabold text-indigo-700 mb-6">
                Ultimate Tic-Tac-Toe 🎯
              </h2>

              <div className="text-gray-800 text-lg leading-relaxed text-center px-2 md:px-6 mb-6">
                <p className="font-medium mb-4">
                  Play smart – every move you make decides where your opponent must play next.
                  Win three small boards in a row to take the game!
                </p>
                <p className="text-sm text-purple-600">
                  🧠 Cognitive tracking enabled: Your strategic thinking, planning, and decision-making are being measured!
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowInfoScreen(false)}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full font-semibold shadow-lg transition-all"
              >
                Ready to Play
              </motion.button>

              <motion.p
                className="text-xs text-gray-500 mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Tip: The blue border shows which local board is active.
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!showInfoScreen && (
          <motion.div
            key="game-ui"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-full flex flex-col items-center"
          >
            <div className="text-center mb-8">
              <h1 className="text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Ultimate Tic-Tac-Toe 🎯
              </h1>
              <div className="flex items-center justify-center gap-4 mb-4">
                <span className="text-lg font-semibold text-indigo-700">Game {currentGame}</span>
                <span className="text-lg font-semibold text-purple-700">Difficulty: {difficulty}</span>
                {activeBoard === null
                  ? <span className="text-sm bg-blue-200 px-3 py-1 rounded-full">Any board playable</span>
                  : <span className="text-sm bg-blue-200 px-3 py-1 rounded-full">Play in board #{activeBoard + 1}</span>
                }
              </div>
              <div className="flex gap-6 justify-center text-sm text-gray-600 flex-wrap">
                <span className="bg-green-200 px-3 py-1 rounded-full">Wins: {score.wins}</span>
                <span className="bg-red-200 px-3 py-1 rounded-full">Losses: {score.losses}</span>
                <span className="bg-yellow-200 px-3 py-1 rounded-full">Draws: {score.draws}</span>
                <span className="bg-purple-200 px-3 py-1 rounded-full">Strategic: {sessionData.detailedLogs.moves.filter(m => m.isStrategic).length}</span>
                {userId && userStats && (
                  <span className="bg-indigo-200 px-3 py-1 rounded-full">✅ Synced</span>
                )}
              </div>
            </div>

            <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-3xl p-4 md:p-6 shadow-xl mb-8">
              <div className="grid grid-cols-3 gap-3 md:gap-4 w-[90vw] max-w-[760px]">
                {localBoards.map((local, boardIndex) => {
                  const isActive = activeBoard === null || activeBoard === boardIndex
                  const macroMark = macroBoard[boardIndex]
                  return (
                    <div
                      key={boardIndex}
                      className={[
                        'grid grid-cols-3 gap-1 p-2 rounded-xl border-4 transition-all duration-200',
                        isActive && macroMark === ''
                          ? 'border-blue-600 ring-4 ring-blue-400/40 shadow-xl bg-blue-50'
                          : 'border-gray-300 opacity-90',
                        macroMark === 'X' ? 'bg-blue-200' : '',
                        macroMark === 'O' ? 'bg-red-200' : '',
                        macroMark === 'D' ? 'bg-gray-200' : ''
                      ].join(' ')}
                    >
                      {local.map((cell, cellIndex) => (
                        <button
                          key={cellIndex}
                          onClick={() => handleSquareClick(boardIndex, cellIndex)}
                          className={[
                            'aspect-square bg-white rounded-lg text-2xl md:text-3xl font-bold flex items-center justify-center',
                            'hover:bg-blue-50 transition-all active:scale-95 border',
                            cell === 'X' ? 'text-blue-600 border-blue-300' :
                            cell === 'O' ? 'text-red-600 border-red-300' : 'border-gray-200'
                          ].join(' ')}
                          disabled={
                            !isPlayerTurn ||
                            gameState !== 'playing' ||
                            (activeBoard !== null && activeBoard !== boardIndex) ||
                            cell !== '' ||
                            macroMark !== ''
                          }
                          aria-label={`Board ${boardIndex + 1}, Cell ${cellIndex + 1}`}
                        >
                          {cell}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>

              {gameState !== 'playing' && (
                <div className={`mt-6 text-center text-2xl font-bold ${
                  gameState === 'won' ? 'text-green-600' :
                  gameState === 'lost' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {gameState === 'won' ? '🎉 You Won!' :
                   gameState === 'lost' ? '😔 AI Won' :
                   '🤝 Draw'}
                </div>
              )}
            </div>

            <div className="flex gap-4 flex-wrap justify-center mb-6">
              <button
                onClick={startNewGame}
                className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white rounded-full font-semibold shadow-lg transition-all"
              >
                🔄 New Game
              </button>

              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105 transition-transform text-white rounded-full font-semibold shadow-lg"
              >
                <Brain className="w-5 h-5" />
                {showMetrics ? 'Hide' : 'Show'} Metrics
              </button>

              <button
                onClick={saveSessionToFirebase}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-105 transition-transform text-white rounded-full font-semibold shadow-lg disabled:opacity-50"
              >
                <TrendingUp className="w-5 h-5" />
                {isLoading ? 'Saving...' : 'Save Session'}
              </button>

              <button
                onClick={handleReturnToGameSelection}
                className="px-6 py-3 bg-gray-600/80 hover:bg-gray-600 text-white rounded-full font-semibold shadow-lg transition-all"
              >
                🏠 Return to Games
              </button>

              <button
                onClick={() => setShowInfoScreen(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-purple-500 hover:to-pink-500 text-white rounded-full font-semibold shadow-lg transition-all"
              >
                ❓ How to Play
              </button>
            </div>

            {showMetrics && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-6xl bg-white/60 backdrop-blur-sm border border-indigo-300 rounded-3xl p-6 mb-6"
              >
                <h3 className="text-2xl font-bold text-indigo-700 mb-4 text-center">🧠 Executive Function Metrics</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/50 rounded-xl p-4">
                    <h4 className="font-bold text-blue-600 mb-2">🎯 Executive Function</h4>
                    <div className="text-gray-800">Planning Time: {sessionData.detailedLogs.hesitations.length > 0
                      ? Math.round(sessionData.detailedLogs.hesitations.reduce((s, h) => s + h.duration, 0) / sessionData.detailedLogs.hesitations.length)
                      : 0}ms</div>
                    <div className="text-gray-700">Strategic Moves: {sessionData.detailedLogs.moves.filter(m => m.isStrategic).length}</div>
                    <div className="text-gray-700">
                      Consistency: {sessionData.detailedLogs.moves.length > 0
                        ? Math.round((sessionData.detailedLogs.moves.filter(m => m.isStrategic).length / sessionData.detailedLogs.moves.length) * 100)
                        : 0}%
                    </div>
                  </div>

                  <div className="bg-white/50 rounded-xl p-4">
                    <h4 className="font-bold text-purple-600 mb-2">🛡️ Inhibition Control</h4>
                    <div className="text-gray-800">Tests: {sessionData.inhibitionControl.totalInhibitionTests}</div>
                    <div className="text-green-600">Successful: {sessionData.inhibitionControl.successfulInhibitions}</div>
                    <div className="text-red-600">Impulsive: {sessionData.inhibitionControl.impulsiveActions}</div>
                    <div className="text-gray-700">Score: {Math.round(sessionData.inhibitionControl.inhibitionScore)}%</div>
                  </div>

                  <div className="bg-white/50 rounded-xl p-4">
                    <h4 className="font-bold text-green-600 mb-2">🔄 Cognitive Flexibility</h4>
                    <div className="text-gray-800">Strategy Shifts: {sessionData.cognitiveFlexibility.strategyShifts}</div>
                    <div className="text-gray-700">
                      Avg Shift Time: {sessionData.detailedLogs.cognitiveShifts.length > 0
                        ? Math.round(sessionData.detailedLogs.cognitiveShifts.reduce((s, c) => s + c.shiftLatency, 0) / sessionData.detailedLogs.cognitiveShifts.length)
                        : 0}ms
                    </div>
                    <div className="text-gray-700">Adaptations: {sessionData.detailedLogs.cognitiveShifts.length}</div>
                  </div>

                  <div className="bg-white/50 rounded-xl p-4">
                    <h4 className="font-bold text-orange-600 mb-2">🎲 Decision Making</h4>
                    <div className="text-gray-800">
                      Avg Decision: {sessionData.detailedLogs.moves.length > 0
                        ? Math.round(sessionData.detailedLogs.moves.reduce((s, m) => s + m.timeSinceLastMove, 0) / sessionData.detailedLogs.moves.length)
                        : 0}ms
                    </div>
                    <div className="text-gray-700">
                      Quality: {sessionData.detailedLogs.moves.length > 0
                        ? Math.round((sessionData.detailedLogs.moves.filter(m => m.isStrategic).length / sessionData.detailedLogs.moves.length) * 100)
                        : 0}%
                    </div>
                    <div className="text-gray-700">
                      O/D Balance: {sessionData.detailedLogs.moves.filter(m => m.moveType === 'offensive').length}/
                      {sessionData.detailedLogs.moves.filter(m => m.moveType === 'defensive').length}
                    </div>
                  </div>

                  <div className="bg-white/50 rounded-xl p-4">
                    <h4 className="font-bold text-pink-600 mb-2">🧮 Working Memory</h4>
                    <div className="text-gray-800">
                      Max Load: {sessionData.workingMemory.maxMemoryLoad.toFixed(1)}
                    </div>
                    <div className="text-gray-700">
                      Avg Load: {sessionData.detailedLogs.workingMemorySnapshots.length > 0
                        ? (sessionData.detailedLogs.workingMemorySnapshots.reduce((s, w) => s + w.overallLoad, 0) / sessionData.detailedLogs.workingMemorySnapshots.length).toFixed(1)
                        : 0}
                    </div>
                    <div className="text-gray-700">Snapshots: {sessionData.detailedLogs.workingMemorySnapshots.length}</div>
                  </div>

                  <div className="bg-white/50 rounded-xl p-4">
                    <h4 className="font-bold text-indigo-600 mb-2">📊 Performance</h4>
                    <div className="text-gray-800">Games: {sessionData.detailedLogs.games.length}</div>
                    <div className="text-green-600">
                      Win Rate: {sessionData.detailedLogs.games.length > 0
                        ? Math.round((sessionData.detailedLogs.games.filter(g => g.outcome === 'win').length / sessionData.detailedLogs.games.length) * 100)
                        : 0}%
                    </div>
                    <div className="text-gray-700">Current Difficulty: {difficulty}</div>
                  </div>

                  {userId && userStats && (
                    <div className="bg-white/50 rounded-xl p-4 md:col-span-2 lg:col-span-1">
                      <h4 className="font-bold text-teal-600 mb-2">👤 User Progress</h4>
                      <div className="text-gray-800">Total Games: {userStats.totalGamesPlayed || 0}</div>
                      <div className="text-green-600">Total Wins: {userStats.totalWins || 0}</div>
                      <div className="text-gray-700">Win Rate: {Math.round(userStats.winRate || 0)}%</div>
                      <div className="text-gray-700">Best Difficulty: {userStats.highestDifficulty || 0}</div>
                      <div className="text-green-400 text-xs mt-1">✅ Synced</div>
                    </div>
                  )}
                </div>

                {userId && userStats && (
                  <div className="mt-4 p-4 bg-white/50 rounded-xl">
                    <h4 className="font-semibold text-indigo-600 mb-2 text-center">🏆 Personal Best</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="text-center">
                        <div className="font-bold text-lg text-gray-800">{userStats.totalGamesPlayed || 0}</div>
                        <div className="text-gray-600">Games Played</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-gray-800">{Math.round(userStats.winRate || 0)}%</div>
                        <div className="text-gray-600">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-gray-800">{Math.round(userStats.strategicConsistency || 0)}%</div>
                        <div className="text-gray-600">Strategic</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-lg text-gray-800">{userStats.highestDifficulty || 0}</div>
                        <div className="text-gray-600">Max Difficulty</div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}