'use client'

import React, { useState, useEffect } from 'react'

interface WarmupGameProps {
  duration: number
  onComplete: () => void
  timeLeft: number
  isActive: boolean
}

export default function StretchWarmup({ duration, onComplete, timeLeft, isActive }: WarmupGameProps) {
  const [currentExercise, setCurrentExercise] = useState(0)
  const [exerciseTime, setExerciseTime] = useState(15)

  const exercises = [
    {
      name: 'Neck Rolls',
      instruction: 'Slowly roll your head in a circle',
      emoji: '🔄',
      duration: 15
    },
    {
      name: 'Shoulder Shrugs', 
      instruction: 'Lift shoulders up, hold, then release',
      emoji: '🤷',
      duration: 15
    },
    {
      name: 'Arm Circles',
      instruction: 'Make small circles with your arms',
      emoji: '🌀',
      duration: 15
    },
    {
      name: 'Deep Breathing',
      instruction: 'Take 3 deep breaths and relax',
      emoji: '🌬️',
      duration: 15
    }
  ]

  useEffect(() => {
    if (!isActive) return

    const timer = setInterval(() => {
      setExerciseTime(prev => {
        if (prev <= 1) {
          setCurrentExercise(current => {
            const next = current + 1
            if (next >= exercises.length) {
              return current // Stay on last exercise
            }
            return next
          })
          return exercises[Math.min(currentExercise + 1, exercises.length - 1)].duration
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isActive, currentExercise, exercises])

  const exercise = exercises[currentExercise]

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="text-6xl mb-4">{exercise.emoji}</div>
          <div className="text-3xl font-bold mb-4">{exercise.name}</div>
          <div className="text-lg opacity-90">{exercise.instruction}</div>
        </div>
        
        <div className="mb-6">
          <div className="text-6xl font-mono font-bold">{exerciseTime}</div>
          <div className="text-sm opacity-75 mt-2">
            Exercise {currentExercise + 1} of {exercises.length}
          </div>
        </div>
        
        <div className="flex justify-center gap-2">
          {exercises.map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-colors ${
                index === currentExercise 
                  ? 'bg-white' 
                  : index < currentExercise 
                    ? 'bg-white/60' 
                    : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}