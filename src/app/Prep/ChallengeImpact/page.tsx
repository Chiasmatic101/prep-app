'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/firebase/config'
import { doc, getDoc, collection, getDocs, orderBy, query } from 'firebase/firestore'
import Link from 'next/link'
import { TrendingUp, Brain, Moon, Utensils } from 'lucide-react'
import { calculateEnhancedSyncScore, QuizResponses, CognitiveSession, SleepEntry } from '../../../utils/enhancedsyncScoreCalculator'

// --- Types ---
interface ChallengeProgress {
  challengeId: string
  startDate: string
  isActive: boolean
  currentDay: number
  totalDays: number
  dailyProgress: { [day: number]: boolean }
  points: number
  completedDays: number
}

interface UserChallengeData {
  activeChallenges: ChallengeProgress[]
  completedChallenges: ChallengeProgress[]
  totalPoints: number
  streaks: { [challengeId: string]: number }
}

interface MetricComparison {
  baselineAvg: number
  challengeAvg: number
  delta: number
  percent: number
}

// --- Helpers ---
const compareMetrics = (baseline: number[], challenge: number[]): MetricComparison => {
  const baselineAvg = baseline.reduce((a, b) => a + b, 0) / (baseline.length || 1)
  const challengeAvg = challenge.reduce((a, b) => a + b, 0) / (challenge.length || 1)
  const delta = challengeAvg - baselineAvg
  const percent = baselineAvg ? (delta / baselineAvg) * 100 : 0
  return { baselineAvg, challengeAvg, delta, percent }
}

// --- Card Component ---
const ChallengeImpactCard: React.FC<{
  title: string
  icon: React.ReactNode
  metric: string
  result: MetricComparison
}> = ({ title, icon, metric, result }) => {
  const color =
    result.percent > 0 ? 'text-green-600' : result.percent < 0 ? 'text-red-600' : 'text-gray-600'

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-lg"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
      </div>

      <div className="text-sm text-gray-600 mb-2">Metric: {metric}</div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-bold text-gray-700">{result.baselineAvg.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Before</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-700">{result.challengeAvg.toFixed(1)}</div>
          <div className="text-xs text-gray-500">During</div>
        </div>
        <div>
          <div className={`text-lg font-bold ${color}`}>
            {result.percent >= 0 ? '+' : ''}
            {result.percent.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Change</div>
        </div>
      </div>
    </motion.div>
  )
}

// --- Main Page ---
export default function ChallengeImpactPage() {
  const [challengeData, setChallengeData] = useState<UserChallengeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparisons, setComparisons] = useState<{
    sleep: MetricComparison
    learning: MetricComparison
    cognition: MetricComparison
  } | null>(null)

  const [challengeInfo, setChallengeInfo] = useState<string>('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // --- 1. Fetch challenges ---
          const challengeDoc = await getDoc(doc(db, 'users', user.uid, 'challenges', 'shifting'))
          if (challengeDoc.exists()) {
            const data = challengeDoc.data() as UserChallengeData
            setChallengeData(data)

            // Example: describe the most recently completed challenge
            if (data.completedChallenges?.length > 0) {
              const lastChallenge = data.completedChallenges[data.completedChallenges.length - 1]
              setChallengeInfo(
                `You completed the challenge "${lastChallenge.challengeId}" lasting ${lastChallenge.totalDays} days. Here’s how it affected your key outcomes:`
              )
            }
          }

          // --- 2. Fetch sleep entries ---
          const sleepQuery = query(
            collection(db, 'users', user.uid, 'sleepEntries'),
            orderBy('date', 'asc')
          )
          const sleepSnapshot = await getDocs(sleepQuery)
          const sleepData: SleepEntry[] = sleepSnapshot.docs.map(d => d.data() as SleepEntry)

          // --- 3. Fetch cognitive sessions ---
          const cogSnapshot = await getDocs(collection(db, 'users', user.uid, 'cognitiveSessions'))
          const cognitiveData: CognitiveSession[] = cogSnapshot.docs.map(d => d.data() as CognitiveSession)

          // --- 4. Fetch survey responses (chronotype quiz) ---
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          const responses = userDoc.data()?.chronotype?.responses as QuizResponses

          // --- 5. Compute enhanced sync scores (baseline vs during split) ---
          const dailyData = sleepData.map(entry => {
            const dailyCog = cognitiveData.filter(
              s => new Date(s.timestamp).toISOString().split('T')[0] === entry.date
            )
            const results = calculateEnhancedSyncScore(responses, dailyCog, [entry])
            return {
              date: entry.date,
              learning: results.syncScore,
              sleep: entry.sleepQualityScore || results.sleepMetrics.averageQuality,
              cognition: Object.values(results.adaptiveComponents.domainReliability).reduce((a, b) => a + b, 0)
            }
          })

          // Split baseline vs challenge period (simple midpoint for now)
          const mid = Math.floor(dailyData.length / 2)
          const baseline = dailyData.slice(0, mid)
          const during = dailyData.slice(mid)

          setComparisons({
            sleep: compareMetrics(
              baseline.map(d => d.sleep),
              during.map(d => d.sleep)
            ),
            learning: compareMetrics(
              baseline.map(d => d.learning),
              during.map(d => d.learning)
            ),
            cognition: compareMetrics(
              baseline.map(d => d.cognition),
              during.map(d => d.cognition)
            )
          })
        } catch (err) {
          console.error('Error fetching challenge impact data', err)
        }
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-pink-100">
        <div className="text-purple-600 font-medium">Loading Challenge Impact...</div>
      </main>
    )
  }

  if (!comparisons) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-pink-100">
        <div className="text-gray-700">No challenge data available yet.</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-yellow-50 to-pink-100 px-6 py-16 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Challenge <span className="text-pink-500">Impact</span>
          </h1>
          <p className="text-lg text-gray-700 mb-4">{challengeInfo}</p>
          <div>
            <Link
              href="/Prep/AboutMe"
              className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-800 hover:underline"
            >
              ← Back to About Me
            </Link>
          </div>
        </motion.div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          <ChallengeImpactCard
            title="Sleep Quality"
            icon={<Moon className="w-6 h-6" />}
            metric="Sleep Quality Score"
            result={comparisons.sleep}
          />
          <ChallengeImpactCard
            title="Learning Score"
            icon={<TrendingUp className="w-6 h-6" />}
            metric="Learning Score"
            result={comparisons.learning}
          />
          <ChallengeImpactCard
            title="Cognitive Profile"
            icon={<Brain className="w-6 h-6" />}
            metric="Domain Reliability"
            result={comparisons.cognition}
          />
          <ChallengeImpactCard
            title="Diet & Activity"
            icon={<Utensils className="w-6 h-6" />}
            metric="Behavior Logs (placeholder)"
            result={compareMetrics([50, 52], [55, 58])} // TODO: Hook to nutrition/activity entries
          />
        </div>
      </div>
    </main>
  )
}
