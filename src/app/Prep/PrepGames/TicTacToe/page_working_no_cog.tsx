'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { motion, AnimatePresence } from 'framer-motion'

interface MoveLog {
  /** Linearized global position: boardIndex * 9 + cellIndex (0..80) */
  position: number
  player: 'X' | 'O'
  timestamp: number
  timeSinceLastMove: number
  moveNumber: number
  /** Snapshot of the macro board (who owns each local board: '', 'X', 'O', 'D') */
  gameState: string[]
  isStrategic: boolean
  /** Classified within the active local board */
  moveType: 'offensive' | 'defensive' | 'neutral'
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
}

interface HesitationTime {
  duration: number
  timestamp: number
  moveNumber: number
}

interface LevelData {
  difficulty: number
  gamesPlayed: number
  wins: number
  losses: number
  draws: number
  timing: {
    startTime: number
    endTime: number
    totalDuration: number
  }
  performance: {
    winRate: number
    avgMovesPerGame: number
    avgGameDuration: number
    strategicMoveRate: number
  }
  cognitive: {
    avgHesitationTime: number
    totalHesitations: number
    decisionQuality: number
  }
  detailedLogs: {
    games: GameResult[]
    moves: MoveLog[]
    hesitations: HesitationTime[]
  }
}

interface SessionData {
  levels: LevelData[]
  sessionStart: number
  currentDifficulty: number
  totalGames: number
  totalWins: number
  totalLosses: number
  totalDraws: number
}

export default function TicTacToeGame() {
  const router = useRouter()

  /** Macro = 3x3 cells, value: '', 'X', 'O', or 'D' (draw/blocked) */
  const [macroBoard, setMacroBoard] = useState<string[]>(Array(9).fill(''))

  /** Nine local 3x3 boards */
  const [localBoards, setLocalBoards] = useState<string[][]>(
    Array(9).fill(null).map(() => Array(9).fill(''))
  )

  /** Which local board must be played next; null = any legal board */
  const [activeBoard, setActiveBoard] = useState<number | null>(null)

  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing')
  const [difficulty, setDifficulty] = useState(1)
  const [currentGame, setCurrentGame] = useState(1)
  const [score, setScore] = useState({ wins: 0, losses: 0, draws: 0 })
  const [aiMovesFirst, setAiMovesFirst] = useState(false)

  // Cognitive tracking (kept internal; not shown to user)
  const [moveLog, setMoveLog] = useState<MoveLog[]>([])
  const [hesitationTimes, setHesitationTimes] = useState<HesitationTime[]>([])
  const [gameResults, setGameResults] = useState<GameResult[]>([])
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now())
  const [sessionData, setSessionData] = useState<SessionData>({
    levels: [],
    sessionStart: Date.now(),
    currentDifficulty: 1,
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0
  })

  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showInfoScreen, setShowInfoScreen] = useState(true)

  const lastActionTime = useRef(Date.now())
  const sessionStartTime = useRef(Date.now())
  const hesitationThreshold = 2000

  // 3x3 winning lines for both local and macro checks
  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ]

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!isPlayerTurn && gameState === 'playing') {
      const timer = setTimeout(() => makeAIMove(), Math.max(800 - difficulty * 120, 200))
      return () => clearTimeout(timer)
    }
  }, [isPlayerTurn, gameState, difficulty])

  /** Standard 3x3 winner checker used for local boards; returns 'X', 'O', 'draw' or null */
  const checkWinner = (boardState: string[]): string | null => {
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
        return boardState[a]
      }
    }
    return boardState.includes('') ? null : 'draw'
  }

  /** Macro-level winner check; treats anything not X/O as empty */
  const checkMacroWinner = (macro: string[]): 'X' | 'O' | 'draw' | null => {
    const sanitized = macro.map(v => (v === 'X' || v === 'O') ? v : '')
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      if (sanitized[a] && sanitized[a] === sanitized[b] && sanitized[a] === sanitized[c]) {
        return sanitized[a] as 'X' | 'O'
      }
    }
    // Draw if every local board is concluded (X/O/D) and no macro line formed
    const allClosed = macro.every(v => v !== '')
    return allClosed ? 'draw' : null
  }

  /** Empty cells within a given local board */
  const getEmptyCells = (local: string[]): number[] =>
    local.map((v, i) => (v === '' ? i : -1)).filter(i => i !== -1)

  /** Simple local-board tactical pick for player analysis (within a 3x3 only) */
  const analyzeMoveType = (cellIndex: number, local: string[]): 'offensive' | 'defensive' | 'neutral' => {
    const test = [...local]
    test[cellIndex] = 'X'
    if (checkWinner(test) === 'X') return 'offensive'
    // defensive if it blocks O's immediate win
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [local[a], local[b], local[c]]
      if (values.filter(v => v === 'O').length === 2 && values.includes('')) {
        if (combo.includes(cellIndex)) return 'defensive'
      }
    }
    return 'neutral'
  }

  /** Whether a move is "strategic" by simple heuristics in a local board */
  const isStrategicMove = (cellIndex: number, local: string[]): boolean => {
    if (cellIndex === 4) return true
    if ([0, 2, 6, 8].includes(cellIndex)) return true
    const t = analyzeMoveType(cellIndex, local)
    return t === 'offensive' || t === 'defensive'
  }

  /** Best local move for a given player within a 3x3 board */
  const getBestLocalMove = (local: string[], player: 'X' | 'O'): number | null => {
    const opponent = player === 'X' ? 'O' : 'X'
    // 1) Win if possible
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [local[a], local[b], local[c]]
      if (values.filter(v => v === player).length === 2 && values.includes('')) {
        return combo[values.indexOf('')]
      }
    }
    // 2) Block opponent
    for (let combo of winningCombinations) {
      const [a, b, c] = combo
      const values = [local[a], local[b], local[c]]
      if (values.filter(v => v === opponent).length === 2 && values.includes('')) {
        return combo[values.indexOf('')]
      }
    }
    // 3) Center
    if (local[4] === '') return 4
    // 4) Corners
    const corners = [0, 2, 6, 8].filter(i => local[i] === '')
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)]
    // 5) Any
    const empties = getEmptyCells(local)
    return empties.length ? empties[Math.floor(Math.random() * empties.length)] : null
  }

  /** Is a given local board selectable now? */
  const isBoardPlayable = (boardIndex: number): boolean =>
    macroBoard[boardIndex] === '' && localBoards[boardIndex].some(c => c === '')

  /** Player click in a specific local board/cell */
  const handleSquareClick = (boardIndex: number, cellIndex: number) => {
    if (!isPlayerTurn || gameState !== 'playing') return
    if (localBoards[boardIndex][cellIndex] !== '') return
    if (activeBoard !== null && activeBoard !== boardIndex) return

    const now = Date.now()
    const timeSinceLastMove = now - lastActionTime.current
    if (timeSinceLastMove > hesitationThreshold) {
      setHesitationTimes(prev => [...prev, {
        duration: timeSinceLastMove,
        timestamp: now,
        moveNumber: moveLog.filter(m => m.player === 'X').length + 1
      }])
    }

    // Place X
    const updatedLocals = [...localBoards]
    updatedLocals[boardIndex] = [...updatedLocals[boardIndex]]
    updatedLocals[boardIndex][cellIndex] = 'X'

    // Determine local result
    const localResult = checkWinner(updatedLocals[boardIndex])
    let updatedMacro = [...macroBoard]
    if (localResult === 'X') {
      updatedMacro[boardIndex] = 'X'
    } else if (localResult === 'O') {
      updatedMacro[boardIndex] = 'O'
    } else if (localResult === 'draw') {
      updatedMacro[boardIndex] = 'D' // blocked, not counted as X/O
    }

    // Log the move
    const moveType = analyzeMoveType(cellIndex, localBoards[boardIndex])
    const strategic = isStrategicMove(cellIndex, localBoards[boardIndex])
    setMoveLog(prev => [...prev, {
      position: boardIndex * 9 + cellIndex,
      player: 'X',
      timestamp: now,
      timeSinceLastMove,
      moveNumber: prev.length + 1,
      gameState: updatedMacro,
      isStrategic: strategic,
      moveType
    }])

    setLocalBoards(updatedLocals)
    setMacroBoard(updatedMacro)

    // Macro win?
    const macroResult = checkMacroWinner(updatedMacro)
    if (macroResult) {
      if (macroResult === 'X') handleGameEnd('X', updatedMacro)
      else if (macroResult === 'O') handleGameEnd('O', updatedMacro)
      else handleGameEnd(null, updatedMacro) // draw
      lastActionTime.current = now
      return
    }

    // Set next active board = the cell index played, unless that board is closed/full
    const nextTarget = isBoardPlayable(cellIndex) ? cellIndex : null
    setActiveBoard(nextTarget)

    setIsPlayerTurn(false)
    lastActionTime.current = now
  }

  /** AI plays within the rules of Ultimate TTT */
  const makeAIMove = () => {
    if (gameState !== 'playing') return

    // Determine AI target board
    let targetBoard = activeBoard
    if (targetBoard === null || !isBoardPlayable(targetBoard)) {
      // pick any playable local board
      const candidates = [...Array(9).keys()].filter(i => isBoardPlayable(i))
      if (candidates.length === 0) return
      targetBoard = candidates[Math.floor(Math.random() * candidates.length)]
    }

    const local = [...localBoards[targetBoard]]
    const intelligence = Math.min(0.2 + difficulty * 0.2, 1) // 0.4 → 1.0 across your range
    let move: number | null
    if (Math.random() < intelligence) {
      move = getBestLocalMove(local, 'O')
    } else {
      const empties = getEmptyCells(local)
      move = empties.length ? empties[Math.floor(Math.random() * empties.length)] : null
    }
    if (move === null) {
      // Fallback: pick any other playable board/cell
      const fallbacks = [...Array(9).keys()].filter(i => isBoardPlayable(i))
      if (!fallbacks.length) return
      const fb = fallbacks[Math.floor(Math.random() * fallbacks.length)]
      const emptyCells = getEmptyCells(localBoards[fb])
      if (!emptyCells.length) return
      targetBoard = fb
      move = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    }

    // Place O
    const updatedLocals = [...localBoards]
    updatedLocals[targetBoard] = [...updatedLocals[targetBoard]]
    updatedLocals[targetBoard][move] = 'O'

    // Local result
    const localResult = checkWinner(updatedLocals[targetBoard])
    let updatedMacro = [...macroBoard]
    if (localResult === 'X') {
      updatedMacro[targetBoard] = 'X'
    } else if (localResult === 'O') {
      updatedMacro[targetBoard] = 'O'
    } else if (localResult === 'draw') {
      updatedMacro[targetBoard] = 'D'
    }

    // Log AI move
    const now = Date.now()
    const aiLog: MoveLog = {
      position: targetBoard * 9 + move,
      player: 'O',
      timestamp: now,
      timeSinceLastMove: now - lastActionTime.current,
      moveNumber: moveLog.length + 1,
      gameState: updatedMacro,
      isStrategic: false,
      moveType: 'neutral'
    }
    setMoveLog(prev => [...prev, aiLog])

    setLocalBoards(updatedLocals)
    setMacroBoard(updatedMacro)

    // Macro result?
    const macroResult = checkMacroWinner(updatedMacro)
    if (macroResult) {
      if (macroResult === 'X') handleGameEnd('X', updatedMacro)
      else if (macroResult === 'O') handleGameEnd('O', updatedMacro)
      else handleGameEnd(null, updatedMacro)
      return
    }

    // Next active board determined by AI move
    const nextTarget = isBoardPlayable(move) ? move : null
    setActiveBoard(nextTarget)
    setIsPlayerTurn(true)
    lastActionTime.current = now
  }

  /** compute cognitive metrics (internal only; not shown) */
  const computeCognitiveMetrics = () => {
    const avgHesitationTime =
      hesitationTimes.length > 0
        ? hesitationTimes.reduce((s, h) => s + h.duration, 0) / hesitationTimes.length
        : 0
    const decisionQuality =
      moveLog.length > 0
        ? moveLog.filter((m) => m.isStrategic).length / moveLog.length
        : 0
    const planningEfficiency = 1 - avgHesitationTime / 3000
    const executiveControl = (decisionQuality + planningEfficiency) / 2

    return {
      avgHesitationTime,
      totalHesitations: hesitationTimes.length,
      decisionQuality,
      planningEfficiency,
      executiveControl
    }
  }

  /** Save session data silently to Firestore (background) */
  const saveSessionData = async () => {
    if (!userId) return
    setIsLoading(true)
    setSaveError('')
    const now = Date.now()

    const metrics = computeCognitiveMetrics()

    const sessionMetrics = {
      sessionOverview: {
        sessionStart: sessionData.sessionStart,
        sessionEnd: now,
        totalDuration: now - sessionData.sessionStart,
        gameType: 'ticTacToe'
      },
      performance: {
        winRate: score.wins / (score.wins + score.losses + score.draws || 1),
        avgMovesPerGame:
          moveLog.length / (gameResults.length || 1),
        avgGameDuration:
          gameResults.reduce((a, b) => a + b.duration, 0) / (gameResults.length || 1),
        strategicMoveRate:
          moveLog.filter((m) => m.isStrategic).length / (moveLog.length || 1)
      },
      cognitive: metrics,
      detailedLogs: {
        games: gameResults,
        moves: moveLog,
        hesitations: hesitationTimes
      }
    }

    try {
      const userDoc = doc(db, 'users', userId)
      await addDoc(collection(userDoc, 'gameSessionsDetailed'), {
        ...sessionMetrics,
        createdAt: new Date()
      })
      await setDoc(
        userDoc,
        {
          ticTacToeGame: {
            lastPlayed: new Date().toISOString(),
            totalGames: (sessionData.totalGames || 0) + 1,
            averageDecisionQuality: metrics.decisionQuality,
            sessions: [...(sessionData.levels || []), sessionMetrics].slice(-10)
          }
        },
        { merge: true }
      )
    } catch (err) {
      console.error('Error saving TicTacToe session data', err)
      setSaveError('Error saving TicTacToe session data')
    } finally {
      setIsLoading(false)
    }
  }

  /** Finalize and roll stats forward */
  const handleGameEnd = (winner: 'X' | 'O' | null, finalMacro: string[]) => {
    const now = Date.now()
    const gameDuration = now - gameStartTime
    const playerMoves = moveLog.filter(m => m.player === 'X').length + (winner === 'X' ? 1 : 0)
    const strategicMoves = moveLog.filter(m => m.player === 'X' && m.isStrategic).length
    const defensiveMoves = moveLog.filter(m => m.player === 'X' && m.moveType === 'defensive').length
    const offensiveMoves = moveLog.filter(m => m.player === 'X' && m.moveType === 'offensive').length

    let outcome: 'win' | 'loss' | 'draw'
    if (winner === 'X') {
      outcome = 'win'
      setScore(prev => ({ ...prev, wins: prev.wins + 1 }))
      setGameState('won')
      if (currentGame % 3 === 0 && difficulty < 3) {
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

    const gameResult: GameResult = {
      gameNumber: currentGame,
      outcome,
      totalMoves: moveLog.length + 1,
      duration: gameDuration,
      difficulty,
      playerMoves,
      strategicMoves,
      defensiveMoves,
      offensiveMoves
    }
    setGameResults(prev => [...prev, gameResult])

    // 🔄 save silently in the background, then queue next game
    saveSessionData()

    setTimeout(() => {
      startNewGame()
      if ((currentGame + 1) % 5 === 0 && difficulty < 10) {
        setDifficulty(prev => prev + 1)
      }
      if ((currentGame + 1) % 10 === 0) {
        saveLevelData()
      }
    }, 1200)
  }

  const startNewGame = () => {
    setMacroBoard(Array(9).fill(''))
    setLocalBoards(Array(9).fill(null).map(() => Array(9).fill('')))
    setActiveBoard(null)
    setIsPlayerTurn(true)
    setGameState('playing')
    setCurrentGame(prev => prev + 1)
    setGameStartTime(Date.now())
    setMoveLog([])
    setHesitationTimes([])
    lastActionTime.current = Date.now()
  }

  const saveLevelData = () => {
    const now = Date.now()
    const levelData: LevelData = {
      difficulty,
      gamesPlayed: gameResults.length,
      wins: score.wins,
      losses: score.losses,
      draws: score.draws,
      timing: {
        startTime: sessionStartTime.current,
        endTime: now,
        totalDuration: now - sessionStartTime.current
      },
      performance: {
        winRate: gameResults.length > 0 ? (score.wins / gameResults.length) * 100 : 0,
        avgMovesPerGame: gameResults.length > 0
          ? gameResults.reduce((sum, g) => sum + g.playerMoves, 0) / gameResults.length
          : 0,
        avgGameDuration: gameResults.length > 0
          ? gameResults.reduce((sum, g) => sum + g.duration, 0) / gameResults.length
          : 0,
        strategicMoveRate: moveLog.length > 0
          ? (moveLog.filter(m => m.isStrategic).length / moveLog.length) * 100
          : 0
      },
      cognitive: {
        avgHesitationTime: hesitationTimes.length > 0
          ? hesitationTimes.reduce((s, h) => s + h.duration, 0) / hesitationTimes.length
          : 0,
        totalHesitations: hesitationTimes.length,
        decisionQuality: moveLog.length > 0
          ? (moveLog.filter(m => m.isStrategic).length / moveLog.length) * 100
          : 0
      },
      detailedLogs: {
        games: gameResults,
        moves: moveLog,
        hesitations: hesitationTimes
      }
    }

    setSessionData(prev => ({
      ...prev,
      levels: [...prev.levels, levelData],
      totalGames: prev.totalGames + gameResults.length,
      totalWins: prev.totalWins + score.wins,
      totalLosses: prev.totalLosses + score.losses,
      totalDraws: prev.totalDraws + score.draws
    }))
  }

  const handleReturnToGameSelection = () => {
    router.push('/Prep/PrepGames/GameSelection')
  }

  // ---- UI (metrics UI removed) ----
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 text-gray-900 flex flex-col items-center justify-center p-6">
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          Saving...
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

              <div className="text-gray-800 text-lg leading-relaxed text-center px-2 md:px-6">
                <p className="font-medium">
                  Play smart — every move you make decides where your opponent must play next.
                  Win three small boards in a row to take the game!
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
              <div className="flex gap-6 justify-center text-sm text-gray-600">
                <span className="bg-green-200 px-3 py-1 rounded-full">Wins: {score.wins}</span>
                <span className="bg-red-200 px-3 py-1 rounded-full">Losses: {score.losses}</span>
                <span className="bg-yellow-200 px-3 py-1 rounded-full">Draws: {score.draws}</span>
                <span className="bg-blue-200 px-3 py-1 rounded-full">Hesitations: {hesitationTimes.length}</span>
              </div>
            </div>

            {/* Macro grid (3x3) of local boards */}
            <div className="bg-white/40 backdrop-blur-sm border border-white/50 rounded-3xl p-4 md:p-6 shadow-xl mb-8">
              <div className="grid grid-cols-3 gap-3 md:gap-4 w-[90vw] max-w-[760px]">
                {localBoards.map((local, boardIndex) => {
                  const isActive = activeBoard === null || activeBoard === boardIndex
                  const macroMark = macroBoard[boardIndex] // '', 'X', 'O', 'D'
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
                  {gameState === 'won' ? '🎉 You Won the Macro Board!' :
                   gameState === 'lost' ? '😔 AI Won the Macro Board' :
                   '🤝 Macro Board Draw'}
                </div>
              )}
            </div>

            {/* Controls (no metrics/export buttons) */}
            <div className="flex gap-4 flex-wrap justify-center mb-6">
              <button
                onClick={startNewGame}
                className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-400 hover:to-gray-500 text-white rounded-full font-semibold shadow-lg transition-all"
              >
                🔄 New Game
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
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
