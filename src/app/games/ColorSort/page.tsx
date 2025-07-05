'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Level configuration: [tubes, colors, ballsPerColor]
const levelConfig: [number, number, number][] = [
  [4, 2, 4],  // Level 1: 4 tubes, 2 colors, 4 balls each
  [5, 3, 4],  // Level 2: 5 tubes, 3 colors, 4 balls each  
  [6, 4, 4],  // Level 3: 6 tubes, 4 colors, 4 balls each
  [7, 5, 4],  // Level 4: 7 tubes, 5 colors, 4 balls each
  [8, 6, 4],  // Level 5: 8 tubes, 6 colors, 4 balls each
  [9, 7, 4],  // Level 6: 9 tubes, 7 colors, 4 balls each
  [10, 8, 4], // Level 7: 10 tubes, 8 colors, 4 balls each
]

const generateLevel = (level: number): string[][] => {
  const config = levelConfig[level - 1] || levelConfig[levelConfig.length - 1]
  const [tubeCount, colorCount, ballsPerColor] = config
  
  // Generate distinct colors
  const colors = Array.from({ length: colorCount }, (_, i) =>
    `hsl(${(i * 360) / colorCount}, 75%, 55%)`
  )

  // Create balls array
  const balls: string[] = []
  colors.forEach((color) => {
    for (let i = 0; i < ballsPerColor; i++) {
      balls.push(color)
    }
  })

  // Shuffle balls using Fisher-Yates algorithm
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[balls[i], balls[j]] = [balls[j], balls[i]]
  }

  // Create tubes - leave 2 empty for sorting
  const tubes = Array.from({ length: tubeCount }, () => []) as string[][]
  const filledTubes = tubeCount - 2
  
  // Distribute balls into tubes (not filling any tube completely)
  let ballIndex = 0
  for (let tubeIndex = 0; tubeIndex < filledTubes && ballIndex < balls.length; tubeIndex++) {
    const ballsInThisTube = Math.min(4, Math.ceil((balls.length - ballIndex) / (filledTubes - tubeIndex)))
    for (let i = 0; i < ballsInThisTube && ballIndex < balls.length; i++) {
      tubes[tubeIndex].push(balls[ballIndex++])
    }
  }

  return tubes
}

export default function ColorSortGame() {
  const router = useRouter()
  const [tubes, setTubes] = useState<string[][]>([])
  const [selectedTube, setSelectedTube] = useState<number | null>(null)
  const [level, setLevel] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [moves, setMoves] = useState(0)
  const [message, setMessage] = useState('Sort the colors into separate tubes')
  const [resetCount, setResetCount] = useState(0)

  useEffect(() => {
    resetLevel()
  }, [level])

  const resetLevel = () => {
    const newResetCount = resetCount + 1
    setResetCount(newResetCount)
    
    if (newResetCount > 3) {
      setMessage('Moving to next page...')
      setTimeout(() => router.push('/info_pages/MyCognitionReport'), 2000)
      return
    }
    
    setTubes(generateLevel(level))
    setCompleted(false)
    setSelectedTube(null)
    setMoves(0)
    setMessage('Sort the colors into separate tubes')
  }

  const handleTubeClick = (index: number) => {
    if (completed) return

    if (selectedTube === null) {
      // Select a tube to pour from
      if (tubes[index].length === 0) return
      setSelectedTube(index)
      setMessage('Select a tube to pour into')
    } else {
      if (selectedTube === index) {
        // Deselect if clicking the same tube
        setSelectedTube(null)
        setMessage('Sort the colors into separate tubes')
        return
      }

      // Attempt to pour from selected tube to clicked tube
      const fromTube = [...tubes[selectedTube]]
      const toTube = [...tubes[index]]

      if (fromTube.length === 0) {
        setSelectedTube(null)
        setMessage('Sort the colors into separate tubes')
        return
      }

      const topColor = fromTube[fromTube.length - 1]
      
      // Check if we can pour
      const canPour = toTube.length === 0 || 
                     (toTube.length < 4 && toTube[toTube.length - 1] === topColor)

      if (canPour) {
        // Count consecutive balls of the same color from the top
        let ballsToMove = 0
        for (let i = fromTube.length - 1; i >= 0; i--) {
          if (fromTube[i] === topColor && toTube.length + ballsToMove < 4) {
            ballsToMove++
          } else {
            break
          }
        }

        // Move the balls
        const ballsToTransfer = fromTube.splice(-ballsToMove, ballsToMove)
        toTube.push(...ballsToTransfer)

        const newTubes = [...tubes]
        newTubes[selectedTube] = fromTube
        newTubes[index] = toTube
        setTubes(newTubes)
        setMoves(moves + 1)
        
        checkCompletion(newTubes)
      } else {
        setMessage('Invalid move - colors must match')
      }

      setSelectedTube(null)
    }
  }

  const checkCompletion = (currentTubes: string[][]) => {
    const isComplete = currentTubes.every(tube => 
      tube.length === 0 || 
      (tube.length === 4 && tube.every(ball => ball === tube[0]))
    )
    
    if (isComplete) {
      setCompleted(true)
      if (level >= levelConfig.length) {
        setMessage('All levels complete! Moving to next page...')
        setTimeout(() => router.push('/MyCognitionReport'), 2000)
      } else {
        setMessage('Level complete! Get ready for the next round...')
        setTimeout(() => {
          setLevel(level + 1)
        }, 1500)
      }
    }
  }

  const nextLevel = () => {
    if (level < levelConfig.length) {
      setLevel(level + 1)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-4">Color Sort - Level {level}</h1>
      <p className="mb-6 text-gray-300">{message}</p>
      
      <div className="grid gap-3 mb-6" style={{
        gridTemplateColumns: `repeat(${Math.min(tubes.length, 8)}, minmax(0, 1fr))`
      }}>
        {tubes.map((tube, index) => (
          <div
            key={index}
            className={`w-16 h-36 border-2 rounded-xl overflow-hidden cursor-pointer 
                       flex flex-col-reverse justify-start items-center transition-all duration-200
                       ${selectedTube === index 
                         ? 'border-blue-400' 
                         : 'border-gray-700 hover:border-gray-600'}`}
            onClick={() => handleTubeClick(index)}
          >
            {tube.map((color, ballIndex) => (
              <div
                key={ballIndex}
                className="w-12 h-8 my-0.5 rounded-md"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={resetLevel}
          className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 transition"
        >
          Reset
        </button>
        
        {completed && level < levelConfig.length && (
          <button
            onClick={nextLevel}
            className="px-6 py-2 bg-blue-600 rounded hover:bg-blue-500 transition"
          >
            Next Level
          </button>
        )}
      </div>
    </main>
  )
}