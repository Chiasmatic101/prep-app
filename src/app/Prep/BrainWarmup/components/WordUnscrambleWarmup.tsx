'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface WarmupGameProps {
  duration: number
  onComplete: () => void
  timeLeft: number
  isActive: boolean
}

export default function WordUnscrambleWarmup({ duration, onComplete, timeLeft, isActive }: WarmupGameProps) {
  const [currentWord, setCurrentWord] = useState<string>('')
  const [scrambledWord, setScrambledWord] = useState<string>('')
  const [userInput, setUserInput] = useState<string>('')
  const [score, setScore] = useState<number>(0)
  
  const WORDS = ['BRAIN', 'FOCUS', 'ALERT', 'QUICK', 'SMART', 'SPEED', 'THINK', 'POWER']

  const scrambleWord = (word: string): string => {
    const letters = word.split('')
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[letters[i], letters[j]] = [letters[j], letters[i]]
    }
    return letters.join('')
  }

  const setupNewWord = useCallback(() => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)]
    setCurrentWord(word)
    setScrambledWord(scrambleWord(word))
    setUserInput('')
  }, [])

  useEffect(() => {
    setupNewWord()
  }, [setupNewWord])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    setUserInput(value)
    
    if (value === currentWord) {
      setScore(prev => prev + 1)
      setTimeout(setupNewWord, 500)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="text-4xl font-bold mb-4">Score: {score}</div>
          <div className="text-lg opacity-90">Unscramble the word!</div>
        </div>
        
        <div className="mb-6">
          <div className="text-5xl font-bold mb-4 tracking-wider">{scrambledWord}</div>
        </div>
        
        <input
          type="text"
          value={userInput}
          onChange={handleInputChange}
          className="w-full p-4 text-2xl text-center bg-white/20 rounded-lg border-2 border-white/30 text-white placeholder-white/50"
          placeholder="Type your answer..."
          disabled={!isActive}
          autoFocus
        />
        
        <div className="mt-4 text-sm opacity-75">
          Target: {currentWord.length} letters
        </div>
      </div>
    </div>
  )
}