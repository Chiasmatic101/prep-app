'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Target, ExternalLink, CheckCircle, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ChallengeProgress {
  challengeId: string
  startDate: string
  isActive: boolean
  currentDay: number
  totalDays: number
  dailyProgress: { [day: number]: boolean }
  targetValue?: string
  points: number
  completedDays: number
  notes?: string[]
}

interface Challenge {
  id: string
  title: string
  goal: string
  duration: string
  rules: string[]
  verification: string
  basePoints: number
  bonusPoints?: string
  icon: React.ReactNode
  color: string
  bgGradient: string
}

interface ActiveChallengeDisplay {
  challengeId: string
  title: string
  goal: string
  currentDay: number
  totalDays: number
  completedDays: number
  todayTarget?: string
  icon: React.ReactNode
  color: string
  bgGradient: string
}

const CHALLENGES: Challenge[] = [
  {
    id: 'fifteen-minute-shift',
    title: '15-Minute Shift Week',
    goal: 'Nudge bedtime/wake time toward school schedule',
    duration: '7 days',
    rules: ['Shift target bedtime by ±15 min/day'],
    verification: 'Sleep timestamps within ±10 min of target',
    basePoints: 50,
    icon: <Clock className="w-6 h-6" />,
    color: 'blue',
    bgGradient: 'from-blue-500 to-cyan-600'
  },
  {
    id: 'wake-time-anchor',
    title: 'Wake-Time Anchor Streak',
    goal: 'Lock a consistent wake time',
    duration: '10 days',
    rules: ['Wake within ±20 min of target time'],
    verification: 'Wearable wake or self-report; 8/10 days success',
    basePoints: 80,
    icon: <Target className="w-6 h-6" />,
    color: 'orange',
    bgGradient: 'from-orange-500 to-yellow-600'
  }
  // Add more challenges if needed...
]

const getTodaysTarget = (progress: ChallengeProgress): string | undefined => {
  if (!progress.targetValue) return undefined

  if (progress.challengeId === 'fifteen-minute-shift') {
    const baseTime = new Date(`2024-01-01T${progress.targetValue}`)
    const shiftMinutes = (progress.currentDay - 1) * 15
    const targetTime = new Date(baseTime.getTime() + shiftMinutes * 60000)
    return `Bedtime: ${targetTime.toTimeString().slice(0, 5)}`
  }

  if (progress.challengeId === 'wake-time-anchor') {
    return `Wake by: ${progress.targetValue}`
  }

  return undefined
}

const getChallengeDisplayData = (progress: ChallengeProgress): ActiveChallengeDisplay | null => {
  const challengeInfo = CHALLENGES.find(c => c.id === progress.challengeId)
  if (!challengeInfo) return null

  const todayTarget = getTodaysTarget(progress)

  return {
    challengeId: progress.challengeId,
    title: challengeInfo.title,
    goal: challengeInfo.goal,
    currentDay: progress.currentDay,
    totalDays: progress.totalDays,
    completedDays: progress.completedDays,
    todayTarget,
    icon: challengeInfo.icon,
    color: challengeInfo.color,
    bgGradient: challengeInfo.bgGradient
  }
}

interface ActiveChallengesStripProps {
  activeChallenges: ChallengeProgress[]
  onLogProgress: (challengeId: string, success: boolean) => void
}

const ActiveChallengesStrip: React.FC<ActiveChallengesStripProps> = ({
  activeChallenges,
  onLogProgress
}) => {
  const router = useRouter()
  if (activeChallenges.length === 0) return null

  const topChallenges = activeChallenges
    .slice(0, 2)
    .map(getChallengeDisplayData)
    .filter(Boolean) as ActiveChallengeDisplay[]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-r from-purple-100/80 to-pink-100/80 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/50 shadow-lg mb-8"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
          <Target className="w-5 h-5" />
          My Active Challenges
        </h3>
        <button
          onClick={() => router.push('/Prep/Challenges')}
          className="text-purple-700 hover:text-purple-800 text-sm font-medium flex items-center gap-1 hover:underline"
        >
          View All
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {topChallenges.map((challenge) => (
          <div
            key={challenge.challengeId}
            className="bg-white/70 backdrop-blur-md rounded-xl p-6 border border-white/40 shadow-md"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-r ${challenge.bgGradient} text-white`}>
                {challenge.icon}
              </div>
              <div>
                <h4 className="font-bold text-gray-800">{challenge.title}</h4>
                <p className="text-sm text-gray-600">
                  {challenge.todayTarget || challenge.goal}
                </p>
              </div>
            </div>

            {/* How to achieve */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <h5 className="text-sm font-semibold text-gray-700 mb-1">How to achieve:</h5>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-1">
                {CHALLENGES.find(c => c.id === challenge.challengeId)?.rules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progress</span>
                <span>{challenge.completedDays}/{challenge.totalDays} days</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${challenge.bgGradient}`}
                  style={{ width: `${(challenge.completedDays / challenge.totalDays) * 100}%` }}
                />
              </div>
            </div>

            {/* Did you achieve this today? */}
            <div className="space-y-2">
              <p className="text-sm text-gray-700 font-medium">Did you achieve this today?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onLogProgress(challenge.challengeId, true)}
                  className="flex-1 bg-green-500 hover:bg-green-400 text-white py-2 px-3 rounded-lg text-sm font-medium"
                >
                  ✓ Yes
                </button>
                <button
                  onClick={() => onLogProgress(challenge.challengeId, false)}
                  className="flex-1 bg-red-500 hover:bg-red-400 text-white py-2 px-3 rounded-lg text-sm font-medium"
                >
                  ✗ No
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeChallenges.length > 2 && (
        <div className="mt-4 text-center">
          <div className="text-sm text-purple-700">
            +{activeChallenges.length - 2} more active challenge
            {activeChallenges.length - 2 > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default ActiveChallengesStrip
