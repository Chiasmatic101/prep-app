"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Zap, RefreshCcw, Cpu, Brain, TrendingUp } from "lucide-react"
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const initialBoard = Array(9).fill(null)
const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

const adjacency: Record<number, number[]> = {
  0: [1, 3, 4],
  1: [0, 2, 4],
  2: [1, 4, 5],
  3: [0, 4, 6],
  4: [0, 1, 2, 3, 5, 6, 7, 8],
  5: [2, 4, 8],
  6: [3, 4, 7],
  7: [4, 6, 8],
  8: [4, 5, 7],
}

interface MoveData {
  timestamp: number
  player: 'X' | 'O'
  position: number
  fromPosition?: number
  moveNumber: number
  timeSinceLastMove: number
  boardState: (string | null)[]
  phase: 'placement' | 'movement'
  wasWinningMove: boolean
  wasBlockingMove: boolean
  strategicValue: number
}

interface DecisionTime {
  timestamp: number
  duration: number
  moveNumber: number
  phase: 'placement' | 'movement'
  complexity: number
  pressureLevel: number
}

interface StrategicPattern {
  timestamp: number
  patternType: 'offensive' | 'defensive' | 'setup' | 'tactical' | 'forced'
  position: number
  fromPosition?: number
  reasoning: string
  aiResponse?: string
}

interface AIEncounter {
  timestamp: number
  aiMovePosition: number
  playerResponse?: number
  responseTime?: number
  playerBlocked: boolean
  aiBlocked: boolean
  advantageGained: 'player' | 'ai' | 'neutral'
}

interface GameResult {
  outcome: 'win' | 'loss' | 'draw'
  finalBoard: (string | null)[]
  totalMoves: number
  gameDuration: number
  placementMoves: number
  movementMoves: number
  playerAdvantageScore: number
}

interface SessionData {
  sessionStart: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  
  cognitiveMetrics: {
    averageDecisionTime: number
    placementDecisionTime: number
    movementDecisionTime: number
    fastestDecision: number
    slowestDecision: number
    decisionTimeProgression: number[]
  }
  
  strategicAnalysis: {
    offensiveMoves: number
    defensiveMoves: number
    setupMoves: number
    tacticalMoves: number
    forcedMoves: number
    winningMoveAccuracy: number
    blockingEfficiency: number
  }
  
  aiPerformance: {
    playerBlockedAI: number
    aiBlockedPlayer: number
    advantageGained: number
    advantageLost: number
    aiPressureHandling: number
  }
  
  detailedLogs: {
    moves: MoveData[]
    decisionTimes: DecisionTime[]
    strategicPatterns: StrategicPattern[]
    aiEncounters: AIEncounter[]
    gameResults: GameResult[]
  }
}

export default function NeonMillsGame() {
  const [board, setBoard] = useState<(string | null)[]>(initialBoard)
  const [turn, setTurn] = useState<"X" | "O">("X")
  const [phase, setPhase] = useState<"placement" | "movement">("placement")
  const [selected, setSelected] = useState<number | null>(null)
  const [placed, setPlaced] = useState({ X: 0, O: 0 })
  const [winner, setWinner] = useState<string | null>(null)
  const [aiEnabled] = useState(true)
  const [gameStarted, setGameStarted] = useState(false)
  const [moveCount, setMoveCount] = useState(0)
  const [showMetrics, setShowMetrics] = useState(false)
  const [message, setMessage] = useState<string>('')

  // Firebase state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')

  // Cognitive tracking state
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionStart: Date.now(),
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    cognitiveMetrics: {
      averageDecisionTime: 0,
      placementDecisionTime: 0,
      movementDecisionTime: 0,
      fastestDecision: 0,
      slowestDecision: 0,
      decisionTimeProgression: []
    },
    strategicAnalysis: {
      offensiveMoves: 0,
      defensiveMoves: 0,
      setupMoves: 0,
      tacticalMoves: 0,
      forcedMoves: 0,
      winningMoveAccuracy: 0,
      blockingEfficiency: 0
    },
    aiPerformance: {
      playerBlockedAI: 0,
      aiBlockedPlayer: 0,
      advantageGained: 0,
      advantageLost: 0,
      aiPressureHandling: 0
    },
    detailedLogs: {
      moves: [],
      decisionTimes: [],
      strategicPatterns: [],
      aiEncounters: [],
      gameResults: []
    }
  })

  // Timing refs
  const gameStartTime = useRef<number>(0)
  const lastMoveTime = useRef<number>(0)
  const moveStartTime = useRef<number>(0)
  const lastAIMove = useRef<{position: number, timestamp: number} | null>(null)

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

  const loadUserStats = async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid)
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          if (data.neonMillsAI) {
            setUserStats(data.neonMillsAI)
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
    const decisionTimes = sessionData.detailedLogs.decisionTimes.map(d => d.duration)
    const placementTimes = sessionData.detailedLogs.decisionTimes
      .filter(d => d.phase === 'placement')
      .map(d => d.duration)
    const movementTimes = sessionData.detailedLogs.decisionTimes
      .filter(d => d.phase === 'movement')
      .map(d => d.duration)
    
    const finalData = {
      ...sessionData,
      cognitiveMetrics: {
        averageDecisionTime: decisionTimes.length > 0 
          ? decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length 
          : 0,
        placementDecisionTime: placementTimes.length > 0
          ? placementTimes.reduce((a, b) => a + b, 0) / placementTimes.length
          : 0,
        movementDecisionTime: movementTimes.length > 0
          ? movementTimes.reduce((a, b) => a + b, 0) / movementTimes.length
          : 0,
        fastestDecision: decisionTimes.length > 0 ? Math.min(...decisionTimes) : 0,
        slowestDecision: decisionTimes.length > 0 ? Math.max(...decisionTimes) : 0,
        decisionTimeProgression: decisionTimes
      }
    }

    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('neonMillsAISessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('neonMillsAISessions', JSON.stringify(updatedSessions))
      setMessage('💾 Saved to local storage')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      const userDocRef = doc(db, 'users', userId)
      
      await setDoc(userDocRef, {
        neonMillsAI: {
          totalGamesPlayed: (userStats?.totalGamesPlayed || 0) + sessionData.gamesPlayed,
          totalWins: (userStats?.totalWins || 0) + sessionData.wins,
          totalLosses: (userStats?.totalLosses || 0) + sessionData.losses,
          totalDraws: (userStats?.totalDraws || 0) + sessionData.draws,
          winRate: ((userStats?.totalWins || 0) + sessionData.wins) / 
                   Math.max(((userStats?.totalGamesPlayed || 0) + sessionData.gamesPlayed), 1) * 100,
          averageDecisionTime: calculateRunningAverage(
            userStats?.averageDecisionTime || 0,
            userStats?.totalGamesPlayed || 0,
            finalData.cognitiveMetrics.averageDecisionTime
          ),
          blockingEfficiency: calculateRunningAverage(
            userStats?.blockingEfficiency || 0,
            userStats?.totalGamesPlayed || 0,
            sessionData.aiPerformance.playerBlockedAI
          ),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), finalData].slice(-10),
          cognitiveProfile: {
            decisionSpeed: finalData.cognitiveMetrics.averageDecisionTime,
            placementSpeed: finalData.cognitiveMetrics.placementDecisionTime,
            movementSpeed: finalData.cognitiveMetrics.movementDecisionTime,
            aiAdaptation: sessionData.aiPerformance.advantageGained - sessionData.aiPerformance.advantageLost
          }
        }
      }, { merge: true })

      await addDoc(collection(db, 'users', userId, 'neonMillsAISessions'), {
        gameType: 'neonMillsAI',
        ...finalData,
        createdAt: new Date()
      })

      console.log('🧠 Neon Mills AI session saved successfully')
      setMessage('✅ Session saved to cloud!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error saving session data:', error)
      setSaveError('Failed to save session data.')
      
      const savedSessions = JSON.parse(localStorage.getItem('neonMillsAISessions') || '[]')
      const updatedSessions = [...savedSessions, finalData].slice(-10)
      localStorage.setItem('neonMillsAISessions', JSON.stringify(updatedSessions))
    } finally {
      setIsLoading(false)
    }
  }

  const checkWin = (b: (string | null)[]) => {
    for (let [a, bb, c] of lines) {
      if (b[a] && b[a] === b[bb] && b[a] === b[c]) return b[a]
    }
    return null
  }

  const getEmptyIndices = (b: (string | null)[]) =>
    b.map((v, i) => (v ? null : i)).filter((v) => v !== null) as number[]

  const analyzeMove = (
    position: number, 
    player: 'X' | 'O', 
    currentBoard: (string | null)[],
    fromPosition?: number
  ): StrategicPattern => {
    const testBoard = [...currentBoard]
    if (fromPosition !== undefined) {
      testBoard[fromPosition] = null
    }
    testBoard[position] = player
    
    const wouldWin = checkWin(testBoard)
    if (wouldWin === player) {
      return {
        timestamp: Date.now(),
        patternType: 'offensive',
        position,
        fromPosition,
        reasoning: 'winning_move'
      }
    }
    
    const opponent = player === 'X' ? 'O' : 'X'
    
    // Check blocking
    if (phase === 'placement') {
      for (let i = 0; i < 9; i++) {
        if (!currentBoard[i]) {
          const blockTest = [...currentBoard]
          blockTest[i] = opponent
          if (checkWin(blockTest) === opponent && i === position) {
            return {
              timestamp: Date.now(),
              patternType: 'defensive',
              position,
              fromPosition,
              reasoning: 'blocking_opponent_win'
            }
          }
        }
      }
    } else {
      // Movement phase blocking
      const opponentPieces = currentBoard
        .map((v, i) => v === opponent ? i : null)
        .filter(v => v !== null) as number[]
      
      for (let opFrom of opponentPieces) {
        for (let opTo of adjacency[opFrom]) {
          if (currentBoard[opTo]) continue
          const blockTest = [...currentBoard]
          blockTest[opFrom] = null
          blockTest[opTo] = opponent
          if (checkWin(blockTest) === opponent && opTo === position) {
            return {
              timestamp: Date.now(),
              patternType: 'defensive',
              position,
              fromPosition,
              reasoning: 'blocking_opponent_movement'
            }
          }
        }
      }
    }
    
    // Check setup (two-in-a-row)
    for (let line of lines) {
      const values = line.map(i => testBoard[i])
      const playerCount = values.filter(v => v === player).length
      const emptyCount = values.filter(v => v === null).length
      
      if (playerCount === 2 && emptyCount === 1) {
        return {
          timestamp: Date.now(),
          patternType: 'setup',
          position,
          fromPosition,
          reasoning: 'creating_winning_threat'
        }
      }
    }
    
    // Check if move is forced (limited options)
    if (phase === 'movement' && fromPosition !== undefined) {
      const availableMoves = adjacency[fromPosition].filter(n => !currentBoard[n])
      if (availableMoves.length <= 2) {
        return {
          timestamp: Date.now(),
          patternType: 'forced',
          position,
          fromPosition,
          reasoning: 'limited_options'
        }
      }
    }
    
    return {
      timestamp: Date.now(),
      patternType: 'tactical',
      position,
      fromPosition,
      reasoning: 'strategic_positioning'
    }
  }

  const calculateMoveValue = (position: number, currentBoard: (string | null)[]): number => {
    let value = 0
    
    // Center is most valuable
    if (position === 4) value += 3
    
    // Corners are moderately valuable
    if ([0, 2, 6, 8].includes(position)) value += 2
    
    // Count potential lines through this position
    for (let line of lines) {
      if (line.includes(position)) {
        const lineValues = line.map(i => currentBoard[i])
        const xCount = lineValues.filter(v => v === 'X').length
        const oCount = lineValues.filter(v => v === 'O').length
        
        if (xCount === 0 && oCount === 0) value += 1
        if (xCount === 1 && oCount === 0) value += 2
        if (xCount === 0 && oCount === 1) value -= 1
      }
    }
    
    return value
  }

  const handleCellClick = (index: number) => {
    if (winner || turn === "O" || !gameStarted) return
    playerMove(index)
  }

  const playerMove = (index: number) => {
    const now = Date.now()
    const timeSinceLastMove = lastMoveTime.current ? now - lastMoveTime.current : 0
    const decisionTime = moveStartTime.current ? now - moveStartTime.current : 0
    
    const newBoard = [...board]
    let fromPos: number | undefined = undefined
    
    if (phase === "placement") {
      if (newBoard[index]) return
      newBoard[index] = "X"
      const newPlaced = { ...placed, X: placed.X + 1 }
      
      // Analyze move
      const pattern = analyzeMove(index, 'X', board)
      const moveValue = calculateMoveValue(index, board)
      
      const isWinningMove = checkWin(newBoard) === 'X'
      
      // Check if blocking AI
      let wasBlocking = false
      for (let i = 0; i < 9; i++) {
        if (!board[i]) {
          const testBoard = [...board]
          testBoard[i] = 'O'
          if (checkWin(testBoard) === 'O' && i === index) {
            wasBlocking = true
            break
          }
        }
      }
      
      // Log move data
      const moveData: MoveData = {
        timestamp: now,
        player: 'X',
        position: index,
        moveNumber: moveCount + 1,
        timeSinceLastMove,
        boardState: [...board],
        phase: 'placement',
        wasWinningMove: isWinningMove,
        wasBlockingMove: wasBlocking,
        strategicValue: moveValue
      }
      
      const decisionData: DecisionTime = {
        timestamp: now,
        duration: decisionTime,
        moveNumber: moveCount + 1,
        phase: 'placement',
        complexity: board.filter(c => c !== null).length,
        pressureLevel: wasBlocking ? 1 : 0
      }
      
      // Track AI encounter if responding to AI
      if (lastAIMove.current && now - lastAIMove.current.timestamp < 2000) {
        const encounter: AIEncounter = {
          timestamp: now,
          aiMovePosition: lastAIMove.current.position,
          playerResponse: index,
          responseTime: now - lastAIMove.current.timestamp,
          playerBlocked: wasBlocking,
          aiBlocked: false,
          advantageGained: wasBlocking ? 'player' : 'neutral'
        }
        
        setSessionData(prev => ({
          ...prev,
          detailedLogs: {
            ...prev.detailedLogs,
            aiEncounters: [...prev.detailedLogs.aiEncounters, encounter]
          },
          aiPerformance: {
            ...prev.aiPerformance,
            playerBlockedAI: prev.aiPerformance.playerBlockedAI + (wasBlocking ? 1 : 0),
            advantageGained: prev.aiPerformance.advantageGained + (wasBlocking ? 1 : 0)
          }
        }))
      }
      
      setSessionData(prev => ({
        ...prev,
        detailedLogs: {
          ...prev.detailedLogs,
          moves: [...prev.detailedLogs.moves, moveData],
          decisionTimes: [...prev.detailedLogs.decisionTimes, decisionData],
          strategicPatterns: [...prev.detailedLogs.strategicPatterns, pattern]
        },
        strategicAnalysis: {
          ...prev.strategicAnalysis,
          offensiveMoves: prev.strategicAnalysis.offensiveMoves + (pattern.patternType === 'offensive' ? 1 : 0),
          defensiveMoves: prev.strategicAnalysis.defensiveMoves + (pattern.patternType === 'defensive' ? 1 : 0),
          setupMoves: prev.strategicAnalysis.setupMoves + (pattern.patternType === 'setup' ? 1 : 0),
          tacticalMoves: prev.strategicAnalysis.tacticalMoves + (pattern.patternType === 'tactical' ? 1 : 0),
          forcedMoves: prev.strategicAnalysis.forcedMoves + (pattern.patternType === 'forced' ? 1 : 0)
        }
      }))
      
      setBoard(newBoard)
      setPlaced(newPlaced)
      setMoveCount(moveCount + 1)
      lastMoveTime.current = now
      moveStartTime.current = now

      const win = checkWin(newBoard)
      if (win) {
        setWinner(win)
        finishGame('win', newBoard, moveCount + 1)
        return
      }

      if (newPlaced.X >= 3 && newPlaced.O >= 3) setPhase("movement")
      setTurn("O")
    } else {
      // Movement phase
      if (selected === null) {
        if (newBoard[index] === "X") setSelected(index)
      } else {
        if (!newBoard[index] && adjacency[selected].includes(index)) {
          fromPos = selected
          newBoard[index] = "X"
          newBoard[selected] = null
          
          const pattern = analyzeMove(index, 'X', board, selected)
          const moveValue = calculateMoveValue(index, board)
          
          const isWinningMove = checkWin(newBoard) === 'X'
          
          // Check blocking in movement
          let wasBlocking = false
          const opponentPieces = board
            .map((v, i) => v === 'O' ? i : null)
            .filter(v => v !== null) as number[]
          
          for (let opFrom of opponentPieces) {
            for (let opTo of adjacency[opFrom]) {
              if (board[opTo]) continue
              const testBoard = [...board]
              testBoard[opFrom] = null
              testBoard[opTo] = 'O'
              if (checkWin(testBoard) === 'O' && opTo === index) {
                wasBlocking = true
                break
              }
            }
          }
          
          const moveData: MoveData = {
            timestamp: now,
            player: 'X',
            position: index,
            fromPosition: selected,
            moveNumber: moveCount + 1,
            timeSinceLastMove,
            boardState: [...board],
            phase: 'movement',
            wasWinningMove: isWinningMove,
            wasBlockingMove: wasBlocking,
            strategicValue: moveValue
          }
          
          const decisionData: DecisionTime = {
            timestamp: now,
            duration: decisionTime,
            moveNumber: moveCount + 1,
            phase: 'movement',
            complexity: 9,
            pressureLevel: wasBlocking ? 1 : 0
          }
          
          if (lastAIMove.current && now - lastAIMove.current.timestamp < 2000) {
            const encounter: AIEncounter = {
              timestamp: now,
              aiMovePosition: lastAIMove.current.position,
              playerResponse: index,
              responseTime: now - lastAIMove.current.timestamp,
              playerBlocked: wasBlocking,
              aiBlocked: false,
              advantageGained: wasBlocking ? 'player' : 'neutral'
            }
            
            setSessionData(prev => ({
              ...prev,
              detailedLogs: {
                ...prev.detailedLogs,
                aiEncounters: [...prev.detailedLogs.aiEncounters, encounter]
              },
              aiPerformance: {
                ...prev.aiPerformance,
                playerBlockedAI: prev.aiPerformance.playerBlockedAI + (wasBlocking ? 1 : 0),
                advantageGained: prev.aiPerformance.advantageGained + (wasBlocking ? 1 : 0)
              }
            }))
          }
          
          setSessionData(prev => ({
            ...prev,
            detailedLogs: {
              ...prev.detailedLogs,
              moves: [...prev.detailedLogs.moves, moveData],
              decisionTimes: [...prev.detailedLogs.decisionTimes, decisionData],
              strategicPatterns: [...prev.detailedLogs.strategicPatterns, pattern]
            },
            strategicAnalysis: {
              ...prev.strategicAnalysis,
              offensiveMoves: prev.strategicAnalysis.offensiveMoves + (pattern.patternType === 'offensive' ? 1 : 0),
              defensiveMoves: prev.strategicAnalysis.defensiveMoves + (pattern.patternType === 'defensive' ? 1 : 0),
              setupMoves: prev.strategicAnalysis.setupMoves + (pattern.patternType === 'setup' ? 1 : 0),
              tacticalMoves: prev.strategicAnalysis.tacticalMoves + (pattern.patternType === 'tactical' ? 1 : 0),
              forcedMoves: prev.strategicAnalysis.forcedMoves + (pattern.patternType === 'forced' ? 1 : 0)
            }
          }))
          
          setSelected(null)
          setBoard(newBoard)
          setMoveCount(moveCount + 1)
          lastMoveTime.current = now
          moveStartTime.current = now

          const win = checkWin(newBoard)
          if (win) {
            setWinner(win)
            finishGame('win', newBoard, moveCount + 1)
            return
          }
          setTurn("O")
        } else {
          setSelected(null)
        }
      }
    }
  }

  const finishGame = (outcome: 'win' | 'loss' | 'draw', finalBoard: (string | null)[], totalMoves: number) => {
    const placementMoves = sessionData.detailedLogs.moves.filter(m => m.phase === 'placement').length
    const movementMoves = sessionData.detailedLogs.moves.filter(m => m.phase === 'movement').length
    const advantageScore = sessionData.aiPerformance.advantageGained - sessionData.aiPerformance.advantageLost
    
    const gameResult: GameResult = {
      outcome,
      finalBoard,
      totalMoves,
      gameDuration: Date.now() - gameStartTime.current,
      placementMoves,
      movementMoves,
      playerAdvantageScore: advantageScore
    }
    
    setSessionData(prev => ({
      ...prev,
      gamesPlayed: prev.gamesPlayed + 1,
      wins: prev.wins + (outcome === 'win' ? 1 : 0),
      losses: prev.losses + (outcome === 'loss' ? 1 : 0),
      draws: prev.draws + (outcome === 'draw' ? 1 : 0),
      detailedLogs: {
        ...prev.detailedLogs,
        gameResults: [...prev.detailedLogs.gameResults, gameResult]
      }
    }))
  }

  useEffect(() => {
    if (aiEnabled && turn === "O" && !winner && gameStarted) {
      const timeout = setTimeout(() => aiMove(), 600)
      return () => clearTimeout(timeout)
    }
  }, [turn, phase, board, winner, gameStarted])

  const aiMove = () => {
    const now = Date.now()
    const newBoard = [...board]

    if (phase === "placement") {
      const empty = getEmptyIndices(newBoard)
      
      // Try to win
      for (let i of empty) {
        newBoard[i] = "O"
        if (checkWin(newBoard)) {
          lastAIMove.current = { position: i, timestamp: now }
          return commitMove(i)
        }
        newBoard[i] = null
      }
      
      // Block player
      for (let i of empty) {
        newBoard[i] = "X"
        if (checkWin(newBoard)) {
          newBoard[i] = "O"
          lastAIMove.current = { position: i, timestamp: now }
          
          // Track that AI blocked player
          setSessionData(prev => ({
            ...prev,
            aiPerformance: {
              ...prev.aiPerformance,
              aiBlockedPlayer: prev.aiPerformance.aiBlockedPlayer + 1,
              advantageLost: prev.aiPerformance.advantageLost + 1
            }
          }))
          
          return commitMove(i)
        }
        newBoard[i] = null
      }
      
      // Random
      const rand = empty[Math.floor(Math.random() * empty.length)]
      lastAIMove.current = { position: rand, timestamp: now }
      return commitMove(rand)
    } else {
      // Movement phase
      const myPieces = newBoard
        .map((v, i) => (v === "O" ? i : null))
        .filter((v) => v !== null) as number[]

      for (let from of myPieces) {
        for (let to of adjacency[from]) {
          if (newBoard[to]) continue
          newBoard[to] = "O"
          newBoard[from] = null
          if (checkWin(newBoard)) {
            lastAIMove.current = { position: to, timestamp: now }
            return commitMove(to, from)
          }
          newBoard[to] = null
          newBoard[from] = "O"
        }
      }

      // Try blocking
      for (let from of myPieces) {
        for (let to of adjacency[from]) {
          if (newBoard[to]) continue
          newBoard[to] = "X"
          if (checkWin(newBoard)) {
            newBoard[to] = "O"
            lastAIMove.current = { position: to, timestamp: now }
            
            // Track that AI blocked player
            setSessionData(prev => ({
              ...prev,
              aiPerformance: {
                ...prev.aiPerformance,
                aiBlockedPlayer: prev.aiPerformance.aiBlockedPlayer + 1,
                advantageLost: prev.aiPerformance.advantageLost + 1
              }
            }))
            
            return commitMove(to, from)
          }
          newBoard[to] = null
        }
      }

 // Random or fallback move
let availableMoves: { from: number; to: number }[] = []

for (let from of myPieces) {
  for (let to of adjacency[from]) {
    if (!newBoard[to]) availableMoves.push({ from, to })
  }
}

// If no valid moves exist → declare stalemate
if (availableMoves.length === 0) {
  console.log("🤖 AI has no valid moves. Declaring stalemate.")
  setMessage("🤝 Stalemate — no moves available for AI.")
  finishGame("draw", newBoard, moveCount + 1)
  return
}

// Otherwise, make a random valid move
const { from, to } = availableMoves[Math.floor(Math.random() * availableMoves.length)]
lastAIMove.current = { position: to, timestamp: now }
commitMove(to, from)
    }
  }

  const commitMove = (to: number, from?: number) => {
    const newBoard = [...board]
    if (phase === "placement") {
      newBoard[to] = "O"
      const newPlaced = { ...placed, O: placed.O + 1 }
      setBoard(newBoard)
      setPlaced(newPlaced)
      const win = checkWin(newBoard)
      if (win) {
        setWinner(win)
        finishGame('loss', newBoard, moveCount + 1)
        return
      }
      if (newPlaced.X >= 3 && newPlaced.O >= 3) setPhase("movement")
      setTurn("X")
      moveStartTime.current = Date.now()
    } else {
      if (from !== undefined) newBoard[from] = null
      newBoard[to] = "O"
      setBoard(newBoard)
      const win = checkWin(newBoard)
      if (win) {
        setWinner(win)
        finishGame('loss', newBoard, moveCount + 1)
        return
      }
      setTurn("X")
      moveStartTime.current = Date.now()
    }
  }

  const startGame = () => {
    setGameStarted(true)
    gameStartTime.current = Date.now()
    moveStartTime.current = Date.now()
    lastMoveTime.current = Date.now()
  }

  const resetGame = () => {
    setBoard(initialBoard)
    setTurn("X")
    setPhase("placement")
    setSelected(null)
    setPlaced({ X: 0, O: 0 })
    setWinner(null)
    setGameStarted(false)
    setMoveCount(0)
    setMessage('')
    setSaveError('')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-indigo-950 flex flex-col items-center justify-center text-white p-6">
      <h1 className="text-4xl font-extrabold mb-4 text-cyan-400 tracking-wide">
        ⚡ Neon Mills
      </h1>
      <p className="text-sm mb-6 text-gray-400 flex items-center gap-1">
        <Cpu className="w-4 h-4 text-pink-400" /> Single-Player Mode vs AI
      </p>

      {message && (
        <div className="mb-4 text-green-400 font-semibold">{message}</div>
      )}

      {saveError && (
        <div className="mb-4 text-red-400 font-semibold">{saveError}</div>
      )}

      <div className="relative grid grid-cols-3 gap-6 p-8 rounded-2xl bg-black/50 border border-cyan-600 shadow-[0_0_25px_#0ff8]">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 300 300"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {lines.map((line, i) => {
            const [a, b, c] = line
            const coords = [
              [a % 3, Math.floor(a / 3)],
              [b % 3, Math.floor(b / 3)],
              [c % 3, Math.floor(c / 3)],
            ]
            const [x1, y1] = coords[0]
            const [x3, y3] = coords[2]
            return (
              <motion.line
                key={i}
                x1={x1 * 100 + 50}
                y1={y1 * 100 + 50}
                x2={x3 * 100 + 50}
                y2={y3 * 100 + 50}
                stroke={winner ? "#f0f" : "#0ff"}
                initial={{ opacity: 0.2 }}
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            )
          })}
        </svg>

        {board.map((cell, index) => (
          <motion.div
            key={index}
            onClick={() => handleCellClick(index)}
            whileHover={{ scale: gameStarted && turn === 'X' && !winner ? 1.1 : 1 }}
            whileTap={{ scale: 0.9 }}
            className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all 
              ${gameStarted && turn === 'X' && !winner ? 'cursor-pointer' : ''}
              ${
                selected === index
                  ? "ring-4 ring-pink-500"
                  : cell
                  ? "shadow-[0_0_20px_rgba(0,255,255,0.8)]"
                  : "shadow-[0_0_10px_rgba(255,255,255,0.1)]"
              }`}
          >
            {cell && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`w-14 h-14 rounded-full ${
                  cell === "X"
                    ? "bg-cyan-400 shadow-[0_0_25px_#0ff]"
                    : "bg-pink-500 shadow-[0_0_25px_#f0f]"
                }`}
              />
            )}
          </motion.div>
        ))}
      </div>

      <div className="mt-6 text-center">
        {!gameStarted && !winner && (
          <button
            onClick={startGame}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-bold text-lg hover:scale-105 transition-transform"
          >
            Start Game
          </button>
        )}
      </div>

      <div className="mt-8 text-center space-y-3">
        {winner ? (
          <h2 className="text-3xl font-bold text-pink-400">
            {winner === "X" ? "You Win! ⚡" : "AI Wins 🤖"}
          </h2>
        ) : gameStarted ? (
          <p className="text-xl opacity-80">
            Phase:{" "}
            <span className="text-cyan-300 font-semibold capitalize">
              {phase}
            </span>{" "}
            | Turn:{" "}
            <span
              className={
                turn === "X"
                  ? "text-cyan-300 font-bold"
                  : "text-pink-400 font-bold"
              }
            >
              {turn === "X" ? "You" : "AI"}
            </span>
          </p>
        ) : null}

        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
          <button
            onClick={resetGame}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-pink-500 font-semibold hover:scale-105 transition-transform"
          >
            <RefreshCcw className="w-5 h-5" />
            Next
          </button>

          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-105 transition-transform font-semibold"
          >
            <Brain className="w-5 h-5" />
            {showMetrics ? 'Hide' : 'Show'} Metrics
          </button>

          <button
            onClick={saveSessionToFirebase}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-105 transition-transform font-semibold disabled:opacity-50"
          >
            <TrendingUp className="w-5 h-5" />
            {isLoading ? 'Saving...' : 'Save Session'}
          </button>
        </div>
      </div>

      {showMetrics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 w-full max-w-5xl bg-black/60 border border-cyan-600/50 rounded-xl p-6"
        >
          <h3 className="text-2xl font-bold text-cyan-400 mb-4 text-center">🧠 Cognitive Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-cyan-300 mb-2">📊 Session Stats</h4>
              <div className="text-white">Games: {sessionData.gamesPlayed}</div>
              <div className="text-green-400">Wins: {sessionData.wins}</div>
              <div className="text-red-400">Losses: {sessionData.losses}</div>
              <div className="text-yellow-400">Draws: {sessionData.draws}</div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-purple-300 mb-2">⚡ Decision Speed</h4>
              <div className="text-white">Total: {sessionData.detailedLogs.decisionTimes.length}</div>
              <div className="text-gray-300">
                Avg: {sessionData.detailedLogs.decisionTimes.length > 0 
                  ? Math.round(sessionData.detailedLogs.decisionTimes.reduce((a, b) => a + b.duration, 0) / sessionData.detailedLogs.decisionTimes.length) 
                  : 0}ms
              </div>
              <div className="text-gray-300">
                Placement: {sessionData.detailedLogs.decisionTimes.filter(d => d.phase === 'placement').length > 0
                  ? Math.round(sessionData.detailedLogs.decisionTimes.filter(d => d.phase === 'placement').reduce((a, b) => a + b.duration, 0) / sessionData.detailedLogs.decisionTimes.filter(d => d.phase === 'placement').length)
                  : 0}ms
              </div>
              <div className="text-gray-300">
                Movement: {sessionData.detailedLogs.decisionTimes.filter(d => d.phase === 'movement').length > 0
                  ? Math.round(sessionData.detailedLogs.decisionTimes.filter(d => d.phase === 'movement').reduce((a, b) => a + b.duration, 0) / sessionData.detailedLogs.decisionTimes.filter(d => d.phase === 'movement').length)
                  : 0}ms
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-pink-300 mb-2">🎯 Strategy</h4>
              <div className="text-red-400">Offensive: {sessionData.strategicAnalysis.offensiveMoves}</div>
              <div className="text-blue-400">Defensive: {sessionData.strategicAnalysis.defensiveMoves}</div>
              <div className="text-yellow-400">Setup: {sessionData.strategicAnalysis.setupMoves}</div>
              <div className="text-purple-400">Tactical: {sessionData.strategicAnalysis.tacticalMoves}</div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-green-300 mb-2">🤖 AI Performance</h4>
              <div className="text-green-400">You Blocked AI: {sessionData.aiPerformance.playerBlockedAI}</div>
              <div className="text-red-400">AI Blocked You: {sessionData.aiPerformance.aiBlockedPlayer}</div>
              <div className="text-white">Advantage: {sessionData.aiPerformance.advantageGained - sessionData.aiPerformance.advantageLost}</div>
              <div className="text-gray-300">Encounters: {sessionData.detailedLogs.aiEncounters.length}</div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-orange-300 mb-2">🏆 Performance</h4>
              <div className="text-white">Winning Moves: {sessionData.detailedLogs.moves.filter(m => m.wasWinningMove).length}</div>
              <div className="text-gray-300">Blocking Moves: {sessionData.detailedLogs.moves.filter(m => m.wasBlockingMove).length}</div>
              <div className="text-gray-300">Total Moves: {sessionData.detailedLogs.moves.length}</div>
            </div>

            <div className="bg-white/10 rounded-lg p-4">
              <h4 className="font-bold text-indigo-300 mb-2">👤 User Progress</h4>
              {userId && userStats ? (
                <>
                  <div className="text-white">Games: {userStats.totalGamesPlayed || 0}</div>
                  <div className="text-green-400">Win Rate: {Math.round(userStats.winRate || 0)}%</div>
                  <div className="text-gray-300">Avg: {Math.round(userStats.averageDecisionTime || 0)}ms</div>
                  <div className="text-green-400 text-xs mt-1">✅ Synced</div>
                </>
              ) : (
                <>
                  <div className="text-white">Not Signed In</div>
                  <div className="text-gray-300">Local Storage</div>
                  <div className="text-gray-300">Sign in to sync</div>
                  <div className="text-orange-400 text-xs mt-1">📱 Local</div>
                </>
              )}
            </div>
          </div>

          {userId && userStats && (
            <div className="mt-4 p-4 bg-white/10 rounded-lg">
              <h4 className="font-semibold text-cyan-400 mb-2 text-center">🏆 Personal Best</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{userStats.totalWins || 0}</div>
                  <div className="text-gray-300">Total Wins</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.winRate || 0)}%</div>
                  <div className="text-gray-300">Win Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.averageDecisionTime || 0)}ms</div>
                  <div className="text-gray-300">Avg Decision</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-white">{Math.round(userStats.blockingEfficiency || 0)}</div>
                  <div className="text-gray-300">Blocks</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <footer className="mt-10 text-sm text-gray-400 opacity-60">
        <Zap className="inline-block w-4 h-4 mr-1" />
        Three Men's Morris – Cyber Grid Edition vs AI with Cognitive Tracking
      </footer>
    </main>
  )
}