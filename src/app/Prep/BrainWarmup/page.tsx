'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Import modified game components
import dynamic from 'next/dynamic'

const ReactionTapWarmup = dynamic(() => import('./components/ReactionTapWarmup'), { ssr: false })
const WordUnscrambleWarmup = dynamic(() => import('./components/WordUnscrambleWarmup'), { ssr: false })
const BoxBreathingWarmup = dynamic(() => import('./components/BoxBreathingWarmup'), { ssr: false })
const MemoryTestWarmup = dynamic(() => import('./components/MemoryTestWarmup'), { ssr: false })
const ColorSortWarmup = dynamic(() => import('./components/ColorSortWarmup'), { ssr: false })
const StretchWarmup = dynamic(() => import('./components/StretchWarmup'), { ssr: false })

const stages = [
  {
    id: 'reaction',
    title: 'Finger Tap Challenge ⚡',
    subtitle: 'Tap letters as fast as you can to wake up your reflexes!',
    component: 'ReactionTap',
    duration: 30, // 30 seconds
    color: 'from-green-500 to-blue-500'
  },
  {
    id: 'unscramble',
    title: 'Word Flex 🔤',
    subtitle: 'Unscramble words to activate your language centers!',
    component: 'WordUnscramble',
    duration: 30, // 30 seconds
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'breathing',
    title: 'Focus Breathing 🌬️',
    subtitle: 'Breathe deeply to center your mind and boost oxygen flow.',
    component: 'BoxBreathing',
    duration: 60, // 1 minute
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'memory',
    title: 'Memory Boost 🧠',
    subtitle: 'Challenge your visual memory with pattern recognition!',
    component: 'MemoryTest',
    duration: 60, // 1 minute
    color: 'from-indigo-500 to-purple-500'
  },
  {
    id: 'problem',
    title: 'Problem Solving 🎯',
    subtitle: 'Quick color sorting to activate logical thinking!',
    component: 'ColorSort',
    duration: 60, // 1 minute
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 'stretch',
    title: 'Body & Mind Sync 🧘',
    subtitle: 'Quick movements to energize your whole system!',
    component: 'Stretch',
    duration: 60, // 1 minute
    color: 'from-emerald-500 to-teal-500'
  }
]

interface BrainWarmupFlowProps {
  onComplete?: () => void
}

export default function BrainWarmupFlow({ onComplete }: BrainWarmupFlowProps) {
  const router = useRouter()
  const [currentStage, setCurrentStage] = useState(0)
  const [timeLeft, setTimeLeft] = useState(stages[0].duration)
  const [isActive, setIsActive] = useState(false)
  const [showTransition, setShowTransition] = useState(false)
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const stageStartTime = useRef<number>(Date.now())

  const totalDuration = stages.reduce((sum, stage) => sum + stage.duration, 0)

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1)
        setTotalTimeElapsed(prev => prev + 1)
      }, 1000)
    } else if (timeLeft === 0 && isActive) {
      handleStageComplete()
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeLeft, isActive])

  const handleStageComplete = () => {
    setIsActive(false)
    
    if (currentStage < stages.length - 1) {
      setShowTransition(true)
      
      setTimeout(() => {
        setCurrentStage(prev => prev + 1)
        setTimeLeft(stages[currentStage + 1].duration)
        setShowTransition(false)
        stageStartTime.current = Date.now()
        setIsActive(true)
      }, 2000) // 2 second transition
    } else {
      // Flow complete
      setTimeout(() => {
        if (onComplete) {
          onComplete()
        } else {
          router.push('/Prep/PrepGames/GameSelection')
        }
      }, 2000)
    }
  }

  const startFlow = () => {
    setIsActive(true)
    stageStartTime.current = Date.now()
  }

  const pauseFlow = () => {
    setIsActive(false)
  }

  const resumeFlow = () => {
    setIsActive(true)
  }

  const skipStage = () => {
    setTimeLeft(0)
  }

  const exitFlow = () => {
    router.push('/Prep/PrepGames/GameSelection')
  }

  const renderCurrentGame = () => {
    const stage = stages[currentStage]
    const gameProps = {
      duration: stage.duration,
      onComplete: handleStageComplete,
      timeLeft,
      isActive
    }

    switch (stage.component) {
      case 'ReactionTap':
        return <ReactionTapWarmup {...gameProps} />
      case 'WordUnscramble':
        return <WordUnscrambleWarmup {...gameProps} />
      case 'BoxBreathing':
        return <BoxBreathingWarmup {...gameProps} />
      case 'MemoryTest':
        return <MemoryTestWarmup {...gameProps} />
      case 'ColorSort':
        return <ColorSortWarmup {...gameProps} />
      case 'Stretch':
        return <StretchWarmup {...gameProps} />
      default:
        return null
    }
  }

  if (!isActive && currentStage === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            5-Minute Brain Warmup 🧠⚡
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            A quick, scientifically-designed sequence to activate your cognitive abilities and prepare your mind for peak performance.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {stages.map((stage, index) => (
              <div key={stage.id} className="bg-white/40 rounded-lg p-4 backdrop-blur-sm">
                <div className="text-2xl mb-2">{stage.title.split(' ')[stage.title.split(' ').length - 1]}</div>
                <div className="text-sm font-semibold">{stage.title.replace(/[⚡🔤🌬️🧠🎯🧘]/g, '').trim()}</div>
                <div className="text-xs text-gray-600 mt-1">{stage.duration}s</div>
              </div>
            ))}
          </div>

          <div className="mb-8">
            <div className="text-lg font-semibold mb-2">Total Duration: {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}</div>
            <div className="text-sm text-gray-600">Each activity flows seamlessly into the next</div>
          </div>

          <button
            onClick={startFlow}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl font-semibold rounded-full shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
          >
            Start Warmup 🚀
          </button>
        </div>
      </main>
    )
  }

  if (showTransition) {
    const nextStage = stages[currentStage + 1] || stages[currentStage]
    return (
      <main className={`min-h-screen bg-gradient-to-br ${nextStage.color} flex items-center justify-center p-6 text-white`}>
        <div className="text-center">
          <div className="text-6xl mb-4">✨</div>
          <h2 className="text-4xl font-bold mb-4">Great Job!</h2>
          <h3 className="text-2xl font-semibold mb-2">Next: {nextStage.title}</h3>
          <p className="text-lg opacity-90">{nextStage.subtitle}</p>
          <div className="mt-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      </main>
    )
  }

  if (currentStage >= stages.length) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
            Warmup Complete!
          </h1>
          <p className="text-xl text-gray-700 mb-8">
            Your brain is now primed and ready for peak performance!
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto text-sm">
            <div className="bg-white/40 rounded-lg p-3">
              <div className="font-bold">⚡ Reflexes</div>
              <div className="text-green-600">Activated</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <div className="font-bold">🧠 Memory</div>
              <div className="text-green-600">Enhanced</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <div className="font-bold">🎯 Focus</div>
              <div className="text-green-600">Sharpened</div>
            </div>
            <div className="bg-white/40 rounded-lg p-3">
              <div className="font-bold">💪 Energy</div>
              <div className="text-green-600">Boosted</div>
            </div>
          </div>
          <button
            onClick={() => router.push('/Prep/PrepGames/GameSelection')}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-500 text-white text-xl font-semibold rounded-full shadow-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200 transform hover:scale-105"
          >
            Continue to Games 🎮
          </button>
        </div>
      </main>
    )
  }

  const stage = stages[currentStage]
  const progress = ((totalTimeElapsed) / totalDuration) * 100

  return (
    <main className={`min-h-screen bg-gradient-to-br ${stage.color} text-white`}>
      {/* Header with progress */}
      <div className="p-4 border-b border-white/20">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{stage.title}</h1>
            <div className="flex gap-2">
              <button
                onClick={isActive ? pauseFlow : resumeFlow}
                className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                {isActive ? '⏸️' : '▶️'}
              </button>
              <button
                onClick={skipStage}
                className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                ⏭️ Skip
              </button>
              <button
                onClick={exitFlow}
                className="px-4 py-2 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors"
              >
                ❌ Exit
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm opacity-90">{stage.subtitle}</div>
            <div className="ml-auto text-sm font-mono">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/60 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="mt-2 flex justify-between text-xs opacity-75">
            <span>Stage {currentStage + 1} of {stages.length}</span>
            <span>{Math.floor(totalTimeElapsed / 60)}:{(totalTimeElapsed % 60).toString().padStart(2, '0')} / {Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      {/* Game content */}
      <div className="flex-1">
        {renderCurrentGame()}
      </div>
    </main>
  )
}