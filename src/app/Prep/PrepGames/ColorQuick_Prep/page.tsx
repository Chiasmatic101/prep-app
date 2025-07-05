// src/app/Prep/PrepGames/ColorQuick_Prep/page.tsx
'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, auth } from '@/firebase/config'
import { doc, setDoc, collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

// TypeScript interfaces
interface GameMode {
  id: string
  name: string
  description: string
  skills: string
  icon: string
  color: string
}

interface Color {
  name: string
  color: string
  audio: string
}

interface SessionData {
  mode: string
  totalRounds: number
  correctAnswers: number
  score: number
  avgReactionTime: number
  accuracy: number
  reactionTimes: number[]
  levelPlayTimes: number[]
  avgLevelPlayTime: number
  totalGameDuration: number
  timestamp: number
  date: string
  stroopDetails?: {
    wordPhase: {
      accuracy: number
      avgReactionTime: number
      trials: number
      reactionTimes: number[]
    }
    colorPhase: {
      accuracy: number
      avgReactionTime: number
      trials: number
      reactionTimes: number[]
    }
    stroopEffect: number
  }
}

interface ModeStats {
  gamesPlayed: number
  bestScore: number
  averageAccuracy: number
  totalRounds: number
}

interface UserStats {
  highScore: number
  totalGamesPlayed: number
  totalRounds: number
  averageAccuracy: number
  averageReactionTime: number
  lastPlayed: string
  sessions: SessionData[]
  modeStats: {
    [key: string]: ModeStats
  }
}

const GAME_MODES: GameMode[] = [
  {
    id: 'audio',
    name: 'Audio Match',
    description: 'Listen to the color name and tap the matching color',
    skills: 'Audio Processing, Quick Response',
    icon: '🔊',
    color: '#3b82f6'
  },
  {
    id: 'visual',
    name: 'Visual Only',
    description: 'Match the text color without hearing the name',
    skills: 'Visual Processing, Reading Speed',
    icon: '👁️',
    color: '#10b981'
  },
  {
    id: 'stroop',
    name: 'Stroop Test',
    description: 'Match by word OR color - follow the instruction!',
    skills: 'Inhibition Control, Cognitive Flexibility',
    icon: '🧠',
    color: '#8b5cf6'
  }
]

const COLORS: Color[] = [
  { name: 'RED', color: '#ef4444', audio: 'red' },
  { name: 'BLUE', color: '#3b82f6', audio: 'blue' },
  { name: 'GREEN', color: '#10b981', audio: 'green' },
  { name: 'YELLOW', color: '#fbbf24', audio: 'yellow' },
  { name: 'PURPLE', color: '#8b5cf6', audio: 'purple' },
  { name: 'ORANGE', color: '#f97316', audio: 'orange' },
  { name: 'WHITE', color: '#f8fafc', audio: 'white' },
  { name: 'BLACK', color: '#1f2937', audio: 'black' }
]

// Create audio cache at module level
const audioCache = new Map<string, HTMLAudioElement>()

export default function ColorQuickGame() {
  const router = useRouter()
  const [screen, setScreen] = useState<string>('menu')
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null)
  const [score, setScore] = useState<number>(0)
  const [highScore, setHighScore] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState<number>(2500)
  const [gameActive, setGameActive] = useState<boolean>(false)
  const [targetColor, setTargetColor] = useState<Color | null>(null)
  const [displayColor, setDisplayColor] = useState<Color | null>(null)
  const [availableColors, setAvailableColors] = useState<Color[]>([])
  const [round, setRound] = useState<number>(0)
  const [stroopPhase, setStroopPhase] = useState<'word' | 'color'>('word')
  const [stroopRoundsInPhase, setStroopRoundsInPhase] = useState<number>(0)
  const [showPhaseTransition, setShowPhaseTransition] = useState<boolean>(false)
  const [showInitialStroopInstructions, setShowInitialStroopInstructions] = useState<boolean>(false)
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [correctAnswers, setCorrectAnswers] = useState<number>(0)
  const [gameStartTime, setGameStartTime] = useState<number>(0)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true)
  const [message, setMessage] = useState<string>('')

  // Cognitive metrics state
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [wordPhaseRT, setWordPhaseRT] = useState<number[]>([])
  const [colorPhaseRT, setColorPhaseRT] = useState<number[]>([])
  const [wordPhaseCorrect, setWordPhaseCorrect] = useState<number>(0)
  const [colorPhaseCorrect, setColorPhaseCorrect] = useState<number>(0)
  const [allSessionData, setAllSessionData] = useState<SessionData[]>([])
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null)
  const [totalRounds, setTotalRounds] = useState<number>(0)
  const [audioStartTime, setAudioStartTime] = useState<number | null>(null)
  const [levelStartTime, setLevelStartTime] = useState<number | null>(null)
  const [levelPlayTimes, setLevelPlayTimes] = useState<number[]>([])

  // Firebase integration state
  const [userId, setUserId] = useState<string | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string>('')

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid)
        loadUserStats(user.uid)
      } else {
        setUserId(null)
        setUserStats(null)
        // Load from localStorage as fallback
        const savedHighScore = localStorage.getItem('colorQuickHighScore')
        if (savedHighScore) setHighScore(parseInt(savedHighScore))
      }
    })
    return () => unsubscribe()
  }, [])

  // Load user stats from Firestore
  const loadUserStats = async (uid: string) => {
    try {
      // Set up real-time listener for user stats
      const userDocRef = doc(db, 'users', uid)
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          if (data.colorQuickGame) {
            setUserStats(data.colorQuickGame as UserStats)
            setHighScore(data.colorQuickGame.highScore || 0)
            setAllSessionData(data.colorQuickGame.sessions || [])
          }
        }
      })

      return unsubscribe
    } catch (error) {
      console.error('Error loading user stats:', error)
    }
  }

  // Save game session to Firestore
  const saveGameSession = async (sessionData: SessionData) => {
    if (!userId) {
      console.log('No user logged in, saving to localStorage')
      const savedSessions = JSON.parse(localStorage.getItem('colorQuickSessions') || '[]')
      const updatedSessions = [...savedSessions, sessionData].slice(-20) // Keep last 20 sessions
      localStorage.setItem('colorQuickSessions', JSON.stringify(updatedSessions))
      localStorage.setItem('colorQuickHighScore', sessionData.score.toString())
      return
    }

    setIsLoading(true)
    setSaveError('')

    try {
      // Get current user data
      const userDocRef = doc(db, 'users', userId)
      
      // Update user's game stats and add new session
      await setDoc(userDocRef, {
        colorQuickGame: {
          highScore: Math.max(sessionData.score, highScore),
          totalGamesPlayed: (userStats?.totalGamesPlayed || 0) + 1,
          totalRounds: (userStats?.totalRounds || 0) + sessionData.totalRounds,
          averageAccuracy: calculateRunningAverage(
            userStats?.averageAccuracy || 0,
            userStats?.totalGamesPlayed || 0,
            sessionData.accuracy
          ),
          averageReactionTime: calculateRunningAverage(
            userStats?.averageReactionTime || 0,
            userStats?.totalGamesPlayed || 0,
            sessionData.avgReactionTime
          ),
          lastPlayed: new Date().toISOString(),
          sessions: [...(userStats?.sessions || []), sessionData].slice(-20), // Keep last 20 sessions
          modeStats: {
            ...userStats?.modeStats,
            [sessionData.mode]: {
              gamesPlayed: ((userStats?.modeStats?.[sessionData.mode]?.gamesPlayed) || 0) + 1,
              bestScore: Math.max(sessionData.score, (userStats?.modeStats?.[sessionData.mode]?.bestScore) || 0),
              averageAccuracy: calculateRunningAverage(
                userStats?.modeStats?.[sessionData.mode]?.averageAccuracy || 0,
                userStats?.modeStats?.[sessionData.mode]?.gamesPlayed || 0,
                sessionData.accuracy
              ),
              totalRounds: ((userStats?.modeStats?.[sessionData.mode]?.totalRounds) || 0) + sessionData.totalRounds
            }
          }
        }
      }, { merge: true })

      // Also save detailed session data in a separate collection for analytics
      await addDoc(collection(db, 'gameSessionsDetailed'), {
        userId,
        gameType: 'colorQuick',
        ...sessionData,
        createdAt: new Date()
      })

      console.log('Game session saved successfully')
    } catch (error) {
      console.error('Error saving game session:', error)
      setSaveError('Failed to save game data. Your progress may not be synced.')
      
      // Fallback to localStorage
      const savedSessions = JSON.parse(localStorage.getItem('colorQuickSessions') || '[]')
      const updatedSessions = [...savedSessions, sessionData].slice(-20)
      localStorage.setItem('colorQuickSessions', JSON.stringify(updatedSessions))
      localStorage.setItem('colorQuickHighScore', sessionData.score.toString())
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to calculate running average
  const calculateRunningAverage = (currentAvg: number, count: number, newValue: number): number => {
    if (count === 0) return newValue
    return Math.round(((currentAvg * count) + newValue) / (count + 1))
  }

  // Initialize saved preferences and preload audio
  useEffect(() => {
    if (!userId) {
      // Load from localStorage if not logged in
      const savedHighScore = localStorage.getItem('colorQuickHighScore')
      if (savedHighScore) setHighScore(parseInt(savedHighScore))
      
      const savedSessions = localStorage.getItem('colorQuickSessions')
      if (savedSessions) setAllSessionData(JSON.parse(savedSessions))
    }

    const savedSound = localStorage.getItem('colorQuickSound')
    setSoundEnabled(savedSound !== 'false')
    
    // Preload all audio files
    const preloadAudio = async () => {
      COLORS.forEach(color => {
        const audio = new Audio(`/audio/${color.audio}.mp3`) // Assuming you have MP3 files
        audio.preload = 'auto'
        audio.load()
        audioCache.set(color.audio, audio)
      })
    }
    
    preloadAudio()
  }, [userId])

  // Audio playback using MP3 files
  const playColorAudio = useCallback((colorName: string) => {
    if (!soundEnabled) return
    
    try {
      const audio = audioCache.get(colorName)
      if (audio) {
        // Reset audio to beginning
        audio.currentTime = 0
        
        // Set up precise timing tracking
        const handlePlay = () => {
          setAudioStartTime(Date.now())
          audio.removeEventListener('play', handlePlay)
        }
        
        audio.addEventListener('play', handlePlay)
        
        // Play the audio file
        audio.play().catch(error => {
          console.log('Audio play failed:', error)
          // Fallback to speech synthesis if audio file fails
          fallbackToSpeechSynthesis(colorName)
        })
      } else {
        // Fallback if audio not cached
        fallbackToSpeechSynthesis(colorName)
      }
    } catch (error) {
      console.log('Audio playback error:', error)
      fallbackToSpeechSynthesis(colorName)
    }
  }, [soundEnabled])

  // Fallback speech synthesis function
  const fallbackToSpeechSynthesis = useCallback((colorName: string) => {
    try {
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(colorName.toLowerCase())
        utterance.rate = 1.4
        utterance.volume = 0.8
        
        utterance.onstart = () => {
          setAudioStartTime(Date.now())
        }
        
        speechSynthesis.speak(utterance)
      }
    } catch (error) {
      console.log('Speech synthesis not available')
    }
  }, [])

  // Sound effects
  const playSound = useCallback((type: 'correct' | 'wrong') => {
    if (!soundEnabled) return
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      if (type === 'correct') {
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1)
      } else if (type === 'wrong') {
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(196, audioContext.currentTime + 0.1)
      }
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.log('Web Audio API not available')
    }
  }, [soundEnabled])

  const saveHighScore = useCallback((newScore: number) => {
    if (newScore > highScore) {
      setHighScore(newScore)
      if (!userId) {
        localStorage.setItem('colorQuickHighScore', newScore.toString())
      }
    }
  }, [highScore, userId])

  const endGame = useCallback(async () => {
    setGameActive(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    saveHighScore(score)
    
    // Calculate comprehensive metrics
    const avgReactionTime = Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length || 0)
    const accuracy = Math.round((correctAnswers / totalRounds) * 100)
    const avgLevelPlayTime = Math.round(levelPlayTimes.reduce((a, b) => a + b, 0) / levelPlayTimes.length || 0)
    const totalGameDuration = levelPlayTimes.reduce((a, b) => a + b, 0)
    
    const summary: SessionData = {
      mode: selectedMode?.id || '',
      totalRounds: totalRounds,
      correctAnswers,
      score,
      avgReactionTime,
      accuracy,
      reactionTimes: [...reactionTimes],
      levelPlayTimes: [...levelPlayTimes],
      avgLevelPlayTime,
      totalGameDuration,
      timestamp: Date.now(),
      date: new Date().toLocaleString(),
      stroopDetails: selectedMode?.id === 'stroop' ? {
        wordPhase: {
          accuracy: Math.round((wordPhaseCorrect / 10) * 100),
          avgReactionTime: Math.round(wordPhaseRT.reduce((a, b) => a + b, 0) / wordPhaseRT.length || 0),
          trials: wordPhaseRT.length,
          reactionTimes: [...wordPhaseRT]
        },
        colorPhase: {
          accuracy: Math.round((colorPhaseCorrect / 10) * 100),
          avgReactionTime: Math.round(colorPhaseRT.reduce((a, b) => a + b, 0) / colorPhaseRT.length || 0),
          trials: colorPhaseRT.length,
          reactionTimes: [...colorPhaseRT]
        },
        stroopEffect: colorPhaseRT.length && wordPhaseRT.length ? 
          Math.round((colorPhaseRT.reduce((a, b) => a + b, 0) / colorPhaseRT.length) - (wordPhaseRT.reduce((a, b) => a + b, 0) / wordPhaseRT.length)) : 0
      } : undefined
    }
    
    setSessionData(summary)
    setAllSessionData(prev => [...prev, summary])
    console.log("Game Session Metrics:", summary)
    
    // Save to Firestore
    await saveGameSession(summary)
    
    setScreen('game-over')
  }, [score, saveHighScore, reactionTimes, correctAnswers, totalRounds, levelPlayTimes, selectedMode, wordPhaseCorrect, colorPhaseCorrect, wordPhaseRT, colorPhaseRT, saveGameSession])

  const startNewRound = useCallback(() => {
    if (!selectedMode || !gameActive || showPhaseTransition || showInitialStroopInstructions) return
    
    const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5)
    const numColors = Math.min(4 + Math.floor(score / 5), 6)
    const gameColors = shuffledColors.slice(0, numColors)
    setAvailableColors(gameColors)
    
    const target = gameColors[Math.floor(Math.random() * gameColors.length)]
    setTargetColor(target)
    
    if (selectedMode.id === 'audio') {
      playColorAudio(target.audio)
    }
    
    if (selectedMode.id === 'stroop') {
      const otherColors = gameColors.filter(c => c.name !== target.name)
      if (otherColors.length > 0) {
        setDisplayColor(otherColors[Math.floor(Math.random() * otherColors.length)])
      } else {
        setDisplayColor(target)
      }
      
      const newRoundsInPhase = stroopRoundsInPhase + 1
      setStroopRoundsInPhase(newRoundsInPhase)
      
      if (newRoundsInPhase >= 10) {
        if (stroopPhase === 'word') {
          setShowPhaseTransition(true)
          setGameActive(false)
          return
        } else {
          endGame()
          return
        }
      }
    } else {
      setDisplayColor(target)
    }
    
    const baseTime = selectedMode.id === 'audio' ? 3000 : 2500
    const adjustedTime = Math.max(800, baseTime - (score * 40))
    setTimeLeft(adjustedTime)
    setGameStartTime(Date.now())
    setRoundStartTime(Date.now())
    setLevelStartTime(Date.now())
    setRound(prev => prev + 1)
    setTotalRounds(prev => prev + 1)
  }, [selectedMode, gameActive, score, stroopPhase, stroopRoundsInPhase, showPhaseTransition, showInitialStroopInstructions, playColorAudio, endGame])

  const checkAnswer = useCallback((selectedColor: Color) => {
    if (!gameActive || !selectedMode || !targetColor || showPhaseTransition || showInitialStroopInstructions || !roundStartTime) return
    
    // Calculate level play time
    const levelPlayTime = levelStartTime ? Date.now() - levelStartTime : 0
    setLevelPlayTimes(prev => [...prev, levelPlayTime])
    
    // Calculate reaction time based on mode
    let reactionTime: number
    if (selectedMode.id === 'audio' && audioStartTime) {
      // For audio mode, measure from when audio actually started playing
      reactionTime = Date.now() - audioStartTime
    } else {
      // For visual and stroop modes, measure from round start
      reactionTime = Date.now() - roundStartTime
    }
    
    setReactionTimes(prev => [...prev, reactionTime])
    
    let isCorrect = false
    if (selectedMode.id === 'stroop') {
      isCorrect = stroopPhase === 'word' 
        ? selectedColor.name === targetColor.name 
        : selectedColor.name === displayColor?.name
    } else {
      isCorrect = selectedColor.name === targetColor.name
    }
    
    if (isCorrect) {
      playSound('correct')
      setScore(prev => prev + 1)
      setCorrectAnswers(prev => prev + 1)
      
      if (selectedMode.id === 'stroop') {
        if (stroopPhase === 'word') {
          setWordPhaseRT(prev => [...prev, reactionTime])
          setWordPhaseCorrect(prev => prev + 1)
        } else {
          setColorPhaseRT(prev => [...prev, reactionTime])
          setColorPhaseCorrect(prev => prev + 1)
        }
      }
      
      setMessage('Correct! 🎉')
      setTimeout(() => setMessage(''), 1000)
      startNewRound()
    } else {
      playSound('wrong')
      
      if (selectedMode.id === 'stroop') {
        if (stroopPhase === 'word') {
          setWordPhaseRT(prev => [...prev, reactionTime])
        } else {
          setColorPhaseRT(prev => [...prev, reactionTime])
        }
      }
      
      endGame()
    }
  }, [gameActive, selectedMode, targetColor, roundStartTime, audioStartTime, levelStartTime, stroopPhase, displayColor, showPhaseTransition, showInitialStroopInstructions, playSound, startNewRound, endGame])

  const startGame = useCallback((mode: GameMode) => {
    setScore(0)
    setRound(0)
    setCorrectAnswers(0)
    setReactionTimes([])
    setMessage('')
    setSaveError('')
    setSelectedMode(mode)
    setScreen('game')
    
    // Reset cognitive metrics
    setSessionData(null)
    setWordPhaseRT([])
    setColorPhaseRT([])
    setWordPhaseCorrect(0)
    setColorPhaseCorrect(0)
    setTotalRounds(0)
    setAudioStartTime(null)
    setLevelPlayTimes([])
    setLevelStartTime(null)
    
    const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5)
    const gameColors = shuffledColors.slice(0, 4)
    setAvailableColors(gameColors)
    
    const target = gameColors[Math.floor(Math.random() * gameColors.length)]
    setTargetColor(target)
    
    if (mode.id === 'audio') {
      playColorAudio(target.audio)
    }
    
    if (mode.id === 'stroop') {
      const otherColors = gameColors.filter(c => c.name !== target.name)
      if (otherColors.length > 0) {
        setDisplayColor(otherColors[Math.floor(Math.random() * otherColors.length)])
      } else {
        setDisplayColor(target)
      }
      
      setStroopPhase('word')
      setStroopRoundsInPhase(0)
      setShowPhaseTransition(false)
      setShowInitialStroopInstructions(true)
      setGameActive(false)
    } else {
      setDisplayColor(target)
      setGameActive(true)
    }
    
    const baseTime = mode.id === 'audio' ? 3000 : 2500
    setTimeLeft(baseTime)
    setGameStartTime(Date.now())
    setRoundStartTime(Date.now())
    setLevelStartTime(Date.now())
    setRound(1)
    setTotalRounds(1)
  }, [playColorAudio])

  const restartGame = () => {
    if (!selectedMode) return
    startGame(selectedMode)
  }

  const toggleSound = () => {
    const newState = !soundEnabled
    setSoundEnabled(newState)
    localStorage.setItem('colorQuickSound', newState.toString())
  }

  const startStroopPhase1 = () => {
    setShowInitialStroopInstructions(false)
    setGameActive(true)
    const baseTime = 2500
    setTimeLeft(baseTime)
    setRoundStartTime(Date.now())
    setLevelStartTime(Date.now())
  }

  const startStroopPhase2 = () => {
    setStroopPhase('color')
    setStroopRoundsInPhase(0)
    setShowPhaseTransition(false)
    setGameActive(true)
    const baseTime = 2500
    setTimeLeft(baseTime)
    setRoundStartTime(Date.now())
    
    const shuffledColors = [...COLORS].sort(() => Math.random() - 0.5)
    const numColors = Math.min(4 + Math.floor(score / 5), 6)
    const gameColors = shuffledColors.slice(0, numColors)
    setAvailableColors(gameColors)
    
    const target = gameColors[Math.floor(Math.random() * gameColors.length)]
    setTargetColor(target)
    
    const otherColors = gameColors.filter(c => c.name !== target.name)
    if (otherColors.length > 0) {
      setDisplayColor(otherColors[Math.floor(Math.random() * otherColors.length)])
    } else {
      setDisplayColor(target)
    }
    
    setRound(prev => prev + 1)
    setTotalRounds(prev => prev + 1)
  }

  // Timer effect
  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 16)
      }, 16)
    } else if (gameActive && timeLeft <= 0) {
      endGame()
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [gameActive, timeLeft, endGame])

  const avgReactionTime = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b) / reactionTimes.length)
    : 0
  const accuracy = totalRounds > 0 ? Math.round((correctAnswers / totalRounds) * 100) : 0
  const timeProgress = selectedMode?.id === 'stroop' ? timeLeft / 2500 : timeLeft / (selectedMode?.id === 'audio' ? 3000 : 2500)

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white font-sans flex flex-col items-center justify-center p-6">
      {/* Loading and Error indicators */}
      {isLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          💾 Saving game data...
        </div>
      )}
      
      {saveError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          ⚠️ {saveError}
        </div>
      )}

      {screen === 'menu' && (
        <div className="text-center space-y-8 max-w-md">
          <div className="space-y-4">
            <button
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
              onClick={() => setScreen('mode-select')}
            >
              START GAME 🚀
            </button>
            
            <div className="flex gap-4 justify-center">
              <button
                className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                onClick={toggleSound}
              >
                {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
              </button>
              <button
                className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                onClick={() => setScreen('stats')}
              >
                📊 Stats
              </button>
              {allSessionData.length > 0 && (
                <button
                  className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                  onClick={() => setScreen('analytics')}
                >
                  🧠 Analytics ({allSessionData.length})
                </button>
              )}
            </div>
            
            <div className="text-center">
              <button
                className="px-6 py-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-xl transition-all duration-200 text-sm"
                onClick={() => router.push('/Prep/PrepGames/GameSelection')}
              >
                🏠 Return to Game Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'mode-select' && (
        <div className="space-y-6 max-w-2xl mx-auto w-full">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Choose Your Challenge</h2>
            <p className="text-gray-300">Each mode trains different cognitive skills</p>
          </div>
          
          <div className="space-y-4">
            {GAME_MODES.map(mode => (
              <div
                key={mode.id}
                className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 cursor-pointer transition-all duration-200 transform hover:scale-105"
                onClick={() => startGame(mode)}
                style={{ boxShadow: `0 0 30px ${mode.color}40` }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
                    style={{ backgroundColor: mode.color + '40', borderColor: mode.color }}
                  >
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{mode.name}</h3>
                    <p className="text-gray-300 mb-2">{mode.description}</p>
                    <p className="text-sm text-gray-400 italic">{mode.skills}</p>
                    {userId && userStats?.modeStats?.[mode.id] && (
                      <p className="text-xs text-green-400 mt-1">
                        Best: {userStats.modeStats[mode.id].bestScore} | Played: {userStats.modeStats[mode.id].gamesPlayed}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <button 
              onClick={() => setScreen('menu')} 
              className="text-gray-400 hover:text-white transition-colors duration-200 mr-4"
            >
              ← Back to Menu
            </button>
            <button
              className="px-4 py-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-xl transition-all duration-200 text-sm"
              onClick={() => router.push('/Prep/PrepGames/GameSelection')}
            >
              🏠 Return to Game Selection
            </button>
          </div>
        </div>
      )}

      {screen === 'game' && (
        <div className="space-y-6 max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2">
              <span className="text-xl font-bold">Score: {score}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2">
              <span className="text-lg">{selectedMode?.icon} {selectedMode?.name}</span>
            </div>
          </div>

          {gameActive && (
            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-red-500 transition-all duration-75"
                style={{ width: `${timeProgress * 100}%` }}
              />
            </div>
          )}

          {showInitialStroopInstructions && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">🧠</div>
              <h3 className="text-3xl font-bold mb-4">Stroop Test - Phase 1</h3>
              <div className="space-y-4 mb-6">
                <p className="text-lg text-gray-300">
                  In this phase, you need to click the color that matches what the <strong>WORD</strong> says.
                </p>
                <p className="text-md text-gray-400">
                  Ignore the actual color of the text - focus only on the meaning of the word!
                </p>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-sm text-gray-400">Example:</p>
                  <p className="text-lg">If you see <span style={{color: '#ef4444'}}>BLUE</span></p>
                  <p className="text-sm text-gray-300">Click the BLUE button (not the red button)</p>
                </div>
              </div>
              <button
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95"
                onClick={startStroopPhase1}
              >
                Start Phase 1 (Word Meaning)
              </button>
            </div>
          )}

          {showPhaseTransition && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-3xl font-bold mb-4">Phase 1 Complete!</h3>
              <div className="space-y-4 mb-6">
                <p className="text-lg text-green-400 font-bold">Great job! You completed the word phase.</p>
                <p className="text-lg text-gray-300">
                  Now for Phase 2: Click the color that matches the <strong>TEXT COLOR</strong>.
                </p>
                <p className="text-md text-gray-400">
                  This time, ignore what the word says - focus only on the color of the text!
                </p>
                <div className="bg-white/10 rounded-xl p-4">
                  <p className="text-sm text-gray-400">Example:</p>
                  <p className="text-lg">If you see <span style={{color: '#ef4444'}}>BLUE</span></p>
                  <p className="text-sm text-gray-300">Click the RED button (not the blue button)</p>
                </div>
              </div>
              <button
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full text-xl font-bold transition-all duration-200 transform hover:scale-105 active:scale-95"
                onClick={startStroopPhase2}
              >
                Start Phase 2 (Text Color)
              </button>
            </div>
          )}

          {!showPhaseTransition && !showInitialStroopInstructions && (
            <div className="text-center space-y-4 min-h-[200px] flex flex-col justify-center">
              {!targetColor ? (
                <div className="text-4xl text-white animate-pulse">Get Ready... 🎯</div>
              ) : selectedMode?.id === 'audio' ? (
                <div className="space-y-2">
                  <div className="text-6xl animate-pulse">🔊</div>
                  <p className="text-lg text-gray-300">Listen and select the color!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    className="text-6xl font-bold inline-block px-8 py-4 rounded-2xl shadow-2xl"
                    style={{
                      color: selectedMode?.id === 'visual' || selectedMode?.id === 'stroop' 
                        ? displayColor?.color 
                        : '#ffffff',
                      textShadow: '0 0 20px rgba(255,255,255,0.5)'
                    }}
                  >
                    {targetColor.name}
                  </div>
                  {selectedMode?.id === 'stroop' && (
                    <div className="text-lg font-normal text-white min-h-[28px] flex items-center justify-center">
                      {stroopPhase === 'word' ? '(Click the color the WORD describes)' : '(Click the COLOR of the text)'}
                    </div>
                  )}
                </div>
              )}
              
              <div className="min-h-[32px] flex items-center justify-center">
                {message && (
                  <div className="text-2xl font-bold text-green-400 animate-pulse">{message}</div>
                )}
              </div>
            </div>
          )}

          {!showPhaseTransition && !showInitialStroopInstructions && (
            <div className="grid gap-4 justify-center" style={{ gridTemplateColumns: `repeat(${Math.min(availableColors.length, 4)}, 1fr)` }}>
              {availableColors.map((color, i) => (
                <button
                  key={i}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-white/30 transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-xl"
                  style={{
                    backgroundColor: color.color,
                    boxShadow: `0 0 20px ${color.color}60`
                  }}
                  onClick={() => checkAnswer(color)}
                />
              ))}
            </div>
          )}

          {selectedMode?.id === 'stroop' && !showPhaseTransition && !showInitialStroopInstructions && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center min-h-[120px] flex flex-col justify-center">
              <div className="text-lg font-bold mb-2">
                Phase {stroopPhase === 'word' ? '1' : '2'}: {stroopPhase === 'word' ? 'Word Meaning' : 'Text Color'}
              </div>
              <div className="text-sm text-gray-300">
                {stroopPhase === 'word' 
                  ? 'Click the color the word describes'
                  : 'Click the color of the text'
                }
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Round {stroopRoundsInPhase + 1} of 10
              </div>
            </div>
          )}

          {round <= 2 && selectedMode?.id !== 'stroop' && !showPhaseTransition && !showInitialStroopInstructions && (
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-center min-h-[80px] flex items-center justify-center">
              <p className="text-gray-300">{selectedMode?.description}</p>
            </div>
          )}
        </div>
      )}

      {screen === 'game-over' && (
        <div className="text-center space-y-6 max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8">
            <h2 className="text-4xl font-bold mb-6">Game Over! 🎮</h2>
            
            <div className="space-y-4 mb-6">
              <div className="text-3xl font-bold">Final Score: {score}</div>
              {score === highScore && score > 0 && (
                <div className="text-yellow-400 font-bold animate-pulse">🏆 New High Score!</div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl">⏱️</div>
                  <div className="text-sm text-gray-300">Avg Time</div>
                  <div className="font-bold">{avgReactionTime}ms</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl">🎯</div>
                  <div className="text-sm text-gray-300">Accuracy</div>
                  <div className="font-bold">{accuracy}%</div>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-sm text-gray-300 mb-2">Mode Played</div>
                <div className="flex items-center justify-center gap-2">
                  <span>{selectedMode?.icon}</span>
                  <span className="font-bold">{selectedMode?.name}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">{selectedMode?.skills}</div>
              </div>

              {sessionData && (
                <div className="text-left text-sm text-gray-300 bg-white/10 rounded-xl p-6 space-y-3">
                  <h3 className="text-lg font-bold text-white text-center mb-4">📊 Session Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><strong>Total Rounds:</strong> {sessionData.totalRounds}</div>
                    <div><strong>Date:</strong> {sessionData.date.split(',')[0]}</div>
                    <div><strong>Fastest RT:</strong> {Math.min(...sessionData.reactionTimes)}ms</div>
                    <div><strong>Slowest RT:</strong> {Math.max(...sessionData.reactionTimes)}ms</div>
                    <div><strong>Avg Level Time:</strong> {sessionData.avgLevelPlayTime}ms</div>
                    <div><strong>Total Duration:</strong> {Math.round(sessionData.totalGameDuration / 1000)}s</div>
                  </div>
                  
                  {sessionData.stroopDetails && (
                    <div className="mt-4 p-4 bg-white/10 rounded-lg">
                      <div className="text-yellow-300 font-bold mb-3 text-center">🧠 Stroop Test Analysis</div>
                      <div className="space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="font-bold text-blue-300">Word Phase (Phase 1)</div>
                            <div>Accuracy: {sessionData.stroopDetails.wordPhase.accuracy}%</div>
                            <div>Avg RT: {sessionData.stroopDetails.wordPhase.avgReactionTime}ms</div>
                            <div>Trials: {sessionData.stroopDetails.wordPhase.trials}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold text-red-300">Color Phase (Phase 2)</div>
                            <div>Accuracy: {sessionData.stroopDetails.colorPhase.accuracy}%</div>
                            <div>Avg RT: {sessionData.stroopDetails.colorPhase.avgReactionTime}ms</div>
                            <div>Trials: {sessionData.stroopDetails.colorPhase.trials}</div>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-white/20">
                          <div className="text-center">
                            <strong className="text-orange-300">Stroop Effect:</strong> {sessionData.stroopDetails.stroopEffect}ms interference
                          </div>
                          <div className="text-xs text-gray-400 text-center mt-1">
                            (Higher = More cognitive interference)
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <button 
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full font-bold transition-all duration-200 transform hover:scale-105 active:scale-95"
                onClick={restartGame}
              >
                Play Again
              </button>
              <button 
                className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-full font-bold transition-all duration-200"
                onClick={() => setScreen('menu')}
              >
                Back to Menu
              </button>
              <button
                className="w-full py-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-full transition-all duration-200 text-sm"
                onClick={() => router.push('/Prep/PrepGames/GameSelection')}
              >
                🏠 Return to Game Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'stats' && (
        <div className="text-center max-w-md mx-auto space-y-6">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8">
            <h2 className="text-3xl font-bold mb-6">Performance Stats 📊</h2>
            
            <div className="space-y-4">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-xl font-bold">High Score</div>
                <div className="text-3xl font-bold text-yellow-400">{highScore}</div>
              </div>
              
              {userId && userStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300">Games Played</div>
                      <div className="font-bold">{userStats.totalGamesPlayed || 0}</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300">Total Rounds</div>
                      <div className="font-bold">{userStats.totalRounds || 0}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300">Avg Accuracy</div>
                      <div className="font-bold">{Math.round(userStats.averageAccuracy || 0)}%</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300">Avg RT</div>
                      <div className="font-bold">{Math.round(userStats.averageReactionTime || 0)}ms</div>
                    </div>
                  </div>
                  
                  {userStats.lastPlayed && (
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-sm text-gray-300">Last Played</div>
                      <div className="font-bold text-xs">{new Date(userStats.lastPlayed).toLocaleDateString()}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-sm text-gray-300">Sound</div>
                    <div className="font-bold">{soundEnabled ? '🔊 On' : '🔇 Off'}</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-sm text-gray-300">Sessions</div>
                    <div className="font-bold">{allSessionData.length}</div>
                  </div>
                </div>
              )}
              
              <div className="bg-white/10 rounded-xl p-4">
                <div className="text-sm text-gray-300 mb-2">Cognitive Benefits</div>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>• Improved reaction time and processing speed</p>
                  <p>• Enhanced cognitive flexibility</p>
                  <p>• Better inhibition control (Stroop effect)</p>
                  <p>• Increased sustained attention</p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setScreen('menu')} 
              className="mt-6 text-gray-400 hover:text-white transition-colors duration-200 mr-4"
            >
              ← Back to Menu
            </button>
            <button
              className="mt-6 px-4 py-2 bg-gray-600/80 hover:bg-gray-600 text-white rounded-xl transition-all duration-200 text-sm"
              onClick={() => router.push('/Prep/PrepGames/GameSelection')}
            >
              🏠 Return to Game Selection
            </button>
          </div>
        </div>
      )}

      {screen === 'analytics' && (
        <div className="space-y-8 max-w-4xl mx-auto">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-4">🧠 Cognitive Analytics</h2>
            <p className="text-gray-300">Performance metrics across all sessions</p>
            {userId && (
              <p className="text-sm text-green-400 mt-2">✅ Synced with your account</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-blue-400">
                {allSessionData.reduce((sum, session) => sum + session.totalRounds, 0)}
              </div>
              <div className="text-gray-300">Total Rounds</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-green-400">
                {Math.round(allSessionData.reduce((sum, session) => sum + session.accuracy, 0) / allSessionData.length || 0)}%
              </div>
              <div className="text-gray-300">Avg Accuracy</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center">
              <div className="text-3xl font-bold text-purple-400">
                {Math.round(allSessionData.reduce((sum, session) => sum + session.avgReactionTime, 0) / allSessionData.length || 0)}ms
              </div>
              <div className="text-gray-300">Avg Reaction Time</div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white text-center">Session History</h3>
            <div className="grid gap-4 max-h-96 overflow-y-auto">
              {allSessionData.slice().reverse().map((session, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-xl font-bold text-white capitalize flex items-center gap-2">
                        {GAME_MODES.find(mode => mode.id === session.mode)?.icon}
                        {session.mode} Mode
                      </h4>
                      <p className="text-gray-400 text-sm">{session.date}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{session.accuracy}%</div>
                      <div className="text-gray-400 text-sm">Accuracy</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{session.avgReactionTime}ms</div>
                      <div className="text-gray-400">Avg RT</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{session.correctAnswers}/{session.totalRounds}</div>
                      <div className="text-gray-400">Correct</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{Math.min(...session.reactionTimes)}ms</div>
                      <div className="text-gray-400">Fastest</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-white">{session.score}</div>
                      <div className="text-gray-400">Score</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div className="text-center bg-white/10 rounded-lg p-2">
                      <div className="text-lg font-bold text-white">{session.avgLevelPlayTime}ms</div>
                      <div className="text-gray-400">Avg Level Time</div>
                    </div>
                    <div className="text-center bg-white/10 rounded-lg p-2">
                      <div className="text-lg font-bold text-white">{Math.round(session.totalGameDuration / 1000)}s</div>
                      <div className="text-gray-400">Total Duration</div>
                    </div>
                  </div>
                  
                  {session.stroopDetails && (
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="text-yellow-300 font-bold mb-3 text-center">🧠 Stroop Analysis</div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="font-bold text-blue-300">Word Phase</div>
                          <div>Accuracy: {session.stroopDetails.wordPhase.accuracy}%</div>
                          <div>Avg RT: {session.stroopDetails.wordPhase.avgReactionTime}ms</div>
                        </div>
                        <div className="space-y-1">
                          <div className="font-bold text-red-300">Color Phase</div>
                          <div>Accuracy: {session.stroopDetails.colorPhase.accuracy}%</div>
                          <div>Avg RT: {session.stroopDetails.colorPhase.avgReactionTime}ms</div>
                        </div>
                      </div>
                      <div className="text-center mt-3 pt-3 border-t border-white/20">
                        <div className="text-orange-300 font-bold">
                          Stroop Effect: {session.stroopDetails.stroopEffect}ms
                        </div>
                        <div className="text-xs text-gray-400">
                          {session.stroopDetails.stroopEffect > 0 ? 
                            'Normal interference pattern' : 
                            'Unusual pattern detected'
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => setScreen('menu')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-xl transition-all duration-200 mr-4"
            >
              ← Back to Menu
            </button>
            <button
              className="px-6 py-3 bg-gray-600/80 hover:bg-gray-600 text-white rounded-xl transition-all duration-200"
              onClick={() => router.push('/Prep/PrepGames/GameSelection')}
            >
              🏠 Return to Game Selection
            </button>
          </div>
        </div>
      )}
    </main>
  )
}