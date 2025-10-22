// app/Prep/MindWarmup/StretchGuide/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const steps = [
  {
    title: 'March in Place 🦶',
    description: 'Stand tall and lift your knees high, one at a time, like marching in a parade.',
    image: '/illustrations/march.png', // Replace with your actual image path
    duration: 30
  },
  {
    title: 'Chair Stretch & Reach 🙆',
    description: 'Sit or stand, stretch your arms high above your head, then twist left and right slowly.',
    image: '/illustrations/stretch.png',
    duration: 30
  }
]

export default function StretchGuide() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(steps[0].duration)

  useEffect(() => {
    if (timeLeft === 0) {
      const next = stepIndex + 1
      if (next < steps.length) {
        setStepIndex(next)
        setTimeLeft(steps[next].duration)
      } else {
        router.push('/Prep/MindWarmup')
      }
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, stepIndex])

  const step = steps[stepIndex]

  return (
    <main className="p-6 max-w-xl mx-auto text-center">
      <h1 className="text-2xl font-bold mb-2">{step.title}</h1>
      <p className="text-md text-gray-700 mb-4">{step.description}</p>
      <div className="flex justify-center mb-4">
        <img src={step.image} alt={step.title} className="w-60 h-60 object-contain" />
      </div>
      <p className="text-sm text-gray-500">Next in: {timeLeft}s</p>
    </main>
  )
}
