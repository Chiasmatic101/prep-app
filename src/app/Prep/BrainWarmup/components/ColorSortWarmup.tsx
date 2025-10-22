'use client'

import React, { useState, useEffect } from 'react'

interface WarmupGameProps {
  duration: number
  onComplete: () => void
  timeLeft: number
  isActive: boolean
}

export default function ColorSortWarmup({ duration, onComplete, timeLeft, isActive }: WarmupGameProps) {
  const [tubes, setTubes] = useState<string[][]>([])
  const [selectedTube, setSelectedTube] = useState<number | null>(null)
  const [moves, setMoves] = useState(0)
  const [score, setScore] = useState(0)

  const generateSimpleLevel = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1']
    const newTubes: string[][] = [
      [colors[0], colors[1], colors[0]],
      [colors[1], colors[2], colors[1]],
      [colors[2], colors[0], colors[2]],
      [] // Empty tube
    ]
    setTubes(newTubes)
    setSelectedTube(null)
    setMoves(0)
  }

  useEffect(() => {
    generateSimpleLevel()
  }, [])

  const handleTubeClick = (index: number) => {
    if (!isActive) return

    if (selectedTube === null) {
      if (tubes[index].length > 0) {
        setSelectedTube(index)
      }
    } else {
      if (selectedTube === index) {
        setSelectedTube(null)
        return
      }

      const fromTube = [...tubes[selectedTube]]
      const toTube = [...tubes[index]]
      
      if (fromTube.length === 0) {
        setSelectedTube(null)
        return
      }

      const topColor = fromTube[fromTube.length - 1]
      const canPour = toTube.length === 0 || 
        (toTube.length < 3 && toTube[toTube.length - 1] === topColor)

      if (canPour) {
        fromTube.pop()
        toTube.push(topColor)
        const newTubes = [...tubes]
        newTubes[selectedTube] = fromTube
        newTubes[index] = toTube
        setTubes(newTubes)
        setMoves(prev => prev + 1)
        
        // Check if solved
        const isSolved = newTubes.every(tube => 
          tube.length === 0 || (tube.length === 3 && tube.every(color => color === tube[0]))
        )
        
        if (isSolved) {
          setScore(prev => prev + 1)
          setTimeout(generateSimpleLevel, 1000)
        }
      }
      setSelectedTube(null)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center">
        <div className="mb-8">
          <div className="text-4xl font-bold mb-4">Puzzles Solved: {score}</div>
          <div className="text-lg opacity-90">Sort colors into matching tubes!</div>
        </div>
        
        <div className="flex gap-4 justify-center mb-6">
          {tubes.map((tube, index) => (
            <div
              key={index}
              onClick={() => handleTubeClick(index)}
              className={`w-16 h-32 border-2 rounded-lg cursor-pointer transition-all duration-200 flex flex-col-reverse justify-start items-center ${
                selectedTube === index 
                  ? 'border-yellow-400 scale-105' 
                  : 'border-white/50 hover:border-white/80'
              } bg-white/20`}
            >
              {tube.map((color, ballIndex) => (
                <div
                  key={ballIndex}
                  className="w-12 h-8 rounded-lg my-0.5 border border-white/30"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          ))}
        </div>
        
        <div className="text-sm opacity-75">
          Moves: {moves} {selectedTube !== null && '| Selected tube ' + (selectedTube + 1)}
        </div>
      </div>
    </div>
  )
}