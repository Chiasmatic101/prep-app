'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import classNames from 'classnames'

interface Card {
  id: number
  number: number
  revealed: boolean
  correctIndex: number
}

type FeedbackType = 'correct' | 'wrong' | null

export default function MemorySequenceGame() {
  const [level, setLevel] = useState<number>(2)
  const [cards, setCards] = useState<Card[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [locked, setLocked] = useState<boolean>(true)
  const [feedback, setFeedback] = useState<FeedbackType>(null)
  const [isFlipping, setIsFlipping] = useState<boolean>(false)

  useEffect(() => {
    startNewLevel()
  }, [level])

  function startNewLevel(): void {
    setFeedback(null)
    setUserInput([])
    setLocked(true)
    setIsFlipping(false)
    
    const newCards: Card[] = Array.from({ length: level }, (_, i) => ({
      id: i,
      number: i + 1,
      revealed: true,
      correctIndex: i
    }))
    
    const shuffled = shuffle([...newCards])
    setCards(shuffled)
    
    // Show cards for study time
    setTimeout(() => {
      setIsFlipping(true)
      // Hide numbers after flip animation completes
      setTimeout(() => {
        setCards(shuffled.map(card => ({ ...card, revealed: false })))
        setLocked(false)
        setIsFlipping(false)
      }, 600) // Match the flip animation duration
    }, 2000) // Give more time to memorize
  }

  function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  function handleCardClick(card: Card): void {
    if (locked || userInput.includes(card.number) || isFlipping) return
    
    const updatedInput = [...userInput, card.number]
    setUserInput(updatedInput)
    
    if (updatedInput.length === level) {
      const isCorrect = updatedInput.every((val, idx) => val === idx + 1)
      setFeedback(isCorrect ? 'correct' : 'wrong')
      setLocked(true)
      
      setTimeout(() => {
        if (isCorrect) {
          setLevel(l => Math.min(l + 1, 20)) // Cap at level 20
        } else {
          setLevel(2) // Reset to level 2 on failure
        }
      }, 1500)
    }
  }

  const getGridLayout = (): { cols: string; size: string } => {
    if (level <= 4) return { cols: 'grid-cols-2', size: 'w-24 h-32 sm:w-28 sm:h-36' }
    if (level <= 6) return { cols: 'grid-cols-3', size: 'w-20 h-28 sm:w-24 sm:h-32' }
    if (level <= 9) return { cols: 'grid-cols-3', size: 'w-18 h-24 sm:w-20 sm:h-28' }
    if (level <= 12) return { cols: 'grid-cols-4', size: 'w-16 h-22 sm:w-18 sm:h-24' }
    if (level <= 16) return { cols: 'grid-cols-4', size: 'w-14 h-20 sm:w-16 sm:h-22' }
    return { cols: 'grid-cols-5', size: 'w-12 h-18 sm:w-14 sm:h-20' }
  }

  const getTextSize = (): string => {
    if (level <= 6) return 'text-2xl sm:text-3xl'
    if (level <= 12) return 'text-xl sm:text-2xl'
    return 'text-lg sm:text-xl'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Memory Order Game
        </h1>
        <p className="text-xl mb-2">Level {level}</p>
        <p className="text-gray-400 text-sm">
          {locked && !feedback ? `Memorize the sequence...` : 
           locked ? '' : 'Click cards in order 1, 2, 3...'}
        </p>
      </div>

      <div className={`grid ${getGridLayout().cols} gap-2 sm:gap-4 mb-8 max-w-4xl mx-auto`}>
        {cards.map(card => {
          const isClicked = userInput.includes(card.number)
          const isCorrectSequence = feedback === 'correct'
          const isWrongSequence = feedback === 'wrong'
          
          return (
            <div
              key={card.id}
              className={`${getGridLayout().size} relative`}
              style={{ perspective: '1000px' }}
            >
              <motion.div
                className="relative w-full h-full cursor-pointer"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ 
                  rotateY: card.revealed ? 0 : 180,
                  scale: isClicked ? 0.95 : 1
                }}
                transition={{ 
                  rotateY: { duration: 0.6, ease: "easeInOut" },
                  scale: { duration: 0.1 }
                }}
                onClick={() => handleCardClick(card)}
                whileHover={{ scale: locked || isFlipping ? 1 : 1.05 }}
              >
                {/* Front face - shows number */}
                <div 
                  className={classNames(
                    'absolute inset-0 w-full h-full rounded-lg flex items-center justify-center font-bold border-2',
                    'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 text-white shadow-lg',
                    getTextSize()
                  )}
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)'
                  }}
                >
                  {card.number}
                </div>
                
                {/* Back face - hidden state */}
                <div 
                  className={classNames(
                    'absolute inset-0 w-full h-full rounded-lg flex items-center justify-center font-bold border-2 shadow-lg',
                    getTextSize(),
                    {
                      'bg-gradient-to-br from-green-500 to-green-600 border-green-400': isClicked && isCorrectSequence,
                      'bg-gradient-to-br from-red-500 to-red-600 border-red-400': isClicked && isWrongSequence,
                      'bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500': !isClicked,
                    }
                  )}
                  style={{ 
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  ?
                </div>
              </motion.div>
            </div>
          )
        })}
      </div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={classNames('text-xl font-semibold px-6 py-3 rounded-lg', {
            'text-green-400 bg-green-900/20 border border-green-500/30': feedback === 'correct',
            'text-red-400 bg-red-900/20 border border-red-500/30': feedback === 'wrong'
          })}
        >
          {feedback === 'correct' ? '🎉 Correct! Next level...' : '❌ Wrong sequence! Starting over...'}
        </motion.div>
      )}
      
      <div className="mt-8 text-center text-gray-400 text-sm max-w-md">
        <p>Remember the order of numbers, then click the cards in sequence from 1 to {level}.</p>
        {level > 10 && (
          <p className="mt-2 text-yellow-400">🔥 Expert mode! Stay focused!</p>
        )}
        {level === 20 && (
          <p className="mt-2 text-purple-400 font-bold">👑 MAXIMUM LEVEL! You're a memory master!</p>
        )}
      </div>
    </div>
  )
}