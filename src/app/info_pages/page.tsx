'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StartInfoPage() {
  const router = useRouter()
  const [step, setStep] = useState<number>(0)

  const textChunks: string[] = [
    'Sleep consists of multiple stages.',
    'Each stage is linked to a cognitive domain.',
    "When you don't get enough sleep, your cognition suffers — you notice this in your daytime activities.",
    "Let's quickly test your cognition, this will take less than 4 minutes",
    "First up, reaction time."
  ]

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [
      setTimeout(() => setStep(1), 2000),
      setTimeout(() => setStep(2), 4000),
      setTimeout(() => setStep(3), 6000),
      setTimeout(() => setStep(4), 8000)
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const handleTestCognition = (): void => {
    router.push('/games/reaction')
  }

  const handleSkipToApp = (): void => {
    router.push('/app/reaction')
  }

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-3xl text-center">
        {step < textChunks.length && (
          <h1 className="text-3xl md:text-4xl font-bold animate-fadeInOut">
            {textChunks[step]}
          </h1>
        )}
      </div>

      {step === textChunks.length - 1 && (
        <div className="mt-10 flex flex-col gap-4">
          <button
            onClick={handleTestCognition}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            Yes, I want to test my cognition (5 min)
          </button>
          <button
            onClick={handleSkipToApp}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            No, just take me to the app
          </button>
        </div>
      )}

      <style jsx>{`
        .animate-fadeInOut {
          animation: fadeInOut 2s ease-in-out;
        }
        
        @keyframes fadeInOut {
          0% { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          10% { 
            opacity: 1; 
            transform: translateY(0); 
          }
          90% { 
            opacity: 1; 
            transform: translateY(0); 
          }
          100% { 
            opacity: 0; 
            transform: translateY(-10px); 
          }
        }
      `}</style>
    </main>
  )
}