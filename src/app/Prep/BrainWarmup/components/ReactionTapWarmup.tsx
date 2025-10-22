'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

interface WarmupGameProps {
  duration: number
  onComplete: () => void
  timeLeft: number
  isActive: boolean
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

export default function ReactionTapWarmup({ duration, onComplete, timeLeft, isActive }: WarmupGameProps) {
  const [currentLetter, setCurrentLetter] = useState<string>('')
  const [score, setScore] = useState<number>(0)
  const [letterShowTime, setLetterShowTime] = useState<number>(0)
  const [reactionTime, setReactionTime] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState<boolean>(false)
  const [consecutiveHits, setConsecutiveHits] = useState<number>(0)
  const [missedLetters, setMissedLetters] = useState<number>(0)
  
  const missTimeout = useRef<NodeJS.Timeout | null>(null)
  const feedbackTimeout = useRef<NodeJS.Timeout | null>(null)

  const showNextLetter = useCallback(() => {
    if (!isActive) return
    
    const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)]
    setCurrentLetter(randomLetter)
    setLetterShowTime(Date.now())
    setReactionTime(null)
    setShowFeedback(false)
    
    // Auto-advance after 2 seconds if no response (counts as miss)
    missTimeout.current = setTimeout(() => {
      if (isActive && currentLetter) {
        setMissedLetters(prev => prev + 1)
        setConsecutiveHits(0)
        showNextLetter()
      }
    }, 2000)
  }, [isActive, currentLetter])

  useEffect(() => {
    if (isActive && !currentLetter && !showFeedback) {
      // Small delay before first letter or between letters
      const delay = score === 0 ? 1000 : 300
      setTimeout(showNextLetter, delay)
    }
  }, [isActive, showNextLetter, currentLetter, showFeedback, score])

  const handleCorrectLetter = useCallback(() => {
    if (!isActive || !currentLetter || showFeedback) return
    
    const now = Date.now()
    const reaction = now - letterShowTime
    
    // Clear the miss timeout
    if (missTimeout.current) {
      clearTimeout(missTimeout.current)
    }
    
    setScore(prev => prev + 1)
    setReactionTime(reaction)
    setShowFeedback(true)
    setConsecutiveHits(prev => prev + 1)
    
    // Show feedback briefly, then next letter
    feedbackTimeout.current = setTimeout(() => {
      setCurrentLetter('')
      setShowFeedback(false)
    }, 500)
  }, [isActive, currentLetter, letterShowTime, showFeedback])

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!isActive || !currentLetter || showFeedback) return
    
    const pressedKey = event.key.toUpperCase()
    
    if (pressedKey === currentLetter) {
      handleCorrectLetter()
    } else if (/^[A-Z]$/.test(pressedKey)) {
      // Wrong letter pressed - count as miss and show feedback
      setMissedLetters(prev => prev + 1)
      setConsecutiveHits(0)
      // Flash red or show wrong feedback briefly
      setShowFeedback(true)
      setTimeout(() => {
        setShowFeedback(false)
      }, 300)
    }
  }, [isActive, currentLetter, showFeedback, handleCorrectLetter])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (missTimeout.current) clearTimeout(missTimeout.current)
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    }
  }, [])

  const getPerformanceMessage = () => {
    if (consecutiveHits >= 10) return "🔥 Incredible Streak!"
    if (consecutiveHits >= 5) return "⚡ Amazing Focus!"
    if (consecutiveHits >= 3) return "🎯 Great Rhythm!"
    if (reactionTime && reactionTime < 200) return "🚀 Lightning Fast!"
    if (reactionTime && reactionTime < 400) return "👍 Quick Reflexes!"
    return "⌨️ Keep Typing!"
  }

  const getAccuracy = () => {
    const totalAttempts = score + missedLetters
    return totalAttempts > 0 ? Math.round((score / totalAttempts) * 100) : 0
  }

  const getLetterColor = () => {
    if (showFeedback) {
      return consecutiveHits > 0 ? "text-green-400" : "text-red-400"
    }
    if (consecutiveHits >= 5) return "text-yellow-300"
    if (consecutiveHits >= 3) return "text-blue-300"
    return "text-white"
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-md w-full">
        {/* Score and Stats */}
        <div className="mb-8">
          <div className="text-4xl font-bold mb-2 text-white">
            Score: <span className="text-green-400">{score}</span>
          </div>
          <div className="flex justify-center gap-4 text-sm opacity-90 mb-3">
            <span>Accuracy: {getAccuracy()}%</span>
            <span>Streak: {consecutiveHits}</span>
            {reactionTime && <span>{reactionTime}ms</span>}
          </div>
          <div className="text-lg opacity-90">
            {getPerformanceMessage()}
          </div>
        </div>
        
        {/* Main Letter Display */}
        <div className="mb-8 flex justify-center">
          {currentLetter && !showFeedback ? (
            <div className={`text-9xl font-bold transition-all duration-200 ${getLetterColor()}`}>
              {currentLetter}
            </div>
          ) : showFeedback ? (
            <div className={`text-8xl font-bold transition-all duration-200 ${
              consecutiveHits > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {consecutiveHits > 0 ? '✓' : '✗'}
            </div>
          ) : (
            <div className="text-6xl text-white/30 animate-pulse">
              ...
            </div>
          )}
        </div>
        
        {/* Instructions */}
        <div className="text-sm opacity-75 space-y-2">
          <div className="text-lg font-semibold">Press the letter on your keyboard!</div>
          <div>⌨️ Type each letter as quickly as possible</div>
          <div>🎯 Accuracy and speed both matter</div>
          
          {/* Progress Indicators */}
          <div className="mt-4 flex justify-center gap-1">
            {Array.from({ length: Math.min(consecutiveHits, 10) }, (_, i) => (
              <div key={i} className="w-2 h-2 bg-yellow-400 rounded-full" />
            ))}
            {consecutiveHits > 10 && (
              <div className="text-xs text-yellow-400 ml-2">+{consecutiveHits - 10}</div>
            )}
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="mt-6 text-xs opacity-60">
          {isActive ? 
            (currentLetter ? 'Waiting for keypress...' : 'Next letter coming...') : 
            'Game paused'
          }
        </div>
      </div>
    </div>
  )
}