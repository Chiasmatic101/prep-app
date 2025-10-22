'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/firebase/config'
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { Moon, Clock, TrendingUp, Calendar, AlertCircle, Award, BarChart3 } from 'lucide-react'

// Types
interface SleepEntry {
  bedTime: string
  wakeTime: string
  date: string
  wakingEvents?: number
  sleepDuration: {
    hours: number
    minutes: number
    totalMinutes: number
  }
}

interface SleepQualityData {
  score: number
  durationScore: number
  wakingScore: number
  totalSleepHours: number
  wakingEvents: number
  date: string
}

export default function SleepQualityPage() {
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([])
  const [currentQuality, setCurrentQuality] = useState<SleepQualityData | null>(null)
  const [weeklyAverage, setWeeklyAverage] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  // Sleep Quality Score calculation
  const calculateSleepQuality = (entry: SleepEntry): SleepQualityData => {
    const T = entry.sleepDuration.totalMinutes / 60 // Convert to hours
    const WA = entry.wakingEvents || 0
    
    // Hyperparameters
    const w_dur = 0.7
    const w_wake = 0.3
    const alpha = 0.10
    
    // Duration subscore (cap at 7.5h)
    const f_dur = Math.min(T / 7.5, 1.0)
    
    // Waking-events subscore
    const f_wake = Math.max(Math.min(1 - alpha * WA, 1), 0)
    
    // Combine
    const SQS = 100 * (w_dur * f_dur + w_wake * f_wake)
    
    return {
      score: Math.round(SQS),
      durationScore: Math.round(f_dur * 100),
      wakingScore: Math.round(f_wake * 100),
      totalSleepHours: T,
      wakingEvents: WA,
      date: entry.date
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBackground = (score: number) => {
    if (score >= 85) return 'bg-green-50 border-green-200'
    if (score >= 70) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Excellent'
    if (score >= 70) return 'Good'
    if (score >= 55) return 'Fair'
    return 'Needs Improvement'
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch sleep entries from the last 30 days
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          
          const sleepQuery = query(
            collection(db, 'users', user.uid, 'sleepEntries'),
            where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0]),
            orderBy('date', 'desc'),
            limit(30)
          )
          
          const sleepSnapshot = await getDocs(sleepQuery)
          const entries: SleepEntry[] = []
          
          sleepSnapshot.forEach((doc) => {
            entries.push(doc.data() as SleepEntry)
          })
          
          setSleepEntries(entries)
          
          if (entries.length > 0) {
            // Calculate current quality (most recent entry)
            const latestEntry = entries[0]
            const currentQuality = calculateSleepQuality(latestEntry)
            setCurrentQuality(currentQuality)
            
            // Calculate weekly average (last 7 entries)
            const recentEntries = entries.slice(0, 7)
            const qualityScores = recentEntries.map(entry => calculateSleepQuality(entry).score)
            const average = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
            setWeeklyAverage(Math.round(average))
          }
        } catch (err) {
          console.error('Error fetching sleep data:', err)
          setError('Failed to load sleep data')
        }
      } else {
        router.push('/auth')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600 font-medium">Analyzing your sleep quality...</p>
        </motion.div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-md"
        >
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push('/about-me')}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-full font-medium transition"
          >
            Back to Profile
          </button>
        </motion.div>
      </main>
    )
  }

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-yellow-50 to-pink-100 text-gray-900 px-6 py-16">
      <div className="max-w-4xl mx-auto">
        
        {/* Navigation */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline"
          >
            <span>←</span>
            Back to Profile
          </button>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Moon className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Sleep Quality <span className="text-purple-500">Analysis</span>
          </h1>
          <p className="text-lg text-gray-700">Evidence-based sleep quality assessment</p>
        </motion.div>

        {sleepEntries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/40 backdrop-blur-sm rounded-[2rem] p-12 border border-white/40 shadow-lg text-center"
          >
            <Moon className="w-24 h-24 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-700 mb-4">No Sleep Data Available</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start tracking your sleep patterns to receive personalized quality insights and recommendations.
            </p>
            <button
              onClick={() => router.push('/about-me')}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
            >
              Start Sleep Tracking
            </button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            
            {/* Current Sleep Quality Score */}
            {currentQuality && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={`rounded-[2rem] p-8 border shadow-lg ${getScoreBackground(currentQuality.score)}`}
              >
                <div className="text-center">
                  <div className="flex justify-center items-center gap-4 mb-6">
                    <Award className="w-8 h-8 text-purple-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Current Sleep Quality Score</h2>
                  </div>
                  
                  <div className="mb-6">
                    <div className={`text-6xl font-extrabold mb-2 ${getScoreColor(currentQuality.score)}`}>
                      {currentQuality.score}
                    </div>
                    <div className={`text-xl font-semibold ${getScoreColor(currentQuality.score)}`}>
                      {getScoreLabel(currentQuality.score)}
                    </div>
                    <div className="text-gray-600 text-sm mt-2">
                      Based on sleep from {new Date(currentQuality.date).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/50 rounded-xl p-4">
                      <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                      <div className="text-sm text-gray-600 mb-1">Sleep Duration</div>
                      <div className="text-2xl font-bold text-blue-600">{currentQuality.durationScore}</div>
                      <div className="text-xs text-gray-500">
                        {currentQuality.totalSleepHours.toFixed(1)}h total
                      </div>
                    </div>
                    
                    <div className="bg-white/50 rounded-xl p-4">
                      <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                      <div className="text-sm text-gray-600 mb-1">Sleep Continuity</div>
                      <div className="text-2xl font-bold text-green-600">{currentQuality.wakingScore}</div>
                      <div className="text-xs text-gray-500">
                        {currentQuality.wakingEvents} wake events
                      </div>
                    </div>
                    
                    <div className="bg-white/50 rounded-xl p-4">
                      <BarChart3 className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                      <div className="text-sm text-gray-600 mb-1">7-Day Average</div>
                      <div className={`text-2xl font-bold ${getScoreColor(weeklyAverage)}`}>
                        {weeklyAverage}
                      </div>
                      <div className="text-xs text-gray-500">
                        {getScoreLabel(weeklyAverage)}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Sleep Quality Insights */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg"
            >
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Sleep Quality Insights
              </h3>
              
              <div className="space-y-4">
                {currentQuality && (
                  <>
                    {currentQuality.durationScore < 80 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="font-semibold text-yellow-800 mb-1">Duration Optimization</div>
                        <div className="text-yellow-700 text-sm">
                          Your sleep duration of {currentQuality.totalSleepHours.toFixed(1)} hours could be improved. 
                          Aim for 7.5-9 hours for optimal cognitive performance.
                        </div>
                      </div>
                    )}
                    
                    {currentQuality.wakingEvents > 2 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="font-semibold text-red-800 mb-1">Sleep Continuity</div>
                        <div className="text-red-700 text-sm">
                          You experienced {currentQuality.wakingEvents} waking events. Consider optimizing your 
                          sleep environment and reviewing potential disruption factors.
                        </div>
                      </div>
                    )}
                    
                    {currentQuality.score >= 85 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="font-semibold text-green-800 mb-1">Excellent Sleep Quality</div>
                        <div className="text-green-700 text-sm">
                          Your sleep quality is excellent! Continue maintaining your current sleep habits 
                          for optimal cognitive performance and health.
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Recent Sleep History */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-white/40 backdrop-blur-sm rounded-xl p-6 border border-white/40 shadow-lg"
            >
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Recent Sleep Quality History
              </h3>
              
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {sleepEntries.slice(0, 10).map((entry, index) => {
                  const quality = calculateSleepQuality(entry)
                  return (
                    <div key={entry.date} className="flex items-center justify-between bg-white/30 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="text-gray-600">{new Date(entry.date).toLocaleDateString()}</div>
                        <div className="text-gray-500">
                          {quality.totalSleepHours.toFixed(1)}h sleep
                        </div>
                        {quality.wakingEvents > 0 && (
                          <div className="text-gray-500 text-xs bg-gray-100 px-2 py-1 rounded">
                            {quality.wakingEvents} wakes
                          </div>
                        )}
                      </div>
                      <div className={`font-bold ${getScoreColor(quality.score)}`}>
                        {quality.score}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="text-center space-y-4"
            >
              <div className="space-x-4">
                <button
                  onClick={() => router.push('/about-me')}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
                >
                  Track New Sleep
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-white/50 backdrop-blur-sm hover:bg-white/70 text-purple-700 px-8 py-3 rounded-full font-semibold border border-purple-300 transition-all hover:scale-105"
                >
                  View Full Analytics
                </button>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-2">Sleep Quality Score Algorithm:</div>
                <div className="text-xs text-gray-600 max-w-2xl mx-auto">
                  SQS = 100 × (0.7 × duration_score + 0.3 × continuity_score)
                  <br />
                  Duration optimal at 7.5h+ • Each wake event reduces continuity by 10%
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </main>
  )
}