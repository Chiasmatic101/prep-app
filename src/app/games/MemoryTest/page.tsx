'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const gridSize = 2 // 2x2 grid
const totalTiles = gridSize * gridSize
const maxLevel = 9
const maxErrors = 2

type GameState = 'waiting' | 'showing' | 'playing' | 'complete'

export default function MemoryTestPage() {
  const router = useRouter()
  const [sequence, setSequence] = useState<number[]>([])
  const [userInput, setUserInput] = useState<number[]>([])
  const [activeTile, setActiveTile] = useState<number | null>(null)
  const [isShowingSequence, setIsShowingSequence] = useState<boolean>(false)
  const [level, setLevel] = useState<number>(1)
  const [errors, setErrors] = useState<number>(0)
  const [message, setMessage] = useState<string>('Get ready to watch the pattern')
  const [resetCount, setResetCount] = useState<number>(0)
  const [gameState, setGameState] = useState<GameState>('waiting')

  useEffect(() => {
    setTimeout(() => startNewLevel(1), 1000)
  }, [])

  const startNewLevel = (newLevel: number): void => {
    const newSequence = Array.from({ length: newLevel }, () => Math.floor(Math.random() * totalTiles))
    setSequence(newSequence)
    setUserInput([])
    setIsShowingSequence(true)
    setGameState('showing')
    setMessage('Watch the pattern')
    
    // Small delay before starting sequence
    setTimeout(() => playSequence(newSequence), 500)
  }

  const playSequence = async (seq: number[]): Promise<void> => {
    for (let i = 0; i < seq.length; i++) {
      setActiveTile(seq[i])
      await new Promise<void>((res) => setTimeout(res, 800))
      setActiveTile(null)
      await new Promise<void>((res) => setTimeout(res, 400))
    }
    setIsShowingSequence(false)
    setGameState('playing')
    setMessage('Now repeat the pattern')
  }

  const handleTileClick = (index: number): void => {
    if (isShowingSequence || activeTile !== null || gameState !== 'playing') return

    const newInput = [...userInput, index]
    setUserInput(newInput)

    // Check if the current input is correct
    if (sequence[newInput.length - 1] !== index) {
      const newErrorCount = errors + 1
      setErrors(newErrorCount)
      
      if (newErrorCount >= maxErrors) {
        setMessage('Moving to next page...')
        setGameState('complete')
        setTimeout(() => router.push('/info_pages/cognition_preference'), 2000)
      } else {
        setMessage(`Incorrect! ${maxErrors - newErrorCount} attempt${maxErrors - newErrorCount === 1 ? '' : 's'} remaining...`)
        setTimeout(() => {
          setLevel(1)
          setErrors(0) // Reset errors when restarting
          startNewLevel(1)
        }, 1500)
      }
      return
    }

    // Check if sequence is complete
    if (newInput.length === sequence.length) {
      if (sequence.length === maxLevel) {
        setMessage('All levels complete! Moving to next page...')
        setGameState('complete')
        setTimeout(() => router.push('/info_pages/yourcognition'), 2000)
        return
      }
      
      setMessage('Correct! Get ready for the next round...')
      setTimeout(() => {
        const nextLevel = level + 1
        setLevel(nextLevel)
        setErrors(0) // Reset errors for new level
        startNewLevel(nextLevel)
      }, 1500)
    }
  }

  const resetGame = (): void => {
    const newResetCount = resetCount + 1
    setResetCount(newResetCount)
    
    if (newResetCount > 3) {
      setMessage('Moving to next page...')
      setGameState('complete')
      setTimeout(() => router.push('/info_pages/yourcognition'), 2000)
      return
    }
    
    setLevel(1)
    setErrors(0)
    setUserInput([])
    setActiveTile(null)
    setGameState('waiting')
    setMessage('Get ready to watch the pattern')
    setTimeout(() => startNewLevel(1), 1000)
  }

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-4">Memory Test - Level {level}</h1>
      <p className="mb-6 text-gray-300">{message}</p>
      
      {/* Fixed grid classes instead of dynamic */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {Array.from({ length: totalTiles }, (_, idx) => (
          <div
            key={idx}
            onClick={() => handleTileClick(idx)}
            className={`w-24 h-24 rounded-md cursor-pointer transition-all duration-200 ${
              activeTile === idx 
                ? 'bg-blue-500 scale-95' 
                : userInput.includes(idx) 
                  ? 'bg-green-600' 
                  : 'bg-gray-800 hover:bg-gray-700'
            } ${isShowingSequence || gameState !== 'playing' ? 'cursor-not-allowed' : ''}`}
          />
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={resetGame}
          disabled={gameState === 'complete'}
          className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset Game
        </button>
        
        <div className="text-sm text-gray-400 flex items-center">
          Errors: {errors}/{maxErrors}
        </div>
      </div>
    </main>
  )
}