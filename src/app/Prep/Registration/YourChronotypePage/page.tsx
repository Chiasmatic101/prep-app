'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ChronotypeResult {
  chronotype: string
  outOfSync: number
}

export default function YourChronotypePage() {
  const [result, setResult] = useState<ChronotypeResult>({ chronotype: '', outOfSync: 0 })
  const [countdown, setCountdown] = useState(5) // 5 second countdown
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('chronotypeResult')
    if (stored) {
      try {
        const parsedResult = JSON.parse(stored) as ChronotypeResult
        setResult(parsedResult)
      } catch (error) {
        console.error('Error parsing chronotype result:', error)
        // Set default values if parsing fails
        setResult({ chronotype: 'Unknown', outOfSync: 0 })
      }
    }
  }, [])

  useEffect(() => {
    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/Prep/OnboardingCog')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  const handleSkipCountdown = () => {
    router.push('/Prep/OnboardingCog')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-yellow-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-md max-w-xl">
        <h1 className="text-3xl font-bold text-purple-700 mb-4">🧠 Your Chronotype Result</h1>
        
        <div className="mb-6">
          <p className="text-xl mb-2">Your chronotype is: <strong>{result.chronotype}</strong></p>
          <p className="text-xl mb-4">You are out of sync by: <strong>{result.outOfSync}%</strong></p>
          <p className="text-gray-600">
            Being out of sync means your natural cognitive peaks don't align with your current schedule.
            The higher the percentage, the more likely you are to struggle with focus or learning efficiency during school hours.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">Next Step: Brain Behavior Testing</h2>
          <p className="text-blue-700 mb-3">
            We now want to test your current brain behavior with these fun games! 
            Please play the highlighted games for at least 2 minutes each. 
            The more you play, the more information we have - so play for as long as it's enjoyable!
          </p>
          
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <span>Redirecting in {countdown} seconds...</span>
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>

        <button
          onClick={handleSkipCountdown}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold rounded-full shadow transition"
        >
          🎮 Go to Games Now
        </button>
      </div>
    </main>
  )
}