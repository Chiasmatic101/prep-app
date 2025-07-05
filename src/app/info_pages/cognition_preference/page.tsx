'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const cognitiveDomains: string[] = [
  'Memory',
  'Focus',
  'Decision-Making',
  'Processing Speed',
  'Attention',
  'Spatial Awareness',
  'Inhibition Control',
  'Mental Flexibility',
  'Visual Tracking'
]

export default function SleepImpactPage() {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])

  const toggleSelection = (domain: string): void => {
    setSelected(prev =>
      prev.includes(domain) ? prev.filter(d => d !== domain) : prev.length < 3 ? [...prev, domain] : prev
    )
  }

  const handleContinue = (): void => {
    // Save selected domains to localStorage or context if needed
    if (selected.length > 0) {
      localStorage.setItem('selectedCognitiveDomains', JSON.stringify(selected))
      router.push('/games/ColorSort')
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-6 text-center">What aspect of your cognition is most important to you?</h1>
      <p className="text-gray-400 text-center mb-10 max-w-xl">
        Choose up to three domains you care most about improving. We'll use your selection to personalize your experience.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        {cognitiveDomains.map((domain) => (
          <button
            key={domain}
            onClick={() => toggleSelection(domain)}
            className={`px-4 py-2 rounded-lg border text-center transition-all duration-300
              ${selected.includes(domain) ? 'bg-blue-600 border-blue-400' : 'bg-gray-900 border-gray-700 hover:border-gray-500'}`}
          >
            {domain}
          </button>
        ))}
      </div>

      <div className="text-center mb-4">
        <p className="text-sm text-gray-400">
          Selected: {selected.length}/3
        </p>
      </div>

      <button
        className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition text-white disabled:opacity-50"
        onClick={handleContinue}
        disabled={selected.length === 0}
      >
        Continue
      </button>
    </main>
  )
}