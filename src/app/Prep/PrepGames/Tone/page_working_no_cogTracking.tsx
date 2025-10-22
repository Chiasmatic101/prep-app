'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import { motion, AnimatePresence } from 'framer-motion'

type GridPreset = 4 | 6

type Card = {
  id: number
  tone: number
  isFlipped: boolean
  isMatched: boolean
}

// 18 distinct musical-ish pitches (enough for 6x6 => 18 pairs)
const TONES = [
  261.63, // C4
  277.18, // C#4
  293.66, // D4
  311.13, // D#4
  329.63, // E4
  349.23, // F4
  369.99, // F#4
  392.00, // G4
  415.30, // G#4
  440.00, // A4
  466.16, // A#4
  493.88, // B4
  523.25, // C5
  554.37, // C#5
  587.33, // D5
  622.25, // D#5
  659.25, // E5
  698.46, // F5
]

// ---- Flip Animation Variants (same feel as your visual game) ---- //
const flipVariants = {
  initial: { rotateY: 0 },
  flipped: { rotateY: 180 },
}

const faceVariants = {
  hidden: { rotateY: 0, opacity: 1 },
  shown: { rotateY: 180, opacity: 1 },
}

const backVariants = {
  hidden: { rotateY: 180, opacity: 0 },
  shown: { rotateY: 0, opacity: 1 },
}

export default function SoundMatchGame() {
  // ---- Config ---- //
  const [grid, setGrid] = useState<GridPreset>(6) // default 6x6
  const totalCards = grid * grid
  const pairCount = totalCards / 2

  // ---- Game State ---- //
  const [deck, setDeck] = useState<Card[]>([])
  const [firstPick, setFirstPick] = useState<Card | null>(null)
  const [secondPick, setSecondPick] = useState<Card | null>(null)
  const [locked, setLocked] = useState(false)

  const [moves, setMoves] = useState(0)
  const [matches, setMatches] = useState(0)
  const [score, setScore] = useState(0)

  const [started, setStarted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [muted, setMuted] = useState(false)
  const [showStats, setShowStats] = useState(false)

  // ---- Audio (shared AudioContext + master gain) ---- //
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)

  const ensureAudio = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      audioCtxRef.current = new Ctx()
      masterGainRef.current = audioCtxRef.current.createGain()
      masterGainRef.current.gain.value = muted ? 0 : 0.25 // comfortable default
      masterGainRef.current.connect(audioCtxRef.current.destination)
    } else {
      // On iOS/Safari contexts can be suspended; resume on gesture
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = muted ? 0 : 0.25
      }
    }
  }

  const playTone = (frequency: number, duration = 0.5) => {
    if (muted) return
    ensureAudio()
    const ctx = audioCtxRef.current!
    const master = masterGainRef.current!

    // Osc + Gain with a quick envelope to avoid clicks
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine' // can be 'triangle' / 'square' if you want distinct timbres
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)

    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 0.02) // quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + Math.max(0.05, duration)) // release

    osc.connect(gain)
    gain.connect(master)

    osc.start()
    osc.stop(ctx.currentTime + Math.max(0.08, duration + 0.02))
  }

  const playSuccess = () => {
    // a small “ding-ding” (two quick tones)
    if (muted) return
    ensureAudio()
    playTone(880, 0.12)
    setTimeout(() => playTone(1175, 0.12), 120)
  }

  const playMiss = () => {
    if (muted) return
    ensureAudio()
    playTone(196, 0.12)
  }

  // ---- Helpers ---- //
  const isComplete = matches === pairCount && pairCount > 0

  const difficultyLabel = useMemo(() => {
    if (grid === 4) return 'Quick (Audio)'
    if (grid === 6) return 'Classic (Audio)'
    return 'Custom (Audio)'
  }, [grid])

  // Score: reward matches; light penalty for time & moves
  useEffect(() => {
    const raw = matches * 140 - moves * 3 - Math.floor(seconds * 0.5)
    setScore(Math.max(0, raw))
  }, [matches, moves, seconds])

  // Timer
  useEffect(() => {
    if (!started || isComplete) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [started, isComplete])

  // Build a deck from tones
  const buildDeck = (size: GridPreset): Card[] => {
    const needed = (size * size) / 2
    const tones = shuffle([...TONES]).slice(0, needed)
    const doubled = shuffle([...tones, ...tones])
    return doubled.map((tone, idx) => ({
      id: idx,
      tone,
      isFlipped: false,
      isMatched: false,
    }))
  }

  // Fisher–Yates
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const startNewGame = (size: GridPreset = grid) => {
    setGrid(size)
    setDeck(buildDeck(size))
    setFirstPick(null)
    setSecondPick(null)
    setLocked(false)
    setMoves(0)
    setMatches(0)
    setScore(0)
    setSeconds(0)
    setStarted(false)
  }

  // Init
  useEffect(() => {
    startNewGame(grid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Interactions ---- //
  const onFlip = (card: Card) => {
    if (locked || card.isMatched || card.isFlipped) return

    // First user gesture should (re)enable audio
    ensureAudio()

    // Flip visually
    setDeck(prev =>
      prev.map(c => (c.id === card.id ? { ...c, isFlipped: true } : c))
    )

    // Play its tone
    playTone(card.tone)

    // Start timer on first flip
    if (!started) setStarted(true)

    if (!firstPick) {
      setFirstPick({ ...card, isFlipped: true })
      return
    }

    if (!secondPick) {
      setSecondPick({ ...card, isFlipped: true })
      setLocked(true)
      setMoves(m => m + 1)

      const a = firstPick
      const b = { ...card, isFlipped: true }

      if (a.tone === b.tone) {
        // Match
        setTimeout(() => {
          setDeck(prev =>
            prev.map(c =>
              c.tone === a.tone ? { ...c, isMatched: true } : c
            )
          )
          setMatches(x => x + 1)
          playSuccess()
          resetPicks()
          if (navigator.vibrate) navigator.vibrate(20)
        }, 280)
      } else {
        // Miss — flip back after a short delay
        setTimeout(() => {
          setDeck(prev =>
            prev.map(c =>
              c.id === a.id || c.id === b.id ? { ...c, isFlipped: false } : c
            )
          )
          playMiss()
          resetPicks()
          if (navigator.vibrate) navigator.vibrate(8)
        }, 900)
      }
    }
  }

  const resetPicks = () => {
    setFirstPick(null)
    setSecondPick(null)
    setLocked(false)
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }

  // ---- UI ---- //
  return (
    <main className="min-h-screen bg-gray-950 text-white font-sans flex flex-col items-center p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Sound Match
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:text-base text-gray-300">
          <span className="px-2 py-1 rounded bg-white/5">{difficultyLabel}</span>
          <span>Grid: {grid}×{grid}</span>
          <span>•</span>
          <span>Moves: <span className="text-blue-300 font-semibold">{moves}</span></span>
          <span>•</span>
          <span>Time: <span className="text-purple-300 font-semibold">{formatTime(seconds)}</span></span>
          <span>•</span>
          <span>Score: <span className="text-pink-300 font-semibold">{score}</span></span>
          <span>•</span>
          <span>Pairs: <span className="text-green-300 font-semibold">{matches}/{pairCount}</span></span>
          <span>•</span>
          <button
            onClick={() => {
              setMuted(m => !m)
              // also immediately reflect volume if context exists
              if (masterGainRef.current) {
                masterGainRef.current.gain.value = !muted ? 0 : 0.25
              }
            }}
            className={classNames(
              'px-2 py-1 rounded border',
              muted ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-blue-500/50 bg-blue-500/10 text-blue-200'
            )}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>

      {/* Message / CTA */}
      <div className="h-10 mb-4 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={`${started}-${matches}-${moves}-${muted}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-gray-300"
          >
            {isComplete
              ? 'Great ear! All pairs matched 🎉'
              : !started
              ? 'Flip any card to hear its tone'
              : secondPick
              ? 'Listening...'
              : 'Match pairs by sound only'}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => startNewGame(grid)}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
        >
          Reset
        </button>

        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-2 py-1">
          <span className="text-xs text-gray-300">Grid</span>
          <button
            onClick={() => startNewGame(4)}
            className={classNames(
              'px-3 py-1 rounded-md text-sm transition',
              grid === 4 ? 'bg-blue-600' : 'hover:bg-gray-700'
            )}
          >
            4×4
          </button>
          <button
            onClick={() => startNewGame(6)}
            className={classNames(
              'px-3 py-1 rounded-md text-sm transition',
              grid === 6 ? 'bg-blue-600' : 'hover:bg-gray-700'
            )}
          >
            6×6
          </button>
        </div>

        <button
          onClick={() => setShowStats(s => !s)}
          className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
        >
          📊 Stats
        </button>
      </div>

      {/* Grid */}
      <div
        className={classNames(
          'grid gap-3 md:gap-4',
          grid === 4 ? 'grid-cols-4' : 'grid-cols-6'
        )}
      >
        {deck.map(card => (
          <motion.button
            key={card.id}
            onClick={() => onFlip(card)}
            disabled={locked || card.isMatched}
            className={classNames(
              'relative rounded-xl w-20 h-28 md:w-24 md:h-32 border-2 focus:outline-none',
              'transition disabled:opacity-60 disabled:cursor-not-allowed',
              card.isMatched ? 'border-green-400/70' : 'border-gray-700'
            )}
            whileHover={locked || card.isMatched ? {} : { scale: 1.02 }}
            whileTap={locked || card.isMatched ? {} : { scale: 0.98 }}
            style={{ perspective: 1000 }}
          >
            {/* Flip wrapper */}
            <motion.div
              className="relative w-full h-full preserve-3d"
              animate={card.isFlipped || card.isMatched ? 'flipped' : 'initial'}
              variants={flipVariants}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              {/* Front (face down) */}
              <motion.div
                className={classNames(
                  'absolute inset-0 backface-hidden rounded-xl',
                  'bg-gradient-to-br from-gray-800 to-gray-900',
                  'flex items-center justify-center border border-gray-700/70',
                  'shadow-[0_0_20px_rgba(0,0,0,0.35)]'
                )}
                variants={faceVariants}
                animate={card.isFlipped || card.isMatched ? 'hidden' : 'shown'}
                transition={{ duration: 0.28 }}
              >
                {/* Neutral symbol so players can’t rely on visuals */}
                <div className="w-10 h-10 rounded-lg bg-white/5" />
              </motion.div>

              {/* Back (face up) — keep visuals neutral to enforce audio memory */}
              <motion.div
                className={classNames(
                  'absolute inset-0 backface-hidden rounded-xl rotateY-180',
                  'bg-gradient-to-br from-purple-600/30 to-pink-600/30',
                  'flex items-center justify-center border border-purple-500/50',
                  'shadow-[0_0_24px_rgba(168,85,247,0.35)]'
                )}
                variants={backVariants}
                animate={card.isFlipped || card.isMatched ? 'shown' : 'hidden'}
                transition={{ duration: 0.28 }}
              >
                {/* Optional: minimal, non-informative pulse when playing */}
                <motion.div
                  className="w-3 h-3 rounded-full bg-white/40"
                  animate={card.isFlipped && !card.isMatched ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.4, repeat: card.isFlipped && !card.isMatched ? Infinity : 0 }}
                />
              </motion.div>
            </motion.div>
          </motion.button>
        ))}
      </div>

      {/* Win banner */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="mt-6 text-center"
          >
            <p className="text-lg text-gray-300">
              Completed in <span className="font-semibold text-purple-300">{moves}</span> moves,{' '}
              <span className="font-semibold text-purple-300">{formatTime(seconds)}</span>.
            </p>
            <p className="mt-1 text-xl font-bold text-pink-300">Score: {score}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Panel */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowStats(false)}
          >
            <motion.div
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Session Stats
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span>Grid</span><span>{grid}×{grid}</span></div>
                <div className="flex justify-between"><span>Moves</span><span>{moves}</span></div>
                <div className="flex justify-between"><span>Time</span><span>{formatTime(seconds)}</span></div>
                <div className="flex justify-between"><span>Score</span><span>{score}</span></div>
                <div className="flex justify-between"><span>Pairs Found</span><span>{matches}/{pairCount}</span></div>
                <div className="flex justify-between"><span>Status</span><span>{isComplete ? 'Completed 🎉' : 'In progress'}</span></div>
                <div className="flex justify-between"><span>Audio</span><span>{muted ? 'Muted' : 'On'}</span></div>
              </div>
              <button
                className="mt-6 w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition"
                onClick={() => setShowStats(false)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
