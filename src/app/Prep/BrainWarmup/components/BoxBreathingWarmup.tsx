'use client'

import React, { useState, useEffect } from 'react'

interface WarmupGameProps {
  duration: number
  onComplete: () => void
  timeLeft: number
  isActive: boolean
}

export default function BoxBreathingWarmup({ duration, onComplete, timeLeft, isActive }: WarmupGameProps) {
  const [phase, setPhase] = useState<'inhale' | 'hold1' | 'exhale' | 'hold2'>('inhale')
  const [phaseTime, setPhaseTime] = useState<number>(4)
  const [cycle, setCycle] = useState<number>(1)

  useEffect(() => {
    if (!isActive) return

    const phaseTimer = setInterval(() => {
      setPhaseTime(prev => {
        if (prev <= 1) {
          // Move to next phase
          setPhase(currentPhase => {
            switch (currentPhase) {
              case 'inhale': return 'hold1'
              case 'hold1': return 'exhale'
              case 'exhale': return 'hold2'
              case 'hold2': 
                setCycle(prev => prev + 1)
                return 'inhale'
              default: return 'inhale'
            }
          })
          return 4
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(phaseTimer)
  }, [isActive])

  const getPhaseInstruction = () => {
    switch (phase) {
      case 'inhale': return 'Breathe In 🌬️'
      case 'hold1': return 'Hold 🫁'
      case 'exhale': return 'Breathe Out 💨'
      case 'hold2': return 'Hold 🫁'
    }
  }

  const getCircleSize = () => {
    switch (phase) {
      case 'inhale': return 'scale-150'
      case 'hold1': return 'scale-150'
      case 'exhale': return 'scale-75'
      case 'hold2': return 'scale-75'
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="text-center">
        <div className="mb-8">
          <div className="text-2xl font-bold mb-2">Box Breathing</div>
          <div className="text-lg opacity-90">Cycle {cycle}</div>
        </div>
        
        <div className="mb-8 flex justify-center">
          <div className={`w-32 h-32 bg-white/30 rounded-full transition-all duration-1000 ease-in-out ${getCircleSize()}`}>
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-6xl">🫁</div>
            </div>
          </div>
        </div>
        
        <div className="text-3xl font-bold mb-4">{getPhaseInstruction()}</div>
        <div className="text-8xl font-mono font-bold">{phaseTime}</div>
      </div>
    </div>
  )
}