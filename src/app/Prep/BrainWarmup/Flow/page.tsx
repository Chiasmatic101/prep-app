// app/Prep/MindWarmup/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const stages = [
  {
    title: 'Let’s Begin! 🎮',
    subtitle: 'Start with a quick brain game to wake up your focus.',
    action: 'Start Game',
    route: '/Prep/PrepGames/ReactionTimeGame',
    duration: 60
  },
  {
    title: 'Box Breathing 🌬️',
    subtitle: 'Breathe in for 4, hold for 4, out for 4, hold for 4.',
    action: 'Start Breathing',
    route: '/Prep/MindWarmup/BoxBreathing',
    duration: 60
  },
  {
    title: 'Brain Boost 🎯',
    subtitle: 'Let’s fire up your memory with a quick game.',
    action: 'Start Game',
    route: '/Prep/PrepGames/MemoryTest_Prep',
    duration: 60
  },
  {
    title: 'Move Your Body 🧍‍♂️',
    subtitle: 'March in place or stretch your arms to refresh your brain.',
    action: 'Start Movement',
    route: '/Prep/MindWarmup/StretchGuide',
    duration: 60
  },
  {
    title: 'Last Push! 🏃',
    subtitle: 'One last short challenge to sharpen your mind.',
    action: 'Final Game',
    route: '/Prep/PrepGames/ColorSortPrep',
    duration: 60
  }
]

export default function MindWarmupPage() {
  const router = useRouter()
  const [stageIndex, setStageIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(stages[0].duration)

  useEffect(() => {
    if (timeLeft === 0) {
      const nextIndex = stageIndex + 1
      if (nextIndex < stages.length) {
        setStageIndex(nextIndex)
        setTimeLeft(stages[nextIndex].duration)
      }
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, stageIndex])

  const stage = stages[stageIndex]

  return (
    <main className="p-6 max-w-xl mx-auto text-center">
      <h1 className="text-3xl font-bold mb-2">{stage.title}</h1>
      <p className="text-lg text-gray-700 mb-4">{stage.subtitle}</p>
      <button
        onClick={() => router.push(stage.route)}
        className="bg-blue-600 text-white px-6 py-3 rounded-full text-lg shadow hover:bg-blue-700"
      >
        {stage.action}
      </button>
      <p className="mt-4 text-sm text-gray-500">Next in: {timeLeft}s</p>
    </main>
  )
}
