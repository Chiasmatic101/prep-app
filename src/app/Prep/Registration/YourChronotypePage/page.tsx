'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ChronotypeResult {
  chronotype: string
  outOfSync: number
}

export default function YourChronotypePage() {
  const [result, setResult] = useState<ChronotypeResult>({ chronotype: '', outOfSync: 0 })
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-yellow-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-md max-w-xl">
        <h1 className="text-3xl font-bold text-purple-700 mb-4">🧠 Your Chronotype Result</h1>
        <p className="text-xl mb-2">Your chronotype is: <strong>{result.chronotype}</strong></p>
        <p className="text-xl">You are out of sync by: <strong>{result.outOfSync}%</strong></p>
        <p className="mt-4 text-gray-600 mb-6">
          Being out of sync means your natural cognitive peaks don't align with your current schedule.
          The higher the percentage, the more likely you are to struggle with focus or learning efficiency during school hours.
        </p>

        <button
          onClick={() => router.push('/Prep/PrepGames/GameSelection')}
          className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold rounded-full shadow transition"
        >
          🎮 Go to Game Selection
        </button>
      </div>
    </main>
  )
}