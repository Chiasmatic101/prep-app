'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function ChronotypeSyncScorePage() {
  const [syncScore, setSyncScore] = useState<number | null>(null)
  const [showInsight, setShowInsight] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const storedResults = localStorage.getItem('chronotypeResults')
    const quizAnswers = storedResults ? JSON.parse(storedResults) : {}
    
    const wake = quizAnswers.naturalWake
    let chronotypePref = 'Intermediate'
    if (wake === 'Before 8 AM') chronotypePref = 'Morning'
    else if (wake === 'After 10 AM') chronotypePref = 'Evening'

    const schoolStart = quizAnswers.schoolStart
    const homeworkTime = quizAnswers.homeworkTime

    let score = 50
    if (chronotypePref === 'Morning') {
      if (schoolStart === 'Before 7:30 AM') score += 25
      if (homeworkTime === 'Right after school') score += 25
    } else if (chronotypePref === 'Evening') {
      if (schoolStart === 'After 8:00 AM') score += 25
      if (homeworkTime === 'Late at night') score += 25
    } else {
      if (schoolStart === '7:30–8:00 AM') score += 25
      if (homeworkTime === 'After dinner') score += 25
    }

    score = Math.min(score, 100)
    setSyncScore(score)
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white p-10 rounded-3xl shadow-xl max-w-xl text-center"
      >
        <h2 className="text-3xl font-bold text-purple-700 mb-4">🧭 Synchronization Score</h2>
        {syncScore !== null ? (
          <>
            <p className="text-lg text-gray-700 mb-4">
              Based on your chronotype and school/study schedule, your synchronization score is:
            </p>
            <div className="text-6xl font-bold text-green-600 mb-6">{syncScore}%</div>
            <p className="text-gray-600 text-sm mb-6">
              100% means your schedule is fully aligned with your natural rhythm. Lower scores suggest your body clock and
              school routines might be out of sync.
            </p>
            <button
              onClick={() => setShowInsight(!showInsight)}
              className="bg-yellow-500 hover:bg-yellow-400 text-white px-6 py-2 rounded-full font-medium shadow-md transition"
            >
              Why a Low Score Might Be a Good Thing 🤔
            </button>
            {showInsight && (
              <div className="mt-6 text-left text-sm text-gray-700 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                <p>
                  If your score is low, it means your brain's peak performance doesn't match your current school schedule. That
                  might sound bad — but here's the upside: you've been working at a disadvantage, and now we know! That means
                  any improvements in alignment (like timing homework better, improving sleep, or adjusting focus windows) could
                  give you a big boost in performance. It's like taking off a backpack full of bricks you didn't know you were carrying.
                </p>
              </div>
            )}
            <div className="mt-8">
              <button
                onClick={() => router.push('/Prep/howprepworks')}
                className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-full font-medium shadow-lg transition"
              >
                📘 How Prep Works
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-700">Calculating your score...</p>
        )}
      </motion.div>
    </main>
  )
}